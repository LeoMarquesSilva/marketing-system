"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAreaIcon } from "@/lib/area-icons";
import { getTypeColor } from "@/lib/type-icons";
import { COMPLETION_TYPES } from "@/lib/constants";
import type { CompletionTypeConfig, StageSlaDays } from "@/lib/app-settings";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, MessageSquare, AlertCircle, CheckCircle2, X, Flag, CalendarX2, CheckCircle } from "lucide-react";
import type { MarketingRequest, RequestPriority } from "@/lib/marketing-requests";
import { fetchCommentsForRequest, type RequestComment } from "@/lib/request-comments";
import { differenceInDays, isPast, parseISO } from "date-fns";
import { getDeadlineMoment } from "@/lib/marketing-requests";
import { useTimer } from "@/contexts/timer-context";
import { useStopwatch } from "@/hooks/use-stopwatch";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const PRIORITY_CONFIG: Record<
  RequestPriority,
  { label: string; className: string; dotClass: string }
> = {
  urgente: {
    label: "Urgente",
    className: "bg-red-100/90 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    dotClass: "bg-red-500",
  },
  alta: {
    label: "Alta",
    className: "bg-orange-100/90 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
  normal: {
    label: "Normal",
    className: "bg-slate-100/80 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400",
    dotClass: "bg-slate-400",
  },
  baixa: {
    label: "Baixa",
    className: "bg-[#101f2e]/8 text-[#101f2e]/70 dark:bg-white/8 dark:text-white/50",
    dotClass: "bg-[#101f2e]/40 dark:bg-white/30",
  },
};

interface KanbanCardProps {
  request: MarketingRequest;
  onClick?: () => void;
  onMarkComplete?: (requestId: string, completionType: string) => void;
  timeTotal?: string;
  commentsCount?: number;
  pendingAlterationsCount?: number;
  completionTypes?: CompletionTypeConfig[];
  stageSlaDays?: StageSlaDays;
}

const PRODUCTION_STAGES = new Set(["tarefas", "em_producao"]);

const STAGE_DELAY_LABELS: Record<string, string> = {
  revisao: "Revisão atrasada",
  revisao_autor: "Ajustes atrasados",
  revisado: "Pronto para fechamento",
};

export function KanbanCard({
  request,
  onClick,
  onMarkComplete,
  timeTotal,
  commentsCount = 0,
  pendingAlterationsCount = 0,
  completionTypes,
  stageSlaDays = {},
}: KanbanCardProps) {
  const completionOptions = completionTypes?.length ? completionTypes : COMPLETION_TYPES.map((c) => ({ value: c.value, label: c.label }));
  const didDrag = useRef(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [previewComments, setPreviewComments] = useState<RequestComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const { activeEntry } = useTimer();
  const isTimerActive = activeEntry?.request_id === request.id;
  const liveElapsed = useStopwatch(isTimerActive ? (activeEntry?.started_at ?? null) : null);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: request.id, data: { request } });

  useEffect(() => {
    if (isDragging) didDrag.current = true;
  }, [isDragging]);

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  const AreaIcon = getAreaIcon(request.requesting_area);
  const typeColor = getTypeColor(request.request_type || "");
  const solicitanteName = request.solicitante_user?.name || request.solicitante;

  const priority = request.priority ?? "normal";
  const priorityCfg = PRIORITY_CONFIG[priority as RequestPriority] ?? PRIORITY_CONFIG.normal;
  const showPriorityBadge = priority !== "normal";

  const deadlineDate = request.deadline ? parseISO(request.deadline) : null;
  const deadlineMoment = getDeadlineMoment(request.deadline, request.deadline_time);
  const stage = request.workflow_stage || "tarefas";
  const isProductionStage = PRODUCTION_STAGES.has(stage);
  const isProductionOverdue =
    Boolean(deadlineMoment) &&
    isPast(deadlineMoment!) &&
    request.workflow_stage !== "concluido" &&
    isProductionStage;
  const deadlineLabel = deadlineDate
    ? request.deadline_time
      ? `${format(deadlineDate, "dd/MM/yyyy", { locale: ptBR })} ${request.deadline_time}`
      : format(deadlineDate, "dd/MM/yyyy", { locale: ptBR })
    : null;

  const stageChangedAt = request.stage_changed_at ?? request.requested_at;
  const daysInStage = differenceInDays(new Date(), new Date(stageChangedAt));
  const stageSla = stageSlaDays[stage];
  const isStageOverdue =
    request.workflow_stage !== "concluido" &&
    !isProductionStage &&
    stageSla != null &&
    daysInStage >= stageSla;
  const stageDelayLabel = STAGE_DELAY_LABELS[stage] ?? "Etapa atrasada";
  const productionDelayDays = deadlineMoment
    ? Math.max(1, differenceInDays(new Date(), deadlineMoment))
    : 0;

  const cardLabel = `${request.title} — ${request.request_type}, ${request.requesting_area}, ${format(new Date(request.requested_at), "dd/MM/yyyy", { locale: ptBR })}`;

  const handleCommentsOpen = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (commentsOpen) { setCommentsOpen(false); return; }
      setCommentsOpen(true);
      setLoadingComments(true);
      const list = await fetchCommentsForRequest(request.id);
      setPreviewComments(list.slice(0, 5));
      setLoadingComments(false);
    },
    [commentsOpen, request.id]
  );

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, touchAction: "none" }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={cardLabel}
      onClick={() => {
        if (!didDrag.current) onClick?.();
        didDrag.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!didDrag.current) onClick?.();
          didDrag.current = false;
        }
      }}
      className={`
        group relative overflow-visible rounded-2xl p-4 cursor-grab active:cursor-grabbing touch-none
        bg-gradient-to-br from-white/90 via-white/70 to-white/50
        dark:from-white/10 dark:via-white/5 dark:to-white/[0.02]
        backdrop-blur-xl border border-white/60 dark:border-white/10
        shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)]
        hover:shadow-[0_16px_48px_-8px_rgba(16,31,46,0.16),0_0_0_1px_rgba(16,31,46,0.06)]
        transition-all duration-200 ease-out
        hover:-translate-y-1 hover:scale-[1.015] hover:border-white/80 dark:hover:border-white/20
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101f2e]/40 focus-visible:ring-offset-2
        ${isDragging ? "opacity-30 shadow-xl ring-2 ring-[#101f2e]/30 scale-[1.02] z-10" : ""}
      `}
    >
      {/* Gradiente sutil no hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(16,31,46,0.02) 0%, rgba(16,31,46,0.0) 100%)",
        }}
        aria-hidden
      />

      <div className="space-y-3">
        {/* Linha de topo: prioridade + tipo */}
        <div className="flex items-center justify-between gap-2">
          {showPriorityBadge ? (
            <span className={`flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${priorityCfg.className}`}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityCfg.dotClass}`} aria-hidden />
              {priorityCfg.label}
            </span>
          ) : (
            <span />
          )}
          <Badge
            variant="secondary"
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${typeColor}`}
          >
            {request.request_type}
          </Badge>
        </div>

        {/* Título */}
        <h3 className="text-sm font-semibold tracking-tight text-foreground line-clamp-2 leading-snug">
          {request.title}
        </h3>

        {/* Metadados compactos */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <AreaIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            {request.requesting_area}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            {format(new Date(request.requested_at), "dd/MM/yyyy", { locale: ptBR })}
          </span>
          {isTimerActive ? (
            <span className="flex items-center gap-1 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {liveElapsed}
            </span>
          ) : (
            timeTotal && timeTotal !== "0min" && (
              <span className="flex items-center gap-1 text-[#101f2e] dark:text-primary-foreground font-medium">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {timeTotal}
              </span>
            )
          )}
        </div>

        {/* Deadline + SLA operacional */}
        {(deadlineLabel || isStageOverdue) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            {deadlineLabel && (
              <span className={`flex items-center gap-1 font-medium ${
                isProductionOverdue
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
              }`}>
                <CalendarX2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {isProductionStage ? "Prazo produção" : "Prazo original"}: {deadlineLabel}
                {isProductionOverdue && ` · Produção vencida há ${productionDelayDays}d`}
              </span>
            )}
            {isStageOverdue && (
              <span className={`flex items-center gap-1 ${
                daysInStage >= (stageSla ?? 0) + 3
                  ? "text-red-500 dark:text-red-400 font-medium"
                  : daysInStage >= (stageSla ?? 0)
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              }`}>
                <Flag className="h-3 w-3 shrink-0" aria-hidden />
                {stageDelayLabel} há {daysInStage}d
              </span>
            )}
          </div>
        )}

        {/* Descrição */}
        {request.description && (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
            {request.description}
          </p>
        )}

        {/* Divisor */}
        <div className="border-t border-border/20" />

        {/* Footer: comentários + alterações + Concluir + avatares */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Concluir (popover com tipo de conclusão) */}
            {onMarkComplete && request.workflow_stage !== "concluido" && (
              <PopoverPrimitive.Root open={completeOpen} onOpenChange={setCompleteOpen}>
                <PopoverPrimitive.Trigger asChild>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setCompleteOpen(true); }}
                    onKeyDown={(e) => { e.stopPropagation(); }}
                    className="flex items-center gap-1 text-xs rounded-full px-2 py-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/40 transition-colors"
                    aria-label="Concluir tarefa"
                  >
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Concluir
                  </button>
                </PopoverPrimitive.Trigger>
                <PopoverPrimitive.Portal>
                  <PopoverPrimitive.Content
                    side="top"
                    align="start"
                    sideOffset={6}
                    className="z-50 w-56 rounded-xl border border-white/50 dark:border-border/50 bg-white/95 dark:bg-card/95 backdrop-blur-xl shadow-xl p-2 space-y-0.5 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                    onInteractOutside={() => setCompleteOpen(false)}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                      Tipo de conclusão
                    </p>
                    {completionOptions.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkComplete(request.id, t.value);
                          setCompleteOpen(false);
                        }}
                        className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        {t.label}
                      </button>
                    ))}
                  </PopoverPrimitive.Content>
                </PopoverPrimitive.Portal>
              </PopoverPrimitive.Root>
            )}
            {/* Botão de comentários com popover */}
            <PopoverPrimitive.Root open={commentsOpen} onOpenChange={setCommentsOpen}>
              <PopoverPrimitive.Trigger asChild>
                <button
                  type="button"
                  aria-label={`${commentsCount} comentário${commentsCount !== 1 ? "s" : ""} — clique para visualizar`}
                  onClick={handleCommentsOpen}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCommentsOpen(e); }}
                  className={`
                    flex items-center gap-1 text-xs rounded-full px-2 py-1
                    transition-all duration-150 cursor-pointer
                    ${commentsCount > 0
                      ? "text-muted-foreground hover:text-[#101f2e] hover:bg-[#101f2e]/8 dark:hover:bg-white/8"
                      : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60"}
                  `}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{commentsCount}</span>
                </button>
              </PopoverPrimitive.Trigger>

              <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                  side="bottom"
                  align="start"
                  sideOffset={8}
                  className="z-50 w-80 rounded-2xl border border-white/50 dark:border-border/50 bg-white/95 dark:bg-card/95 backdrop-blur-xl shadow-[0_16px_48px_-8px_rgba(0,0,0,0.2)] p-0 overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                  onInteractOutside={() => setCommentsOpen(false)}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-[#101f2e]/[0.03] dark:bg-white/[0.03]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                      Comentários
                    </span>
                    <button
                      type="button"
                      onClick={() => setCommentsOpen(false)}
                      aria-label="Fechar"
                      className="rounded-full p-0.5 hover:bg-muted/60 text-muted-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {loadingComments ? (
                      <div className="flex items-center justify-center py-6">
                        <span className="text-xs text-muted-foreground animate-pulse">Carregando...</span>
                      </div>
                    ) : previewComments.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70 italic text-center py-4">
                        Nenhum comentário ainda.
                      </p>
                    ) : (
                      previewComments.map((c) => (
                        <div
                          key={c.id}
                          className="flex gap-2.5 rounded-xl p-2.5 bg-muted/40 border border-border/20"
                        >
                          <Avatar className="h-7 w-7 shrink-0 border border-white/50">
                            <AvatarImage src={c.user_avatar_url || undefined} />
                            <AvatarFallback className="text-[10px] bg-[#101f2e]/10 text-[#101f2e] dark:bg-white/10">
                              {c.user_name ? getInitials(c.user_name) : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span className="text-[11px] font-medium truncate">{c.user_name ?? "Usuário"}</span>
                              {c.is_alteration && (
                                <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0 ${c.resolved_at ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-100/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
                                  {c.resolved_at ? <CheckCircle2 className="h-2.5 w-2.5" aria-hidden /> : <AlertCircle className="h-2.5 w-2.5" aria-hidden />}
                                  {c.resolved_at
                                  ? `Resolvida${c.resolved_by_user_name ? " por " + c.resolved_by_user_name : ""}`
                                  : "Alteração"}
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground/90 line-clamp-2 whitespace-pre-wrap break-words">
                              {c.body}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {commentsCount > 5 && (
                    <div className="border-t border-border/30 px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCommentsOpen(false); onClick?.(); }}
                        className="text-xs text-[#101f2e] dark:text-primary-foreground font-medium hover:underline"
                      >
                        Ver todos os {commentsCount} comentários →
                      </button>
                    </div>
                  )}
                </PopoverPrimitive.Content>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>

            {/* Badge de alterações pendentes */}
            {pendingAlterationsCount > 0 && (
              <span
                className="flex items-center gap-1 text-xs rounded-full px-2 py-1 bg-amber-100/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-medium"
                title={`${pendingAlterationsCount} alteração${pendingAlterationsCount !== 1 ? "ões" : ""} pendente${pendingAlterationsCount !== 1 ? "s" : ""}`}
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {pendingAlterationsCount}
              </span>
            )}
          </div>

          {/* Avatares sobrepostos */}
          <div className="flex -space-x-2.5">
            {request.assignee_user ? (
              <>
                <Avatar className="h-7 w-7 shrink-0 border-2 border-white dark:border-background ring-1 ring-background">
                  <AvatarImage src={request.assignee_user.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px] bg-[#101f2e]/10 text-[#101f2e] dark:bg-white/10">
                    {getInitials(request.assignee_user.name)}
                  </AvatarFallback>
                </Avatar>
                {solicitanteName && request.assignee_user.name !== solicitanteName && (
                  <Avatar className="h-7 w-7 shrink-0 border-2 border-white dark:border-background ring-1 ring-background">
                    <AvatarImage src={request.solicitante_user?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] bg-muted">
                      {getInitials(solicitanteName)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">Não atribuído</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
