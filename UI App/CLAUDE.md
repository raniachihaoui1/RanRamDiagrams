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
Copy-Item .env.example .env        # then edit .env — see "Environment" below

# Run both servers (backend :8000 + frontend :3000)
./dev.ps1

# Individually
backend/.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000   # run from backend/
cd frontend; npm run dev            # frontend
cd frontend; npm run build          # production build (typechecks too)
```

## Environment

`.env` is machine-specific and **never committed**. After `Copy-Item .env.example .env` edit at minimum:

```
COMFY_MODE=auto          # auto = real when ComfyUI is running, mock otherwise
COMFY_URL=http://127.0.0.1:8188
COMFY_DIR=<absolute path to your local ComfyUI install>
#   e.g. COMFY_DIR=F:/ComfyUI  or  C:/Users/yourname/ComfyUI
#   The backend auto-derives LORAS_DIR from COMFY_DIR/models/loras when LORAS_DIR is empty.
```

`COMFY_DIR` **must point to your own machine's ComfyUI folder** — never commit another machine's path. The backend uses it to discover local LoRAs and models. If you leave it pointing to a non-existent path, the LoRA/model dropdowns will be empty.

## Frontend routes

- `app/page.tsx` — Server redirect from `/` → `/dashboard` (landing page removed).
- `app/(app)/layout.tsx` — app shell (Sidebar + scrollable main) wrapping the tool routes: `/dashboard`, `/generate`, `/canvas`, `/train`, `/library`. The `(app)` route group adds no URL segment.
- `app/providers.tsx` — TanStack Query + `ThemeApplier` (applies `.dark` class on `<html>` from the theme store on mount).
- Data access goes through `lib/api.ts` (typed `api.*` client + `mediaUrl()` to absolutize backend image paths). Backend image URLs are relative; always wrap with `mediaUrl()`.
- **Theming** (`lib/theme.ts`): Zustand store (`theme: "light"|"dark"`, default `"light"`) with manual `localStorage` persistence (no zustand/persist — avoids SSR crash). `hydrateTheme()` is called on mount. CSS tokens live in `:root` (light) and `.dark` (dark) in `globals.css`; `@theme inline` maps them to Tailwind classes. Toggle (Sun/Moon) in the Sidebar footer.

## Generator (Phase 3)

- State lives in `store/generator.ts` (Zustand): prompt-bar settings (prompt, model, loras[], aspect, count, seed, negative, mode, referenceImage, referenceWeight) + a `generations[]` feed. `submit()` posts `/api/generate`, prepends a running `Generation`, then opens a WS via `lib/ws.openJobSocket` and patches that generation as `progress`/`done`/`error` arrive. Pass `afterDone` to invalidate the `["images"]` query.
- **Custom size**: when a reference image is set, `aspect` switches to `"custom"` and `submit()` mirrors the input image's dimensions (rounded to multiples of 16 for FLUX). The Aspect pill shows "Custom" + the real pixel dimensions. Clearing the reference restores `"1:1"`.
- `components/generate/PromptBar.tsx` — the floating glass bar: chips (Model, LoRA grouped picker, Aspect, Reference upload→img2img, Count 1–4, Settings) using `components/ui/Popover` + `Slider`. img2img is the same page: uploading a reference switches `mode`, sets `aspect: "custom"`, and reveals the weight slider.
- `components/generate/LoraPicker.tsx` — LoRA selector: groups variants by family, one row per family with ◀ ▶ stepper; **only one LoRA active at a time** (selecting any clears the previous). Single-variant families render as plain rows.
- **LoRA family registry** (`lib/loras.ts`): per-family config keyed by the family base name — `display` (chip label), `keyword` (hidden trigger token), `defaultStep` (pre-selected step), `hidden` (omit). Active families: `constructive` (technical_drawing, kw `technical_drawing`, step 1250), `conceptual` (ranram_arch_diagrams_v2.0, kw `ranram_arch_diagram`, step 1000), `linework` (ranram_arch_diagrams_v3.0, kw `technical_drawing`, step 1250). Hidden: `arctic_modern` (sub-trained), `big_ran_ram`, `optimizer`, `sdxl_lightning_8step_lora`. On selection `LoraPicker` writes `loraTriggers` (id→keyword); `submit()` prepends `keyword, ` to the ComfyUI prompt (never shown in the textarea or feed).
- **Generation cancellation**: `POST /api/jobs/{id}/cancel` cancels the asyncio task and tells ComfyUI to stop via `DELETE /queue` + `POST /interrupt`. The WS emits `{"type":"canceled"}`; the frontend shows a "Generation canceled" card. Cancel button (✕) appears next to the prompt while the job is running. `store/generator.ts` holds a `jobSockets` map to close the WS immediately on cancel.
- `components/generate/GenerationFeed.tsx` — renders the feed; running cards show progress + a Cancel button; done/error/canceled cards show the appropriate state.
- `components/media/ImageModal.tsx` — shared lightbox (download/favorite/delete); shows **LoRA** (display name, e.g. "conceptual") and **Steps** (step number) as separate metadata fields, derived from the saved LoRA id via `lib/loras.describeLora()`.

## Library (Phase 4)

- `app/(app)/library/page.tsx` — fetches all images once (`["images", {limit:1000}]`) and filters client-side (All/Favorites/Generated/Edited/Uploaded, right rail). Two view modes via toggle: **Grid** (date-grouped via `lib/date.groupByDate`, uses `ImageGrid`) and **Cute** (`components/library/CuteLibrary`).
- `components/library/CuteLibrary.tsx` — 3D CSS coverflow ("discs on a shelf") on the light `paper` background. Props: `images`, `onOpen`, `compact` (optional bool). **Full mode** (Library page): arrow keys / wheel / side-click to navigate, center-click opens the modal, shows caption + controls (zoom, arrows, counter). **Compact mode** (Dashboard widget): smaller discs (17rem), circular infinite wrap-around, auto-advances every 2.6 s, pauses on hover, no caption or controls visible — navigation via side-click, scroll and keyboard only.
- Favorite/delete from the modal invalidate `["images"]`, so the library and dashboard stay in sync.

## Canvas, Rhino, Train (Phase 5)

- **Canvas** (`app/(app)/canvas/page.tsx`): plain HTML5 `<canvas>` with vector-op replay (no Konva). State in `store/canvas.ts` — a document of `layers[]` (each with `ops[]`), tools (brush/eraser/rect/ellipse/line/arrow), color/size, undo. `CanvasStage` re-renders base image + visible layers each frame; eraser uses `destination-out`. `CanvasSidePanel` does base-image pick/upload, layers, and **Generate** (flattens canvas → uploads → img2img via the existing job flow) + **Save** (persists project + a flattened thumbnail). Coordinates are stored in document pixel space; pointer events are scaled from the displayed canvas rect.
- **Rhino** (`components/rhino/RhinoLiveView.tsx`): viewer of `/ws/rhino`; opened from a button in the generator header. "Use frame as reference" uploads the current frame and sets it as the img2img reference (`useGeneratorStore.getState().setReference`). The Rhino side: `rhino/viewport_stream.py` is a runnable **Rhino 8 (Python 3)** streamer — captures the active viewport's current display mode (shaded/rendered) at ~6 FPS as JPEG, auto-reconnects, Esc to stop; needs `websocket-client` installed once in Rhino's Python. `rhino/test_source.py` streams an animated test pattern (run with the backend venv — `websockets`+`pillow`, no extra deps) to verify the hub + web viewer **without Rhino**. Wire format + quick start in `rhino/PROTOCOL.md`. Bridge relay verified end-to-end (source→hub→viewer).
- **Train** (`app/(app)/train/page.tsx`): a config form that creates scaffold runs + lists them. Real GPU training is deferred to the repo's x-flux pipeline.

## Dashboard layout

`app/(app)/dashboard/page.tsx` is a **no-scroll, viewport-filling layout** (`h-dvh` flex-col). Three sections stacked vertically:

1. **Hero** (`flex-1`, `min-h-[240px]`) — gradient banner with headline, CTA buttons, and a `fill` image (`Homeimg.png`) that covers the full hero height without cropping. Uses `object-cover object-center`.
2. **Tools** (`shrink-0`) — 5 tool cards in a `grid-cols-5` row. Compact (no arrow button, reduced padding) so they don't consume vertical space.
3. **Recent** (`flex-1 min-h-0`) — CuteLibrary in `compact` mode inside a `min-h-0 flex-1` wrapper so it claims all remaining space without overflowing. Fetches up to 1 000 images so the carousel shows the full collection.

Hero and Recent share remaining space equally (both `flex-1`), resulting in near-identical heights (~300 px on a 900 px screen). Do not add fixed heights to these sections — let the flex layout adapt to the user's screen.

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
- App name is a config token (`APP_NAME` / `NEXT_PUBLIC_APP_NAME`), currently `RanRam Studio`.
- Commit + update this file after each meaningful phase/decision (per project workflow).

## Critical git rules

**Never commit the following** — they are git-ignored for a reason and must stay out of version control:

| Path | Why |
|---|---|
| `storage/` | Personal generated images, thumbnails, uploads, canvas projects and `app.db`. The DB stores **absolute paths** from the machine that created it — committing it breaks image serving on every other machine. |
| `backend/**/__pycache__/` | Python bytecodes tied to a specific Python version and machine. |
| `frontend/.next/` or `.next.bak/` | Next.js build artefacts. |
| `backend/.venv/` | The virtual environment. Each developer creates their own with `python -m venv backend/.venv`. |
| `.env` | Machine-specific config (ports, paths, API keys). Use `.env.example` as the template. |

**Never hardcode absolute paths** from your own machine (`C:/Users/yourname/…`) in source files or `.env.example`. Use the `COMFY_DIR` env var instead and let the backend derive paths from it.

The venv is always named **`.venv`** (not `renv` or `venv`). `dev.ps1` looks for `backend/.venv/Scripts/python.exe`; changing this name breaks the launcher for everyone.
