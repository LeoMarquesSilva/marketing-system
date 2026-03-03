"use client";

import { useDroppable } from "@dnd-kit/core";
import { LucideIcon } from "lucide-react";
import { KanbanCard } from "./kanban-card";
import type { MarketingRequest } from "@/lib/marketing-requests";

export type ColumnId =
  | "tarefas"
  | "revisao"
  | "revisado"
  | "revisao_autor"
  | "concluido";

interface KanbanColumnProps {
  id: ColumnId;
  title: string;
  icon?: LucideIcon;
  requests: MarketingRequest[];
  onCardClick?: (request: MarketingRequest) => void;
  onMarkComplete?: (requestId: string, completionType: string) => void;
  timeTotals?: Record<string, string>;
  commentsCounts?: Record<string, number>;
  pendingAlterationsCounts?: Record<string, number>;
}

export function KanbanColumn({
  id,
  title,
  icon: Icon,
  requests,
  onCardClick,
  onMarkComplete,
  timeTotals,
  commentsCounts,
  pendingAlterationsCounts,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex shrink-0 w-72 flex-col rounded-lg border bg-muted/30 transition-colors ${
        isOver ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
    >
      <div className="flex items-center gap-2 p-3 border-b">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {requests.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3 min-h-[120px] overflow-y-auto">
        {requests.map((request) => (
          <KanbanCard
            key={request.id}
            request={request}
            onClick={() => onCardClick?.(request)}
            onMarkComplete={onMarkComplete}
            timeTotal={timeTotals?.[request.id]}
            commentsCount={commentsCounts?.[request.id] ?? 0}
            pendingAlterationsCount={pendingAlterationsCounts?.[request.id] ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
