"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
}

/** Pill-shaped selectable control used in the generator's prompt bar. */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active = false, icon, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        data-active={active}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-pill border px-3 h-8 text-sm font-medium transition-all",
          "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          active
            ? "bg-elevated border-border-strong text-foreground"
            : "bg-surface-2/60 border-border text-muted hover:text-foreground hover:bg-surface-2",
          className
        )}
        {...props}
      >
        {icon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        {children}
      </button>
    );
  }
);
Chip.displayName = "Chip";
