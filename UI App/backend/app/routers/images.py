"""Image library: list, detail, patch (favorite/tags), delete, and file serving."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Image
from app.schemas import ImageOut, ImagePatch
from app.serializers import image_to_out
from app.services.storage import delete_image_files

router = APIRouter(tags=["images"])


@router.get("/api/images", response_model=list[ImageOut])
def list_images(
    db: Session = Depends(get_db),
    kind: str | None = Query(None),
    favorite: bool | None = Query(None),
    limit: int = Query(200, le=1000),
    offset: int = Query(0, ge=0),
) -> list[ImageOut]:
    stmt = select(Image).order_by(Image.created_at.desc())
    if kind:
        stmt = stmt.where(Image.kind == kind)
    if favorite is not None:
        stmt = stmt.where(Image.favorite == favorite)
    stmt = stmt.offset(offset).limit(limit)
    return [image_to_out(img) for img in db.scalars(stmt).all()]


def _get_or_404(db: Session, image_id: str) -> Image:
    img = db.get(Image, image_id)
    if not img:
        raise HTTPException(404, "image not found")
    return img


@router.get("/api/images/{image_id}", response_model=ImageOut)
def get_image(image_id: str, db: Session = Depends(get_db)) -> ImageOut:
    return image_to_out(_get_or_404(db, image_id))


@router.patch("/api/images/{image_id}", response_model=ImageOut)
def patch_image(image_id: str, patch: ImagePatch, db: Session = Depends(get_db)) -> ImageOut:
    img = _get_or_404(db, image_id)
    if patch.favorite is not None:
        img.favorite = patch.favorite
    if patch.tags is not None:
        img.tags = patch.tags
    db.commit()
    db.refresh(img)
    return image_to_out(img)


@router.delete("/api/images/{image_id}", status_code=204)
def delete_image(image_id: str, db: Session = Depends(get_db)) -> None:
    img = _get_or_404(db, image_id)
    delete_image_files(img)
    db.delete(img)
    db.commit()


@router.get("/api/images/{image_id}/file")
def image_file(image_id: str, db: Session = Depends(get_db)) -> FileResponse:
    img = _get_or_404(db, image_id)
    return FileResponse(img.path, media_type="image/png")


@router.get("/api/images/{image_id}/thumb")
def image_thumb(image_id: str, db: Session = Depends(get_db)) -> FileResponse:
    img = _get_or_404(db, image_id)
    path = img.thumb_path or img.path
    media = "image/webp" if path.endswith(".webp") else "image/png"
    return FileResponse(path, media_type=media)
