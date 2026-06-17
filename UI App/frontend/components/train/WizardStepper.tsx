"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Dataset",
  "Images",
  "Caption",
  "Review",
  "Prepare",
  "Train",
];

export function WizardStepper({ current }: { current: number }) {
  return (
    <nav className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  done
                    ? "border-accent bg-accent text-accent-foreground"
                    : active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-faint"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wider whitespace-nowrap",
                  active ? "text-foreground" : done ? "text-muted" : "text-faint"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 mb-4 h-px w-10 transition-colors",
                  i < current ? "bg-accent" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
