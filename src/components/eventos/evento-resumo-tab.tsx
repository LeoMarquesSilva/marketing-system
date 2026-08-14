"use client";

import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  EVENT_KIND_LABEL,
  EVENT_STAGE_LABEL,
  RISK_LEVEL_LABEL,
  formatBrl,
  type OrgEvent,
} from "@/lib/eventos";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return "—";
  return format(dt, "dd/MM/yyyy", { locale: ptBR });
}

export function EventoResumoTab({
  event,
  budgetPlannedTotal,
  budgetActualTotal,
}: {
  event: OrgEvent;
  budgetPlannedTotal: number;
  budgetActualTotal: number;
}) {
  const approved = event.budgetApproved;
  const balance = approved != null ? approved - budgetActualTotal : null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyCard label="Verba aprovada" value={approved != null ? formatBrl(approved) : "Não informada"} />
        <MoneyCard label="Previsto (linhas)" value={formatBrl(budgetPlannedTotal)} />
        <MoneyCard label="Realizado" value={formatBrl(budgetActualTotal)} />
        <MoneyCard
          label="Saldo da verba"
          value={balance != null ? formatBrl(balance) : "—"}
          negative={balance != null && balance < 0}
        />
      </div>
      <InfoCard label="Tipo de registro" value={EVENT_KIND_LABEL[event.kind]} />
      <InfoCard label="Série anual" value={event.seriesName || "Sem série (avulso)"} />
      <InfoCard label="Tipo de evento" value={event.eventType || "—"} />
      <InfoCard label="Porte" value={event.eventSize || "—"} />
      <InfoCard label="Público-alvo" value={event.targetAudience || "—"} />
      <InfoCard label="Prioridade" value={event.priority} />
      <InfoCard label="Área solicitante" value={event.requestingArea || "—"} />
      <InfoCard label="Local" value={event.location || "—"} />
      <InfoCard
        label="Participantes"
        value={`${event.participantsActual ?? 0} real / ${event.participantsExpected ?? 0} previsto`}
      />
      <InfoCard label="Risco calculado" value={RISK_LEVEL_LABEL[event.riskLevel]} />
      <InfoCard label="Status por etapa" value={EVENT_STAGE_LABEL[event.stageStatus]} />
      <InfoCard label="Brindes" value={event.giftsNotes || "—"} />
      <InfoCard label="Equipe de organização" value={event.organizationTeam || "—"} />
      <div className="md:col-span-2 rounded-xl border border-border/60 bg-card p-4">
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <CalendarDays className="h-4 w-4" />
          {event.endDate
            ? `Período: ${formatDate(event.eventDate)} a ${formatDate(event.endDate)}`
            : `Data do evento: ${formatDate(event.eventDate)}`}
          {" · "}
          Data comemorativa: {formatDate(event.commemorativeDate)}
        </p>
      </div>
      <div className="md:col-span-2 rounded-xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">Objetivos</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {event.objectives || "Sem objetivos preenchidos."}
        </p>
      </div>
      <div className="md:col-span-2 rounded-xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">Observações</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {event.notes || "Sem observações."}
        </p>
      </div>
    </div>
  );
}

function MoneyCard({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${negative ? "text-red-600" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
