"""
04_critique_and_filter.py — LLM-based critique and quality filtering of synthetic pairs.

Usage:
    python 04_critique_and_filter.py --input data/synthetic_pairs/
    python 04_critique_and_filter.py --input data/synthetic_pairs/ --threshold 7 --dry-run
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import click
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))
from utils import (
    already_processed,
    call_claude,
    encode_image_b64,
    get_client,
    get_logger,
    image_media_type,
    log_processed,
    parse_json_response,
)

REPO_ROOT = Path(__file__).parent.parent
DATASET_DIR = REPO_ROOT / "data" / "dataset" / "img" / "10_BIG_style_diagram"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

CRITIQUE_SYSTEM = (
    "You are a senior architectural diagram critic specialising in the visual identity of "
    "Bjarke Ingels Group (BIG). When given an image, return ONLY a valid JSON object "
    "with no preamble, no markdown fences, and no trailing text."
)

CRITIQUE_USER = (
    "Score this image on its fidelity to BIG's diagram style. Return a JSON object with these keys:\n"
    "{\n"
    '  "palette_match": <integer 1-10>,\n'
    '  "palette_reason": "<brief note>",\n'
    '  "line_quality": <integer 1-10>,\n'
    '  "line_reason": "<brief note>",\n'
    '  "diagram_clarity": <integer 1-10>,\n'
    '  "clarity_reason": "<brief note>",\n'
    '  "human_scale": <integer 1-10>,\n'
    '  "human_reason": "<brief note>",\n'
    '  "BIG_signature": <integer 1-10>,\n'
    '  "signature_reason": "<brief note>",\n'
    '  "overall": <float, weighted average>,\n'
    '  "keep": <true|false>,\n'
    '  "reason": "<one sentence overall verdict>",\n'
    '  "improved_caption": "<improved LoRA training caption starting with \'BIG_arch_diagram\'>"\n'
    "}\n\n"
    "Scoring guidance:\n"
    "- palette_match: white background, black line weights, orange/yellow accents — "
    "weight 0.20 in overall\n"
    "- line_quality: clean bold architectural weight, no sketchy or noisy lines — weight 0.25\n"
    "- diagram_clarity: legible hierarchy, readable annotations, clear spatial intent — weight 0.25\n"
    "- human_scale: flat black silhouettes present and correctly proportioned — weight 0.15\n"
    "- BIG_signature: unmistakably BIG, not generic arch diagram — weight 0.15\n"
    "Set keep=true if the weighted overall >= the threshold passed by the caller.\n"
    "Compute overall as: 0.20*palette + 0.25*line + 0.25*clarity + 0.15*human + 0.15*sig"
)


def critique_image(client, image_path: Path) -> dict:
    b64 = encode_image_b64(image_path)
    media_type = image_media_type(image_path)

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": b64,
                    },
                },
                {"type": "text", "text": CRITIQUE_USER},
            ],
        }
    ]

    raw = call_claude(client, messages, system=CRITIQUE_SYSTEM, max_tokens=1024)
    return parse_json_response(raw)


def print_summary_table(results: list[dict], threshold: float) -> None:
    total = len(results)
    kept = [r for r in results if r.get("overall", 0) >= threshold]
    dropped = total - len(kept)
    scores = [r.get("overall", 0) for r in results]
    mean_score = sum(scores) / len(scores) if scores else 0.0

    bins = {
        "1-3": sum(1 for s in scores if s < 4),
        "4-6": sum(1 for s in scores if 4 <= s < 7),
        "7-8": sum(1 for s in scores if 7 <= s < 9),
        "9-10": sum(1 for s in scores if s >= 9),
    }

    click.echo("\n" + "=" * 50)
    click.echo("  Critique Summary")
    click.echo("=" * 50)
    click.echo(f"  Total evaluated : {total}")
    click.echo(f"  Kept (>= {threshold:.1f})   : {len(kept)}")
    click.echo(f"  Dropped          : {dropped}")
    click.echo(f"  Mean score       : {mean_score:.2f}")
    click.echo("  Score distribution:")
    for band, count in bins.items():
        bar = "#" * count
        click.echo(f"    {band:>5} : {bar} ({count})")
    click.echo("=" * 50 + "\n")


@click.command()
@click.option("--input", "input_dir", default="data/synthetic_pairs", show_default=True,
              help="Folder containing synthetic pair images to evaluate.")
@click.option("--threshold", default=7.0, show_default=True, type=float,
              help="Minimum overall score (1-10) to keep an image.")
@click.option("--output", "output_dir", default=None,
              help="Destination folder for kept images. Defaults to data/dataset/img/10_BIG_style_diagram/.")
@click.option("--dry-run", is_flag=True, default=False,
              help="Print what would be processed without calling the API.")
def main(input_dir: str, threshold: float, output_dir: str | None, dry_run: bool) -> None:
    logger = get_logger("04_critique")
    input_path = Path(input_dir)
    out_path = Path(output_dir) if output_dir else DATASET_DIR
    out_path.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        logger.error("Input folder not found: %s", input_path)
        sys.exit(1)

    images = sorted(
        p for p in input_path.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    to_process = [img for img in images if not already_processed(img)]
    logger.info(
        "Found %d images, %d already processed, %d to critique",
        len(images), len(images) - len(to_process), len(to_process),
    )

    if dry_run:
        click.echo(f"\n[dry-run] Would critique {len(to_process)} image(s):")
        for img in to_process:
            click.echo(f"  {img}")
        return

    if not to_process:
        logger.info("Nothing to do.")
        return

    client = get_client()
    results: list[dict] = []
    failed: list[Path] = []

    for img_path in tqdm(to_process, desc="Critiquing", unit="img"):
        try:
            result = critique_image(client, img_path)
            result["path"] = str(img_path)
            results.append(result)

            overall = result.get("overall", 0)
            keep = overall >= threshold

            if keep:
                dest_img = out_path / img_path.name
                shutil.copy2(img_path, dest_img)
                improved_caption = result.get("improved_caption", "")
                if not improved_caption.startswith("BIG_arch_diagram"):
                    improved_caption = "BIG_arch_diagram, " + improved_caption
                (out_path / img_path.with_suffix(".txt").name).write_text(
                    improved_caption, encoding="utf-8"
                )

            log_processed(img_path)
            status = "KEEP" if keep else "DROP"
            logger.info(
                "[%s] %s — overall %.1f  (%s)",
                status, img_path.name, overall, result.get("reason", "")[:80],
            )
        except Exception as exc:
            logger.error("Failed to critique %s: %s", img_path.name, exc)
            failed.append(img_path)

    if results:
        print_summary_table(results, threshold)

    logger.info(
        "Done. Processed %d, failed %d. Kept images → %s",
        len(to_process) - len(failed), len(failed), out_path,
    )


if __name__ == "__main__":
    main()
