"use client";

import * as React from "react";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Drag the vertical divider left/right to reveal the "before" (left)
 * and "after" (right) images. Both images fill the container via object-cover.
 */
export function BeforeAfterSlider({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
  className,
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  const [pos, setPos] = React.useState(0.5);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  const clamp = (v: number) => Math.max(0.02, Math.min(0.98, v));

  const move = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(clamp((clientX - rect.left) / rect.width));
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative select-none overflow-hidden", className)}
      style={{ cursor: "col-resize" }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerLeave={() => { dragging.current = false; }}
    >
      {/* After — full base layer (right side) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={after}
        draggable={false}
        alt={afterLabel}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Before — clipped to the left of the divider */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${(1 - pos) * 100}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          draggable={false}
          alt={beforeLabel}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/* Divider line */}
      <div
        className="pointer-events-none absolute inset-y-0 w-[2px] bg-white shadow-[0_0_10px_rgba(0,0,0,0.6)]"
        style={{ left: `calc(${pos * 100}% - 1px)` }}
      >
        {/* Drag handle */}
        <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-black/10">
          <ChevronsLeftRight className="h-4 w-4 text-black/60" />
        </div>
      </div>

      {/* Labels — bottom corners to avoid overlap with action buttons at the top */}
      <span className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
        {afterLabel}
      </span>
    </div>
  );
}
