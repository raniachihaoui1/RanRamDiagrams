"""
caption_images.py — LLM-assisted captioning for the Ranram fine-line
technical-diagram style.

Unlike the repo's scripts/01_caption_images.py, this version is driven entirely
by style_guide.json (single source of truth): the diagram-type enum, the trigger
token, and the special style requirements (monochrome, thin hairline linework,
stippled textures, naturalistic scale figures…) are all read from that file and
injected into the prompt. Change the style guide → the captions change. No prompt
text is hard-coded to one style.

Outputs, per run:
  - one `<image>.txt` sidecar next to every image  (the LoRA training caption)
  - a `captions.json` (full structured analysis) in the output dir

Usage (PowerShell):
    $env:ANTHROPIC_API_KEY = "sk-ant-..."
    python caption_images.py --input "H:\\...\\dataset_Ranram_diagram\\Style02"
    python caption_images.py --input "H:\\...\\Style02" --dry-run
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import click
from tqdm import tqdm

# Allow running from this directory regardless of CWD
sys.path.insert(0, str(Path(__file__).parent))

# Load a local .env (gitignored) so ANTHROPIC_API_KEY can live in this folder.
# An env var already set in the shell always wins over the .env file.
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env", override=False)
except ImportError:
    pass

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

HERE = Path(__file__).parent
STYLE_GUIDE_FILE = HERE / "style_guide.json"

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


# ---------------------------------------------------------------------------
# Style guide → prompt
# ---------------------------------------------------------------------------

def load_style_guide() -> dict:
    if not STYLE_GUIDE_FILE.exists():
        raise FileNotFoundError(f"Style guide not found: {STYLE_GUIDE_FILE}")
    with STYLE_GUIDE_FILE.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def trigger_token(style: dict) -> str:
    tokens = style.get("prompt_building", {}).get("required_tokens", [])
    if not tokens:
        raise ValueError("style_guide.json -> prompt_building.required_tokens is empty")
    return tokens[0]


def build_prompts(style: dict) -> tuple[str, str]:
    """Construct the SYSTEM and USER prompts from the style guide."""
    name = style.get("name", "this architectural drawing")
    token = trigger_token(style)

    diagram_names = [d["name"] for d in style.get("diagram_types", [])]
    enum = " | ".join(diagram_names) + " | other"

    signatures = style.get("signature_elements", [])
    signature_block = "\n".join(f"  - {s}" for s in signatures)

    pb = style.get("prompt_building", {})
    palette_tokens = ", ".join(pb.get("palette_tokens", []))
    figure_tokens = ", ".join(pb.get("figure_tokens", []))
    texture_tokens = ", ".join(pb.get("texture_tokens", []))
    annotation_tokens = ", ".join(pb.get("annotation_tokens", []))

    system_prompt = (
        f"You are an expert architectural-drawing analyst specialising in the '{name}' "
        "graphic style: delicate monochrome fine-line technical drawings. "
        "When given an image, return ONLY a single valid JSON object with no preamble, "
        "no markdown fences, and no trailing text."
    )

    user_prompt = (
        f"Analyse this architectural diagram, which is drawn in the '{name}' style.\n\n"
        "That style is defined by these signature elements:\n"
        f"{signature_block}\n\n"
        "Return a JSON object with EXACTLY these keys:\n"
        "{\n"
        f'  "diagram_type": "<one of: {enum}>",\n'
        '  "palette": "<describe tones/background — expect strictly monochrome, white background>",\n'
        '  "line_style": "<describe line weights and quality — expect thin, uniform hairlines>",\n'
        '  "typography": "<describe any labels/numbering, or state none present>",\n'
        '  "figures": "<describe human scale figures, their posture and props if present>",\n'
        '  "vegetation": "<describe trees, stippled canopies, planting if present>",\n'
        '  "textures": "<describe stippling, lattice, mesh, dotted guide lines>",\n'
        '  "layout": "<describe composition, projection type, use of white space, ghosted context>",\n'
        '  "unique_conventions": "<distinctive conventions of this style visible in the image>",\n'
        f'  "training_caption": "<a single caption for LoRA training. It MUST start with the exact '
        f"trigger token '{token}'. Then describe, in natural language: palette ({palette_tokens}); "
        f"the diagram type; figures ({figure_tokens}); textures ({texture_tokens}); "
        f"annotation ({annotation_tokens}). Keep it dense, comma-separated, no line breaks.>\"\n"
        "}"
    )
    return system_prompt, user_prompt


# ---------------------------------------------------------------------------
# Captions I/O
# ---------------------------------------------------------------------------

def load_captions(captions_file: Path) -> dict:
    if captions_file.exists():
        with captions_file.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def save_captions(captions: dict, captions_file: Path) -> None:
    captions_file.parent.mkdir(parents=True, exist_ok=True)
    with captions_file.open("w", encoding="utf-8") as fh:
        json.dump(captions, fh, indent=2, ensure_ascii=False)


def write_sidecar(image_path: Path, caption: str, out_dir: Path) -> None:
    sidecar = out_dir / (image_path.stem + ".txt")
    sidecar.write_text(caption, encoding="utf-8")


# ---------------------------------------------------------------------------
# Per-image captioning
# ---------------------------------------------------------------------------

def caption_image(client, image_path: Path, system_prompt: str, user_prompt: str,
                  token: str, logger) -> dict:
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
                {"type": "text", "text": user_prompt},
            ],
        }
    ]

    raw = call_claude(client, messages, system=system_prompt, max_tokens=1024)
    result = parse_json_response(raw)

    # Enforce the trigger token at the start of the training caption
    caption = result.get("training_caption", "")
    if not caption.startswith(token):
        result["training_caption"] = f"{token}, " + caption
        logger.warning("Added missing trigger token to caption for %s", image_path.name)

    return result


@click.command()
@click.option("--input", "input_dir", required=True,
              help="Folder containing the source technical-diagram images.")
@click.option("--out", "out_dir", default=None,
              help="Where to write .txt sidecars + captions.json. Default: same as --input.")
@click.option("--dry-run", is_flag=True, default=False,
              help="List files that would be processed without calling the API.")
def main(input_dir: str, out_dir: str | None, dry_run: bool) -> None:
    logger = get_logger()
    input_path = Path(input_dir)
    output_path = Path(out_dir) if out_dir else input_path

    if not input_path.exists():
        logger.error("Input folder does not exist: %s", input_path)
        sys.exit(1)

    style = load_style_guide()
    token = trigger_token(style)
    system_prompt, user_prompt = build_prompts(style)
    logger.info("Style: '%s'  |  trigger token: '%s'", style.get("name"), token)

    images = sorted(
        p for p in input_path.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    )
    if not images:
        logger.warning("No supported images found in %s", input_path)
        return

    output_path.mkdir(parents=True, exist_ok=True)
    captions_file = output_path / "captions.json"
    captions = load_captions(captions_file)
    to_process = [img for img in images if not already_processed(img)]

    logger.info("Found %d images, %d already processed, %d to process",
                len(images), len(images) - len(to_process), len(to_process))

    if dry_run:
        click.echo(f"\n[dry-run] Style '{style.get('name')}', token '{token}'")
        click.echo(f"[dry-run] Would process {len(to_process)} image(s) -> {output_path}:")
        for img in to_process:
            click.echo(f"  {img.name}")
        return

    if not to_process:
        logger.info("Nothing to do.")
        return

    client = get_client()
    failed: list[Path] = []

    for img_path in tqdm(to_process, desc="Captioning", unit="img"):
        try:
            result = caption_image(client, img_path, system_prompt, user_prompt, token, logger)
            captions[img_path.name] = result
            write_sidecar(img_path, result["training_caption"], output_path)
            save_captions(captions, captions_file)
            log_processed(img_path)
            logger.info("Captioned: %s  [%s]", img_path.name, result.get("diagram_type", "?"))
        except Exception as exc:
            logger.error("Failed to caption %s: %s", img_path.name, exc)
            failed.append(img_path)

    logger.info("Done. Captioned %d, failed %d. Output -> %s",
                len(to_process) - len(failed), len(failed), output_path)
    if failed:
        logger.warning("Failed files: %s", [p.name for p in failed])


if __name__ == "__main__":
    main()
