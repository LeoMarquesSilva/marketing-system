"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAreaIcon } from "@/lib/area-icons";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GripVertical, CalendarCheck, Calendar } from "lucide-react";

export type DisponivelAgeTier = "new" | "medium" | "old";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const DRAGGABLE_TYPE = "post-disponivel";

const AGE_TIER_CLASSES: Record<DisponivelAgeTier, string> = {
  new: "border-border/50 bg-card",
  medium:
    "border-amber-400/60 dark:border-amber-500/50 bg-amber-50/80 dark:bg-amber-950/30",
  old: "border-orange-400/60 dark:border-orange-500/50 bg-orange-50/80 dark:bg-orange-950/30",
};

export interface ScheduleDisponivelCardProps {
  request: MarketingRequest;
  ageTier?: DisponivelAgeTier;
  onClick?: () => void;
}

export function ScheduleDisponivelCard({ request, ageTier = "new", onClick }: ScheduleDisponivelCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: request.id,
    data: { type: DRAGGABLE_TYPE, request },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const title = request.description || request.title;
  const area = request.requesting_area;
  const AreaIcon = getAreaIcon(area);
  const solicitanteName =
    request.nome_advogado || request.solicitante_user?.name || request.solicitante || "";

  const solicitadoEm = format(new Date(request.requested_at), "dd/MM/yyyy", { locale: ptBR });
  const concluidoEm = format(
    new Date(request.stage_changed_at ?? request.delivered_at ?? request.requested_at),
    "dd/MM/yyyy",
    { locale: ptBR }
  );

  const ageTierClass = AGE_TIER_CLASSES[ageTier];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 rounded-xl border p-4 shadow-sm min-h-[72px] overflow-hidden
        cursor-grab active:cursor-grabbing
        transition-shadow hover:shadow-md
        ${ageTierClass}
        ${isDragging ? "opacity-60 shadow-lg z-50" : ""}
      `}
    >
      <button
        type="button"
        className="touch-none p-0.5 text-muted-foreground hover:text-foreground focus:outline-none shrink-0"
        aria-label="Arrastar"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 flex-1 text-left flex items-center gap-3 overflow-hidden"
      >
        {(request.solicitante_user || solicitanteName) && (
          <Avatar className="h-9 w-9 shrink-0 border border-border/50">
            <AvatarImage src={request.solicitante_user?.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
              {getInitials(solicitanteName || "?")}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{title}</p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground min-w-0">
            <AreaIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{area}</span>
          </div>
          <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-muted-foreground min-w-0" title={`Solicitado em ${solicitadoEm} · Concluído em ${concluidoEm}`}>
            <span className="flex items-center gap-1.5 min-w-0">
              <Calendar className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">Solicitado em {solicitadoEm}</span>
            </span>
            <span className="flex items-center gap-1.5 min-w-0">
              <CalendarCheck className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">Concluído em {concluidoEm}</span>
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

/** Versão só visual para usar dentro de DragOverlay (sem useDraggable). */
export function ScheduleDisponivelCardOverlay({ request }: { request: MarketingRequest }) {
  const title = request.description || request.title;
  const area = request.requesting_area;
  const AreaIcon = getAreaIcon(area);
  const solicitanteName =
    request.nome_advogado || request.solicitante_user?.name || request.solicitante || "";
  const solicitadoEm = format(new Date(request.requested_at), "dd/MM/yyyy", { locale: ptBR });
  const concluidoEm = format(
    new Date(request.stage_changed_at ?? request.delivered_at ?? request.requested_at),
    "dd/MM/yyyy",
    { locale: ptBR }
  );

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-xl min-h-[72px] w-64 cursor-grabbing border-primary/30 overflow-hidden">
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 flex items-center gap-3 overflow-hidden">
        {(request.solicitante_user || solicitanteName) && (
          <Avatar className="h-9 w-9 shrink-0 border border-border/50">
            <AvatarImage src={request.solicitante_user?.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
              {getInitials(solicitanteName || "?")}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{title}</p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground min-w-0">
            <AreaIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{area}</span>
          </div>
          <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-muted-foreground min-w-0">
            <span className="flex items-center gap-1.5 min-w-0">
              <Calendar className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">Solicitado em {solicitadoEm}</span>
            </span>
            <span className="flex items-center gap-1.5 min-w-0">
              <CalendarCheck className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">Concluído em {concluidoEm}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
