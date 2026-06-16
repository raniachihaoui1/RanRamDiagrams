"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronRight } from "lucide-react";
import { api, type DatasetOut } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-md border border-border bg-surface px-3 h-10 text-sm outline-none focus:border-foreground/40";

interface Props {
  onSelect: (ds: DatasetOut) => void;
}

export function StepDataset({ onSelect }: Props) {
  const qc = useQueryClient();
  const { data: datasets, isLoading } = useQuery({
    queryKey: ["datasets"],
    queryFn: api.listDatasets,
  });

  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("My LoRA dataset");
  const [trigger, setTrigger] = React.useState("my_style");
  const [desc, setDesc] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const create = async () => {
    if (!name.trim() || !trigger.trim()) return;
    setSaving(true);
    try {
      const ds = await api.createDataset({
        name: name.trim(),
        trigger_token: trigger.trim(),
        description: desc.trim(),
      });
      qc.invalidateQueries({ queryKey: ["datasets"] });
      onSelect(ds);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteDataset(id);
    qc.invalidateQueries({ queryKey: ["datasets"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Dataset</h2>
        <p className="mt-1 text-sm text-muted">
          Create a new dataset or continue with an existing one.
        </p>
      </div>

      {/* Existing datasets */}
      {!isLoading && datasets && datasets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">
            Existing datasets
          </p>
          {datasets.map((ds) => (
            <button
              key={ds.id}
              onClick={() => onSelect(ds)}
              className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface/50 px-4 py-3 text-left transition-colors hover:bg-surface-2/70"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{ds.name}</p>
                <p className="mt-0.5 truncate text-xs text-faint">
                  trigger: <code className="text-foreground">{ds.trigger_token}</code>
                  {" · "}
                  {ds.image_count} image{ds.image_count !== 1 ? "s" : ""}
                  {" · "}
                  <span className={cn(
                    "capitalize",
                    ds.status === "prepared" ? "text-green-600 dark:text-green-400" :
                    ds.status === "captioned" ? "text-blue-500" : "text-faint"
                  )}>{ds.status}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={(e) => remove(ds.id, e)}
                  className="rounded p-1 text-faint opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronRight className="h-4 w-4 text-faint" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* New dataset form */}
      {creating ? (
        <div className="space-y-4 rounded-xl border border-border bg-surface/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">
            New dataset
          </p>
          <label className="block">
            <span className="mb-1.5 block text-xs text-faint">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My LoRA dataset"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-faint">
              Trigger token{" "}
              <span className="text-faint/60">
                (the keyword that activates this LoRA in prompts)
              </span>
            </span>
            <input
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="BIG_arch_diagram"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-faint">
              Style description{" "}
              <span className="text-faint/60">(used to guide Claude&apos;s captions)</span>
            </span>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="e.g. bold architectural diagrams with white backgrounds, black line weights, and orange accent colours in the style of Bjarke Ingels Group"
              className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground/40"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={create} disabled={saving || !name.trim() || !trigger.trim()}>
              {saving ? "Creating…" : "Create & continue"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="md"
          onClick={() => setCreating(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> New dataset
        </Button>
      )}
    </div>
  );
}
