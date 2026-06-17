"""ORM models for the UI App backend."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Image(Base):
    __tablename__ = "images"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    filename: Mapped[str] = mapped_column(String)
    path: Mapped[str] = mapped_column(String)
    thumb_path: Mapped[str | None] = mapped_column(String, nullable=True)
    kind: Mapped[str] = mapped_column(String, default="generated")  # generated|edited|uploaded
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    negative: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    loras: Mapped[list[Any]] = mapped_column(JSON, default=list)
    seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width: Mapped[int] = mapped_column(Integer, default=1024)
    height: Mapped[int] = mapped_column(Integer, default=1024)
    params: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    source_image_id: Mapped[str | None] = mapped_column(
        ForeignKey("images.id", ondelete="SET NULL"), nullable=True
    )
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[list[Any]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, default="Untitled")
    tool: Mapped[str] = mapped_column(String, default="image")  # image|canvas
    state: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class CanvasProject(Base):
    __tablename__ = "canvas_projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, default="Untitled canvas")
    thumb_path: Mapped[str | None] = mapped_column(String, nullable=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    status: Mapped[str] = mapped_column(String, default="queued")  # queued|running|done|error
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    params: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    result_image_ids: Mapped[list[Any]] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Lora(Base):
    __tablename__ = "loras"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String)
    path: Mapped[str] = mapped_column(String)
    trigger_token: Mapped[str | None] = mapped_column(String, nullable=True)
    base_model: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    status: Mapped[str] = mapped_column(String, default="queued")
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    log_path: Mapped[str | None] = mapped_column(String, nullable=True)
    output_path: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class TrainingDataset(Base):
    """A named image dataset used for LoRA training."""

    __tablename__ = "training_datasets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, default="Untitled dataset")
    trigger_token: Mapped[str] = mapped_column(String, default="my_style")
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(
        String, default="draft"
    )  # draft | captioned | prepared
    captions: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict
    )  # {filename: caption_text}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )
