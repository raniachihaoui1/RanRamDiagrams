# BIG LoRA Training Pipeline

Train a FLUX dev LoRA that converts any image or Rhino 3D screenshot into a BIG (Bjarke Ingels Group) architecture diagram — white background, bold black line weights, orange accents, flat black human figures, bold sans-serif annotations.

---

## 1. Overview

The pipeline has five stages:

| Script | What it does |
|--------|-------------|
| `01_caption_images.py` | Claude vision → structured JSON captions + `.txt` sidecar files |
| `02_generate_controlnet_maps.py` | Canny / depth / lineart conditioning maps from Rhino exports |
| `03_generate_synthetic_pairs.py` | FLUX dev + ControlNet Union → synthetic BIG-style images |
| `04_critique_and_filter.py` | Claude scores each synthetic image 1–10 and keeps ≥ 7 |
| `05_prepare_dataset.py` | Validates captions, resizes to 1024×1024, reports stats |

After running all five scripts, point the x-flux trainer at `config/flux_lora_config.toml` and load the output LoRA in the provided ComfyUI workflow.

---

## 2. Hardware Requirements

| Task | VRAM |
|------|------|
| FLUX dev inference (scripts 03) | 12 GB (with CPU offload) |
| FLUX dev LoRA training | **24 GB minimum** (A100 / RTX 4090 recommended) |
| ComfyUI inference | 12 GB |

Training with `cache_latents = true` and `cache_text_encoder_outputs = true` is mandatory on 24 GB — the T5 encoder alone is ~10 GB at fp16.

---

## 3. Model Downloads

Download each file and place it in the `models/` folder at the project root.

| File | Source |
|------|--------|
| `flux1-dev.safetensors` | `black-forest-labs/FLUX.1-dev` on HuggingFace (gated — accept licence first) |
| `ae.safetensors` | `black-forest-labs/FLUX.1-dev` → `vae/` (same repo) |
| `clip_l.safetensors` | `openai/clip-vit-large-patch14` or FLUX repo |
| `t5xxl_fp16.safetensors` | `google/t5-v1_1-xxl` converted to fp16 safetensors |
| `FLUX.1-dev-ControlNet-Union-Pro.safetensors` | `Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro` |

The x-flux trainer needs `clip_l` and `t5xxl` as separate files; kohya FLUX branch can load them from the same `flux1-dev` repo directory.

---

## 4. Installation

```bash
git clone <this-repo> big_lora_pipeline
cd big_lora_pipeline
pip install -r requirements.txt
```

Set your Anthropic API key (scripts 01 and 04 use Claude claude-opus-4-6):

```bash
# Linux / macOS
export ANTHROPIC_API_KEY="sk-ant-..."

# Windows PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
```

Install x-flux trainer (primary training backend):

```bash
git clone https://github.com/XLabs-AI/x-flux.git
cd x-flux && pip install -e .
```

---

## 5. Preparing Your Images

### BIG diagram scrapes (`data/raw_images/`)

Collect 40–80 high-resolution BIG diagram images. Recommended sources: BIG's official website project pages, Dezeen, ArchDaily. Aim for variety across all eight diagram types listed in `config/style_guide.json`.

Accepted formats: `.png`, `.jpg`, `.jpeg`, `.webp`.

### Rhino exports (`data/rhino_exports/`)

Export screenshots from Rhino with these settings for maximum ControlNet compatibility:

- **Display mode**: Technical or Pen (not Shaded or Rendered)
- **Background**: solid white
- **Shadows**: off
- **Viewport**: axonometric or perspective — avoid too-close crops
- **Export resolution**: 2× your intended diagram size (e.g. 2048×2048 → downsampled to 1024)
- **File format**: PNG

---

## 6. Running the Pipeline

Run scripts in order. Each script is idempotent — re-running skips already-processed files.

```bash
# Step 1 — Caption raw BIG diagrams with Claude
python scripts/01_caption_images.py --input data/raw_images/

# Step 2 — Generate conditioning maps from Rhino exports
python scripts/02_generate_controlnet_maps.py --input data/rhino_exports/

# Step 3 — Generate synthetic BIG-style pairs (requires GPU)
python scripts/03_generate_synthetic_pairs.py \
    --model_path models/flux1-dev.safetensors

# Step 4 — Critique and filter with Claude (keep score >= 7)
python scripts/04_critique_and_filter.py \
    --input data/synthetic_pairs/ \
    --threshold 7

# Step 5 — Validate and resize dataset to 1024×1024
python scripts/05_prepare_dataset.py --resolution 1024
```

Use `--dry-run` on scripts 01 and 04 to preview what will be processed without API calls.

---

## 7. Training

Once the dataset is ready (`data/dataset/img/10_BIG_style_diagram/` contains ≥ 40 images with `.txt` sidecars):

```bash
# From inside the x-flux directory
python train_flux_lora.py \
    --config ../big_lora_pipeline/config/flux_lora_config.toml

# Or with kohya FLUX branch
python train_network.py \
    --config_file ../big_lora_pipeline/config/flux_lora_config.toml
```

Expected training time on A100 80 GB: ~2–3 hours for 25 epochs with a 60-image dataset.

The trained LoRA is saved to `output/big_style_flux.safetensors` every 5 epochs.

---

## 8. The Critique Loop

The quality of the dataset directly controls LoRA quality. Iterate:

1. Run script 03 to generate synthetic pairs.
2. Run script 04 to critique and filter — check the summary table.
3. If the dataset is below 40 images or mean score < 7.5, adjust prompts in script 03 and regenerate.
4. If a specific diagram type is underrepresented, add more matching Rhino exports.
5. Once dataset is stable and validated, run script 05 and begin training.

After training a checkpoint, run a test image through the ComfyUI workflow and evaluate against `config/style_guide.json`'s `signature_elements`. If elements are missing, re-enter the loop.

---

## 9. ComfyUI Setup

### Install ComfyUI

```bash
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI && pip install -r requirements.txt
```

### Required custom nodes

Install via ComfyUI Manager or manually:

- **ComfyUI-FLUX** — FLUX-specific nodes (FluxGuidance, etc.)
- **ComfyUI_ControlNet_Union** — ControlNet Union support
- **ComfyUI-Advanced-ControlNet** — `ControlNetApplyAdvanced` node

### Load the workflow

1. Place `big_style_flux.safetensors` in `ComfyUI/models/loras/`
2. Place `flux1-dev.safetensors` in `ComfyUI/models/checkpoints/`
3. Place the ControlNet model in `ComfyUI/models/controlnet/`
4. Open ComfyUI → Load → select `comfyui/rhino_to_BIG_flux_workflow.json`
5. Set the LoadImage node to your Rhino screenshot
6. Queue — **Variant A** (denoise 0.75) and **Variant B** (denoise 0.55) run in parallel

---

## 10. Tuning Tips

| Problem | Fix |
|---------|-----|
| Style too weak / not BIG enough | Increase LoRA strength to 1.0; lower denoise to 0.6 |
| Rhino geometry lost or distorted | Lower denoise to 0.5; increase ControlNet strength to 0.8 |
| Wrong colours (not white bg + orange) | Add `"white background, orange accent fills #FF5A1F"` explicitly to every prompt |
| Human figures missing | Add `"flat black human silhouettes at 1:100 scale"` to the positive prompt |
| Lines too sketchy or noisy | Add `"bold clean architectural line weights, no sketch texture"` to positive; add `"sketchy, noisy"` to negative |
| Text / annotations unreadable | Add `"bold sans-serif zone labels, thin legible callout lines"` to positive |
| Too much 3D look remaining | Add `"orthographic projection, no perspective distortion"` to positive |

For more control over which diagram type is produced, swap the positive prompt to match one of the eight types in `config/style_guide.json`.
