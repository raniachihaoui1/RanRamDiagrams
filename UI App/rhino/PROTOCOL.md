# Rhino ↔ App viewport bridge — protocol

A minimal WebSocket relay lets you mirror Rhino's active viewport inside the app
(and snapshot it into image-to-image). The app side (backend hub + web viewer) is
live; you run the Rhino-side script when you want real frames.

## Quick start

1. **Start the backend** (uvicorn on :8000) and frontend — see `UI App/CLAUDE.md`.
2. **Verify the bridge without Rhino** (optional but recommended): run the test
   source with the backend venv, then open the app's **"Rhino viewport"** button
   in the Image Generator — you should see an animated test pattern:
   ```powershell
   # from UI App/
   backend/.venv/Scripts/python rhino/test_source.py     # Ctrl-C to stop
   ```
3. **Stream the real viewport** from Rhino 8: open `rhino/viewport_stream.py` in
   Rhino's ScriptEditor (Python 3) and Run it. First run installs the client:
   ```python
   import subprocess, sys
   subprocess.run([sys.executable, "-m", "pip", "install", "websocket-client"])
   ```
   Frames appear in the panel; click **"Use frame as reference"** to snapshot the
   current frame into image-to-image. Press **Esc** in Rhino to stop the stream.

## Endpoint

```
ws://<host>:8000/ws/rhino?role=source   # the Rhino script connects here
ws://<host>:8000/ws/rhino?role=viewer   # the web UI connects here
```

The backend (`backend/app/routers/rhino.py`) forwards every message from
`source` clients to all `viewer` clients verbatim. `GET /api/rhino/status`
returns the current `{sources, viewers}` counts.

## Frame message

Sources send **either**:

- **Text (JSON)** — easiest:
  ```json
  { "type": "frame", "format": "jpeg", "data": "<base64>", "w": 960, "h": 540, "ts": 1733370000.0 }
  ```
- **Binary** — raw JPEG/PNG bytes (lower overhead). The viewer treats a binary
  message as an image blob directly.

The viewer renders the latest frame. Recommended cadence: 5–10 FPS at ≤960px.

## Roadmap

The current relay covers a capture-and-stream MVP. Alternatives to evaluate
later (see plan): Speckle for 3D data, or Rhino.Compute / Rhino.Inside for
headless rendering. The app contract (`/ws/rhino`) stays the same.
