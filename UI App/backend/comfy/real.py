"""Real ComfyUI client (skeleton).

Activated with COMFY_MODE=real. ComfyUI exposes:
  POST /prompt           -> queue a workflow (returns prompt_id)
  GET  /history/{id}     -> outputs once finished
  WS   /ws?clientId=...  -> live progress events
  GET  /view?filename=.. -> download an output image

To finish wiring this:
  1. Export your Flux 2.0 workflows from ComfyUI in **API format** into
     ../workflows/ (e.g. flux_txt2img.json, flux_img2img.json).
  2. Fill in `_load_workflow()` + `_inject_params()` to set the prompt, seed,
     dimensions, model and LoRA nodes by their node ids (see workflows/README).
  3. Stream `/ws` progress into `on_progress`.
No upstream code changes are required — the interface matches MockComfyClient.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx

from app.config import get_settings
from comfy.base import ComfyClient, GenParams, ProgressCallback


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
                f"Workflow '{fname}' not found in {self.workflows_dir}. Export it "
                "from ComfyUI in API format. See workflows/README.md."
            )
        return json.loads(path.read_text(encoding="utf-8"))

    def _inject_params(self, workflow: dict, params: GenParams) -> dict:
        # TODO: map node ids -> set prompt/seed/dimensions/model/loras.
        raise NotImplementedError(
            "Map your workflow's node ids in RealComfyClient._inject_params()."
        )

    async def generate(
        self, params: GenParams, on_progress: ProgressCallback
    ) -> list[bytes]:
        workflow = self._inject_params(self._load_workflow(params.mode), params)
        async with httpx.AsyncClient(base_url=self.base_url, timeout=None) as client:
            resp = await client.post("/prompt", json={"prompt": workflow})
            resp.raise_for_status()
            # TODO: subscribe to /ws for progress, poll /history, download via /view.
            raise NotImplementedError(
                "Finish the /ws progress + /history + /view download flow."
            )
