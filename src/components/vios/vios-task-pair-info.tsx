"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link2 } from "lucide-react";
import type { ViosTask } from "@/lib/vios-tasks";
import { filterLeonardoFromResponsaveis } from "@/lib/vios-tasks";
import { cn } from "@/lib/utils";

const STATUS_SHORT: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

interface ViosTaskPairInfoProps {
  task: ViosTask;
  className?: string;
  compact?: boolean;
}

export function ViosTaskPairInfo({ task, className, compact }: ViosTaskPairInfoProps) {
  const paired = task.paired_task;
  if (!paired || !task.ci_processo) return null;

  const label = paired.etiquetas_tarefa === "PROTOCOLO" ? "PROTOCOLO" : "REVISAR";
  const resp = filterLeonardoFromResponsaveis(paired.responsaveis);

  if (compact) {
    return (
      <p className={cn("flex items-center gap-1 text-[11px] text-muted-foreground", className)}>
        <Link2 className="h-3 w-3 shrink-0" />
        <span>
          {label} CI {paired.vios_id}
          {paired.data_limite
            ? ` · ${format(new Date(paired.data_limite + "T12:00:00"), "dd/MM", { locale: ptBR })}`
            : ""}
        </span>
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-border/70 bg-muted/30 px-2 py-1.5 text-xs space-y-0.5",
        className
      )}
    >
      <p className="flex items-center gap-1 font-medium text-foreground/80">
        <Link2 className="h-3 w-3 shrink-0" />
        Par {label} · CI {paired.vios_id}
      </p>
      <p className="text-muted-foreground truncate">{resp ?? "—"}</p>
      <p className="text-muted-foreground">
        Prazo:{" "}
        {paired.data_limite
          ? format(new Date(paired.data_limite + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
          : "—"}
        {" · "}
        {STATUS_SHORT[paired.status] ?? paired.status}
        {paired.marketing_request_id ? " · No Planner" : ""}
      </p>
    </div>
  );
}
