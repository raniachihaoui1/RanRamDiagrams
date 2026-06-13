# ComfyUI workflows (API format)

Drop your Flux 2.0 workflows here, exported from ComfyUI in **API format**:

1. In ComfyUI, enable **Settings → Enable Dev mode options**.
2. Build/open your workflow, then **Save (API Format)**.
3. Save as:
   - `flux_txt2img.json` — text-to-image
   - `flux_img2img.json` — image-to-image (has a LoadImage + denoise)
   - `flux_canvas.json` — (optional) inpaint/blend for the Canvas tool

The backend's `RealComfyClient` (`backend/comfy/real.py`) loads these and injects
runtime params (prompt, seed, width/height, count, negative, LoRA). Each node in
the API JSON is keyed by its id, e.g.
`"6": {"class_type": "CLIPTextEncode", "inputs": {"text": "..."}}`.

## Already wired: `flux_img2img.json`

A FLUX.2 Klein image-to-image workflow ships in this folder and is fully mapped in
`RealComfyClient._inject_params()`. The node ids it drives:

| Node id     | Purpose                                   |
| ----------- | ----------------------------------------- |
| `437`       | positive prompt text                      |
| `434` / `554` | reference image (uploaded) + resize     |
| `760:749`   | seed                                      |
| `760:751` / `760:752` | width / height                  |
| `760:743`   | batch size (image count)                  |
| `760:744`   | negative prompt                           |
| `760:759`   | LoRA (name + strengths)                   |

If you **re-export** this workflow from ComfyUI, the node ids may change — update
the map in `_inject_params()` to match. To add **txt2img**, export a
`flux_txt2img.json` and map it the same way.

Until you go real, keep `COMFY_MODE=mock` in `.env` to run with simulated results.
