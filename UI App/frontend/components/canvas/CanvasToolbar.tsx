"use client";

import {
  Brush,
  Eraser,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  Stamp,
  Undo2,
  Trash2,
} from "lucide-react";
import { useCanvasStore, PALETTE, type Tool } from "@/store/canvas";
import { Slider } from "@/components/ui/Slider";
import { cn } from "@/lib/utils";

const TOOLS: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: "brush", icon: Brush, label: "Brush" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "ellipse", icon: Circle, label: "Ellipse" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "arrow", icon: MoveUpRight, label: "Arrow" },
  { id: "stamp", icon: Stamp, label: "Stamp (people, trees, arrows)" },
];

export function CanvasToolbar() {
  const { tool, setTool, color, setColor, size, setSize, undo, clearActive } =
    useCanvasStore();

  return (
    <div className="glass-strong flex flex-col items-center gap-1 rounded-xl p-1.5 shadow-[var(--shadow-panel)]">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-lg transition-colors",
              tool === t.id ? "bg-elevated text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        );
      })}

      <div className="my-1 h-px w-8 bg-border" />

      {/* Color swatches */}
      <div className="grid grid-cols-2 gap-1 px-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            title={c}
            className={cn(
              "h-5 w-5 rounded-full border transition-transform hover:scale-110",
              color === c ? "border-foreground ring-2 ring-accent/50" : "border-border"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <label className="mt-1 grid h-7 w-7 cursor-pointer place-items-center rounded-md border border-border" title="Custom color">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
        />
      </label>

      <div className="my-1 h-px w-8 bg-border" />

      {/* Size */}
      <div className="flex h-24 items-center justify-center px-2">
        <div className="-rotate-90">
          <Slider value={size} min={1} max={64} step={1} onChange={setSize} className="w-20" />
        </div>
      </div>
      <span className="text-[10px] tabular-nums text-faint">{size}px</span>

      <div className="my-1 h-px w-8 bg-border" />

      <button
        onClick={undo}
        title="Undo"
        className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
      >
        <Undo2 className="h-[18px] w-[18px]" />
      </button>
      <button
        onClick={clearActive}
        title="Clear layer"
        className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
      >
        <Trash2 className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
