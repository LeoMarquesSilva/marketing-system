"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventTask } from "@/lib/eventos";
import { eventCalendarDays, shiftEventMonth } from "@/lib/event-task-list";
import { cn } from "@/lib/utils";

export function EventoTaskCalendar({ tasks, today, eventDates = [], eventNames, onOpen }: {
  tasks: EventTask[]; today: string; eventDates?: { date: string; name: string; id: string }[];
  eventNames?: Record<string, string>; onOpen: (task: EventTask) => void;
}) {
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const days = eventCalendarDays(month);
  const dated = new Map<string, EventTask[]>();
  tasks.forEach(task => { if (task.dueDate) dated.set(task.dueDate, [...(dated.get(task.dueDate) ?? []), task]); });
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(month + "-01T12:00:00"));
  const selected = selectedDate && selectedDate.startsWith(month) ? selectedDate : null;
  const showTasks = selected ? dated.get(selected) ?? [] : tasks.filter(task => task.dueDate?.startsWith(month));
  function taskButton(task: EventTask) { return <button key={task.id} onClick={() => onOpen(task)} className="w-full rounded-lg border bg-card p-3 text-left text-sm hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"><span className="block font-medium">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{task.dueDate?.split("-").reverse().join("/") ?? "Sem prazo"}{eventNames?.[task.eventId] && " · " + eventNames[task.eventId]}</span></button>; }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-semibold capitalize" aria-live="polite">{monthLabel}</h4>
      <div className="flex gap-1"><Button size="icon" variant="outline" aria-label="Mês anterior" onClick={() => setMonth(shiftEventMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" onClick={() => { setMonth(today.slice(0, 7)); setSelectedDate(null); }}>Hoje</Button><Button size="icon" variant="outline" aria-label="Próximo mês" onClick={() => setMonth(shiftEventMonth(month, 1))}><ChevronRight className="h-4 w-4" /></Button></div>
    </div>
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/40">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => <span key={day} className="py-2 text-center text-xs font-medium">{day}</span>)}</div>
      <div className="grid grid-cols-7">{days.map((date, index) => {
        const dayTasks = date ? dated.get(date) ?? [] : [];
        const events = eventDates.filter(event => event.date === date);
        return <div key={date ?? "blank" + index} className={cn("min-h-16 min-w-0 border-b border-r p-1 sm:min-h-28 sm:p-2", !date && "bg-muted/25", date === selected && "bg-primary/5")}>
          {date && <><button aria-label={date.split("-").reverse().join("/") + (dayTasks.length ? `, ${dayTasks.length} tarefas` : "") + (events.length ? ", dia do evento" : "")} aria-pressed={selected === date} onClick={() => setSelectedDate(date)} className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary", date === today && "bg-primary text-primary-foreground")}>{Number(date.slice(-2))}</button>
            {events.map(event => <p key={event.id} className="mt-1 break-words rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary sm:text-xs" title={event.name}>Dia do evento<span className="hidden sm:inline"> · {event.name}</span></p>)}
            <div className="hidden space-y-1 sm:block">{dayTasks.slice(0, 2).map(task => <button key={task.id} onClick={() => onOpen(task)} className="mt-1 block w-full truncate rounded bg-muted px-1 py-1 text-left text-xs hover:bg-primary/10">{task.title}</button>)}{dayTasks.length > 2 && <button className="text-xs text-primary" onClick={() => setSelectedDate(date)}>+{dayTasks.length - 2} tarefas</button>}</div>
            {dayTasks.length > 0 && <span className="mt-1 block text-center text-[10px] text-primary sm:hidden">{dayTasks.length} tarefa{dayTasks.length > 1 ? "s" : ""}</span>}
          </>}
        </div>;
      })}</div>
    </div>
    <div className="space-y-2"><div className="flex items-center gap-2"><h4 className="text-sm font-semibold">{selected ? "Tarefas de " + selected.split("-").reverse().join("/") : "Agenda do mês"}</h4>{selected && <Button variant="link" size="sm" onClick={() => setSelectedDate(null)}>Ver mês</Button>}</div>{showTasks.map(taskButton)}{!showTasks.length && <p className="text-sm text-muted-foreground">Nenhuma tarefa com prazo neste período.</p>}</div>
    {tasks.some(task => !task.dueDate) && <div className="space-y-2"><h4 className="text-sm font-semibold">Sem prazo</h4>{tasks.filter(task => !task.dueDate).map(taskButton)}</div>}
  </div>;
}
