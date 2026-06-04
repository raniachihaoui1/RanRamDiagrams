"""Shared utilities for the BIG LoRA training pipeline."""

from __future__ import annotations

import base64
import json
import logging
import re
import time
from pathlib import Path
from typing import Any

import anthropic

LOG_FILE = Path(__file__).parent.parent / "pipeline.log"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

_file_handler: logging.FileHandler | None = None


def get_logger(name: str = "pipeline") -> logging.Logger:
    global _file_handler
    logger = logging.getLogger(name)
    if not logger.handlers:
        fmt = logging.Formatter("%(asctime)s  %(levelname)-8s  %(name)s  %(message)s")
        ch = logging.StreamHandler()
        ch.setFormatter(fmt)
        logger.addHandler(ch)
        if _file_handler is None:
            _file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
            _file_handler.setFormatter(fmt)
        logger.addHandler(_file_handler)
        logger.setLevel(logging.INFO)
    return logger


def log_processed(path: Path) -> None:
    """Append a processed-file marker to pipeline.log."""
    with LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(f"PROCESSED {path.resolve()}\n")


def already_processed(path: Path) -> bool:
    """Return True if this file has a PROCESSED entry in pipeline.log."""
    if not LOG_FILE.exists():
        return False
    marker = f"PROCESSED {path.resolve()}"
    with LOG_FILE.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip() == marker:
                return True
    return False


# ---------------------------------------------------------------------------
# Anthropic client
# ---------------------------------------------------------------------------

def get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env


def call_claude(
    client: anthropic.Anthropic,
    messages: list[dict[str, Any]],
    system: str,
    model: str = "claude-opus-4-6",
    max_tokens: int = 1024,
    retries: int = 3,
) -> str:
    """Call Claude with exponential backoff retry logic."""
    logger = get_logger()
    delay = 1.0
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            )
            return response.content[0].text
        except anthropic.RateLimitError as exc:
            last_exc = exc
            logger.warning("Rate limit hit (attempt %d/%d), sleeping %.0fs", attempt + 1, retries, delay)
        except anthropic.APIStatusError as exc:
            last_exc = exc
            logger.warning("API error %s (attempt %d/%d), sleeping %.0fs", exc.status_code, attempt + 1, retries, delay)
        except anthropic.APIConnectionError as exc:
            last_exc = exc
            logger.warning("Connection error (attempt %d/%d), sleeping %.0fs", attempt + 1, retries, delay)
        time.sleep(delay)
        delay *= 2
    raise RuntimeError(f"Claude call failed after {retries} retries") from last_exc


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def encode_image_b64(path: Path) -> str:
    """Return base64-encoded image data for the given file."""
    with path.open("rb") as fh:
        return base64.standard_b64encode(fh.read()).decode("utf-8")


def image_media_type(path: Path) -> str:
    suffix = path.suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }.get(suffix, "image/png")


# ---------------------------------------------------------------------------
# JSON parsing
# ---------------------------------------------------------------------------

def parse_json_response(text: str) -> Any:
    """Strip markdown fences, then parse JSON. Raises ValueError on failure."""
    # Remove ```json ... ``` or ``` ... ``` fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse JSON from response: {exc}\nRaw text:\n{text}") from exc
