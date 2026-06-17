"""Select the ComfyUI client based on configuration.

Modes:
  auto — ping ComfyUI at most once every 30 s; use real when reachable, mock otherwise.
  real — always use real ComfyUI (raises if unreachable).
  mock — always use the mock client.
"""

from __future__ import annotations

import time

import httpx

from app.config import get_settings
from comfy.base import ComfyClient

# TTL cache for the auto-mode reachability check.
# Avoids blocking the event loop on every request when ComfyUI is down.
_cache: dict = {"reachable": False, "ts": 0.0}
_TTL = 30.0  # seconds between re-checks


def _comfy_reachable(url: str) -> bool:
    now = time.monotonic()
    if now - _cache["ts"] < _TTL:
        return _cache["reachable"]
    try:
        httpx.get(f"{url.rstrip('/')}/system_stats", timeout=2).raise_for_status()
        _cache["reachable"] = True
    except Exception:
        _cache["reachable"] = False
    _cache["ts"] = now
    return _cache["reachable"]


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
