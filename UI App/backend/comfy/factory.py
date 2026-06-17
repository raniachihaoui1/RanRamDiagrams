"""Select the ComfyUI client based on configuration.

Modes:
  auto — ping ComfyUI on every request; use real when reachable, mock otherwise.
  real — always use real ComfyUI (raises if unreachable).
  mock — always use the mock client.
"""

from __future__ import annotations

import httpx

from app.config import get_settings
from comfy.base import ComfyClient


def _comfy_reachable(url: str) -> bool:
    try:
        httpx.get(f"{url.rstrip('/')}/system_stats", timeout=2).raise_for_status()
        return True
    except Exception:
        return False


def get_comfy_client() -> ComfyClient:
    settings = get_settings()
    mode = settings.comfy_mode
    if mode == "auto":
        mode = "real" if _comfy_reachable(settings.comfy_url) else "mock"
    if mode == "real":
        from comfy.real import RealComfyClient
        return RealComfyClient()
    from comfy.mock import MockComfyClient
    return MockComfyClient()
