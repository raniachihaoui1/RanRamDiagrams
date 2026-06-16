/**
 * Per-family LoRA configuration (single source of truth for the generator).
 *
 * Keyed by the family **base name** as it currently appears in the LoRA chip
 * (i.e. the filename stem with the trailing epoch/step suffix removed — see
 * `parseName` in `components/generate/LoraPicker.tsx`). For each family:
 *   - `display`     — the label shown in the chip dropdown.
 *   - `keyword`     — a hidden trigger token that is prepended to the prompt
 *                     sent to ComfyUI but never shown in the prompt box.
 *   - `defaultStep` — which variant (by numeric step) is pre-selected.
 *   - `hidden`      — when true, the family is omitted from the picker entirely.
 */
export interface LoraFamily {
  display?: string;
  keyword?: string;
  defaultStep?: number;
  hidden?: boolean;
}

export const LORA_FAMILIES: Record<string, LoraFamily> = {
  technical_drawing: { display: "constructive", keyword: "technical_drawing", defaultStep: 1250 },
  "ranram_arch_diagrams_v2.0": { display: "conceptual", keyword: "ranram_arch_diagram", defaultStep: 1000 },
  "ranram_arch_diagrams_v3.0": { display: "linework", keyword: "technical_drawing", defaultStep: 1250 },
  // Hidden from the picker: under-trained LoRA, non-LoRA files, accelerators.
  arctic_modern: { hidden: true },
  big_ran_ram: { hidden: true },
  optimizer: { hidden: true },
  sdxl_lightning_8step_lora: { hidden: true },
};

export const loraFamily = (base: string): LoraFamily => LORA_FAMILIES[base] ?? {};

/**
 * Describe a saved LoRA id (the full ComfyUI name, e.g.
 * `folder\ranram_arch_diagrams_v2.0_000001000.safetensors`) as its display
 * label + selected step number, for showing in image metadata.
 */
export function describeLora(id: string): { label: string; step: number | null } {
  const stem = (id.split(/[\\/]/).pop() ?? id).replace(/\.[^.]+$/, "");
  const m = stem.match(/^(.*?)[-_\s]+((?:v|ver|version|step|epoch|e)?\s*\d+)$/i);
  let base = stem;
  let step: number | null = null;
  if (m && m[1].trim()) {
    const num = parseInt(m[2].replace(/\D/g, ""), 10);
    if (!Number.isNaN(num)) {
      base = m[1].trim();
      step = num;
    }
  }
  return { label: loraFamily(base).display ?? base, step };
}
