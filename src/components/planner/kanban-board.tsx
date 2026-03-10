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
  UserCheck,
  LayoutGrid,
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
import {
  type MarketingRequest,
  updateWorkflowStage,
  updateMarketingRequest,
} from "@/lib/marketing-requests";
import { logActivity } from "@/lib/activity-log";
import { useAuth } from "@/contexts/auth-context";
import type { CompletionTypeConfig, StageMoveRules } from "@/lib/app-settings";

const DEFAULT_WORKFLOW_COLUMNS: { id: ColumnId; title: string; icon: LucideIcon }[] = [
  { id: "tarefas", title: "Tarefas", icon: ClipboardList },
  { id: "revisao", title: "Revisão", icon: Eye },
  { id: "revisado", title: "Revisado", icon: CheckCircle },
  { id: "revisao_autor", title: "Revisão autor", icon: UserCheck },
];

const STAGE_ICONS: Record<string, LucideIcon> = {
  tarefas: ClipboardList,
  revisao: Eye,
  revisado: CheckCircle,
  revisao_autor: UserCheck,
};

interface WorkflowColumnConfig {
  id: string;
  title: string;
}

interface KanbanBoardProps {
  requests: MarketingRequest[];
  onRefresh: () => void;
  onCardClick?: (request: MarketingRequest) => void;
  onMarkComplete?: (requestId: string, completionType: string) => void;
  timeTotals?: Record<string, string>;
  commentsCounts?: Record<string, number>;
  pendingAlterationsCounts?: Record<string, number>;
  workflowColumns?: WorkflowColumnConfig[];
  completionTypes?: CompletionTypeConfig[];
  stageMoveRules?: StageMoveRules;
}

const PRIORITY_ORDER: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

function getRequestsForColumn(
  requests: MarketingRequest[],
  columnId: string
): MarketingRequest[] {
  return requests
    .filter((r) => (r.workflow_stage || "tarefas") === columnId)
    .sort((a, b) => (PRIORITY_ORDER[a.priority ?? "normal"] ?? 2) - (PRIORITY_ORDER[b.priority ?? "normal"] ?? 2));
}

export function KanbanBoard({
  requests,
  onRefresh,
  onCardClick,
  onMarkComplete,
  timeTotals,
  commentsCounts,
  pendingAlterationsCounts,
  workflowColumns: workflowColumnsProp,
  completionTypes = [],
  stageMoveRules = {},
}: KanbanBoardProps) {
  const revisaoRule = stageMoveRules.revisao ?? { showArtLinkDialog: true, keepAssignee: false };
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
  const [isSubmittingRevisao, setIsSubmittingRevisao] = useState(false);
  const { profile } = useAuth();

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

      if (targetColumnId === "revisao" && revisaoRule.showArtLinkDialog) {
        setActiveRequest(null);
        setRevisaoArtLink(request.art_link ?? "");
        setPendingMoveToRevisao({ request, prevStage });
        return;
      }

      if (targetColumnId === "revisao" && !revisaoRule.showArtLinkDialog) {
        setActiveRequest(null);
        const artLink = request.art_link ?? null;
        const updatePayload: Parameters<typeof updateMarketingRequest>[1] = {
          workflow_stage: "revisao",
          art_link: artLink,
        };
        if (!revisaoRule.keepAssignee) {
          updatePayload.assignee_id = request.solicitante_id ?? undefined;
          updatePayload.assignee = request.solicitante ?? null;
        }
        const { error } = await updateMarketingRequest(request.id, updatePayload);
        if (!error) {
          logActivity(request.id, "stage_changed", prevStage, "revisao", profile?.id ?? null, profile?.name ?? null);
          onRefresh();
        }
        return;
      }

      setActiveRequest(null);
      const stage = targetColumnId as
        | "tarefas"
        | "revisao"
        | "revisado"
        | "revisao_autor";
      const { error } = await updateWorkflowStage(requestId, stage);
      if (!error) {
        logActivity(requestId, "stage_changed", prevStage, stage, profile?.id ?? null, profile?.name ?? null);
        onRefresh();
      }
    },
    [requests, onRefresh, resolveTargetColumn, profile?.id, profile?.name, revisaoRule]
  );

  const handleConfirmMoveToRevisao = useCallback(async () => {
    if (!pendingMoveToRevisao) return;
    const { request, prevStage } = pendingMoveToRevisao;
    setIsSubmittingRevisao(true);
    const artLink = revisaoArtLink.trim() || null;
    const payload: Parameters<typeof updateMarketingRequest>[1] = {
      workflow_stage: "revisao",
      art_link: artLink,
    };
    if (!revisaoRule.keepAssignee) {
      payload.assignee_id = request.solicitante_id ?? undefined;
      payload.assignee = request.solicitante ?? null;
    }
    const { error } = await updateMarketingRequest(request.id, payload);
    setIsSubmittingRevisao(false);
    setPendingMoveToRevisao(null);
    setRevisaoArtLink("");
    if (!error) {
      logActivity(request.id, "stage_changed", prevStage, "revisao", profile?.id ?? null, profile?.name ?? null);
      onRefresh();
    }
  }, [pendingMoveToRevisao, revisaoArtLink, revisaoRule.keepAssignee, profile?.id, profile?.name, onRefresh]);

  const handleCancelMoveToRevisao = useCallback(() => {
    setPendingMoveToRevisao(null);
    setRevisaoArtLink("");
  }, []);

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              icon={col.icon}
              requests={getRequestsForColumn(requests, col.id)}
              onCardClick={handleCardClick}
              onMarkComplete={onMarkComplete}
              timeTotals={timeTotals}
              commentsCounts={commentsCounts}
              pendingAlterationsCounts={pendingAlterationsCounts}
              completionTypes={completionTypes}
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
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Enviar para revisão</DialogTitle>
            <DialogDescription>
              Informe o link da arte para o revisor acessar. O responsável desta tarefa passará a ser o solicitante (revisor).
            </DialogDescription>
          </DialogHeader>
          {pendingMoveToRevisao && (
            <>
              <div className="space-y-2 pt-2">
                <label htmlFor="revisao-art-link" className="text-sm font-medium text-foreground">
                  Link da arte <span className="text-destructive">*</span>
                </label>
                <input
                  id="revisao-art-link"
                  type="url"
                  placeholder="https://..."
                  value={revisaoArtLink}
                  onChange={(e) => setRevisaoArtLink(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-required="true"
                />
                <p className="text-xs text-muted-foreground">
                  Obrigatório para enviar para revisão.
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={handleCancelMoveToRevisao}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmMoveToRevisao}
                  disabled={isSubmittingRevisao || !revisaoArtLink.trim()}
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
