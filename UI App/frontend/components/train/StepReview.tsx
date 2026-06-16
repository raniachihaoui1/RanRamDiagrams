"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { api, type DatasetOut } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  dataset: DatasetOut;
  captions: Record<string, string>;
  onUpdate: (filename: string, caption: string) => void;
}

export function StepReview({ dataset, captions, onUpdate }: Props) {
  const [saving, setSaving] = React.useState<string | null>(null);

  const save = async (filename: string, caption: string) => {
    setSaving(filename);
    try {
      await api.patchCaption(dataset.id, filename, caption);
      onUpdate(filename, caption);
    } finally {
      setSaving(null);
    }
  };

  const missing = dataset.images.filter((img) => !captions[img.filename]?.trim());
  const badTrigger = dataset.images.filter(
    (img) =>
      captions[img.filename]?.trim() &&
      !captions[img.filename].startsWith(dataset.trigger_token)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Review captions</h2>
        <p className="mt-1 text-sm text-muted">
          Edit any caption inline — changes are saved immediately. Every caption must start with{" "}
          <code className="rounded bg-surface-2 px-1 text-xs">{dataset.trigger_token}</code>.
        </p>
      </div>

      {/* Warnings */}
      {missing.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {missing.length} image{missing.length !== 1 ? "s" : ""} without captions —
          run captioning or add them manually.
        </div>
      )}
      {badTrigger.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {badTrigger.length} caption{badTrigger.length !== 1 ? "s" : ""} not starting with
          trigger token &quot;{dataset.trigger_token}&quot;.
        </div>
      )}
      {missing.length === 0 && badTrigger.length === 0 && dataset.images.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          All {dataset.images.length} captions look good.
        </div>
      )}

      {/* Image + caption rows */}
      <div className="space-y-4">
        {dataset.images.map((img) => {
          const cap = captions[img.filename] ?? "";
          const hasCaption = cap.trim().length > 0;
          const goodTrigger = cap.startsWith(dataset.trigger_token);

          return (
            <CaptionRow
              key={img.filename}
              datasetId={dataset.id}
              filename={img.filename}
              caption={cap}
              hasCaption={hasCaption}
              goodTrigger={goodTrigger}
              saving={saving === img.filename}
              onSave={save}
            />
          );
        })}
      </div>
    </div>
  );
}

function CaptionRow({
  datasetId,
  filename,
  caption,
  hasCaption,
  goodTrigger,
  saving,
  onSave,
}: {
  datasetId: string;
  filename: string;
  caption: string;
  hasCaption: boolean;
  goodTrigger: boolean;
  saving: boolean;
  onSave: (filename: string, caption: string) => void;
}) {
  const [local, setLocal] = React.useState(caption);
  const [dirty, setDirty] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => { setLocal(caption); setDirty(false); }, [caption]);

  const onChange = (v: string) => {
    setLocal(v);
    setDirty(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { onSave(filename, v); setDirty(false); }, 800);
  };

  const statusColor =
    !hasCaption ? "border-amber-400" : !goodTrigger ? "border-red-400" : "border-green-400";

  return (
    <div className="flex gap-3 rounded-xl border border-border bg-surface/40 p-3">
      {/* Thumbnail */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={api.datasetImageUrl(datasetId, filename)}
          alt={filename}
          className="h-full w-full object-cover"
        />
        <div className={cn("absolute inset-0 rounded-lg border-2", statusColor)} />
      </div>

      {/* Caption */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[11px] text-faint">{filename}</p>
        <textarea
          value={local}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="flex-1 resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-foreground/40"
          placeholder="Caption will appear here after captioning…"
        />
        <div className="flex items-center gap-2 text-[10px] text-faint">
          {saving ? (
            <span className="text-accent">Saving…</span>
          ) : dirty ? (
            <span className="text-amber-500">Unsaved…</span>
          ) : hasCaption ? (
            goodTrigger ? (
              <span className="text-green-500">✓ OK</span>
            ) : (
              <span className="text-red-400">Missing trigger token</span>
            )
          ) : (
            <span className="text-amber-500">No caption</span>
          )}
        </div>
      </div>
    </div>
  );
}
