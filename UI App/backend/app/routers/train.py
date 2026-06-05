"""LoRA training — scaffold.

Records training runs and their config. Actually launching a run wires into the
parent repo's x-flux pipeline (scripts/) and needs a GPU; that orchestration is
intentionally deferred. For now this lets the UI create/list runs.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TrainingJob
from app.schemas import TrainCreate, TrainOut

router = APIRouter(tags=["train"])


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
