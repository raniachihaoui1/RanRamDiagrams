"""Generation endpoints: submit a job, poll it, and stream progress over WS."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import GenerationJob, Image
from app.schemas import GenerateRequest, JobOut
from app.services.jobs import job_manager
from comfy.base import GenParams

router = APIRouter(tags=["generate"])


@router.post("/api/generate", response_model=JobOut)
async def submit_generation(req: GenerateRequest, db: Session = Depends(get_db)) -> JobOut:
    reference_path = None
    if req.mode == "img2img":
        if not req.reference_image_id:
            raise HTTPException(400, "img2img requires reference_image_id")
        ref = db.get(Image, req.reference_image_id)
        if not ref:
            raise HTTPException(404, "reference image not found")
        reference_path = ref.path

    job = GenerationJob(status="queued", params=req.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)

    params = GenParams(
        mode=req.mode,
        prompt=req.prompt,
        negative=req.negative,
        model=req.model,
        loras=req.loras,
        width=req.width,
        height=req.height,
        count=req.count,
        seed=req.seed,
        reference_image_path=reference_path,
        reference_image_id=req.reference_image_id,
        reference_weight=req.reference_weight,
    )
    job_manager.start(job.id, params)

    return JobOut(id=job.id, status="queued", progress=0.0)


@router.get("/api/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)) -> JobOut:
    state = job_manager.get_state(job_id)
    if state:
        return JobOut(
            id=job_id,
            status=state.get("status", "running"),
            progress=state.get("progress", 0.0),
            result_image_ids=state.get("result_image_ids", []),
            error=state.get("error"),
        )
    job = db.get(GenerationJob, job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return JobOut(
        id=job.id, status=job.status, progress=job.progress,
        result_image_ids=job.result_image_ids or [], error=job.error,
    )


@router.websocket("/ws/jobs/{job_id}")
async def job_ws(websocket: WebSocket, job_id: str) -> None:
    await websocket.accept()
    q = job_manager.subscribe(job_id)
    try:
        # Send current snapshot immediately
        state = job_manager.get_state(job_id)
        if state:
            await websocket.send_json({"type": "snapshot", **state})
            if state.get("status") in ("done", "error"):
                return

        while True:
            event = await q.get()
            await websocket.send_json(event)
            if event.get("type") in ("done", "error"):
                break
    except WebSocketDisconnect:
        pass
    finally:
        job_manager.unsubscribe(job_id, q)
