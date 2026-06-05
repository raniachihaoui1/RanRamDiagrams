import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { APP_NAME } from "@/lib/config";

export default function Home() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <GlassPanel className="max-w-lg w-full p-10 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-faint">
          AI Creative Suite
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {APP_NAME}
        </h1>
        <p className="mt-4 text-muted leading-relaxed">
          Scaffolding complete. Welcome, Dashboard, Generator, Library, Canvas
          and the Rhino bridge are coming online phase by phase.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button variant="primary" size="lg">
            Launch App
          </Button>
          <Button variant="glass" size="lg">
            Learn more
          </Button>
        </div>
      </GlassPanel>
    </main>
  );
}
