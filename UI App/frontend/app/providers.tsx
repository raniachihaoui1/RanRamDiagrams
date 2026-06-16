"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useThemeStore, hydrateTheme } from "@/lib/theme";

function ThemeApplier() {
  const theme = useThemeStore((s) => s.theme);

  // On first mount, load the stored preference from localStorage.
  useEffect(() => {
    hydrateTheme();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: 1 },
        },
      })
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeApplier />
      {children}
    </QueryClientProvider>
  );
}
