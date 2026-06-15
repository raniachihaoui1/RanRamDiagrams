# r: websocket-client
"""Rhino viewport streamer — run INSIDE Rhino 8 (Python 3), not in the app's venv.

The `# r:` line above is a Rhino 8 ScriptEditor directive: the first time you Run
this file, Rhino installs `websocket-client` into its own Python automatically. Do
NOT `pip install` via subprocess — inside Rhino `sys.executable` is Rhino.exe, so
that just launches another Rhino instance ("file type not supported").

Captures the active Rhino viewport (the current display mode, as you see it —
shaded / rendered / etc.) and streams JPEG frames to the app's bridge at
`ws://127.0.0.1:8000/ws/rhino?role=source`. The web UI ("Rhino viewport" button
in the Image Generator) shows them live and can snapshot one into image-to-image.

How to run (Rhino 8):
  1. Start the app backend (uvicorn on :8000) — see UI App/CLAUDE.md.
  2. In Rhino 8: Tools ▸ Script ▸ Edit (ScriptEditor), choose Python 3.
  3. Open this file in the ScriptEditor and Run. The `# r: websocket-client`
     directive installs the dependency on first run (no manual pip needed).
     A frame stream starts; open the app's "Rhino viewport" panel to see it.
     Stop with the ScriptEditor's Stop button (or Esc inside the editor).

Config: edit the CONFIG block below (URL / FPS / size / JPEG quality), or set the
RHINO_BRIDGE_URL / RHINO_BRIDGE_FPS env vars before running.

This is defensive: it no-ops cleanly when run outside Rhino, and auto-reconnects
if the bridge isn't up yet or drops. See PROTOCOL.md for the wire format.
"""

from __future__ import annotations

import base64
import json
import os
import time

# ── CONFIG ────────────────────────────────────────────────────────────────────
WS_URL = os.environ.get("RHINO_BRIDGE_URL", "ws://127.0.0.1:8000/ws/rhino?role=source")
FPS = float(os.environ.get("RHINO_BRIDGE_FPS", "6"))
WIDTH, HEIGHT = 960, 540
JPEG_QUALITY = 70          # 1–100; lower = smaller frames, less bandwidth
RECONNECT_DELAY = 2.0      # seconds to wait between reconnect attempts
# ───────────────────────────────────────────────────────────────────────────────


def _inside_rhino() -> bool:
    try:
        import scriptcontext  # type: ignore  # noqa: F401
        import Rhino  # type: ignore  # noqa: F401

        return True
    except Exception:
        return False


def _jpeg_encoder():
    """Return (ImageCodecInfo, EncoderParameters) to save JPEG at JPEG_QUALITY."""
    import System  # type: ignore
    from System.Drawing.Imaging import (  # type: ignore
        Encoder,
        EncoderParameter,
        EncoderParameters,
        ImageCodecInfo,
    )

    codec = next(
        (c for c in ImageCodecInfo.GetImageEncoders() if c.MimeType == "image/jpeg"),
        None,
    )
    params = EncoderParameters(1)
    params.Param[0] = EncoderParameter(Encoder.Quality, System.Int64(JPEG_QUALITY))
    return codec, params


def _capture_jpeg_b64(codec, params) -> str | None:
    """Capture the active viewport (current display mode) to a base64 JPEG."""
    import scriptcontext as sc  # type: ignore
    import System  # type: ignore

    view = sc.doc.Views.ActiveView
    if view is None:
        return None

    # CaptureToBitmap honors the viewport's current display mode (shaded/rendered).
    bitmap = view.CaptureToBitmap(System.Drawing.Size(WIDTH, HEIGHT))
    try:
        stream = System.IO.MemoryStream()
        if codec is not None:
            bitmap.Save(stream, codec, params)
        else:  # fallback: default JPEG encoder
            bitmap.Save(stream, System.Drawing.Imaging.ImageFormat.Jpeg)
        return base64.b64encode(bytes(stream.ToArray())).decode("ascii")
    finally:
        bitmap.Dispose()


def _pump_wait(seconds: float) -> None:
    """Sleep `seconds` while keeping Rhino's UI responsive.

    The script runs on Rhino's main (UI) thread, so a plain time.sleep() freezes
    the window. Rhino.RhinoApp.Wait() pumps the message queue; we call it in small
    slices so Rhino stays interactive (orbit, the ScriptEditor Stop button, etc.)
    between captured frames. Falls back to time.sleep outside Rhino.
    """
    try:
        import Rhino  # type: ignore
    except Exception:
        time.sleep(seconds)
        return

    end = time.time() + seconds
    while time.time() < end:
        Rhino.RhinoApp.Wait()  # process pending Rhino/Windows messages
        time.sleep(0.01)


def _stream_once() -> None:
    """Connect and stream until the socket drops or the script is aborted.

    Stop it with the ScriptEditor's Stop button (or Esc), which raises
    KeyboardInterrupt — that propagates out of here and out of main() cleanly.
    Socket errors are caught so main() can reconnect.
    """
    import websocket  # type: ignore  # installed via the `# r:` directive

    try:
        ws = websocket.create_connection(WS_URL, timeout=5)
    except Exception as exc:  # bridge not up yet, etc.
        print(f"[viewport_stream] Can't reach bridge ({exc}); retrying…")
        return

    print(f"[viewport_stream] Connected to {WS_URL} — streaming at {FPS} FPS.")
    codec, params = _jpeg_encoder()
    interval = 1.0 / FPS if FPS > 0 else 0.16
    try:
        while True:
            b64 = _capture_jpeg_b64(codec, params)
            if b64 is None:
                _pump_wait(interval)
                continue
            ws.send(
                json.dumps(
                    {
                        "type": "frame",
                        "format": "jpeg",
                        "data": b64,
                        "w": WIDTH,
                        "h": HEIGHT,
                        "ts": time.time(),
                    }
                )
            )
            _pump_wait(interval)
    except Exception as exc:  # noqa: BLE001 — socket dropped, etc. (NOT abort)
        print(f"[viewport_stream] Stream ended ({exc}); reconnecting…")
    finally:
        try:
            ws.close()
        except Exception:
            pass


def main() -> None:
    if not _inside_rhino():
        print(
            "[viewport_stream] Not running inside Rhino — nothing to capture.\n"
            "Open this file in Rhino 8's ScriptEditor (Python 3) and Run it.\n"
            "To test the bridge WITHOUT Rhino, run rhino/test_source.py instead."
        )
        return

    try:
        import websocket  # type: ignore  # noqa: F401
    except Exception:
        print(
            "[viewport_stream] Missing 'websocket-client' in Rhino's Python.\n"
            "It should auto-install from the `# r: websocket-client` line at the top\n"
            "on first Run. If it didn't, use the ScriptEditor's package panel to add\n"
            "'websocket-client'. Do NOT pip-install via subprocess inside Rhino."
        )
        return

    print("[viewport_stream] Starting. Stop with the ScriptEditor Stop button (or Esc).")
    try:
        while True:
            _stream_once()
            _pump_wait(RECONNECT_DELAY)
    except KeyboardInterrupt:
        print("[viewport_stream] Stopped.")


if __name__ == "__main__":
    main()
