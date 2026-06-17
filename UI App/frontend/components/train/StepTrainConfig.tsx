"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Copy,
  Download,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { api, type DatasetOut } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface Props {
  dataset: DatasetOut;
}

const inputCls =
  "w-full rounded-md border border-border bg-surface px-3 h-9 text-sm outline-none focus:border-foreground/40";

export function StepTrainConfig({ dataset }: Props) {
  const qc = useQueryClient();
  const { data: runs } = useQuery({ queryKey: ["training"], queryFn: api.listTraining });

  const [name, setName] = React.useState(`${dataset.name} v1`);
  const [baseModel, setBaseModel] = React.useState("flux1-dev");
  const [epochs, setEpochs] = React.useState(25);
  const [lr, setLr] = React.useState("5e-5");
  const [dim, setDim] = React.useState(16);
  const [alpha, setAlpha] = React.useState(16);
  const [resolution, setResolution] = React.useState(1024);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const datasetPath = `storage/training_datasets/${dataset.id}/images`;

  const config = {
    name,
    base_model: baseModel,
    dataset_path: datasetPath,
    trigger_token: dataset.trigger_token,
    epochs,
    learning_rate: lr,
    network_dim: dim,
    network_alpha: alpha,
    resolution,
  };

  const tomlContent = `[model]
name_or_path = "${baseModel}.safetensors"

[network]
type = "lora"
network_dim = ${dim}
network_alpha = ${alpha}

[dataset]
resolution = ${resolution}
batch_size = 1

[[dataset.subsets]]
image_dir = "${datasetPath}"
num_repeats = 10
trigger_word = "${dataset.trigger_token}"

[training]
output_name = "${name.replace(/\s+/g, "_")}"
max_train_epochs = ${epochs}
learning_rate = ${lr}
optimizer_type = "AdamW8bit"
lr_scheduler = "cosine"
save_every_n_epochs = 5
mixed_precision = "bf16"
`;

  const cliCommand =
    `python x-flux/train_flux_lora_ui.py \\
  --config config/flux_lora_config.toml \\
  --pretrained_model_name_or_path ${baseModel}.safetensors \\
  --train_data_dir "${datasetPath}" \\
  --output_name "${name.replace(/\s+/g, "_")}" \\
  --network_dim ${dim} --network_alpha ${alpha} \\
  --max_train_epochs ${epochs} \\
  --learning_rate ${lr}`;

  const saveRun = async () => {
    setSaving(true);
    try {
      await api.createTraining({ name, config });
      qc.invalidateQueries({ queryKey: ["training"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const exportToml = () => {
    const blob = new Blob([tomlContent], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "flux_lora_config.toml";
    a.click();
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(cliCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Training configuration</h2>
        <p className="mt-1 text-sm text-muted">
          Configure your LoRA run. Save the config here, then run the x-flux trainer
          on your GPU machine using the generated TOML or CLI command.
        </p>
      </div>

      {/* Config form */}
      <div className="space-y-4 rounded-xl border border-border bg-surface/40 p-5">
        <div className="grid grid-cols-2 gap-4">
          <label className="col-span-2 block">
            <span className="mb-1.5 block text-xs text-faint">Run name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-faint">Base model</span>
            <select
              value={baseModel}
              onChange={(e) => setBaseModel(e.target.value)}
              className={inputCls}
            >
              <option value="flux1-dev">FLUX.1-dev</option>
              <option value="flux1-schnell">FLUX.1-schnell</option>
              <option value="flux2-dev">FLUX.2-dev</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-faint">Resolution</span>
            <select
              value={resolution}
              onChange={(e) => setResolution(Number(e.target.value))}
              className={inputCls}
            >
              <option value={512}>512</option>
              <option value={768}>768</option>
              <option value={1024}>1024</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-faint">Epochs</span>
            <input
              type="number"
              value={epochs}
              onChange={(e) => setEpochs(Number(e.target.value))}
              min={1}
              max={500}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-faint">Learning rate</span>
            <input
              value={lr}
              onChange={(e) => setLr(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-faint">Network dim (rank)</span>
            <input
              type="number"
              value={dim}
              onChange={(e) => setDim(Number(e.target.value))}
              min={1}
              max={256}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-faint">Network alpha</span>
            <input
              type="number"
              value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
              min={1}
              max={256}
              className={inputCls}
            />
          </label>
        </div>

        {/* Dataset info (read-only) */}
        <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted space-y-1">
          <p>
            <span className="text-faint">Dataset:</span>{" "}
            <code className="text-foreground">{datasetPath}</code>
          </p>
          <p>
            <span className="text-faint">Trigger token:</span>{" "}
            <code className="text-foreground">{dataset.trigger_token}</code>
          </p>
          <p>
            <span className="text-faint">Images:</span>{" "}
            {dataset.image_count} × {resolution}px
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={saveRun}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : saved ? (
              <><CheckCircle2 className="h-4 w-4" /> Saved!</>
            ) : (
              <><GraduationCap className="h-4 w-4" /> Save run</>
            )}
          </Button>
          <Button variant="secondary" size="md" onClick={exportToml} className="gap-2">
            <Download className="h-4 w-4" /> Export TOML
          </Button>
        </div>
      </div>

      {/* CLI command */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-faint">
          CLI command (run on your GPU machine)
        </p>
        <div className="relative rounded-lg border border-border bg-base">
          <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed text-muted font-mono">
            {cliCommand}
          </pre>
          <button
            onClick={copyCommand}
            className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[10px] text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <Copy className="h-3 w-3" />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Saved runs */}
      {runs && runs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">
            Saved runs
          </p>
          {runs.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{String(r.config.name ?? r.id)}</p>
                <p className="text-xs text-faint">
                  {String(r.config.base_model ?? "?")} · {String(r.config.epochs ?? "?")} epochs ·{" "}
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs capitalize text-muted">
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
