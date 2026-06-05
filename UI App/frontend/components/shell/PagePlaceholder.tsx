import { GlassPanel } from "@/components/ui/GlassPanel";

export function PagePlaceholder({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex h-full max-w-3xl items-center justify-center px-8 py-16">
      <GlassPanel className="w-full p-10 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-faint">{phase}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-3 text-muted">{children}</div>
      </GlassPanel>
    </div>
  );
}
