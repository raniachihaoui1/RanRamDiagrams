"""Select the ComfyUI client based on configuration."""

from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from comfy.base import ComfyClient


@lru_cache
def get_comfy_client() -> ComfyClient:
    settings = get_settings()
    if settings.comfy_mode == "real":
        from comfy.real import RealComfyClient

        return RealComfyClient()
    from comfy.mock import MockComfyClient

    return MockComfyClient()
