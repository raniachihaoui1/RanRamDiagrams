"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { mediaUrl, type ImageOut } from "@/lib/api";

/**
 * Playful "discs on a shelf" browser: a 3D coverflow on a light paper
 * background. The centred disc faces you; siblings tuck back like records.
 */
export function CuteLibrary({
  images,
  onOpen,
}: {
  images: ImageOut[];
  onOpen: (img: ImageOut) => void;
}) {
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, images.length - 1)));
  }, [images.length]);

  const go = React.useCallback(
    (dir: number) =>
      setActive((a) => Math.min(images.length - 1, Math.max(0, a + dir))),
    [images.length]
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

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
      className="relative flex h-full flex-col overflow-hidden rounded-xl bg-paper"
      onWheel={(e) => {
        if (Math.abs(e.deltaY) > 8 || Math.abs(e.deltaX) > 8)
          go(e.deltaY + e.deltaX > 0 ? 1 : -1);
      }}
    >
      {/* Stage — takes all available space, centres the coverflow inside */}
      <div
        className="relative flex flex-1 items-center justify-center"
        style={{ perspective: "1400px" }}
      >
        {images.map((img, i) => {
          const offset = i - active;
          const abs = Math.abs(offset);
          const visible = abs <= 6;
          const rotateY = offset === 0 ? 0 : offset < 0 ? 44 : -44;
          const translateX = offset * 140;
          const translateZ = offset === 0 ? 80 : -abs * 40;
          const scale = offset === 0 ? 1 : 0.82;
          return (
            <button
              key={img.id}
              onClick={() => (offset === 0 ? onOpen(img) : setActive(i))}
              className="absolute h-64 w-64 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl transition-all duration-500 ease-out sm:h-80 sm:w-80"
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

      {/* Caption + controls — fixed height at the bottom */}
      <div className="flex shrink-0 flex-col items-center gap-3 pb-6 pt-4 text-paper-ink">
        <p className="line-clamp-1 max-w-md text-center text-sm text-paper-ink/70">
          {activeImg.prompt || activeImg.filename}
        </p>
        <div className="flex items-center gap-4">
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
        </div>
      </div>
    </div>
  );
}
