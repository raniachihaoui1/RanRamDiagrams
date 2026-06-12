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
- **Engine**: ComfyUI adapter (`backend/comfy/`) — mock by default, real when ready
- Generated images & canvas projects live in `storage/`. **Models are not hosted
  here** — in real mode they come from your ComfyUI install.

## Prerequisites

Install these once before the quick start:

- **Python 3.11+** — <https://www.python.org/downloads/> (tick "Add to PATH").
- **Node.js 20+** (includes npm) — <https://nodejs.org/>.
- **Git** — to clone the repo.
- **ComfyUI** — *only needed for real generation*. The app runs fully in **mock**
  mode without it. See [Going real](#going-from-mock--real-comfyui) below.

> Everything runs locally. The app talks to ComfyUI over `http://127.0.0.1:8188`,
> so each person uses **their own** ComfyUI install and **their own** models —
> nothing about one machine's paths is baked into the repo.

## Quick start (Windows / PowerShell)

```powershell
# 0. Clone and enter the subproject
git clone <repo-url>
cd "<repo>/UI App"

# 1. Backend deps (creates an isolated Python env)
python -m venv backend/.venv
backend/.venv/Scripts/pip install -r backend/requirements.txt

# 2. Frontend deps
cd frontend; npm install; cd ..

# 3. Env — copy the template (it is NOT committed; you make your own)
Copy-Item .env.example .env

# 4. Run both (backend :8000 + frontend :3000)
./dev.ps1
```

Then open http://localhost:3000. Out of the box this runs in **mock** mode —
the full UI works with placeholder images, no GPU or ComfyUI required.

> If port 3000 is already in use, Next.js falls back to **:3001** (it prints the
> actual URL in the dev log). The backend always uses :8000.

> **macOS / Linux:** the venv binaries are under `backend/.venv/bin/` instead of
> `backend/.venv/Scripts/`, and there is no `dev.ps1` — run the backend and
> frontend in two terminals (see [Run servers individually](#run-servers-individually)).

### Run servers individually

```powershell
# Backend (from backend/)
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000

# Frontend (from frontend/)
npm run dev
```

## Going from mock → real ComfyUI

The image-to-image flow is **already wired** to a FLUX.2 Klein workflow
(`workflows/flux_img2img.json`). To switch from mock to real generation:

**1. Install ComfyUI** and start it (default URL `http://127.0.0.1:8188`).
Confirm it loads in your browser at that address.

**2. Put the required FLUX.2 models** in your ComfyUI's `models/` folder. The
workflow expects (download links are in `workflows/flux_img2img.json` and the
[ComfyUI FLUX.2 docs](https://docs.comfy.org/)):

| ComfyUI folder         | File                                  |
| ---------------------- | ------------------------------------- |
| `models/diffusion_models/` | a FLUX.2 Klein diffusion model (e.g. `flux-2-klein-base-4b-fp8.safetensors`) |
| `models/text_encoders/`    | `qwen_3_4b_fp4_flux2.safetensors` (or the 8B variant) |
| `models/vae/`              | `flux2-vae.safetensors`              |
| `models/loras/`            | **your trained LoRA(s)** (e.g. the BIG / Ranram style) |

**3. Point the app at ComfyUI.** In `.env` set:

```ini
COMFY_MODE=real
COMFY_URL=http://127.0.0.1:8188
```

Then restart the backend (`Ctrl+C` in the `dev.ps1` terminal, then `./dev.ps1`
again).

**4. Generate.** Reload the browser. The **Model** and **LoRA** chips now list
exactly what *your* ComfyUI has installed (fetched live from ComfyUI — no paths
are hardcoded). **Select a LoRA** (it is required), upload a reference image,
write a prompt, and generate.

> **Troubleshooting:** errors from ComfyUI now surface in the UI. Common ones:
> - *"No LoRA selected"* → pick a LoRA in the prompt bar first.
> - *"ComfyUI rejected the workflow … lora_name not in list"* → the selected
>   model isn't installed in your ComfyUI; install it or pick another.
> - Generation hangs at *queued* → ComfyUI isn't running at `COMFY_URL`.
>
> The backend prints full tracebacks to its terminal while you debug real mode.

No frontend changes are needed — the adapter interface is identical, and
swapping back to `COMFY_MODE=mock` always gives you a GPU-free fallback.

## Models — you do NOT put models in this repo

This app never hosts model files (no `models/` folder, nothing to commit).

- **Real mode**: the Model/LoRA chips are populated live **from your ComfyUI**
  (`/object_info`). You install/keep models only in ComfyUI's own `models/`
  folder. Nothing is uploaded to git — your teammate uses *her* ComfyUI + *her*
  models.
- **Mock mode**: the chips show placeholder entries; no model files are read.

So: **don't add `.safetensors` or checkpoints to the repo.** They belong in
ComfyUI on each person's machine.

## Rhino viewport bridge

Open the generator → **Rhino viewport**. To stream live frames, run
`rhino/viewport_stream.py` inside Rhino (see `rhino/PROTOCOL.md`). Capture a frame
straight into image-to-image.

## Deploy

`docker compose up --build` builds the backend (uvicorn) and frontend (Next.js
standalone). `storage/` is mounted as a volume.

## Project structure

```
UI App/
├─ frontend/   Next.js app (pages under app/, components/, lib/, store/)
├─ backend/    FastAPI app (app/, comfy/ adapter)
├─ storage/    generated images, thumbnails, uploads, canvas projects, app.db
├─ workflows/  ComfyUI API-format workflows (for real mode)
└─ rhino/      viewport bridge script + protocol
                (no models/ folder — models live in ComfyUI)
```

See `CLAUDE.md` for architecture details.
