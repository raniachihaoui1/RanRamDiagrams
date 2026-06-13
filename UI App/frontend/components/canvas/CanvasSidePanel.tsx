"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FolderOpen,
  Upload,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Wand2,
  Save,
  Loader2,
  X,
} from "lucide-react";
import { api, mediaUrl, type ImageOut } from "@/lib/api";
import { openJobSocket } from "@/lib/ws";
import { useCanvasStore } from "@/store/canvas";
import { STAMPS, STAMP_CATEGORIES, STAMP_MAP } from "@/lib/stamps";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { ImageGrid } from "@/components/media/ImageGrid";
import { ImageModal } from "@/components/media/ImageModal";
import { cn } from "@/lib/utils";

export function CanvasSidePanel({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const qc = useQueryClient();
  const store = useCanvasStore();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = React.useState("");
  const [weight, setWeight] = React.useState(0.55);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<ImageOut | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const flatten = () => canvasRef.current?.toDataURL("image/png") ?? null;

  const onUploadBase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = await api.uploadImage(f);
    store.setBaseImage(img);
    if (fileRef.current) fileRef.current.value = "";
  };

  const generate = async () => {
    const dataUrl = flatten();
    if (!dataUrl) return;
    setProgress(0);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "canvas.png", { type: "image/png" });
      const uploaded = await api.uploadImage(file);
      const job = await api.generate({
        mode: "img2img",
        prompt,
        width: store.width,
        height: store.height,
        count: 1,
        reference_image_id: uploaded.id,
        reference_weight: weight,
      });
      openJobSocket(job.id, {
        onProgress: (p) => setProgress(p),
        onDone: (imgs) => {
          setProgress(null);
          setResult(imgs[0] ?? null);
          qc.invalidateQueries({ queryKey: ["images"] });
        },
        onError: () => setProgress(null),
      });
    } catch {
      setProgress(null);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = store.toData();
      const thumb = flatten() ?? undefined;
      if (store.projectId) {
        await api.updateCanvas(store.projectId, { name: store.name, data, thumb_data_url: thumb });
      } else {
        const created = await api.createCanvas({ name: store.name, data });
        store.setProjectId(created.id);
        if (thumb) await api.updateCanvas(created.id, { thumb_data_url: thumb });
      }
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border">
      {/* Name */}
      <div className="border-b border-border p-3">
        <input
          value={store.name}
          onChange={(e) => store.setName(e.target.value)}
          className="w-full rounded-md bg-transparent px-2 py-1.5 text-sm font-medium outline-none hover:bg-surface-2 focus:bg-surface-2"
        />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Base image */}
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">Base image</h3>
          {store.baseImage ? (
            <div className="relative overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(store.baseImage.thumb_url || store.baseImage.url)} alt="base" className="aspect-video w-full object-cover" />
              <button
                onClick={() => store.setBaseImage(null)}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md bg-black/60 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs text-faint">
              No base — drawing on white.
            </p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" className="justify-center gap-1.5" onClick={() => setPickerOpen(true)}>
              <FolderOpen className="h-4 w-4" /> Library
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUploadBase} />
            <Button variant="secondary" size="sm" className="justify-center gap-1.5" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </div>
        </section>

        {/* Symbols (stamp tool) */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-faint">Symbols</h3>
            {store.tool === "stamp" && (
              <span className="text-[10px] text-faint">click or drag to paint · size = brush slider</span>
            )}
          </div>
          {STAMP_CATEGORIES.map((cat) => (
            <div key={cat.id} className="mb-2">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-faint/70">{cat.label}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {STAMPS.filter((s) => s.category === cat.id).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => store.setSymbol(s.id)}
                    title={s.label}
                    className={cn(
                      "grid aspect-square place-items-center rounded-md border bg-surface p-1 transition-colors hover:bg-surface-2",
                      store.tool === "stamp" && store.symbol === s.id
                        ? "border-foreground ring-1 ring-accent/50"
                        : "border-border"
                    )}
                  >
                    <SymbolPreview symbolId={s.id} color={store.color} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Layers */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-faint">Layers</h3>
            <button onClick={store.addLayer} className="text-muted hover:text-foreground" title="Add layer">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1">
            {[...store.layers].reverse().map((l) => (
              <div
                key={l.id}
                onClick={() => store.setActiveLayer(l.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 h-9 text-sm",
                  l.id === store.activeLayerId ? "bg-elevated text-foreground" : "text-muted hover:bg-surface-2"
                )}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); store.toggleLayer(l.id); }}
                  className="text-muted hover:text-foreground"
                >
                  {l.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <span className="flex-1 truncate">{l.name}</span>
                <span className="text-xs text-faint">{l.ops.length}</span>
                {store.layers.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); store.removeLayer(l.id); }}
                    className="text-faint hover:text-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* AI blend */}
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">Generate</h3>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe how to transform the canvas…"
            className="w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-faint">Strength</span>
            <Slider value={weight} onChange={setWeight} />
            <span className="w-9 text-right text-xs tabular-nums text-muted">{weight.toFixed(2)}</span>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={generate}
            disabled={progress !== null}
            className="mt-3 w-full justify-center gap-2"
          >
            {progress !== null ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {Math.round(progress * 100)}%</>
            ) : (
              <><Wand2 className="h-4 w-4" /> Generate</>
            )}
          </Button>
        </section>
      </div>

      {/* Save */}
      <div className="border-t border-border p-3">
        <Button variant="secondary" size="md" onClick={save} disabled={saving} className="w-full justify-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save project
        </Button>
        {savedAt && <p className="mt-1.5 text-center text-xs text-faint">Saved at {savedAt}</p>}
      </div>

      {/* Library picker */}
      {pickerOpen && (
        <BasePicker
          onClose={() => setPickerOpen(false)}
          onPick={(img) => { store.setBaseImage(img); setPickerOpen(false); }}
        />
      )}

      <ImageModal image={result} onClose={() => setResult(null)} />
    </aside>
  );
}

function SymbolPreview({ symbolId, color }: { symbolId: string; color: string }) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const box = 40;
    canvas.width = box * dpr;
    canvas.height = box * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box, box);
    const sym = STAMP_MAP[symbolId];
    if (!sym) return;
    const pad = 4;
    const s = box - pad * 2;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.translate(pad, pad);
    ctx.scale(s / 100, s / 100);
    sym.draw(ctx, color);
    ctx.restore();
  }, [symbolId, color]);
  return <canvas ref={ref} style={{ width: 40, height: 40 }} />;
}

function BasePicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (img: ImageOut) => void;
}) {
  const { data } = useQuery({ queryKey: ["images", { limit: 1000 }], queryFn: () => api.listImages({ limit: 1000 }) });
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-medium">Choose a base image</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {data && data.length > 0 ? (
            <ImageGrid images={data} onSelect={onPick} />
          ) : (
            <p className="py-10 text-center text-sm text-muted">No images yet — generate some first.</p>
          )}
        </div>
      </div>
    </div>
  );
}
