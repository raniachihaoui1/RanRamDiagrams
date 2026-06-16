"use client";

import * as React from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useStoryStore } from "@/store/storyline";
import { StoryCellCard } from "./StoryCellCard";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;
const OUTER_PAD = 48; // breathing room around the board inside the scroll area

export function StoryGrid({
  onPickImage,
}: {
  onPickImage: (index: number) => void;
}) {
  const { cols, rows, cellW, cellH, captionH, gap, padding, outerBg, selectCell } =
    useStoryStore();

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const [zoom, setZoom] = React.useState(1);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const zoomIn = () =>
    setZoom((z) => Math.min(MAX_ZOOM, parseFloat((z + ZOOM_STEP).toFixed(2))));
  const zoomOut = () =>
    setZoom((z) => Math.max(MIN_ZOOM, parseFloat((z - ZOOM_STEP).toFixed(2))));

  // Non-passive wheel listener so we can preventDefault on Ctrl+scroll.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((z) =>
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parseFloat((z + delta).toFixed(2))))
      );
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Re-center scroll position after each zoom change.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoom]);

  // ── Board natural dimensions (mirror the export math) ─────────────────────
  const boardW = padding * 2 + cols * cellW + (cols - 1) * gap;
  const boardH = padding * 2 + rows * (cellH + captionH) + (rows - 1) * gap;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Scrollable viewport — click outside the board to deselect */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        onClick={() => selectCell(null)}
      >
        {/* Centering wrapper with breathing room */}
        <div
          className="flex min-h-full min-w-full items-center justify-center"
          style={{ padding: OUTER_PAD }}
        >
          {/*
           * Sizer: takes the correct scaled space in the layout flow so
           * the scrollbar expands properly when zoom > 1.
           * The board is absolutely positioned inside, scaled from top-left.
           */}
          <div
            style={{
              position: "relative",
              width: boardW * zoom,
              height: boardH * zoom,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: boardW,
                height: boardH,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
              // Prevent click-to-deselect from firing when clicking inside the board
              onClick={(e) => e.stopPropagation()}
            >
              {/* Board — matches exact export layout */}
              <div
                style={{
                  background: outerBg,
                  padding,
                  width: boardW,
                  height: boardH,
                  boxShadow: "0 4px 32px rgba(0,0,0,0.18)",
                  borderRadius: 4,
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
                    gridTemplateRows: `repeat(${rows}, ${cellH + captionH}px)`,
                    gap,
                  }}
                >
                  {Array.from({ length: cols * rows }, (_, i) => (
                    <StoryCellCard key={i} index={i} onPickImage={onPickImage} />
                  ))}
                </div>
              </div>

              {/* Dimension hint — lives just below the board, inside the sizer */}
              <p
                className="mt-3 text-center text-xs text-faint"
                style={{ width: boardW }}
              >
                {boardW} × {boardH} px · {cols} col{cols !== 1 ? "s" : ""} ×{" "}
                {rows} row{rows !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Zoom HUD — floats over the viewport, never scrolls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border bg-surface-2/90 p-1 shadow-md backdrop-blur-xl">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            title="Zoom out (Ctrl + scroll)"
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground",
              zoom <= MIN_ZOOM && "opacity-30"
            )}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => setZoom(1)}
            title="Reset to 100%"
            className="min-w-[3.5rem] rounded-md px-2 py-1 text-center text-xs tabular-nums text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            title="Zoom in (Ctrl + scroll)"
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground",
              zoom >= MAX_ZOOM && "opacity-30"
            )}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
