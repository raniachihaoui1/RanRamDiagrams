"use client";

import * as React from "react";
import { Layers, ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { ModelInfo } from "@/lib/api";
import { Chip } from "@/components/ui/Chip";
import { Popover, PopoverItem } from "@/components/ui/Popover";
import { useGeneratorStore } from "@/store/generator";
import { cn } from "@/lib/utils";

interface Variant {
  id: string;
  label: string;
  sort: number;
}
interface Group {
  base: string;
  variants: Variant[];
}

/**
 * Split a LoRA name into a family base + a variant label. Names that share a
 * base differ only by a trailing version/epoch token, e.g.
 * `BIG_style-000010` → base `BIG_style`, label `000010`. Names without such a
 * token become their own single-variant family.
 */
function parseName(m: ModelInfo): { base: string; label: string; sort: number } {
  const match = m.name.match(
    /^(.*?)[-_\s]+((?:v|ver|version|step|epoch|e)?\s*\d+)$/i
  );
  if (match && match[1].trim()) {
    const token = match[2].trim();
    const num = parseInt(token.replace(/\D/g, ""), 10);
    // Drop leading zeros so `000010` shows as `10`, keeping any prefix (`v02` → `v2`).
    const prefix = token.replace(/\d+$/, "");
    const label = Number.isNaN(num) ? token : `${prefix}${num}`;
    return { base: match[1].trim(), label, sort: Number.isNaN(num) ? 0 : num };
  }
  return { base: m.name, label: m.name, sort: 0 };
}

function buildGroups(loras: ModelInfo[]): Group[] {
  const map = new Map<string, Variant[]>();
  for (const m of loras) {
    const { base, label, sort } = parseName(m);
    const list = map.get(base) ?? [];
    list.push({ id: m.id, label, sort });
    map.set(base, list);
  }
  return [...map.entries()]
    .map(([base, variants]) => ({ base, variants: variants.sort((a, b) => a.sort - b.sort) }))
    .sort((a, b) => a.base.localeCompare(b.base));
}

/** One collapsed row per LoRA family: checkbox to enable + ◀ ▶ to pick a variant. */
function LoraGroupRow({ group }: { group: Group }) {
  const loras = useGeneratorStore((s) => s.loras);
  const patch = useGeneratorStore((s) => s.patch);

  const ids = React.useMemo(() => group.variants.map((v) => v.id), [group]);
  const selectedId = loras.find((x) => ids.includes(x)) ?? null;
  const active = selectedId != null;

  // Which variant the stepper points at; defaults to the active one, else the
  // last (highest epoch — usually the most-trained checkpoint).
  const [idx, setIdx] = React.useState(() => {
    const i = group.variants.findIndex((v) => v.id === selectedId);
    return i >= 0 ? i : group.variants.length - 1;
  });

  // Keep the pointer in sync if the selection changes elsewhere.
  React.useEffect(() => {
    const i = group.variants.findIndex((v) => v.id === selectedId);
    if (i >= 0 && i !== idx) setIdx(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const current = group.variants[idx];

  // Replace any sibling variant of this family with `id` (or clear the family).
  const setSelection = (id: string | null) => {
    const others = loras.filter((x) => !ids.includes(x));
    patch({ loras: id ? [...others, id] : others });
  };

  const toggle = () => setSelection(active ? null : current.id);

  const step = (dir: number) => {
    const next = (idx + dir + group.variants.length) % group.variants.length;
    setIdx(next);
    if (active) setSelection(group.variants[next].id); // swap the live selection
  };

  // Single-variant families render as a plain selectable row (no stepper).
  if (group.variants.length === 1) {
    return (
      <PopoverItem active={active} onClick={toggle}>
        <span className="flex-1 truncate">{group.base}</span>
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
        <span className="truncate">{group.base}</span>
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

export function LoraPicker({ loras }: { loras: ModelInfo[] | undefined }) {
  const count = useGeneratorStore((s) => s.loras.length);
  const groups = React.useMemo(() => buildGroups(loras ?? []), [loras]);

  return (
    <Popover
      className="max-h-80 w-64 overflow-y-auto"
      trigger={
        <Chip icon={<Layers />} active={count > 0}>
          {count ? `LoRA · ${count}` : "LoRA"}
        </Chip>
      }
    >
      {groups.length ? (
        groups.map((g) => <LoraGroupRow key={g.base} group={g} />)
      ) : (
        <p className="px-2 py-2 text-xs text-faint">No LoRAs found</p>
      )}
    </Popover>
  );
}
