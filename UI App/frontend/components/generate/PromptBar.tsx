"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Box,
  Ratio,
  ImagePlus,
  Grid2x2,
  Settings2,
  ArrowUp,
  X,
  Loader2,
} from "lucide-react";
import { api, mediaUrl } from "@/lib/api";
import { Chip } from "@/components/ui/Chip";
import { Popover, PopoverItem } from "@/components/ui/Popover";
import { Slider } from "@/components/ui/Slider";
import { LoraPicker } from "@/components/generate/LoraPicker";
import { useGeneratorStore, ASPECTS } from "@/store/generator";

export function PromptBar() {
  const qc = useQueryClient();
  const s = useGeneratorStore();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const { data: models } = useQuery({ queryKey: ["models"], queryFn: api.models });
  const { data: loras } = useQuery({ queryKey: ["loras"], queryFn: api.loras });

  // Default the model to the first option once loaded.
  React.useEffect(() => {
    if (!s.model && models && models.length) s.patch({ model: models[0].id });
  }, [models, s]);

  const modelName = models?.find((m) => m.id === s.model)?.name ?? "Model";

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const img = await api.uploadImage(file);
      s.setReference(img);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = () => s.submit(() => qc.invalidateQueries({ queryKey: ["images"] }));

  return (
    <div className="glass-strong rounded-xl p-3 shadow-[var(--shadow-panel)]">
      {/* Reference image row (img2img) */}
      {s.referenceImage && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-surface/60 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(s.referenceImage.thumb_url || s.referenceImage.url)}
            alt="reference"
            className="h-12 w-12 rounded-md object-cover"
          />
          <div className="flex flex-1 items-center gap-2">
            <span className="text-xs text-faint">Weight</span>
            <Slider
              value={s.referenceWeight}
              onChange={(v) => s.patch({ referenceWeight: v })}
              className="max-w-48"
            />
            <span className="w-9 text-right text-xs tabular-nums text-muted">
              {s.referenceWeight.toFixed(2)}
            </span>
          </div>
          <button
            onClick={() => s.setReference(null)}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Remove reference"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Prompt */}
      <textarea
        value={s.prompt}
        onChange={(e) => s.patch({ prompt: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        rows={2}
        placeholder="Describe an image and press generate…"
        className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-faint"
      />

      {/* Chips + generate */}
      <div className="mt-1 flex items-center gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Model */}
          <Popover
            trigger={
              <Chip icon={<Box />} active>
                {modelName} <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Chip>
            }
          >
            {(close) => (
              <>
                {models?.map((m) => (
                  <PopoverItem
                    key={m.id}
                    active={m.id === s.model}
                    onClick={() => {
                      s.patch({ model: m.id });
                      close();
                    }}
                  >
                    {m.name}
                  </PopoverItem>
                ))}
              </>
            )}
          </Popover>

          {/* LoRA (grouped by family, one active variant per family) */}
          <LoraPicker loras={loras} />

          {/* Aspect */}
          <Popover
            trigger={
              <Chip icon={<Ratio />} active>
                {s.aspect === "custom" ? "Personalizado" : s.aspect}
              </Chip>
            }
          >
            {(close) => (
              <>
                {s.referenceImage && (
                  <PopoverItem
                    active={s.aspect === "custom"}
                    onClick={() => {
                      s.patch({ aspect: "custom" });
                      close();
                    }}
                  >
                    <span className="flex-1">Personalizado</span>
                    <span className="text-xs text-faint">
                      {s.referenceImage.width}×{s.referenceImage.height}
                    </span>
                  </PopoverItem>
                )}
                {ASPECTS.map((a) => (
                  <PopoverItem
                    key={a.id}
                    active={a.id === s.aspect}
                    onClick={() => {
                      s.patch({ aspect: a.id });
                      close();
                    }}
                  >
                    <span className="flex-1">{a.label}</span>
                    <span className="text-xs text-faint">{a.w}×{a.h}</span>
                  </PopoverItem>
                ))}
              </>
            )}
          </Popover>

          {/* Reference upload */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
          <Chip
            icon={uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            active={!!s.referenceImage}
            onClick={() => fileRef.current?.click()}
          >
            {s.referenceImage ? "Reference" : "Image"}
          </Chip>

          {/* Count */}
          <Popover
            trigger={
              <Chip icon={<Grid2x2 />} active>
                {s.count}/4
              </Chip>
            }
          >
            {(close) =>
              [1, 2, 3, 4].map((n) => (
                <PopoverItem
                  key={n}
                  active={n === s.count}
                  onClick={() => {
                    s.patch({ count: n });
                    close();
                  }}
                >
                  {n} image{n > 1 ? "s" : ""}
                </PopoverItem>
              ))
            }
          </Popover>

          {/* Settings */}
          <Popover
            align="end"
            className="w-72 p-3"
            trigger={
              <Chip icon={<Settings2 />}>
                <span className="sr-only">Settings</span>
              </Chip>
            }
          >
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-faint">Negative prompt</span>
                <textarea
                  value={s.negative}
                  onChange={(e) => s.patch({ negative: e.target.value })}
                  rows={2}
                  placeholder="what to avoid…"
                  className="w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-faint">Seed (blank = random)</span>
                <input
                  type="number"
                  value={s.seed ?? ""}
                  onChange={(e) =>
                    s.patch({ seed: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  placeholder="random"
                  className="w-full rounded-md border border-border bg-surface px-2 h-9 text-sm outline-none"
                />
              </label>
            </div>
          </Popover>
        </div>

        {/* Generate */}
        <button
          onClick={submit}
          disabled={!s.prompt.trim() && s.mode === "txt2img"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition-all hover:bg-white active:scale-95 disabled:opacity-40"
          aria-label="Generate"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
