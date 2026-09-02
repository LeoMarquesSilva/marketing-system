import { STATUS_LABELS, type PublicationStatus } from "@/lib/operacoes-legais/vistagem/types";
import { cn } from "@/lib/utils";

const colors: Partial<Record<PublicationStatus, string>> = {
  MATCH_PENDENTE: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  JURIDICO_VISTAR: "bg-sky-500/20 text-sky-200 border-sky-500/40",
  PRAZO_PENDENTE: "bg-violet-500/20 text-violet-200 border-violet-500/40",
  AGENDAR: "bg-orange-500/20 text-orange-200 border-orange-500/40",
  AGENDANDO: "bg-yellow-500/20 text-yellow-100 border-yellow-500/40",
  SIM_OK: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  SIM_OK_AJUSTE: "bg-teal-500/20 text-teal-200 border-teal-500/40",
  ERRO: "bg-red-500/20 text-red-200 border-red-500/40",
  SKIP: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
};

export function StatusBadge({ status }: { status: PublicationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded border px-2 py-0.5 text-xs font-medium",
        colors[status] || "bg-white/10 text-white border-white/20",
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
