"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Info, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";

export default function TrainPage() {
  const qc = useQueryClient();
  const { data: runs } = useQuery({ queryKey: ["training"], queryFn: api.listTraining });

  const [name, setName] = React.useState("BIG style v1");
  const [baseModel, setBaseModel] = React.useState("flux2-dev");
  const [dataset, setDataset] = React.useState("data/dataset/img/10_BIG_style_diagram");
  const [epochs, setEpochs] = React.useState(25);
  const [lr, setLr] = React.useState("5e-5");
  const [dim, setDim] = React.useState(16);

  const create = useMutation({
    mutationFn: () =>
      api.createTraining({
        name,
        config: { base_model: baseModel, dataset, epochs, learning_rate: lr, network_dim: dim },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training"] }),
  });

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Train LoRA</h1>
          <p className="text-sm text-muted">Define a run from your dataset.</p>
        </div>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-border bg-surface/50 p-3 text-sm text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This records a run definition. Actual GPU training wires into the repo’s
          x-flux pipeline (<code className="text-foreground">scripts/</code>) and runs
          outside the app — coming later.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4 rounded-xl border border-border bg-surface/40 p-5">
        <Field label="Run name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Base model">
            <input value={baseModel} onChange={(e) => setBaseModel(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Network dim">
            <input type="number" value={dim} onChange={(e) => setDim(Number(e.target.value))} className={inputCls} />
          </Field>
        </div>
        <Field label="Dataset path">
          <input value={dataset} onChange={(e) => setDataset(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Epochs">
            <input type="number" value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Learning rate">
            <input value={lr} onChange={(e) => setLr(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="gap-2"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
          Create run
        </Button>
      </div>

      {/* Runs */}
      <h2 className="mb-3 mt-8 text-sm font-medium uppercase tracking-wider text-faint">Runs</h2>
      <div className="space-y-2">
        {runs && runs.length > 0 ? (
          runs.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{String(r.config.name ?? "Run")}</p>
                <p className="text-xs text-faint">
                  {String(r.config.base_model ?? "")} · {String(r.config.epochs ?? "?")} epochs ·{" "}
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <span className="rounded-pill border border-border bg-surface-2 px-2.5 py-1 text-xs capitalize text-muted">
                {r.status}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
            No runs yet.
          </p>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-surface px-3 h-10 text-sm outline-none focus:border-border-strong";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-faint">{label}</span>
      {children}
    </label>
  );
}
