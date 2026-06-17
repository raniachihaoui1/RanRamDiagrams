"use client";

import * as React from "react";
import { Eye, EyeOff, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { API_URL } from "@/lib/config";
import { type DatasetOut } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface CaptionEvent {
  type: "progress" | "captioned" | "error" | "done";
  index?: number;
  total?: number;
  filename?: string;
  caption?: string;
  error?: string;
}

interface Props {
  dataset: DatasetOut;
  onDone: (captions: Record<string, string>) => void;
}

const LS_KEY = "anthropic_api_key";

export function StepCaption({ dataset, onDone }: Props) {
  const [apiKey, setApiKey] = React.useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(LS_KEY) ?? "" : ""
  );
  const [showKey, setShowKey] = React.useState(false);
  const [model, setModel] = React.useState("claude-opus-4-6");
  const [running, setRunning] = React.useState(false);
  const [events, setEvents] = React.useState<CaptionEvent[]>([]);
  const [done, setDone] = React.useState(false);
  const [captions, setCaptions] = React.useState<Record<string, string>>(
    dataset.captions ?? {}
  );
  const logRef = React.useRef<HTMLDivElement>(null);

  // Persist API key to localStorage
  const handleKeyChange = (v: string) => {
    setApiKey(v);
    try { localStorage.setItem(LS_KEY, v); } catch { /* private mode */ }
  };

  const alreadyCaptioned = Object.keys(captions).length;

  const run = async () => {
    if (!apiKey.trim()) return;
    setRunning(true);
    setDone(false);
    setEvents([]);

    try {
      const res = await fetch(`${API_URL}/api/train/datasets/${dataset.id}/caption`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey.trim(), model }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        setEvents([{ type: "error", error: `${res.status}: ${text}` }]);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const newCaptions: Record<string, string> = { ...captions };

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt: CaptionEvent = JSON.parse(line.slice(6));
            setEvents((prev) => [...prev, evt]);
            if (evt.type === "captioned" && evt.filename && evt.caption) {
              newCaptions[evt.filename] = evt.caption;
              setCaptions({ ...newCaptions });
            }
            if (evt.type === "done") {
              setDone(true);
              onDone(newCaptions);
            }
            // Auto-scroll log
            requestAnimationFrame(() => {
              if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
            });
          } catch { /* malformed event */ }
        }
      }
    } catch (err) {
      setEvents((prev) => [...prev, { type: "error", error: String(err) }]);
    } finally {
      setRunning(false);
    }
  };

  const latestProgress = events.filter((e) => e.type === "progress" || e.type === "captioned").at(-1);
  const total = dataset.images.length;
  const completed = events.filter((e) => e.type === "captioned").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Auto-caption with Claude</h2>
        <p className="mt-1 text-sm text-muted">
          Claude Vision analyses each image and generates a LoRA training caption
          starting with your trigger token{" "}
          <code className="rounded bg-surface-2 px-1 text-xs">{dataset.trigger_token}</code>.
          {alreadyCaptioned > 0 && (
            <> {alreadyCaptioned} image{alreadyCaptioned !== 1 ? "s" : ""} already captioned.</>
          )}
        </p>
      </div>

      {/* API key */}
      <div className="space-y-3 rounded-xl border border-border bg-surface/40 p-5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-faint">
            Anthropic API key
            <span className="ml-1 text-faint/60">(stored locally, never sent to our servers)</span>
          </span>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="sk-ant-api03-…"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 pr-10 text-sm outline-none focus:border-foreground/40 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-faint">Model</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-3 text-sm outline-none"
          >
            <option value="claude-opus-4-6">claude-opus-4-6 (best quality)</option>
            <option value="claude-sonnet-4-6">claude-sonnet-4-6 (faster)</option>
            <option value="claude-haiku-4-5-20251001">claude-haiku-4-5 (fastest)</option>
          </select>
        </label>

        <Button
          variant="primary"
          size="md"
          onClick={run}
          disabled={running || !apiKey.trim() || total === 0}
          className="gap-2"
        >
          {running ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
          ) : done ? (
            <><CheckCircle2 className="h-4 w-4" /> Re-run captioning</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Run captioning ({total} images)</>
          )}
        </Button>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{latestProgress?.filename ?? "Starting…"}</span>
            <span className="tabular-nums">{completed}/{total}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Done summary */}
      {done && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          All {total} images captioned. Proceed to Review to inspect and edit them.
        </div>
      )}

      {/* Event log */}
      {events.length > 0 && (
        <div
          ref={logRef}
          className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-border bg-base p-3 font-mono text-[11px]"
        >
          {events.map((e, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2",
                e.type === "error" ? "text-red-500" :
                e.type === "captioned" ? "text-green-500 dark:text-green-400" :
                e.type === "done" ? "text-accent font-semibold" :
                "text-muted"
              )}
            >
              <span className="shrink-0 tabular-nums text-faint">
                {e.type === "progress" && `[${(e.index ?? 0) + 1}/${e.total}]`}
                {e.type === "captioned" && `[✓ ${(e.index ?? 0) + 1}/${e.total}]`}
                {e.type === "error" && "[✗]"}
                {e.type === "done" && "[done]"}
              </span>
              <span className="min-w-0 truncate">
                {e.type === "progress" && e.filename}
                {e.type === "captioned" && (e.caption?.slice(0, 100) + (e.caption && e.caption.length > 100 ? "…" : ""))}
                {e.type === "error" && e.error}
                {e.type === "done" && `All ${e.total} images captioned.`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
