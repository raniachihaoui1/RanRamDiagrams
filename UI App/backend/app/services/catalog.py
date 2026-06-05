"""Scan the models/ folder for checkpoints and LoRAs (plug-and-ready).

Returns built-in defaults too, so the generator's chips are never empty while
running in mock mode with an empty models/ folder.
"""

from __future__ import annotations

from app.config import get_settings
from app.schemas import ModelInfo

_WEIGHT_EXTS = {".safetensors", ".ckpt", ".pt", ".pth", ".gguf", ".bin"}

BUILTIN_CHECKPOINTS = [
    ModelInfo(id="flux2-dev", name="Flux 2.0 [dev]", kind="checkpoint", builtin=True),
    ModelInfo(id="flux1-dev", name="Flux.1 [dev]", kind="checkpoint", builtin=True),
]
BUILTIN_LORAS = [
    ModelInfo(
        id="big-style",
        name="BIG Diagram Style",
        kind="lora",
        builtin=True,
        trigger_token="BIG_arch_diagram",
    ),
]


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
    return _scan("checkpoints", "checkpoint") + BUILTIN_CHECKPOINTS


def list_loras() -> list[ModelInfo]:
    return _scan("loras", "lora") + BUILTIN_LORAS
