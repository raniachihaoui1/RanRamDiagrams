"""Rhino viewport streamer (STUB — run inside Rhino, not in the app's venv).

Captures the active Rhino viewport and streams JPEG frames to the app's bridge
(`ws://127.0.0.1:8000/ws/rhino?role=source`). The app shows them in the Rhino
panel and can snapshot one into image-to-image.

How to run:
  - Rhino 8: open the ScriptEditor (Python 3), `pip install websocket-client`
    via the Rhino package manager, then run this file. (Rhino 7 IronPython works
    too with a compatible websocket client.)
  - Adjust WS_URL / FPS / SIZE below.

This is a starting point — see PROTOCOL.md. It is intentionally defensive so it
no-ops cleanly outside Rhino.
"""

from __future__ import annotations

import base64
import json
import time

WS_URL = "ws://127.0.0.1:8000/ws/rhino?role=source"
FPS = 6
WIDTH, HEIGHT = 960, 540


def _capture_jpeg_b64() -> str | None:
    """Capture the active viewport to a base64 JPEG using RhinoCommon (.NET)."""
    try:
        import scriptcontext as sc  # type: ignore
        import System  # type: ignore
    except Exception:
        print("[viewport_stream] Not running inside Rhino — nothing to capture.")
        return None

    view = sc.doc.Views.ActiveView
    if view is None:
        return None
    bitmap = view.CaptureToBitmap(System.Drawing.Size(WIDTH, HEIGHT))
    stream = System.IO.MemoryStream()
    bitmap.Save(stream, System.Drawing.Imaging.ImageFormat.Jpeg)
    return base64.b64encode(bytes(stream.ToArray())).decode("ascii")


def main() -> None:
    try:
        import websocket  # type: ignore  # `pip install websocket-client`
    except Exception:
        print("[viewport_stream] Install 'websocket-client' in Rhino's Python first.")
        return

    ws = websocket.create_connection(WS_URL)
    print(f"[viewport_stream] Connected to {WS_URL}")
    interval = 1.0 / FPS
    try:
        while True:
            b64 = _capture_jpeg_b64()
            if b64 is None:
                break
            ws.send(json.dumps({
                "type": "frame", "format": "jpeg",
                "data": b64, "w": WIDTH, "h": HEIGHT, "ts": time.time(),
            }))
            time.sleep(interval)
    finally:
        ws.close()


if __name__ == "__main__":
    main()
