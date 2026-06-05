"use client";

import * as React from "react";
import { Box, Loader2, Camera } from "lucide-react";
import { WS_URL } from "@/lib/config";
import { Button } from "@/components/ui/Button";

type Status = "connecting" | "waiting" | "streaming";

/**
 * Live viewer for the Rhino viewport bridge (prepare-only). Connects as a
 * `viewer`; shows frames once a Rhino `source` starts streaming. Until then it
 * explains how to start the bridge.
 */
export function RhinoLiveView({ onCapture }: { onCapture?: (file: File) => void }) {
  const [status, setStatus] = React.useState<Status>("connecting");
  const [src, setSrc] = React.useState<string | null>(null);
  const lastBlobUrl = React.useRef<string | null>(null);

  React.useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/rhino?role=viewer`);
    ws.binaryType = "blob";
    ws.onopen = () => setStatus("waiting");
    ws.onmessage = (e) => {
      setStatus("streaming");
      if (typeof e.data === "string") {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "frame" && msg.data) {
            setSrc(`data:image/${msg.format ?? "jpeg"};base64,${msg.data}`);
          }
        } catch {
          /* ignore */
        }
      } else {
        const url = URL.createObjectURL(e.data as Blob);
        if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current);
        lastBlobUrl.current = url;
        setSrc(url);
      }
    };
    ws.onerror = () => setStatus("connecting");
    return () => {
      ws.close();
      if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current);
    };
  }, []);

  const capture = async () => {
    if (!src || !onCapture) return;
    const blob = await (await fetch(src)).blob();
    onCapture(new File([blob], "rhino-capture.png", { type: blob.type || "image/png" }));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative grid aspect-video place-items-center overflow-hidden rounded-lg border border-border bg-base">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Rhino viewport" className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center text-muted">
            {status === "connecting" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Box className="h-6 w-6" />
            )}
            <p className="text-sm">
              {status === "connecting" ? "Connecting to bridge…" : "Waiting for Rhino…"}
            </p>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-pill bg-black/50 px-2 py-0.5 text-[11px] text-white">
          {status}
        </span>
      </div>

      {src ? (
        <Button variant="primary" size="sm" className="justify-center gap-1.5" onClick={capture}>
          <Camera className="h-4 w-4" /> Use frame as reference
        </Button>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-3 text-xs leading-relaxed text-faint">
          Start the bridge from Rhino: run{" "}
          <code className="text-muted">rhino/viewport_stream.py</code> inside Rhino
          (see <code className="text-muted">rhino/PROTOCOL.md</code>). Frames will
          appear here live.
        </p>
      )}
    </div>
  );
}
