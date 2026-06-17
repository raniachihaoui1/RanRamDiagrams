"""Model -> schema serialization helpers."""

from __future__ import annotations

from app.models import Image
from app.schemas import ImageOut


def image_to_out(image: Image) -> ImageOut:
    return ImageOut(
        id=image.id,
        filename=image.filename,
        kind=image.kind,
        prompt=image.prompt,
        negative=image.negative,
        model=image.model,
        loras=image.loras or [],
        seed=image.seed,
        width=image.width,
        height=image.height,
        favorite=image.favorite,
        tags=image.tags or [],
        source_image_id=image.source_image_id,
        created_at=image.created_at,
        url=f"/api/images/{image.id}/file",
        thumb_url=f"/api/images/{image.id}/thumb",
    )
