"use client";

import * as React from "react";
import { X } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import { useStoryStore } from "@/store/storyline";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function StoryInspector({ onPickImage }: { onPickImage: (index: number) => void }) {
  const s = useStoryStore();
  const { selectedIndex, cells } = s;

  const cell = selectedIndex != null ? cells.find((c) => c.index === selectedIndex) : null;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border">
      {/* ── Grid settings (always visible) ── */}
      <div className="border-b border-border p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-faint">Grid</h3>
        <div className="space-y-3">
          {/* Cols / Rows */}
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-faint">Columns</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => s.setCols(Math.max(1, s.cols - 1))}
                  className="grid h-7 w-7 place-items-center rounded border border-border text-sm hover:bg-surface-2"
                >−</button>
                <span className="flex-1 text-center text-sm tabular-nums">{s.cols}</span>
                <button
                  onClick={() => s.setCols(Math.min(8, s.cols + 1))}
                  className="grid h-7 w-7 place-items-center rounded border border-border text-sm hover:bg-surface-2"
                >+</button>
              </div>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-faint">Rows</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => s.setRows(Math.max(1, s.rows - 1))}
                  className="grid h-7 w-7 place-items-center rounded border border-border text-sm hover:bg-surface-2"
                >−</button>
                <span className="flex-1 text-center text-sm tabular-nums">{s.rows}</span>
                <button
                  onClick={() => s.setRows(Math.min(8, s.rows + 1))}
                  className="grid h-7 w-7 place-items-center rounded border border-border text-sm hover:bg-surface-2"
                >+</button>
              </div>
            </label>
          </div>

          {/* Cell size */}
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-faint">Cell W (px)</span>
              <input
                type="number"
                value={s.cellW}
                min={128}
                max={1024}
                step={64}
                onChange={(e) => s.setCellSize(Number(e.target.value), s.cellH)}
                className="h-8 w-full rounded border border-border bg-surface px-2 text-sm outline-none"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-faint">Cell H (px)</span>
              <input
                type="number"
                value={s.cellH}
                min={128}
                max={1024}
                step={64}
                onChange={(e) => s.setCellSize(s.cellW, Number(e.target.value))}
                className="h-8 w-full rounded border border-border bg-surface px-2 text-sm outline-none"
              />
            </label>
          </div>

          {/* Gap + Caption height */}
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-faint">Gap (px)</span>
              <input
                type="number"
                value={s.gap}
                min={0}
                max={64}
                step={4}
                onChange={(e) => s.setGap(Number(e.target.value))}
                className="h-8 w-full rounded border border-border bg-surface px-2 text-sm outline-none"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-faint">Caption H (px)</span>
              <input
                type="number"
                value={s.captionH}
                min={0}
                max={120}
                step={8}
                onChange={(e) => s.setCaptionH(Number(e.target.value))}
                className="h-8 w-full rounded border border-border bg-surface px-2 text-sm outline-none"
              />
            </label>
          </div>

          {/* Backgrounds */}
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-faint">Board bg</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={s.outerBg}
                  onChange={(e) => s.setOuterBg(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
                <span className="text-xs text-faint">{s.outerBg}</span>
              </div>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-faint">Empty cell</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={s.cellBg}
                  onChange={(e) => s.setCellBg(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
                <span className="text-xs text-faint">{s.cellBg}</span>
              </div>
            </label>
          </div>

          {/* Auto-number */}
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span className="text-sm text-muted">Auto-number cells</span>
            <button
              role="switch"
              aria-checked={s.autoNumber}
              onClick={() => s.setAutoNumber(!s.autoNumber)}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                s.autoNumber ? "bg-accent" : "bg-border"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  s.autoNumber ? "left-4" : "left-0.5"
                )}
              />
            </button>
          </label>

          {s.autoNumber && (
            <div className="flex items-center gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-faint">Style</span>
                <select
                  value={s.numberStyle}
                  onChange={(e) => s.setNumberStyle(e.target.value as "circle" | "plain")}
                  className="h-8 rounded border border-border bg-surface px-2 text-sm outline-none"
                >
                  <option value="circle">Circle</option>
                  <option value="plain">Plain</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-faint">Color</span>
                <input
                  type="color"
                  value={s.numberStyle === "circle" ? s.numberBg : s.numberColor}
                  onChange={(e) =>
                    s.numberStyle === "circle"
                      ? s.setNumberBg(e.target.value)
                      : s.setNumberColor(e.target.value)
                  }
                  className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ── Cell inspector (when a cell is selected) ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {cell ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-faint">
                Cell {selectedIndex! + 1}
              </h3>
              <button
                onClick={() => s.selectCell(null)}
                className="rounded p-1 text-faint hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Image */}
            <div>
              <p className="mb-2 text-xs text-faint">Image</p>
              {cell.image ? (
                <div className="relative overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl(cell.image.thumb_url || cell.image.url)}
                    alt="cell"
                    className="aspect-video w-full object-cover"
                  />
                  <button
                    onClick={() => s.setCellImage(selectedIndex!, undefined)}
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => onPickImage(selectedIndex!)}
                >
                  Pick from library
                </Button>
              )}
              {cell.image && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-faint">Fit</span>
                  {(["cover", "contain"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => s.setCellFit(selectedIndex!, f)}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs transition-colors",
                        cell.imageFit === f
                          ? "bg-elevated text-foreground"
                          : "text-muted hover:bg-surface-2"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Caption */}
            <div>
              <p className="mb-1.5 text-xs text-faint">Caption</p>
              <textarea
                rows={2}
                value={cell.caption}
                onChange={(e) => s.setCellCaption(selectedIndex!, e.target.value)}
                placeholder="Add a caption…"
                className="w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none placeholder:text-faint"
              />
            </div>

            {/* Number override */}
            {s.autoNumber && (
              <div>
                <p className="mb-1.5 text-xs text-faint">
                  Number <span className="ml-1 text-faint/60">(blank = auto)</span>
                </p>
                <input
                  type="text"
                  value={cell.numberOverride}
                  onChange={(e) => s.setCellNumberOverride(selectedIndex!, e.target.value)}
                  placeholder={`${selectedIndex! + 1}`.padStart(2, "0")}
                  className="h-8 w-full rounded border border-border bg-surface px-2 text-sm outline-none placeholder:text-faint"
                />
              </div>
            )}

            {cell.image && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-center"
                onClick={() => onPickImage(selectedIndex!)}
              >
                Replace image
              </Button>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm text-faint">Click a cell to edit it</p>
          </div>
        )}
      </div>
    </aside>
  );
}
