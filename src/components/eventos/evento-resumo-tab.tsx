"use client";

import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EVENT_STAGE_LABEL, RISK_LEVEL_LABEL, type OrgEvent } from "@/lib/eventos";

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
  return (
    <div className="grid gap-4 md:grid-cols-2">
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
      <InfoCard
        label="Orçamento"
        value={`${budgetPlannedTotal.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} / ${budgetActualTotal.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}`}
      />
      <InfoCard label="Equipe de organização" value={event.organizationTeam || "—"} />
      <div className="md:col-span-2 rounded-xl border border-border/60 bg-card p-4">
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <CalendarDays className="h-4 w-4" />
          Data do evento: {formatDate(event.eventDate)} · Data comemorativa: {formatDate(event.commemorativeDate)}
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
