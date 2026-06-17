"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home, Sparkles, Brush, GraduationCap, LibraryBig, Plus, Film, ChevronDown, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/config";

type NavItem = { href: string; label: string; icon: React.ElementType };

const TOOLS: NavItem[] = [
  { href: "/generate",  label: "Image",      icon: Sparkles      },
  { href: "/canvas",    label: "Canvas",      icon: Brush         },
  { href: "/storyline", label: "Story Line",  icon: Film          },
  { href: "/train",     label: "Train LoRA",  icon: GraduationCap },
];

const LIBRARY: NavItem[] = [
  { href: "/library", label: "Library", icon: LibraryBig },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 h-9 text-sm font-medium transition-colors",
        active
          ? "bg-[#5b21b6] text-white"
          : "text-[#a1a1aa] hover:text-white hover:bg-white/10"
      )}
    >
      <Icon className="h-[17px] w-[17px] shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#52525b]">
      {children}
    </p>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-dvh w-60 shrink-0 flex-col bg-[#0a0a0b] border-r border-white/[0.06]">
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2.5 px-4 h-16 shrink-0">
        <Image src="/Logorr.png" alt={APP_NAME} width={36} height={36} className="shrink-0 object-contain" />
        <span className="font-semibold tracking-tight text-white">{APP_NAME}</span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 pb-4">
        <div className="space-y-0.5">
          <NavLink item={{ href: "/dashboard", label: "Home", icon: Home }} />
        </div>

        <SectionLabel>Create</SectionLabel>
        <div className="space-y-0.5">
          {TOOLS.map((it) => <NavLink key={it.href} item={it} />)}
        </div>

        <SectionLabel>Library</SectionLabel>
        <div className="space-y-0.5">
          {LIBRARY.map((it) => <NavLink key={it.href} item={it} />)}
        </div>

        <SectionLabel>Sessions</SectionLabel>
        <Link
          href="/generate"
          className="flex items-center gap-3 rounded-lg px-3 h-9 text-sm font-medium text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
        >
          <Plus className="h-[17px] w-[17px]" />
          New session
        </Link>
      </nav>

      {/* Workspace + upgrade */}
      <div className="border-t border-white/[0.06] p-3 space-y-3">
        {/* Workspace row */}
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#5b21b6] text-white text-xs font-bold shrink-0">
            N
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">Local workspace</p>
            <span className="text-[10px] font-semibold text-[#a855f7]">Free plan</span>
          </div>
          <ChevronDown className="h-4 w-4 text-[#52525b] shrink-0" />
        </div>

        {/* Generation counter */}
        <div className="px-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#71717a]">3 / 10 generations</span>
            <Zap className="h-3.5 w-3.5 text-[#a855f7]" />
          </div>
          <div className="h-1 rounded-full bg-white/10">
            <div className="h-1 rounded-full bg-[#7c3aed]" style={{ width: "30%" }} />
          </div>
        </div>

        {/* Upgrade button */}
        <Link
          href="#"
          className="flex items-center justify-between w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-[#a1a1aa] hover:text-white hover:border-white/20 transition-colors"
        >
          <span>Upgrade for more</span>
          <span className="text-[#7c3aed]">↗</span>
        </Link>
      </div>
    </aside>
  );
}
