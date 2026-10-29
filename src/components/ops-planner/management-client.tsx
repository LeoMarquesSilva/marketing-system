"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  OPS_SPACE_ROLE_LABEL,
  OPS_SPACES_PATH,
  type OpsOverview,
  type OpsPlannerContext,
  type OpsSpaceOverview,
} from "@/lib/ops-planner/types";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./ops-ui";

const ALL = "__todos";

function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <div className="rounded-md bg-[#f6fafb] px-3 py-2.5 ring-1 ring-inset ring-[#e6eef0]">
      <p className="text-xs font-semibold text-[#315f73]">{label}</p>
      <p className={cn("mt-0.5 text-xl font-semibold tabular-nums", tone)}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Num({ value, tone }: { value: number; tone?: string }) {
  return <span className={cn("tabular-nums", value > 0 ? tone : "text-muted-foreground")}>{value}</span>;
}

function SpaceSection({ entry, context }: { entry: OpsSpaceOverview; context: OpsPlannerContext }) {
  const people = new Map(context.people.map((person) => [person.id, person]));
  const { space, kpis, routines } = entry;
  const isMarketing = space.slug === "marketing";
  const href = `${OPS_SPACES_PATH}/${space.slug}`;
  const routineDone = routines.done_on_time + routines.done_late;
  return (
    <section className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef3f4] px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="size-3 rounded-sm" style={{ backgroundColor: space.color }} />
          {space.name}
        </h2>
        <Button asChild size="sm" variant="ghost">
          <Link href={href}>
            Abrir espaço
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Abertas" value={kpis.open} />
        <Kpi label="Atrasadas" value={kpis.overdue} tone={kpis.overdue > 0 ? "text-red-700" : undefined} />
        <Kpi label="Vencem em 7 dias" value={kpis.dueNext7} />
        <Kpi label="Paradas" value={kpis.waitingStale} hint="Aguardando há +5 dias úteis" tone={kpis.waitingStale > 0 ? "text-amber-700" : undefined} />
        <Kpi label="Concluídas no mês" value={kpis.doneThisMonth} />
        <Kpi
          label="No prazo no mês"
          value={kpis.onTimePct === null ? "—" : `${kpis.onTimePct}%`}
          tone={kpis.onTimePct !== null && kpis.onTimePct < 80 ? "text-amber-700" : undefined}
          hint="Meta da planilha: 80%"
        />
      </div>

      <div className="overflow-x-auto border-t border-[#eef3f4]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-[#f6fafb] text-left text-xs font-semibold text-[#315f73]">
              <th scope="col" className="px-4 py-2">Pessoa</th>
              <th scope="col" className="px-3 py-2 text-right">A fazer</th>
              <th scope="col" className="px-3 py-2 text-right">Em andamento</th>
              <th scope="col" className="px-3 py-2 text-right">Aguardando</th>
              <th scope="col" className="px-3 py-2 text-right">Atrasadas</th>
              <th scope="col" className="px-3 py-2 text-right">Concluídas no mês</th>
              {isMarketing && <th scope="col" className="px-3 py-2 text-right">Solicitações (atrasadas)</th>}
            </tr>
          </thead>
          <tbody>
            {entry.people.map((load) => {
              const person = people.get(load.user_id);
              return (
                <tr key={load.user_id} className="border-t border-[#eef3f4] hover:bg-[#f6fbfb]">
                  <td className="px-4 py-2">
                    <Link href={`${href}?responsavel=${load.user_id}&visao=lista`} className="flex items-center gap-2 hover:underline">
                      <PersonAvatar person={person} className="size-7" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{person?.name ?? "Pessoa"}</span>
                        <span className="block text-xs text-muted-foreground">{load.role ? OPS_SPACE_ROLE_LABEL[load.role] : "De outro espaço"}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right"><Num value={load.a_fazer} /></td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      {load.over_wip && <AlertTriangle className="size-3.5 text-amber-600" aria-label={`Acima do limite de ${space.wip_limit}`} />}
                      <Num value={load.em_andamento} tone={load.over_wip ? "font-semibold text-amber-700" : undefined} />
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Num value={load.aguardando} />
                    {load.waiting_stale > 0 && <span className="ml-1 text-xs text-amber-700">({load.waiting_stale} parada{load.waiting_stale > 1 ? "s" : ""})</span>}
                  </td>
                  <td className="px-3 py-2 text-right"><Num value={load.overdue} tone="font-semibold text-red-700" /></td>
                  <td className="px-3 py-2 text-right"><Num value={load.done_this_month} /></td>
                  {isMarketing && (
                    <td className="px-3 py-2 text-right">
                      <Num value={load.marketing_open} /> <span className="text-xs text-red-700">{load.marketing_overdue > 0 && `(${load.marketing_overdue})`}</span>
                    </td>
                  )}
                </tr>
              );
            })}
            {entry.people.length === 0 && (
              <tr>
                <td colSpan={isMarketing ? 7 : 6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Ninguém no espaço ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-[#eef3f4] bg-[#fafcfc] px-4 py-3 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-[#48466e]">
          <Repeat className="size-4" aria-hidden />
          Rotinas nos últimos 30 dias
        </span>
        {routines.generated === 0 ? (
          <span className="text-muted-foreground">Nenhuma rotina venceu no período.</span>
        ) : (
          <>
            <span>{routines.generated} ocorrências</span>
            <span className="text-emerald-700">{routines.done_on_time} no prazo</span>
            <span className={routines.done_late > 0 ? "text-amber-700" : "text-muted-foreground"}>{routines.done_late} com atraso</span>
            <span className={routines.open_overdue > 0 ? "font-semibold text-red-700" : "text-muted-foreground"}>{routines.open_overdue} atrasadas em aberto</span>
            {routineDone > 0 && <span className="text-muted-foreground">Aderência: {Math.round((routines.done_on_time / routines.generated) * 100)}%</span>}
          </>
        )}
      </div>
    </section>
  );
}

export function ManagementClient({ overview, context }: { overview: OpsOverview; context: OpsPlannerContext }) {
  const [filter, setFilter] = useState(ALL);
  if (overview.spaces.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#dce9eb] bg-white px-4 py-12 text-center">
        <p className="font-medium">A Gestão é para líderes e gestores.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui aparecem os indicadores dos espaços que você lidera. Suas tarefas estão em Minhas tarefas.
        </p>
      </div>
    );
  }
  const shown = overview.spaces.filter((entry) => filter === ALL || entry.space.id === filter);
  const totals = overview.spaces.reduce(
    (sum, entry) => ({ overdue: sum.overdue + entry.kpis.overdue, stale: sum.stale + entry.kpis.waitingStale, open: sum.open + entry.kpis.open }),
    { overdue: 0, stale: 0, open: 0 }
  );
  return (
    <div className="space-y-5">
      {overview.spaces.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 text-sm text-muted-foreground">
            {totals.open} abertas · <span className={totals.overdue > 0 ? "font-semibold text-red-700" : ""}>{totals.overdue} atrasadas</span> ·{" "}
            <span className={totals.stale > 0 ? "font-semibold text-amber-700" : ""}>{totals.stale} paradas</span>
          </p>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar espaço">
            {[{ id: ALL, name: "Todos" }, ...overview.spaces.map((entry) => ({ id: entry.space.id, name: entry.space.name }))].map((option) => (
              <Button key={option.id} type="button" size="sm" variant={filter === option.id ? "secondary" : "ghost"} aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>
                {option.name}
              </Button>
            ))}
          </div>
        </div>
      )}
      {shown.map((entry) => (
        <SpaceSection key={entry.space.id} entry={entry} context={context} />
      ))}
    </div>
  );
}
