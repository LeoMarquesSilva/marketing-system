"use client";

import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatViosProrrogacaoLabel, isViosTaskProrrogada, type ViosTask } from "@/lib/vios-tasks";
import { cn } from "@/lib/utils";

interface ViosProrrogacaoBadgeProps {
  task: Pick<ViosTask, "prorrogada" | "data_limite_anterior" | "data_limite">;
  className?: string;
  compact?: boolean;
}

export function ViosProrrogacaoBadge({ task, className, compact }: ViosProrrogacaoBadgeProps) {
  if (!isViosTaskProrrogada(task)) return null;

  const title = formatViosProrrogacaoLabel(task);

  if (compact) {
    return (
      <span
        className={cn("inline-flex items-center gap-0.5 text-[10px] text-amber-700", className)}
        title={title}
      >
        <CalendarClock className="h-3 w-3 shrink-0" />
        Prorrogada
      </span>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-50",
        className
      )}
      title={title}
    >
      <CalendarClock className="h-3 w-3 mr-1 shrink-0" />
      Prorrogada
    </Badge>
  );
}
