"use client";

import { cn } from "@/lib/utils";
import { corDoPreenchimento } from "./processos-api";

/** Barra do saneamento: quanto da lista de campos da equipe está preenchido. */
export function BarraPreenchimento({ feitos, total, percentual, className }: { feitos: number; total: number; percentual: number; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold tabular-nums text-[#10293a]">{percentual}%</span>
        <span className="tabular-nums text-muted-foreground">
          {feitos} de {total}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e6eef0]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual} aria-label="Cadastro preenchido">
        <div className={cn("h-full rounded-full transition-[width]", corDoPreenchimento(percentual))} style={{ width: `${percentual}%` }} />
      </div>
    </div>
  );
}
