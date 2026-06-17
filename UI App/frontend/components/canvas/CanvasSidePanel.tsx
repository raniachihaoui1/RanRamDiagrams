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
  Box,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { api, mediaUrl, type ImageOut, type ModelInfo } from "@/lib/api";
import { loraFamily } from "@/lib/loras";
import { openJobSocket } from "@/lib/ws";
import { useCanvasStore } from "@/store/canvas";
import { STAMPS, STAMP_CATEGORIES, STAMP_MAP } from "@/lib/stamps";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Popover, PopoverItem } from "@/components/ui/Popover";
import { ImageGrid } from "@/components/media/ImageGrid";
import { ImageModal } from "@/components/media/ImageModal";
import { cn } from "@/lib/utils";

// ── LoRA grouped picker (mirrors LoraPicker.tsx logic, wired to local state) ──

interface Variant { id: string; label: string; sort: number; }
interface LoraGroup { base: string; variants: Variant[]; }

function parseLoraName(m: ModelInfo): { base: string; label: string; sort: number } {
  const match = m.name.match(/^(.*?)[-_\s]+((?:v|ver|version|step|epoch|e)?\s*\d+)$/i);
  if (match && match[1].trim()) {
    const token = match[2].trim();
    const num = parseInt(token.replace(/\D/g, ""), 10);
    const prefix = token.replace(/\d+$/, "");
    const label = Number.isNaN(num) ? token : `${prefix}${num}`;
    return { base: match[1].trim(), label, sort: Number.isNaN(num) ? 0 : num };
  }
  return { base: m.name, label: m.name, sort: 0 };
}

function buildLoraGroups(loras: ModelInfo[]): LoraGroup[] {
  const map = new Map<string, Variant[]>();
  for (const m of loras) {
    const { base, label, sort } = parseLoraName(m);
    if (loraFamily(base).hidden) continue;
    const list = map.get(base) ?? [];
    list.push({ id: m.id, label, sort });
    map.set(base, list);
  }
  return [...map.entries()]
    .map(([base, variants]) => ({ base, variants: variants.sort((a, b) => a.sort - b.sort) }))
    .sort((a, b) => loraDisplayName(a.base).localeCompare(loraDisplayName(b.base)));
}

const loraDisplayName = (base: string): string => loraFamily(base).display ?? base;

function CanvasLoraGroupRow({
  group,
  selectedLora,
  onSelect,
}: {
  group: LoraGroup;
  selectedLora: string | null;
  onSelect: (id: string | null, keyword: string | null) => void;
}) {
  const family = loraFamily(group.base);
  const ids = React.useMemo(() => group.variants.map((v) => v.id), [group]);
  const selectedId = ids.find((id) => id === selectedLora) ?? null;
  const active = selectedId !== null;

  const [idx, setIdx] = React.useState(() => {
    const i = group.variants.findIndex((v) => v.id === selectedId);
    if (i >= 0) return i;
    const d =
      family.defaultStep != null
        ? group.variants.findIndex((v) => v.sort === family.defaultStep)
        : -1;
    return d >= 0 ? d : group.variants.length - 1;
  });

  React.useEffect(() => {
    const i = group.variants.findIndex((v) => v.id === selectedId);
    if (i >= 0 && i !== idx) setIdx(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const current = group.variants[idx];
  const kw = family.keyword ?? null;

  const toggle = () => onSelect(active ? null : current.id, active ? null : kw);

  const step = (dir: number) => {
    const next = (idx + dir + group.variants.length) % group.variants.length;
    setIdx(next);
    if (active) onSelect(group.variants[next].id, kw);
  };

  if (group.variants.length === 1) {
    return (
      <PopoverItem active={active} onClick={toggle}>
        <span className="flex-1 truncate">{loraDisplayName(group.base)}</span>
        {active && <Check className="h-3.5 w-3.5" />}
      </PopoverItem>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md px-2.5 h-9 text-sm",
        active ? "bg-elevated text-foreground" : "text-muted"
      )}
    >
      <button
        onClick={toggle}
        className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-foreground"
      >
        <span
          className={cn(
            "grid h-4 w-4 shrink-0 place-items-center rounded border",
            active ? "border-accent bg-accent text-accent-foreground" : "border-border"
          )}
        >
          {active && <Check className="h-3 w-3" />}
        </span>
        <span className="truncate">{loraDisplayName(group.base)}</span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={() => step(-1)}
          className="rounded p-0.5 text-muted hover:bg-surface hover:text-foreground"
          aria-label="Previous variant"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="w-12 truncate text-center text-xs tabular-nums text-faint">
          {current.label}
        </span>
        <button
          onClick={() => step(1)}
          className="rounded p-0.5 text-muted hover:bg-surface hover:text-foreground"
          aria-label="Next variant"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function CanvasSidePanel({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const qc = useQueryClient();
  const store = useCanvasStore();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const { data: models } = useQuery({ queryKey: ["models"], queryFn: api.models });
  const { data: loras } = useQuery({ queryKey: ["loras"], queryFn: api.loras });

  const [prompt, setPrompt] = React.useState("");
  const [model, setModel] = React.useState<string | null>(null);
  const [lora, setLora] = React.useState<string | null>(null);
  const [appliedToken, setAppliedToken] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);

  // Default the model to the first option once loaded (mirrors PromptBar).
  React.useEffect(() => {
    if (!model && models && models.length) setModel(models[0].id);
  }, [models, model]);

  const modelName = models?.find((m) => m.id === model)?.name ?? "Model";
  const groups = React.useMemo(() => buildLoraGroups(loras ?? []), [loras]);
  const activeLoraGroup = React.useMemo(
    () => groups.find((g) => g.variants.some((v) => v.id === lora)),
    [groups, lora]
  );
  const loraChipLabel = activeLoraGroup ? loraDisplayName(activeLoraGroup.base) : "LoRA";

  const selectLora = (id: string | null, keyword: string | null) => {
    setLora(id);
    setPrompt((prev) => {
      let p = prev;
      if (appliedToken && p.startsWith(appliedToken)) {
        p = p.slice(appliedToken.length).replace(/^,\s*/, "");
      }
      if (keyword && !p.startsWith(keyword)) p = p ? `${keyword}, ${p}` : keyword;
      return p;
    });
    setAppliedToken(keyword);
  };
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
        model,
        loras: lora ? [lora] : [],
        width: store.width,
        height: store.height,
        count: 1,
        reference_image_id: uploaded.id,
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

          {/* Model + LoRA */}
          <div className="mb-2 flex flex-wrap gap-2">
            <Popover
              trigger={
                <Chip icon={<Box />} active>
                  {modelName} <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Chip>
              }
            >
              {(close) =>
                models?.length ? (
                  models.map((m) => (
                    <PopoverItem
                      key={m.id}
                      active={m.id === model}
                      onClick={() => { setModel(m.id); close(); }}
                    >
                      {m.name}
                    </PopoverItem>
                  ))
                ) : (
                  <p className="px-2 py-2 text-xs text-faint">No models found</p>
                )
              }
            </Popover>

            <Popover
              className="max-h-80 w-64 overflow-y-auto"
              trigger={
                <Chip icon={<Layers />} active={!!lora}>
                  {loraChipLabel}
                </Chip>
              }
            >
              {groups.length ? (
                groups.map((g) => (
                  <CanvasLoraGroupRow
                    key={g.base}
                    group={g}
                    selectedLora={lora}
                    onSelect={selectLora}
                  />
                ))
              ) : (
                <p className="px-2 py-2 text-xs text-faint">No LoRAs found</p>
              )}
            </Popover>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe how to transform the canvas…"
            className="w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none"
          />
          <Button
            variant="primary"
            size="md"
            onClick={generate}
            disabled={progress !== null || !lora}
            className="mt-3 w-full justify-center gap-2"
          >
            {progress !== null ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {Math.round(progress * 100)}%</>
            ) : (
              <><Wand2 className="h-4 w-4" /> Generate</>
            )}
          </Button>
          {!lora && (
            <p className="mt-1.5 text-center text-xs text-faint">Pick a LoRA to generate</p>
          )}
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
