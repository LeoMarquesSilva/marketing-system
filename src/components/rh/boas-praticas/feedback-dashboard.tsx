"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  ListChecks,
  MessageSquareReply,
  Minus,
  Send,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  previousMonth,
  repeatOffenders,
  summarizeMonth,
  summarizeYear,
  type MonthRef,
  type MonthSummary,
} from "@/lib/rh/boas-praticas/metrics";
import {
  AREA_BAND_LABEL,
  MONTH_LABELS,
  MONTH_SHORT,
  type FeedbackPerson,
  type GoodPracticeFeedback,
} from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";
import { BAND_STYLE, BandBadge, dashIfZero, formatDate, formatPercent } from "./feedback-badges";
import { AreaChip, AreaIconTile, CategoryIcon, PersonAvatar, usePeopleIndex } from "./feedback-visuals";

const BAND_GUIDANCE = {
  monitoramento: "Fase 1 segue normalmente. Nenhuma área pede ação extra neste mês.",
  atencao: "Conversa rápida com o líder da área e reforço do tema que mais se repetiu.",
  acionamento: "Fase 2: aplicação presencial do manual na área e registro de participação.",
} as const;

/* ------------------------------------------------------------- estruturas */

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Panel({
  icon: Icon,
  title,
  meta,
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 gap-0 py-0", className)}>
      <div className="flex items-center gap-2.5 border-b border-[#e6eef0] px-4 py-3">
        <Icon className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {meta && <span className="hidden text-xs text-muted-foreground sm:inline">{meta}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Mais feedback é pior: subida em âmbar, queda em verde. */
function Trend({ current, previous, previousLabel }: { current: number; previous: number; previousLabel: string }) {
  const diff = current - previous;
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        diff > 0 && "bg-amber-50 text-amber-800 ring-amber-200",
        diff < 0 && "bg-emerald-50 text-emerald-800 ring-emerald-200",
        diff === 0 && "bg-slate-50 text-slate-600 ring-slate-200"
      )}
    >
      <Icon className="size-3" aria-hidden />
      {diff === 0 ? "igual a" : `${diff > 0 ? "+" : ""}${diff} vs`} {previousLabel}
    </span>
  );
}

/* --------------------------------------------------------- régua do ano */

function YearRail({
  items,
  month,
  years,
  onMonthChange,
}: {
  items: GoodPracticeFeedback[];
  month: MonthRef;
  years: number[];
  onMonthChange: (month: MonthRef) => void;
}) {
  const year = useMemo(() => summarizeYear(items, month.year), [items, month.year]);
  const max = Math.max(1, ...year.sentByMonth);
  const yearIndex = years.indexOf(month.year);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // No celular a régua rola: mantém o mês escolhido à vista sem mexer na rolagem da página.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const selected = scroller?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!scroller || !selected || scroller.scrollWidth <= scroller.clientWidth) return;
    scroller.scrollLeft = selected.offsetLeft - scroller.clientWidth / 2 + selected.clientWidth / 2;
  }, [month]);

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e6eef0] px-4 py-2.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Ano anterior"
            disabled={yearIndex === years.length - 1}
            onClick={() => onMonthChange({ year: years[yearIndex + 1], month: 12 })}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-12 text-center text-sm font-semibold tabular-nums text-foreground">{month.year}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Próximo ano"
            disabled={yearIndex <= 0}
            onClick={() => onMonthChange({ year: years[yearIndex - 1], month: 1 })}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {plural(year.total, "feedback", "feedbacks")} no ano · {plural(year.responded, "respondido", "respondidos")} pelo líder
        </p>
      </div>
      <div ref={scrollerRef} className="relative overflow-x-auto">
        <div className="grid min-w-[620px] grid-cols-12 gap-1 px-3 py-3" role="group" aria-label={`Meses de ${month.year}`}>
          {MONTH_SHORT.map((label, index) => {
            const sent = year.sentByMonth[index];
            const selected = index + 1 === month.month;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                aria-label={`${MONTH_LABELS[index]}: ${plural(sent, "feedback", "feedbacks")}`}
                onClick={() => onMonthChange({ year: month.year, month: index + 1 })}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-md px-1 pb-1.5 pt-2 transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
                  selected ? "bg-[#e8f8f8] ring-1 ring-inset ring-[#47cdd0]/40" : "hover:bg-[#f2f8f9]"
                )}
              >
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    selected ? "font-semibold text-[#285f7a]" : sent ? "text-foreground" : "text-muted-foreground/60"
                  )}
                >
                  {dashIfZero(sent)}
                </span>
                <span className="flex h-10 w-full items-end justify-center" aria-hidden>
                  <span
                    className={cn(
                      "w-full max-w-7 rounded-t-[4px] transition-colors duration-150",
                      selected ? "bg-[#347796]" : sent ? "bg-[#bcd5e1] group-hover:bg-[#9cc0d2]" : "bg-[#eef3f5]"
                    )}
                    style={{ height: sent ? `${Math.max(10, (sent / max) * 100)}%` : "3px" }}
                  />
                </span>
                <span className={cn("text-xs", selected ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------- resumo do mês */

function Stat({
  icon: Icon,
  label,
  value,
  compact,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 bg-white px-4 py-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 text-[#3e84a8]" aria-hidden />
        {label}
      </p>
      <p className={cn("mt-1 font-semibold text-[#10293a]", compact ? "text-lg leading-8" : "text-[28px] leading-8")}>{value}</p>
      <div className="mt-1.5 text-xs text-muted-foreground">{children}</div>
    </div>
  );
}

function MonthSummaryBand({ summary, month }: { summary: MonthSummary; month: MonthRef }) {
  const previousLabel = MONTH_LABELS[previousMonth(month).month - 1].toLowerCase();
  const respondedShare = summary.total ? summary.responded / summary.total : 0;
  const alertAreas = summary.areas.filter((row) => row.band === "acionamento" || row.band === "atencao");
  const band = summary.band;
  const maxWeek = Math.max(1, ...summary.weeks.map((week) => week.sent));

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid grid-cols-2 gap-px bg-[#e6eef0] lg:grid-cols-4">
          <Stat icon={Send} label="Feedbacks enviados" value={summary.total}>
            <Trend current={summary.total} previous={summary.previousTotal} previousLabel={previousLabel} />
          </Stat>
          <Stat icon={Building2} label="Áreas com feedback" value={summary.areasWithFeedback}>
            {summary.topArea ? (
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                <span>mais em</span>
                <AreaChip area={summary.topArea.area} />
                <span className="tabular-nums">({summary.topArea.sent})</span>
              </span>
            ) : (
              "Nenhum feedback no mês"
            )}
          </Stat>
          <Stat
            icon={Eye}
            label="Visualizados no Feedz"
            value={summary.viewedBase ? formatPercent(summary.viewed / summary.viewedBase) : "Sem dado"}
            compact={!summary.viewedBase}
          >
            {summary.viewedBase
              ? `${summary.viewed} de ${summary.viewedBase} com dado · ${plural(summary.notViewed, "não visto", "não vistos")}`
              : "Exportação do Feedz ainda não lançada"}
          </Stat>
          <Stat
            icon={MessageSquareReply}
            label="Respondidos pelo líder"
            value={
              <>
                {summary.responded}
                <span className="ml-1 text-sm font-medium text-muted-foreground">de {summary.total}</span>
              </>
            }
          >
            <span className="block h-1.5 overflow-hidden rounded-full bg-[#eef3f5]" aria-hidden>
              <span className="block h-full rounded-full bg-[#347796]" style={{ width: `${respondedShare * 100}%` }} />
            </span>
            <span className="mt-1.5 block">{summary.respondedFast} em até 2 dias úteis</span>
          </Stat>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#e6eef0] bg-[#fafcfc] px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock3 className="size-3.5 text-[#3e84a8]" aria-hidden />
            Envios por semana
          </span>
          {summary.weeks.map((week) => (
            <span key={week.label} className="flex items-center gap-1.5 text-xs text-muted-foreground" title={`${week.label}: ${week.sent}`}>
              <span className="tabular-nums">{week.label.split(" · ")[1]}</span>
              <span className="h-1.5 w-10 overflow-hidden rounded-full bg-[#eef3f5]" aria-hidden>
                <span className="block h-full rounded-full bg-[#3e84a8]" style={{ width: `${(week.sent / maxWeek) * 100}%` }} />
              </span>
              <span className="w-4 font-medium tabular-nums text-foreground">{dashIfZero(week.sent)}</span>
            </span>
          ))}
        </div>
      </Card>

      <div
        className={cn(
          "flex flex-col gap-3 rounded-md p-4 ring-1 ring-inset",
          band ? BAND_STYLE[band].panel : "bg-slate-50 text-slate-700 ring-slate-200"
        )}
      >
        <div className="flex items-start gap-3">
          {band ? (
            (() => {
              const Icon = BAND_STYLE[band].icon;
              return (
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-white/80 ring-1 ring-inset ring-black/5">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
              );
            })()
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-medium opacity-80">Faixa do mês pela regra</p>
            <p className="text-lg font-semibold leading-7">{band ? AREA_BAND_LABEL[band] : "Sem feedbacks"}</p>
          </div>
        </div>
        <p className="text-sm leading-5 opacity-90">
          {band ? BAND_GUIDANCE[band] : "Nenhum feedback enviado neste mês."}
        </p>
        {alertAreas.length > 0 && (
          <ul className="space-y-1.5 border-t border-current/10 pt-3">
            {alertAreas.map((row) => (
              <li key={row.area} className="flex items-center justify-between gap-2 text-xs">
                <AreaChip area={row.area} />
                <span className="font-medium">
                  {AREA_BAND_LABEL[row.band!]} · <span className="tabular-nums">{row.sent}</span> no mês
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ onde aconteceu */

function AreasPanel({ summary }: { summary: MonthSummary }) {
  const rows = summary.areas.filter((row) => row.sent > 0 || row.previous > 0);
  const max = Math.max(1, ...rows.map((row) => Math.max(row.sent, row.previous)));
  return (
    <Panel icon={Building2} title="Por área" meta="faixa da regra no mês">
      {rows.length === 0 ? (
        <EmptyLine>Nenhum feedback neste mês nem no anterior.</EmptyLine>
      ) : (
        <ul className="divide-y divide-[#eef3f5]">
          {rows.map((row) => (
            <li key={row.area} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
              <div className="flex min-w-0 items-center gap-2.5">
                <AreaIconTile area={row.area} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{row.area}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">{dashIfZero(row.sent)}</span> no mês · ant.{" "}
                    <span className="tabular-nums">{dashIfZero(row.previous)}</span>
                    {row.sent > 0 && (
                      <>
                        {" "}· {row.responded}/{row.sent} resp.
                        {row.viewed === null ? " · Feedz s/d" : ` · ${row.viewed} vistos`}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="relative hidden h-2 rounded-full bg-[#eef3f5] sm:block" aria-hidden title={`Mês anterior: ${row.previous}`}>
                <span className="absolute inset-y-0 left-0 rounded-full bg-[#3e84a8]" style={{ width: `${(row.sent / max) * 100}%` }} />
                {row.previous > 0 && (
                  <span className="absolute -inset-y-1 w-0.5 rounded-full bg-[#10293a]/35" style={{ left: `calc(${(row.previous / max) * 100}% - 1px)` }} />
                )}
              </div>
              <BandBadge band={row.band} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-[#e6eef0] px-4 py-2 text-xs text-muted-foreground">
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="h-2 w-4 rounded-full bg-[#3e84a8]" aria-hidden /> mês selecionado
          <span className="ml-2 h-3 w-0.5 rounded-full bg-[#10293a]/35" aria-hidden /> mês anterior
        </span>
        <span className="ml-auto tabular-nums">
          Total {summary.total} · ant. {summary.previousTotal}
        </span>
      </div>
    </Panel>
  );
}

function CategoriesPanel({ summary }: { summary: MonthSummary }) {
  return (
    <Panel icon={ListChecks} title="Por tipo de feedback" meta="comparado ao mês anterior">
      {summary.categories.length === 0 ? (
        <EmptyLine>Nenhum feedback neste mês nem no anterior.</EmptyLine>
      ) : (
        <ul className="divide-y divide-[#eef3f5]">
          {summary.categories.map((row) => {
            const diff = row.sent - row.previous;
            return (
              <li key={row.category} className="flex items-center gap-3 px-4 py-2.5">
                <CategoryIcon category={row.category} className={cn(row.sent === 0 && "opacity-50")} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", row.sent ? "font-medium text-foreground" : "text-muted-foreground")}>{row.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.total ? formatPercent(row.share) : "0%"} do mês · ant. {dashIfZero(row.previous)}
                  </p>
                </div>
                <span className="w-6 text-right text-sm font-semibold tabular-nums text-foreground">{dashIfZero(row.sent)}</span>
                <span
                  className={cn(
                    "w-9 text-right text-xs font-medium tabular-nums",
                    diff > 0 ? "text-amber-700" : diff < 0 ? "text-emerald-700" : "text-muted-foreground"
                  )}
                >
                  {diff === 0 ? "=" : diff > 0 ? `+${diff}` : diff}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- quem */

function LeadersPanel({ summary, items, month }: { summary: MonthSummary; items: GoodPracticeFeedback[]; month: MonthRef }) {
  const people = usePeopleIndex();
  const key = `${month.year}-${String(month.month).padStart(2, "0")}`;
  // O resumo agrupa pelo nome gravado; a foto vem do vínculo com o cadastro.
  const personByName = useMemo(() => {
    const map = new Map<string, FeedbackPerson>();
    for (const item of items) {
      if (!item.sent_on.startsWith(key) || !item.manager_employee_id) continue;
      const person = people.get(item.manager_employee_id);
      if (person) map.set(item.manager_name, person);
    }
    return map;
  }, [items, key, people]);

  return (
    <Panel icon={MessageSquareReply} title="Gestores que receberam" meta="no mês">
      {summary.leaders.length === 0 ? (
        <EmptyLine>Nenhum feedback enviado neste mês.</EmptyLine>
      ) : (
        <ul className="divide-y divide-[#eef3f5]">
          {summary.leaders.map((row) => {
            const person = personByName.get(row.manager) ?? null;
            const share = row.sent ? row.responded / row.sent : 0;
            return (
              <li key={row.manager} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_150px_88px]">
                <span className="flex min-w-0 items-center gap-2.5">
                  <PersonAvatar name={person?.short_name ?? row.manager} person={person} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{person?.short_name ?? row.manager}</span>
                    <span className="block truncate text-xs text-muted-foreground">{person?.position ?? "Gestor"}</span>
                  </span>
                </span>
                <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                  <span className="flex items-baseline justify-between text-xs text-muted-foreground">
                    <span>
                      <span className="font-semibold tabular-nums text-foreground">{row.responded}</span> de {row.sent} respondidos
                    </span>
                    <span className="tabular-nums" title="Respondidos em até 2 dias úteis">
                      {row.respondedFast} em até 2 dias
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#eef3f5]" aria-hidden>
                    <span className="block h-full rounded-full bg-[#347796]" style={{ width: `${share * 100}%` }} />
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums text-foreground">{row.sent}</span>
                  <span className="block text-xs text-muted-foreground">
                    {row.noData === row.sent ? "Feedz s/d" : `${row.viewed} vistos`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function RepeatPanel({ items, year }: { items: GoodPracticeFeedback[]; year: number }) {
  const people = usePeopleIndex();
  const [showAll, setShowAll] = useState(false);
  const repeats = useMemo(() => repeatOffenders(items, year), [items, year]);
  const monthsByKey = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const item of items) {
      if (!item.sent_on.startsWith(`${year}-`) || item.is_team) continue;
      const key = item.employee_id ?? item.employee_name.trim().toLowerCase();
      const months = map.get(key) ?? Array<number>(12).fill(0);
      months[Number(item.sent_on.slice(5, 7)) - 1] += 1;
      map.set(key, months);
    }
    return map;
  }, [items, year]);
  const idByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) if (item.employee_id) map.set(item.employee_name, item.employee_id);
    return map;
  }, [items]);
  const visible = showAll ? repeats : repeats.slice(0, 6);

  return (
    <Panel
      icon={TrendingUp}
      title="Reincidência"
      meta={`2+ feedbacks em ${year}`}
      action={
        repeats.length > 6 ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Mostrar menos" : `Ver todos (${repeats.length})`}
          </Button>
        ) : undefined
      }
    >
      {repeats.length === 0 ? (
        <EmptyLine>Ninguém com mais de um feedback em {year}.</EmptyLine>
      ) : (
        <ul className="divide-y divide-[#eef3f5]">
          {visible.map((row) => {
            const id = idByName.get(row.name);
            const person = id ? (people.get(id) ?? null) : null;
            const months = monthsByKey.get(id ?? row.name.trim().toLowerCase()) ?? [];
            const peak = Math.max(1, ...months);
            return (
              <li key={`${row.name}-${row.area}`} className="flex items-center gap-3 px-4 py-2.5">
                <PersonAvatar name={person?.short_name ?? row.name} person={person} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{person?.short_name ?? row.name}</p>
                  <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <CategoryIcon category={row.topCategory} className="size-5 rounded [&_svg]:size-3" />
                    <span className="truncate">{row.topCategory}</span>
                  </p>
                </div>
                <span className="hidden items-end gap-[3px] sm:flex" aria-label={`Meses com feedback em ${year}`} role="img">
                  {months.map((count, index) => (
                    <span
                      key={index}
                      title={`${MONTH_SHORT[index]}: ${count}`}
                      className={cn("w-1.5 rounded-sm", count ? "bg-[#3e84a8]" : "bg-[#e6eef0]")}
                      style={{ height: count ? `${8 + (count / peak) * 14}px` : "4px" }}
                    />
                  ))}
                </span>
                <span className="w-14 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-foreground">{row.count}</span>
                  <span className="block text-xs text-muted-foreground">{formatDate(row.lastSentOn).slice(0, 5)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- ano */

function YearMatrix({ items, month, onMonthChange }: { items: GoodPracticeFeedback[]; month: MonthRef; onMonthChange: (month: MonthRef) => void }) {
  const year = useMemo(() => summarizeYear(items, month.year), [items, month.year]);
  if (year.rows.length === 0) {
    return (
      <Card className="py-0">
        <EmptyLine>Nenhum feedback registrado em {month.year}.</EmptyLine>
      </Card>
    );
  }
  const TH = "px-2 py-2 text-xs font-medium text-muted-foreground";
  return (
    <Card className="gap-0 py-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-[#e6eef0] bg-[#fafcfc]">
            <tr>
              <th className={cn(TH, "pl-4 text-left")}>Área</th>
              {MONTH_SHORT.map((label, index) => (
                <th key={label} className={cn(TH, "text-center")}>
                  <button
                    type="button"
                    onClick={() => onMonthChange({ year: month.year, month: index + 1 })}
                    className={cn(
                      "rounded px-1.5 py-0.5 transition-colors hover:bg-[#e8f8f8] hover:text-[#285f7a]",
                      index + 1 === month.month && "bg-[#e8f8f8] font-semibold text-[#285f7a]"
                    )}
                  >
                    {label}
                  </button>
                </th>
              ))}
              <th className={cn(TH, "pr-4 text-right")}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef3f5]">
            {year.rows.map((row) => (
              <tr key={row.area}>
                <td className="py-1.5 pl-4 pr-2">
                  <span className="flex items-center gap-2">
                    <AreaIconTile area={row.area} className="size-6" />
                    <span className="whitespace-nowrap font-medium text-foreground">{row.area}</span>
                  </span>
                </td>
                {row.months.map((value, index) => (
                  <td key={index} className={cn("px-1 py-1.5 text-center tabular-nums", index + 1 === month.month && "bg-[#f4fbfb]")}>
                    <span
                      className={cn(
                        "inline-flex min-w-8 justify-center rounded px-1.5 py-1",
                        value >= 5
                          ? "bg-orange-200 font-semibold text-orange-950"
                          : value >= 3
                            ? "bg-amber-100 font-medium text-amber-900"
                            : value === 0
                              ? "text-muted-foreground/50"
                              : "text-foreground"
                      )}
                    >
                      {dashIfZero(value)}
                    </span>
                  </td>
                ))}
                <td className="py-1.5 pl-2 pr-4 text-right font-semibold tabular-nums">{row.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-[#e6eef0] bg-[#fafcfc] text-xs">
            <tr className="font-medium text-foreground">
              <td className="py-2 pl-4 pr-2">Total enviados</td>
              {year.sentByMonth.map((value, index) => (
                <td key={index} className="px-1 py-2 text-center tabular-nums">{dashIfZero(value)}</td>
              ))}
              <td className="py-2 pl-2 pr-4 text-right tabular-nums">{year.total}</td>
            </tr>
            <tr className="text-muted-foreground">
              <td className="py-2 pl-4 pr-2">Respondidos pelo líder</td>
              {year.respondedByMonth.map((value, index) => (
                <td key={index} className="px-1 py-2 text-center tabular-nums">
                  {year.sentByMonth[index] ? `${dashIfZero(value)} · ${formatPercent(value / year.sentByMonth[index])}` : ""}
                </td>
              ))}
              <td className="py-2 pl-2 pr-4 text-right tabular-nums">
                {year.responded} · {year.total ? formatPercent(year.responded / year.total) : "–"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-[#e6eef0] px-4 py-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm bg-orange-200" aria-hidden />5 ou mais na área no mês
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm bg-amber-100" aria-hidden />3 ou 4 (referência de Atenção e Acionamento)
        </span>
        <span>Clique num mês para abri-lo.</span>
      </div>
    </Card>
  );
}

function RulesNote() {
  return (
    <details className="group rounded-md border border-[#dce9eb] bg-white px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-foreground marker:text-[#3e84a8]">Como a faixa e os números são calculados</summary>
      <dl className="mt-3 grid gap-x-6 gap-y-3 text-muted-foreground sm:grid-cols-[200px_1fr]">
        <dt className="font-medium text-foreground">Faixas (por área, no mês)</dt>
        <dd>
          Regra do Reforço do Manual de Boas Práticas. <strong className="font-medium text-foreground">Monitoramento</strong>: demais casos, a
          Fase 1 segue normalmente. <strong className="font-medium text-foreground">Atenção</strong>: área com 3 ou 4 feedbacks.{" "}
          <strong className="font-medium text-foreground">Acionamento</strong>: total do mês acima de 10 e área com 5 ou mais, ou área com 3 ou mais
          também no mês anterior (recorrência).
        </dd>
        <dt className="font-medium text-foreground">Área</dt>
        <dd>Área do colaborador no registro, não o departamento do destinatário no Feedz.</dd>
        <dt className="font-medium text-foreground">Visualizado</dt>
        <dd>Vem da exportação do Feedz e é lançado no registro; meses sem dado aparecem como s/d.</dd>
        <dt className="font-medium text-foreground">Respondido</dt>
        <dd>Feedback com data de retorno preenchida. “Em até 2 dias úteis” conta de segunda a sexta após o envio, sem descontar feriados.</dd>
      </dl>
    </details>
  );
}

/* -------------------------------------------------------------- página */

export function FeedbackDashboard({
  items,
  month,
  onMonthChange,
  onOpenRecords,
}: {
  items: GoodPracticeFeedback[];
  month: MonthRef;
  onMonthChange: (month: MonthRef) => void;
  onOpenRecords: () => void;
}) {
  const summary = useMemo(() => summarizeMonth(items, month), [items, month]);
  const years = useMemo(() => {
    const set = new Set(items.map((item) => Number(item.sent_on.slice(0, 4))));
    set.add(month.year);
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [items, month.year]);
  const lastRecord = items.reduce<string | null>((latest, item) => (!latest || item.sent_on > latest ? item.sent_on : latest), null);
  const monthName = MONTH_LABELS[month.month - 1];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <YearRail items={items} month={month} years={years} onMonthChange={onMonthChange} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">
            {monthName} de {month.year}
            {lastRecord && <span className="ml-2 text-sm font-normal text-muted-foreground">último registro em {formatDate(lastRecord)}</span>}
          </h3>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onOpenRecords}>
            <ListChecks className="size-4" />
            Ver os {summary.total} registros do mês
          </Button>
        </div>
        <MonthSummaryBand summary={summary} month={month} />
      </div>

      <Group title="Onde aconteceu" description={`Áreas e tipos de feedback de ${monthName.toLowerCase()}, com o mês anterior como referência.`}>
        <div className="grid gap-3 xl:grid-cols-2">
          <AreasPanel summary={summary} />
          <CategoriesPanel summary={summary} />
        </div>
      </Group>

      <Group title="Quem recebeu e quem respondeu" description="Gestores do mês e colaboradores que já receberam mais de um feedback no ano.">
        <div className="grid gap-3 xl:grid-cols-2">
          <LeadersPanel summary={summary} items={items} month={month} />
          <RepeatPanel items={items} year={month.year} />
        </div>
      </Group>

      <Group title={`Ano de ${month.year}`} description="Quando os feedbacks foram enviados, por área e mês.">
        <YearMatrix items={items} month={month} onMonthChange={onMonthChange} />
        <RulesNote />
      </Group>
    </div>
  );
}
