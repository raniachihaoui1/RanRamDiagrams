# CLAUDE.md — UI App

This file provides guidance to Claude Code when working inside `UI App/`.

## What this is

A Krea-AI-style creative suite (web app) that orchestrates **ComfyUI workflows (Flux 2.0)** and the **custom LoRAs** trained by the parent repo's `scripts/` pipeline. Use cases: generate images, image-to-image, a canvas "mini-photoshop" for architectural diagrams, a results library (plus a "cute library" disc view), a Train-LoRA tool, and a (prepared) live Rhino viewport bridge.

Design language: **90% Krea**, Apple-like — dark base, rounded corners, glassmorphism, soft shadows, minimalist icons. Color is **neutral monochrome** (the chrome stays grey/white/black; color comes from generated content). Reference screenshots live in `assets/` (welcome, dashboard, viewport, canvas, library, cute_library).

## Stack & layout

- `frontend/` — Next.js 16 (App Router), React 19, TypeScript, **Tailwind v4** (CSS `@theme` tokens in `app/globals.css`), Zustand (state), TanStack Query (data), `motion` (animation), lucide-react (icons).
- `backend/` — Python FastAPI + Uvicorn + SQLAlchemy (SQLite). The only component that touches ComfyUI, the filesystem, and models.
- `comfy/` (under backend) — ComfyUI adapter: `base.py` (ABC), `mock.py` (simulated results, default), `real.py` (live FLUX.2 Klein img2img client), `factory.py`.
- **No `models/` folder** — the app does not host model files. In real mode the Model/LoRA chips are fetched live from ComfyUI (`/object_info`); in mock mode they're placeholders. Models live in each user's own ComfyUI install.
- `storage/` — generated content (git-ignored): `images/ thumbnails/ uploads/ canvas_projects/` + `app.db`.
- `workflows/` — exported ComfyUI workflows (API format) to wire when going real.
- `rhino/` — `viewport_stream.py` stub + `PROTOCOL.md` for the future live-viewport bridge.

## Commands

```powershell
# First-time setup
python -m venv backend/.venv
backend/.venv/Scripts/pip install -r backend/requirements.txt
cd frontend; npm install; cd ..
Copy-Item .env.example .env

# Run both servers (backend :8000 + frontend :3000)
./dev.ps1

# Individually
backend/.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000   # run from backend/
cd frontend; npm run dev            # frontend
cd frontend; npm run build          # production build (typechecks too)
```

## Frontend routes

- `app/page.tsx` — Welcome/landing at `/` (marketing, no sidebar). Uses only the root layout.
- `app/(app)/layout.tsx` — app shell (Sidebar + scrollable main) wrapping the tool routes: `/dashboard`, `/generate`, `/canvas`, `/train`, `/library`. The `(app)` route group adds no URL segment.
- `app/providers.tsx` — TanStack Query provider, mounted in the root layout.
- Data access goes through `lib/api.ts` (typed `api.*` client + `mediaUrl()` to absolutize backend image paths). Backend image URLs are relative; always wrap with `mediaUrl()`.

## Generator (Phase 3)

- State lives in `store/generator.ts` (Zustand): prompt-bar settings (prompt, model, loras[], aspect, count, seed, negative, mode, referenceImage, referenceWeight) + a `generations[]` feed. `submit()` posts `/api/generate`, prepends a running `Generation`, then opens a WS via `lib/ws.openJobSocket` and patches that generation as `progress`/`done`/`error` arrive. Pass `afterDone` to invalidate the `["images"]` query.
- **Custom size**: when a reference image is set, `aspect` switches to `"custom"` and `submit()` mirrors the input image's dimensions (rounded to multiples of 16 for FLUX). The Aspect pill shows "Personalizado" + the real pixel dimensions. Clearing the reference restores `"1:1"`.
- `components/generate/PromptBar.tsx` — the floating glass bar: chips (Model, LoRA grouped picker, Aspect, Reference upload→img2img, Count 1–4, Settings) using `components/ui/Popover` + `Slider`. img2img is the same page: uploading a reference switches `mode`, sets `aspect: "custom"`, and reveals the weight slider.
- `components/generate/LoraPicker.tsx` — LoRA selector that groups variants by family name (strips trailing epoch/version suffix, e.g. `BIG_style-000010` → family `BIG_style`, label `10`). Each family collapses to one row with a ◀ ▶ stepper to cycle variants; only one variant per family can be active at a time. Single-variant families render as plain rows.
- `components/generate/GenerationFeed.tsx` — renders the feed; running generations show N `GeneratingCard` placeholders that swap to results on done.
- `components/media/ImageModal.tsx` — shared lightbox (download/favorite/delete); reused by the Library.

## Library (Phase 4)

- `app/(app)/library/page.tsx` — fetches all images once (`["images", {limit:1000}]`) and filters client-side (All/Favorites/Generated/Edited/Uploaded, right rail). Two view modes via toggle: **Grid** (date-grouped via `lib/date.groupByDate`, uses `ImageGrid`) and **Cute** (`components/library/CuteLibrary`).
- `components/library/CuteLibrary.tsx` — the experimental "discs on a shelf": a 3D CSS coverflow on the light `paper` background; arrow keys / wheel / side-click to navigate, center-click opens the modal.
- Favorite/delete from the modal invalidate `["images"]`, so the library and dashboard stay in sync.

## Canvas, Rhino, Train (Phase 5)

- **Canvas** (`app/(app)/canvas/page.tsx`): plain HTML5 `<canvas>` with vector-op replay (no Konva). State in `store/canvas.ts` — a document of `layers[]` (each with `ops[]`), tools (brush/eraser/rect/ellipse/line/arrow), color/size, undo. `CanvasStage` re-renders base image + visible layers each frame; eraser uses `destination-out`. `CanvasSidePanel` does base-image pick/upload, layers, and **Generate** (flattens canvas → uploads → img2img via the existing job flow) + **Save** (persists project + a flattened thumbnail). Coordinates are stored in document pixel space; pointer events are scaled from the displayed canvas rect.
- **Rhino** (`components/rhino/RhinoLiveView.tsx`): viewer of `/ws/rhino`; opened from a button in the generator header. "Use frame as reference" uploads the current frame and sets it as the img2img reference (`useGeneratorStore.getState().setReference`). The Rhino side: `rhino/viewport_stream.py` is a runnable **Rhino 8 (Python 3)** streamer — captures the active viewport's current display mode (shaded/rendered) at ~6 FPS as JPEG, auto-reconnects, Esc to stop; needs `websocket-client` installed once in Rhino's Python. `rhino/test_source.py` streams an animated test pattern (run with the backend venv — `websockets`+`pillow`, no extra deps) to verify the hub + web viewer **without Rhino**. Wire format + quick start in `rhino/PROTOCOL.md`. Bridge relay verified end-to-end (source→hub→viewer).
- **Train** (`app/(app)/train/page.tsx`): a config form that creates scaffold runs + lists them. Real GPU training is deferred to the repo's x-flux pipeline.

## Deploy & verification

- Frontend builds to **standalone** output (`next.config.ts` `output: "standalone"`); `frontend/Dockerfile` + `backend/Dockerfile` + `docker-compose.yml` cover deploy (`docker compose up --build`). `storage/` mounts as a volume.
- The full mock flow is verified end-to-end: generate → job WS → images persisted → library → file serving → CORS, and all six routes render. When debugging, note `next dev` falls back to **:3001** if :3000 is taken — check the dev log for the actual port.
- Real mode (COMFY_MODE=real) is wired end-to-end for both **txt2img** and **img2img**: `comfy/real.py` routes to `flux_txt2img.json` (no reference) or `flux_img2img.json` (with reference) and injects params via separate node maps (`_inject_txt2img` / `_inject_img2img`). `workflows/flux_txt2img.json` ships in the repo (FLUX.2 Klein, node root `678:*`). Verified with FLUX.2 Klein workflow.

## Architecture notes

- **Config is centralized** in `backend/app/config.py` (`Settings` via pydantic-settings, reads `.env`). All paths resolve relative to `UI App/` unless absolute. `get_settings()` is cached; `settings.ensure_dirs()` runs on startup (lifespan).
- **ComfyUI mock-first**: build and test the entire UI flow against `MockComfyClient`; switching to real ComfyUI is `COMFY_MODE=real` (the `flux_img2img.json` node map is already wired in `comfy/real.py`) — no UI changes. In real mode `services/catalog` fetches the Model/LoRA lists from ComfyUI's `/object_info`, and an explicit LoRA selection is required.
- **Frontend ↔ backend**: REST + WebSocket at `NEXT_PUBLIC_API_URL` (`lib/config.ts` derives `WS_URL`). Generation progress and the Rhino bridge use WebSockets.
- **Design tokens**: defined once in `app/globals.css` `@theme` (colors `base/surface/surface-2/elevated/border/foreground/muted/faint/accent`, radii, shadows). Use semantic Tailwind classes (`bg-surface`, `text-muted`, `rounded-xl`); use `.glass` / `.glass-strong` utilities for frosted panels. Compose classes with `cn()` from `lib/utils.ts`.
- **Next.js 16 gotchas**: dynamic `params`/`searchParams` are async (await them); Middleware is now `proxy.ts`; Turbopack is the default bundler; Server Components by default — add `"use client"` only where interactivity/browser APIs are needed.

## Backend API (implemented)

- `GET /api/health` — status + app name + comfy mode.
- `GET /api/models`, `GET /api/loras` — fetched from ComfyUI `/object_info` in real mode; placeholder entries in mock mode (no local files read).
- `POST /api/generate` — body = `GenerateRequest` (mode, prompt, negative, model, loras[], width, height, count ≤4, seed?, reference_image_id?, reference_weight). Returns `{id, status}`. **Must stay `async`** (it schedules an asyncio task).
- `GET /api/jobs/{id}` — live state (memory-first, DB fallback).
- `WS /ws/jobs/{id}` — streams `snapshot` → `progress`* → `done`(with full image payloads) | `error`.
- `GET /api/images` (filters: kind, favorite, limit, offset), `GET /api/images/{id}`, `PATCH` (favorite/tags), `DELETE`, `GET /api/images/{id}/file|thumb`.
- `POST /api/upload` — multipart reference image → stored as `kind=uploaded`.
- `POST/GET /api/canvas`, `GET/PUT/DELETE /api/canvas/{id}`, `GET /api/canvas/{id}/thumb` — canvas projects (data JSON + optional thumbnail from a PNG data URL).
- `POST/GET /api/train`, `GET /api/train/{id}` — training-run **scaffold** (records config; no GPU execution yet).
- `WS /ws/rhino?role=source|viewer` + `GET /api/rhino/status` — Rhino viewport relay hub (forwards frames source→viewers).

Generation flow: `routers/generate` → `services/jobs.JobManager` (in-memory pub/sub + asyncio task) → `comfy.factory.get_comfy_client()` → `services/storage.save_image_bytes` (PNG + WebP thumb + DB row). Image URLs are built in `app/serializers.image_to_out`.

**Real mode wiring (`comfy/real.py`)** — node map for `flux_img2img.json`:
- `437` prompt · `760:744` negative · `760:749` seed · `760:751/752` width/height · `760:743` batch_size · `760:759` LoRA (name + strengths)
- Reference image: uploaded via `POST /upload/image` → filename injected into `434` (LoadImage) + `554` (ImageResizeKJv2).
- **`reference_weight` is NOT wired** — the workflow uses `ReferenceLatent` (FLUX.2 conditioning), which has no continuous strength slider. The UI slider is cosmetic in real mode. To wire it properly, the workflow would need a `denoise`-based img2img node instead of ReferenceLatent.
- A LoRA selection is **required** in real mode — the workflow default points to a machine-specific path. Missing LoRA raises a ValueError that surfaces in the UI.

## Conventions

- UI primitives live in `components/ui/` (Button, GlassPanel, Chip, …); feature components under `components/<feature>/`.
- Keep the chrome monochrome; never introduce a brand accent color — active states use near-white (`accent`).
- App name is a config token (`APP_NAME` / `NEXT_PUBLIC_APP_NAME`), currently a placeholder.
- Commit + update this file after each meaningful phase/decision (per project workflow).
