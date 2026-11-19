"use client";

import { useMemo } from "react";
import { Flag, Repeat } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { addDays } from "@/lib/ops-planner/domain";
import {
  OPS_PRIORITY_LABEL,
  OPS_STATUS_LABEL,
  type OpsPerson,
  type OpsPlannerContext,
  type OpsPriority,
  type OpsSpace,
  type OpsTaskStatus,
} from "@/lib/ops-planner/types";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";

export function formatDate(iso: string | null | undefined, today?: string): string {
  if (!iso) return "";
  const short = `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return today && iso.slice(0, 4) !== today.slice(0, 4) ? `${short}/${iso.slice(0, 4)}` : short;
}

export function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function firstName(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? "";
}

const STATUS_TONE: Record<OpsTaskStatus, string> = {
  a_fazer: "bg-slate-100 text-slate-700 ring-slate-200",
  em_andamento: "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/40",
  aguardando: "bg-amber-50 text-amber-800 ring-amber-200",
  concluida: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelada: "bg-slate-50 text-slate-500 ring-slate-200 line-through",
};

const STATUS_DOT: Record<OpsTaskStatus, string> = {
  a_fazer: "bg-slate-400",
  em_andamento: "bg-[#3e84a8]",
  aguardando: "bg-amber-500",
  concluida: "bg-emerald-500",
  cancelada: "bg-slate-300",
};

export function StatusDot({ status, className }: { status: OpsTaskStatus; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", STATUS_DOT[status], className)} />;
}

export function StatusBadge({ status, className }: { status: OpsTaskStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_TONE[status],
        className
      )}
    >
      <StatusDot status={status} />
      {OPS_STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_TONE: Record<OpsPriority, string> = {
  urgente: "text-red-700",
  alta: "text-amber-700",
  media: "text-[#3e84a8]",
  baixa: "text-slate-500",
};

export function PriorityLabel({ priority, compact = false }: { priority: OpsPriority; compact?: boolean }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs font-medium", PRIORITY_TONE[priority])}
      title={`Prioridade ${OPS_PRIORITY_LABEL[priority].toLowerCase()}`}
    >
      <Flag className="size-3.5" aria-hidden fill={priority === "urgente" || priority === "alta" ? "currentColor" : "none"} />
      {compact ? <span className="sr-only">{OPS_PRIORITY_LABEL[priority]}</span> : OPS_PRIORITY_LABEL[priority]}
    </span>
  );
}

/** Prazo com o tom do atraso: vermelho atrasada, âmbar hoje. */
export function DueLabel({
  due,
  time,
  status,
  today,
  className,
}: {
  due: string | null;
  time?: string | null;
  status: OpsTaskStatus;
  today: string;
  className?: string;
}) {
  if (!due) return <span className={cn("text-xs text-muted-foreground", className)}>Sem prazo</span>;
  const open = status !== "concluida" && status !== "cancelada";
  const hour = time ? ` ${time.slice(0, 5)}` : "";
  let label = formatDate(due, today);
  let tone = "text-muted-foreground";
  if (open && due < today) {
    label = `Atrasada · ${formatDate(due, today)}`;
    tone = "font-semibold text-red-700";
  } else if (open && due === today) {
    label = "Hoje";
    tone = "font-semibold text-amber-700";
  } else if (open && due === addDays(today, 1)) {
    label = "Amanhã";
    tone = "text-[#285f7a]";
  }
  return (
    <span className={cn("text-xs tabular-nums", tone, className)}>
      {label}
      {hour}
    </span>
  );
}

export function PersonAvatar({ person, className }: { person: OpsPerson | undefined; className?: string }) {
  return (
    <Avatar className={cn("size-6 border border-white", className)} title={person?.name}>
      <AvatarImage src={person?.avatar_url || undefined} alt="" />
      <AvatarFallback className="bg-[#e8f8f8] text-[11px] font-semibold text-[#285f7a]">
        {initials(person?.name ?? "?")}
      </AvatarFallback>
    </Avatar>
  );
}

export function AvatarStack({
  ids,
  people,
  max = 3,
  emptyLabel = "Sem responsável",
}: {
  ids: string[];
  people: Map<string, OpsPerson>;
  max?: number;
  emptyLabel?: string;
}) {
  if (ids.length === 0) return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  const names = ids.map((id) => people.get(id)?.name ?? "Pessoa").join(", ");
  return (
    <span className="flex items-center -space-x-1.5" aria-label={names} title={names}>
      {ids.slice(0, max).map((id) => (
        <PersonAvatar key={id} person={people.get(id)} />
      ))}
      {ids.length > max && (
        <span className="z-10 grid size-6 place-items-center rounded-full border border-white bg-slate-100 text-[11px] font-semibold text-slate-600">
          +{ids.length - max}
        </span>
      )}
    </span>
  );
}

export function SpaceChip({ space, className }: { space: Pick<OpsSpace, "name" | "color"> | undefined; className?: string }) {
  if (!space) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span aria-hidden className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: space.color }} />
      <span className="truncate">{space.name}</span>
    </span>
  );
}

export function RoutineMark() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[#48466e]" title="Gerada por rotina">
      <Repeat className="size-3.5" aria-hidden />
      <span className="sr-only">Rotina</span>
    </span>
  );
}

/** Mapas de pessoas, espaços e listas do contexto, para as telas não buscarem de novo. */
export function usePlannerMaps(context: OpsPlannerContext) {
  return useMemo(() => {
    const people = new Map(context.people.map((person) => [person.id, person]));
    const spaces = new Map(context.spaces.map((space) => [space.id, space]));
    const lists = new Map(context.lists.map((list) => [list.id, list]));
    const memberIds = new Set(context.members.map((member) => member.user_id));
    // Responsáveis possíveis: quem participa de algum espaço (formato do seletor de pessoas).
    const assignable = context.people
      .filter((person) => memberIds.has(person.id) && person.is_active)
      .map((person) => ({ ...person, department: person.department ?? "" }) as User);
    return { people, spaces, lists, assignable };
  }, [context]);
}
