"use client";

import { useDroppable } from "@dnd-kit/core";
import { LucideIcon, RefreshCw } from "lucide-react";
import { KanbanCard } from "./kanban-card";
import { Button } from "@/components/ui/button";
import type { MarketingRequest } from "@/lib/marketing-requests";
import type {
  CompletionTypeConfig,
  KanbanColumnWidth,
  StageSlaDays,
} from "@/lib/app-settings";

export type ColumnId =
  | "tarefas"
  | "em_producao"
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
  completionTypes?: CompletionTypeConfig[];
  stageSlaDays?: StageSlaDays;
  columnWidth?: KanbanColumnWidth;
  showTimeOnCards?: boolean;
  showRefreshButton?: boolean;
  onRefresh?: () => void;
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
  completionTypes = [],
  stageSlaDays,
  columnWidth = "fixed",
  showTimeOnCards = true,
  showRefreshButton = false,
  onRefresh,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });
  const widthClass = columnWidth === "compact" ? "w-64" : "w-72";

  return (
    <div
      ref={setNodeRef}
      className={`flex shrink-0 ${widthClass} flex-col rounded-lg border bg-muted/30 transition-colors ${
        isOver ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
    >
      <div className="flex items-center gap-2 p-3 border-b">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {requests.length}
        </span>
        {showRefreshButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onRefresh}
            title={`Recarregar etapa ${title}`}
            aria-label={`Recarregar etapa ${title}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2 p-3 min-h-[120px] overflow-y-auto">
        {requests.map((request) => (
          <KanbanCard
            key={request.id}
            request={request}
            onClick={() => onCardClick?.(request)}
            onMarkComplete={onMarkComplete}
            timeTotal={showTimeOnCards ? timeTotals?.[request.id] : undefined}
            commentsCount={commentsCounts?.[request.id] ?? 0}
            pendingAlterationsCount={pendingAlterationsCounts?.[request.id] ?? 0}
            completionTypes={completionTypes}
            stageSlaDays={stageSlaDays}
          />
        ))}
      </div>
    </div>
  );
}
