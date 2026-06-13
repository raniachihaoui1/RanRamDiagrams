"use client";

import * as React from "react";
import { mediaUrl, type CanvasOp } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";
import { STAMP_MAP } from "@/lib/stamps";

const SHAPE_TOOLS = new Set(["rect", "ellipse", "line", "arrow"]);
const STAMP_MULT = 5; // stamp tip size = brush size * this (slider 1..64 → ~5..320px)
const STAMP_MIN = 24;

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
    // Symbol brush: stamp the tip along the stroke path (Photoshop-style
    // spacing). A single click (one point) places one stamp.
    const tip = op.size;
    const pts = op.points;
    if (!pts || pts.length < 4) {
      placeStamp(ctx, op.symbolId, op.x0 ?? pts?.[0] ?? 0, op.y0 ?? pts?.[1] ?? 0, tip, op.color);
    } else {
      const spacing = Math.max(6, tip * 0.9);
      let prevX = pts[0];
      let prevY = pts[1];
      placeStamp(ctx, op.symbolId, prevX, prevY, tip, op.color);
      let sinceLast = 0; // distance accumulated across segments since last stamp
      for (let i = 2; i < pts.length; i += 2) {
        const x = pts[i];
        const y = pts[i + 1];
        const segLen = Math.hypot(x - prevX, y - prevY);
        if (segLen === 0) continue;
        const dirX = (x - prevX) / segLen;
        const dirY = (y - prevY) / segLen;
        let t = 0; // consumed along this segment
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
      // Quadratic smoothing through midpoints → pen-like strokes.
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
  // One offscreen canvas per layer so the eraser is layer-local (reveals the
  // base/lower layers instead of cutting a hole to the page background).
  const layerCanvases = React.useRef<Map<string, HTMLCanvasElement>>(new Map());

  // Load base image
  React.useEffect(() => {
    if (!baseImage) {
      baseElRef.current = null;
      setBaseReady(false);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      baseElRef.current = img;
      setBaseReady(true);
    };
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
    // background (paper) or base image
    if (!baseElRef.current) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(baseElRef.current, 0, 0, canvas.width, canvas.height);
    }
    // composite each visible layer (rendered on its own canvas) over the base
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

  React.useEffect(() => {
    render();
  }, [render, baseReady, width, height]);

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
    if (!drawingRef.current || !draftRef.current) return;
    const { x, y } = toCanvasCoords(e);
    const d = draftRef.current;
    if (d.kind === "stroke" || d.kind === "stamp") {
      d.points!.push(x, y);
    } else {
      d.x1 = x;
      d.y1 = y;
    }
    render();
  };

  const onUp = () => {
    if (draftRef.current) {
      addOp(draftRef.current);
      draftRef.current = null;
    }
    drawingRef.current = false;
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="max-h-full max-w-full touch-none rounded-lg border border-border shadow-[var(--shadow-panel)]"
        style={{ aspectRatio: `${width} / ${height}`, cursor: "crosshair" }}
      />
    </div>
  );
}
