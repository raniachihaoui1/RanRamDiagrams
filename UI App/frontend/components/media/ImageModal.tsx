"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Download, Heart, Trash2 } from "lucide-react";
import { api, mediaUrl, type ImageOut } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { describeLora } from "@/lib/loras";
import { cn } from "@/lib/utils";

export function ImageModal({
  image,
  onClose,
  onDeleted,
}: {
  image: ImageOut | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [fav, setFav] = React.useState(false);

  React.useEffect(() => {
    setFav(image?.favorite ?? false);
  }, [image]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!image) return null;

  const toggleFav = async () => {
    setFav((v) => !v);
    await api.patchImage(image.id, { favorite: !fav });
    qc.invalidateQueries({ queryKey: ["images"] });
  };

  const remove = async () => {
    await api.deleteImage(image.id);
    qc.invalidateQueries({ queryKey: ["images"] });
    onDeleted?.(image.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-panel)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="flex flex-1 items-center justify-center bg-base p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(image.url)}
            alt={image.prompt ?? "image"}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
        </div>

        {/* Meta + actions */}
        <aside className="flex w-72 shrink-0 flex-col border-l border-border">
          <div className="flex items-center justify-between p-4">
            <span className="text-sm font-medium capitalize">{image.kind}</span>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 text-sm">
            {image.prompt && (
              <Meta label="Prompt" value={image.prompt} />
            )}
            <Meta label="Dimensions" value={`${image.width} × ${image.height}`} />
            {image.model && <Meta label="Model" value={image.model} />}
            {image.seed != null && <Meta label="Seed" value={String(image.seed)} />}
            {image.loras?.length > 0 && (() => {
              const described = image.loras.map(describeLora);
              const steps = described.map((d) => d.step).filter((s): s is number => s != null);
              return (
                <>
                  <Meta label="LoRA" value={described.map((d) => d.label).join(", ")} />
                  {steps.length > 0 && (
                    <Meta label="Steps" value={steps.join(", ")} />
                  )}
                </>
              );
            })()}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
            <a href={mediaUrl(image.url)} download={image.filename} className="contents">
              <Button variant="secondary" size="sm" className="w-full justify-center gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </a>
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleFav}
              className={cn("w-full justify-center gap-1.5", fav && "text-foreground")}
            >
              <Heart className={cn("h-4 w-4", fav && "fill-current")} /> Favorite
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={remove}
              className="col-span-2 w-full justify-center gap-1.5 text-muted hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-0.5 break-words text-foreground">{value}</p>
    </div>
  );
}
