"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Filter, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ScheduleHeaderProps {
  title?: string;
  rangeStart: Date;
  rangeEnd: Date;
  onPrevRange: () => void;
  onNextRange: () => void;
  onFiltersClick?: () => void;
  onPublishClick?: () => void;
  showFilters?: boolean;
  showPublish?: boolean;
}

export function ScheduleHeader({
  title = "Agenda",
  rangeStart,
  rangeEnd,
  onPrevRange,
  onNextRange,
  onFiltersClick,
  onPublishClick,
  showFilters = true,
  showPublish = true,
}: ScheduleHeaderProps) {
  const rangeLabel = `${format(rangeStart, "d MMM", { locale: ptBR })} – ${format(rangeEnd, "d MMM (yyyy)", { locale: ptBR })}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPrevRange}
            aria-label="Período anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[180px] px-3 py-1.5 text-sm font-medium text-foreground text-center">
            {rangeLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onNextRange}
            aria-label="Próximo período"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {showFilters && (
          <Button variant="outline" size="sm" onClick={onFiltersClick} className="gap-1.5">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Filtros
          </Button>
        )}
        {showPublish && (
          <Button
            size="sm"
            onClick={onPublishClick}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            Publicar
          </Button>
        )}
      </div>
    </div>
  );
}
