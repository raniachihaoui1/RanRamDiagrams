"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api, type ImageOut } from "@/lib/api";
import { useStoryStore } from "@/store/storyline";
import { StoryToolbar } from "@/components/storyline/StoryToolbar";
import { StoryGrid } from "@/components/storyline/StoryGrid";
import { StoryInspector } from "@/components/storyline/StoryInspector";
import { ImageGrid } from "@/components/media/ImageGrid";

export default function StoryLinePage() {
  const s = useStoryStore();
  const [pickerTarget, setPickerTarget] = React.useState<number | null>(null);

  const openPicker = (index: number) => {
    s.selectCell(index);
    setPickerTarget(index);
  };

  const closePicker = () => setPickerTarget(null);

  const pickImage = (img: ImageOut) => {
    if (pickerTarget != null) {
      s.setCellImage(pickerTarget, img);
    }
    closePicker();
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <StoryToolbar />

      <div className="flex flex-1 overflow-hidden">
        <StoryGrid onPickImage={openPicker} />
        <StoryInspector onPickImage={openPicker} />
      </div>

      {pickerTarget != null && (
        <ImagePickerModal onClose={closePicker} onPick={pickImage} />
      )}
    </div>
  );
}

function ImagePickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (img: ImageOut) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["images", { limit: 200 }],
    queryFn: () => api.listImages({ limit: 200 }),
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-panel)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-medium">Choose an image</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
              ))}
            </div>
          ) : data && data.length > 0 ? (
            <ImageGrid images={data} onSelect={onPick} />
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              No images yet — generate some first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
