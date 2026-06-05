"""Rhino viewport bridge (prepare-only).

A tiny WebSocket hub: a Rhino-side script connects as a `source` and pushes
viewport frames; the web UI connects as a `viewer` and receives them. Frames are
forwarded verbatim (text or binary) — see ../rhino/PROTOCOL.md.

Nothing here requires Rhino to be running; viewers simply wait for frames.
"""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["rhino"])


class RhinoHub:
    def __init__(self) -> None:
        self.sources: set[WebSocket] = set()
        self.viewers: set[WebSocket] = set()

    async def broadcast_text(self, data: str) -> None:
        for ws in list(self.viewers):
            try:
                await ws.send_text(data)
            except Exception:  # noqa: BLE001
                self.viewers.discard(ws)

    async def broadcast_bytes(self, data: bytes) -> None:
        for ws in list(self.viewers):
            try:
                await ws.send_bytes(data)
            except Exception:  # noqa: BLE001
                self.viewers.discard(ws)


hub = RhinoHub()


@router.get("/api/rhino/status")
def rhino_status() -> dict:
    return {"sources": len(hub.sources), "viewers": len(hub.viewers)}


@router.websocket("/ws/rhino")
async def rhino_ws(websocket: WebSocket, role: str = "viewer") -> None:
    await websocket.accept()
    is_source = role == "source"
    (hub.sources if is_source else hub.viewers).add(websocket)
    try:
        while True:
            msg = await websocket.receive()
            if not is_source:
                # viewers may send pings; ignore
                continue
            if (text := msg.get("text")) is not None:
                await hub.broadcast_text(text)
            elif (data := msg.get("bytes")) is not None:
                await hub.broadcast_bytes(data)
    except WebSocketDisconnect:
        pass
    finally:
        (hub.sources if is_source else hub.viewers).discard(websocket)
