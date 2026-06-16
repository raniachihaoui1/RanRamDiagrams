"use client";

import * as React from "react";
import { Plus, ImageOff } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import { useStoryStore, cellNumber } from "@/store/storyline";
import { cn } from "@/lib/utils";

export function StoryCellCard({
  index,
  onPickImage,
}: {
  index: number;
  onPickImage: (index: number) => void;
}) {
  const {
    cells, selectedIndex, selectCell,
    autoNumber, numberStyle, numberColor, numberBg,
    cellBg, cellW, cellH, captionH,
    captionFontFamily, captionFontSize, captionBold,
    captionColor, captionAlign, captionBg,
  } = useStoryStore();

  const cell = cells.find((c) => c.index === index);
  if (!cell) return null;

  const selected = selectedIndex === index;
  const numText = cellNumber(autoNumber, index, cell.numberOverride);

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border-2 transition-colors",
        selected ? "border-accent shadow-[0_0_0_3px_hsl(var(--color-accent)/0.2)]" : "border-border"
      )}
      style={{ width: cellW, flexShrink: 0 }}
      onClick={() => selectCell(index)}
    >
      {/* Image area */}
      <div
        className="relative overflow-hidden"
        style={{ width: cellW, height: cellH, background: cellBg }}
      >
        {cell.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={mediaUrl(cell.image.thumb_url || cell.image.url)}
            alt={cell.caption || `Cell ${index + 1}`}
            className="h-full w-full"
            style={{ objectFit: cell.imageFit }}
            draggable={false}
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onPickImage(index); }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted/50 transition-colors hover:bg-surface-2/60 hover:text-muted"
          >
            <Plus className="h-7 w-7" />
            <span className="text-xs">Add image</span>
          </button>
        )}

        {/* Number badge */}
        {numText && (
          <div
            className="pointer-events-none absolute left-2 top-2 flex items-center justify-center text-xs font-bold leading-none"
            style={
              numberStyle === "circle"
                ? {
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: numberBg,
                    color: numberColor,
                  }
                : { color: numberBg, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }
            }
          >
            {numText}
          </div>
        )}

        {/* Missing image indicator when image fails */}
        {cell.image && (
          <noscript>
            <div className="absolute inset-0 flex items-center justify-center text-faint">
              <ImageOff className="h-6 w-6" />
            </div>
          </noscript>
        )}
      </div>

      {/* Caption area */}
      {captionH > 0 && (
        <div
          className="flex items-center overflow-hidden px-2"
          style={{ height: captionH, background: captionBg }}
        >
          <p
            className="line-clamp-2 w-full"
            style={{
              fontSize: captionFontSize,
              fontFamily: captionFontFamily,
              fontWeight: captionBold ? "bold" : "normal",
              color: cell.caption ? captionColor : undefined,
              textAlign: captionAlign,
            }}
          >
            {cell.caption || (
              <span style={{ color: "#aaa", fontStyle: "italic", fontWeight: "normal" }}>
                Caption…
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
