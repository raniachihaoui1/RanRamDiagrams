"use client";

import * as React from "react";
import { Download, RotateCcw } from "lucide-react";
import { useStoryStore, PRESETS } from "@/store/storyline";
import { exportStoryPng } from "./storyExport";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverItem } from "@/components/ui/Popover";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/utils";

export function StoryToolbar() {
  const s = useStoryStore();
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportStoryPng(s);
    } finally {
      setExporting(false);
    }
  };

  const activePreset = PRESETS.find((p) => p.cols === s.cols && p.rows === s.rows);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-5">
      {/* Left: name */}
      <input
        value={s.name}
        onChange={(e) => s.setName(e.target.value)}
        className="min-w-0 max-w-[180px] rounded-md bg-transparent px-2 py-1 text-sm font-medium outline-none hover:bg-surface-2 focus:bg-surface-2"
      />

      {/* Center: preset + controls */}
      <div className="flex flex-1 items-center justify-center gap-2 overflow-x-auto">
        {/* Preset picker */}
        <Popover
          align="center"
          trigger={
            <Chip active={!!activePreset}>
              {activePreset ? activePreset.label : `${s.cols} × ${s.rows}`}
            </Chip>
          }
        >
          {(close) => (
            <div className="grid grid-cols-2 gap-0.5 p-0.5">
              {PRESETS.map((p) => (
                <PopoverItem
                  key={p.label}
                  active={p.cols === s.cols && p.rows === s.rows}
                  onClick={() => {
                    s.applyPreset(p.cols, p.rows);
                    close();
                  }}
                  className="justify-center tabular-nums"
                >
                  {p.label}
                </PopoverItem>
              ))}
            </div>
          )}
        </Popover>

        {/* Divider */}
        <span className="h-4 w-px bg-border" />

        {/* Padding */}
        <label className="flex items-center gap-1.5 text-xs text-faint">
          Pad
          <input
            type="number"
            value={s.padding}
            min={0}
            max={80}
            step={8}
            onChange={(e) => s.setPadding(Number(e.target.value))}
            className="h-7 w-14 rounded border border-border bg-surface px-1.5 text-center text-xs tabular-nums outline-none"
          />
        </label>
      </div>

      {/* Right: reset + export */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={s.reset}
          title="Reset board"
          className="grid h-8 w-8 place-items-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          className="gap-1.5"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Rendering…" : "Export PNG"}
        </Button>
      </div>
    </header>
  );
}
