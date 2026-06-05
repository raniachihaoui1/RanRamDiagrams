# CLAUDE.md — UI App

This file provides guidance to Claude Code when working inside `UI App/`.

## What this is

A Krea-AI-style creative suite (web app) that orchestrates **ComfyUI workflows (Flux 2.0)** and the **custom LoRAs** trained by the parent repo's `scripts/` pipeline. Use cases: generate images, image-to-image, a canvas "mini-photoshop" for architectural diagrams, a results library (plus a "cute library" disc view), a Train-LoRA tool, and a (prepared) live Rhino viewport bridge.

Design language: **90% Krea**, Apple-like — dark base, rounded corners, glassmorphism, soft shadows, minimalist icons. Color is **neutral monochrome** (the chrome stays grey/white/black; color comes from generated content). Reference screenshots live in `assets/` (welcome, dashboard, viewport, canvas, library, cute_library).

## Stack & layout

- `frontend/` — Next.js 16 (App Router), React 19, TypeScript, **Tailwind v4** (CSS `@theme` tokens in `app/globals.css`), Zustand (state), TanStack Query (data), `motion` (animation), lucide-react (icons).
- `backend/` — Python FastAPI + Uvicorn + SQLAlchemy (SQLite). The only component that touches ComfyUI, the filesystem, and models.
- `comfy/` (under backend) — ComfyUI adapter: `base.py` (ABC), `mock.py` (simulated results, default), `real.py` (live instance), `workflows/` (API-format templates + node maps).
- `models/` — plug-and-ready model folders (checkpoints/ loras/ vae/ clip/ controlnet/ upscale/). Git-ignored except READMEs. Mirrors ComfyUI's layout.
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

## Architecture notes

- **Config is centralized** in `backend/app/config.py` (`Settings` via pydantic-settings, reads `.env`). All paths resolve relative to `UI App/` unless absolute. `get_settings()` is cached; `settings.ensure_dirs()` runs on startup (lifespan).
- **ComfyUI mock-first**: build and test the entire UI flow against `MockComfyClient`; switching to real ComfyUI is `COMFY_MODE=real` + mapping workflow node ids in `comfy/workflows/` — no UI changes.
- **Frontend ↔ backend**: REST + WebSocket at `NEXT_PUBLIC_API_URL` (`lib/config.ts` derives `WS_URL`). Generation progress and the Rhino bridge use WebSockets.
- **Design tokens**: defined once in `app/globals.css` `@theme` (colors `base/surface/surface-2/elevated/border/foreground/muted/faint/accent`, radii, shadows). Use semantic Tailwind classes (`bg-surface`, `text-muted`, `rounded-xl`); use `.glass` / `.glass-strong` utilities for frosted panels. Compose classes with `cn()` from `lib/utils.ts`.
- **Next.js 16 gotchas**: dynamic `params`/`searchParams` are async (await them); Middleware is now `proxy.ts`; Turbopack is the default bundler; Server Components by default — add `"use client"` only where interactivity/browser APIs are needed.

## Backend API (implemented)

- `GET /api/health` — status + app name + comfy mode.
- `GET /api/models`, `GET /api/loras` — scanned `models/` + built-in defaults (so chips are never empty in mock mode).
- `POST /api/generate` — body = `GenerateRequest` (mode, prompt, negative, model, loras[], width, height, count ≤4, seed?, reference_image_id?, reference_weight). Returns `{id, status}`. **Must stay `async`** (it schedules an asyncio task).
- `GET /api/jobs/{id}` — live state (memory-first, DB fallback).
- `WS /ws/jobs/{id}` — streams `snapshot` → `progress`* → `done`(with full image payloads) | `error`.
- `GET /api/images` (filters: kind, favorite, limit, offset), `GET /api/images/{id}`, `PATCH` (favorite/tags), `DELETE`, `GET /api/images/{id}/file|thumb`.
- `POST /api/upload` — multipart reference image → stored as `kind=uploaded`.

Generation flow: `routers/generate` → `services/jobs.JobManager` (in-memory pub/sub + asyncio task) → `comfy.factory.get_comfy_client()` → `services/storage.save_image_bytes` (PNG + WebP thumb + DB row). Image URLs are built in `app/serializers.image_to_out`.

## Conventions

- UI primitives live in `components/ui/` (Button, GlassPanel, Chip, …); feature components under `components/<feature>/`.
- Keep the chrome monochrome; never introduce a brand accent color — active states use near-white (`accent`).
- App name is a config token (`APP_NAME` / `NEXT_PUBLIC_APP_NAME`), currently a placeholder.
- Commit + update this file after each meaningful phase/decision (per project workflow).
