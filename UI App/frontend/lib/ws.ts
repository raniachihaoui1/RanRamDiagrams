import { WS_URL } from "./config";
import type { ImageOut } from "./api";

export interface JobSocketHandlers {
  onProgress?: (progress: number, status: string) => void;
  onDone?: (images: ImageOut[], ids: string[]) => void;
  onError?: (message: string) => void;
}

/** Open a WebSocket to stream a generation job's progress. Returns the socket. */
export function openJobSocket(jobId: string, handlers: JobSocketHandlers): WebSocket {
  const ws = new WebSocket(`${WS_URL}/ws/jobs/${jobId}`);

  ws.onmessage = (e) => {
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(e.data);
    } catch {
      return;
    }
    const type = ev.type as string;
    if (type === "progress" || type === "snapshot") {
      handlers.onProgress?.((ev.progress as number) ?? 0, (ev.status as string) ?? "running");
    } else if (type === "done") {
      handlers.onDone?.(
        (ev.images as ImageOut[]) ?? [],
        (ev.result_image_ids as string[]) ?? []
      );
      ws.close();
    } else if (type === "error") {
      handlers.onError?.((ev.error as string) ?? "generation failed");
      ws.close();
    }
  };

  ws.onerror = () => handlers.onError?.("connection error");
  return ws;
}
