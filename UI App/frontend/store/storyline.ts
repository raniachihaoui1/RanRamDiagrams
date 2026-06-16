import { create } from "zustand";
import type { ImageOut } from "@/lib/api";

export interface StoryCell {
  index: number;
  image?: ImageOut;
  imageFit: "cover" | "contain";
  caption: string;
  numberOverride: string;
}

export interface StoryProject {
  id: string | null;
  name: string;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  captionH: number;
  gap: number;
  padding: number;
  outerBg: string;
  cellBg: string;
  autoNumber: boolean;
  numberStyle: "circle" | "plain";
  numberColor: string;
  numberBg: string;
  // Caption typography
  captionFontFamily: string;
  captionFontSize: number;
  captionBold: boolean;
  captionColor: string;
  captionAlign: "left" | "center" | "right";
  captionBg: string;
  cells: StoryCell[];
}

export const CAPTION_FONTS: Array<{ label: string; value: string }> = [
  { label: "Sans-serif", value: "ui-sans-serif, system-ui, sans-serif" },
  { label: "Serif",      value: "ui-serif, Georgia, serif" },
  { label: "Mono",       value: "ui-monospace, 'Courier New', monospace" },
  { label: "Arial",      value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia",    value: "Georgia, serif" },
  { label: "Helvetica",  value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
];

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
    return prev ?? { index: i, imageFit: "cover", caption: "", numberOverride: "" };
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
  captionFontFamily: "ui-sans-serif, system-ui, sans-serif",
  captionFontSize: 13,
  captionBold: false,
  captionColor: "#1A1A1A",
  captionAlign: "left",
  captionBg: "#FFFFFF",
  cells: makeCells(4, 1),
};

interface StoryState extends StoryProject {
  selectedIndex: number | null;

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
  // Caption typography setters
  setCaptionFontFamily: (v: string) => void;
  setCaptionFontSize: (n: number) => void;
  setCaptionBold: (v: boolean) => void;
  setCaptionColor: (c: string) => void;
  setCaptionAlign: (a: "left" | "center" | "right") => void;
  setCaptionBg: (c: string) => void;

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
    set((s) => ({ cols, cells: makeCells(cols, s.rows, s.cells), selectedIndex: null })),

  setRows: (rows) =>
    set((s) => ({ rows, cells: makeCells(s.cols, rows, s.cells), selectedIndex: null })),

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

  setCaptionFontFamily: (captionFontFamily) => set({ captionFontFamily }),
  setCaptionFontSize: (captionFontSize) => set({ captionFontSize }),
  setCaptionBold: (captionBold) => set({ captionBold }),
  setCaptionColor: (captionColor) => set({ captionColor }),
  setCaptionAlign: (captionAlign) => set({ captionAlign }),
  setCaptionBg: (captionBg) => set({ captionBg }),

  selectCell: (selectedIndex) => set({ selectedIndex }),

  setCellImage: (index, img) =>
    set((s) => ({ cells: s.cells.map((c) => (c.index === index ? { ...c, image: img } : c)) })),

  setCellFit: (index, imageFit) =>
    set((s) => ({ cells: s.cells.map((c) => (c.index === index ? { ...c, imageFit } : c)) })),

  setCellCaption: (index, caption) =>
    set((s) => ({ cells: s.cells.map((c) => (c.index === index ? { ...c, caption } : c)) })),

  setCellNumberOverride: (index, numberOverride) =>
    set((s) => ({ cells: s.cells.map((c) => (c.index === index ? { ...c, numberOverride } : c)) })),

  reset: () => set({ ...DEFAULT, cells: makeCells(DEFAULT.cols, DEFAULT.rows), selectedIndex: null }),
}));

export function cellNumber(autoNumber: boolean, index: number, override: string): string {
  if (!autoNumber) return "";
  return override.trim() || String(index + 1).padStart(2, "0");
}

/** Build the CSS font shorthand for caption rendering. */
export function captionFont(bold: boolean, size: number, family: string): string {
  return `${bold ? "bold " : ""}${size}px ${family}`;
}
