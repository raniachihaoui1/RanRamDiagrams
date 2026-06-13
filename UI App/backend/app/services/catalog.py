"""Catalog of available checkpoints and LoRAs.

In **real** mode the lists come straight from the running ComfyUI instance
(`/object_info`), so names match exactly what ComfyUI expects in the workflow —
you manage models only in ComfyUI's own `models/` folder, never in this repo.

In **mock** mode (no GPU/ComfyUI) the chips show built-in placeholder entries so
the UI demo is never empty. No local model files are read.
"""

from __future__ import annotations

from pathlib import PurePath

import httpx

from app.config import get_settings
from app.schemas import ModelInfo

# Placeholders shown only in mock mode so the generator's chips aren't empty.
MOCK_CHECKPOINTS = [
    ModelInfo(id="flux2-dev", name="Flux 2.0 [dev]", kind="checkpoint", builtin=True),
    ModelInfo(id="flux1-dev", name="Flux.1 [dev]", kind="checkpoint", builtin=True),
]
MOCK_LORAS = [
    ModelInfo(id="demo-lora", name="Demo LoRA (mock)", kind="lora", builtin=True),
]


def _comfy_object_info(node_class: str, input_name: str) -> list[str]:
    """Fetch the list of available values for a node's combo input from ComfyUI."""
    settings = get_settings()
    url = f"{settings.comfy_url.rstrip('/')}/object_info/{node_class}"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    info = resp.json()
    options = info[node_class]["input"]["required"][input_name][0]
    return [o for o in options if isinstance(o, str)]


def _label(comfy_name: str) -> str:
    """Friendly label: drop folder + extension (keep the file stem)."""
    return PurePath(comfy_name).stem


def list_checkpoints() -> list[ModelInfo]:
    settings = get_settings()
    if settings.comfy_mode == "real":
        try:
            names = _comfy_object_info("UNETLoader", "unet_name")
            return [ModelInfo(id=n, name=_label(n), kind="checkpoint") for n in names]
        except Exception:  # noqa: BLE001 — fall back to placeholders if ComfyUI is down
            pass
    return MOCK_CHECKPOINTS


def list_loras() -> list[ModelInfo]:
    settings = get_settings()
    if settings.comfy_mode == "real":
        try:
            names = _comfy_object_info("LoraLoader", "lora_name")
            return [ModelInfo(id=n, name=_label(n), kind="lora") for n in names]
        except Exception:  # noqa: BLE001 — fall back to placeholders if ComfyUI is down
            pass
    return MOCK_LORAS
