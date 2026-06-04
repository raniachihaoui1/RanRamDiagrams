"""
01_caption_images.py — LLM-assisted captioning of BIG diagram images.

Usage:
    python 01_caption_images.py --input data/raw_images/
    python 01_caption_images.py --input data/raw_images/ --dry-run
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import click
from tqdm import tqdm

# Allow running from the scripts/ directory
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
CAPTIONS_FILE = REPO_ROOT / "data" / "captions.json"

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

SYSTEM_PROMPT = (
    "You are an expert architectural diagram analyst specialising in the graphic style of "
    "Bjarke Ingels Group (BIG). When given an image, return ONLY a single valid JSON object "
    "with no preamble, no markdown fences, and no trailing text."
)

USER_PROMPT = (
    "Analyse this architectural diagram and return a JSON object with these exact keys:\n"
    "{\n"
    '  "diagram_type": "<one of: axonometric_section | exploded_axonometric | bubble_concept_diagram '
    "| site_plan_aerial | narrative_process_diagram | programme_stack_diagram | "
    'facade_diagram | environmental_diagram | other>",\n'
    '  "palette": "<describe dominant colours and background>",\n'
    '  "line_style": "<describe line weights, strokes, and drawing style>",\n'
    '  "typography": "<describe fonts, label styles, annotation methods>",\n'
    '  "figures": "<describe human figures or scale elements if present>",\n'
    '  "vegetation": "<describe any trees, plants, or landscape elements>",\n'
    '  "materials": "<describe hatching, fills, or material representations>",\n'
    '  "layout": "<describe overall composition and spatial organisation>",\n'
    '  "unique_conventions": "<any distinctive BIG graphic conventions visible>",\n'
    '  "training_caption": "<caption for LoRA training — MUST start with \'BIG_arch_diagram\' '
    "and describe: palette (white background, black line weights, orange/yellow accents), "
    "diagram type, human silhouettes (flat black scale figures), annotation style "
    "(bold sans-serif labels, thin callout lines), and any hatching or material fills>"\
    "\n}"
)


def load_captions() -> dict:
    if CAPTIONS_FILE.exists():
        with CAPTIONS_FILE.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def save_captions(captions: dict) -> None:
    CAPTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with CAPTIONS_FILE.open("w", encoding="utf-8") as fh:
        json.dump(captions, fh, indent=2, ensure_ascii=False)


def write_sidecar(image_path: Path, caption: str) -> None:
    sidecar = image_path.with_suffix(".txt")
    sidecar.write_text(caption, encoding="utf-8")


def caption_image(client, image_path: Path, logger) -> dict:
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
                {"type": "text", "text": USER_PROMPT},
            ],
        }
    ]

    raw = call_claude(client, messages, system=SYSTEM_PROMPT, max_tokens=1024)
    result = parse_json_response(raw)

    # Enforce trigger token
    if not result.get("training_caption", "").startswith("BIG_arch_diagram"):
        result["training_caption"] = "BIG_arch_diagram, " + result.get("training_caption", "")
        logger.warning("Added missing trigger token to caption for %s", image_path.name)

    return result


@click.command()
@click.option("--input", "input_dir", default="data/raw_images", show_default=True,
              help="Folder containing source BIG diagram images.")
@click.option("--dry-run", is_flag=True, default=False,
              help="Print files that would be processed without calling the API.")
def main(input_dir: str, dry_run: bool) -> None:
    logger = get_logger("01_caption")
    input_path = Path(input_dir)

    if not input_path.exists():
        logger.error("Input folder does not exist: %s", input_path)
        sys.exit(1)

    images = sorted(
        p for p in input_path.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    if not images:
        logger.warning("No supported images found in %s", input_path)
        return

    captions = load_captions()
    to_process = [img for img in images if not already_processed(img)]

    logger.info("Found %d images, %d already processed, %d to process",
                len(images), len(images) - len(to_process), len(to_process))

    if dry_run:
        click.echo(f"\n[dry-run] Would process {len(to_process)} image(s):")
        for img in to_process:
            click.echo(f"  {img}")
        return

    if not to_process:
        logger.info("Nothing to do.")
        return

    client = get_client()
    failed: list[Path] = []

    for img_path in tqdm(to_process, desc="Captioning", unit="img"):
        try:
            result = caption_image(client, img_path, logger)
            captions[img_path.name] = result
            write_sidecar(img_path, result["training_caption"])
            save_captions(captions)
            log_processed(img_path)
            logger.info("Captioned: %s  [%s]", img_path.name, result.get("diagram_type", "?"))
        except Exception as exc:
            logger.error("Failed to caption %s: %s", img_path.name, exc)
            failed.append(img_path)

    logger.info("Done. Captioned %d, failed %d.", len(to_process) - len(failed), len(failed))
    if failed:
        logger.warning("Failed files: %s", [p.name for p in failed])


if __name__ == "__main__":
    main()
