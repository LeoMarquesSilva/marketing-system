import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Film } from "lucide-react";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CollaboratorAvatar } from "./content-schedule-visuals";
import type { ScheduleSlotView } from "./content-schedule-ui-types";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export type CalendarDay = { date: string; inCurrentMonth: boolean };

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function saoPauloToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function buildCalendarDays(month: string): CalendarDay[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const last = new Date(Date.UTC(year, monthNumber, 0));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - mondayOffset);
  const sundayOffset = (7 - last.getUTCDay()) % 7;
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + sundayOffset);

  const days: CalendarDay[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = isoDate(cursor);
    days.push({ date, inCurrentMonth: date.startsWith(month) });
  }
  return days;
}

export function buildCalendarDaySlots(slots: ScheduleSlotView[]) {
  return {
    cellSlots: slots.slice(0, 3),
    overflowSlots: slots,
  };
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", weekday: "long" })
    .format(new Date(`${date}T12:00:00`));
}

function CalendarSlotCard({
  slot,
  onSelect,
}: {
  slot: ScheduleSlotView;
  onSelect: (slot: ScheduleSlotView) => void;
}) {
  const missing = !slot.collaboratorId && !slot.collaborator;
  const personName = slot.collaborator?.name || slot.unmatchedAssigneeName || "A definir";
  const formatLabel = slot.format === "reel" ? "Reel" : "Post";
  return (
    <button
      type="button"
      aria-label={`Abrir detalhes de ${personName}, ${slot.area}, ${formatLabel}`}
      onClick={() => onSelect(slot)}
      className={cn(
        "group w-full overflow-hidden rounded-md bg-slate-50 px-2 py-2 text-left shadow-[0_1px_0_rgba(24,63,80,.04)] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#285f7a] focus-visible:ring-offset-2",
        slot.status === "cancelled" && "opacity-45"
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={cn("flex size-5 shrink-0 items-center justify-center rounded", getAreaIconStyle(slot.area))} title={slot.area}>
          <AreaIcon area={slot.area} className="size-3" />
        </span>
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{slot.area}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-semibold text-slate-500">
          {slot.format === "reel" ? <Film className="size-3" /> : <FileText className="size-3" />}
          {formatLabel}
        </span>
      </div>
      <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
        {slot.collaborator ? (
          <CollaboratorAvatar person={slot.collaborator} className="size-6 shrink-0" />
        ) : (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200">
            <AlertTriangle className="size-3.5 text-amber-700" />
          </span>
        )}
        <span className="truncate text-xs font-medium text-slate-800">{personName}</span>
        {slot.status === "published" ? <CheckCircle2 className="ml-auto size-3.5 shrink-0 text-emerald-600" /> : null}
      </div>
      {missing && slot.unmatchedAssigneeName ? (
        <span className="mt-1 block truncate pl-8 text-[10px] text-slate-500">Nome da planilha sem vínculo</span>
      ) : slot.content ? (
        <span className="mt-1 block truncate pl-8 text-[10px] text-slate-500">{slot.content.title}</span>
      ) : null}
    </button>
  );
}

function CalendarDayOverflow({
  date,
  slots,
  onSelectSlot,
}: {
  date: string;
  slots: ScheduleSlotView[];
  onSelectSlot: (slot: ScheduleSlotView) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (slot: ScheduleSlotView) => {
    setOpen(false);
    onSelectSlot(slot);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ver todos os ${slots.length} conteúdos de ${dayLabel(date)}`}
          className="w-full rounded px-1 py-1 text-left text-[10px] font-semibold text-[#285f7a] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#285f7a] focus-visible:ring-offset-1"
        >
          + {slots.length - 3} neste dia
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={`Todos os conteúdos de ${dayLabel(date)}`}
        className="w-72 p-2"
      >
        <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          {dayLabel(date)}
        </div>
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {slots.map((slot) => (
            <CalendarSlotCard key={slot.id} slot={slot} onSelect={handleSelect} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ContentScheduleCalendar({
  month,
  slots,
  onSelectSlot,
}: {
  month: string;
  slots: ScheduleSlotView[];
  onSelectSlot: (slot: ScheduleSlotView) => void;
}) {
  const days = buildCalendarDays(month);
  const byDate = new Map<string, ScheduleSlotView[]>();
  for (const slot of slots) byDate.set(slot.date.slice(0, 10), [...(byDate.get(slot.date.slice(0, 10)) ?? []), slot]);
  const agenda = [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right));
  const today = saoPauloToday();

  return (
    <>
      <div className="hidden overflow-hidden rounded-b-lg md:block">
        <div className="grid grid-cols-7 border-b border-[#dce9eb] bg-[#f5fafb]">
          {WEEKDAYS.map((weekday) => <div key={weekday} className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{weekday}</div>)}
        </div>
        <div className="grid grid-cols-7 bg-[#dce9eb] gap-px">
          {days.map((day) => {
            const daySlots = byDate.get(day.date) ?? [];
            const { cellSlots, overflowSlots } = buildCalendarDaySlots(daySlots);
            return (
              <section key={day.date} aria-label={dayLabel(day.date)} className={cn("min-h-36 bg-white p-2", !day.inCurrentMonth && "bg-slate-50/80 text-slate-400")}>
                <div className="mb-2 flex items-center justify-between">
                  <time dateTime={day.date} className={cn("flex size-6 items-center justify-center rounded-full font-mono text-xs font-semibold", day.date === today && "bg-[#183f50] text-white")}>{Number(day.date.slice(-2))}</time>
                  {daySlots.length ? <span className="font-mono text-[10px] text-slate-400">{daySlots.length}</span> : null}
                </div>
                <div className="space-y-1.5">
                  {cellSlots.map((slot) => (
                    <CalendarSlotCard key={slot.id} slot={slot} onSelect={onSelectSlot} />
                  ))}
                  {daySlots.length > 3 ? (
                    <CalendarDayOverflow
                      date={day.date}
                      slots={overflowSlots}
                      onSelectSlot={onSelectSlot}
                    />
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="md:hidden">
        <div className="border-b border-[#dce9eb] bg-[#f5fafb] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Agenda do mês</div>
        <div className="divide-y divide-[#dce9eb]">
          {agenda.map(([date, daySlots]) => (
            <section key={date} className="grid grid-cols-[54px_minmax(0,1fr)] gap-3 px-3 py-3">
              <time dateTime={date} className="text-center">
                <span className="block font-mono text-xl font-semibold text-[#183f50]">{Number(date.slice(-2))}</span>
                <span className="block text-[10px] uppercase text-slate-500">{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(`${date}T12:00:00`)).replace(".", "")}</span>
              </time>
              <div className="space-y-2">
                {daySlots.map((slot) => (
                  <CalendarSlotCard key={slot.id} slot={slot} onSelect={onSelectSlot} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
