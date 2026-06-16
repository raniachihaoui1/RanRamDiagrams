"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Sparkles,
  Brush,
  GraduationCap,
  LibraryBig,
  Boxes,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/config";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

type NavItem = { href: string; label: string; icon: React.ElementType };

const TOOLS: NavItem[] = [
  { href: "/generate", label: "Image", icon: Sparkles },
  { href: "/canvas", label: "Canvas", icon: Brush },
  { href: "/train", label: "Train LoRA", icon: GraduationCap },
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
      data-active={active}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 h-9 text-sm font-medium transition-colors",
        active
          ? "bg-elevated text-foreground"
          : "text-muted hover:text-foreground hover:bg-surface-2"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
      {children}
    </p>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface/60 backdrop-blur-xl">
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2.5 px-4 h-16 shrink-0">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Boxes className="h-[18px] w-[18px]" />
        </span>
        <span className="font-semibold tracking-tight">{APP_NAME}</span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 pb-4">
        <div className="space-y-0.5">
          <NavLink item={{ href: "/dashboard", label: "Home", icon: Home }} />
        </div>

        <SectionLabel>Tools</SectionLabel>
        <div className="space-y-0.5">
          {TOOLS.map((it) => (
            <NavLink key={it.href} item={it} />
          ))}
        </div>

        <SectionLabel>Library</SectionLabel>
        <div className="space-y-0.5">
          {LIBRARY.map((it) => (
            <NavLink key={it.href} item={it} />
          ))}
        </div>

        <SectionLabel>Sessions</SectionLabel>
        <Link
          href="/generate"
          className="flex items-center gap-3 rounded-md px-3 h-9 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          <Plus className="h-[18px] w-[18px]" />
          New session
        </Link>
      </nav>

      {/* Account + theme toggle */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-md px-2 h-11">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold shrink-0">
            R
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Local workspace</p>
            <p className="truncate text-xs text-faint">Mock mode</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
