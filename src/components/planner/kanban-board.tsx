"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ClipboardList,
  Eye,
  CheckCircle,
  Send,
  UserCheck,
  Check,
  CheckCircle2,
  ExternalLink,
  LayoutGrid,
  PlayCircle,
  Share2,
  Tag,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KanbanColumn, type ColumnId } from "./kanban-column";
import { KanbanCardOverlay } from "./kanban-card-overlay";
import { getTitleTag } from "@/lib/planner-title-tag";
import { plannerTagDeliveryPath, plannerTagDeliveryUrl } from "@/lib/request-files/domain";
import {
  type MarketingRequest,
  updateWorkflowStage,
  updateMarketingRequest,
} from "@/lib/marketing-requests";
import { ReelCoverArtField } from "@/components/planner/reel-cover-art-field";
import { RequestFilesField } from "@/components/planner/request-files-field";
import { logActivity } from "@/lib/activity-log";
import { useAuth } from "@/contexts/auth-context";
import type {
  CompletionTypeConfig,
  StageMoveRules,
  KanbanDisplayOptions,
  StageSlaDays,
} from "@/lib/app-settings";

const DEFAULT_WORKFLOW_COLUMNS: { id: ColumnId; title: string; icon: LucideIcon }[] = [
  { id: "tarefas", title: "Aguardando produção", icon: ClipboardList },
  { id: "em_producao", title: "Em produção", icon: PlayCircle },
  { id: "revisao", title: "Em revisão", icon: Eye },
  { id: "revisao_autor", title: "Ajustes solicitados", icon: UserCheck },
  { id: "revisado", title: "Aprovado / pronto", icon: CheckCircle },
  { id: "pronto_envio", title: "Enviar por e-mail", icon: Send },
];

const STAGE_ICONS: Record<string, LucideIcon> = {
  tarefas: ClipboardList,
  em_producao: PlayCircle,
  revisao: Eye,
  revisado: CheckCircle,
  pronto_envio: Send,
  revisao_autor: UserCheck,
  tarefas_leonardo: User,
};

interface WorkflowColumnConfig {
  id: string;
  title: string;
}

interface KanbanBoardProps {
  requests: MarketingRequest[];
  onRefresh: () => void;
  showColumnRefresh?: boolean;
  onColumnRefresh?: (columnId: string) => void;
  onCardClick?: (request: MarketingRequest) => void;
  onMarkComplete?: (requestId: string, completionType: string) => void;
  timeTotals?: Record<string, string>;
  commentsCounts?: Record<string, number>;
  pendingAlterationsCounts?: Record<string, number>;
  checklistTotals?: Record<string, number>;
  checklistCompleted?: Record<string, number>;
  workflowColumns?: WorkflowColumnConfig[];
  completionTypes?: CompletionTypeConfig[];
  stageMoveRules?: StageMoveRules;
  stageSlaDays?: StageSlaDays;
  kanbanDisplayOptions?: KanbanDisplayOptions;
}

const PRIORITY_ORDER: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

function getRequestsForColumn(
  requests: MarketingRequest[],
  columnId: string,
  cardSort: "priority" | "deadline" = "priority"
): MarketingRequest[] {
  const filtered = requests.filter(
    (r) => (r.workflow_stage || "tarefas") === columnId
  );
  if (cardSort === "deadline") {
    return filtered.sort((a, b) => {
      const aDead = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bDead = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return aDead - bDead;
    });
  }
  return filtered.sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority ?? "normal"] ?? 2) -
      (PRIORITY_ORDER[b.priority ?? "normal"] ?? 2)
  );
}

export interface TitleTagSummary {
  tag: string;
  total: number;
  completed: number;
}

/** Tags de título presentes nas solicitações, da mais usada para a menos usada. */
export function summarizeTitleTags(requests: MarketingRequest[]): TitleTagSummary[] {
  const map = new Map<string, TitleTagSummary>();
  for (const req of requests) {
    const titleTag = getTitleTag(req.title);
    if (!titleTag) continue;
    const summary = map.get(titleTag.tag) ?? { tag: titleTag.tag, total: 0, completed: 0 };
    summary.total += 1;
    if (req.workflow_stage === "concluido") summary.completed += 1;
    map.set(titleTag.tag, summary);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag, "pt-BR"));
}

/** Copia o link da página de download das peças da tag (exige login no sistema). */
function TagDeliveryLink({ tag }: { tag: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(plannerTagDeliveryUrl(tag));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void copyLink()}
        title="Página para baixar as artes e copiar as legendas (com login)"
        className="flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.02] px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-black/[0.05] hover:text-foreground dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
        ) : (
          <Share2 className="h-3.5 w-3.5" aria-hidden />
        )}
        {copied ? "Link copiado" : "Link de download"}
      </button>
      <a
        href={plannerTagDeliveryPath(tag)}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Abrir a página de download de [${tag}]`}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </span>
  );
}

interface TitleTagFilterProps {
  tags: TitleTagSummary[];
  activeTag: string | null;
  onChange: (tag: string | null) => void;
}

/** Chips de filtro rápido pelas tags do título ("[OAB]", "[DC]"...). Clicar de novo limpa. */
export function TitleTagFilter({ tags, activeTag, onChange }: TitleTagFilterProps) {
  if (tags.length === 0) return null;
  const active = tags.find((t) => t.tag === activeTag) ?? null;
  const progress = active && active.total > 0 ? Math.round((active.completed / active.total) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por tag do título">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Tag className="h-3.5 w-3.5" aria-hidden />
        Tags
      </span>
      {tags.map((t) => {
        const isActive = t.tag === activeTag;
        return (
          <button
            key={t.tag}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(isActive ? null : t.tag)}
            title={isActive ? "Limpar filtro" : `Mostrar só [${t.tag}] · ${t.completed} de ${t.total} concluídos`}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#04202f]/40 focus-visible:ring-offset-2 ${
              isActive
                ? "border-transparent bg-[#04202f] text-white dark:bg-white dark:text-[#04202f]"
                : "border-black/10 bg-black/[0.02] text-foreground/80 hover:bg-black/[0.05] hover:text-foreground dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
            }`}
          >
            <span className="font-semibold tracking-wide">{t.tag}</span>
            <span className={`tabular-nums ${isActive ? "text-white/70 dark:text-[#04202f]/60" : "text-muted-foreground/70"}`}>
              {t.completed}/{t.total}
            </span>
            {isActive && <X className="h-3 w-3 shrink-0" aria-hidden />}
          </button>
        );
      })}
      {active && <TagDeliveryLink key={active.tag} tag={active.tag} />}
      {active && (
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-full px-3 py-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
          <span className="tabular-nums">
            {active.completed}/{active.total} concluídos
          </span>
          <span
            className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
            role="progressbar"
            aria-label={`Progresso de [${active.tag}]`}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
          </span>
        </span>
      )}
    </div>
  );
}

export function KanbanBoard({
  requests,
  onRefresh,
  showColumnRefresh = false,
  onColumnRefresh,
  onCardClick,
  onMarkComplete,
  timeTotals,
  commentsCounts,
  pendingAlterationsCounts,
  checklistTotals,
  checklistCompleted,
  workflowColumns: workflowColumnsProp,
  completionTypes = [],
  stageMoveRules = {},
  stageSlaDays,
  kanbanDisplayOptions = {},
}: KanbanBoardProps) {
  const displayOpts = {
    columnWidth: kanbanDisplayOptions.columnWidth ?? "fixed",
    cardSort: kanbanDisplayOptions.cardSort ?? "priority",
    showTimeOnCards: kanbanDisplayOptions.showTimeOnCards ?? true,
  };
  const getStageRule = useCallback(
    (stageId: string) =>
      stageMoveRules[stageId] ?? {
        showArtLinkDialog: true,
        keepAssignee: true,
      },
    [stageMoveRules]
  );
  const columns = useMemo(() => {
    if (workflowColumnsProp && workflowColumnsProp.length > 0) {
      return workflowColumnsProp.map((col) => ({
        id: col.id as ColumnId,
        title: col.title,
        icon: STAGE_ICONS[col.id] ?? LayoutGrid,
      }));
    }
    return DEFAULT_WORKFLOW_COLUMNS;
  }, [workflowColumnsProp]);
  const [activeRequest, setActiveRequest] = useState<MarketingRequest | null>(null);
  const [pendingMoveToRevisao, setPendingMoveToRevisao] = useState<{
    request: MarketingRequest;
    prevStage: string;
  } | null>(null);
  const [revisaoArtLink, setRevisaoArtLink] = useState("");
  // Capa de Reels: a designer entrega a imagem no sistema em vez de um link.
  const [revisaoImagePath, setRevisaoImagePath] = useState<string | null>(null);
  // Demais tarefas: arquivos da arte enviados na própria tarefa (o link vira opcional).
  const [revisaoFileCount, setRevisaoFileCount] = useState(0);
  const [isSubmittingRevisao, setIsSubmittingRevisao] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const { profile } = useAuth();
  const revisaoRule = getStageRule("revisao");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const req = requests.find((r) => r.id === event.active.id);
    if (req) setActiveRequest(req);
  }, [requests]);

  const handleCardClick = useCallback(
    (request: MarketingRequest) => {
      onCardClick?.(request);
    },
    [onCardClick]
  );

  const getColumnForRequest = useCallback((req: MarketingRequest): ColumnId => {
    if (req.workflow_stage === "concluido") return "concluido";
    return (req.workflow_stage || "tarefas") as ColumnId;
  }, []);

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  const resolveTargetColumn = useCallback(
    (overId: string): ColumnId | null => {
      if (columnIds.includes(overId as ColumnId)) {
        return overId as ColumnId;
      }
      const req = requests.find((r) => r.id === overId);
      return req ? getColumnForRequest(req) : null;
    },
    [requests, getColumnForRequest, columnIds]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setMoveError(null);
      if (!over) {
        setActiveRequest(null);
        return;
      }

      const requestId = active.id as string;
      const targetColumnId = resolveTargetColumn(over.id as string);
      if (!targetColumnId) {
        setActiveRequest(null);
        return;
      }

      const request = requests.find((r) => r.id === requestId);
      if (!request) {
        setActiveRequest(null);
        return;
      }

      const prevStage = (request.workflow_stage || "tarefas") as string;
      const targetRule = getStageRule(targetColumnId);

      if (targetColumnId === "revisao" && targetRule.showArtLinkDialog) {
        setActiveRequest(null);
        setRevisaoArtLink(request.art_link ?? "");
        setRevisaoImagePath(request.art_image_path ?? null);
        setRevisaoFileCount(0);
        setPendingMoveToRevisao({ request, prevStage });
        return;
      }

      if (targetColumnId === "revisao" && !targetRule.showArtLinkDialog) {
        setActiveRequest(null);
        const artLink = request.art_link ?? null;
        const updatePayload: Parameters<typeof updateMarketingRequest>[1] = {
          workflow_stage: "revisao",
          art_link: artLink,
        };
        if (!targetRule.keepAssignee) {
          updatePayload.assignee_id = request.solicitante_id ?? undefined;
          updatePayload.assignee = request.solicitante ?? null;
        }
        const { error } = await updateMarketingRequest(request.id, updatePayload);
        if (!error) {
          logActivity(request.id, "stage_changed", prevStage, "revisao", profile?.id ?? null, profile?.name ?? null);
          onRefresh();
        } else {
          setMoveError("Não foi possível mover a solicitação. Tente recarregar o Kanban.");
        }
        return;
      }

      setActiveRequest(null);
      const stage = targetColumnId as
        | "tarefas"
        | "em_producao"
        | "revisao"
        | "revisado"
        | "pronto_envio"
        | "revisao_autor";
      if (!targetRule.keepAssignee && (request.solicitante_id ?? request.solicitante)) {
        const updatePayload: Parameters<typeof updateMarketingRequest>[1] = {
          workflow_stage: stage,
          assignee_id: request.solicitante_id ?? undefined,
          assignee: request.solicitante ?? null,
        };
        const { error } = await updateMarketingRequest(request.id, updatePayload);
        if (!error) {
          logActivity(requestId, "stage_changed", prevStage, stage, profile?.id ?? null, profile?.name ?? null);
          onRefresh();
        } else {
          setMoveError("Não foi possível mover a solicitação. Tente recarregar o Kanban.");
        }
      } else {
        const { error } = await updateWorkflowStage(requestId, stage);
        if (!error) {
          logActivity(requestId, "stage_changed", prevStage, stage, profile?.id ?? null, profile?.name ?? null);
          onRefresh();
        } else {
          setMoveError("Não foi possível mover a solicitação. Tente recarregar o Kanban.");
        }
      }
    },
    [requests, onRefresh, resolveTargetColumn, profile?.id, profile?.name, getStageRule, setRevisaoArtLink, setRevisaoImagePath, setRevisaoFileCount]
  );

  const handleConfirmMoveToRevisao = useCallback(async () => {
    if (!pendingMoveToRevisao) return;
    const { request, prevStage } = pendingMoveToRevisao;
    setIsSubmittingRevisao(true);
    const artLink = revisaoArtLink.trim() || null;
    const isCoverRequest = Boolean(request.reel_delivery_id);
    const payload: Parameters<typeof updateMarketingRequest>[1] = isCoverRequest
      ? { workflow_stage: "revisao" }
      : { workflow_stage: "revisao", art_link: artLink };
    if (!revisaoRule.keepAssignee) {
      payload.assignee_id = request.solicitante_id ?? undefined;
      payload.assignee = request.solicitante ?? null;
    }
    const { error } = await updateMarketingRequest(request.id, payload);
    setIsSubmittingRevisao(false);
    if (!error) {
      setMoveError(null);
      setPendingMoveToRevisao(null);
      setRevisaoArtLink("");
      logActivity(request.id, "stage_changed", prevStage, "revisao", profile?.id ?? null, profile?.name ?? null);
      onRefresh();
    } else {
      setMoveError("Não foi possível enviar para revisão. Confira o link e tente novamente.");
    }
  }, [pendingMoveToRevisao, revisaoArtLink, revisaoRule.keepAssignee, profile?.id, profile?.name, onRefresh, setRevisaoArtLink]);

  const handleCancelMoveToRevisao = useCallback(() => {
    setPendingMoveToRevisao(null);
    setRevisaoArtLink("");
    setMoveError(null);
  }, [setRevisaoArtLink]);

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {moveError && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {moveError}
          </div>
        )}
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              icon={col.icon}
              requests={getRequestsForColumn(requests, col.id, displayOpts.cardSort)}
              onCardClick={handleCardClick}
              onMarkComplete={onMarkComplete}
              timeTotals={timeTotals}
              commentsCounts={commentsCounts}
              pendingAlterationsCounts={pendingAlterationsCounts}
              checklistTotals={checklistTotals}
              checklistCompleted={checklistCompleted}
              completionTypes={completionTypes}
              stageSlaDays={stageSlaDays}
              columnWidth={displayOpts.columnWidth}
              showTimeOnCards={displayOpts.showTimeOnCards}
              showRefreshButton={showColumnRefresh}
              onRefresh={() => {
                if (onColumnRefresh) onColumnRefresh(col.id);
                else onRefresh();
              }}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeRequest ? (
            <KanbanCardOverlay
              request={activeRequest}
              timeTotal={timeTotals?.[activeRequest.id]}
              commentsCount={commentsCounts?.[activeRequest.id] ?? 0}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Dialog: Enviar para revisão (link da arte + responsável vira revisor) */}
      <Dialog open={!!pendingMoveToRevisao} onOpenChange={(open) => !open && handleCancelMoveToRevisao()}>
        <DialogContent className="max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Enviar para revisão</DialogTitle>
            <DialogDescription>
              Suba os arquivos finais da arte (ou informe um link) para o revisor acessar. Conforme a configuração do Kanban, o atribuído (designer) pode ser mantido ou trocado pelo solicitante (revisor).
            </DialogDescription>
          </DialogHeader>
          {pendingMoveToRevisao && (
            <>
              {pendingMoveToRevisao.request.reel_delivery_id ? (
                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium text-foreground">
                    Arte da capa <span className="text-destructive">*</span>
                  </p>
                  <ReelCoverArtField
                    requestId={pendingMoveToRevisao.request.id}
                    reelDeliveryId={pendingMoveToRevisao.request.reel_delivery_id}
                    imagePath={revisaoImagePath}
                    canEdit
                    onUploaded={setRevisaoImagePath}
                  />
                  {moveError && <p className="text-xs font-medium text-destructive">{moveError}</p>}
                </div>
              ) : (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium text-foreground">
                  Arquivos da arte <span className="text-destructive">*</span>
                </p>
                <RequestFilesField
                  requestId={pendingMoveToRevisao.request.id}
                  canEdit
                  onFilesChange={(files) => setRevisaoFileCount(files.length)}
                />
                <label htmlFor="revisao-art-link" className="block pt-2 text-sm font-medium text-foreground">
                  Ou link da arte
                </label>
                <input
                  id="revisao-art-link"
                  type="url"
                  placeholder="https://..."
                  value={revisaoArtLink}
                  onChange={(e) => setRevisaoArtLink(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Envie os arquivos ou informe um link para mandar para revisão.
                </p>
                {moveError && (
                  <p className="text-xs font-medium text-destructive">
                    {moveError}
                  </p>
                )}
              </div>
              )}
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={handleCancelMoveToRevisao}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmMoveToRevisao}
                  disabled={
                    isSubmittingRevisao ||
                    (pendingMoveToRevisao.request.reel_delivery_id
                      ? !revisaoImagePath
                      : !revisaoArtLink.trim() && revisaoFileCount === 0)
                  }
                >
                  {isSubmittingRevisao ? "Enviando..." : "Enviar para revisão"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
