"use client";

import { cn } from "@/lib/utils";
import type { PipelineStage } from "./whatsapp-crm-types";

const steps = ["Lead recebido", "Qualificação", "Reunião", "Proposta", "Fechado"];
const stageValues: PipelineStage[] = [
  "lead_recebido",
  "qualificacao",
  "reuniao",
  "proposta",
  "fechado",
];

interface PipelineProgressProps {
  currentStep?: number;
  onStageChange?: (stage: PipelineStage) => void;
}

export function PipelineProgress({
  currentStep = 0,
  onStageChange,
}: PipelineProgressProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start">
        {steps.map((step, index) => {
          const active = index <= currentStep;
          return (
            <button
              type="button"
              key={step}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
              onClick={() => onStageChange?.(stageValues[index])}
            >
              <div className="flex w-full items-center gap-1">
                <span
                  className={cn(
                    "mx-auto flex h-4 w-4 items-center justify-center rounded-full border-2 bg-background",
                    active ? "border-emerald-500" : "border-muted-foreground/30"
                  )}
                >
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </span>
                {index < steps.length - 1 ? (
                  <span
                    className={cn(
                      "h-px flex-1 bg-border",
                      active && "bg-emerald-300"
                    )}
                  />
                ) : null}
              </div>
              <span className="max-w-16 text-center text-[10px] leading-tight text-muted-foreground">
                {step}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
