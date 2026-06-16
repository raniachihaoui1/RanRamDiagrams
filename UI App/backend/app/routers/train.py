"""LoRA training — dataset management + training run scaffold.

Datasets go through: draft → captioned → prepared.
Training runs are recorded here; actual GPU execution is external (x-flux / kohya).
"""

from __future__ import annotations

import base64
import io
import json
import re
import time
from pathlib import Path
from typing import Any, Iterator

import anthropic
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from PIL import Image as PILImage
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import TrainingDataset, TrainingJob
from app.schemas import (
    CaptionPatch,
    CaptionRunRequest,
    DatasetCreate,
    DatasetImageInfo,
    DatasetOut,
    PrepareRequest,
    PrepareResult,
    TrainCreate,
    TrainOut,
)

router = APIRouter(tags=["train"])

SUPPORTED_EXT = {".jpg", ".jpeg", ".png", ".webp"}


# ── Internal helpers ─────────────────────────────────────────────────────────


def _images_dir(dataset_id: str) -> Path:
    return get_settings().training_datasets_path / dataset_id / "images"


def _encode_b64(path: Path) -> str:
    return base64.standard_b64encode(path.read_bytes()).decode()


def _media_type(path: Path) -> str:
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "image/png")


def _parse_json(text: str) -> Any:
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    return json.loads(cleaned)


def _list_images(dataset_id: str) -> list[Path]:
    d = _images_dir(dataset_id)
    if not d.exists():
        return []
    return sorted(p for p in d.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED_EXT)


def _dataset_to_out(ds: TrainingDataset) -> DatasetOut:
    images = _list_images(ds.id)
    captions: dict[str, str] = ds.captions or {}
    image_infos = [
        DatasetImageInfo(filename=p.name, caption=captions.get(p.name, ""))
        for p in images
    ]
    return DatasetOut(
        id=ds.id,
        name=ds.name,
        trigger_token=ds.trigger_token,
        description=ds.description,
        status=ds.status,
        image_count=len(images),
        captions=captions,
        images=image_infos,
        created_at=ds.created_at,
    )


# ── Dataset CRUD ─────────────────────────────────────────────────────────────


@router.post("/api/train/datasets", response_model=DatasetOut)
def create_dataset(body: DatasetCreate, db: Session = Depends(get_db)) -> DatasetOut:
    ds = TrainingDataset(
        name=body.name,
        trigger_token=body.trigger_token,
        description=body.description,
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    _images_dir(ds.id).mkdir(parents=True, exist_ok=True)
    return _dataset_to_out(ds)


@router.get("/api/train/datasets", response_model=list[DatasetOut])
def list_datasets(db: Session = Depends(get_db)) -> list[DatasetOut]:
    stmt = select(TrainingDataset).order_by(TrainingDataset.created_at.desc())
    return [_dataset_to_out(ds) for ds in db.scalars(stmt).all()]


@router.get("/api/train/datasets/{dataset_id}", response_model=DatasetOut)
def get_dataset(dataset_id: str, db: Session = Depends(get_db)) -> DatasetOut:
    ds = db.get(TrainingDataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return _dataset_to_out(ds)


@router.patch("/api/train/datasets/{dataset_id}", response_model=DatasetOut)
def update_dataset(dataset_id: str, body: DatasetCreate, db: Session = Depends(get_db)) -> DatasetOut:
    ds = db.get(TrainingDataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    ds.name = body.name
    ds.trigger_token = body.trigger_token
    ds.description = body.description
    db.commit()
    return _dataset_to_out(ds)


@router.delete("/api/train/datasets/{dataset_id}")
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)) -> dict:
    ds = db.get(TrainingDataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    import shutil
    d = get_settings().training_datasets_path / dataset_id
    if d.exists():
        shutil.rmtree(d)
    db.delete(ds)
    db.commit()
    return {"deleted": dataset_id}


# ── Image upload / serve / delete ────────────────────────────────────────────


@router.post("/api/train/datasets/{dataset_id}/images")
async def upload_images(
    dataset_id: str,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> dict:
    ds = db.get(TrainingDataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")

    images_dir = _images_dir(dataset_id)
    images_dir.mkdir(parents=True, exist_ok=True)
    saved: list[str] = []

    for file in files:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in SUPPORTED_EXT:
            continue
        raw = await file.read()
        try:
            img = PILImage.open(io.BytesIO(raw)).convert("RGB")
        except Exception:
            continue
        # Normalise filename to avoid collisions
        stem = Path(file.filename or f"image_{len(saved)}").stem
        out_name = f"{stem}.png"
        out_path = images_dir / out_name
        # Deduplicate
        counter = 1
        while out_path.exists():
            out_path = images_dir / f"{stem}_{counter}.png"
            counter += 1
        img.save(str(out_path), format="PNG")
        saved.append(out_path.name)

    ds.status = "draft"
    db.commit()
    return {"saved": saved, "total": len(_list_images(dataset_id))}


@router.get("/api/train/datasets/{dataset_id}/images/{filename}")
def serve_image(dataset_id: str, filename: str) -> FileResponse:
    path = _images_dir(dataset_id) / filename
    if not path.exists():
        raise HTTPException(404, "Image not found")
    return FileResponse(str(path))


@router.delete("/api/train/datasets/{dataset_id}/images/{filename}")
def delete_image(dataset_id: str, filename: str, db: Session = Depends(get_db)) -> dict:
    ds = db.get(TrainingDataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    path = _images_dir(dataset_id) / filename
    if path.exists():
        path.unlink(missing_ok=True)
    # Remove sidecar .txt if present
    (path.with_suffix(".txt")).unlink(missing_ok=True)
    captions: dict = dict(ds.captions or {})
    captions.pop(filename, None)
    ds.captions = captions
    db.commit()
    return {"deleted": filename}


# ── Caption management ────────────────────────────────────────────────────────


@router.patch("/api/train/datasets/{dataset_id}/captions/{filename}")
def patch_caption(
    dataset_id: str, filename: str, body: CaptionPatch, db: Session = Depends(get_db)
) -> dict:
    ds = db.get(TrainingDataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    captions: dict = dict(ds.captions or {})
    captions[filename] = body.caption
    ds.captions = captions
    db.commit()
    return {"filename": filename, "caption": body.caption}


# ── Captioning SSE stream ────────────────────────────────────────────────────
#
# Uses the same Claude vision + JSON pattern as scripts/01_caption_images.py
# but executed from the backend, with the API key supplied per-request.


def _build_prompts(trigger: str, description: str) -> tuple[str, str]:
    style_ctx = description.strip() or "an architectural diagram style"
    system = (
        f"You are an expert image analyst specialising in {style_ctx}. "
        "When given an image, return ONLY a single valid JSON object "
        "with no preamble, no markdown fences, and no trailing text."
    )
    user = (
        "Analyse this image and return a JSON object with exactly this key:\n"
        "{\n"
        f'  "training_caption": "<LoRA training caption — MUST start with \'{trigger}\' '
        "and then describe the visual style, color palette, key elements, "
        "composition, line quality, and any distinctive features in detail>"\n"
        "}\n\n"
        f"The caption MUST begin with the trigger token '{trigger}'."
    )
    return system, user


@router.post("/api/train/datasets/{dataset_id}/caption")
def caption_dataset(
    dataset_id: str,
    body: CaptionRunRequest,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    ds = db.get(TrainingDataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")

    images = _list_images(dataset_id)
    if not images:
        raise HTTPException(400, "No images in dataset")

    trigger = ds.trigger_token
    system_prompt, user_prompt = _build_prompts(trigger, ds.description)

    def stream() -> Iterator[str]:
        client = anthropic.Anthropic(api_key=body.api_key)
        total = len(images)
        captions: dict = dict(ds.captions or {})

        for i, img_path in enumerate(images):
            # Emit progress before processing
            yield f"data: {json.dumps({'type': 'progress', 'index': i, 'total': total, 'filename': img_path.name})}\n\n"

            try:
                b64 = _encode_b64(img_path)
                mt = _media_type(img_path)
                messages: list[dict] = [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {"type": "base64", "media_type": mt, "data": b64},
                            },
                            {"type": "text", "text": user_prompt},
                        ],
                    }
                ]

                caption = ""
                delay = 1.0
                last_exc: Exception | None = None
                for attempt in range(3):
                    try:
                        response = client.messages.create(
                            model=body.model,
                            max_tokens=512,
                            system=system_prompt,
                            messages=messages,
                        )
                        raw = response.content[0].text
                        result = _parse_json(raw)
                        caption = result.get("training_caption", "").strip()
                        if not caption.startswith(trigger):
                            caption = f"{trigger}, {caption}"
                        last_exc = None
                        break
                    except anthropic.RateLimitError as exc:
                        last_exc = exc
                        time.sleep(delay)
                        delay *= 2
                    except anthropic.APIStatusError as exc:
                        last_exc = exc
                        time.sleep(delay)
                        delay *= 2
                    except Exception as exc:
                        last_exc = exc
                        break

                if last_exc and not caption:
                    caption = f"{trigger}, [captioning failed: {last_exc}]"

                captions[img_path.name] = caption
                # Persist immediately so partial results survive interruption
                ds.captions = captions
                db.commit()

                yield f"data: {json.dumps({'type': 'captioned', 'index': i, 'filename': img_path.name, 'caption': caption})}\n\n"

            except Exception as exc:
                yield f"data: {json.dumps({'type': 'error', 'index': i, 'filename': img_path.name, 'error': str(exc)})}\n\n"

        ds.status = "captioned"
        db.commit()
        yield f"data: {json.dumps({'type': 'done', 'total': total})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Prepare dataset (validate + resize + write .txt sidecars) ─────────────────
#
# Mirrors scripts/05_prepare_dataset.py logic.


@router.post("/api/train/datasets/{dataset_id}/prepare", response_model=PrepareResult)
def prepare_dataset(
    dataset_id: str, body: PrepareRequest, db: Session = Depends(get_db)
) -> PrepareResult:
    ds = db.get(TrainingDataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")

    images = _list_images(dataset_id)
    captions: dict = ds.captions or {}
    trigger = ds.trigger_token

    missing_captions: list[str] = []
    bad_trigger: list[str] = []
    resized = 0
    res = body.resolution

    for img_path in images:
        # Caption validation
        cap = captions.get(img_path.name, "").strip()
        if not cap:
            missing_captions.append(img_path.name)
        elif not cap.startswith(trigger):
            bad_trigger.append(img_path.name)

        # Write .txt sidecar
        if cap:
            img_path.with_suffix(".txt").write_text(cap, encoding="utf-8")

        # Resize to square (white-padded)
        try:
            with PILImage.open(img_path) as img:
                img = img.convert("RGB")
                if img.width != res or img.height != res:
                    img.thumbnail((res, res), PILImage.LANCZOS)
                    canvas = PILImage.new("RGB", (res, res), (255, 255, 255))
                    canvas.paste(img, ((res - img.width) // 2, (res - img.height) // 2))
                    canvas.save(str(img_path), format="PNG")
                    resized += 1
        except Exception:
            pass  # individual failure doesn't abort the batch

    ready = not missing_captions and not bad_trigger
    if ready:
        ds.status = "prepared"
        db.commit()

    return PrepareResult(
        total=len(images),
        resized=resized,
        missing_captions=missing_captions,
        bad_trigger=bad_trigger,
        ready=ready,
    )


# ── Training runs ─────────────────────────────────────────────────────────────


@router.post("/api/train", response_model=TrainOut)
def create_training(body: TrainCreate, db: Session = Depends(get_db)) -> TrainOut:
    job = TrainingJob(status="scaffold", config={"name": body.name, **body.config})
    db.add(job)
    db.commit()
    db.refresh(job)
    return TrainOut.model_validate(job)


@router.get("/api/train", response_model=list[TrainOut])
def list_training(db: Session = Depends(get_db)) -> list[TrainOut]:
    stmt = select(TrainingJob).order_by(TrainingJob.created_at.desc())
    return [TrainOut.model_validate(j) for j in db.scalars(stmt).all()]


@router.get("/api/train/{job_id}", response_model=TrainOut)
def get_training(job_id: str, db: Session = Depends(get_db)) -> TrainOut:
    job = db.get(TrainingJob, job_id)
    if not job:
        raise HTTPException(404, "training job not found")
    return TrainOut.model_validate(job)
