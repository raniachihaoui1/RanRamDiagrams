# ComfyUI workflows (API format)

Drop your Flux 2.0 workflows here, exported from ComfyUI in **API format**:

1. In ComfyUI, enable **Settings → Enable Dev mode options**.
2. Build/open your workflow, then **Save (API Format)**.
3. Save as:
   - `flux_txt2img.json` — text-to-image
   - `flux_img2img.json` — image-to-image (has a LoadImage + denoise)
   - `flux_canvas.json` — (optional) inpaint/blend for the Canvas tool

The backend's `RealComfyClient` (`backend/comfy/real.py`) loads these and injects
runtime params (prompt, seed, width/height, model, LoRAs). After exporting, map
the relevant **node ids** in `RealComfyClient._inject_params()` — each node in the
API JSON is keyed by its id, e.g. `"6": {"class_type": "CLIPTextEncode", "inputs": {"text": "..."}}`.

Until these exist, keep `COMFY_MODE=mock` in `.env` to run with simulated results.
