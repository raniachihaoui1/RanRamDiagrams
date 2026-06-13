"""Available checkpoints and LoRAs (from ComfyUI in real mode, placeholders in mock)."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas import ModelInfo
from app.services.catalog import list_checkpoints, list_loras

router = APIRouter(tags=["catalog"])


@router.get("/api/models", response_model=list[ModelInfo])
def get_models() -> list[ModelInfo]:
    return list_checkpoints()


@router.get("/api/loras", response_model=list[ModelInfo])
def get_loras() -> list[ModelInfo]:
    return list_loras()
