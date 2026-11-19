"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  Link2,
  Loader2,
  Newspaper,
  Pencil,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaTag,
  PeopleStack,
  PersonAvatar,
  RoteiroHistorico,
  StageBadge,
  stageDotClass,
} from "@/components/conteudo/escolhas-visuals";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import {
  decisionActor,
  decisionDate,
  ESCOLHA_PERIOD_LABELS,
  filterByPeriod,
  findStalled,
  stageOfStatus,
  STALLED_REVIEW_DAYS,
  summarizeByArea,
  summarizeByPerson,
  summarizeTotals,
  type EscolhaItem,
  type EscolhaPeriod,
  type PersonSummary,
} from "@/lib/content-escolhas";
import { cn } from "@/lib/utils";

type TimelineFilter = "todas" | "escolhidas" | "enviadas" | "descartadas" | "link";

const TIMELINE_FILTERS: { id: TimelineFilter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "escolhidas", label: "Escolhidas" },
  { id: "enviadas", label: "Enviadas ao MKT" },
  { id: "descartadas", label: "Descartadas" },
  { id: "link", label: "Trazidas por link" },
];

const PERIODS: EscolhaPeriod[] = ["30d", "90d", "ano", "tudo"];
/** Rótulo curto do seletor (cabe numa linha no celular); o resumo usa o rótulo completo. */
const PERIOD_SHORT: Record<EscolhaPeriod, string> = { "30d": "30 dias", "90d": "90 dias", ano: "Este ano", tudo: "Tudo" };
const TIMELINE_PAGE = 30;

function matchesTimelineFilter(item: EscolhaItem, filter: TimelineFilter): boolean {
  if (filter === "escolhidas") return Boolean(item.chosenBy);
  if (filter === "enviadas") return stageOfStatus(item.status) === "enviada";
  if (filter === "descartadas") return item.status === "rejeitado";
  if (filter === "link") return item.fromLink;
  return true;
}

function relative(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}

function openInPostsHref(id: string) {
  return `/conteudo/roteiros?contentId=${encodeURIComponent(id)}`;
}

export function EscolhasClient() {
  const [items, setItems] = useState<EscolhaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [period, setPeriod] = useState<EscolhaPeriod>("90d");
  const [area, setArea] = useState("todas");
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("todas");
  const [query, setQuery] = useState("");
  const [timelineLimit, setTimelineLimit] = useState(TIMELINE_PAGE);
  const [showAllStalled, setShowAllStalled] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EscolhaItem | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/content-roteiros/escolhas", { credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar as escolhas.");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setLoadedAt(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar as escolhas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const areas = useMemo(() => [...new Set(items.map((item) => item.area))].sort((a, b) => a.localeCompare(b, "pt-BR")), [items]);

  const scoped = useMemo(() => {
    const inPeriod = filterByPeriod(items, period);
    return area === "todas" ? inPeriod : inPeriod.filter((item) => item.area === area);
  }, [items, period, area]);

  const totals = useMemo(() => summarizeTotals(scoped), [scoped]);
  const people = useMemo(() => summarizeByPerson(scoped), [scoped]);
  const choosers = useMemo(() => people.filter((entry) => entry.chosen > 0 || entry.fromLink > 0), [people]);
  const byArea = useMemo(
    () => summarizeByArea(scoped).filter((entry) => area === "todas" || entry.area === area),
    [scoped, area],
  );
  // Paradas não dependem do período: uma escolha de junho parada até hoje continua sendo problema.
  const stalled = useMemo(
    () => findStalled(area === "todas" ? items : items.filter((item) => item.area === area)),
    [items, area],
  );

  const timeline = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return scoped
      .filter((item) => matchesTimelineFilter(item, timelineFilter))
      .filter((item) => {
        if (!normalized) return true;
        const actor = decisionActor(item).person?.name ?? "";
        return [item.title, item.area, actor].some((field) => field.toLocaleLowerCase("pt-BR").includes(normalized));
      })
      .sort((a, b) => decisionDate(b).localeCompare(decisionDate(a)));
  }, [scoped, timelineFilter, query]);

  const timelineGroups = useMemo(() => {
    const groups: { key: string; label: string; items: EscolhaItem[] }[] = [];
    for (const item of timeline.slice(0, timelineLimit)) {
      const date = new Date(decisionDate(item));
      const key = format(date, "yyyy-MM");
      let group = groups.at(-1);
      if (!group || group.key !== key) {
        const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
        group = { key, label: label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1), items: [] };
        groups.push(group);
      }
      group.items.push(item);
    }
    return groups;
  }, [timeline, timelineLimit]);

  const maxChosen = Math.max(1, ...choosers.map((entry) => entry.chosen + entry.fromLink));
  const sentShare = totals.chosen > 0 ? Math.round((totals.sent / totals.chosen) * 100) : 0;
  const choosersPeople = choosers.map((entry) => entry.person);
  const visibleStalled = showAllStalled ? stalled : stalled.slice(0, 5);

  const openPerson = (entry: PersonSummary) => {
    setSelectedItem(null);
    setSelectedPerson(entry);
  };

  const openItem = (item: EscolhaItem) => {
    setSelectedPerson(null);
    setSelectedItem(item);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-slate-600">
          {loading ? (
            "Carregando escolhas…"
          ) : (
            <>
              <span className="font-semibold text-slate-900">{totals.chosen}</span>{" "}
              {totals.chosen === 1 ? "matéria escolhida" : "matérias escolhidas"} por{" "}
              <span className="font-semibold text-slate-900">{totals.people}</span>{" "}
              {totals.people === 1 ? "pessoa" : "pessoas"} · {ESCOLHA_PERIOD_LABELS[period].toLocaleLowerCase("pt-BR")}
              {loadedAt ? <span className="text-slate-400"> · atualizado às {format(loadedAt, "HH:mm")}</span> : null}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-[#dce9eb] bg-white p-0.5" role="group" aria-label="Período">
            {PERIODS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setPeriod(option);
                  setTimelineLimit(TIMELINE_PAGE);
                }}
                aria-pressed={period === option}
                title={ESCOLHA_PERIOD_LABELS[option]}
                className={cn(
                  "h-8 whitespace-nowrap rounded px-3 text-xs font-medium transition-colors",
                  period === option ? "bg-[#347796] text-white" : "text-slate-600 hover:bg-[#47cdd0]/10 hover:text-slate-900",
                )}
              >
                {PERIOD_SHORT[option]}
              </button>
            ))}
          </div>
          {areas.length > 1 ? (
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className="h-9 w-[190px] text-sm" aria-label="Área">
                <SelectValue placeholder="Todas as áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as áreas</SelectItem>
                {areas.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button variant="outline" size="icon-sm" onClick={() => void load()} disabled={loading} aria-label="Atualizar">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-[#dce9eb] bg-white py-24 text-slate-500">
          <Loader2 className="size-7 animate-spin" aria-hidden />
          <p className="text-sm">Juntando quem escolheu cada matéria…</p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <section className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.04)] lg:grid-cols-4">
            <Metric label="Matérias escolhidas" value={totals.chosen} hint={totals.fromLink > 0 ? `+ ${totals.fromLink} trazidas por link` : "nenhuma trazida por link"} />
            <Metric label="Pessoas que escolheram" value={totals.people} className="border-l border-[#dce9eb]">
              <PeopleStack people={choosersPeople} max={6} className="mt-2" />
            </Metric>
            <Metric
              label="Enviadas ao Marketing"
              value={totals.sent}
              hint={totals.chosen > 0 ? `${sentShare}% das escolhidas` : "—"}
              className="border-t border-[#dce9eb] lg:border-t-0 lg:border-l"
            />
            <Metric
              label="Paradas no caminho"
              value={stalled.length}
              hint={stalled.length > 0 ? `com o gestor há ${STALLED_REVIEW_DAYS}+ dias ou sem envio` : "nada parado"}
              warn={stalled.length > 0}
              className="border-t border-l border-[#dce9eb] lg:border-t-0"
            />
          </section>

          {/* Paradas */}
          {stalled.length > 0 ? (
            <section className="rounded-lg border border-amber-200 bg-white shadow-[0_1px_2px_rgba(4,32,47,0.04)]">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" aria-hidden />
                  <h2 className="text-sm font-semibold text-slate-900">Precisa de atenção</h2>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{stalled.length}</span>
                </div>
                <p className="text-xs text-slate-600">Escolhidas que não andaram: vale cobrar quem está com elas.</p>
              </header>
              <ul className="divide-y divide-[#eef4f5]">
                {visibleStalled.map(({ item, reason, days }) => {
                  const owner = item.chosenBy;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f4fafb]"
                      >
                        {owner ? <PersonAvatar person={owner} className="size-9" /> : null}
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-slate-900">{owner?.name ?? "Sem responsável"}</span>
                            <AreaTag area={item.area} />
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-sm text-slate-600 sm:truncate">{item.title}</span>
                          <span className="mt-1.5 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 sm:hidden">
                            {reason === "revisao" ? `Com o gestor há ${days} dias` : `Aprovada, sem envio há ${days} dias`}
                          </span>
                        </span>
                        <span className="hidden shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 sm:inline-flex">
                          {reason === "revisao" ? `Com o gestor há ${days} dias` : `Aprovada, sem envio há ${days} dias`}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {stalled.length > 5 ? (
                <div className="border-t border-[#eef4f5] px-4 py-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowAllStalled((value) => !value)}>
                    {showAllStalled ? "Mostrar menos" : `Ver todas (${stalled.length})`}
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Quem escolheu + Por área */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <section className="rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.04)]">
              <header className="flex items-center justify-between gap-2 border-b border-[#eef4f5] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-[#347796]" aria-hidden />
                  <h2 className="text-sm font-semibold text-slate-900">Quem escolheu</h2>
                </div>
                <Legend />
              </header>
              {choosers.length === 0 ? (
                <EmptyBlock text="Ninguém escolheu matéria neste período." />
              ) : (
                <ol className="divide-y divide-[#eef4f5]">
                  {choosers.map((entry, index) => (
                    <li key={entry.key}>
                      <button
                        type="button"
                        onClick={() => openPerson(entry)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f4fafb]"
                      >
                        <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-400">{index + 1}</span>
                        <PersonAvatar person={entry.person} className="size-10" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{entry.person.name}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                            {entry.areas.slice(0, 2).map((itemArea) => (
                              <AreaTag key={itemArea} area={itemArea} className="text-xs" />
                            ))}
                            <span>· última {relative(entry.lastAt)}</span>
                          </span>
                          <PersonBar entry={entry} max={maxChosen} />
                        </span>
                        <span className="shrink-0 text-right">
                          {entry.chosen > 0 ? (
                            <>
                              <span className="block text-xl font-semibold tabular-nums text-slate-900">{entry.chosen}</span>
                              <span className="block text-xs text-slate-500">
                                {entry.chosen === 1 ? "escolhida" : "escolhidas"}
                                {entry.fromLink > 0 ? ` · ${entry.fromLink} por link` : ""}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="block text-xl font-semibold tabular-nums text-slate-500">{entry.fromLink}</span>
                              <span className="block text-xs text-slate-500">trazida{entry.fromLink === 1 ? "" : "s"} por link</span>
                            </>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="self-start rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.04)]">
              <header className="flex items-center gap-2 border-b border-[#eef4f5] px-4 py-3">
                <Newspaper className="size-4 text-[#347796]" aria-hidden />
                <h2 className="text-sm font-semibold text-slate-900">Por área</h2>
              </header>
              <ul className="divide-y divide-[#eef4f5]">
                {byArea.map((entry) => (
                  <li key={entry.area} className="flex items-center gap-3 px-4 py-3">
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md ring-1", getAreaIconStyle(entry.area))}>
                      <AreaIcon area={entry.area} className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{entry.area}</span>
                      <span className="block text-xs text-slate-500">
                        {entry.chosen === 0
                          ? "Ninguém escolheu no período"
                          : `${entry.chosen} ${entry.chosen === 1 ? "escolhida" : "escolhidas"} · ${entry.sent} ${entry.sent === 1 ? "enviada" : "enviadas"}`}
                      </span>
                    </span>
                    <PeopleStack people={entry.people} max={4} />
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Linha do tempo */}
          <section className="rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.04)]">
            <header className="flex flex-col gap-3 border-b border-[#eef4f5] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Linha do tempo</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1" role="group" aria-label="Tipo de decisão">
                  {TIMELINE_FILTERS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={timelineFilter === option.id}
                      onClick={() => {
                        setTimelineFilter(option.id);
                        setTimelineLimit(TIMELINE_PAGE);
                      }}
                      className={cn(
                        "h-8 rounded-full px-3 text-xs font-medium transition-colors",
                        timelineFilter === option.id
                          ? "bg-[#347796] text-white"
                          : "bg-[#eaf2f5] text-[#285f7a] hover:bg-[#dcebf0]",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Matéria ou pessoa"
                    aria-label="Buscar na linha do tempo"
                    className="h-9 pl-9 text-sm"
                  />
                </div>
              </div>
            </header>

            {timeline.length === 0 ? (
              <EmptyBlock text="Nada encontrado com esses filtros." />
            ) : (
              <div>
                {timelineGroups.map((group) => (
                  <div key={group.key}>
                    <p className="sticky top-0 z-10 border-b border-[#eef4f5] bg-[#f7fbfc] px-4 py-2 text-xs font-semibold text-slate-600">
                      {group.label}
                    </p>
                    <ul className="divide-y divide-[#eef4f5]">
                      {group.items.map((item) => (
                        <TimelineEntry key={item.id} item={item} onOpen={() => openItem(item)} />
                      ))}
                    </ul>
                  </div>
                ))}
                {timeline.length > timelineLimit ? (
                  <div className="border-t border-[#eef4f5] px-4 py-3 text-center">
                    <Button variant="outline" size="sm" onClick={() => setTimelineLimit((value) => value + TIMELINE_PAGE)}>
                      Mostrar mais ({timeline.length - timelineLimit})
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </>
      )}

      {/* Detalhe da matéria */}
      <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {selectedItem ? (
            <>
              <div className="flex gap-4 border-b border-[#eef4f5] p-5 pr-12">
                <Thumb item={selectedItem} className="h-20 w-28" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AreaTag area={selectedItem.area} />
                    <StageBadge status={selectedItem.status} />
                  </div>
                  <DialogTitle className="mt-2 text-base leading-snug font-semibold text-slate-900">{selectedItem.title}</DialogTitle>
                  <DialogDescription className="mt-1 text-xs">
                    {selectedItem.fromLink ? "Trazida por link" : "Veio da busca de notícias"} ·{" "}
                    {format(new Date(selectedItem.publishedAt ?? selectedItem.createdAt), "dd MMM yyyy", { locale: ptBR })}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <p className="mb-3 text-xs font-semibold text-slate-500">Histórico</p>
                <RoteiroHistorico item={selectedItem} />
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-[#eef4f5] px-5 py-3">
                {selectedItem.link ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedItem.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" aria-hidden />
                      Conferir notícia
                    </a>
                  </Button>
                ) : null}
                <Button size="sm" asChild>
                  <Link href={openInPostsHref(selectedItem.id)}>
                    <ArrowUpRight className="size-4" aria-hidden />
                    Abrir o post
                  </Link>
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Matérias de uma pessoa */}
      <Dialog open={Boolean(selectedPerson)} onOpenChange={(open) => !open && setSelectedPerson(null)}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {selectedPerson ? (
            <>
              <div className="flex items-center gap-4 border-b border-[#eef4f5] p-5 pr-12">
                <PersonAvatar person={selectedPerson.person} className="size-14" />
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold text-slate-900">{selectedPerson.person.name}</DialogTitle>
                  <DialogDescription className="mt-1 text-xs">
                    {selectedPerson.person.department ?? selectedPerson.areas.join(", ")} · última decisão {relative(selectedPerson.lastAt)}
                  </DialogDescription>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <CountChip label="escolhidas" value={selectedPerson.chosen} />
                    <CountChip label="com o gestor" value={selectedPerson.inReview} />
                    <CountChip label="gestor aprovou" value={selectedPerson.managerApproved} />
                    <CountChip label="enviadas" value={selectedPerson.sent} />
                    <CountChip label="por link" value={selectedPerson.fromLink} />
                    <CountChip label="descartadas" value={selectedPerson.rejected} />
                  </div>
                </div>
              </div>
              <ul className="flex-1 divide-y divide-[#eef4f5] overflow-y-auto">
                {[...selectedPerson.items]
                  .sort((a, b) => decisionDate(b).localeCompare(decisionDate(a)))
                  .map((item) => (
                    <TimelineEntry key={item.id} item={item} onOpen={() => openItem(item)} hideActor />
                  ))}
              </ul>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  warn,
  className,
  children,
}: {
  label: string;
  value: number;
  hint?: string;
  warn?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("px-4 py-4 sm:px-5", className)}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("mt-1 text-3xl font-semibold tabular-nums", warn ? "text-amber-700" : "text-slate-900")}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      {children}
    </div>
  );
}

function Legend() {
  const entries = [
    { stage: "escolhida" as const, label: "Com o gestor" },
    { stage: "gestor_aprovou" as const, label: "Gestor aprovou" },
    { stage: "enviada" as const, label: "Enviada" },
  ];
  return (
    <span className="hidden items-center gap-3 sm:flex">
      {entries.map((entry) => (
        <span key={entry.stage} className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className={cn("size-2 rounded-full", stageDotClass(entry.stage))} aria-hidden />
          {entry.label}
        </span>
      ))}
    </span>
  );
}

/** Barra com o tamanho relativo da participação, dividida pela etapa de cada escolha. */
function PersonBar({ entry, max }: { entry: PersonSummary; max: number }) {
  const total = entry.chosen + entry.fromLink;
  const width = `${Math.max(8, Math.round((total / max) * 100))}%`;
  const segments = [
    { stage: "enviada" as const, value: entry.sent },
    { stage: "gestor_aprovou" as const, value: entry.managerApproved },
    { stage: "escolhida" as const, value: entry.inReview },
  ].filter((segment) => segment.value > 0);
  const rest = total - segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <span className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[#eef4f5]" style={{ width }} aria-hidden>
      {segments.map((segment) => (
        <span key={segment.stage} className={stageDotClass(segment.stage)} style={{ flexGrow: segment.value }} />
      ))}
      {rest > 0 ? <span className="bg-slate-300" style={{ flexGrow: rest }} /> : null}
    </span>
  );
}

function CountChip({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <span className="rounded-full bg-[#eaf2f5] px-2 py-0.5 text-xs font-medium text-[#285f7a]">
      <span className="font-semibold tabular-nums">{value}</span> {label}
    </span>
  );
}

function Thumb({ item, className }: { item: EscolhaItem; className?: string }) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-[#1a2f44] to-[#04202f]", className)}>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <Newspaper className="size-5 text-white/30" aria-hidden />
        </span>
      )}
    </span>
  );
}

function TimelineEntry({ item, onOpen, hideActor = false }: { item: EscolhaItem; onOpen: () => void; hideActor?: boolean }) {
  const { person, verb } = decisionActor(item);
  const at = decisionDate(item);
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f4fafb]">
        {!hideActor ? (
          person ? (
            <PersonAvatar person={person} className="mt-0.5 size-9" />
          ) : (
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Users className="size-4" aria-hidden />
            </span>
          )
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-slate-600">
            {hideActor ? (
              <span className="font-medium capitalize text-slate-800">{verb || "registro"}</span>
            ) : (
              <>
                <span className="font-semibold text-slate-900">{person?.name ?? "Sem registro de quem"}</span> {verb || "descartou"}
              </>
            )}
            <span className="text-slate-400"> · {format(new Date(at), "dd MMM, HH:mm", { locale: ptBR })}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 block text-sm font-medium leading-snug text-slate-900">{item.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            <AreaTag area={item.area} />
            <StageBadge status={item.status} />
            {item.hasAlterations ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Pencil className="size-3" aria-hidden />
                texto ajustado
              </span>
            ) : null}
            {item.fromLink && verb !== "trouxe por link" ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Link2 className="size-3" aria-hidden />
                por link
              </span>
            ) : null}
          </span>
        </span>
        <Thumb item={item} className="hidden h-14 w-20 sm:block" />
      </button>
    </li>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-500">{text}</p>;
}
