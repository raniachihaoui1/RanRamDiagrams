"""Catalog of available checkpoints and LoRAs.

In **real** mode, the lists come straight from the running ComfyUI instance
(`/object_info`), so names match exactly what ComfyUI expects in the workflow.
In **mock** mode, scans the local models/ folder + built-in defaults so the
generator's chips are never empty.
"""

from __future__ import annotations

from pathlib import PurePath

import httpx

from app.config import get_settings
from app.schemas import ModelInfo

_WEIGHT_EXTS = {".safetensors", ".ckpt", ".pt", ".pth", ".gguf", ".bin"}


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

BUILTIN_CHECKPOINTS = [
    ModelInfo(id="flux2-dev", name="Flux 2.0 [dev]", kind="checkpoint", builtin=True),
    ModelInfo(id="flux1-dev", name="Flux.1 [dev]", kind="checkpoint", builtin=True),
]
BUILTIN_LORAS: list[ModelInfo] = []


def _scan(folder: str, kind: str) -> list[ModelInfo]:
    settings = get_settings()
    root = settings.models_path / folder
    if not root.exists():
        return []
    out: list[ModelInfo] = []
    for p in sorted(root.iterdir()):
        if p.is_file() and p.suffix.lower() in _WEIGHT_EXTS:
            out.append(ModelInfo(id=p.stem, name=p.stem, kind=kind, builtin=False))
    return out


def list_checkpoints() -> list[ModelInfo]:
    settings = get_settings()
    if settings.comfy_mode == "real":
        try:
            names = _comfy_object_info("UNETLoader", "unet_name")
            return [ModelInfo(id=n, name=_label(n), kind="checkpoint") for n in names]
        except Exception:  # noqa: BLE001 — fall back to local scan if ComfyUI is down
            pass
    return _scan("checkpoints", "checkpoint") + BUILTIN_CHECKPOINTS


def list_loras() -> list[ModelInfo]:
    settings = get_settings()
    if settings.comfy_mode == "real":
        try:
            names = _comfy_object_info("LoraLoader", "lora_name")
            return [ModelInfo(id=n, name=_label(n), kind="lora") for n in names]
        except Exception:  # noqa: BLE001 — fall back to local scan if ComfyUI is down
            pass
    return _scan("loras", "lora") + BUILTIN_LORAS
