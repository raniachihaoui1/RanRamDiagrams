"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid,
  Heart,
  Sparkles,
  Brush,
  Upload,
  Disc3,
  Rows3,
} from "lucide-react";
import { api, type ImageOut } from "@/lib/api";
import { groupByDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ImageGrid } from "@/components/media/ImageGrid";
import { ImageModal } from "@/components/media/ImageModal";
import { CuteLibrary } from "@/components/library/CuteLibrary";

type Filter = "all" | "favorites" | "generated" | "edited" | "uploaded";

const FILTERS: { id: Filter; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "favorites", label: "Favorites", icon: Heart },
  { id: "generated", label: "Generated", icon: Sparkles },
  { id: "edited", label: "Edited", icon: Brush },
  { id: "uploaded", label: "Uploaded", icon: Upload },
];

function matches(img: ImageOut, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "favorites") return img.favorite;
  return img.kind === f;
}

export default function LibraryPage() {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [view, setView] = React.useState<"grid" | "cute">("grid");
  const [selected, setSelected] = React.useState<ImageOut | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["images", { limit: 1000 }],
    queryFn: () => api.listImages({ limit: 1000 }),
  });

  const images = React.useMemo(
    () => (data ?? []).filter((img) => matches(img, filter)),
    [data, filter]
  );
  const groups = React.useMemo(() => groupByDate(images), [images]);

  const count = (f: Filter) => (data ?? []).filter((i) => matches(i, f)).length;

  return (
    <div className="flex h-dvh">
      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between px-8">
          <h1 className="text-xl font-semibold tracking-tight">Library</h1>
          <div className="flex items-center gap-1 rounded-pill border border-border bg-surface/60 p-1">
            <ViewToggle active={view === "grid"} onClick={() => setView("grid")} icon={Rows3} label="Grid" />
            <ViewToggle active={view === "cute"} onClick={() => setView("cute")} icon={Disc3} label="Cute" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-10">
          {isError ? (
            <Centered>Couldn’t reach the backend — start it with <code className="text-foreground">./dev.ps1</code>.</Centered>
          ) : isLoading ? (
            <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <Centered>No images in “{filter}”.</Centered>
          ) : view === "cute" ? (
            <div className="h-[calc(100dvh-7rem)] pt-2">
              <CuteLibrary images={images} onOpen={setSelected} />
            </div>
          ) : (
            <div className="space-y-8 pt-2">
              {groups.map((g) => (
                <section key={g.label}>
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-sm font-medium text-foreground">{g.label}</h2>
                    <span className="text-xs text-faint">{g.images.length}</span>
                  </div>
                  <ImageGrid images={g.images} onSelect={setSelected} />
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter rail */}
      <aside className="hidden w-56 shrink-0 border-l border-border p-3 md:block">
        <p className="px-3 pb-2 pt-3 text-[11px] font-medium uppercase tracking-wider text-faint">
          Filters
        </p>
        <div className="space-y-0.5">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 h-9 text-sm transition-colors",
                  active ? "bg-elevated text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="flex-1 text-left">{f.label}</span>
                <span className="text-xs text-faint">{count(f.id)}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <ImageModal
        image={selected}
        onClose={() => setSelected(null)}
        onDeleted={() => setSelected(null)}
      />
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-pill px-3 h-7 text-sm transition-colors",
        active ? "bg-elevated text-foreground" : "text-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-[60vh] place-items-center text-center text-sm text-muted">
      <p className="max-w-sm">{children}</p>
    </div>
  );
}
