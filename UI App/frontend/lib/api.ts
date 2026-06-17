/** Typed client for the FastAPI backend. */
import { API_URL } from "./config";

// ---- Types (mirror backend schemas) --------------------------------------
export interface ImageOut {
  id: string;
  filename: string;
  kind: "generated" | "edited" | "uploaded";
  prompt: string | null;
  negative: string | null;
  model: string | null;
  loras: string[];
  seed: number | null;
  width: number;
  height: number;
  favorite: boolean;
  tags: string[];
  source_image_id: string | null;
  created_at: string;
  url: string;
  thumb_url: string | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  kind: "checkpoint" | "lora";
  builtin: boolean;
  trigger_token: string | null;
}

export interface JobOut {
  id: string;
  status: "queued" | "running" | "done" | "error";
  progress: number;
  result_image_ids: string[];
  error: string | null;
}

export interface GenerateRequest {
  mode: "txt2img" | "img2img";
  prompt: string;
  negative?: string;
  model?: string | null;
  loras?: string[];
  width: number;
  height: number;
  count: number;
  seed?: number | null;
  reference_image_id?: string | null;
  reference_weight?: number;
}

export interface CanvasOut {
  id: string;
  name: string;
  data: CanvasData;
  thumb_url: string | null;
  updated_at: string;
}

// Canvas document model (kept in sync with store/canvas.ts)
export interface CanvasOp {
  kind: "stroke" | "shape" | "stamp";
  tool: string;
  color: string;
  size: number;
  points?: number[];
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  symbolId?: string; // for kind "stamp": which symbol from lib/stamps
}
export interface CanvasLayer {
  id: string;
  name: string;
  visible: boolean;
  ops: CanvasOp[];
}
export interface CanvasData {
  baseImageId: string | null;
  width: number;
  height: number;
  layers: CanvasLayer[];
}

export interface TrainOut {
  id: string;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
}

// ---- Training datasets ----
export interface DatasetImageInfo {
  filename: string;
  caption: string;
}

export interface DatasetOut {
  id: string;
  name: string;
  trigger_token: string;
  description: string;
  status: "draft" | "captioned" | "prepared";
  image_count: number;
  captions: Record<string, string>;
  images: DatasetImageInfo[];
  created_at: string;
}

export interface PrepareResult {
  total: number;
  resized: number;
  missing_captions: string[];
  bad_trigger: string[];
  ready: boolean;
}

// ---- Helpers --------------------------------------------------------------
/** Turn a relative backend path (e.g. ImageOut.url) into an absolute URL. */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- Endpoints ------------------------------------------------------------
export const api = {
  health: () => req<{ status: string; app_name: string; comfy_mode: string }>("/api/health"),

  models: () => req<ModelInfo[]>("/api/models"),
  loras: () => req<ModelInfo[]>("/api/loras"),

  listImages: (params?: { kind?: string; favorite?: boolean; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.kind) q.set("kind", params.kind);
    if (params?.favorite != null) q.set("favorite", String(params.favorite));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return req<ImageOut[]>(`/api/images${qs ? `?${qs}` : ""}`);
  },
  getImage: (id: string) => req<ImageOut>(`/api/images/${id}`),
  patchImage: (id: string, patch: { favorite?: boolean; tags?: string[] }) =>
    req<ImageOut>(`/api/images/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteImage: (id: string) => req<void>(`/api/images/${id}`, { method: "DELETE" }),

  uploadImage: async (file: File): Promise<ImageOut> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/api/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    return res.json();
  },

  generate: (body: GenerateRequest) =>
    req<JobOut>("/api/generate", { method: "POST", body: JSON.stringify(body) }),
  getJob: (id: string) => req<JobOut>(`/api/jobs/${id}`),
  cancelJob: (id: string) => req<JobOut>(`/api/jobs/${id}/cancel`, { method: "POST" }),

  // Canvas projects
  createCanvas: (body: { name: string; data: CanvasData }) =>
    req<CanvasOut>("/api/canvas", { method: "POST", body: JSON.stringify(body) }),
  listCanvas: () => req<CanvasOut[]>("/api/canvas"),
  getCanvas: (id: string) => req<CanvasOut>(`/api/canvas/${id}`),
  updateCanvas: (
    id: string,
    body: { name?: string; data?: CanvasData; thumb_data_url?: string }
  ) => req<CanvasOut>(`/api/canvas/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCanvas: (id: string) => req<void>(`/api/canvas/${id}`, { method: "DELETE" }),

  // Training datasets
  createDataset: (body: { name: string; trigger_token: string; description: string }) =>
    req<DatasetOut>("/api/train/datasets", { method: "POST", body: JSON.stringify(body) }),
  listDatasets: () => req<DatasetOut[]>("/api/train/datasets"),
  getDataset: (id: string) => req<DatasetOut>(`/api/train/datasets/${id}`),
  updateDataset: (id: string, body: { name: string; trigger_token: string; description: string }) =>
    req<DatasetOut>(`/api/train/datasets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteDataset: (id: string) => req<void>(`/api/train/datasets/${id}`, { method: "DELETE" }),

  uploadDatasetImages: async (id: string, files: File[]): Promise<{ saved: string[]; total: number }> => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    const res = await fetch(`${API_URL}/api/train/datasets/${id}/images`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    return res.json();
  },
  deleteDatasetImage: (id: string, filename: string) =>
    req<{ deleted: string }>(`/api/train/datasets/${id}/images/${filename}`, { method: "DELETE" }),
  datasetImageUrl: (id: string, filename: string) =>
    `${API_URL}/api/train/datasets/${id}/images/${encodeURIComponent(filename)}`,

  patchCaption: (id: string, filename: string, caption: string) =>
    req<{ filename: string; caption: string }>(
      `/api/train/datasets/${id}/captions/${encodeURIComponent(filename)}`,
      { method: "PATCH", body: JSON.stringify({ caption }) }
    ),

  prepareDataset: (id: string, resolution: number) =>
    req<PrepareResult>(`/api/train/datasets/${id}/prepare`, {
      method: "POST",
      body: JSON.stringify({ resolution }),
    }),

  // Training runs (scaffold)
  createTraining: (body: { name: string; config: Record<string, unknown> }) =>
    req<TrainOut>("/api/train", { method: "POST", body: JSON.stringify(body) }),
  listTraining: () => req<TrainOut[]>("/api/train"),
};
