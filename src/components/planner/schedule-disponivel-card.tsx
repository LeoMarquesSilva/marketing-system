"use client";

import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GripVertical, CalendarCheck, Calendar, Video } from "lucide-react";
import { AreaIcon } from "@/lib/area-icons";
import {
  calendarItemArea,
  calendarItemBankSince,
  calendarItemPeople,
  calendarItemTitle,
  isReelItem,
  type CalendarItem,
} from "@/lib/planner-calendar";
import { cn } from "@/lib/utils";
import { CALENDAR_DRAG_TYPE } from "./schedule-grid";
import { ContentTypeTag, PeopleAvatars, RotationHintTag, type RotationHint } from "./calendar-item-parts";

export type DisponivelAgeTier = "new" | "medium" | "old";

const AGE_TIER_CLASSES: Record<DisponivelAgeTier, string> = {
  new: "border-border/50 bg-card",
  medium:
    "border-amber-400/60 dark:border-amber-500/50 bg-amber-50/80 dark:bg-amber-950/30",
  old: "border-orange-400/60 dark:border-orange-500/50 bg-orange-50/80 dark:bg-orange-950/30",
};

function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

/** Linhas de data do card: post mostra pedido e conclusão; reel, a data do cronograma e quando ficou pronto. */
function itemDates(item: CalendarItem): { icon: typeof Calendar; label: string }[] {
  if (item.kind === "reel") {
    const due = shortDate(item.reel.dueDate);
    const ready = shortDate(item.reel.readyAt);
    return [
      ...(due ? [{ icon: Calendar, label: `Cronograma: ${due}` }] : []),
      ...(ready ? [{ icon: CalendarCheck, label: `Pronto em ${ready}` }] : []),
    ];
  }
  return [
    { icon: Calendar, label: `Solicitado em ${shortDate(item.request.requested_at)}` },
    { icon: CalendarCheck, label: `Concluído em ${shortDate(calendarItemBankSince(item))}` },
  ];
}

function CardBody({ item, hint }: { item: CalendarItem; hint?: RotationHint | null }) {
  const title = calendarItemTitle(item);
  const area = calendarItemArea(item);
  const people = calendarItemPeople(item);
  const thumb = item.kind === "reel" ? item.reel.coverThumbUrl : null;

  return (
    <>
      {item.kind === "reel" ? (
        <div className="relative h-[84px] w-12 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/60">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center">
              <Video className="h-4 w-4 text-muted-foreground" aria-hidden />
            </span>
          )}
        </div>
      ) : (
        <div className="shrink-0">
          <PeopleAvatars people={people} size="md" showNames={false} />
        </div>
      )}
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="mb-1 flex flex-wrap items-center gap-1">
          <ContentTypeTag reel={isReelItem(item)} />
          {hint && <RotationHintTag hint={hint} />}
        </div>
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{title}</p>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <AreaIcon area={area} className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{area}</span>
        </div>
        {item.kind === "reel" && people.length > 0 && (
          <div className="mt-1">
            <PeopleAvatars people={people} size="xs" />
          </div>
        )}
        <div className="mt-1 flex min-w-0 flex-col gap-0.5 text-[11px] text-muted-foreground">
          {itemDates(item).map(({ icon: Icon, label }) => (
            <span key={label} className="flex min-w-0 items-center gap-1.5">
              <Icon className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

export interface ScheduleDisponivelCardProps {
  item: CalendarItem;
  ageTier?: DisponivelAgeTier;
  hint?: RotationHint | null;
  onClick?: () => void;
}

export function ScheduleDisponivelCard({ item, ageTier = "new", hint, onClick }: ScheduleDisponivelCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bank-${item.id}`,
    data: { type: CALENDAR_DRAG_TYPE, item },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-full items-start gap-2 overflow-hidden rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md",
        AGE_TIER_CLASSES[ageTier],
        isDragging && "opacity-40"
      )}
    >
      <button
        type="button"
        className="mt-1 shrink-0 cursor-grab touch-none p-0.5 text-muted-foreground hover:text-foreground focus:outline-none active:cursor-grabbing"
        aria-label="Arrastar para um dia do calendário"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-start gap-3 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
      >
        <CardBody item={item} hint={hint} />
      </button>
    </div>
  );
}

/** Versão só visual para usar dentro de DragOverlay (sem useDraggable). */
export function ScheduleItemOverlay({ item }: { item: CalendarItem }) {
  return (
    <div className="flex w-64 cursor-grabbing items-start gap-3 overflow-hidden rounded-xl border border-primary/30 bg-card p-3 shadow-xl">
      <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <CardBody item={item} />
    </div>
  );
}
