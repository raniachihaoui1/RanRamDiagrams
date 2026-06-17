# UI App — AI Creative Suite

A Krea-style, local-first web app that turns Rhino views and prompts into
BIG-style architectural diagrams using ComfyUI workflows (Flux 2.0) and your own
LoRAs. Generate, transform (image-to-image), compose on a canvas, and browse a
results library — with a Rhino viewport bridge.

> Runs fully **mock** out of the box (no GPU/ComfyUI needed) so you can use the
> whole UI immediately. Flip to a real ComfyUI when ready.

## Stack

- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind v4) — `frontend/`
- **Backend**: Python FastAPI + SQLite — `backend/`
- **Engine**: ComfyUI adapter (`backend/comfy/`) — mock now, real later
- Generated images & canvas projects live in `storage/`; drop models in `models/`.

## Quick start (Windows / PowerShell)



```powershell
cd "UI App"

# 1. Backend deps (creates an isolated Python env)
python -m venv backend/.venv
backend/.venv/Scripts/pip install -r backend/requirements.txt
backend/.venv/Scripts/Activate.ps1

# 2. Frontend deps
cd frontend; npm install; cd ..

# 3. Env
Copy-Item .env.example .env

# 4. Run both (backend :8000 + frontend :3000)
./dev.ps1
```

Then open http://localhost:3000 (or :3001 if 3000 is taken).

> If port 3000 is already in use, Next.js falls back to **:3001** (it prints the
> actual URL in the dev log). The backend always uses :8000.

> **macOS / Linux:** the venv binaries are under `backend/.venv/bin/` instead of
> `backend/.venv/Scripts/`, and there is no `dev.ps1` — run the backend and
> frontend in two terminals (see [Run servers individually](#run-servers-individually)).

### Run servers individually

```powershell
# Backend (from backend/)
renv/Scripts/python -m uvicorn app.main:app --reload --port 8000

# Frontend (from UI App/frontend/)
npm run dev
```

## Going from mock → real ComfyUI

1. Install & start ComfyUI; note its URL (default `http://127.0.0.1:8188`).
2. Export your Flux 2.0 workflows in **API format** into `workflows/`
   (`flux_txt2img.json`, `flux_img2img.json`) — see `workflows/README.md`.
3. Map node ids in `backend/comfy/real.py` (`_inject_params`).
4. In `.env` set `COMFY_MODE=real` and `COMFY_URL=...`, then restart the backend.

No frontend changes are needed — the adapter interface is identical.

## Models (plug-and-ready)

Drop files into `models/{checkpoints,loras,vae,clip,controlnet,upscale}/`. They’re
scanned and shown in the generator's Model/LoRA chips. See `models/README.md`.

## Rhino viewport bridge

Open the generator → **Rhino viewport**. To stream live frames, run
`rhino/viewport_stream.py` inside Rhino (see `rhino/PROTOCOL.md`). Capture a frame
straight into image-to-image.

## Deploy

`docker compose up --build` builds the backend (uvicorn) and frontend (Next.js
standalone). `storage/` and `models/` are mounted as volumes.

## Project structure

```
UI App/
├─ frontend/   Next.js app (pages under app/, components/, lib/, store/)
├─ backend/    FastAPI app (app/, comfy/ adapter)
├─ models/     plug-and-ready model folders
├─ storage/    generated images, thumbnails, uploads, canvas projects, app.db
├─ workflows/  ComfyUI API-format workflows (for real mode)
└─ rhino/      viewport bridge script + protocol
```

See `CLAUDE.md` for architecture details.
