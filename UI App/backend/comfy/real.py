"""Real ComfyUI client — FLUX.2 Klein img2img / txt2img.

Activated with COMFY_MODE=real. Builds an API-format workflow programmatically
from the node types in the project's FLUX.2 Klein workflow, uploads reference
images, streams WS progress, and downloads output PNGs.
"""

from __future__ import annotations

import json
import random
import uuid
from pathlib import Path

import httpx
import websockets

from app.config import get_settings
from comfy.base import ComfyClient, GenParams, ProgressCallback

_DEFAULT_UNET = "flux-2-klein-base-4b-fp8.safetensors"
_DEFAULT_CLIP = "qwen_3_4b_fp4_flux2.safetensors"
_DEFAULT_VAE = "flux2-vae.safetensors"


class RealComfyClient(ComfyClient):
    name = "real"

    def __init__(self, base_url: str | None = None) -> None:
        settings = get_settings()
        self.base_url = (base_url or settings.comfy_url).rstrip("/")

    # ------------------------------------------------------------------
    # Workflow builder — produces a flat API-format prompt dict
    # ------------------------------------------------------------------

    def _build_workflow(self, params: GenParams, uploaded_image: str | None) -> dict:
        seed = params.seed if params.seed is not None else random.randint(0, 2**32 - 1)
        lora_name = params.loras[0] if params.loras else None
        count = max(1, min(params.count, 4))

        w: dict = {}

        # Model loaders
        w["1"] = {"class_type": "UNETLoader", "inputs": {
            "unet_name": params.model or _DEFAULT_UNET,
            "weight_dtype": "default",
        }}
        w["2"] = {"class_type": "CLIPLoader", "inputs": {
            "clip_name": _DEFAULT_CLIP,
            "type": "flux2",
        }}
        w["3"] = {"class_type": "VAELoader", "inputs": {
            "vae_name": _DEFAULT_VAE,
        }}

        # Optional LoRA
        if lora_name:
            w["4"] = {"class_type": "LoraLoader", "inputs": {
                "model": ["1", 0],
                "clip": ["2", 0],
                "lora_name": lora_name,
                "strength_model": 1.0,
                "strength_clip": 1.0,
            }}
            model_ref = ["4", 0]
            clip_ref = ["4", 1]
        else:
            model_ref = ["1", 0]
            clip_ref = ["2", 0]

        # Text encoding
        w["5"] = {"class_type": "CLIPTextEncode", "inputs": {
            "clip": clip_ref,
            "text": params.prompt,
        }}
        w["6"] = {"class_type": "CLIPTextEncode", "inputs": {
            "clip": clip_ref,
            "text": params.negative or "",
        }}

        # Latent source: img2img encodes the reference image; txt2img uses empty latent
        if uploaded_image and params.mode == "img2img":
            w["7"] = {"class_type": "LoadImage", "inputs": {
                "image": uploaded_image, "upload": "image",
            }}
            w["8"] = {"class_type": "ImageScaleToTotalPixels", "inputs": {
                "image": ["7", 0],
                "upscale_method": "nearest-exact",
                "megapixels": 1.0,
                "resolution_steps": 1,
            }}
            w["9"] = {"class_type": "VAEEncode", "inputs": {
                "pixels": ["8", 0], "vae": ["3", 0],
            }}
            # ReferenceLatent injects the encoded image into conditioning
            w["9p"] = {"class_type": "ReferenceLatent", "inputs": {
                "conditioning": ["5", 0], "latent": ["9", 0],
            }}
            w["9n"] = {"class_type": "ReferenceLatent", "inputs": {
                "conditioning": ["6", 0], "latent": ["9", 0],
            }}
            pos_ref = ["9p", 0]
            neg_ref = ["9n", 0]
            latent_ref = ["9", 0]
        else:
            w["9"] = {"class_type": "EmptyFlux2LatentImage", "inputs": {
                "width": params.width, "height": params.height, "batch_size": count,
            }}
            pos_ref = ["5", 0]
            neg_ref = ["6", 0]
            latent_ref = ["9", 0]

        # Sampler pipeline
        w["10"] = {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}}
        w["11"] = {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}}
        w["12"] = {"class_type": "Flux2Scheduler", "inputs": {
            "steps": 20, "width": params.width, "height": params.height,
        }}
        w["13"] = {"class_type": "CFGGuider", "inputs": {
            "model": model_ref, "positive": pos_ref, "negative": neg_ref, "cfg": 2.5,
        }}
        w["14"] = {"class_type": "SamplerCustomAdvanced", "inputs": {
            "noise": ["10", 0], "guider": ["13", 0],
            "sampler": ["11", 0], "sigmas": ["12", 0],
            "latent_image": latent_ref,
        }}
        w["15"] = {"class_type": "VAEDecode", "inputs": {
            "samples": ["14", 0], "vae": ["3", 0],
        }}
        w["16"] = {"class_type": "SaveImage", "inputs": {
            "images": ["15", 0], "filename_prefix": "ranram_output",
        }}

        return w

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _upload_image(self, client: httpx.AsyncClient, image_path: str) -> str:
        path = Path(image_path)
        with path.open("rb") as fh:
            resp = await client.post(
                "/upload/image",
                files={"image": (path.name, fh, "image/png")},
                data={"type": "input", "overwrite": "true"},
            )
        resp.raise_for_status()
        return resp.json()["name"]

    # ------------------------------------------------------------------
    # Main generate
    # ------------------------------------------------------------------

    async def generate(
        self, params: GenParams, on_progress: ProgressCallback
    ) -> list[bytes]:
        client_id = str(uuid.uuid4())

        async with httpx.AsyncClient(base_url=self.base_url, timeout=60) as client:
            uploaded_image: str | None = None
            if params.mode == "img2img" and params.reference_image_path:
                await on_progress(0.05, "Uploading reference image…")
                uploaded_image = await self._upload_image(client, params.reference_image_path)

            workflow = self._build_workflow(params, uploaded_image)

            await on_progress(0.1, "Queuing job…")
            resp = await client.post(
                "/prompt", json={"prompt": workflow, "client_id": client_id}
            )
            resp.raise_for_status()
            prompt_id: str = resp.json()["prompt_id"]

        # Stream WebSocket progress
        ws_url = self.base_url.replace("http://", "ws://").replace("https://", "wss://")
        ws_url = f"{ws_url}/ws?clientId={client_id}"
        await on_progress(0.15, "Generating…")

        async with websockets.connect(ws_url) as ws:
            while True:
                raw = await ws.recv()
                if isinstance(raw, bytes):
                    continue  # binary preview frames — skip
                msg = json.loads(raw)
                mtype = msg.get("type")
                data = msg.get("data", {})

                if mtype == "progress":
                    val = data.get("value", 0)
                    mx = max(data.get("max", 1), 1)
                    await on_progress(0.15 + 0.8 * (val / mx), f"Step {val}/{mx}")

                elif mtype == "executing":
                    if data.get("prompt_id") == prompt_id and data.get("node") is None:
                        break  # execution finished

                elif mtype == "execution_error":
                    if data.get("prompt_id") == prompt_id:
                        raise RuntimeError(
                            f"ComfyUI error: {data.get('exception_message', 'unknown error')}"
                        )

        # Download output images
        await on_progress(0.96, "Downloading results…")
        async with httpx.AsyncClient(base_url=self.base_url, timeout=120) as client:
            hist = await client.get(f"/history/{prompt_id}")
            hist.raise_for_status()
            outputs = hist.json().get(prompt_id, {}).get("outputs", {})

            images: list[bytes] = []
            for node_out in outputs.values():
                for img in node_out.get("images", []):
                    if img.get("type") == "output":
                        view = await client.get("/view", params={
                            "filename": img["filename"],
                            "subfolder": img.get("subfolder", ""),
                            "type": "output",
                        })
                        view.raise_for_status()
                        images.append(view.content)

        await on_progress(1.0, "Done")
        return images
