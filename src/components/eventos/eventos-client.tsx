"use client";

import { useMemo, useState } from "react";
import { CalendarDays, LayoutGrid, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventosOverviewPanel } from "@/components/eventos/eventos-overview-panel";
import { EventosCalendar } from "@/components/eventos/eventos-calendar";
import { EventoCard } from "@/components/eventos/evento-card";
import { EventoFormDialog } from "@/components/eventos/evento-form-dialog";
import { EventosSubNav } from "@/components/eventos/eventos-sub-nav";
import {
  EVENT_KIND_LABEL,
  EVENT_STATUS_LABEL,
  MONTH_NAMES,
  getEventMonthIndex,
  type EventKind,
  type EventStatus,
  type EventWithStats,
  type EventsOverview,
} from "@/lib/eventos";
import type { User } from "@/lib/users";

interface EventosClientProps {
  initialYear: number;
  years: number[];
  initialEvents: EventWithStats[];
  initialOverview: EventsOverview;
  users?: User[];
}

export function EventosClient({
  initialYear,
  years,
  initialEvents,
  initialOverview,
  users = [],
}: EventosClientProps) {
  const [year, setYear] = useState(initialYear);
  const [events, setEvents] = useState(initialEvents);
  const [overview, setOverview] = useState(initialOverview);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [kindFilter, setKindFilter] = useState<string>("__all__");
  const [monthFilter, setMonthFilter] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const yearOptions = useMemo(() => {
    const set = new Set([...years, new Date().getFullYear(), year]);
    return [...set].sort((a, b) => b - a);
  }, [years, year]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (statusFilter !== "__all__" && e.status !== statusFilter) return false;
      if (kindFilter !== "__all__" && e.kind !== kindFilter) return false;
      if (monthFilter !== "__all__") {
        const monthIndex = getEventMonthIndex(e);
        if (monthFilter === "__none__" ? monthIndex !== null : monthIndex !== Number(monthFilter)) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          (e.organizationTeam ?? "").toLowerCase().includes(q) ||
          (e.giftsNotes ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [events, statusFilter, kindFilter, monthFilter, search]);

  const groupedByMonth = useMemo(() => {
    if (monthFilter !== "__all__") return null;
    const groups = new Map<number, EventWithStats[]>();
    const noMonth: EventWithStats[] = [];
    for (const e of filtered) {
      const idx = getEventMonthIndex(e);
      if (idx === null) {
        noMonth.push(e);
        continue;
      }
      const list = groups.get(idx) ?? [];
      list.push(e);
      groups.set(idx, list);
    }
    const ordered: { idx: number; name: string; events: EventWithStats[] }[] = MONTH_NAMES.map(
      (name, idx) => ({ idx, name, events: groups.get(idx) ?? [] })
    ).filter((g) => g.events.length > 0);
    if (noMonth.length > 0) ordered.push({ idx: -1, name: "Sem mês definido", events: noMonth });
    return ordered;
  }, [filtered, monthFilter]);

  async function reloadEvents(targetYear: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/eventos?year=${targetYear}`);
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.events);
      setOverview(data.overview);
    } finally {
      setLoading(false);
    }
  }

  function handleYearChange(v: string) {
    const y = Number(v);
    setYear(y);
    reloadEvents(y);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Organização de Eventos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Cronograma anual, tarefas por responsável e orçamento por evento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(year)} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo evento
          </Button>
        </div>
      </div>

      <EventosSubNav />

      <EventosOverviewPanel overview={overview} year={year} loading={loading} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Cards
          </Button>
          <Button
            variant={view === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("calendar")}
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            Calendário
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar evento..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Eventos e campanhas</SelectItem>
              {(Object.keys(EVENT_KIND_LABEL) as EventKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {k === "evento" ? "Só eventos" : "Só campanhas"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os meses</SelectItem>
              {MONTH_NAMES.map((name, idx) => (
                <SelectItem key={name} value={String(idx)}>
                  {name}
                </SelectItem>
              ))}
              <SelectItem value="__none__">Sem mês definido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os status</SelectItem>
              {(Object.keys(EVENT_STATUS_LABEL) as EventStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {EVENT_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === "calendar" ? (
        <EventosCalendar events={filtered} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum evento encontrado para {year}.</p>
        </div>
      ) : groupedByMonth ? (
        <div className="space-y-6">
          {groupedByMonth.map((group) => (
            <div key={group.idx} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
                <span className="text-xs text-muted-foreground">
                  {group.events.length} evento{group.events.length !== 1 ? "s" : ""}
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.events.map((event) => (
                  <EventoCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((event) => (
            <EventoCard key={event.id} event={event} />
          ))}
        </div>
      )}

      <EventoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultYear={year}
        users={users}
        onSuccess={() => reloadEvents(year)}
      />
    </div>
  );
}
