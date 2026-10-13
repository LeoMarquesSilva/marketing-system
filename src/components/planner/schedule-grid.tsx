"use client";

import { useMemo } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { format, addDays, startOfDay, isAfter, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus } from "lucide-react";
import { AreaIcon } from "@/lib/area-icons";
import {
  calendarItemArea,
  calendarItemDayKey,
  calendarItemPeople,
  calendarItemTitle,
  isReelItem,
  sortByPostedAt,
  type CalendarItem,
} from "@/lib/planner-calendar";
import { cn } from "@/lib/utils";
import { ContentTypeTag, PeopleAvatars, RotationHintTag } from "./calendar-item-parts";

export const CALENDAR_DRAG_TYPE = "calendar-item";

interface ScheduleGridProps {
  items: CalendarItem[];
  rangeStart: Date;
  rangeEnd: Date;
  /** Itens que repetem a área do post anterior. */
  repeatedIds: Set<string>;
  onItemClick?: (item: CalendarItem) => void;
}

function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let d = startOfDay(start);
  const endDay = startOfDay(end);
  while (!isAfter(d, endDay)) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

export function ScheduleGrid({ items, rangeStart, rangeEnd, repeatedIds, onItemClick }: ScheduleGridProps) {
  const days = useMemo(() => getDaysInRange(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of sortByPostedAt(items)) {
      const key = calendarItemDayKey(item);
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-7 divide-x divide-border">
          {days.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            return (
              <DayColumn
                key={dayKey}
                day={day}
                dayKey={dayKey}
                items={itemsByDay.get(dayKey) ?? []}
                repeatedIds={repeatedIds}
                onItemClick={onItemClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  dayKey,
  items,
  repeatedIds,
  onItemClick,
}: {
  day: Date;
  dayKey: string;
  items: CalendarItem[];
  repeatedIds: Set<string>;
  onItemClick?: (item: CalendarItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayKey}`, data: { dayKey } });
  const today = isToday(day);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {format(day, "EEE", { locale: ptBR })}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
            today ? "bg-[#04202f] text-white dark:bg-white dark:text-[#04202f]" : "text-foreground"
          )}
          aria-label={today ? `Hoje, ${format(day, "d 'de' MMMM", { locale: ptBR })}` : undefined}
        >
          {format(day, "d MMM", { locale: ptBR })}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[240px] flex-1 flex-col gap-2 p-2 transition-colors",
          today && "bg-[#04202f]/[0.025] dark:bg-white/[0.03]",
          isOver && "bg-primary/5 ring-2 ring-inset ring-primary/30"
        )}
      >
        {items.map((item) => (
          <CalendarItemCard
            key={item.id}
            item={item}
            repeated={repeatedIds.has(item.id)}
            onClick={() => onItemClick?.(item)}
          />
        ))}
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-2 text-center transition-colors",
            items.length === 0 ? "flex-1 py-6" : "py-2",
            isOver ? "border-primary/60 text-primary" : "border-border/50 text-muted-foreground/60"
          )}
        >
          <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
          <span className="text-[10px] leading-tight">Arraste para cá</span>
        </div>
      </div>
    </div>
  );
}

function CalendarItemCard({
  item,
  repeated,
  onClick,
}: {
  item: CalendarItem;
  repeated: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `calendar-${item.id}`,
    data: { type: CALENDAR_DRAG_TYPE, item },
  });
  const title = calendarItemTitle(item);
  const area = calendarItemArea(item);
  const reel = isReelItem(item);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${reel ? "Reel" : "Post"} de ${area}: ${title}. Abrir detalhes ou arrastar para outro dia.`}
      className={cn(
        "flex cursor-grab flex-col gap-1.5 rounded-lg border border-border/60 bg-background p-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex flex-wrap items-center gap-1">
        <ContentTypeTag reel={reel} />
        {repeated && <RotationHintTag hint="repeat" />}
      </div>
      <p className="line-clamp-3 text-[12.5px] font-medium leading-snug text-foreground">{title}</p>
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <AreaIcon area={area} className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{area}</span>
      </div>
      <PeopleAvatars people={calendarItemPeople(item)} size="xs" />
    </div>
  );
}
