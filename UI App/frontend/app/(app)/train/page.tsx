"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, type DatasetOut, type PrepareResult } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { WizardStepper } from "@/components/train/WizardStepper";
import { StepDataset } from "@/components/train/StepDataset";
import { StepImages } from "@/components/train/StepImages";
import { StepCaption } from "@/components/train/StepCaption";
import { StepReview } from "@/components/train/StepReview";
import { StepPrepare } from "@/components/train/StepPrepare";
import { StepTrainConfig } from "@/components/train/StepTrainConfig";

const STEP_COUNT = 6;

export default function TrainPage() {
  const qc = useQueryClient();
  const [step, setStep] = React.useState(0);
  const [dataset, setDataset] = React.useState<DatasetOut | null>(null);
  const [captions, setCaptions] = React.useState<Record<string, string>>({});

  // Re-fetch the active dataset when we change steps
  const { data: freshDataset } = useQuery({
    queryKey: ["dataset", dataset?.id],
    queryFn: () => api.getDataset(dataset!.id),
    enabled: !!dataset,
    refetchOnWindowFocus: false,
  });
  const activeDataset = freshDataset ?? dataset;

  const refresh = () => {
    if (dataset) qc.invalidateQueries({ queryKey: ["dataset", dataset.id] });
  };

  const handleSelectDataset = (ds: DatasetOut) => {
    setDataset(ds);
    setCaptions(ds.captions ?? {});
    setStep(1);
  };

  const canNext = (): boolean => {
    if (step === 0) return !!dataset;
    if (step === 1) return (activeDataset?.image_count ?? 0) > 0;
    if (step === 2) return Object.keys(captions).length > 0;
    return true;
  };

  const next = () => setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <h1 className="text-sm font-medium text-muted">
          Train <span className="text-foreground">LoRA</span>
          {activeDataset && (
            <> · <span className="text-foreground">{activeDataset.name}</span></>
          )}
        </h1>
        {/* Stepper */}
        <WizardStepper current={step} />
        <div className="w-32" />
      </header>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-8">
          {step === 0 && <StepDataset onSelect={handleSelectDataset} />}

          {step === 1 && activeDataset && (
            <StepImages
              dataset={activeDataset}
              onRefresh={refresh}
            />
          )}

          {step === 2 && activeDataset && (
            <StepCaption
              dataset={activeDataset}
              onDone={(caps) => {
                setCaptions(caps);
                refresh();
              }}
            />
          )}

          {step === 3 && activeDataset && (
            <StepReview
              dataset={{ ...activeDataset, captions }}
              captions={captions}
              onUpdate={(filename, caption) =>
                setCaptions((prev) => ({ ...prev, [filename]: caption }))
              }
            />
          )}

          {step === 4 && activeDataset && (
            <StepPrepare
              dataset={activeDataset}
              onDone={() => refresh()}
            />
          )}

          {step === 5 && activeDataset && (
            <StepTrainConfig dataset={activeDataset} />
          )}
        </div>
      </div>

      {/* Footer nav */}
      <footer className="flex h-16 shrink-0 items-center justify-between border-t border-border px-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={back}
          disabled={step === 0}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        <p className="text-xs text-faint tabular-nums">
          Step {step + 1} of {STEP_COUNT}
        </p>

        {step < STEP_COUNT - 1 ? (
          <Button
            variant="primary"
            size="sm"
            onClick={next}
            disabled={!canNext()}
            className="gap-1.5"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-20" />
        )}
      </footer>
    </div>
  );
}
