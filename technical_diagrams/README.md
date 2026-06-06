# technical_diagrams — Ranram fine-line captioning tool

Self-contained tool that generates LoRA training captions (`.txt` sidecars) for the
**Ranram fine-line monochrome technical-diagram** style. It does **not** depend on the
repo-level `scripts/` pipeline — everything it needs is in this folder.

## Files

| File | Role |
|------|------|
| `style_guide.json` | **Single source of truth** for the visual style. The prompt is built from this — edit it and the captions change. |
| `caption_images.py` | Main script. Sends each image to Claude vision, writes a `.txt` per image + a `captions.json`. |
| `utils.py` | Anthropic client, logging, idempotency, image/JSON helpers (self-contained copy). |
| `requirements.txt` | `anthropic`, `click`, `tqdm`. |
| `captioning.log` | Created on first run. Holds `PROCESSED` markers — **deleting it makes the script re-caption everything.** |

## Run it (PowerShell)

```powershell
pip install -r requirements.txt
$env:ANTHROPIC_API_KEY = "sk-ant-..."          # required

# 1) Preview without spending API calls
python caption_images.py --input "H:\.shortcut-targets-by-id\1DgQY7ENeiLRMaX8KnYHW_aivJpJyEi-W\GenAi_RaniaRamón\FineTuning\dataset_Ranram_diagram\Style02" --dry-run

# 2) Real run — writes .txt sidecars next to the images
python caption_images.py --input "H:\.shortcut-targets-by-id\1DgQY7ENeiLRMaX8KnYHW_aivJpJyEi-W\GenAi_RaniaRamón\FineTuning\dataset_Ranram_diagram\Style02"
```

By default the `.txt` files and `captions.json` are written **into the input folder**
(next to each image), which is exactly where you said the descriptions should live.
Use `--out <folder>` to send them somewhere else instead.

## What you get

- `01.txt`, `02.txt`, … — one training caption per image. Each begins with the trigger
  token **`technical_drawing`** (taken from `style_guide.json`), followed by a dense,
  comma-separated description of palette / diagram type / figures / textures / annotation.
- `captions.json` — the full structured analysis per image (`diagram_type`, `palette`,
  `line_style`, `typography`, `figures`, `vegetation`, `textures`, `layout`,
  `unique_conventions`, `training_caption`).

## Notes

- **Idempotent:** re-running skips images already recorded in `captioning.log`, and saves
  progress image-by-image, so an interrupted run loses nothing.
- **Tune the style:** to adjust how images are described, edit `style_guide.json`
  (`signature_elements`, `prompt_building.*`, `diagram_types`) — no code changes needed.
- **Trigger token** lives in `style_guide.json → prompt_building.required_tokens[0]`.
  Keep it identical to the token used when training the LoRA.
