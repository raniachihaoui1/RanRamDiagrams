"use client";

import { Loader2, ImageOff, Sparkles, X, Ban } from "lucide-react";
import { mediaUrl, type ImageOut } from "@/lib/api";
import { useGeneratorStore, type Generation } from "@/store/generator";

function GeneratingCard({ progress }: { progress: number }) {
  return (
    <div className="relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-border bg-surface-2">
      <div className="flex flex-col items-center gap-2 text-faint">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-xs">Generating {Math.round(progress * 100)}%</span>
      </div>
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-foreground/70 transition-all"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}

function ResultCard({ img, onOpen }: { img: ImageOut; onOpen: (i: ImageOut) => void }) {
  return (
    <button
      onClick={() => onOpen(img)}
      className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2 transition-transform hover:scale-[1.01]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl(img.url)}
        alt={img.prompt ?? "result"}
        className="h-full w-full object-cover"
      />
    </button>
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
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {gen.prompt && (
          <p className="line-clamp-1 flex-1 text-sm text-muted">{gen.prompt}</p>
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
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted">
          <ImageOff className="h-4 w-4" /> {gen.error ?? "Generation failed"}
        </div>
      ) : gen.status === "canceled" ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted">
          <Ban className="h-4 w-4" /> Generation canceled
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {gen.status === "done"
            ? gen.images.map((img) => <ResultCard key={img.id} img={img} onOpen={onOpen} />)
            : Array.from({ length: gen.count }).map((_, i) => (
                <GeneratingCard key={i} progress={gen.progress} />
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
    <div className="mx-auto w-full max-w-4xl space-y-8 py-8">
      {generations.map((gen) => (
        <GenerationRow key={gen.id} gen={gen} onOpen={onOpen} />
      ))}
    </div>
  );
}
