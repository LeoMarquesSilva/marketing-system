"use client";

import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Award, CalendarDays, Check, ClipboardList, Printer, Users, type LucideIcon } from "lucide-react";
import { KanbanCard } from "./kanban-card";
import { WORKFLOW_STAGES } from "@/lib/constants";
import type { MarketingRequest } from "@/lib/marketing-requests";
import type { KanbanColumnWidth, StageSlaDays } from "@/lib/app-settings";
import {
  CERTIFICADO_DROP_IDS,
  getCertificadoSection,
  summarizeCertificadoCard,
  type CertificadoSection,
} from "@/lib/planner-certificados";

interface CertificadosColumnProps {
  /** Só os certificados ainda abertos (fora de "concluido"). */
  requests: MarketingRequest[];
  busyRequestId?: string | null;
  onCardClick?: (request: MarketingRequest) => void;
  onMove: (request: MarketingRequest, section: CertificadoSection) => void;
  onSent: (request: MarketingRequest) => void;
  timeTotals?: Record<string, string>;
  commentsCounts?: Record<string, number>;
  pendingAlterationsCounts?: Record<string, number>;
  checklistTotals?: Record<string, number>;
  checklistCompleted?: Record<string, number>;
  stageSlaDays?: StageSlaDays;
  columnWidth?: KanbanColumnWidth;
  showTimeOnCards?: boolean;
}

const STAGE_LABELS: Record<string, string> = Object.fromEntries(WORKFLOW_STAGES.map((s) => [s.value, s.label]));

const CHIP = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";
const CHIP_MUTED = `${CHIP} bg-muted/70 text-muted-foreground`;

/** Data do evento, quantidade de certificados e etapa (quando não é "Aguardando produção"). */
function CertificadoCardExtra({ request, section }: { request: MarketingRequest; section: CertificadoSection }) {
  const summary = summarizeCertificadoCard(request.description);
  const stage = request.workflow_stage || "tarefas";
  const showStage = section === "a_fazer" && stage !== "tarefas";
  if (!summary && !showStage) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showStage && (
        <span className={`${CHIP} bg-[#04202f]/8 text-[#04202f] dark:bg-white/10 dark:text-white/80`}>
          {STAGE_LABELS[stage] ?? stage}
        </span>
      )}
      {summary?.dataRealizacao && (
        <span className={CHIP_MUTED} title="Data do evento">
          <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
          Evento {summary.dataRealizacao}
        </span>
      )}
      {summary?.quantidade != null ? (
        <span className={CHIP_MUTED} title="Pela lista de presença">
          <Users className="h-3 w-3 shrink-0" aria-hidden />
          {summary.quantidade} {summary.quantidade === 1 ? "certificado" : "certificados"}
        </span>
      ) : summary?.presenca === "nao_preenchida" ? (
        <span className={`${CHIP} bg-amber-100/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400`}>
          <Users className="h-3 w-3 shrink-0" aria-hidden />
          Presença não preenchida
        </span>
      ) : summary ? (
        <span className={CHIP_MUTED}>
          <Users className="h-3 w-3 shrink-0" aria-hidden />
          Aguardando presença
        </span>
      ) : null}
    </div>
  );
}

function CertificadoSectionArea({
  section,
  title,
  icon: Icon,
  count,
  emptyText,
  children,
}: {
  section: CertificadoSection;
  title: string;
  icon: LucideIcon;
  count: number;
  emptyText: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: CERTIFICADO_DROP_IDS[section] });

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={`flex flex-col gap-2 rounded-lg p-1.5 transition-colors ${
        isOver ? "bg-primary/5 ring-2 ring-primary/40" : ""
      }`}
    >
      <h4 className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {title}
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums normal-case tracking-normal">
          {count}
        </span>
      </h4>
      {count === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

/** Coluna própria dos certificados: "A fazer" → "Prontos" (mandar para a gráfica) → ok de enviado. */
export function CertificadosColumn({
  requests,
  busyRequestId = null,
  onCardClick,
  onMove,
  onSent,
  timeTotals,
  commentsCounts,
  pendingAlterationsCounts,
  checklistTotals,
  checklistCompleted,
  stageSlaDays,
  columnWidth = "fixed",
  showTimeOnCards = true,
}: CertificadosColumnProps) {
  const widthClass = columnWidth === "compact" ? "w-64" : "w-72";
  const aFazer = requests.filter((r) => getCertificadoSection(r) === "a_fazer");
  const prontos = requests.filter((r) => getCertificadoSection(r) === "pronto");

  const renderCard = (request: MarketingRequest, section: CertificadoSection) => (
    <KanbanCard
      key={request.id}
      request={request}
      compact
      onClick={() => onCardClick?.(request)}
      timeTotal={showTimeOnCards ? timeTotals?.[request.id] : undefined}
      commentsCount={commentsCounts?.[request.id] ?? 0}
      pendingAlterationsCount={pendingAlterationsCounts?.[request.id] ?? 0}
      checklistTotal={checklistTotals?.[request.id] ?? 0}
      checklistCompleted={checklistCompleted?.[request.id] ?? 0}
      stageSlaDays={stageSlaDays}
      stageDelayLabel={section === "pronto" ? "Gráfica pendente" : undefined}
      extra={<CertificadoCardExtra request={request} section={section} />}
      footerAction={
        section === "a_fazer"
          ? {
              label: "Pronto",
              icon: Check,
              onClick: () => onMove(request, "pronto"),
              disabled: busyRequestId === request.id,
            }
          : {
              label: "Enviado à gráfica",
              icon: Printer,
              tone: "success",
              onClick: () => onSent(request),
              disabled: busyRequestId === request.id,
            }
      }
    />
  );

  return (
    <div className={`flex shrink-0 ${widthClass} flex-col rounded-lg border bg-muted/30`}>
      <div className="flex items-center gap-2 p-3 border-b">
        <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
        <h3 className="font-semibold text-sm">Certificados</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {requests.length}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-1.5 min-h-[120px] overflow-y-auto">
        <CertificadoSectionArea
          section="a_fazer"
          title="A fazer"
          icon={ClipboardList}
          count={aFazer.length}
          emptyText="Nenhum certificado a fazer."
        >
          {aFazer.map((r) => renderCard(r, "a_fazer"))}
        </CertificadoSectionArea>
        <CertificadoSectionArea
          section="pronto"
          title="Prontos · mandar p/ gráfica"
          icon={Printer}
          count={prontos.length}
          emptyText="Terminou um certificado? Clique em Pronto e ele fica aqui até ir para a gráfica."
        >
          {prontos.map((r) => renderCard(r, "pronto"))}
        </CertificadoSectionArea>
      </div>
    </div>
  );
}
