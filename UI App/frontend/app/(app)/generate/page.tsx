"use client";

import * as React from "react";
import { Box, X } from "lucide-react";
import { GenerationFeed } from "@/components/generate/GenerationFeed";
import { PromptBar } from "@/components/generate/PromptBar";
import { ImageModal } from "@/components/media/ImageModal";
import { RhinoLiveView } from "@/components/rhino/RhinoLiveView";
import { Button } from "@/components/ui/Button";
import { api, type ImageOut } from "@/lib/api";
import { useGeneratorStore } from "@/store/generator";

export default function GeneratePage() {
  const [selected, setSelected] = React.useState<ImageOut | null>(null);
  const [rhinoOpen, setRhinoOpen] = React.useState(false);

  const onRhinoCapture = async (file: File) => {
    const img = await api.uploadImage(file);
    useGeneratorStore.getState().setReference(img);
    setRhinoOpen(false);
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between px-6">
        <h1 className="text-sm text-muted">
          Image <span className="text-foreground">Generator</span>
        </h1>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setRhinoOpen(true)}>
          <Box className="h-4 w-4" /> Rhino viewport
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-6">
        <GenerationFeed onOpen={setSelected} />
      </div>

      <div className="shrink-0 px-4 pb-5 pt-2">
        <div className="mx-auto w-full max-w-4xl">
          <PromptBar />
        </div>
      </div>

      <ImageModal image={selected} onClose={() => setSelected(null)} />

      {rhinoOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={() => setRhinoOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="flex items-center gap-2 font-medium">
                <Box className="h-4 w-4" /> Rhino viewport bridge
              </h2>
              <button
                onClick={() => setRhinoOpen(false)}
                className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <RhinoLiveView onCapture={onRhinoCapture} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
