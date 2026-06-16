import { create } from "zustand";
import type { ImageOut } from "@/lib/api";

export interface StoryCell {
  index: number;          // row * cols + col
  image?: ImageOut;
  imageFit: "cover" | "contain";
  caption: string;
  numberOverride: string; // "" = use auto number
}

export interface StoryProject {
  id: string | null;
  name: string;
  cols: number;
  rows: number;
  cellW: number;          // px per cell (image area)
  cellH: number;
  captionH: number;       // px reserved for caption text below image
  gap: number;
  padding: number;
  outerBg: string;
  cellBg: string;
  autoNumber: boolean;
  numberStyle: "circle" | "plain";
  numberColor: string;
  numberBg: string;
  cells: StoryCell[];
}

export const PRESETS: Array<{ label: string; cols: number; rows: number }> = [
  { label: "1 × 2", cols: 2, rows: 1 },
  { label: "1 × 3", cols: 3, rows: 1 },
  { label: "1 × 4", cols: 4, rows: 1 },
  { label: "1 × 6", cols: 6, rows: 1 },
  { label: "2 × 2", cols: 2, rows: 2 },
  { label: "2 × 3", cols: 3, rows: 2 },
  { label: "2 × 4", cols: 4, rows: 2 },
  { label: "3 × 3", cols: 3, rows: 3 },
  { label: "3 × 4", cols: 4, rows: 3 },
  { label: "4 × 4", cols: 4, rows: 4 },
];

function makeCells(cols: number, rows: number, existing: StoryCell[] = []): StoryCell[] {
  const total = cols * rows;
  return Array.from({ length: total }, (_, i) => {
    const prev = existing.find((c) => c.index === i);
    return prev ?? {
      index: i,
      imageFit: "cover",
      caption: "",
      numberOverride: "",
    };
  });
}

const DEFAULT: StoryProject = {
  id: null,
  name: "Untitled story",
  cols: 4,
  rows: 1,
  cellW: 512,
  cellH: 512,
  captionH: 60,
  gap: 12,
  padding: 32,
  outerBg: "#FFFFFF",
  cellBg: "#F2F2F2",
  autoNumber: true,
  numberStyle: "circle",
  numberColor: "#FFFFFF",
  numberBg: "#1A1A1A",
  cells: makeCells(4, 1),
};

interface StoryState extends StoryProject {
  selectedIndex: number | null;

  // Grid config
  setName: (n: string) => void;
  applyPreset: (cols: number, rows: number) => void;
  setCols: (n: number) => void;
  setRows: (n: number) => void;
  setCellSize: (w: number, h: number) => void;
  setCaptionH: (n: number) => void;
  setGap: (n: number) => void;
  setPadding: (n: number) => void;
  setOuterBg: (c: string) => void;
  setCellBg: (c: string) => void;
  setAutoNumber: (v: boolean) => void;
  setNumberStyle: (s: "circle" | "plain") => void;
  setNumberColor: (c: string) => void;
  setNumberBg: (c: string) => void;

  // Cell editing
  selectCell: (index: number | null) => void;
  setCellImage: (index: number, img: ImageOut | undefined) => void;
  setCellFit: (index: number, fit: "cover" | "contain") => void;
  setCellCaption: (index: number, text: string) => void;
  setCellNumberOverride: (index: number, text: string) => void;

  reset: () => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  ...DEFAULT,
  selectedIndex: null,

  setName: (name) => set({ name }),

  applyPreset: (cols, rows) =>
    set((s) => ({ cols, rows, cells: makeCells(cols, rows, s.cells) })),

  setCols: (cols) =>
    set((s) => ({
      cols,
      cells: makeCells(cols, s.rows, s.cells),
      selectedIndex: null,
    })),

  setRows: (rows) =>
    set((s) => ({
      rows,
      cells: makeCells(s.cols, rows, s.cells),
      selectedIndex: null,
    })),

  setCellSize: (cellW, cellH) => set({ cellW, cellH }),
  setCaptionH: (captionH) => set({ captionH }),
  setGap: (gap) => set({ gap }),
  setPadding: (padding) => set({ padding }),
  setOuterBg: (outerBg) => set({ outerBg }),
  setCellBg: (cellBg) => set({ cellBg }),
  setAutoNumber: (autoNumber) => set({ autoNumber }),
  setNumberStyle: (numberStyle) => set({ numberStyle }),
  setNumberColor: (numberColor) => set({ numberColor }),
  setNumberBg: (numberBg) => set({ numberBg }),

  selectCell: (selectedIndex) => set({ selectedIndex }),

  setCellImage: (index, img) =>
    set((s) => ({
      cells: s.cells.map((c) =>
        c.index === index ? { ...c, image: img } : c
      ),
    })),

  setCellFit: (index, imageFit) =>
    set((s) => ({
      cells: s.cells.map((c) => (c.index === index ? { ...c, imageFit } : c)),
    })),

  setCellCaption: (index, caption) =>
    set((s) => ({
      cells: s.cells.map((c) => (c.index === index ? { ...c, caption } : c)),
    })),

  setCellNumberOverride: (index, numberOverride) =>
    set((s) => ({
      cells: s.cells.map((c) =>
        c.index === index ? { ...c, numberOverride } : c
      ),
    })),

  reset: () => set({ ...DEFAULT, cells: makeCells(DEFAULT.cols, DEFAULT.rows), selectedIndex: null }),
}));

/** Display number for a cell (1-based auto or the override text). */
export function cellNumber(autoNumber: boolean, index: number, override: string): string {
  if (!autoNumber) return "";
  return override.trim() || String(index + 1).padStart(2, "0");
}
