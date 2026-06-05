# Models — plug-and-ready

Drop model files into the matching subfolder. The backend scans these folders
(`GET /api/models`, `GET /api/loras`) and exposes them in the generator's chips.
Files here are git-ignored (only this README is tracked).

| Folder         | What goes here                                              |
|----------------|------------------------------------------------------------|
| `checkpoints/` | Base diffusion checkpoints (e.g. `flux1-dev.safetensors`)  |
| `loras/`       | Your trained LoRAs (e.g. `big_style_flux.safetensors`)     |
| `vae/`         | VAE / autoencoder (e.g. `ae.safetensors`)                  |
| `clip/`        | Text encoders (e.g. `clip_l`, `t5xxl_fp16`)               |
| `controlnet/`  | ControlNet models (e.g. FLUX ControlNet Union)             |
| `upscale/`     | Upscaler models                                            |

These mirror the ComfyUI `models/` layout, so you can point ComfyUI at the same
folder (or symlink) when switching `COMFY_MODE=real`.
