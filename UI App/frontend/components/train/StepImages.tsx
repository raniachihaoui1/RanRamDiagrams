"use client";

import * as React from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { api, type DatasetOut } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface Props {
  dataset: DatasetOut;
  onRefresh: () => void;
}

export function StepImages({ dataset, onRefresh }: Props) {
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    setUploading(true);
    setProgress(`Uploading ${arr.length} file${arr.length > 1 ? "s" : ""}…`);
    try {
      await api.uploadDatasetImages(dataset.id, arr);
      onRefresh();
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (filename: string) => {
    await api.deleteDatasetImage(dataset.id, filename);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Upload images</h2>
        <p className="mt-1 text-sm text-muted">
          Add the raw images you want to use for training.
          Supported: JPG, PNG, WebP. Minimum ~20–40 images recommended.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors ${
          dragging ? "border-accent bg-accent/5" : "border-border hover:border-foreground/30 hover:bg-surface-2/40"
        }`}
      >
        <Upload className={`h-8 w-8 ${dragging ? "text-accent" : "text-faint"}`} />
        <div className="text-center">
          <p className="text-sm font-medium">Drop images here or click to browse</p>
          <p className="mt-1 text-xs text-faint">JPG · PNG · WebP · multiple files OK</p>
        </div>
        {uploading && progress && (
          <p className="text-xs text-accent">{progress}</p>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files && upload(e.target.files)}
      />

      {/* Image grid */}
      {dataset.images.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-faint">
            {dataset.images.length} image{dataset.images.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {dataset.images.map((img) => (
              <div
                key={img.filename}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={api.datasetImageUrl(dataset.id, img.filename)}
                  alt={img.filename}
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => remove(img.filename)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/90"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {img.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 px-1">
                    <p className="truncate text-[9px] text-white/80">{img.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {dataset.images.length === 0 && !uploading && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-faint">
          <ImageIcon className="h-5 w-5 shrink-0" />
          No images yet — drop some above.
        </div>
      )}
    </div>
  );
}
