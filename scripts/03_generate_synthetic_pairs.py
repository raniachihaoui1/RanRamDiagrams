"""
03_generate_synthetic_pairs.py — Generate synthetic ranram-style image pairs using FLUX + ControlNet.

Usage:
    python 03_generate_synthetic_pairs.py --model_path models/flux1-dev.safetensors
    python 03_generate_synthetic_pairs.py --model_path models/flux1-dev.safetensors --variations 4
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

import click
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))
from utils import get_logger

REPO_ROOT = Path(__file__).parent.parent
CONTROLNET_DIR = REPO_ROOT / "data" / "controlnet_maps"
SYNTHETIC_DIR = REPO_ROOT / "data" / "synthetic_pairs"
STYLE_GUIDE = REPO_ROOT / "config" / "style_guide.json"
RHINO_DIR = REPO_ROOT / "data" / "rhino_exports"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

NEGATIVE_PROMPT = (
    "photorealistic, 3d render, blurry, noisy, watermark, gradient background, "
    "colour photograph, sketchy, hand-drawn, low contrast"
)

CONTROLNET_UNION_REPO = "Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro"


def _check_dependencies() -> bool:
    try:
        import diffusers  # noqa: F401
        import torch  # noqa: F401
        return True
    except ImportError:
        return False


def build_positive_prompt(diagram_type: str) -> str:
    return (
        f"ranram_arch_diagram, {diagram_type}, white background, bold black structural line weights, "
        "flat black human silhouettes for scale, orange accent fills #FF5A1F, sans-serif annotations, "
        "architectural section hatching, clean graphic design, high contrast"
    )


def load_style_guide() -> dict:
    if not STYLE_GUIDE.exists():
        return {"diagram_types": [{"name": "axonometric_section"}, {"name": "site_plan_aerial"}]}
    with STYLE_GUIDE.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def load_pipeline(model_path: str, controlnet_repo: str):
    """Load FLUX dev img2img pipeline with ControlNet Union."""
    import torch
    from diffusers import FluxControlNetPipeline, FluxControlNetModel
    from diffusers.models import FluxMultiControlNetModel

    controlnet = FluxControlNetModel.from_pretrained(
        controlnet_repo,
        torch_dtype=torch.bfloat16,
    )

    pipe = FluxControlNetPipeline.from_single_file(
        model_path,
        controlnet=controlnet,
        torch_dtype=torch.bfloat16,
    )
    pipe.enable_model_cpu_offload()
    return pipe


def generate_variations(
    pipe,
    rhino_path: Path,
    canny_path: Path,
    diagram_types: list[str],
    n_variations: int,
    output_dir: Path,
    logger,
) -> None:
    import torch
    from PIL import Image

    control_image = Image.open(canny_path).convert("RGB").resize((1024, 1024))
    input_image = Image.open(rhino_path).convert("RGB").resize((1024, 1024))

    sampled_types = random.choices(diagram_types, k=n_variations)

    for i, diagram_type in enumerate(sampled_types):
        out_stem = f"{rhino_path.stem}_synthetic_{i:02d}"
        out_img = output_dir / f"{out_stem}.png"
        out_txt = output_dir / f"{out_stem}.txt"

        if out_img.exists():
            logger.debug("Skipping existing %s", out_img.name)
            continue

        prompt = build_positive_prompt(diagram_type)

        result = pipe(
            prompt=prompt,
            negative_prompt=NEGATIVE_PROMPT,
            image=input_image,
            control_image=control_image,
            controlnet_conditioning_scale=0.6,
            num_inference_steps=28,
            guidance_scale=3.5,
            height=1024,
            width=1024,
            generator=torch.Generator().manual_seed(random.randint(0, 2**32 - 1)),
        )

        result.images[0].save(str(out_img))
        out_txt.write_text(prompt, encoding="utf-8")
        logger.info("  Saved variation %d/%d: %s", i + 1, n_variations, out_img.name)


@click.command()
@click.option("--model_path", required=True,
              help="Path to flux1-dev.safetensors (or HuggingFace repo id).")
@click.option("--input", "input_dir", default=None,
              help="Rhino export folder. Defaults to data/rhino_exports/.")
@click.option("--controlnet", "controlnet_repo", default=CONTROLNET_UNION_REPO, show_default=True,
              help="ControlNet Union HuggingFace repo or local path.")
@click.option("--variations", default=4, show_default=True,
              help="Number of synthetic variations per Rhino export.")
@click.option("--output", "output_dir", default=None,
              help="Output folder. Defaults to data/synthetic_pairs/.")
def main(
    model_path: str,
    input_dir: str | None,
    controlnet_repo: str,
    variations: int,
    output_dir: str | None,
) -> None:
    logger = get_logger("03_synthetic_pairs")

    if not _check_dependencies():
        logger.error(
            "diffusers or torch not available. Install with:\n"
            "  pip install torch diffusers accelerate transformers\n"
            "Then re-run this script."
        )
        sys.exit(1)

    rhino_dir = Path(input_dir) if input_dir else RHINO_DIR
    out_dir = Path(output_dir) if output_dir else SYNTHETIC_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    if not rhino_dir.exists():
        logger.error("Rhino export folder not found: %s", rhino_dir)
        sys.exit(1)

    rhino_images = sorted(
        p for p in rhino_dir.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    if not rhino_images:
        logger.warning("No images found in %s", rhino_dir)
        return

    style_guide = load_style_guide()
    diagram_types = [dt["name"] for dt in style_guide.get("diagram_types", [])]
    if not diagram_types:
        diagram_types = ["axonometric_section", "site_plan_aerial", "facade_diagram"]

    logger.info(
        "Generating %d variations for %d Rhino exports → %s",
        variations, len(rhino_images), out_dir,
    )
    logger.info("Loading FLUX dev pipeline (this may take a few minutes)…")

    pipe = load_pipeline(model_path, controlnet_repo)

    for rhino_path in tqdm(rhino_images, desc="Rhino exports", unit="img"):
        canny_path = CONTROLNET_DIR / f"{rhino_path.stem}_canny.png"
        if not canny_path.exists():
            logger.warning(
                "No canny map for %s — run script 02 first. Skipping.", rhino_path.name
            )
            continue
        try:
            generate_variations(
                pipe, rhino_path, canny_path, diagram_types, variations, out_dir, logger
            )
        except Exception as exc:
            logger.error("Failed on %s: %s", rhino_path.name, exc)

    logger.info("Done. Synthetic pairs saved to %s", out_dir)


if __name__ == "__main__":
    main()
