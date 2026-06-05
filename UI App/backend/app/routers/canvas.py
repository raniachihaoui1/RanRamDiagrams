"""Canvas projects: save/load the mini-photoshop work."""

from __future__ import annotations

import base64
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from PIL import Image as PILImage
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import CanvasProject
from app.schemas import CanvasCreate, CanvasOut, CanvasUpdate

router = APIRouter(tags=["canvas"])


def _to_out(p: CanvasProject) -> CanvasOut:
    return CanvasOut(
        id=p.id,
        name=p.name,
        data=p.data or {},
        thumb_url=f"/api/canvas/{p.id}/thumb" if p.thumb_path else None,
        updated_at=p.updated_at,
    )


def _save_thumb(canvas_id: str, data_url: str) -> str:
    settings = get_settings()
    settings.ensure_dirs()
    header, _, b64 = data_url.partition(",")
    raw = base64.b64decode(b64)
    img = PILImage.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail((512, 512), PILImage.LANCZOS)
    out = settings.thumbnails_path / f"canvas_{canvas_id}.webp"
    img.save(out, format="WEBP", quality=82)
    return str(out)


@router.post("/api/canvas", response_model=CanvasOut)
def create_canvas(body: CanvasCreate, db: Session = Depends(get_db)) -> CanvasOut:
    p = CanvasProject(name=body.name, data=body.data)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.get("/api/canvas", response_model=list[CanvasOut])
def list_canvas(db: Session = Depends(get_db)) -> list[CanvasOut]:
    stmt = select(CanvasProject).order_by(CanvasProject.updated_at.desc())
    return [_to_out(p) for p in db.scalars(stmt).all()]


def _get_or_404(db: Session, canvas_id: str) -> CanvasProject:
    p = db.get(CanvasProject, canvas_id)
    if not p:
        raise HTTPException(404, "canvas not found")
    return p


@router.get("/api/canvas/{canvas_id}", response_model=CanvasOut)
def get_canvas(canvas_id: str, db: Session = Depends(get_db)) -> CanvasOut:
    return _to_out(_get_or_404(db, canvas_id))


@router.put("/api/canvas/{canvas_id}", response_model=CanvasOut)
def update_canvas(
    canvas_id: str, body: CanvasUpdate, db: Session = Depends(get_db)
) -> CanvasOut:
    p = _get_or_404(db, canvas_id)
    if body.name is not None:
        p.name = body.name
    if body.data is not None:
        p.data = body.data
    if body.thumb_data_url:
        p.thumb_path = _save_thumb(canvas_id, body.thumb_data_url)
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.delete("/api/canvas/{canvas_id}", status_code=204)
def delete_canvas(canvas_id: str, db: Session = Depends(get_db)) -> None:
    p = _get_or_404(db, canvas_id)
    db.delete(p)
    db.commit()


@router.get("/api/canvas/{canvas_id}/thumb")
def canvas_thumb(canvas_id: str, db: Session = Depends(get_db)) -> FileResponse:
    p = _get_or_404(db, canvas_id)
    if not p.thumb_path:
        raise HTTPException(404, "no thumbnail")
    return FileResponse(p.thumb_path, media_type="image/webp")
