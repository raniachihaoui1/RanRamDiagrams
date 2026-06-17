"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { mediaUrl, type ImageOut } from "@/lib/api";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.15;

/**
 * Playful "discs on a shelf" browser: a 3D coverflow on a light paper
 * background. The centred disc faces you; siblings tuck back like records.
 */
export function CuteLibrary({
  images,
  onOpen,
  compact = false,
}: {
  images: ImageOut[];
  onOpen: (img: ImageOut) => void;
  /** Smaller discs/spacing for embedding in a panel (e.g. the dashboard). */
  compact?: boolean;
}) {
  // Compact (dashboard widget) starts centred so the coverflow looks balanced;
  // full view starts at the most-recent image.
  const [active, setActive] = React.useState(() =>
    compact ? Math.floor(images.length / 2) : 0
  );
  const [zoom, setZoom] = React.useState(1);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, images.length - 1)));
  }, [images.length]);

  const go = React.useCallback(
    (dir: number) =>
      setActive((a) => {
        const n = images.length;
        if (n === 0) return 0;
        // Compact carousel wraps around infinitely; full view clamps at the ends.
        if (compact) return (a + dir + n) % n;
        return Math.min(n - 1, Math.max(0, a + dir));
      }),
    [images.length, compact]
  );

  const zoomIn = React.useCallback(
    () =>
      setZoom((z) =>
        Math.min(MAX_ZOOM, parseFloat((z + ZOOM_STEP).toFixed(2)))
      ),
    []
  );
  const zoomOut = React.useCallback(
    () =>
      setZoom((z) =>
        Math.max(MIN_ZOOM, parseFloat((z - ZOOM_STEP).toFixed(2)))
      ),
    []
  );

  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Compact mode auto-advances as a smooth infinite carousel (pauses on hover).
  React.useEffect(() => {
    if (!compact || paused || images.length <= 1) return;
    const id = setInterval(() => go(-1), 2600);
    return () => clearInterval(id);
  }, [compact, paused, images.length, go]);

  // Non-passive wheel listener so we can preventDefault on Ctrl+scroll zoom
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else zoomOut();
      } else if (Math.abs(e.deltaY) > 8 || Math.abs(e.deltaX) > 8) {
        go(e.deltaY + e.deltaX > 0 ? 1 : -1);
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [go, zoomIn, zoomOut]);

  if (images.length === 0) {
    return (
      <div className="grid h-full place-items-center rounded-xl bg-paper text-paper-ink/60">
        Nothing here yet.
      </div>
    );
  }

  const activeImg = images[active];

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative flex h-full flex-col overflow-hidden rounded-xl bg-paper"
    >
      {/* Stage — takes all available space, centres the coverflow inside */}
      <div
        className="relative flex flex-1 items-center justify-center"
        style={{
          perspective: compact ? "1700px" : "2450px",
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        {images.map((img, i) => {
          let offset = i - active;
          if (compact) {
            // Wrap to the shortest direction so discs form an endless ring.
            const n = images.length;
            if (offset > n / 2) offset -= n;
            else if (offset < -n / 2) offset += n;
          }
          const abs = Math.abs(offset);
          const visible = abs <= 6;
          const rotateY = offset === 0 ? 0 : offset < 0 ? 44 : -44;
          const translateX = offset * (compact ? 150 : 245);
          const translateZ =
            offset === 0 ? (compact ? 80 : 140) : -abs * (compact ? 44 : 70);
          const scale = offset === 0 ? 1 : 0.82;
          return (
            <button
              key={img.id}
              onClick={() => (offset === 0 ? onOpen(img) : setActive(i))}
              className={
                compact
                  ? "absolute h-[15rem] w-[15rem] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl transition-all duration-500 ease-out sm:h-[17rem] sm:w-[17rem]"
                  : "absolute h-[28rem] w-[28rem] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl transition-all duration-500 ease-out sm:h-[35rem] sm:w-[35rem]"
              }
              style={{
                transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                zIndex: 100 - abs,
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(img.thumb_url || img.url)}
                alt={img.prompt ?? "image"}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </button>
          );
        })}
      </div>

      {/* Caption + controls — fixed height at the bottom (hidden in compact) */}
      {!compact && (
      <div className="flex shrink-0 flex-col items-center gap-3 pb-6 pt-4 text-paper-ink">
        <p className="line-clamp-1 max-w-md text-center text-sm text-paper-ink/70">
          {activeImg.prompt || activeImg.filename}
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            title="Zoom out (Ctrl + scroll)"
            className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-md transition hover:bg-paper-ink hover:text-white disabled:opacity-30"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            onClick={() => go(-1)}
            disabled={active === 0}
            className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-md transition hover:bg-paper-ink hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xs tabular-nums text-paper-ink/60">
            {active + 1} / {images.length}
          </span>
          <button
            onClick={() => go(1)}
            disabled={active === images.length - 1}
            className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-md transition hover:bg-paper-ink hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            title="Zoom in (Ctrl + scroll)"
            className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-md transition hover:bg-paper-ink hover:text-white disabled:opacity-30"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
