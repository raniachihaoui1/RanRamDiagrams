"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { api, type DatasetOut, type PrepareResult } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface Props {
  dataset: DatasetOut;
  onDone: (result: PrepareResult) => void;
}

export function StepPrepare({ dataset, onDone }: Props) {
  const [resolution, setResolution] = React.useState(1024);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<PrepareResult | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      const r = await api.prepareDataset(dataset.id, resolution);
      setResult(r);
      if (r.ready) onDone(r);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Prepare dataset</h2>
        <p className="mt-1 text-sm text-muted">
          Validates captions, writes <code className="rounded bg-surface-2 px-1 text-xs">.txt</code> sidecars,
          and resizes all images to a square canvas.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-surface/40 p-5">
        <label className="block">
          <span className="mb-1.5 block text-xs text-faint">Target resolution</span>
          <select
            value={resolution}
            onChange={(e) => setResolution(Number(e.target.value))}
            className="h-9 rounded-md border border-border bg-surface px-3 text-sm outline-none"
          >
            <option value={512}>512 × 512</option>
            <option value={768}>768 × 768</option>
            <option value={1024}>1024 × 1024 (recommended for FLUX)</option>
          </select>
        </label>

        <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted space-y-1">
          <p>• Images already at target size are left unchanged</p>
          <p>• Smaller images are padded to a white square (not stretched)</p>
          <p>• Each image gets a <code className="text-foreground">.txt</code> sidecar with its caption</p>
          <p>• Dataset folder: <code className="text-foreground">storage/training_datasets/{dataset.id}/images/</code></p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={run}
          disabled={running}
          className="gap-2"
        >
          {running ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</>
          ) : (
            "Validate & prepare"
          )}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-3 rounded-xl border border-border bg-surface/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">Report</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Total images" value={String(result.total)} />
            <Stat label="Resized" value={String(result.resized)} />
          </div>

          {result.missing_captions.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="font-medium">Missing captions ({result.missing_captions.length})</p>
                <p className="mt-0.5 font-mono text-[10px]">
                  {result.missing_captions.slice(0, 5).join(", ")}
                  {result.missing_captions.length > 5 && ` +${result.missing_captions.length - 5} more`}
                </p>
              </div>
            </div>
          )}

          {result.bad_trigger.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-500">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="font-medium">Bad trigger token ({result.bad_trigger.length})</p>
                <p className="mt-0.5 font-mono text-[10px]">
                  {result.bad_trigger.slice(0, 5).join(", ")}
                </p>
              </div>
            </div>
          )}

          {result.ready && (
            <div className="flex items-center gap-2 rounded-lg border border-green-400/30 bg-green-400/10 p-3 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Dataset is ready for training!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
