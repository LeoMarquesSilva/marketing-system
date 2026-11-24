"use client";

import Link from "next/link";
import { AlarmClock, ChevronRight, Handshake, Hourglass, Plus, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStale, todayInBrasilia } from "@/lib/rh/pdi/progress";
import type { PdiPerson, PdiPlanSummary } from "@/lib/rh/pdi/types";
import { cn } from "@/lib/utils";
import { Hint } from "../hint";
import { AreaTile, BODY, DueBadge, INK, MUTED, PersonLine, PersonPhoto, ProgressBar, SURFACE, progressTone, relativeDays } from "./pdi-visuals";

/** Ordem de atenção: atrasado → parado → ações vencidas → vence em breve → em dia → encerrados. */
export function attentionRank(plan: PdiPlanSummary, today: string): number {
  if (plan.status !== "ativo") return 9;
  if (plan.due_state === "atrasado") return 0;
  if (isStale(plan, today)) return 1;
  if (plan.actions_overdue > 0) return 2;
  if (plan.due_state === "vence_em_breve") return 3;
  return 4;
}

export function needsAttention(plan: PdiPlanSummary, today: string): boolean {
  return attentionRank(plan, today) <= 2;
}

export function sortByAttention(plans: PdiPlanSummary[]): PdiPlanSummary[] {
  const today = todayInBrasilia();
  return [...plans].sort(
    (a, b) => attentionRank(a, today) - attentionRank(b, today) || a.employee.name.localeCompare(b.employee.name, "pt-BR")
  );
}

/** Sinais do plano (vencidas, parado, de acordo) em uma linha. */
function PlanSignals({ plan, className }: { plan: PdiPlanSummary; className?: string }) {
  const stale = isStale(plan, todayInBrasilia());
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)}>
      {plan.actions_overdue > 0 && plan.status === "ativo" && (
        <span className="inline-flex items-center gap-1 font-medium text-red-700">
          <AlarmClock className="size-3.5" aria-hidden />
          {plan.actions_overdue} {plan.actions_overdue === 1 ? "ação vencida" : "ações vencidas"}
        </span>
      )}
      {stale && (
        <Hint label="Sem atualização há mais de 30 dias">
          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
            <Hourglass className="size-3.5" aria-hidden />
            {plan.last_update_at ? `parado ${relativeDays(plan.last_update_at)}` : "sem atualização registrada"}
          </span>
        </Hint>
      )}
      {plan.agreed_at ? (
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <Handshake className="size-3.5" aria-hidden />
          de acordo
        </span>
      ) : (
        plan.status === "ativo" && (
          <span className={cn("inline-flex items-center gap-1", MUTED)}>
            <Handshake className="size-3.5" aria-hidden />
            sem de acordo
          </span>
        )
      )}
    </span>
  );
}

/** Cartão por pessoa (Minha equipe). */
export function PersonPlanCard({ plan }: { plan: PdiPlanSummary }) {
  return (
    <Link
      href={`/pdi/${plan.id}`}
      className={cn(
        SURFACE,
        "group flex flex-col gap-4 p-4 outline-none transition-shadow hover:shadow-[0_6px_18px_rgba(4,32,47,0.08)] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
      )}
    >
      <div className="flex items-start gap-3">
        <PersonPhoto person={plan.employee} size="md" className="size-12" />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[15px] font-semibold", INK)}>{plan.employee.name}</p>
          <p className={cn("flex min-w-0 items-center gap-1.5 text-xs", MUTED)}>
            {plan.employee.department && <AreaTile area={plan.employee.department} className="size-4 rounded [&_svg]:size-3" />}
            <span className="truncate">{plan.employee.position ?? plan.employee.department ?? "—"}</span>
          </p>
        </div>
        <DueBadge state={plan.due_state} daysLeft={plan.days_left} status={plan.status} />
      </div>
      <div>
        <Hint label={plan.title}>
          <p className={cn("truncate text-xs", MUTED)}>{plan.title}</p>
        </Hint>
        <div className="mt-2 flex items-center gap-3">
          <span className={cn("w-12 text-xl font-semibold leading-none tabular-nums", INK)}>
            {plan.progress}
            <span className={cn("text-sm font-normal", MUTED)}>%</span>
          </span>
          <ProgressBar value={plan.progress} tone={progressTone(plan.progress, plan.due_state)} />
        </div>
        <p className={cn("mt-1.5 text-xs", MUTED)}>
          {plan.actions_done} de {plan.actions_total} ações concluídas
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#eef3f5] pt-3">
        <PlanSignals plan={plan} />
        <ChevronRight className="size-4 shrink-0 text-[#7b929c] transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}

/** Linha da lista do RH (agrupada por área). */
export function PlanRow({ plan }: { plan: PdiPlanSummary }) {
  return (
    <li>
      <Link
        href={`/pdi/${plan.id}`}
        className="group -mx-2 grid gap-3 rounded-md px-2 py-3 outline-none transition-colors hover:bg-[#f4fafb] focus-visible:bg-[#f4fafb] focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_16px] lg:items-center"
      >
        <PersonLine person={plan.employee} size="md" />
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className={cn("w-11 text-base font-semibold tabular-nums", INK)}>{plan.progress}%</span>
            <ProgressBar value={plan.progress} size="sm" tone={progressTone(plan.progress, plan.due_state)} />
          </div>
          <Hint label={plan.title}>
            <p className={cn("mt-1 truncate text-xs", MUTED)}>
              {plan.actions_done}/{plan.actions_total} ações · {plan.title}
            </p>
          </Hint>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 lg:items-end">
          <div className="flex items-center gap-2">
            {plan.manager && (
              <span className={cn("flex min-w-0 items-center gap-1.5 text-xs", BODY)}>
                <PersonPhoto person={plan.manager} size="xs" />
                <span className="truncate">{plan.manager.name}</span>
              </span>
            )}
            <DueBadge state={plan.due_state} daysLeft={plan.days_left} status={plan.status} />
          </div>
          <PlanSignals plan={plan} />
        </div>
        <ChevronRight className="hidden size-4 text-[#7b929c] transition-transform group-hover:translate-x-0.5 lg:block" aria-hidden />
      </Link>
    </li>
  );
}

export function WithoutPlan({
  people,
  onCreate,
}: {
  people: PdiPerson[];
  onCreate?: (person: PdiPerson) => void;
}) {
  if (people.length === 0) return null;
  return (
    <section className={cn(SURFACE, "p-5")}>
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f6] text-[#3b5560]">
          <UserRoundX className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className={cn("text-base font-semibold", INK)}>Sem PDI ativo</h2>
          <p className={cn("text-xs", MUTED)}>
            {people.length} {people.length === 1 ? "pessoa ainda não tem" : "pessoas ainda não têm"} plano em andamento
          </p>
        </div>
      </header>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((person) => (
          <li key={person.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#e6eff1] px-3 py-2.5">
            <PersonLine person={person} size="sm" />
            {onCreate && (
              <Button variant="secondary" size="xs" onClick={() => onCreate(person)} aria-label={`Criar PDI para ${person.name}`}>
                <Plus className="size-3.5" aria-hidden />
                PDI
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
