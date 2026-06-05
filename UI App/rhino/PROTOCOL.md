# Rhino ↔ App viewport bridge — protocol

A minimal WebSocket relay lets you mirror Rhino's active viewport inside the app
(and snapshot it into image-to-image). It is **prepare-only**: the app side works
now; you run the Rhino-side script when you want live frames.

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
