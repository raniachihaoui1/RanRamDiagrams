import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassPanelProps
  extends React.HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
}

/** Floating frosted-glass surface with rounded corners and soft shadow. */
export function GlassPanel({
  className,
  strong = false,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-xl shadow-[var(--shadow-panel)]",
        className
      )}
      {...props}
    />
  );
}
