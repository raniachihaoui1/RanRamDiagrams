"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.config import get_settings

_settings = get_settings()


class GenerateRequest(BaseModel):
    mode: Literal["txt2img", "img2img"] = "txt2img"
    prompt: str = ""
    negative: str = ""
    model: str | None = None
    loras: list[str] = Field(default_factory=list)
    width: int = 1024
    height: int = 1024
    count: int = Field(default=1, ge=1, le=_settings.max_images_per_request)
    seed: int | None = None
    reference_image_id: str | None = None
    reference_weight: float = Field(default=0.5, ge=0.0, le=1.0)


class ImageOut(BaseModel):
    id: str
    filename: str
    kind: str
    prompt: str | None = None
    negative: str | None = None
    model: str | None = None
    loras: list[Any] = []
    seed: int | None = None
    width: int
    height: int
    favorite: bool = False
    tags: list[Any] = []
    source_image_id: str | None = None
    created_at: datetime
    url: str
    thumb_url: str | None = None

    model_config = {"from_attributes": True}


class ImagePatch(BaseModel):
    favorite: bool | None = None
    tags: list[str] | None = None


class JobOut(BaseModel):
    id: str
    status: str
    progress: float
    result_image_ids: list[str] = []
    error: str | None = None


class ModelInfo(BaseModel):
    id: str
    name: str
    kind: str  # checkpoint|lora
    builtin: bool = False
    trigger_token: str | None = None
