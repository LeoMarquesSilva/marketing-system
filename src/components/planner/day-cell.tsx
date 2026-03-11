"use client";

import { format, startOfDay } from "date-fns";
import { useDroppable } from "@dnd-kit/core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { PostPill } from "./post-pill";
import { getAreaIcon } from "@/lib/area-icons";
import { GripVertical } from "lucide-react";

function toDateKey(d: Date): string {
  return format(startOfDay(d), "yyyy-MM-dd");
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export interface DayCellEmptyProps {
  day: Date;
  rowIndex: number;
}

export function DayCellEmpty({ day, rowIndex }: DayCellEmptyProps) {
  const dayKey = toDateKey(day);
  const droppableId = `day-${dayKey}-${rowIndex}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId, data: { dayKey } });

  return (
    <td className="min-w-[152px] w-[152px] max-w-[152px] p-1 border-b border-r border-border/30 align-top">
      <div
        ref={setNodeRef}
        className={`
          h-[108px] min-h-[108px] w-full rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1 box-border
          ${isOver ? "border-primary bg-primary/5" : "border-border/40 bg-muted/5"}
        `}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" aria-hidden />
        <span className="text-[10px] text-muted-foreground/60 text-center leading-tight">Arraste um post</span>
      </div>
    </td>
  );
}

interface DayCellProps {
  request: MarketingRequest;
  day: Date;
  rowIndex?: number;
  onCardClick?: (request: MarketingRequest, options: { isPostado: boolean }) => void;
}

export function DayCell({ request, day, rowIndex = 0, onCardClick }: DayCellProps) {
  const dayKey = toDateKey(day);
  const deliveredAt = request.delivered_at || request.requested_at;
  const deliveredKey = deliveredAt ? toDateKey(new Date(deliveredAt)) : null;
  const postedAt = request.posted_at ? toDateKey(new Date(request.posted_at)) : null;
  const isPostado = request.completion_type === "postagem_feita";

  const showPostadoHere = isPostado && dayKey === postedAt;
  const showDisponivelHere = !isPostado && deliveredKey && dayKey === deliveredKey;
  const showInThisDay = showPostadoHere || showDisponivelHere;

  const droppableId = `day-${dayKey}-${rowIndex}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId, data: { dayKey } });

  if (!showInThisDay) {
    return (
      <td className="min-w-[152px] w-[152px] max-w-[152px] p-1 border-b border-r border-border/30 align-top">
        <div
          ref={setNodeRef}
          className={`
            h-[108px] min-h-[108px] w-full rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1 box-border
            ${isOver ? "border-primary bg-primary/5" : "border-border/40 bg-muted/5"}
          `}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" aria-hidden />
          <span className="text-[10px] text-muted-foreground/60 text-center leading-tight">Arraste um post</span>
        </div>
      </td>
    );
  }

  const showAsPostado = showPostadoHere;
  const label = showAsPostado ? "Postado" : "Disponível";
  const title = request.description || request.title;
  const area = request.requesting_area;
  const AreaIcon = getAreaIcon(area);
  const solicitanteName =
    request.nome_advogado || request.solicitante_user?.name || request.solicitante || "";

  return (
    <td className="min-w-[152px] w-[152px] max-w-[152px] p-1.5 border-b border-r border-border/50 align-top">
      <button
        type="button"
        onClick={() => onCardClick?.(request, { isPostado: showAsPostado })}
        className="w-full h-full min-h-[108px] text-left rounded-xl border border-border/50 bg-card hover:bg-muted/30 shadow-sm p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex flex-col gap-1.5"
      >
        {/* Top row: avatar + nome do solicitante */}
        <div className="flex items-center gap-1.5 min-h-[20px] shrink-0">
          {(request.solicitante_user || solicitanteName) ? (
            <>
              <Avatar className="h-6 w-6 shrink-0 border border-border/50">
                <AvatarImage src={request.solicitante_user?.avatar_url || undefined} />
                <AvatarFallback className="text-[8px] bg-muted text-muted-foreground">
                  {getInitials(solicitanteName || "?")}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-muted-foreground truncate min-w-0 flex-1" title={solicitanteName}>
                {solicitanteName}
              </span>
            </>
          ) : null}
        </div>
        {/* Main: título/descrição */}
        <p className="text-[13px] font-medium text-foreground line-clamp-2 leading-tight flex-1 min-h-[2.5rem]">
          {title}
        </p>
        {/* Tag (Postado/Disponível) logo abaixo do título */}
        <div className="shrink-0 flex justify-start">
          <PostPill label={label} className="!px-1.5 !py-0.5 !text-[10px]" />
        </div>
        {/* Área */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
          <AreaIcon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          <span className="truncate">{area}</span>
        </div>
      </button>
    </td>
  );
}
