"""Real ComfyUI client for FLUX.2 Klein workflows (txt2img + img2img).

img2img node map (from flux_img2img.json):
  437          PrimitiveStringMultiline  -> prompt text
  434          LoadImage                 -> reference image filename (img2img)
  554          ImageResizeKJv2           -> auto-resizes reference to width/height
  760:749      PrimitiveInt (seed)       -> noise seed
  760:750      PrimitiveInt (steps)      -> sampling steps
  760:751      PrimitiveInt (width)      -> output width
  760:752      PrimitiveInt (height)     -> output height
  760:743      EmptyFlux2LatentImage     -> batch_size (count)
  760:744      CLIPTextEncode (neg)      -> negative prompt text
  760:759      LoraLoader                -> lora_name, strength_model, strength_clip
  760:746      UNETLoader                -> unet_name (diffusion model)

txt2img node map (from flux_txt2img.json):
  683          PrimitiveStringMultiline  -> prompt text
  685          PrimitiveInt (seed)       -> noise seed
  678:669      PrimitiveInt (width)      -> output width
  678:670      PrimitiveInt (height)     -> output height
  678:660      EmptyFlux2LatentImage     -> batch_size (count)
  678:661      CLIPTextEncode (neg)      -> negative prompt text
  678:682      LoraLoader                -> lora_name, strength_model, strength_clip
  678:663      UNETLoader                -> unet_name (diffusion model)
"""

from __future__ import annotations

import asyncio
import copy
import json
import random
import uuid
from pathlib import Path

import httpx
import websockets

from typing import Any

from app.config import get_settings
from comfy.base import ComfyClient, GenParams, MetaCallback, ProgressCallback


def _format_node_errors(node_errors: dict) -> str:
    parts: list[str] = []
    for node_id, info in node_errors.items():
        for err in info.get("errors", []):
            parts.append(f"node {node_id}: {err.get('details') or err.get('message')}")
    return "ComfyUI rejected the workflow — " + "; ".join(parts)


class RealComfyClient(ComfyClient):
    name = "real"

    def __init__(self, base_url: str | None = None) -> None:
        settings = get_settings()
        self.base_url = (base_url or settings.comfy_url).rstrip("/")
        self.workflows_dir = settings.workflows_path

    def _load_workflow(self, mode: str) -> dict:
        fname = "flux_img2img.json" if mode == "img2img" else "flux_txt2img.json"
        path: Path = self.workflows_dir / fname
        if not path.exists():
            raise FileNotFoundError(
                f"Workflow '{fname}' not found in {self.workflows_dir}. "
                "Export it from ComfyUI in API format. See workflows/README.md."
            )
        return json.loads(path.read_bytes())

    def _inject_params(self, workflow: dict, params: GenParams, image_filename: str | None = None) -> dict:
        wf = copy.deepcopy(workflow)
        seed = params.seed if params.seed is not None else random.randint(0, 2**31 - 1)

        # Require an explicit LoRA choice rather than silently using whatever
        # default is baked into the committed workflow (which points at one
        # specific machine's file and won't exist on a teammate's ComfyUI).
        if not params.loras:
            raise ValueError(
                "No LoRA selected. Pick a LoRA in the prompt bar before generating."
            )

        if params.mode == "img2img":
            return self._inject_img2img(wf, params, seed, image_filename)
        return self._inject_txt2img(wf, params, seed)

    def _inject_img2img(
        self, wf: dict, params: GenParams, seed: int, image_filename: str | None
    ) -> dict:
        wf["437"]["inputs"]["value"] = params.prompt
        wf["760:744"]["inputs"]["text"] = params.negative or ""
        wf["760:749"]["inputs"]["value"] = seed
        wf["760:751"]["inputs"]["value"] = params.width
        wf["760:752"]["inputs"]["value"] = params.height
        wf["760:743"]["inputs"]["batch_size"] = params.count

        # Diffusion model (UNETLoader). Optional — falls back to the workflow
        # default if the request didn't pick one. The id is ComfyUI's own
        # unet_name (from /object_info), so it round-trips exactly.
        if params.model:
            wf["760:746"]["inputs"]["unet_name"] = params.model

        wf["760:759"]["inputs"]["lora_name"] = params.loras[0]
        wf["760:759"]["inputs"]["strength_model"] = 1.0
        wf["760:759"]["inputs"]["strength_clip"] = 1.0

        if image_filename:
            wf["434"]["inputs"]["image"] = image_filename
            wf["554"]["inputs"]["width"] = params.width
            wf["554"]["inputs"]["height"] = params.height

        return wf

    def _inject_txt2img(self, wf: dict, params: GenParams, seed: int) -> dict:
        wf["683"]["inputs"]["value"] = params.prompt
        wf["678:661"]["inputs"]["text"] = params.negative or ""
        wf["685"]["inputs"]["value"] = seed
        wf["678:669"]["inputs"]["value"] = params.width
        wf["678:670"]["inputs"]["value"] = params.height
        wf["678:660"]["inputs"]["batch_size"] = params.count

        if params.model:
            wf["678:663"]["inputs"]["unet_name"] = params.model

        wf["678:682"]["inputs"]["lora_name"] = params.loras[0]
        wf["678:682"]["inputs"]["strength_model"] = 1.0
        wf["678:682"]["inputs"]["strength_clip"] = 1.0

        return wf

    async def _upload_image(self, client: httpx.AsyncClient, image_path: str) -> str:
        path = Path(image_path)
        with path.open("rb") as f:
            resp = await client.post(
                "/upload/image",
                files={"image": (path.name, f, "image/png")},
            )
        resp.raise_for_status()
        return resp.json()["name"]

    async def generate(
        self,
        params: GenParams,
        on_progress: ProgressCallback,
        on_meta: MetaCallback | None = None,
    ) -> list[bytes]:
        client_id = str(uuid.uuid4())

        async with httpx.AsyncClient(base_url=self.base_url, timeout=120) as client:
            # Upload reference image for img2img
            image_filename: str | None = None
            if params.mode == "img2img" and params.reference_image_path:
                image_filename = await self._upload_image(client, params.reference_image_path)

            workflow = self._inject_params(
                self._load_workflow(params.mode), params, image_filename
            )

            await on_progress(0.0, "queued")

            # Connect the WebSocket FIRST so we never miss the completion event
            # (a fast prompt could finish before we'd otherwise subscribe).
            ws_url = self.base_url.replace("http://", "ws://").replace("https://", "wss://")
            ws_url = f"{ws_url}/ws?clientId={client_id}"

            async with websockets.connect(ws_url, max_size=None) as ws:
                resp = await client.post(
                    "/prompt", json={"prompt": workflow, "client_id": client_id}
                )
                resp.raise_for_status()
                body = resp.json()

                node_errors = body.get("node_errors") or {}
                if node_errors:
                    raise RuntimeError(_format_node_errors(node_errors))

                prompt_id: str = body["prompt_id"]
                # Report the prompt_id so a cancel request can target this run.
                if on_meta is not None:
                    on_meta({"prompt_id": prompt_id})

                async for raw in ws:
                    # ComfyUI interleaves binary preview frames — skip them.
                    if isinstance(raw, (bytes, bytearray)):
                        continue
                    msg = json.loads(raw)
                    mtype = msg.get("type")
                    data = msg.get("data", {})

                    if mtype == "progress":
                        step = data.get("value", 0)
                        total = data.get("max", 1)
                        await on_progress(step / max(total, 1), "running")

                    elif mtype == "execution_error" and data.get("prompt_id") == prompt_id:
                        raise RuntimeError(
                            data.get("exception_message", "ComfyUI execution error")
                        )

                    elif mtype == "executing" and data.get("prompt_id") == prompt_id:
                        if data.get("node") is None:
                            break  # generation finished

            await on_progress(1.0, "done")

            # Fetch outputs from history
            history_resp = await client.get(f"/history/{prompt_id}", timeout=30)
            history_resp.raise_for_status()
            history = history_resp.json()

            outputs = history.get(prompt_id, {}).get("outputs", {})
            images: list[bytes] = []
            for node_output in outputs.values():
                for img_info in node_output.get("images", []):
                    if img_info.get("type") == "output":
                        dl = await client.get(
                            "/view",
                            params={
                                "filename": img_info["filename"],
                                "subfolder": img_info.get("subfolder", ""),
                                "type": "output",
                            },
                            timeout=60,
                        )
                        dl.raise_for_status()
                        images.append(dl.content)

            return images

    async def cancel(self, meta: dict[str, Any]) -> None:
        """Stop the run in ComfyUI: drop it from the queue if still pending, and
        interrupt it if it's the one currently executing. Both are best-effort."""
        prompt_id = meta.get("prompt_id")
        async with httpx.AsyncClient(base_url=self.base_url, timeout=10) as client:
            if prompt_id:
                try:
                    await client.post("/queue", json={"delete": [prompt_id]})
                except httpx.HTTPError:
                    pass
            try:
                await client.post("/interrupt")
            except httpx.HTTPError:
                pass
