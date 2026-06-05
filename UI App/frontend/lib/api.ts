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
};
