"""Persist generated/uploaded images to disk + DB, with thumbnails."""

from __future__ import annotations

import io
import uuid
from typing import Any

from PIL import Image as PILImage
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Image

THUMB_MAX = 512


def _save_thumbnail(png_bytes: bytes, thumb_path) -> tuple[int, int]:
    img = PILImage.open(io.BytesIO(png_bytes)).convert("RGB")
    w, h = img.size
    img.thumbnail((THUMB_MAX, THUMB_MAX), PILImage.LANCZOS)
    img.save(thumb_path, format="WEBP", quality=82)
    return w, h


def save_image_bytes(
    db: Session,
    png_bytes: bytes,
    *,
    kind: str = "generated",
    prompt: str | None = None,
    negative: str | None = None,
    model: str | None = None,
    loras: list[Any] | None = None,
    seed: int | None = None,
    params: dict[str, Any] | None = None,
    source_image_id: str | None = None,
) -> Image:
    settings = get_settings()
    settings.ensure_dirs()

    image_id = uuid.uuid4().hex
    filename = f"{image_id}.png"
    file_path = settings.images_path / filename
    file_path.write_bytes(png_bytes)

    thumb_name = f"{image_id}.webp"
    thumb_path = settings.thumbnails_path / thumb_name
    width, height = _save_thumbnail(png_bytes, thumb_path)

    image = Image(
        id=image_id,
        filename=filename,
        path=str(file_path),
        thumb_path=str(thumb_path),
        kind=kind,
        prompt=prompt,
        negative=negative,
        model=model,
        loras=loras or [],
        seed=seed,
        width=width,
        height=height,
        params=params or {},
        source_image_id=source_image_id,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


def delete_image_files(image: Image) -> None:
    for p in (image.path, image.thumb_path):
        if not p:
            continue
        try:
            from pathlib import Path

            Path(p).unlink(missing_ok=True)
        except OSError:
            pass
