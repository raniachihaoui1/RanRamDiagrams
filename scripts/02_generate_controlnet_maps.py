"""
02_generate_controlnet_maps.py — Generate canny, depth, and lineart conditioning maps.

Usage:
    python 02_generate_controlnet_maps.py --input data/rhino_exports/
"""

from __future__ import annotations

import sys
from pathlib import Path

import click
import cv2
import numpy as np
from PIL import Image
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))
from utils import get_logger

REPO_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = REPO_ROOT / "data" / "controlnet_maps"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


# ---------------------------------------------------------------------------
# Map generators
# ---------------------------------------------------------------------------

def generate_canny(gray: np.ndarray) -> np.ndarray:
    return cv2.Canny(gray, 50, 150)


def generate_depth(gray: np.ndarray) -> np.ndarray:
    """Lightweight depth proxy: invert + blur."""
    inverted = cv2.bitwise_not(gray)
    blurred = cv2.GaussianBlur(inverted, (5, 5), 0)
    return blurred


def generate_lineart(gray: np.ndarray) -> np.ndarray:
    """Adaptive threshold + morphological closing for clean architectural lines."""
    thresh = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=11,
        C=2,
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    return closed


# ---------------------------------------------------------------------------
# Per-image processing
# ---------------------------------------------------------------------------

def process_image(img_path: Path, output_dir: Path, logger) -> None:
    stem = img_path.stem

    # Check if all three maps already exist
    targets = {
        "canny": output_dir / f"{stem}_canny.png",
        "depth": output_dir / f"{stem}_depth.png",
        "lineart": output_dir / f"{stem}_lineart.png",
    }
    if all(p.exists() for p in targets.values()):
        logger.debug("Skipping %s — all maps present", img_path.name)
        return

    img_bgr = cv2.imread(str(img_path))
    if img_bgr is None:
        logger.warning("Could not read image: %s", img_path)
        return

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    generators = {
        "canny": generate_canny,
        "depth": generate_depth,
        "lineart": generate_lineart,
    }

    for map_name, generator in generators.items():
        out_path = targets[map_name]
        if out_path.exists():
            continue
        result = generator(gray)
        cv2.imwrite(str(out_path), result)

    logger.info("Maps generated: %s", stem)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

@click.command()
@click.option("--input", "input_dir", default="data/rhino_exports", show_default=True,
              help="Folder containing Rhino export images.")
@click.option("--output", "output_dir", default=None,
              help="Output folder for conditioning maps. Defaults to data/controlnet_maps/.")
def main(input_dir: str, output_dir: str | None) -> None:
    logger = get_logger("02_controlnet_maps")
    input_path = Path(input_dir)
    out_path = Path(output_dir) if output_dir else OUTPUT_DIR
    out_path.mkdir(parents=True, exist_ok=True)

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

    logger.info("Generating conditioning maps for %d image(s) → %s", len(images), out_path)

    for img_path in tqdm(images, desc="Conditioning maps", unit="img"):
        try:
            process_image(img_path, out_path, logger)
        except Exception as exc:
            logger.error("Error processing %s: %s", img_path.name, exc)

    logger.info("Done.")


if __name__ == "__main__":
    main()
