"use client";

import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

const STORAGE_KEY = "diagram-studio-theme";

function readStored(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "light", // SSR-safe default; hydrated on mount via ThemeApplier
  toggle: () =>
    set((s) => {
      const next: Theme = s.theme === "light" ? "dark" : "light";
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
      return { theme: next };
    }),
}));

/** Call once on mount to load the persisted preference. */
export function hydrateTheme() {
  useThemeStore.setState({ theme: readStored() });
}
