"""Catalog of available checkpoints and LoRAs.

In **real** mode the lists come straight from the running ComfyUI instance
(`/object_info`), so names match exactly what ComfyUI expects in the workflow —
you manage models only in ComfyUI's own `models/` folder, never in this repo.

In **mock** mode (no GPU/ComfyUI) the chips show built-in placeholder entries so
the UI demo is never empty. No local model files are read.
"""

from __future__ import annotations

import json
import re
from pathlib import PurePath

import httpx

from app.config import APP_ROOT, get_settings
from app.schemas import ModelInfo

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
            return [
                ModelInfo(
                    id=n,
                    name=_label(n),
                    kind="lora",
                    trigger_token=_trigger_for(n, _label(n)),
                )
                for n in names
            ]
        except Exception:  # noqa: BLE001 — fall back to placeholders if ComfyUI is down
            pass
    return MOCK_LORAS
