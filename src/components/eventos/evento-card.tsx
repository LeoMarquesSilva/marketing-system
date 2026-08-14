"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarDays, ChevronRight, Gift, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  EVENT_STAGE_LABEL,
  EVENT_STATUS_LABEL,
  EVENT_STATUS_STYLE,
  RISK_LEVEL_LABEL,
  formatBrl,
  getEventDisplayDate,
  type EventWithStats,
} from "@/lib/eventos";
import { cn } from "@/lib/utils";

const RISK_DOT_STYLE: Record<string, string> = {
  baixo: "bg-emerald-500",
  medio: "bg-amber-500",
  alto: "bg-red-500",
};

function formatDate(iso: string | null): string {
  if (!iso) return "Sem data definida";
  try {
    return format(parseISO(iso.includes("T") ? iso : `${iso}T12:00:00`), "dd 'de' MMMM", { locale: ptBR });
  } catch {
    return "Sem data definida";
  }
}

export function EventoCard({ event }: { event: EventWithStats }) {
  const alerts = [
    event.alerts.noApprovedSupplier && "Sem fornecedor aprovado",
    event.alerts.noBudget && "Sem orçamento",
    event.alerts.budgetExceeded && "Orçamento estourado",
    event.alerts.overdueTasks && "Tarefa atrasada",
    event.alerts.pendingPayments && "Pagamento pendente",
    event.alerts.missingPostEvent && "Sem pós-evento",
  ].filter(Boolean) as string[];

  const taskProgress = event.tasksTotal > 0 ? Math.round((event.tasksCompleted / event.tasksTotal) * 100) : 0;

  return (
    <Link
      href={`/eventos/${event.id}`}
      className={cn(
        "group relative flex flex-col rounded-lg border border-border/60 bg-card p-4",
        "shadow-sm transition-all duration-150 cursor-pointer",
        "hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      )}
    >
      <ChevronRight
        className={cn(
          "absolute right-4 top-4 h-4 w-4 text-muted-foreground/70 transition-all duration-150",
          "group-hover:text-violet-500 group-hover:translate-x-0.5"
        )}
      />

      <div className="pr-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="font-semibold text-foreground leading-snug group-hover:text-violet-700 transition-colors">
            {event.name}
          </h3>
        </div>
        {event.monthLabel && <p className="text-xs text-muted-foreground mt-0.5">{event.monthLabel}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {event.kind === "campanha" && (
          <Badge variant="outline" className="text-[11px] bg-sky-50 text-sky-700 border-sky-200">
            Campanha
          </Badge>
        )}
        <Badge variant="outline" className={cn("text-[11px]", EVENT_STATUS_STYLE[event.status])}>
          {EVENT_STATUS_LABEL[event.status]}
        </Badge>
        <Badge variant="outline" className="text-[11px]">
          {EVENT_STAGE_LABEL[event.stageStatus]}
        </Badge>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", RISK_DOT_STYLE[event.riskLevel])} />
          Risco {RISK_LEVEL_LABEL[event.riskLevel].toLowerCase()}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-sm text-foreground/80">
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {event.endDate && event.eventDate
          ? `${formatDate(event.eventDate)} a ${formatDate(event.endDate)}`
          : formatDate(getEventDisplayDate(event))}
      </div>

      {event.giftsNotes && (
        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Gift className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="line-clamp-1">{event.giftsNotes}</span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">
            Tarefas · {event.tasksCompleted}/{event.tasksTotal}
          </p>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full", event.tasksOverdue > 0 ? "bg-red-500" : "bg-violet-500")}
              style={{ width: `${taskProgress}%` }}
            />
          </div>
          {event.tasksOverdue > 0 && (
            <p className="text-[11px] text-red-600 mt-1">
              {event.tasksOverdue} atrasada{event.tasksOverdue > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
            <Wallet className="h-3 w-3" />
            {event.budgetApproved != null ? "Verba aprovada" : "Orçamento previsto"}
          </p>
          <p className="text-sm font-medium text-foreground tabular-nums">
            {event.budgetApproved != null
              ? formatBrl(event.budgetApproved)
              : event.budgetPlannedTotal > 0
                ? formatBrl(event.budgetPlannedTotal)
                : "—"}
          </p>
          {event.budgetActualTotal > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
              Realizado {formatBrl(event.budgetActualTotal)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-border/50">
        {alerts.length > 0 ? (
          <p className="flex items-start gap-1.5 text-[11px] text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{alerts.slice(0, 2).join(" · ")}</span>
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">Sem alertas</p>
        )}
      </div>
    </Link>
  );
}
