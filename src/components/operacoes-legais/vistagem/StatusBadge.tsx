import { STATUS_LABELS, type PublicationStatus } from "@/lib/operacoes-legais/vistagem/types";
import { cn } from "@/lib/utils";

const colors: Partial<Record<PublicationStatus, string>> = {
  MATCH_PENDENTE: "border-amber-200 bg-amber-50 text-amber-800",
  JURIDICO_VISTAR: "border-sky-200 bg-sky-50 text-sky-800",
  PRAZO_PENDENTE: "border-violet-200 bg-violet-50 text-violet-800",
  AGENDAR: "border-orange-200 bg-orange-50 text-orange-800",
  AGENDANDO: "border-yellow-200 bg-yellow-50 text-yellow-800",
  SIM_OK: "border-emerald-200 bg-emerald-50 text-emerald-800",
  SIM_OK_AJUSTE: "border-teal-200 bg-teal-50 text-teal-800",
  ERRO: "border-red-200 bg-red-50 text-red-800",
  SKIP: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: PublicationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        colors[status] || "border-border bg-muted text-foreground"
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
