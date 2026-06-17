"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Brush, GraduationCap, LibraryBig, ArrowRight, Wand2, Film } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ImageGrid } from "@/components/media/ImageGrid";

const TOOLS = [
  {
    href: "/generate", icon: Sparkles, name: "Image",
    desc: "Text-to-image & image-to-image",
    bg: "#f0eeff", iconBg: "#e0d9ff", arrow: "#7c3aed",
  },
  {
    href: "/canvas", icon: Brush, name: "Canvas",
    desc: "Edit & compose with layers",
    bg: "#fff4ee", iconBg: "#ffe4d0", arrow: "#ea6c2d",
  },
  {
    href: "/storyline", icon: Film, name: "Story Line",
    desc: "Assemble diagram grids & export PNG",
    bg: "#edfff5", iconBg: "#d0f7e4", arrow: "#059669",
  },
  {
    href: "/train", icon: GraduationCap, name: "Train LoRA",
    desc: "Build your own style",
    bg: "#eef3ff", iconBg: "#d6e2ff", arrow: "#2563eb",
  },
  {
    href: "/library", icon: LibraryBig, name: "Library",
    desc: "All your results in one place",
    bg: "#f5eeff", iconBg: "#e9d8ff", arrow: "#7c3aed",
  },
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
      <section className="relative overflow-hidden rounded-2xl border border-[#e8e0f0] flex items-center justify-between gap-6 pr-0"
        style={{ background: "linear-gradient(120deg, #ede8ff 0%, #f9f5ff 35%, #fff7f0 70%, #ffe8d6 100%)" }}
      >
        <div className="p-10 shrink-0 max-w-[52%]">
          <p className="text-sm text-[#9898a6] mb-3">Good to see you, architect. 👋</p>
          <h1 className="text-4xl font-bold tracking-tight leading-tight text-[#111112]">
            Turn ideas into
          </h1>
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            <span className="text-[#7c3aed]">architectural</span>{" "}
            <span className="text-[#ea6c2d]">stories.</span>
          </h1>
          <p className="mt-3 text-[#58585f] text-sm leading-relaxed max-w-sm">
            Generate, iterate, and explore diagrams<br />that bring your vision to life.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/generate">
              <Button variant="primary" size="md" className="gap-2 bg-[#111112] text-white hover:bg-[#2a2a2a]">
                <Wand2 className="h-4 w-4" /> New generation
              </Button>
            </Link>
            <Link href="/canvas">
              <Button variant="glass" size="md">Open canvas</Button>
            </Link>
          </div>
        </div>
        <div className="shrink-0 h-[260px] flex-1 relative">
          <Image
            src="/Homeimg.png"
            alt="Concept sketch"
            fill
            className="object-cover object-left rounded-r-2xl"
          />
          <span className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-sm text-xs text-[#58585f] px-3 py-1 rounded-full border border-white/60 shadow-sm">
            Concept sketch
          </span>
        </div>
      </section>

      {/* Tools */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#111112]">Jump into a tool</h2>
          <Link href="/generate" className="text-sm text-[#7c3aed] hover:underline flex items-center gap-1">
            View all tools <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="group flex flex-col rounded-2xl p-5 min-h-[190px] transition-all hover:scale-[1.02] hover:shadow-md"
                style={{ backgroundColor: t.bg }}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl shrink-0"
                  style={{ backgroundColor: t.iconBg }}
                >
                  <Icon className="h-5 w-5" style={{ color: t.arrow }} />
                </span>
                <h3 className="mt-4 font-semibold text-[#111112] text-sm">{t.name}</h3>
                <p className="mt-1 text-xs text-[#58585f] leading-relaxed">{t.desc}</p>
                <div className="mt-auto pt-4">
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full text-white text-sm transition-transform group-hover:scale-110"
                    style={{ backgroundColor: t.arrow }}
                  >
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#111112]">Recent</h2>
          <Link href="/library" className="text-sm text-[#7c3aed] hover:underline flex items-center gap-1">
            View all projects <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isError ? (
          <div className="rounded-xl border border-border bg-surface/50 p-10 text-center text-sm text-muted">
            Couldn't reach the backend.
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
              <Button variant="secondary" size="md" className="gap-2 mt-4">
                <Wand2 className="h-4 w-4" /> Generate your first
              </Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
