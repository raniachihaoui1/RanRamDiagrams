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

## `technical_diagrams/` — Ranram fine-line captioning tool (separate subproject)

`technical_diagrams/` is a **self-contained** captioning tool for a second LoRA style — the *Ranram fine-line monochrome technical-drawing* look (delicate uniform hairlines, white background, stippled textures, naturalistic scale figures), as opposed to the bold BIG style the `scripts/` pipeline targets. It does **not** import from `scripts/` — it ships its own copy of `utils.py`.

- **Single source of truth**: `technical_diagrams/style_guide.json` (`name: "Ranram Visual Grammar"`). Unlike `scripts/01_caption_images.py` (whose prompt is hard-coded), `caption_images.py` builds the system/user prompt *dynamically* from this file — its `signature_elements`, the 8 `diagram_types` enum, and `prompt_building.*`. Edit the style guide → captions change, no code edits.
- **Trigger token `technical_drawing`** (from `prompt_building.required_tokens[0]`); auto-prepended to every caption.
- **Run**: `cd technical_diagrams; python caption_images.py --input <folder>` (writes a `.txt` sidecar next to each image + a `captions.json` in the same folder; `--out` to redirect; `--dry-run` to preview). Idempotency marker file is `technical_diagrams/captioning.log` (load-bearing, like the pipeline's `pipeline.log`).
- **Secrets**: reads `ANTHROPIC_API_KEY` from env or a gitignored `technical_diagrams/.env` (loaded via `python-dotenv`). `.gitignore` covers `.env`, `captioning.log`, `captions.json`.
- **Deps**: `technical_diagrams/requirements.txt` (`anthropic`, `click`, `tqdm`, `python-dotenv`).

The training data for this style lives **externally** (Google Drive, not in the repo) under `…/FineTuning/dataset_Ranram_diagram/`:
- `Style02/` — 73 source images + their `.txt` captions (each starts with `technical_drawing`).
- **Entourage cut-out sets** scraped from pimpmydrawing.com (vector SVGs rendered to PNG via `svglib`, **not** cairosvg — cairosvg has no Windows libcairo and its mere presence breaks svglib): `people/` (108), `trees/` (12), `furniture/` (20), `plants/` (8). Each cut-out exists in **two forms** with matching filenames + `.txt` captions:
  - the named folder (e.g. `people/`) — **transparent** 1024×1024 RGBA, square, aspect preserved (long edge scaled, centred, padded), background flood-filled to alpha from the corners (keeps enclosed whites). For compositing entourage into scenes.
  - a parallel `*_white/` folder (e.g. `people_white/`) — the same images **flattened onto white** (RGB, alpha composited over white). Use these for **direct LoRA training** — trainers drop alpha, and the transparent pixels are RGB black underneath, so feeding the transparent set raw would train on black backgrounds.
  - `.txt` captions (in both forms) start with `technical_drawing` and carry the line-quality vocabulary (monochrome, thin uniform black hairline, white background, no shading/fill); subjects for trees/furniture/plants are hand-curated, people derived from filenames.
- `construction_drawing/` — 82 isometric/construction reference drawings (scraped from a Pinterest board, ≥800 px, white background, numbered `001`–`082`). NB: Pinterest's `BoardFeedResource` API returns 403 without a real browser session — `construction_drawing/_pin_scrape.py` is the scrape attempt; a working pull needs session cookies. (In practice the 403 is fixable *without* login by sending the full browser header set — `X-Pinterest-PWS-Handler`, `X-Pinterest-Source-Url`, `X-CSRFToken` from the board-page cookies, `X-APP-VERSION`, proper `Accept` — then paginating `BoardFeedResource` by `resource_response.bookmark` until `-end-`.)
- `arctic_modern/` — reference set scraped from the `arctic_modern` Pinterest board (99 pulled, 2 sub-600 px discarded → **97**, numbered `001`–`097`). **Different style from `technical_drawing`**: these are minimalist monochrome 3D massing *renders* (matte concrete/clay/timber volumes, soft studio lighting, pale-grey seamless background, tiny grey scale figures, soft shadows) — captions use the trigger token **`arctic_modern`** and a render-quality vocabulary, not the fine-line drawing one. "Discard low quality only" here meant deleting only the <600 px pins (the 600–799 px ones were kept). Captions in progress (6/97 done) — the rest were blocked mid-session by an API per-conversation image cap and need a fresh session to finish.

## `UI App/` — AI Creative Suite (separate subproject)

`UI App/` is a Krea-style web app (in progress) that orchestrates ComfyUI workflows (Flux 2.0) and the LoRAs trained by the pipeline above. It is a **self-contained subproject** with its own stack and its own `UI App/CLAUDE.md` — read that file before working there. Summary:

- **Stack**: Next.js 16 (App Router, TS, Tailwind v4) in `UI App/frontend/` + Python FastAPI in `UI App/backend/`.
- **ComfyUI**: integrated via an adapter with a mock client (no GPU needed yet); flip `COMFY_MODE=real` later.
- **Run locally**: `cd "UI App"` then `./dev.ps1` (boots backend :8000 + frontend :3000).
- Plan/roadmap: `C:\Users\gramo\.claude\plans\e-iaac-local-rosy-lemur.md`. Work happens on branch `ramon`.
