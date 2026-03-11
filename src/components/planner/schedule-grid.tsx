"use client";

import { useMemo } from "react";
import { format, addDays, startOfDay, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { DayCell, DayCellEmpty } from "./day-cell";

interface ScheduleGridProps {
  posts: MarketingRequest[];
  rangeStart: Date;
  rangeEnd: Date;
  onCardClick?: (request: MarketingRequest, options: { isPostado: boolean }) => void;
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

export function ScheduleGrid({ posts, rangeStart, rangeEnd, onCardClick }: ScheduleGridProps) {
  const days = useMemo(
    () => getDaysInRange(rangeStart, rangeEnd),
    [rangeStart, rangeEnd]
  );

  const postsInRange = useMemo(() => {
    return posts
      .filter((req) => req.completion_type === "postagem_feita" && req.posted_at)
      .filter((req) => {
        const refDay = startOfDay(new Date(req.posted_at!));
        return !isBefore(refDay, rangeStart) && !isAfter(refDay, rangeEnd);
      })
      .sort((a, b) => new Date(a.posted_at!).getTime() - new Date(b.posted_at!).getTime());
  }, [posts, rangeStart, rangeEnd]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {days.map((day) => (
                <th
                  key={day.toISOString()}
                  className="p-2 text-center text-xs font-semibold text-foreground min-w-[152px] w-[152px] max-w-[152px] border-r border-border last:border-r-0"
                >
                  {format(day, "d MMM", { locale: ptBR })}
                  <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                    {format(day, "EEE", { locale: ptBR })}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {postsInRange.length === 0 ? (
              <tr className="border-b border-border/50">
                {days.map((day) => (
                  <DayCellEmpty key={day.toISOString()} day={day} rowIndex={0} />
                ))}
              </tr>
            ) : (
              postsInRange.map((request, rowIndex) => (
                <tr
                  key={request.id}
                  className="border-b border-border/50 hover:bg-muted/5 transition-colors"
                >
                  {days.map((day) => (
                    <DayCell
                      key={day.toISOString()}
                      request={request}
                      day={day}
                      rowIndex={rowIndex}
                      onCardClick={onCardClick}
                    />
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
