"""Mock ComfyUI client — simulates a generation run and renders placeholder
images, so the entire UI flow works end-to-end without a GPU or ComfyUI.

Placeholders are intentionally on-brand: monochrome gradient "diagram cards"
with a faint grid, the model/seed, and the prompt text.
"""

from __future__ import annotations

import asyncio
import io
import random
import textwrap

from PIL import Image, ImageDraw, ImageFont

from comfy.base import ComfyClient, GenParams, ProgressCallback

_STEPS = 24


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("arial.ttf", "DejaVuSans.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _render_placeholder(params: GenParams, index: int, seed: int) -> bytes:
    w, h = params.width, params.height
    rng = random.Random(seed + index)

    # Monochrome vertical gradient (seed-driven base luminance)
    base = rng.randint(18, 46)
    top = base + rng.randint(6, 22)
    bottom = max(8, base - rng.randint(2, 14))
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        v = int(top * (1 - t) + bottom * t)
        for x in range(w):
            px[x, y] = (v, v, v + 1)

    draw = ImageDraw.Draw(img)

    # Faint grid
    grid = max(48, w // 12)
    line = (255, 255, 255, 8)
    for x in range(0, w, grid):
        draw.line([(x, 0), (x, h)], fill=(v + 10, v + 10, v + 12), width=1)
    for y in range(0, h, grid):
        draw.line([(0, y), (w, y)], fill=(v + 8, v + 8, v + 10), width=1)

    # Center mark
    cx, cy = w // 2, h // 2
    r = min(w, h) // 6
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(235, 235, 235), width=3)
    draw.line([(cx - r, cy), (cx + r, cy)], fill=(235, 235, 235), width=2)
    draw.line([(cx, cy - r), (cx, cy + r)], fill=(235, 235, 235), width=2)

    # Labels
    f_small = _font(max(14, w // 48))
    f_tag = _font(max(12, w // 64))
    model = params.model or "Flux 2.0"
    draw.text((24, 20), f"{model}", fill=(245, 245, 245), font=f_small)
    draw.text((24, 20 + (w // 40)), f"seed {seed + index} · {w}x{h} · #{index + 1}",
              fill=(170, 170, 175), font=f_tag)
    if params.mode == "img2img":
        draw.text((24, 20 + 2 * (w // 40)), f"img2img · weight {params.reference_weight:.2f}",
                  fill=(170, 170, 175), font=f_tag)

    # Prompt at bottom
    prompt = (params.prompt or "untitled").strip()
    wrapped = textwrap.fill(prompt, width=max(20, w // 14))[:240]
    lines = wrapped.split("\n")[:4]
    y = h - 28 - len(lines) * (w // 44)
    for ln in lines:
        draw.text((24, y), ln, fill=(225, 225, 228), font=f_tag)
        y += w // 44

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class MockComfyClient(ComfyClient):
    name = "mock"

    async def generate(
        self, params: GenParams, on_progress: ProgressCallback
    ) -> list[bytes]:
        seed = params.seed if params.seed is not None else random.randint(0, 2**31 - 1)

        await on_progress(0.0, "queued")
        for step in range(1, _STEPS + 1):
            await asyncio.sleep(0.07)
            await on_progress(step / _STEPS, "running")

        # Render off the event loop (PIL is CPU-bound)
        images = await asyncio.to_thread(
            lambda: [_render_placeholder(params, i, seed) for i in range(params.count)]
        )
        await on_progress(1.0, "done")
        return images
