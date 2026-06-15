"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Boxes,
  Sparkles,
  Brush,
  GraduationCap,
  LibraryBig,
  Images,
  Box,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { APP_NAME } from "@/lib/config";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

function TopBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-base/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Boxes className="h-[18px] w-[18px]" />
          </span>
          <span className="font-semibold tracking-tight">{APP_NAME}</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#tools" className="hover:text-foreground transition-colors">Tools</a>
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
        </nav>
        <Link href="/dashboard">
          <Button variant="primary" size="sm">Launch App</Button>
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft radial glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-white/[0.05] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="mb-5 inline-flex items-center gap-2 rounded-pill border border-border bg-surface/60 px-3 py-1 text-xs text-muted"
        >
          <Sparkles className="h-3.5 w-3.5" /> Local-first AI suite for architectural diagrams
        </motion.p>

        <motion.h1
          {...fadeUp}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="mx-auto max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
        >
          Turn Rhino views into{" "}
          <span className="text-muted">clean architectural diagrams</span> — in one place.
        </motion.h1>

        <motion.p
          {...fadeUp}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted"
        >
          Generate, transform and compose with ComfyUI workflows (Flux 2.0) and
          your own trained LoRAs. A canvas editor, a results library, and a Rhino
          bridge — running on your machine.
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.55, delay: 0.18 }}
          className="mt-9 flex items-center justify-center gap-3"
        >
          <Link href="/dashboard">
            <Button variant="primary" size="lg" className="gap-2">
              Launch App <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/generate">
            <Button variant="glass" size="lg">Open generator</Button>
          </Link>
        </motion.div>

        {/* App preview mock */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mx-auto mt-16 max-w-4xl"
        >
          <div className="glass-strong overflow-hidden rounded-xl shadow-[var(--shadow-panel)]">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-surface-2" />
              <span className="h-3 w-3 rounded-full bg-surface-2" />
              <span className="h-3 w-3 rounded-full bg-surface-2" />
            </div>
            <div className="grid grid-cols-4 gap-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg border border-border bg-gradient-to-b from-surface-2 to-surface"
                />
              ))}
            </div>
            <div className="mx-4 mb-4 flex items-center gap-2 rounded-pill border border-border bg-surface px-4 py-3 text-sm text-faint">
              Describe an image and press generate…
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const FEATURES = [
  { title: "Flux 2.0", body: "Run state-of-the-art diffusion workflows through ComfyUI.", className: "md:col-span-2" },
  { title: "Custom LoRAs", body: "Load the BIG diagram style you trained — or any LoRA you drop in." },
  { title: "Local-first", body: "Images and projects live on your disk. Deploy later when ready." },
  { title: "Rhino bridge", body: "Stream your viewport into image-to-image (coming online)." },
  { title: "Canvas editor", body: "A mini-photoshop to sketch people, trees and arrows, then regenerate.", className: "md:col-span-2" },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-3xl font-semibold tracking-tight">Everything in one suite.</h2>
      <p className="mt-3 max-w-xl text-muted">
        Designed around the BIG visual grammar, built to fit your workflow.
      </p>
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className={`rounded-xl border border-border bg-surface/50 p-6 transition-colors hover:bg-surface-2/60 ${f.className ?? ""}`}
          >
            <h3 className="text-lg font-medium">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const TOOLS = [
  { icon: Sparkles, name: "Image & Image-to-image", desc: "Prompt, pick a model + LoRA, generate up to 4 at once." },
  { icon: Brush, name: "Canvas", desc: "Layers, brushes and shapes — then blend with AI." },
  { icon: GraduationCap, name: "Train LoRA", desc: "Turn your dataset into a reusable style." },
  { icon: LibraryBig, name: "Library", desc: "Every result, organised by date and favourites." },
  { icon: Images, name: "Cute Library", desc: "Browse your work as a playful isometric shelf." },
  { icon: Box, name: "Rhino viewport", desc: "Bring your 3D model in, live." },
];

function Tools() {
  return (
    <section id="tools" className="border-t border-border bg-surface/30">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">Tools</h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.name} className="rounded-xl border border-border bg-base/40 p-6">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-medium">{t.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-24 text-center">
      <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight">
        Ready to design?
      </h2>
      <p className="mx-auto mt-4 max-w-md text-muted">
        Jump straight into the workspace — no account needed while running locally.
      </p>
      <div className="mt-8">
        <Link href="/dashboard">
          <Button variant="primary" size="lg" className="gap-2">
            Launch App <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export default function WelcomePage() {
  return (
    <div className="min-h-dvh">
      <TopBar />
      <Hero />
      <Features />
      <Tools />
      <CTA />
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-faint">
          <span>{APP_NAME}</span>
          <span>Local AI creative suite</span>
        </div>
      </footer>
    </div>
  );
}
