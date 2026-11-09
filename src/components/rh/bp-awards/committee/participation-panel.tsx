"use client";

import { useMemo, useState } from "react";
import { CircleCheck, CircleDashed, PencilLine, Search } from "lucide-react";
import { AwardAvatar } from "@/components/rh/bp-awards/award-avatar";
import { Input } from "@/components/ui/input";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { formatAwardDateTime } from "@/lib/rh/bp-awards/format";
import { AWARD_HUBS, type AwardHubKey, type ParticipationRow, type ParticipationStatus } from "@/lib/rh/bp-awards/types";
import { cn } from "@/lib/utils";

const STATUS: Record<ParticipationStatus, { label: string; icon: typeof CircleCheck; className: string }> = {
  enviou: { label: "Enviou", icon: CircleCheck, className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  rascunho: { label: "Em rascunho", icon: PencilLine, className: "bg-amber-50 text-amber-800 ring-amber-200" },
  pendente: { label: "Não começou", icon: CircleDashed, className: "bg-slate-50 text-slate-600 ring-slate-200" },
};

const FILTERS: Array<{ key: ParticipationStatus | "todos"; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "pendente", label: "Não começaram" },
  { key: "rascunho", label: "Em rascunho" },
  { key: "enviou", label: "Enviaram" },
];

/** Grupos da participação: os três hubs e quem vota sem pertencer a um hub (sócios patrimoniais e exceções). */
type GroupKey = AwardHubKey | "socios";

const GROUPS: Array<{ key: GroupKey; label: string; note?: string }> = [
  ...AWARD_HUBS.map((hub) => ({ key: hub.key as GroupKey, label: hub.name })),
  { key: "socios", label: "Fora dos hubs", note: "sócios patrimoniais e exceções" },
];

function groupOf(row: ParticipationRow): GroupKey {
  return row.person.hub ?? "socios";
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Quem já votou, por área e por pessoa (a pesquisa é identificada). */
export function ParticipationPanel({ rows }: { rows: ParticipationRow[] }) {
  const [filter, setFilter] = useState<ParticipationStatus | "todos">("todos");
  const [group, setGroup] = useState<GroupKey | "todos">("todos");
  const [query, setQuery] = useState("");

  const byGroup = useMemo(() => {
    const tally = (list: ParticipationRow[]) => ({
      total: list.length,
      sent: list.filter((row) => row.status === "enviou").length,
      draft: list.filter((row) => row.status === "rascunho").length,
    });
    return GROUPS.map((item) => {
      const own = rows.filter((row) => groupOf(row) === item.key);
      const areas = [...new Set(own.map((row) => row.person.department ?? "Sem área"))]
        .map((area) => ({ area, ...tally(own.filter((row) => (row.person.department ?? "Sem área") === area)) }))
        .sort((a, b) => b.total - a.total || a.area.localeCompare(b.area, "pt-BR"));
      return { ...item, ...tally(own), areas };
    }).filter((item) => item.total > 0);
  }, [rows]);

  const counts = useMemo(() => {
    const result: Record<ParticipationStatus | "todos", number> = { todos: 0, enviou: 0, rascunho: 0, pendente: 0 };
    for (const row of rows) {
      if (group !== "todos" && groupOf(row) !== group) continue;
      result[row.status] += 1;
      result.todos += 1;
    }
    return result;
  }, [rows, group]);

  const visible = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const order: Record<ParticipationStatus, number> = { pendente: 0, rascunho: 1, enviou: 2 };
    return rows
      .filter((row) => group === "todos" || groupOf(row) === group)
      .filter((row) => filter === "todos" || row.status === filter)
      .filter((row) => {
        if (!terms.length) return true;
        const haystack = normalize(`${row.person.short_name} ${row.person.full_name} ${row.person.department ?? ""}`);
        return terms.every((term) => haystack.includes(term));
      })
      .sort(
        (a, b) =>
          order[a.status] - order[b.status] || a.person.short_name.localeCompare(b.person.short_name, "pt-BR")
      );
  }, [rows, filter, group, query]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <section aria-labelledby="participacao-area" className="rounded-lg border border-[#dce9eb] bg-white p-4 shadow-xs">
        <h2 id="participacao-area" className="text-sm font-semibold text-foreground">
          Por hub
        </h2>
        <div className="mt-3 space-y-5">
          {byGroup.map((item) => {
            const sentPct = item.total ? (item.sent / item.total) * 100 : 0;
            const draftPct = item.total ? (item.draft / item.total) * 100 : 0;
            return (
              <section key={item.key} aria-label={item.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="min-w-0 truncate text-sm font-semibold">
                    {item.label}
                    {item.note && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{item.note}</span>}
                  </h3>
                  <span className="text-sm font-semibold tabular-nums text-[#285f7a]">
                    {item.sent}/{item.total}
                  </span>
                </div>
                <div
                  className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[#eef3f5]"
                  role="img"
                  aria-label={`${item.sent} enviaram e ${item.draft} em rascunho, de ${item.total}`}
                >
                  <span className="bg-[#347796]" style={{ width: `${sentPct}%` }} />
                  <span className="bg-[#47cdd0]/60" style={{ width: `${draftPct}%` }} />
                </div>
                {item.key !== "socios" && item.areas.length > 1 && (
                  <ul className="mt-2.5 space-y-1.5">
                    {item.areas.map((entry) => (
                      <li key={entry.area} className="flex items-center gap-2">
                        <span className={cn("grid size-6 shrink-0 place-items-center rounded-md ring-1", getAreaIconStyle(entry.area))}>
                          <AreaIcon area={entry.area} className="size-3" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">{entry.area}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {entry.sent}/{entry.total}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#347796]" aria-hidden />
            Enviaram
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#47cdd0]/60" aria-hidden />
            Em rascunho
          </span>
        </p>
      </section>

      <section aria-labelledby="participacao-pessoas" className="min-w-0 rounded-lg border border-[#dce9eb] bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-[#dce9eb] p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="participacao-pessoas" className="text-sm font-semibold">
            Colaboradores
            <span className="ml-2 font-normal text-muted-foreground">a pesquisa é identificada: use para lembrar quem falta</span>
          </h2>
          <div className="relative sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar pessoa ou área"
              className="pl-9"
              aria-label="Buscar pessoa ou área"
            />
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto border-b border-[#dce9eb] px-4 py-2.5" role="group" aria-label="Filtrar por hub">
          {[{ key: "todos" as const, label: "Todos os hubs" }, ...GROUPS].map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={group === item.key}
              onClick={() => setGroup(item.key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150",
                group === item.key
                  ? "border-[#347796] bg-[#e8f4f8] text-[#285f7a]"
                  : "border-[#dce9eb] text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-[#dce9eb] px-2" role="group" aria-label="Filtrar por situação">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors duration-150",
                filter === key
                  ? "border-[#347796] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              <span className="rounded-full bg-[#eef3f5] px-1.5 text-xs tabular-nums text-muted-foreground">{counts[key]}</span>
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Ninguém nesta situação.</p>
        ) : (
          <ul className="divide-y divide-[#eef3f5]">
            {visible.map((row) => {
              const status = STATUS[row.status];
              const Icon = status.icon;
              return (
                <li key={row.person.id} className="flex items-center gap-3 px-4 py-2.5">
                  <AwardAvatar person={row.person} size="sm" tone="system" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.person.short_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[row.person.department, row.person.position].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
                    {row.status === "enviou" && row.submitted_at
                      ? formatAwardDateTime(row.submitted_at)
                      : row.status === "rascunho"
                        ? `${row.filled} de ${row.total} indicações`
                        : ""}
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                      status.className
                    )}
                  >
                    <Icon className="size-3" aria-hidden />
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
