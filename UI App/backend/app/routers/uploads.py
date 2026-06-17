"""Upload a reference image (used by img2img / canvas)."""

from __future__ import annotations

import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image as PILImage
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import ImageOut
from app.serializers import image_to_out
from app.services.storage import save_image_bytes

router = APIRouter(tags=["uploads"])


@router.post("/api/upload", response_model=ImageOut)
async def upload_image(
    file: UploadFile = File(...), db: Session = Depends(get_db)
) -> ImageOut:
    raw = await file.read()
    try:
        img = PILImage.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"invalid image: {exc}") from exc

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    saved = save_image_bytes(
        db, buf.getvalue(), kind="uploaded", prompt=None,
        params={"original_filename": file.filename},
    )
    return image_to_out(saved)
