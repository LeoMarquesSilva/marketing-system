"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Copy, MapPin, MoreHorizontal, Pencil, Users } from "lucide-react";
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
  return <header className="space-y-4">
    <nav aria-label="Caminho do evento" className="flex items-center gap-2 text-xs text-muted-foreground">
      <Link href="/eventos" className="py-1 hover:text-primary">Eventos</Link><ChevronRight className="size-3" /><span>{event.year}</span><ChevronRight className="size-3" /><span className="truncate text-foreground">{event.name}</span>
    </nav>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 basis-full gap-4 sm:flex-1 sm:basis-auto">
        <div aria-hidden className="hidden h-[72px] w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary sm:flex">
          <span className="text-[10px] font-semibold uppercase tracking-widest">{date ? date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") : event.year}</span>
          <span className="text-3xl font-semibold tracking-tight">{date ? date.getDate() : <CalendarDays className="size-6" />}</span>
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={EVENT_STATUS_STYLE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Badge><span className="text-xs text-muted-foreground">{EVENT_STAGE_LABEL[event.stageStatus]}</span></div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{event.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{event.eventDate ? taskDateLabel(event.eventDate) : "Data a definir"}{event.endDate && event.endDate !== event.eventDate ? ` a ${taskDateLabel(event.endDate)}` : ""}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0" />{event.location || "Local a definir"}</span>
            {event.participantsExpected != null && <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" />{event.participantsExpected} pessoas previstas</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {team.length > 0 && <div className="mr-2 hidden items-center -space-x-1 md:flex" aria-label="Equipe responsável">{team.slice(0, 4).map(user => <EventPerson key={user.id} name={user.name} avatar={user.avatar_url} compact />)}{team.length > 4 && <span className="relative rounded-full bg-muted p-1.5 text-xs">+{team.length - 4}</span>}</div>}
        <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="size-3.5" />Editar evento</Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Mais ações do evento"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={duplicating} onSelect={onDuplicate}><Copy className="size-4" />{duplicating ? "Duplicando…" : "Duplicar para o próximo ano"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
    </div>
  </header>;
}

