# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A five-stage data pipeline that builds a training dataset and trains a FLUX dev LoRA which converts any image or Rhino 3D screenshot into a BIG (Bjarke Ingels Group) architecture diagram. The repo contains only the dataset-generation scripts, configs, and a ComfyUI inference workflow — the FLUX models, the x-flux trainer, and all `data/` directories are external and not checked in.

## Commands

```bash
pip install -r requirements.txt          # install pipeline deps (not torch/diffusers GPU stack — see README §4)

# Pipeline — run in numbered order; each stage is idempotent (re-runs skip processed files)
python scripts/01_caption_images.py --input data/raw_images/        # Claude vision → captions.json + .txt sidecars
python scripts/02_generate_controlnet_maps.py --input data/rhino_exports/
python scripts/03_generate_synthetic_pairs.py --model_path models/flux1-dev.safetensors   # needs GPU
python scripts/04_critique_and_filter.py --input data/synthetic_pairs/ --threshold 7
python scripts/05_prepare_dataset.py --resolution 1024

# Preview without API calls (scripts 01 and 04 only)
python scripts/01_caption_images.py --input data/raw_images/ --dry-run
```

Scripts 01 and 04 require `ANTHROPIC_API_KEY` in the environment. Script 03 requires a GPU plus the heavyweight `torch`/`diffusers`/`accelerate`/`transformers` stack (it checks for these at startup and exits with install instructions if missing). There is no test suite, linter, or build step.

Training is run **outside this repo** by pointing the x-flux trainer (or kohya FLUX branch) at `config/flux_lora_config.toml`. See README §7.

## Architecture

The pipeline is a linear chain where each script consumes the previous stage's output directory under `data/`:

```
data/raw_images/   ──01──> data/captions.json + .txt sidecars
data/rhino_exports/──02──> data/controlnet_maps/ (*_canny/_depth/_lineart.png)
   (both above)    ──03──> data/synthetic_pairs/ (FLUX+ControlNet generated .png + .txt)
                   ──04──> data/dataset/img/10_BIG_style_diagram/ (kept images, score ≥ threshold)
                   ──05──> validates + resizes that folder in place → ready for training
```

`scripts/utils.py` is the shared core every script imports (each prepends its own dir to `sys.path` so `from utils import ...` works regardless of CWD). It owns:
- **Logging** — single shared `pipeline.log` file handler plus console; `get_logger(name)`.
- **Idempotency** — `log_processed()` / `already_processed()` track work via `PROCESSED <abspath>` marker lines appended to `pipeline.log`. This log is therefore load-bearing state, not just diagnostics — deleting it makes every script reprocess everything.
- **Claude calls** — `get_client()` + `call_claude()` with exponential-backoff retry. Default model is `claude-opus-4-6`.
- **Image/JSON helpers** — base64 encoding, media-type mapping, and `parse_json_response()` which strips markdown fences before `json.loads`.

`config/style_guide.json` is the single source of truth for the BIG visual grammar (palette hex codes, line weights, the 8 diagram types, typography, hatching, signature elements, prompt tokens). Scripts 03 and 05 read the `diagram_types` list from it; the captioning/critique prompts in scripts 01 and 04 encode the same vocabulary. Keep these in sync — if you add a diagram type, update both `style_guide.json` and the `extract_diagram_type()` list in `05_prepare_dataset.py` and the enum in the `USER_PROMPT` of `01_caption_images.py`.

The **trigger token `BIG_arch_diagram`** must lead every training caption. Scripts 01 and 04 auto-prepend it if Claude omits it; script 05 fails the build if any caption is missing it. The matching dataset folder name `10_BIG_style_diagram` (the `10_` is kohya/x-flux's `num_repeats` convention) is hardcoded as the output of script 04 and input of script 05.

## Conventions

- All scripts are Click CLIs with a `main()` entrypoint; paths default relative to repo root via `REPO_ROOT = Path(__file__).parent.parent`.
- Claude prompts demand raw JSON (no fences); always route responses through `parse_json_response()` rather than `json.loads` directly.
- Supported input image extensions are `.jpg/.jpeg/.png/.webp`, defined per-script as `SUPPORTED_EXTENSIONS`.
- Type hints use `from __future__ import annotations` (PEP 604 unions on 3.9+).

## `UI App/` — AI Creative Suite (separate subproject)

`UI App/` is a Krea-style web app (in progress) that orchestrates ComfyUI workflows (Flux 2.0) and the LoRAs trained by the pipeline above. It is a **self-contained subproject** with its own stack and its own `UI App/CLAUDE.md` — read that file before working there. Summary:

- **Stack**: Next.js 16 (App Router, TS, Tailwind v4) in `UI App/frontend/` + Python FastAPI in `UI App/backend/`.
- **ComfyUI**: integrated via an adapter with a mock client (no GPU needed yet); flip `COMFY_MODE=real` later.
- **Run locally**: `cd "UI App"` then `./dev.ps1` (boots backend :8000 + frontend :3000).
- Plan/roadmap: `C:\Users\gramo\.claude\plans\e-iaac-local-rosy-lemur.md`. Work happens on branch `ramon`.
