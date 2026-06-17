"""Health & info endpoints."""

from __future__ import annotations

from fastapi import APIRouter

import httpx

from app.config import get_settings

router = APIRouter(tags=["health"])


def _resolved_mode(settings) -> str:
    if settings.comfy_mode != "auto":
        return settings.comfy_mode
    try:
        httpx.get(f"{settings.comfy_url.rstrip('/')}/system_stats", timeout=2).raise_for_status()
        return "real"
    except Exception:
        return "mock"


@router.get("/api/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "app_name": settings.app_name,
        "comfy_mode": settings.comfy_mode,
        "comfy_mode_resolved": _resolved_mode(settings),
        "comfy_url": settings.comfy_url,
    }
