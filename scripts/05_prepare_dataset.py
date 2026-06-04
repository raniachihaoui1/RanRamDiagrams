"""
05_prepare_dataset.py — Validate and prepare the final training dataset.

Usage:
    python 05_prepare_dataset.py
    python 05_prepare_dataset.py --resolution 1024 --input data/dataset/img/10_BIG_style_diagram/
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import click
from PIL import Image
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))
from utils import get_logger

REPO_ROOT = Path(__file__).parent.parent
DEFAULT_DATASET_DIR = REPO_ROOT / "data" / "dataset" / "img" / "10_BIG_style_diagram"
TRIGGER_TOKEN = "BIG_arch_diagram"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MIN_DATASET_SIZE = 40


def pad_to_square(img: Image.Image, size: int, bg_color: tuple = (255, 255, 255)) -> Image.Image:
    """Resize image to fit within `size`x`size`, pad with bg_color to exact square."""
    img.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGB", (size, size), bg_color)
    offset_x = (size - img.width) // 2
    offset_y = (size - img.height) // 2
    canvas.paste(img, (offset_x, offset_y))
    return canvas


def extract_diagram_type(caption: str) -> str:
    diagram_types = [
        "axonometric_section",
        "exploded_axonometric",
        "bubble_concept_diagram",
        "site_plan_aerial",
        "narrative_process_diagram",
        "programme_stack_diagram",
        "facade_diagram",
        "environmental_diagram",
    ]
    caption_lower = caption.lower()
    for dt in diagram_types:
        if dt.replace("_", " ") in caption_lower or dt in caption_lower:
            return dt
    # Try partial matches
    for dt in diagram_types:
        parts = dt.split("_")
        if any(p in caption_lower for p in parts if len(p) > 4):
            return dt
    return "other"


@click.command()
@click.option("--input", "input_dir", default=None,
              help="Dataset folder to validate and resize. Defaults to data/dataset/img/10_BIG_style_diagram/.")
@click.option("--resolution", default=1024, show_default=True, type=int,
              help="Target resolution (square). Images are padded, not stretched.")
@click.option("--no-resize", is_flag=True, default=False,
              help="Skip resizing; only validate captions and report stats.")
def main(input_dir: str | None, resolution: int, no_resize: bool) -> None:
    logger = get_logger("05_prepare_dataset")
    dataset_path = Path(input_dir) if input_dir else DEFAULT_DATASET_DIR

    if not dataset_path.exists():
        logger.error("Dataset folder not found: %s", dataset_path)
        sys.exit(1)

    images = sorted(
        p for p in dataset_path.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    if not images:
        logger.warning("No images found in %s", dataset_path)
        sys.exit(1)

    # -----------------------------------------------------------------------
    # Caption validation
    # -----------------------------------------------------------------------
    missing_captions: list[Path] = []
    bad_trigger: list[Path] = []
    word_counts: list[int] = []
    diagram_type_counts: Counter = Counter()

    for img_path in images:
        txt_path = img_path.with_suffix(".txt")
        if not txt_path.exists():
            missing_captions.append(img_path)
            continue

        caption = txt_path.read_text(encoding="utf-8").strip()
        if not caption.startswith(TRIGGER_TOKEN):
            bad_trigger.append(img_path)

        word_counts.append(len(caption.split()))
        diagram_type_counts[extract_diagram_type(caption)] += 1

    # -----------------------------------------------------------------------
    # Resize to target resolution (white-padded square)
    # -----------------------------------------------------------------------
    resized_count = 0
    if not no_resize:
        for img_path in tqdm(images, desc=f"Resizing to {resolution}x{resolution}", unit="img"):
            try:
                with Image.open(img_path) as img:
                    img = img.convert("RGB")
                    if img.width != resolution or img.height != resolution:
                        padded = pad_to_square(img, resolution)
                        padded.save(str(img_path), format="PNG")
                        resized_count += 1
            except Exception as exc:
                logger.error("Could not resize %s: %s", img_path.name, exc)

    # -----------------------------------------------------------------------
    # Report
    # -----------------------------------------------------------------------
    total = len(images)
    captioned = total - len(missing_captions)
    wc_min = min(word_counts) if word_counts else 0
    wc_mean = sum(word_counts) / len(word_counts) if word_counts else 0.0
    wc_max = max(word_counts) if word_counts else 0

    click.echo("\n" + "=" * 54)
    click.echo("  Dataset Preparation Report")
    click.echo("=" * 54)
    click.echo(f"  Total images          : {total}")
    click.echo(f"  With .txt captions    : {captioned}")
    click.echo(f"  Missing captions      : {len(missing_captions)}")
    click.echo(f"  Bad trigger token     : {len(bad_trigger)}")
    if not no_resize:
        click.echo(f"  Resized to {resolution}x{resolution}    : {resized_count}")
    click.echo(f"  Caption word count    : min={wc_min}  mean={wc_mean:.1f}  max={wc_max}")
    click.echo("\n  Diagram type breakdown:")
    for dt, count in sorted(diagram_type_counts.items(), key=lambda x: -x[1]):
        click.echo(f"    {dt:<35} {count}")
    click.echo("=" * 54)

    if total < MIN_DATASET_SIZE:
        click.echo(
            f"\n  WARNING: Dataset has only {total} images — recommended minimum is {MIN_DATASET_SIZE}.\n"
            "  Run scripts 03 and 04 again to generate more synthetic pairs.\n"
        )
        logger.warning("Dataset size %d is below minimum %d", total, MIN_DATASET_SIZE)

    if missing_captions:
        click.echo("\n  Images without captions:")
        for p in missing_captions:
            click.echo(f"    {p.name}")

    if bad_trigger:
        click.echo(f"\n  Images with captions not starting with '{TRIGGER_TOKEN}':")
        for p in bad_trigger:
            click.echo(f"    {p.name}")

    if missing_captions or bad_trigger:
        logger.error("Dataset has %d missing captions and %d bad trigger tokens — fix before training.",
                     len(missing_captions), len(bad_trigger))
        sys.exit(1)

    logger.info("Dataset validated. %d images ready for training.", total)
    click.echo("\n  Dataset is ready for training.\n")


if __name__ == "__main__":
    main()
