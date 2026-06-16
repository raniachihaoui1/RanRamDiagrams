"use client";

import { useRouter } from "next/navigation";
import { Loader2, ImageOff, Sparkles, X, Ban, PenLine } from "lucide-react";
import { mediaUrl, type ImageOut } from "@/lib/api";
import { useGeneratorStore, type Generation } from "@/store/generator";
import { useCanvasStore } from "@/store/canvas";

/** Placeholder card shown while a job is running. */
function GeneratingCard({
  progress,
  width,
  height,
}: {
  progress: number;
  width: number;
  height: number;
}) {
  return (
    <div
      className="relative grid place-items-center overflow-hidden rounded-xl border border-border bg-surface-2"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div className="flex flex-col items-center gap-2 text-faint">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-xs">{Math.round(progress * 100)}%</span>
      </div>
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-foreground/60 transition-all duration-300"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}

/** Finished image card — shows true aspect ratio, "Edit on canvas" on hover. */
function ResultCard({ img, onOpen }: { img: ImageOut; onOpen: (i: ImageOut) => void }) {
  const router = useRouter();

  const openInCanvas = (e: React.MouseEvent) => {
    e.stopPropagation();
    useCanvasStore.getState().setBaseImage(img);
    router.push("/canvas");
  };

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-border bg-surface-2"
      style={{ aspectRatio: `${img.width} / ${img.height}` }}
    >
      {/* Main click → opens modal */}
      <button
        onClick={() => onOpen(img)}
        className="absolute inset-0 transition-transform duration-200 group-hover:scale-[1.02]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl(img.url)}
          alt={img.prompt ?? "result"}
          className="h-full w-full object-cover"
        />
      </button>

      {/* "Edit on canvas" — slides up from the bottom on hover */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-200 group-hover:translate-y-0">
        <button
          onClick={openInCanvas}
          className="pointer-events-auto flex w-full items-center justify-center gap-1.5 bg-black/75 py-2.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/90"
        >
          <PenLine className="h-3.5 w-3.5" />
          Edit on canvas
        </button>
      </div>
    </div>
  );
}

function GenerationRow({
  gen,
  onOpen,
}: {
  gen: Generation;
  onOpen: (i: ImageOut) => void;
}) {
  const cancel = useGeneratorStore((s) => s.cancel);

  return (
    <div className="space-y-3">
      {/* Prompt + cancel */}
      <div className="flex items-center gap-3">
        {gen.prompt && (
          <p className="line-clamp-2 flex-1 text-sm text-muted">{gen.prompt}</p>
        )}
        {gen.status === "running" && (
          <button
            onClick={() => cancel(gen.id)}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        )}
      </div>

      {gen.status === "error" ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted">
          <ImageOff className="h-4 w-4 shrink-0" /> {gen.error ?? "Generation failed"}
        </div>
      ) : gen.status === "canceled" ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted">
          <Ban className="h-4 w-4 shrink-0" /> Generation canceled
        </div>
      ) : (
        // 1 image → full width; 2+ → 2-column grid. Images show their real aspect ratio.
        <div
          className={
            gen.count === 1
              ? "max-w-xl"
              : "grid grid-cols-1 gap-4 sm:grid-cols-2"
          }
        >
          {gen.status === "done"
            ? gen.images.map((img) => (
                <ResultCard key={img.id} img={img} onOpen={onOpen} />
              ))
            : Array.from({ length: gen.count }).map((_, i) => (
                <GeneratingCard
                  key={i}
                  progress={gen.progress}
                  width={gen.width}
                  height={gen.height}
                />
              ))}
        </div>
      )}
    </div>
  );
}

export function GenerationFeed({ onOpen }: { onOpen: (i: ImageOut) => void }) {
  const generations = useGeneratorStore((s) => s.generations);

  if (generations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2">
          <Sparkles className="h-6 w-6 text-muted" />
        </span>
        <h2 className="mt-4 text-lg font-medium">Generate your first image</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Write a prompt below, pick a model and LoRA, choose how many to make, and
          press the button.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 py-8">
      {generations.map((gen) => (
        <GenerationRow key={gen.id} gen={gen} onOpen={onOpen} />
      ))}
    </div>
  );
}
