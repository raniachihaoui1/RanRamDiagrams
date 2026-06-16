"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Brush, GraduationCap, LibraryBig, ArrowRight, Wand2, Film } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ImageGrid } from "@/components/media/ImageGrid";

const TOOLS = [
  { href: "/generate", icon: Sparkles, name: "Image", desc: "Text-to-image & image-to-image" },
  { href: "/canvas", icon: Brush, name: "Canvas", desc: "Edit & compose with layers" },
  { href: "/storyline", icon: Film, name: "Story Line", desc: "Assemble diagram grids & export PNG" },
  { href: "/train", icon: GraduationCap, name: "Train LoRA", desc: "Build your own style" },
  { href: "/library", icon: LibraryBig, name: "Library", desc: "All your results" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { data: images, isLoading, isError } = useQuery({
    queryKey: ["images", { limit: 10 }],
    queryFn: () => api.listImages({ limit: 10 }),
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface-2 to-surface p-10">
        <div className="pointer-events-none absolute right-[-60px] top-[-60px] h-64 w-64 rounded-full bg-white/[0.04] blur-3xl" />
        <h1 className="text-3xl font-semibold tracking-tight">Start creating</h1>
        <p className="mt-2 max-w-md text-muted">
          Generate Architecural diagrams from a prompt or a reference image, then
          refine them on the canvas.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/generate">
            <Button variant="primary" size="md" className="gap-2">
              <Wand2 className="h-4 w-4" /> New generation
            </Button>
          </Link>
          <Link href="/canvas">
            <Button variant="glass" size="md">Open canvas</Button>
          </Link>
        </div>
      </section>

      {/* Tools */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-faint">Tools</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="group rounded-xl border border-border bg-surface/50 p-5 transition-colors hover:bg-surface-2/70"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 flex items-center gap-1 font-medium">
                  {t.name}
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                </h3>
                <p className="mt-1 text-sm text-muted">{t.desc}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-faint">Recent</h2>
          <Link href="/library" className="text-sm text-muted hover:text-foreground">
            View all
          </Link>
        </div>

        {isError ? (
          <div className="rounded-xl border border-border bg-surface/50 p-10 text-center text-sm text-muted">
            Couldn’t reach the backend. Make sure it’s running on{" "}
            <code className="text-foreground">:8000</code> (run{" "}
            <code className="text-foreground">./dev.ps1</code>).
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : images && images.length > 0 ? (
          <ImageGrid images={images} onSelect={() => router.push("/library")} />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface/30 p-12 text-center">
            <p className="text-muted">No images yet.</p>
            <Link href="/generate" className="mt-4 inline-block">
              <Button variant="secondary" size="md" className="gap-2">
                <Wand2 className="h-4 w-4" /> Generate your first
              </Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
