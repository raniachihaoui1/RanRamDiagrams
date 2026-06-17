"""Catalog of available checkpoints and LoRAs.

LoRAs come from two sources, merged:
- **ComfyUI** (`/object_info` → `LoraLoader`) in real mode — names match exactly
  what ComfyUI expects in the workflow.
- **A local folder** (`LORAS_DIR`, typically ComfyUI's own `models/loras`) scanned
  for weight files. This works even when ComfyUI's API is down and is the source
  in mock mode. Scanned ids are the path RELATIVE to LORAS_DIR, with extension and
  forward slashes, so they match the `lora_name` ComfyUI's LoraLoader expects.

If neither yields anything, built-in placeholder chips keep the UI demo non-empty.
"""

from __future__ import annotations

import json
import re
from pathlib import PurePath

import httpx

from app.config import APP_ROOT, get_settings
from app.schemas import ModelInfo

# Weight file extensions recognised when scanning the local LoRA folder.
_WEIGHT_EXTS = {".safetensors", ".ckpt", ".pt", ".pth", ".gguf", ".bin"}

# Optional, user-maintained map of LoRA name -> exact trigger token, so the
# token isn't merely guessed from the filename. See lora_triggers.example.json.
_TRIGGERS_FILE = APP_ROOT / "lora_triggers.json"

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


def _infer_trigger(label: str) -> str:
    """Best-guess trigger token from a LoRA filename: drop the trailing training
    step suffix (e.g. 'big_ran_ram_000001000' -> 'big_ran_ram'). These repos
    train with the token leading every caption, so it usually matches the name.
    The user can still edit the inserted token in the prompt.
    """
    return re.sub(r"[_-]\d{4,}$", "", label)


def _trigger_overrides() -> dict[str, str]:
    """Read the user's lora_triggers.json (if present). Keys starting with '_'
    (e.g. '__help__') are ignored so the file can carry a comment. Read fresh on
    each call so edits apply without a backend restart."""
    if not _TRIGGERS_FILE.exists():
        return {}
    try:
        data = json.loads(_TRIGGERS_FILE.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001 — a malformed override file shouldn't break the catalog
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(k): str(v) for k, v in data.items() if not str(k).startswith("_")}


def _trigger_for(comfy_name: str, label: str) -> str:
    """Resolve a LoRA's trigger token: explicit override (matched by full
    ComfyUI name or by display label) wins; otherwise guess from the filename."""
    overrides = _trigger_overrides()
    return overrides.get(comfy_name) or overrides.get(label) or _infer_trigger(label)


def list_checkpoints() -> list[ModelInfo]:
    settings = get_settings()
    if settings.comfy_mode in ("real", "auto"):
        try:
            names = _comfy_object_info("UNETLoader", "unet_name")
            return [ModelInfo(id=n, name=_label(n), kind="checkpoint") for n in names]
        except Exception:  # noqa: BLE001 — fall back to placeholders if ComfyUI is down
            pass
    return MOCK_CHECKPOINTS


def _lora_info(comfy_name: str, *, builtin: bool = False) -> ModelInfo:
    label = _label(comfy_name)
    return ModelInfo(
        id=comfy_name,
        name=label,
        kind="lora",
        builtin=builtin,
        trigger_token=_trigger_for(comfy_name, label),
    )


def _scan_local_loras() -> list[ModelInfo]:
    """Scan LORAS_DIR (recursively) for weight files. Ids are the path relative
    to the folder, with extension + forward slashes, to match ComfyUI."""
    settings = get_settings()
    root = settings.loras_path
    if root is None or not root.exists():
        return []
    out: list[ModelInfo] = []
    for p in sorted(root.rglob("*")):
        if p.is_file() and p.suffix.lower() in _WEIGHT_EXTS:
            rel = p.relative_to(root).as_posix()  # e.g. "flux/big_lora.safetensors"
            out.append(_lora_info(rel))
    return out


def list_loras() -> list[ModelInfo]:
    settings = get_settings()
    comfy: list[ModelInfo] = []
    if settings.comfy_mode in ("real", "auto"):
        try:
            names = _comfy_object_info("LoraLoader", "lora_name")
            comfy = [_lora_info(n) for n in names]
        except Exception:  # noqa: BLE001 — fall back to the local scan if ComfyUI is down
            comfy = []

    local = _scan_local_loras()

    # Merge, de-duped by id (ComfyUI's names win; both should agree when LORAS_DIR
    # points at ComfyUI's own loras folder).
    merged: dict[str, ModelInfo] = {}
    for info in [*comfy, *local]:
        merged.setdefault(info.id, info)
    result = list(merged.values())
    result.sort(key=lambda m: m.name.lower())

    return result or MOCK_LORAS
