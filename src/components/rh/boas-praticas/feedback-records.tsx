"use client";

import { useMemo, useState } from "react";
import { Camera, Inbox, Plus, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { businessDaysToResponse, flowStatus, todayIso } from "@/lib/rh/boas-praticas/metrics";
import { searchKey } from "@/lib/rh/registration/combo-search";
import {
  FLOW_STATUS_LABEL,
  MONTH_LABELS,
  categoryLabel,
  type FeedbackFlowStatus,
  type GoodPracticeFeedback,
} from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";
import { FLOW_STATUS_STYLE, FlowStatusBadge, formatDayLabel } from "./feedback-badges";
import { AreaChip, CategoryGlyph, PersonAvatar, useFeedbackPeople, usePeopleIndex } from "./feedback-visuals";

const ALL = "all";
const STATUS_ORDER: FeedbackFlowStatus[] = ["sem_dado", "nao_visualizado", "visualizado", "respondido"];

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} de ${year}`;
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
                title={`${item.photo_count} ${item.photo_count === 1 ? "foto" : "fotos"}`}
              >
                <Camera className="size-3" aria-hidden />
                <span className="tabular-nums">{item.photo_count}</span>
                <span className="sr-only">{item.photo_count === 1 ? "foto" : "fotos"}</span>
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
  const [month, setMonth] = useState(initialMonth);
  const [area, setArea] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState<FeedbackFlowStatus | typeof ALL>(ALL);
  const today = todayIso();

  const months = useMemo(() => [...new Set(items.map((item) => item.sent_on.slice(0, 7)))].sort().reverse(), [items]);
  const areas = useMemo(() => [...new Set(items.map((item) => item.area))].sort((a, b) => a.localeCompare(b, "pt-BR")), [items]);
  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [items]
  );

  // Status conta sobre os outros filtros, para as etiquetas mostrarem quanto sobra em cada um.
  const base = useMemo(() => {
    const term = searchKey(search);
    return items.filter((item) => {
      if (month !== ALL && !item.sent_on.startsWith(month)) return false;
      if (area !== ALL && item.area !== area) return false;
      if (category !== ALL && item.category !== category) return false;
      if (!term) return true;
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
  }, [items, search, month, area, category, people]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((key) => [key, 0])) as Record<FeedbackFlowStatus, number>;
    for (const item of base) counts[flowStatus(item)] += 1;
    return counts;
  }, [base]);

  const visible = useMemo(() => (status === ALL ? base : base.filter((item) => flowStatus(item) === status)), [base, status]);

  const groups = useMemo(() => {
    const map = new Map<string, GoodPracticeFeedback[]>();
    for (const item of visible) {
      const key = item.sent_on.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [visible]);

  const filtered = !!search || month !== ALL || area !== ALL || category !== ALL || status !== ALL;

  function clear() {
    setSearch("");
    setMonth(ALL);
    setArea(ALL);
    setCategory(ALL);
    setStatus(ALL);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-auto lg:min-w-[260px] lg:flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Buscar nome ou ocorrência…"
              aria-label="Buscar feedbacks"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 pl-9 text-sm"
            />
          </div>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-10 w-[calc(50%-0.25rem)] text-sm sm:w-[180px]" aria-label="Mês de envio">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os meses</SelectItem>
              {months.map((key) => (
                <SelectItem key={key} value={key}>
                  {monthLabel(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="h-10 w-[calc(50%-0.25rem)] text-sm sm:w-[200px]" aria-label="Área">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as áreas</SelectItem>
              {areas.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-10 w-full text-sm sm:w-[260px]" aria-label="Categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as categorias</SelectItem>
              {categories.map((value) => (
                <SelectItem key={value} value={value}>
                  <span className="flex items-center gap-2">
                    <CategoryGlyph category={value} className="size-4 text-[#285f7a]" />
                    {value}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={status === ALL}
            onClick={() => setStatus(ALL)}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-colors duration-150",
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
                  active ? className : "bg-white text-foreground ring-[#dce9eb] hover:ring-[#3e84a8]/40"
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {FLOW_STATUS_LABEL[key]}
                <span className="tabular-nums opacity-70">{statusCounts[key]}</span>
              </button>
            );
          })}
          {filtered && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clear}>
              Limpar filtros
            </Button>
          )}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {visible.length} de {items.length} registro{items.length === 1 ? "" : "s"}
          </span>
        </div>
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
