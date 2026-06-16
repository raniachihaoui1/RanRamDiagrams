"use client";

import * as React from "react";
import { ZoomIn, ZoomOut, Columns2, X } from "lucide-react";
import { mediaUrl, type CanvasOp } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { STAMP_MAP } from "@/lib/stamps";
import { cn } from "@/lib/utils";

const SHAPE_TOOLS = new Set(["rect", "ellipse", "line", "arrow"]);
const STAMP_MULT = 5;
const STAMP_MIN = 24;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;
const VIEWPORT_PAD = 48;

/** Place one symbol centered at (cx, cy) at the given tip size. */
function placeStamp(
  ctx: CanvasRenderingContext2D,
  symbolId: string,
  cx: number,
  cy: number,
  s: number,
  color: string
) {
  const sym = STAMP_MAP[symbolId];
  if (!sym) return;
  ctx.save();
  ctx.translate(cx - s / 2, cy - s / 2);
  ctx.scale(s / 100, s / 100);
  sym.draw(ctx, color);
  ctx.restore();
}

function drawOp(ctx: CanvasRenderingContext2D, op: CanvasOp) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = op.color;
  ctx.fillStyle = op.color;
  ctx.lineWidth = op.size;
  ctx.globalCompositeOperation = op.tool === "eraser" ? "destination-out" : "source-over";

  if (op.kind === "stamp" && op.symbolId) {
    const tip = op.size;
    const pts = op.points;
    if (!pts || pts.length < 4) {
      placeStamp(ctx, op.symbolId, op.x0 ?? pts?.[0] ?? 0, op.y0 ?? pts?.[1] ?? 0, tip, op.color);
    } else {
      const spacing = Math.max(6, tip * 0.9);
      let prevX = pts[0];
      let prevY = pts[1];
      placeStamp(ctx, op.symbolId, prevX, prevY, tip, op.color);
      let sinceLast = 0;
      for (let i = 2; i < pts.length; i += 2) {
        const x = pts[i];
        const y = pts[i + 1];
        const segLen = Math.hypot(x - prevX, y - prevY);
        if (segLen === 0) continue;
        const dirX = (x - prevX) / segLen;
        const dirY = (y - prevY) / segLen;
        let t = 0;
        while (sinceLast + (segLen - t) >= spacing) {
          t += spacing - sinceLast;
          placeStamp(ctx, op.symbolId, prevX + dirX * t, prevY + dirY * t, tip, op.color);
          sinceLast = 0;
        }
        sinceLast += segLen - t;
        prevX = x;
        prevY = y;
      }
    }
  } else if (op.kind === "stroke" && op.points && op.points.length >= 2) {
    const p = op.points;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    if (p.length < 6) {
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    } else {
      for (let i = 2; i < p.length - 2; i += 2) {
        const xc = (p[i] + p[i + 2]) / 2;
        const yc = (p[i + 1] + p[i + 3]) / 2;
        ctx.quadraticCurveTo(p[i], p[i + 1], xc, yc);
      }
      ctx.lineTo(p[p.length - 2], p[p.length - 1]);
    }
    ctx.stroke();
  } else if (op.kind === "shape" && op.x0 != null) {
    const { x0 = 0, y0 = 0, x1 = 0, y1 = 0 } = op;
    if (op.tool === "rect") {
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    } else if (op.tool === "ellipse") {
      ctx.beginPath();
      ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (op.tool === "line" || op.tool === "arrow") {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (op.tool === "arrow") {
        const ang = Math.atan2(y1 - y0, x1 - x0);
        const head = Math.max(12, op.size * 3);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - head * Math.cos(ang - Math.PI / 6), y1 - head * Math.sin(ang - Math.PI / 6));
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - head * Math.cos(ang + Math.PI / 6), y1 - head * Math.sin(ang + Math.PI / 6));
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function CanvasStage({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const { width, height, layers, activeLayerId, baseImage, tool, color, size, symbol, addOp } =
    useCanvasStore();
  const baseElRef = React.useRef<HTMLImageElement | null>(null);
  const [baseReady, setBaseReady] = React.useState(false);
  const draftRef = React.useRef<CanvasOp | null>(null);
  const drawingRef = React.useRef(false);
  const layerCanvases = React.useRef<Map<string, HTMLCanvasElement>>(new Map());

  // ── Keyboard shortcuts: Ctrl+Z undo / Ctrl+Y + Ctrl+Shift+Z redo ─────────
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      // Don't intercept when typing in an input or textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) {
          useCanvasStore.getState().redo();
        } else {
          useCanvasStore.getState().undo();
        }
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        useCanvasStore.getState().redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Before / After compare mode ───────────────────────────────────────────
  const [compareMode, setCompareMode] = React.useState(false);
  const [compareSnap, setCompareSnap] = React.useState<string | null>(null);

  const toggleCompare = React.useCallback(() => {
    setCompareMode((on) => {
      if (!on) {
        // Capture a snapshot of the current canvas state as the "after" image.
        const snap = canvasRef.current?.toDataURL("image/png") ?? null;
        setCompareSnap(snap);
      }
      return !on;
    });
  }, [canvasRef]);

  // Exit compare mode whenever the user draws a new stroke (canvas changed).
  React.useEffect(() => {
    if (compareMode) setCompareMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  // ── Zoom ───────────────────────────────────────────────────────────────────
  const [zoom, setZoom] = React.useState(1);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [availSize, setAvailSize] = React.useState({ w: 800, h: 600 });

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setAvailSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoom]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parseFloat((z + delta).toFixed(2)))));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, parseFloat((z + ZOOM_STEP).toFixed(2))));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, parseFloat((z - ZOOM_STEP).toFixed(2))));

  const ar = width / height;
  const availW = Math.max(1, availSize.w - VIEWPORT_PAD * 2);
  const availH = Math.max(1, availSize.h - VIEWPORT_PAD * 2);
  const naturalW = ar > availW / availH ? availW : availH * ar;
  const naturalH = ar > availW / availH ? availW / ar : availH;
  const displayW = Math.round(naturalW * zoom);
  const displayH = Math.round(naturalH * zoom);

  // ── Ghost / cursor preview ─────────────────────────────────────────────────
  // A transparent overlay canvas sits on top of the main canvas and shows a
  // ghosted stamp at the cursor position when the stamp tool is active.
  const overlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const cursorPosRef = React.useRef<{ x: number; y: number } | null>(null);
  const isHoveringRef = React.useRef(false);

  const renderGhost = React.useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!isHoveringRef.current || !cursorPosRef.current || tool !== "stamp" || !symbol) return;
    const { x, y } = cursorPosRef.current;
    const tip = Math.max(STAMP_MIN, size * STAMP_MULT);
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    placeStamp(ctx, symbol, x, y, tip, color);
    ctx.restore();
  }, [tool, symbol, size, color]);

  // Redraw ghost when tool/symbol/size/color changes (cursor may not have moved).
  React.useEffect(() => {
    renderGhost();
  }, [renderGhost]);

  // ── Drawing ────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!baseImage) {
      baseElRef.current = null;
      setBaseReady(false);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { baseElRef.current = img; setBaseReady(true); };
    img.src = mediaUrl(baseImage.url);
  }, [baseImage]);

  const getLayerCanvas = React.useCallback(
    (id: string): HTMLCanvasElement => {
      let lc = layerCanvases.current.get(id);
      if (!lc) {
        lc = document.createElement("canvas");
        layerCanvases.current.set(id, lc);
      }
      if (lc.width !== width || lc.height !== height) {
        lc.width = width;
        lc.height = height;
      }
      return lc;
    },
    [width, height]
  );

  const render = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!baseElRef.current) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(baseElRef.current, 0, 0, canvas.width, canvas.height);
    }
    for (const layer of layers) {
      if (!layer.visible) continue;
      const lc = getLayerCanvas(layer.id);
      const lctx = lc.getContext("2d");
      if (!lctx) continue;
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, lc.width, lc.height);
      for (const op of layer.ops) drawOp(lctx, op);
      if (layer.id === activeLayerId && draftRef.current) drawOp(lctx, draftRef.current);
      ctx.drawImage(lc, 0, 0);
    }
  }, [canvasRef, layers, activeLayerId, getLayerCanvas]);

  React.useEffect(() => { render(); }, [render, baseReady, width, height]);

  // getBoundingClientRect() accounts for CSS display size, so zoom is
  // transparent to the drawing coordinate system — no changes needed here.
  const toCanvasCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = toCanvasCoords(e);
    cursorPosRef.current = { x, y };
    if (tool === "stamp") {
      const tip = Math.max(STAMP_MIN, size * STAMP_MULT);
      draftRef.current = { kind: "stamp", tool, color, size: tip, symbolId: symbol, points: [x, y], x0: x, y0: y };
    } else if (SHAPE_TOOLS.has(tool)) {
      draftRef.current = { kind: "shape", tool, color, size, x0: x, y0: y, x1: x, y1: y };
    } else {
      draftRef.current = { kind: "stroke", tool, color, size, points: [x, y] };
    }
    render();
  };

  const onMove = (e: React.PointerEvent) => {
    const pos = toCanvasCoords(e);
    cursorPosRef.current = pos;

    if (!drawingRef.current || !draftRef.current) {
      // Not drawing — just update the ghost preview.
      renderGhost();
      return;
    }

    const { x, y } = pos;
    const d = draftRef.current;
    if (d.kind === "stroke" || d.kind === "stamp") {
      d.points!.push(x, y);
    } else {
      d.x1 = x;
      d.y1 = y;
    }
    render();
    renderGhost();
  };

  const onUp = () => {
    if (draftRef.current) {
      addOp(draftRef.current);
      draftRef.current = null;
    }
    drawingRef.current = false;
  };

  const onEnter = () => {
    isHoveringRef.current = true;
  };

  const onLeave = () => {
    isHoveringRef.current = false;
    cursorPosRef.current = null;
    renderGhost(); // clear the overlay
    onUp();        // commit any in-progress stroke
  };

  const isStamp = tool === "stamp";

  return (
    <div className="relative h-full">
      {/* Scrollable viewport */}
      <div ref={scrollRef} className="h-full overflow-auto">
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "100%", minWidth: "100%", padding: VIEWPORT_PAD }}
        >
          {/* Two canvases stacked: main (drawing) + overlay (ghost preview) */}
          <div className="relative" style={{ width: displayW, height: displayH }}>
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onLeave}
              onPointerEnter={onEnter}
              className="absolute inset-0 touch-none rounded-lg border border-border shadow-[var(--shadow-panel)]"
              style={{
                width: displayW,
                height: displayH,
                cursor: isStamp ? "none" : "crosshair",
              }}
            />
            <canvas
              ref={overlayRef}
              width={width}
              height={height}
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{ width: displayW, height: displayH }}
            />
          </div>
        </div>
      </div>

      {/* ── Before / After overlay ── */}
      {compareMode && baseImage && compareSnap && (
        <div className="absolute inset-0 z-20">
          <BeforeAfterSlider
            before={mediaUrl(baseImage.url)}
            after={compareSnap}
            beforeLabel="Original"
            afterLabel="Canvas"
            className="h-full w-full"
          />
        </div>
      )}

      {/* ── Compare toggle button (top-right) ── */}
      {baseImage && (
        <button
          onClick={toggleCompare}
          title={compareMode ? "Exit comparison" : "Compare original vs canvas"}
          className={cn(
            "absolute right-4 top-4 z-30 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur-xl transition-colors",
            compareMode
              ? "border-accent bg-accent text-accent-foreground hover:opacity-90"
              : "border-border bg-surface-2/90 text-muted hover:bg-surface hover:text-foreground"
          )}
        >
          {compareMode ? <X className="h-3.5 w-3.5" /> : <Columns2 className="h-3.5 w-3.5" />}
          {compareMode ? "Exit" : "Compare"}
        </button>
      )}

      {/* ── Zoom HUD (bottom-center) ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border bg-surface-2/90 p-1 shadow-md backdrop-blur-xl">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground",
              zoom <= MIN_ZOOM && "opacity-30"
            )}
            title="Zoom out (Ctrl + scroll)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="min-w-[3.5rem] rounded-md px-2 py-1 text-center text-xs tabular-nums text-muted transition-colors hover:bg-surface hover:text-foreground"
            title="Reset to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground",
              zoom >= MAX_ZOOM && "opacity-30"
            )}
            title="Zoom in (Ctrl + scroll)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
