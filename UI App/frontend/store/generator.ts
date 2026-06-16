import { create } from "zustand";
import { api, type GenerateRequest, type ImageOut } from "@/lib/api";
import { openJobSocket } from "@/lib/ws";

export interface AspectPreset {
  id: string;
  label: string;
  w: number;
  h: number;
}

/** FLUX latents need dimensions that are multiples of 16. */
const roundTo16 = (n: number) => Math.max(16, Math.round(n / 16) * 16);

export const ASPECTS: AspectPreset[] = [
  { id: "1:1", label: "1:1", w: 1024, h: 1024 },
  { id: "3:2", label: "3:2", w: 1216, h: 832 },
  { id: "2:3", label: "2:3", w: 832, h: 1216 },
  { id: "16:9", label: "16:9", w: 1344, h: 768 },
  { id: "9:16", label: "9:16", w: 768, h: 1344 },
];

export interface Generation {
  id: string;
  prompt: string;
  mode: "txt2img" | "img2img";
  count: number;
  status: "running" | "done" | "error" | "canceled";
  progress: number;
  images: ImageOut[];
  error?: string;
  width: number;
  height: number;
}

/** Open job sockets, keyed by generation id, so a job can be cancelled/closed. */
const jobSockets = new Map<string, WebSocket>();

interface GeneratorState {
  // settings
  prompt: string;
  negative: string;
  model: string | null;
  loras: string[];
  /** id → hidden trigger keyword (prepended to the ComfyUI prompt, never shown). */
  loraTriggers: Record<string, string>;
  aspect: string;
  count: number;
  seed: number | null;
  mode: "txt2img" | "img2img";
  referenceImage: ImageOut | null;
  referenceWeight: number;

  // feed
  generations: Generation[];

  patch: (p: Partial<GeneratorState>) => void;
  setReference: (img: ImageOut | null) => void;
  submit: (afterDone?: () => void) => Promise<void>;
  cancel: (id: string) => Promise<void>;
}

export const useGeneratorStore = create<GeneratorState>((set, get) => ({
  prompt: "",
  negative: "",
  model: null,
  loras: [],
  loraTriggers: {},
  aspect: "1:1",
  count: 1,
  seed: null,
  mode: "txt2img",
  referenceImage: null,
  referenceWeight: 0.5,
  generations: [],

  patch: (p) => set(p),

  setReference: (img) =>
    set({
      referenceImage: img,
      mode: img ? "img2img" : "txt2img",
      // Match the output to the input image; fall back to 1:1 when cleared.
      aspect: img ? "custom" : "1:1",
    }),

  submit: async (afterDone) => {
    const s = get();
    if (!s.prompt.trim() && s.mode === "txt2img") return;

    // Custom size: mirror the reference image's dimensions (FLUX needs
    // multiples of 16). Otherwise use the chosen aspect preset.
    let width: number;
    let height: number;
    if (s.aspect === "custom" && s.referenceImage) {
      width = roundTo16(s.referenceImage.width);
      height = roundTo16(s.referenceImage.height);
    } else {
      const aspect = ASPECTS.find((a) => a.id === s.aspect) ?? ASPECTS[0];
      width = aspect.w;
      height = aspect.h;
    }

    // Prepend each selected LoRA's hidden trigger keyword to the prompt sent to
    // ComfyUI. These never appear in the prompt box or the generation feed —
    // only `s.prompt` (clean) is shown; `effectivePrompt` is what's generated.
    const triggers = [
      ...new Set(s.loras.map((id) => s.loraTriggers[id]).filter(Boolean)),
    ];
    // Each keyword is emitted as "keyword, " (trailing comma + space), so the
    // user prompt continues after them, e.g. "arctic_modern, <prompt>".
    const prefix = triggers.map((t) => `${t}, `).join("");
    const effectivePrompt = `${prefix}${s.prompt.trim()}`;

    const req: GenerateRequest = {
      mode: s.mode,
      prompt: effectivePrompt,
      negative: s.negative,
      model: s.model,
      loras: s.loras,
      width,
      height,
      count: s.count,
      seed: s.seed,
      reference_image_id: s.mode === "img2img" ? s.referenceImage?.id ?? null : null,
      reference_weight: s.referenceWeight,
    };

    let job;
    try {
      job = await api.generate(req);
    } catch (e) {
      set((st) => ({
        generations: [
          {
            id: `err-${Date.now()}`,
            prompt: s.prompt,
            mode: s.mode,
            count: s.count,
            status: "error",
            progress: 0,
            images: [],
            error: e instanceof Error ? e.message : "request failed",
            width,
            height,
          },
          ...st.generations,
        ],
      }));
      return;
    }

    const gen: Generation = {
      id: job.id,
      prompt: s.prompt,
      mode: s.mode,
      count: s.count,
      status: "running",
      progress: 0,
      images: [],
      width,
      height,
    };
    set((st) => ({ generations: [gen, ...st.generations] }));

    const update = (patch: Partial<Generation>) =>
      set((st) => ({
        generations: st.generations.map((g) => (g.id === job!.id ? { ...g, ...patch } : g)),
      }));

    const socket = openJobSocket(job.id, {
      onProgress: (progress) => update({ progress, status: "running" }),
      onDone: (images) => {
        jobSockets.delete(job!.id);
        update({ images, status: "done", progress: 1 });
        afterDone?.();
      },
      onError: (message) => {
        jobSockets.delete(job!.id);
        update({ status: "error", error: message });
      },
      onCanceled: () => {
        jobSockets.delete(job!.id);
        update({ status: "canceled" });
      },
    });
    jobSockets.set(job.id, socket);
  },

  cancel: async (id) => {
    // Optimistically reflect the cancel; the WS "canceled" event confirms it.
    set((st) => ({
      generations: st.generations.map((g) =>
        g.id === id && g.status === "running" ? { ...g, status: "canceled" } : g
      ),
    }));
    jobSockets.get(id)?.close();
    jobSockets.delete(id);
    try {
      await api.cancelJob(id);
    } catch {
      // The job may have already finished server-side; the feed is already updated.
    }
  },
}));
