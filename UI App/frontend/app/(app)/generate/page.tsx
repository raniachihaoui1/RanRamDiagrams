"use client";

import * as React from "react";
import { GenerationFeed } from "@/components/generate/GenerationFeed";
import { PromptBar } from "@/components/generate/PromptBar";
import { ImageModal } from "@/components/media/ImageModal";
import type { ImageOut } from "@/lib/api";

export default function GeneratePage() {
  const [selected, setSelected] = React.useState<ImageOut | null>(null);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center px-6">
        <h1 className="text-sm text-muted">
          Image <span className="text-foreground">Generator</span>
        </h1>
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
    </div>
  );
}
