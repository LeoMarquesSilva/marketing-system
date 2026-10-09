"use client";

import { UserRound } from "lucide-react";
import { EventPerson } from "./event-person";
import type { EventTask } from "@/lib/eventos";

export function EventTaskPeople({ task, compact = false }: { task: EventTask; compact?: boolean }) {
  const internal = task.assignees?.length ? task.assignees : task.assigneeName ? [{ id: task.assigneeId ?? "primary", name: task.assigneeName, avatar: task.assigneeAvatar ?? null }] : [];
  const people = task.externalResponsibleName ? [...internal, { id: "external", name: task.externalResponsibleName, avatar: null }] : internal;
  if (!people.length) return compact
    ? <span title="Sem responsável" className="flex size-7 items-center justify-center rounded-full border border-dashed text-muted-foreground"><UserRound className="size-3.5" /><span className="sr-only">Sem responsável</span></span>
    : <span className="text-xs text-muted-foreground">Sem responsável</span>;

  return <span aria-label={`Responsáveis: ${people.map(person => person.name).join(", ")}`} className="inline-flex max-w-full min-w-0 items-center gap-1 align-middle">
    {people.slice(0, compact ? 3 : 4).map(person => <EventPerson key={person.id} name={person.name} avatar={person.avatar} compact className="shrink-0" />)}
    {people.length > (compact ? 3 : 4) && <span className="text-xs font-medium text-muted-foreground">+{people.length - (compact ? 3 : 4)}</span>}
    {!compact && <span className="ml-1 min-w-0 truncate text-xs text-muted-foreground" title={people.map(person => person.name).join(", ")}>{people.map(person => person.name).join(", ")}</span>}
  </span>;
}
