import { create } from "zustand";
import type { CanvasData, CanvasLayer, CanvasOp, ImageOut } from "@/lib/api";

export type Tool = "brush" | "eraser" | "rect" | "ellipse" | "line" | "arrow" | "stamp";

export const PALETTE = [
  "#FF5A1F", // BIG orange
  "#FFD600", // yellow
  "#1A1A1A", // ink
  "#FFFFFF", // white
  "#999999", // grey
  "#2E7DFF", // blue
  "#3FBF6F", // green
];

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function newLayer(name: string): CanvasLayer {
  return { id: uid(), name, visible: true, ops: [] };
}

interface RedoEntry { layerId: string; op: CanvasOp; }

interface CanvasState {
  projectId: string | null;
  name: string;
  width: number;
  height: number;
  baseImage: ImageOut | null;
  layers: CanvasLayer[];
  activeLayerId: string;
  tool: Tool;
  color: string;
  size: number;
  symbol: string;
  undoStack: string[];   // layerId per committed op
  redoStack: RedoEntry[]; // ops that can be re-applied

  setTool: (t: Tool) => void;
  setColor: (c: string) => void;
  setSize: (n: number) => void;
  setSymbol: (id: string) => void;

  addLayer: () => void;
  removeLayer: (id: string) => void;
  toggleLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;

  setBaseImage: (img: ImageOut | null) => void;
  addOp: (op: CanvasOp) => void;
  undo: () => void;
  redo: () => void;
  clearActive: () => void;

  setName: (n: string) => void;
  setProjectId: (id: string | null) => void;
  loadData: (data: CanvasData, baseImage: ImageOut | null) => void;
  toData: () => CanvasData;
  reset: () => void;
}

function freshLayers(): { layers: CanvasLayer[]; activeLayerId: string } {
  const l = newLayer("Layer 1");
  return { layers: [l], activeLayerId: l.id };
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  projectId: null,
  name: "Untitled canvas",
  width: 1024,
  height: 1024,
  baseImage: null,
  ...freshLayers(),
  tool: "brush",
  color: PALETTE[0],
  size: 6,
  symbol: "human-standing",
  undoStack: [],
  redoStack: [],

  setTool: (t) => set({ tool: t }),
  setColor: (c) => set({ color: c }),
  setSize: (n) => set({ size: n }),
  setSymbol: (id) => set({ symbol: id, tool: "stamp" }),

  addLayer: () =>
    set((s) => {
      const l = newLayer(`Layer ${s.layers.length + 1}`);
      return { layers: [...s.layers, l], activeLayerId: l.id };
    }),

  removeLayer: (id) =>
    set((s) => {
      if (s.layers.length <= 1) return s;
      const layers = s.layers.filter((l) => l.id !== id);
      const activeLayerId = s.activeLayerId === id ? layers[layers.length - 1].id : s.activeLayerId;
      return { layers, activeLayerId };
    }),

  toggleLayer: (id) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    })),

  setActiveLayer: (id) => set({ activeLayerId: id }),

  setBaseImage: (img) =>
    set(() =>
      img
        ? { baseImage: img, width: img.width, height: img.height }
        : { baseImage: null }
    ),

  addOp: (op) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === s.activeLayerId ? { ...l, ops: [...l.ops, op] } : l
      ),
      undoStack: [...s.undoStack, s.activeLayerId],
      redoStack: [], // new stroke invalidates the redo history
    })),

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s;
      const layerId = s.undoStack[s.undoStack.length - 1];
      const layer = s.layers.find((l) => l.id === layerId);
      if (!layer || layer.ops.length === 0) return s;
      const op = layer.ops[layer.ops.length - 1];
      return {
        layers: s.layers.map((l) =>
          l.id === layerId ? { ...l, ops: l.ops.slice(0, -1) } : l
        ),
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, { layerId, op }],
      };
    }),

  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return s;
      const { layerId, op } = s.redoStack[s.redoStack.length - 1];
      return {
        layers: s.layers.map((l) =>
          l.id === layerId ? { ...l, ops: [...l.ops, op] } : l
        ),
        undoStack: [...s.undoStack, layerId],
        redoStack: s.redoStack.slice(0, -1),
      };
    }),

  clearActive: () =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === s.activeLayerId ? { ...l, ops: [] } : l
      ),
      undoStack: s.undoStack.filter((id) => id !== s.activeLayerId),
      redoStack: [],
    })),

  setName: (n) => set({ name: n }),
  setProjectId: (id) => set({ projectId: id }),

  loadData: (data, baseImage) =>
    set({
      baseImage,
      width: data.width ?? 1024,
      height: data.height ?? 1024,
      layers: data.layers?.length ? data.layers : freshLayers().layers,
      activeLayerId: data.layers?.length ? data.layers[0].id : get().activeLayerId,
      undoStack: [],
      redoStack: [],
    }),

  toData: () => {
    const s = get();
    return {
      baseImageId: s.baseImage?.id ?? null,
      width: s.width,
      height: s.height,
      layers: s.layers,
    };
  },

  reset: () =>
    set({
      projectId: null,
      name: "Untitled canvas",
      width: 1024,
      height: 1024,
      baseImage: null,
      ...freshLayers(),
      undoStack: [],
      redoStack: [],
    }),
}));
