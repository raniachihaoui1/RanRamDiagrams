"""Health & info endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings
from comfy.factory import _comfy_reachable

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health() -> dict:
    settings = get_settings()
    if settings.comfy_mode == "auto":
        resolved = "real" if _comfy_reachable(settings.comfy_url) else "mock"
    else:
        resolved = settings.comfy_mode
    return {
        "status": "ok",
        "app_name": settings.app_name,
        "comfy_mode": settings.comfy_mode,
        "comfy_mode_resolved": resolved,
        "comfy_url": settings.comfy_url,
    }
