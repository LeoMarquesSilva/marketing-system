"use client";

import { useState, useCallback } from "react";
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

const WORKFLOW_COLUMNS: { id: ColumnId; title: string; icon: LucideIcon }[] = [
  { id: "tarefas", title: "Tarefas", icon: ClipboardList },
  { id: "revisao", title: "Revisão", icon: Eye },
  { id: "revisado", title: "Revisado", icon: CheckCircle },
  { id: "revisao_autor", title: "Revisão autor", icon: UserCheck },
];

interface KanbanBoardProps {
  requests: MarketingRequest[];
  onRefresh: () => void;
  onCardClick?: (request: MarketingRequest) => void;
  onMarkComplete?: (requestId: string, completionType: string) => void;
  timeTotals?: Record<string, string>;
  commentsCounts?: Record<string, number>;
  pendingAlterationsCounts?: Record<string, number>;
}

const PRIORITY_ORDER: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

function getRequestsForColumn(
  requests: MarketingRequest[],
  columnId: ColumnId
): MarketingRequest[] {
  const stage = columnId as "tarefas" | "revisao" | "revisado" | "revisao_autor";
  return requests
    .filter((r) => (r.workflow_stage || "tarefas") === stage)
    .sort((a, b) => (PRIORITY_ORDER[a.priority ?? "normal"] ?? 2) - (PRIORITY_ORDER[b.priority ?? "normal"] ?? 2));
}

export function KanbanBoard({ requests, onRefresh, onCardClick, onMarkComplete, timeTotals, commentsCounts, pendingAlterationsCounts }: KanbanBoardProps) {
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

  const resolveTargetColumn = useCallback(
    (overId: string): ColumnId | null => {
      if (["tarefas", "revisao", "revisado", "revisao_autor"].includes(overId)) {
        return overId as ColumnId;
      }
      const req = requests.find((r) => r.id === overId);
      return req ? getColumnForRequest(req) : null;
    },
    [requests, getColumnForRequest]
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

      if (targetColumnId === "revisao") {
        setActiveRequest(null);
        setRevisaoArtLink(request.art_link ?? "");
        setPendingMoveToRevisao({ request, prevStage });
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
    [requests, onRefresh, resolveTargetColumn, profile?.id, profile?.name]
  );

  const handleConfirmMoveToRevisao = useCallback(async () => {
    if (!pendingMoveToRevisao) return;
    const { request, prevStage } = pendingMoveToRevisao;
    setIsSubmittingRevisao(true);
    const artLink = revisaoArtLink.trim() || null;
    const { error } = await updateMarketingRequest(request.id, {
      workflow_stage: "revisao",
      art_link: artLink,
      assignee_id: request.solicitante_id,
      assignee: request.solicitante ?? null,
    });
    setIsSubmittingRevisao(false);
    setPendingMoveToRevisao(null);
    setRevisaoArtLink("");
    if (!error) {
      logActivity(request.id, "stage_changed", prevStage, "revisao", profile?.id ?? null, profile?.name ?? null);
      onRefresh();
    }
  }, [pendingMoveToRevisao, revisaoArtLink, profile?.id, profile?.name, onRefresh]);

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
          {WORKFLOW_COLUMNS.map((col) => (
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
                  Link da arte
                </label>
                <input
                  id="revisao-art-link"
                  type="url"
                  placeholder="https://..."
                  value={revisaoArtLink}
                  onChange={(e) => setRevisaoArtLink(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={handleCancelMoveToRevisao}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmMoveToRevisao} disabled={isSubmittingRevisao}>
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
