"""In-memory generation job manager: runs jobs, broadcasts progress over a
pub/sub so the WebSocket endpoint can stream updates to the client.

Live state lives in memory (authoritative for progress); the GenerationJob row
is persisted at creation and completion for history.
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.db import session_scope
from app.models import GenerationJob
from app.serializers import image_to_out
from app.services.storage import save_image_bytes
from comfy.base import GenParams
from comfy.factory import get_comfy_client


class JobManager:
    def __init__(self) -> None:
        self._states: dict[str, dict[str, Any]] = {}
        self._subs: dict[str, set[asyncio.Queue]] = {}
        self._tasks: set[asyncio.Task] = set()

    # ---- pub/sub -------------------------------------------------------
    def subscribe(self, job_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subs.setdefault(job_id, set()).add(q)
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue) -> None:
        if job_id in self._subs:
            self._subs[job_id].discard(q)
            if not self._subs[job_id]:
                self._subs.pop(job_id, None)

    async def _publish(self, job_id: str, event: dict[str, Any]) -> None:
        # Merge progress/status into live state snapshot
        snap = self._states.setdefault(job_id, {})
        for k in ("status", "progress", "result_image_ids", "error"):
            if k in event:
                snap[k] = event[k]
        for q in list(self._subs.get(job_id, ())):
            await q.put(event)

    def get_state(self, job_id: str) -> dict[str, Any] | None:
        return self._states.get(job_id)

    # ---- job lifecycle -------------------------------------------------
    def start(self, job_id: str, params: GenParams) -> None:
        self._states[job_id] = {"status": "queued", "progress": 0.0,
                                "result_image_ids": [], "error": None}
        task = asyncio.create_task(self._run(job_id, params))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _run(self, job_id: str, params: GenParams) -> None:
        client = get_comfy_client()

        async def on_progress(progress: float, status: str) -> None:
            await self._publish(job_id, {"type": "progress", "status": status,
                                         "progress": round(progress, 4)})

        try:
            await self._publish(job_id, {"type": "progress", "status": "running",
                                         "progress": 0.0})
            images = await client.generate(params, on_progress)

            # Persist images (sync DB + PIL) off the event loop
            outs = await asyncio.to_thread(self._persist, job_id, params, images)

            await self._publish(job_id, {
                "type": "done",
                "status": "done",
                "progress": 1.0,
                "result_image_ids": [o["id"] for o in outs],
                "images": outs,
            })
        except Exception as exc:  # noqa: BLE001
            await self._publish(job_id, {"type": "error", "status": "error",
                                         "error": str(exc)})
            with session_scope() as db:
                job = db.get(GenerationJob, job_id)
                if job:
                    job.status = "error"
                    job.error = str(exc)

    def _persist(self, job_id: str, params: GenParams, images: list[bytes]) -> list[dict]:
        outs: list[dict] = []
        with session_scope() as db:
            for png in images:
                image = save_image_bytes(
                    db, png,
                    kind="edited" if params.mode == "img2img" else "generated",
                    prompt=params.prompt,
                    negative=params.negative,
                    model=params.model,
                    loras=params.loras,
                    seed=params.seed,
                    params={"mode": params.mode, "width": params.width,
                            "height": params.height,
                            "reference_weight": params.reference_weight},
                    source_image_id=params.reference_image_id,
                )
                outs.append(image_to_out(image).model_dump(mode="json"))
            job = db.get(GenerationJob, job_id)
            if job:
                job.status = "done"
                job.progress = 1.0
                job.result_image_ids = [o["id"] for o in outs]
        return outs


job_manager = JobManager()
