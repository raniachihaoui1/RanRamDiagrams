"use client";

import { mediaUrl, type ImageOut } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ImageGrid({
  images,
  onSelect,
  className,
}: {
  images: ImageOut[];
  onSelect?: (img: ImageOut) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        className
      )}
    >
      {images.map((img) => (
        <button
          key={img.id}
          onClick={() => onSelect?.(img)}
          className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2 text-left transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(img.thumb_url || img.url)}
            alt={img.prompt ?? "generated image"}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {img.prompt && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/70 to-transparent p-2 text-[11px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
              {img.prompt}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
