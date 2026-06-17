"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, FolderOpen, X } from "lucide-react";
import { api, mediaUrl, type CanvasOut } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";
import { CanvasStage } from "@/components/canvas/CanvasStage";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { CanvasSidePanel } from "@/components/canvas/CanvasSidePanel";
import { Button } from "@/components/ui/Button";

export default function CanvasPage() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const store = useCanvasStore();
  const [projectsOpen, setProjectsOpen] = React.useState(false);

  const loadProject = async (c: CanvasOut) => {
    const base = c.data.baseImageId
      ? await api.getImage(c.data.baseImageId).catch(() => null)
      : null;
    store.loadData(c.data, base);
    store.setProjectId(c.id);
    store.setName(c.name);
    setProjectsOpen(false);
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between px-6">
        <h1 className="text-sm text-muted">
          Canvas <span className="text-foreground">{store.name}</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setProjectsOpen(true)}>
            <FolderOpen className="h-4 w-4" /> Projects
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => store.reset()}>
            <FilePlus2 className="h-4 w-4" /> New
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2">
            <CanvasToolbar />
          </div>
          <CanvasStage canvasRef={canvasRef} />
        </div>
        <CanvasSidePanel canvasRef={canvasRef} />
      </div>

      {projectsOpen && <ProjectsModal onClose={() => setProjectsOpen(false)} onPick={loadProject} />}
    </div>
  );
}

function ProjectsModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (c: CanvasOut) => void;
}) {
  const { data } = useQuery({ queryKey: ["canvas-projects"], queryFn: api.listCanvas });
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-medium">Saved canvas projects</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {data && data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onPick(c)}
                  className="overflow-hidden rounded-lg border border-border bg-surface-2 text-left transition-transform hover:scale-[1.01]"
                >
                  <div className="aspect-video bg-base">
                    {c.thumb_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(c.thumb_url)} alt={c.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <p className="truncate px-2.5 py-2 text-sm">{c.name}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted">No saved projects yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
