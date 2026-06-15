"""Bridge test source — verify the Rhino viewport bridge WITHOUT Rhino.

Streams an animated test pattern to `ws://127.0.0.1:8000/ws/rhino?role=source`
using the SAME wire format as viewport_stream.py (JSON `frame` messages). Open
the app's "Rhino viewport" panel and you should see a moving clock/gradient —
that proves the backend hub + the web viewer work before you wire up real Rhino.

Run it with the backend venv (already has `websockets` + `pillow` — no extra deps):

    UI App> backend/.venv/Scripts/python rhino/test_source.py
    # options:  --url ws://127.0.0.1:8000/ws/rhino?role=source  --fps 6  --seconds 0

`--seconds 0` (default) streams until you press Ctrl-C.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import io
import json
import math
import time

from PIL import Image, ImageDraw

try:
    import websockets
except Exception as exc:  # pragma: no cover
    raise SystemExit(
        "Missing 'websockets' — run with the backend venv:\n"
        "    backend/.venv/Scripts/python rhino/test_source.py\n"
        f"(import error: {exc})"
    )

WIDTH, HEIGHT = 960, 540


def _make_frame(t: float) -> str:
    """Render one test frame → base64 JPEG. Animated so motion is obvious."""
    img = Image.new("RGB", (WIDTH, HEIGHT), (18, 19, 22))
    draw = ImageDraw.Draw(img)

    # Sweeping gradient bar.
    x = int((math.sin(t) * 0.5 + 0.5) * (WIDTH - 160))
    draw.rectangle([x, 0, x + 160, HEIGHT], fill=(40, 42, 48))

    # Rotating "clock" hand to make the cadence visible.
    cx, cy, r = WIDTH // 2, HEIGHT // 2, 160
    ang = t * 1.5
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(120, 122, 130), width=3)
    draw.line(
        [cx, cy, cx + int(r * math.cos(ang)), cy + int(r * math.sin(ang))],
        fill=(235, 236, 240),
        width=5,
    )
    draw.text((24, 20), "BRIDGE TEST SOURCE", fill=(235, 236, 240))
    draw.text((24, HEIGHT - 36), f"t = {t:6.1f}s", fill=(160, 162, 170))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return base64.b64encode(buf.getvalue()).decode("ascii")


async def run(url: str, fps: float, seconds: float) -> None:
    interval = 1.0 / fps if fps > 0 else 0.16
    print(f"[test_source] Connecting to {url} …")
    async with websockets.connect(url) as ws:
        print(f"[test_source] Connected — streaming at {fps} FPS. Ctrl-C to stop.")
        start = time.time()
        while True:
            t = time.time() - start
            await ws.send(
                json.dumps(
                    {
                        "type": "frame",
                        "format": "jpeg",
                        "data": _make_frame(t),
                        "w": WIDTH,
                        "h": HEIGHT,
                        "ts": time.time(),
                    }
                )
            )
            if seconds and t >= seconds:
                print("[test_source] Done.")
                return
            await asyncio.sleep(interval)


def main() -> None:
    p = argparse.ArgumentParser(description="Rhino bridge test source (no Rhino needed).")
    p.add_argument("--url", default="ws://127.0.0.1:8000/ws/rhino?role=source")
    p.add_argument("--fps", type=float, default=6.0)
    p.add_argument("--seconds", type=float, default=0.0, help="0 = run until Ctrl-C")
    args = p.parse_args()
    try:
        asyncio.run(run(args.url, args.fps, args.seconds))
    except KeyboardInterrupt:
        print("\n[test_source] Stopped.")


if __name__ == "__main__":
    main()
