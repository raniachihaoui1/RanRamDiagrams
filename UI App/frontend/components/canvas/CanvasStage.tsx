"use client";

import * as React from "react";
import { mediaUrl, type CanvasOp } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";

const SHAPE_TOOLS = new Set(["rect", "ellipse", "line", "arrow"]);

function drawOp(ctx: CanvasRenderingContext2D, op: CanvasOp) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = op.color;
  ctx.fillStyle = op.color;
  ctx.lineWidth = op.size;
  ctx.globalCompositeOperation = op.tool === "eraser" ? "destination-out" : "source-over";

  if (op.kind === "stroke" && op.points && op.points.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(op.points[0], op.points[1]);
    for (let i = 2; i < op.points.length; i += 2) ctx.lineTo(op.points[i], op.points[i + 1]);
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
  const { width, height, layers, baseImage, tool, color, size, addOp } = useCanvasStore();
  const baseElRef = React.useRef<HTMLImageElement | null>(null);
  const [baseReady, setBaseReady] = React.useState(false);
  const draftRef = React.useRef<CanvasOp | null>(null);
  const drawingRef = React.useRef(false);

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

  const render = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // background (paper) when no base image
    if (!baseElRef.current) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(baseElRef.current, 0, 0, canvas.width, canvas.height);
    }
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (const op of layer.ops) drawOp(ctx, op);
    }
    if (draftRef.current) drawOp(ctx, draftRef.current);
  }, [canvasRef, layers]);

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
    if (SHAPE_TOOLS.has(tool)) {
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
    if (d.kind === "stroke") d.points!.push(x, y);
    else {
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
