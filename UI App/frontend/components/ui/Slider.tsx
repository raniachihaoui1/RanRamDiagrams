"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
}

/** Minimal monochrome range slider. */
export function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  className,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none",
        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5",
        "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow",
        "[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground",
        className
      )}
      style={{
        background: `linear-gradient(to right, var(--color-foreground) ${pct}%, var(--color-surface) ${pct}%)`,
      }}
    />
  );
}
