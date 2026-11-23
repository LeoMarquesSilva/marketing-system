"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Camera,
  Inbox,
  Plus,
  Search,
  SearchX,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterMenu, type FilterMenuOption } from "@/components/ui/filter-menu";
import { Input } from "@/components/ui/input";
import { getAreaIconStyle } from "@/lib/area-icons";
import { businessDaysToResponse, flowStatus, todayIso } from "@/lib/rh/boas-praticas/metrics";
import { searchKey } from "@/lib/rh/registration/combo-search";
import {
  FEEDBACK_CATEGORIES,
  FLOW_STATUS_LABEL,
  MONTH_LABELS,
  categoryLabel,
  isOfficialArea,
  recipientOf,
  type FeedbackFlowStatus,
  type FeedbackRecipient,
  type GoodPracticeFeedback,
} from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";
import { FLOW_STATUS_STYLE, FlowStatusBadge, formatDayLabel } from "./feedback-badges";
import { AreaChip, AreaGlyph, CategoryGlyph, PersonAvatar, useFeedbackPeople, usePeopleIndex } from "./feedback-visuals";

const ALL = "all";
const STATUS_ORDER: FeedbackFlowStatus[] = ["sem_dado", "nao_visualizado", "visualizado", "respondido"];

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} de ${year}`;
}

/** Filtro aplicado, com o que está valendo e o X para tirar (mesmo selo de Fichas cadastrais). */
function ActiveFilter({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#bfeaec] bg-[#eefdfe] py-0.5 pl-2.5 pr-1 text-xs text-[#174f58]">
      <span className="truncate">
        <span className="font-semibold">{label}:</span> {value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro de ${label.toLowerCase()}`}
        className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-[#d9f3f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function RecordRow({ item, today, onOpen }: { item: GoodPracticeFeedback; today: string; onOpen: () => void }) {
  const { employee, manager } = useFeedbackPeople(item);
  const day = formatDayLabel(item.sent_on);
  const status = flowStatus(item);
  const responseDays = businessDaysToResponse(item.sent_on, item.responded_on);
  const waitingDays = item.responded_on ? null : businessDaysToResponse(item.sent_on, today);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "grid w-full grid-cols-[44px_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3.5 text-left transition-colors duration-150",
          "hover:bg-[#f6fafb] focus-visible:bg-[#f2f8f9] focus-visible:outline-none",
          "lg:grid-cols-[44px_minmax(0,0.95fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_164px] lg:items-center lg:gap-x-5"
        )}
      >
        <span className="flex flex-col items-center rounded-md bg-[#f2f6f8] py-1 text-center leading-none">
          <span className="text-base font-semibold tabular-nums text-[#10293a]">{day.day}</span>
          <span className="mt-1 text-xs text-muted-foreground">{day.weekday}</span>
        </span>

        <span className="flex min-w-0 items-center gap-2.5">
          <PersonAvatar name={employee.name} person={employee.person} isTeam={employee.isTeam} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{employee.name}</span>
            <AreaChip area={item.area} className="mt-1" />
          </span>
        </span>

        <span className="col-span-2 min-w-0 lg:col-span-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-[#285f7a]">
            <CategoryGlyph category={item.category} className="size-3.5 shrink-0" />
            <span className="truncate">{categoryLabel(item)}</span>
            {item.photo_count > 0 && (
              <span
                className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eef3f5] px-1.5 py-0.5 text-muted-foreground"
                title={`${item.photo_count} ${item.photo_count === 1 ? "foto ou vídeo" : "fotos e vídeos"}`}
              >
                <Camera className="size-3" aria-hidden />
                <span className="tabular-nums">{item.photo_count}</span>
                <span className="sr-only">{item.photo_count === 1 ? "foto ou vídeo" : "fotos e vídeos"}</span>
              </span>
            )}
          </span>
          <span className="mt-0.5 line-clamp-2 text-sm leading-5 text-foreground">{item.description}</span>
        </span>

        <span className="col-span-2 flex items-center justify-between gap-3 lg:contents">
          <span className="flex min-w-0 items-center gap-2">
            <PersonAvatar name={manager.name} person={manager.person} size="xs" />
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Gestor</span>
              <span className="block truncate text-sm text-foreground">{manager.name}</span>
            </span>
          </span>
          <span className="flex flex-col items-end gap-1 lg:items-start">
            <FlowStatusBadge status={status} />
            <span className="text-xs tabular-nums text-muted-foreground">
              {item.responded_on
                ? responseDays === null
                  ? "Retorno com data a conferir"
                  : `Retorno em ${responseDays} ${responseDays === 1 ? "dia útil" : "dias úteis"}`
                : waitingDays
                  ? `Sem retorno há ${waitingDays} ${waitingDays === 1 ? "dia útil" : "dias úteis"}`
                  : "Enviado hoje"}
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

type FilterKey = "month" | "area" | "recipient" | "category" | "manager";
type Selection = Record<FilterKey, string[]>;

const FILTERS: { key: FilterKey; label: string; width?: string }[] = [
  { key: "month", label: "Mês", width: "w-64" },
  { key: "area", label: "Área", width: "w-72" },
  { key: "recipient", label: "Quem recebeu", width: "w-72" },
  { key: "category", label: "Categoria", width: "w-96" },
  { key: "manager", label: "Gestor", width: "w-80" },
];

/** Valor de cada registro em cada filtro (gestor sem vínculo vai pelo nome gravado). */
const VALUE_OF: Record<FilterKey, (item: GoodPracticeFeedback) => string> = {
  month: (item) => item.sent_on.slice(0, 7),
  area: (item) => item.area,
  recipient: (item) => recipientOf(item),
  category: (item) => item.category,
  manager: (item) => item.manager_employee_id ?? `nome:${item.manager_name.trim().toLowerCase()}`,
};

const RECIPIENT_OPTIONS: { value: FeedbackRecipient; label: string; icon: LucideIcon }[] = [
  { value: "pessoa", label: "Colaborador", icon: UserRound },
  { value: "equipe", label: "Equipe da área", icon: UsersRound },
  { value: "gestores", label: "Gestores (todos)", icon: BriefcaseBusiness },
];

const CATEGORY_ORDER = new Map(FEEDBACK_CATEGORIES.map((name, index) => [name, index]));

function emptySelection(month: string): Selection {
  return { month: month === ALL ? [] : [month], area: [], recipient: [], category: [], manager: [] };
}

export function FeedbackRecords({
  items,
  initialMonth,
  onOpen,
  onCreate,
}: {
  items: GoodPracticeFeedback[];
  /** "2026-10" vindo do dashboard; ALL mostra tudo. */
  initialMonth: string;
  onOpen: (item: GoodPracticeFeedback) => void;
  onCreate: () => void;
}) {
  const people = usePeopleIndex();
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<Selection>(() => emptySelection(initialMonth));
  const [status, setStatus] = useState<FeedbackFlowStatus | typeof ALL>(ALL);
  const today = todayIso();

  const searched = useMemo(() => {
    const term = searchKey(search);
    if (!term) return items;
    return items.filter((item) => {
      const employee = item.employee_id ? people.get(item.employee_id) : undefined;
      const manager = item.manager_employee_id ? people.get(item.manager_employee_id) : undefined;
      return searchKey(
        [
          item.employee_name,
          employee?.short_name ?? "",
          item.manager_name,
          manager?.short_name ?? "",
          item.description,
          item.manager_action ?? "",
        ].join(" ")
      ).includes(term);
    });
  }, [items, search, people]);

  /** Passa nos filtros de menu, menos o `except` (a contagem de cada menu ignora o próprio filtro). */
  const passes = useCallback(
    (item: GoodPracticeFeedback, except?: FilterKey) =>
      FILTERS.every(({ key }) => key === except || !selection[key].length || selection[key].includes(VALUE_OF[key](item))),
    [selection]
  );

  // Status conta sobre os outros filtros, para as etiquetas mostrarem quanto sobra em cada um.
  const base = useMemo(() => searched.filter((item) => passes(item)), [searched, passes]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((key) => [key, 0])) as Record<FeedbackFlowStatus, number>;
    for (const item of base) counts[flowStatus(item)] += 1;
    return counts;
  }, [base]);

  const visible = useMemo(() => (status === ALL ? base : base.filter((item) => flowStatus(item) === status)), [base, status]);

  // Opções de cada menu: todos os valores que já apareceram, com quantos sobram aplicando os outros filtros.
  const options = useMemo(() => {
    const result = {} as Record<FilterKey, FilterMenuOption[]>;
    for (const { key } of FILTERS) {
      const pool = searched.filter((item) => passes(item, key) && (status === ALL || flowStatus(item) === status));
      const counts = new Map<string, number>();
      for (const item of pool) counts.set(VALUE_OF[key](item), (counts.get(VALUE_OF[key](item)) ?? 0) + 1);
      if (key === "recipient") {
        result[key] = RECIPIENT_OPTIONS.map(({ value, label, icon: Icon }) => ({
          value,
          label,
          count: counts.get(value) ?? 0,
          leading: <Icon className="size-4 shrink-0 text-[#285f7a]" aria-hidden />,
        }));
        continue;
      }
      const sample = new Map<string, GoodPracticeFeedback>();
      for (const item of items) if (!sample.has(VALUE_OF[key](item))) sample.set(VALUE_OF[key](item), item);
      // Área: só as oficiais, como em Férias (ADD e o grupo Gestores ficam fora; Gestores tem o filtro "Quem recebeu").
      if (key === "area") for (const area of [...sample.keys()]) if (!isOfficialArea(area)) sample.delete(area);
      result[key] = [...sample.entries()].map(([value, item]) => {
        const count = counts.get(value) ?? 0;
        if (key === "month") return { value, label: monthLabel(value), count };
        if (key === "area") {
          return {
            value,
            label: value,
            count,
            leading: (
              <span className={cn("grid size-5 shrink-0 place-items-center rounded ring-1 ring-inset", getAreaIconStyle(value))} aria-hidden>
                <AreaGlyph area={value} className="size-3" />
              </span>
            ),
          };
        }
        if (key === "category") {
          return { value, label: value, count, leading: <CategoryGlyph category={value} className="size-4 shrink-0 text-[#285f7a]" /> };
        }
        const person = item.manager_employee_id ? (people.get(item.manager_employee_id) ?? null) : null;
        const name = person?.short_name ?? item.manager_name;
        return { value, label: name, count, leading: <PersonAvatar name={name} person={person} size="xs" /> };
      });
      result[key].sort((a, b) =>
        key === "month"
          ? b.value.localeCompare(a.value)
          : key === "category"
            ? (CATEGORY_ORDER.get(a.value) ?? 99) - (CATEGORY_ORDER.get(b.value) ?? 99) || a.label.localeCompare(b.label, "pt-BR")
            : a.label.localeCompare(b.label, "pt-BR")
      );
    }
    return result;
  }, [items, searched, passes, status, people]);

  const groups = useMemo(() => {
    const map = new Map<string, GoodPracticeFeedback[]>();
    for (const item of visible) {
      const key = item.sent_on.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [visible]);

  const activeFilters = FILTERS.filter(({ key }) => selection[key].length > 0);
  const filtered = !!search || activeFilters.length > 0 || status !== ALL;

  function toggle(key: FilterKey, value: string) {
    setSelection((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((entry) => entry !== value) : [...current[key], value],
    }));
  }

  function clearFilter(key: FilterKey) {
    setSelection((current) => ({ ...current, [key]: [] }));
  }

  function clear() {
    setSearch("");
    setSelection(emptySelection(ALL));
    setStatus(ALL);
  }

  const labelOf = (key: FilterKey, value: string) => options[key].find((option) => option.value === value)?.label ?? value;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full md:w-auto md:min-w-[260px] md:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Buscar pessoa, gestor ou ocorrência…"
              aria-label="Buscar feedbacks"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 pl-9 pr-9 text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-[#f2f8f9] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
            {FILTERS.map(({ key, label, width }) => (
              <FilterMenu
                key={key}
                label={label}
                options={options[key]}
                selected={selection[key]}
                onToggle={(value) => toggle(key, value)}
                onClear={() => clearFilter(key)}
                width={width}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={status === ALL}
            onClick={() => setStatus(ALL)}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
              status === ALL ? "bg-[#10293a] text-white ring-[#10293a]" : "bg-white text-foreground ring-[#dce9eb] hover:ring-[#3e84a8]/40"
            )}
          >
            Todos
            <span className={cn("tabular-nums", status === ALL ? "text-white/75" : "text-muted-foreground")}>{base.length}</span>
          </button>
          {STATUS_ORDER.map((key) => {
            const { icon: Icon, className } = FLOW_STATUS_STYLE[key];
            const active = status === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(active ? ALL : key)}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                  active ? className : "bg-white text-foreground ring-[#dce9eb] hover:ring-[#3e84a8]/40",
                  !active && statusCounts[key] === 0 && "text-muted-foreground"
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {FLOW_STATUS_LABEL[key]}
                <span className="tabular-nums opacity-70">{statusCounts[key]}</span>
              </button>
            );
          })}
          <span className="ml-auto pl-2 text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {visible.length === items.length
              ? `${items.length} registro${items.length === 1 ? "" : "s"}`
              : `${visible.length} de ${items.length} registro${items.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {filtered && (
          <div className="flex flex-wrap items-center gap-1.5">
            {search && (
              <ActiveFilter label="Busca" value={`“${search.trim()}”`} onRemove={() => setSearch("")} />
            )}
            {activeFilters.map(({ key, label }) => (
              <ActiveFilter
                key={key}
                label={label}
                value={selection[key].map((value) => labelOf(key, value)).join(", ")}
                onRemove={() => clearFilter(key)}
              />
            ))}
            {status !== ALL && <ActiveFilter label="Status" value={FLOW_STATUS_LABEL[status]} onRemove={() => setStatus(ALL)} />}
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-[#285f7a]" onClick={clear}>
              <X className="size-3.5" aria-hidden />
              Limpar tudo
            </Button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <Card className="items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-[#eef6f8] text-[#3e84a8]">
            {items.length === 0 ? <Inbox className="size-5" aria-hidden /> : <SearchX className="size-5" aria-hidden />}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {items.length === 0 ? "Nenhum feedback registrado ainda" : "Nenhum feedback com esses filtros"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length === 0
                ? "Registre a primeira ocorrência para o dashboard começar a contar."
                : "Tente outro mês, outra área ou limpe a busca."}
            </p>
          </div>
          {items.length === 0 ? (
            <Button type="button" className="gap-2" onClick={onCreate}>
              <Plus className="size-4" />
              Registrar feedback
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={clear}>
              Limpar filtros
            </Button>
          )}
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {groups.map(([key, groupItems]) => {
            const responded = groupItems.filter((item) => item.responded_on).length;
            return (
              <section key={key} className="border-b border-[#e6eef0] last:border-b-0">
                <header className="flex items-center justify-between gap-3 border-b border-[#e6eef0] bg-[#fafcfc] px-4 py-2">
                  <h3 className="text-sm font-semibold text-foreground">{monthLabel(key)}</h3>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {groupItems.length} feedback{groupItems.length === 1 ? "" : "s"} · {responded} com retorno
                  </span>
                </header>
                <ul className="divide-y divide-[#eef3f5]">
                  {groupItems.map((item) => (
                    <RecordRow key={item.id} item={item} today={today} onOpen={() => onOpen(item)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </Card>
      )}
    </div>
  );
}
