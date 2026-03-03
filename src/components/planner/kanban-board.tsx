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
import { KanbanColumn, type ColumnId } from "./kanban-column";
import { KanbanCardOverlay } from "./kanban-card-overlay";
import {
  type MarketingRequest,
  updateWorkflowStage,
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

export function KanbanBoard({ requests, onRefresh, onCardClick, timeTotals, commentsCounts, pendingAlterationsCounts }: KanbanBoardProps) {
  const [activeRequest, setActiveRequest] = useState<MarketingRequest | null>(null);
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
      setActiveRequest(null);
      const { active, over } = event;
      if (!over) return;

      const requestId = active.id as string;
      const targetColumnId = resolveTargetColumn(over.id as string);
      if (!targetColumnId) return;

      const request = requests.find((r) => r.id === requestId);
      if (!request) return;

      const stage = targetColumnId as
        | "tarefas"
        | "revisao"
        | "revisado"
        | "revisao_autor";
      const prevStage = (request.workflow_stage || "tarefas") as string;
      const { error } = await updateWorkflowStage(requestId, stage);
      if (!error) {
        logActivity(requestId, "stage_changed", prevStage, stage, profile?.id ?? null, profile?.name ?? null);
        onRefresh();
      }
    },
    [requests, onRefresh, resolveTargetColumn]
  );

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
    </>
  );
}
