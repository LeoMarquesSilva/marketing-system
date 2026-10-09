"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Copy, Lightbulb, MapPin, MoreHorizontal, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/eventos/event-menu";
import { EventPerson } from "./event-person";
import { EVENT_STAGE_LABEL, EVENT_STATUS_LABEL, EVENT_STATUS_STYLE, type OrgEvent, type EventTask } from "@/lib/eventos";
import { taskDateLabel } from "@/lib/event-task-list";
import type { User } from "@/lib/users";

export function EventWorkspaceHeader({ event, tasks, users, onEdit, onDuplicate, duplicating }: {
  event: OrgEvent; tasks: EventTask[]; users: User[]; onEdit: () => void;
  onDuplicate: () => void; duplicating: boolean;
}) {
  const ids = new Set([event.ownerUserId, ...tasks.map(task => task.assigneeId)].filter(Boolean));
  const team = users.filter(user => ids.has(user.id));
  const date = event.eventDate ? new Date(`${event.eventDate.slice(0, 10)}T12:00:00`) : null;
  return <header className="space-y-3 font-sans">
    <nav aria-label="Caminho do evento" className="flex items-center gap-2 text-xs text-muted-foreground">
      <Link href="/eventos" className="py-1 hover:text-primary">Eventos</Link><ChevronRight className="size-3" /><span>{event.year}</span><ChevronRight className="hidden size-3 md:block" /><span className="hidden truncate text-foreground md:block">{event.name}</span>
    </nav>
    <div className="flex items-start justify-between gap-3 sm:gap-4">
      <div className="flex min-w-0 flex-1 gap-4">
        <div aria-hidden className="hidden h-28 w-24 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-primary/15 bg-primary/5 text-primary sm:flex">
          <span className="text-xs font-semibold uppercase">{date ? date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") : "Evento"}</span>
          <span className="mt-1 text-4xl font-semibold tracking-tight">{date ? date.getDate() : <CalendarDays className="size-8" />}</span>
          <span className="mt-2 text-xs text-muted-foreground">{event.year}</span>
        </div>
        <div className="min-w-0 space-y-2">
          <h1 className="text-xl font-semibold leading-7 tracking-tight sm:text-2xl lg:text-3xl lg:leading-10">{event.name}</h1>
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={`rounded-full px-3 py-1 ${EVENT_STATUS_STYLE[event.status]}`}>{EVENT_STATUS_LABEL[event.status]}</Badge><span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"><Lightbulb className="size-3.5" />{EVENT_STAGE_LABEL[event.stageStatus]}</span></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{event.eventDate ? taskDateLabel(event.eventDate) : "Data a definir"}{event.endDate && event.endDate !== event.eventDate ? ` a ${taskDateLabel(event.endDate)}` : ""}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0" />{event.location || "Local a definir"}</span>
            {event.participantsExpected != null && <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" />{event.participantsExpected} pessoas previstas</span>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {team.length > 0 && <div className="mr-2 hidden items-center -space-x-1 md:flex" aria-label="Equipe responsável">{team.slice(0, 4).map(user => <EventPerson key={user.id} name={user.name} avatar={user.avatar_url} compact />)}{team.length > 4 && <span className="relative rounded-full bg-muted p-1.5 text-xs">+{team.length - 4}</span>}</div>}
        <Button variant="outline" size="sm" className="size-9 rounded-lg p-0 shadow-none sm:w-auto sm:px-3" aria-label="Editar evento" onClick={onEdit}><Pencil className="size-3.5" /><span className="hidden sm:inline">Editar evento</span></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Mais ações do evento"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={duplicating} onSelect={onDuplicate}><Copy className="size-4" />{duplicating ? "Duplicando…" : "Duplicar para o próximo ano"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
    </div>
  </header>;
}

