import { create } from "zustand";
import { api, type GenerateRequest, type ImageOut } from "@/lib/api";
import { openJobSocket } from "@/lib/ws";

export interface AspectPreset {
  id: string;
  label: string;
  w: number;
  h: number;
}

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
  status: "running" | "done" | "error";
  progress: number;
  images: ImageOut[];
  error?: string;
}

interface GeneratorState {
  // settings
  prompt: string;
  negative: string;
  model: string | null;
  loras: string[];
  aspect: string;
  count: number;
  seed: number | null;
  mode: "txt2img" | "img2img";
  referenceImage: ImageOut | null;
  referenceWeight: number;

  // feed
  generations: Generation[];

  patch: (p: Partial<GeneratorState>) => void;
  toggleLora: (id: string) => void;
  setReference: (img: ImageOut | null) => void;
  submit: (afterDone?: () => void) => Promise<void>;
}

export const useGeneratorStore = create<GeneratorState>((set, get) => ({
  prompt: "",
  negative: "",
  model: null,
  loras: [],
  aspect: "1:1",
  count: 1,
  seed: null,
  mode: "txt2img",
  referenceImage: null,
  referenceWeight: 0.5,
  generations: [],

  patch: (p) => set(p),

  toggleLora: (id) =>
    set((s) => ({
      loras: s.loras.includes(id) ? s.loras.filter((x) => x !== id) : [...s.loras, id],
    })),

  setReference: (img) =>
    set({ referenceImage: img, mode: img ? "img2img" : "txt2img" }),

  submit: async (afterDone) => {
    const s = get();
    if (!s.prompt.trim() && s.mode === "txt2img") return;
    const aspect = ASPECTS.find((a) => a.id === s.aspect) ?? ASPECTS[0];

    const req: GenerateRequest = {
      mode: s.mode,
      prompt: s.prompt,
      negative: s.negative,
      model: s.model,
      loras: s.loras,
      width: aspect.w,
      height: aspect.h,
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
    };
    set((st) => ({ generations: [gen, ...st.generations] }));

    const update = (patch: Partial<Generation>) =>
      set((st) => ({
        generations: st.generations.map((g) => (g.id === job!.id ? { ...g, ...patch } : g)),
      }));

    openJobSocket(job.id, {
      onProgress: (progress, status) =>
        update({ progress, status: status === "done" ? "running" : "running" }),
      onDone: (images) => {
        update({ images, status: "done", progress: 1 });
        afterDone?.();
      },
      onError: (message) => update({ status: "error", error: message }),
    });
  },
}));
