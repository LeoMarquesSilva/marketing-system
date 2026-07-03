"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  EVENT_STATUS_STYLE,
  getEventDisplayDate,
  type EventWithStats,
} from "@/lib/eventos";
import { cn } from "@/lib/utils";

interface EventosCalendarProps {
  events: EventWithStats[];
}

export function EventosCalendar({ events }: EventosCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventWithStats[]>();
    for (const e of events) {
      const d = getEventDisplayDate(e);
      if (!d) continue;
      const key = d.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { locale: ptBR });
  const calEnd = endOfWeek(monthEnd, { locale: ptBR });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(key) ?? [];
          const inMonth = isSameMonth(day, currentMonth);

          return (
            <div
              key={key}
              className={cn(
                "min-h-[88px] rounded-lg border p-1.5 text-xs",
                inMonth ? "bg-background border-border/50" : "bg-muted/20 border-transparent opacity-50",
                isToday(day) && "ring-2 ring-violet-400 ring-offset-1"
              )}
            >
              <span className={cn("font-medium", isToday(day) && "text-violet-600")}>
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 2).map((e) => (
                  <Link key={e.id} href={`/eventos/${e.id}`}>
                    <Badge
                      variant="outline"
                      className={cn("w-full justify-start truncate text-[10px] px-1 py-0 h-auto", EVENT_STATUS_STYLE[e.status])}
                      title={e.name}
                    >
                      {e.name}
                    </Badge>
                  </Link>
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
