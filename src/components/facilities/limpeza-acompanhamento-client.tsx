"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  ClipboardCheck,
  ExternalLink,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  MessageSquareWarning,
  NotebookPen,
  PenLine,
  ShieldCheck,
  SprayCan,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  addMonthsKey,
  CLEANING_KIND_INFO,
  CLEANING_KINDS,
  monthLabel,
  NOT_DONE_REASON_LABEL,
  percent,
  shortDay,
  timeInSaoPaulo,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  type CalendarDay,
  type CalendarWeek,
  type CleaningKind,
} from "@/lib/facilities/cleaning";
import { cleaningApi, openIssuePhoto } from "@/lib/facilities/cleaning-client";
import type { CleaningCheck, CleaningDayRecord, CleaningIssue, CleaningMonthView } from "@/lib/facilities/cleaning-server";
import { FACILITIES_MAINTENANCE_PATH } from "@/lib/facilities/types";
import { cn } from "@/lib/utils";
import { Segmented } from "./form-parts";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import { AreaTile, DARK_HERO, GOLD, GoldRingAvatar, KindLegend, KindLetter } from "./cleaning-visuals";
import { GuiaLimpeza } from "./guia-limpeza";

type DayState = "fora" | "antes" | "feriado" | "futuro" | "sem_limpeza" | "assinado" | "encerrado" | "andamento" | "nao_encerrado" | "sem_marcacao";

const DAY_STATE: Record<DayState, { label: string; className: string }> = {
  fora: { label: "", className: "text-muted-foreground" },
  antes: { label: "Planilha", className: "bg-slate-50 text-slate-500" },
  feriado: { label: "Feriado", className: "bg-slate-100 text-slate-600" },
  futuro: { label: "A fazer", className: "bg-slate-50 text-slate-500" },
  sem_limpeza: {
    label: "Sem limpeza",
    className: "bg-slate-100 text-slate-600",
  },
  assinado: { label: "Assinado", className: "bg-[#e8f8f8] text-[#13676a]" },
  encerrado: { label: "Conferir", className: "bg-amber-50 text-amber-800" },
  andamento: {
    label: "Em andamento",
    className: "bg-[#e3f0f6] text-[#1f5a78]",
  },
  nao_encerrado: {
    label: "Não encerrado",
    className: "bg-amber-50 text-amber-800",
  },
  sem_marcacao: { label: "Sem marcações", className: "bg-red-50 text-red-700" },
};

interface DayInfo {
  day: CalendarDay;
  week: CalendarWeek;
  state: DayState;
  record: CleaningDayRecord | null;
  checks: Map<string, CleaningCheck>;
  expected: number;
  done: number;
  notDone: number;
}

function buildDays(view: CleaningMonthView): Map<string, DayInfo> {
  const records = new Map(view.days.map((d) => [d.day, d]));
  const checksByDay = new Map<string, Map<string, CleaningCheck>>();
  for (const check of view.checks) {
    const map = checksByDay.get(check.day) ?? new Map<string, CleaningCheck>();
    map.set(check.area_id, check);
    checksByDay.set(check.day, map);
  }
  const areaIds = new Set(view.areas.map((a) => a.id));
  const result = new Map<string, DayInfo>();
  for (const week of view.weeks) {
    for (const day of week.days) {
      const record = records.get(day.iso) ?? null;
      const checks = checksByDay.get(day.iso) ?? new Map<string, CleaningCheck>();
      const relevant = [...checks.values()].filter((c) => areaIds.has(c.area_id));
      const done = relevant.filter((c) => c.status === "limpo").length;
      const notDone = relevant.filter((c) => c.status === "nao_limpo").length;
      let state: DayState;
      if (!day.inMonth) state = "fora";
      else if (day.holiday) state = "feriado";
      else if (day.iso < view.startedOn && !record && !relevant.length) state = "antes";
      else if (record?.no_cleaning_reason) state = "sem_limpeza";
      else if (record?.reviewed_at) state = "assinado";
      else if (day.iso > view.today) state = "futuro";
      else if (record?.closed_at) state = "encerrado";
      else if (relevant.length) state = day.iso === view.today ? "andamento" : "nao_encerrado";
      else state = day.iso === view.today ? "andamento" : "sem_marcacao";
      result.set(day.iso, {
        day,
        week,
        state,
        record,
        checks,
        expected: day.business ? view.areas.length : 0,
        done,
        notDone,
      });
    }
  }
  return result;
}

function kindFor(view: CleaningMonthView, areaId: string, week: CalendarWeek, weekday: number): CleaningKind | null {
  return view.schedule[`${areaId}:${week.scheduleWeek}:${weekday}`] ?? null;
}

/* ------------------------------------------------------------------ ficha do dia */

function DayDialog({
  info,
  view,
  onClose,
  onChange,
}: {
  info: DayInfo;
  view: CleaningMonthView;
  onClose: () => void;
  onChange: (next: CleaningMonthView) => void;
}) {
  const [result, setResult] = useState<"ok" | "ressalvas">("ok");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"normal" | "reabrir" | "sem_limpeza">("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { day, week, record } = info;
  const issues = view.issues.filter((i) => i.day === day.iso);
  const signed = Boolean(record?.reviewed_at);
  const noCleaning = Boolean(record?.no_cleaning_reason);
  const canAct = day.business && day.iso <= view.today;
  // Hoje só se assina depois que a equipe encerrar (assinar trava a lista dela).
  const canSign = canAct && (day.iso < view.today || Boolean(record?.closed_at));

  async function act(body: Parameters<typeof cleaningApi.dayAction>[1]) {
    setBusy(true);
    setError(null);
    try {
      onChange(await cleaningApi.dayAction(day.iso, body));
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl" showCloseButton={!busy}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-lg">
            {WEEKDAY_LONG[day.weekday]}, {shortDay(day.iso)}
          </DialogTitle>
          <DialogDescription>
            {week.weekOfMonth}ª semana do mês
            {week.scheduleWeek !== week.weekOfMonth ? ` (cronograma da ${week.scheduleWeek}ª)` : ""} · {info.done} de {info.expected} limpos
            {info.notDone ? `, ${info.notDone} não deu` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-1.5 text-sm">
            <p className="flex items-center gap-2">
              {record?.closed_at && record.closed_by_name ? (
                <Avatar name={record.closed_by_name} avatar={record.closed_by_avatar} className="size-7" />
              ) : (
                <ClipboardCheck className="size-4 text-[#3e84a8]" aria-hidden />
              )}
              {record?.closed_at
                ? `Encerrado por ${record.closed_by_name ?? "—"} às ${timeInSaoPaulo(record.closed_at)}`
                : day.iso < view.today
                  ? "A equipe não encerrou o dia"
                  : "Ainda não encerrado"}
            </p>
            {record?.close_note && <p className="rounded-md bg-[#f2f8f9] px-3 py-2 text-foreground">“{record.close_note}”</p>}
            {noCleaning && (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-slate-700 ring-1 ring-inset ring-slate-200">Sem limpeza: {record?.no_cleaning_reason}</p>
            )}
          </div>

          {!noCleaning && (
            <ul className="divide-y divide-[#eef3f5] rounded-md ring-1 ring-[#e6eef0]">
              {view.areas.map((area) => {
                const check = info.checks.get(area.id);
                return (
                  <li key={area.id} className="flex items-center gap-3 px-3 py-2">
                    <KindLetter kind={check?.kind ?? kindFor(view, area.id, week, day.weekday)} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{area.name}</span>
                    {check?.status === "limpo" ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-[#13676a]">
                        <CheckCircle2 className="size-4" aria-hidden />
                        {timeInSaoPaulo(check.checked_at)}
                      </span>
                    ) : check?.status === "nao_limpo" ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-amber-800" title={check.note ?? undefined}>
                        <XCircle className="size-4" aria-hidden />
                        {check.reason ? NOT_DONE_REASON_LABEL[check.reason] : "Não deu"}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">Sem marcação</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {issues.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">Avisos do dia</p>
              {issues.map((issue) => (
                <p key={issue.id} className="text-sm text-foreground">
                  {issue.area_name ? `${issue.area_name}: ` : ""}
                  {issue.description}
                </p>
              ))}
            </div>
          )}

          {signed ? (
            <div className="space-y-2 rounded-lg bg-[#e8f8f8] p-4 ring-1 ring-inset ring-[#8edfe1]">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#13676a]">
                <ShieldCheck className="size-4" aria-hidden />
                Assinado por {record?.reviewed_by_name} em{" "}
                {record?.reviewed_at ? `${shortDay(record.reviewed_at.slice(0, 10))} às ${timeInSaoPaulo(record.reviewed_at)}` : ""}
              </p>
              <p className="text-sm text-[#13676a]">{record?.review_result === "ressalvas" ? "Com ressalvas" : "Tudo certo"}</p>
              {record?.review_note && <p className="whitespace-pre-line text-sm text-foreground">{record.review_note}</p>}
            </div>
          ) : (
            canAct &&
            !noCleaning &&
            mode === "normal" &&
            !canSign && (
              <p className="flex items-start gap-2 rounded-lg bg-[#f7fbfc] p-4 text-sm text-[#3b5560] ring-1 ring-inset ring-[#e6eef0]">
                <PenLine className="mt-0.5 size-4 shrink-0 text-[#3e84a8]" aria-hidden />A conferência e a assinatura de hoje ficam liberadas quando a equipe
                encerrar o dia. Assinar trava a lista dela.
              </p>
            )
          )}
          {!signed && canSign && !noCleaning && mode === "normal" && (
            <div className="space-y-3 rounded-lg bg-[#f7fbfc] p-4 ring-1 ring-inset ring-[#e6eef0]">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PenLine className="size-4 text-[#3e84a8]" aria-hidden />
                Conferir e assinar o dia
              </p>
              <Segmented<"ok" | "ressalvas">
                label="Resultado da conferência"
                value={result}
                options={[
                  { value: "ok", label: "Tudo certo" },
                  { value: "ressalvas", label: "Com ressalvas" },
                ]}
                onChange={setResult}
              />
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Anotações sobre a limpeza do dia (opcional)"
                aria-label="Anotações do dia"
              />
            </div>
          )}

          {(mode === "reabrir" || mode === "sem_limpeza") && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {mode === "reabrir" ? "Por que reabrir o dia?" : "Por que não teve limpeza? (ex.: falta, evento)"}
              </p>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} aria-label="Motivo" />
            </div>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e6eef0] px-6 py-3">
          <div className="flex gap-2">
            {canAct && !signed && mode === "normal" && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                disabled={busy}
                onClick={() => (noCleaning ? void act({ action: "com_limpeza" }) : setMode("sem_limpeza"))}
              >
                {noCleaning ? "Voltar a ter limpeza" : "Marcar sem limpeza"}
              </Button>
            )}
            {signed && mode === "normal" && (
              <Button type="button" variant="ghost" className="text-muted-foreground" disabled={busy} onClick={() => setMode("reabrir")}>
                Reabrir o dia
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {mode !== "normal" ? (
              <>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setMode("normal")}>
                  Voltar
                </Button>
                <Button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void act({ action: mode, reason: reason.trim() })}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {mode === "reabrir" ? "Reabrir" : "Marcar sem limpeza"}
                </Button>
              </>
            ) : (
              canSign &&
              !signed &&
              !noCleaning && (
                <Button type="button" disabled={busy} onClick={() => void act({ action: "assinar", result, note })}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  <ShieldCheck className="size-4" />
                  Assinar o dia
                </Button>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ avisos */

/** Miniatura da foto do aviso (URL assinada, carregada quando a linha aparece). */
function IssueThumb({ issueId, onError }: { issueId: string; onError: (message: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    cleaningApi
      .photoUrl(issueId)
      .then((value) => alive && setUrl(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [issueId]);
  return (
    <button
      type="button"
      aria-label="Abrir a foto do aviso"
      onClick={() => openIssuePhoto(issueId).catch((e) => onError(e.message))}
      className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#eef5f7] text-[#7b929c] ring-1 ring-inset ring-[#dce9eb] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do bucket privado
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-5" aria-hidden />
      )}
    </button>
  );
}

function IssueRow({ issue, month, onChange }: { issue: CleaningIssue; month: string; onChange: (next: CleaningMonthView) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "resolver" | "reabrir" | "manutencao") {
    setBusy(action);
    setError(null);
    try {
      onChange(await cleaningApi.issueAction(issue.id, action === "resolver" ? { action, note: "", month } : { action, month }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  }

  const open = issue.status === "aberto";
  return (
    <li className="flex gap-3 px-4 py-3.5">
      {issue.has_photo ? (
        <IssueThumb issueId={issue.id} onError={setError} />
      ) : issue.area_name ? (
        <AreaTile name={issue.area_name} size="lg" className={open ? "bg-amber-50 text-amber-700" : undefined} />
      ) : (
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700">
          <MessageSquareWarning className="size-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#0d2a38]">
          {issue.area_name && <span className="font-semibold">{issue.area_name}: </span>}
          {issue.description}
        </p>
        <p className="mt-0.5 text-xs text-[#5a717b]">
          {shortDay(issue.day)} às {timeInSaoPaulo(issue.created_at)} · {issue.reported_by_name ?? "—"}
          {issue.status === "resolvido" && ` · resolvido por ${issue.resolved_by_name ?? "—"}`}
          {issue.status === "manutencao" && " · virou manutenção corretiva"}
        </p>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {open ? (
            <>
              <Button type="button" size="sm" className="h-8 gap-1" disabled={Boolean(busy)} onClick={() => void act("resolver")}>
                {busy === "resolver" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Resolvido
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1" disabled={Boolean(busy)} onClick={() => void act("manutencao")}>
                {busy === "manutencao" ? <Loader2 className="size-3.5 animate-spin" /> : <Wrench className="size-3.5" />}
                Virar manutenção
              </Button>
            </>
          ) : issue.status === "manutencao" && issue.maintenance_plan_id ? (
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[#285f7a]">
              <Link href={`${FACILITIES_MAINTENANCE_PATH}?plano=${issue.maintenance_plan_id}`}>
                Ver a manutenção
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[#5a717b]" disabled={Boolean(busy)} onClick={() => void act("reabrir")}>
              Reabrir
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ peças da tela */

const SURFACE = "rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.05)]";

function StatTile({ icon: Icon, tone, value, label, detail }: { icon: LucideIcon; tone: string; value: ReactNode; label: string; detail?: ReactNode }) {
  return (
    <div className={cn(SURFACE, "flex min-h-[88px] items-center gap-4 px-4 py-3.5")}>
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold leading-none tabular-nums text-[#0d2a38]">{value}</span>
        <span className="mt-1.5 block text-sm text-[#3b5560]">{label}</span>
        {detail && <span className="mt-0.5 block truncate text-xs text-[#5a717b]">{detail}</span>}
      </span>
    </div>
  );
}

function Avatar({ name, avatar, className }: { name: string; avatar: string | null; className?: string }) {
  return <EmployeeAvatar name={name} avatarUrl={avatar} className={cn("size-6", className)} fallbackClassName="bg-[#e8f1f5] text-[#315f73]" />;
}

/* ------------------------------------------------------------------ tela */

export function LimpezaAcompanhamentoClient({ initialView, guideSeen }: { initialView: CleaningMonthView; guideSeen: boolean }) {
  const [view, setView] = useState(initialView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const days = useMemo(() => buildDays(view), [view]);
  const currentWeekIndex = Math.max(
    0,
    view.weeks.findIndex((w) => w.days.some((d) => d.iso === view.today))
  );
  const [weekIndex, setWeekIndex] = useState(currentWeekIndex);
  const week = view.weeks[Math.min(weekIndex, view.weeks.length - 1)];
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState(false);
  const isCurrentMonth = view.month === view.today.slice(0, 7);

  async function goMonth(delta: number) {
    setLoading(true);
    setError(null);
    try {
      const next = await cleaningApi.month(addMonthsKey(view.month, delta));
      setView(next);
      const index = next.weeks.findIndex((w) => w.days.some((d) => d.iso === next.today));
      setWeekIndex(index >= 0 ? index : 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o mês.");
    } finally {
      setLoading(false);
    }
  }

  // Números do mês (do primeiro dia no sistema até hoje).
  const stats = useMemo(() => {
    const past = [...days.values()].filter((d) => d.day.business && d.day.iso <= view.today && d.state !== "sem_limpeza" && d.state !== "antes");
    const expected = past.reduce((sum, d) => sum + d.expected, 0);
    const done = past.reduce((sum, d) => sum + d.done, 0);
    const notDone = past.reduce((sum, d) => sum + d.notDone, 0);
    const signed = past.filter((d) => d.state === "assinado").length;
    const toReview = past.filter((d) => d.state === "encerrado" || ((d.state === "nao_encerrado" || d.state === "sem_marcacao") && d.day.iso < view.today));
    const byArea = view.areas
      .map((area) => ({
        area,
        done: past.filter((d) => d.checks.get(area.id)?.status === "limpo").length,
        total: past.length,
      }))
      .sort((a, b) => percent(a.done, a.total) - percent(b.done, b.total) || a.area.name.localeCompare(b.area.name, "pt-BR"));
    const kindDone = Object.fromEntries(CLEANING_KINDS.map((k) => [k, 0])) as Record<CleaningKind, number>;
    for (const d of past) for (const c of d.checks.values()) if (c.status === "limpo" && c.kind) kindDone[c.kind] += 1;
    const reasons = new Map<string, number>();
    for (const d of past) for (const c of d.checks.values()) if (c.status === "nao_limpo" && c.reason) reasons.set(c.reason, (reasons.get(c.reason) ?? 0) + 1);
    const topReason = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0];
    const minutes = (iso: string) => {
      const [h, m] = timeInSaoPaulo(iso).split(":").map(Number);
      return h * 60 + m;
    };
    const starts = past.flatMap((d) => {
      const times = [...d.checks.values()].map((c) => minutes(c.checked_at));
      return times.length ? [Math.min(...times)] : [];
    });
    const ends = past.flatMap((d) => (d.record?.closed_at ? [minutes(d.record.closed_at)] : []));
    const avg = (list: number[]) => {
      if (!list.length) return null;
      const value = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
      return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
    };
    return {
      daysCount: past.length,
      expected,
      done,
      notDone,
      signed,
      toReview,
      byArea,
      kindDone,
      topReason,
      start: avg(starts),
      end: avg(ends),
    };
  }, [days, view]);

  const openIssues = view.issues.filter((i) => i.status === "aberto");
  const otherIssues = view.issues.filter((i) => i.status !== "aberto" && i.day.slice(0, 7) === view.month);
  const todayInfo = days.get(view.today);
  const todayFirst = todayInfo ? [...todayInfo.checks.values()].map((c) => c.checked_at).sort()[0] : undefined;
  const noteValue = week ? (noteDraft[week.monday] ?? view.weekNotes[week.monday]?.note ?? "") : "";
  const noteChanged = week ? noteValue !== (view.weekNotes[week.monday]?.note ?? "") : false;
  const cleaner = view.team[0];
  const todayProgress = todayInfo && todayInfo.expected ? Math.round(((todayInfo.done + todayInfo.notDone) / todayInfo.expected) * 100) : 0;

  async function saveNote() {
    if (!week) return;
    setSavingNote(true);
    setError(null);
    try {
      setView(await cleaningApi.weekNote(week.monday, noteValue, view.month));
      setNoteDraft((d) => {
        const next = { ...d };
        delete next[week.monday];
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a anotação.");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Topo: quem limpa e como está hoje. */}
      <section data-tour="topo" className="relative overflow-hidden rounded-xl bg-[#03070c] text-[#f9f9f9]">
        <div aria-hidden className={cn("absolute inset-0", DARK_HERO)} />
        <div className="relative px-5 pb-6 pt-4 sm:px-8 sm:pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="-ml-2 flex items-center gap-1">
              <button
                type="button"
                aria-label="Mês anterior"
                disabled={loading}
                onClick={() => void goMonth(-1)}
                className="grid size-8 place-items-center rounded-md text-white/80 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="min-w-40 text-center text-sm text-white/80">
                {loading ? <Loader2 className="mx-auto size-4 animate-spin" /> : monthLabel(view.month).replace(/^./, (c) => c.toUpperCase())}
              </p>
              <button
                type="button"
                aria-label="Próximo mês"
                disabled={loading}
                onClick={() => void goMonth(1)}
                className="grid size-8 place-items-center rounded-md text-white/80 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <GuiaLimpeza guide="limpeza-acompanhamento" seen={guideSeen} canManage tone="dark" />
          </div>
          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-5">
              {cleaner ? (
                <GoldRingAvatar name={cleaner.name} avatar={cleaner.avatar} className="size-20 sm:size-24" />
              ) : (
                <span className="grid size-20 place-items-center rounded-full bg-white/10 sm:size-24">
                  <SprayCan className="size-8" style={{ color: GOLD }} aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-2xl font-semibold leading-tight sm:text-[28px]">
                  {cleaner ? (
                    <>
                      Limpeza com <span style={{ color: GOLD }}>{cleaner.name.trim().split(/\s+/)[0]}</span>
                    </>
                  ) : (
                    "Limpeza do escritório"
                  )}
                </p>
                {isCurrentMonth && todayInfo?.day.business ? (
                  <p className="mt-1.5 text-[15px] text-white/85">
                    Hoje: {todayInfo.done + todayInfo.notDone} de {todayInfo.expected} ambientes
                    {todayFirst ? ` · começou às ${timeInSaoPaulo(todayFirst)}` : " · ainda não começou"}
                    {todayInfo.record?.closed_at ? ` · encerrou às ${timeInSaoPaulo(todayInfo.record.closed_at)}` : ""}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[15px] text-white/85">{stats.daysCount} dias úteis acompanhados no mês</p>
                )}
                {isCurrentMonth && todayInfo?.day.business && (
                  <div className="mt-3 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${todayProgress}%`,
                        backgroundColor: GOLD,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            {isCurrentMonth && todayInfo?.day.business && (
              <div data-tour="botoes-hoje" className="flex flex-col items-stretch gap-2 lg:w-56">
                {todayInfo.state === "assinado" ? (
                  <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-4 py-3 text-sm font-semibold text-white">
                    <ShieldCheck className="size-[18px]" style={{ color: GOLD }} aria-hidden />
                    Hoje está assinado
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenDay(view.today)}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#f9f9f9] px-4 text-sm font-semibold text-[#04202f] outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                  >
                    <PenLine className="size-[18px]" aria-hidden />
                    {todayInfo.state === "encerrado" ? "Conferir e assinar hoje" : "Ver o dia de hoje"}
                  </button>
                )}
                <Link
                  href="/limpeza"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                >
                  <ListChecks className="size-[18px]" aria-hidden />
                  Lista que ela vê
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <CircleAlert className="size-4" />
          {error}
        </p>
      )}

      <div data-tour="numeros" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={SprayCan}
          tone="bg-[#e3f7f7] text-[#13676a]"
          value={`${percent(stats.done, stats.expected)}%`}
          label="dos ambientes limpos no mês"
          detail={`${stats.done} de ${stats.expected} em ${stats.daysCount} ${stats.daysCount === 1 ? "dia útil" : "dias úteis"}`}
        />
        <StatTile
          icon={ShieldCheck}
          tone="bg-[#eeedf5] text-[#48466e]"
          value={
            <>
              {stats.signed}
              <span className="text-base font-normal text-[#5a717b]"> de {stats.daysCount}</span>
            </>
          }
          label="dias conferidos e assinados"
          detail={stats.toReview.length ? <span className="text-amber-700">{stats.toReview.length} para conferir</span> : "nada pendente"}
        />
        <StatTile
          icon={XCircle}
          tone="bg-amber-50 text-amber-700"
          value={stats.notDone}
          label="vezes que não deu para limpar"
          detail={
            stats.topReason ? `mais comum: ${NOT_DONE_REASON_LABEL[stats.topReason[0] as keyof typeof NOT_DONE_REASON_LABEL].toLowerCase()}` : "nenhuma no mês"
          }
        />
        <StatTile
          icon={MessageSquareWarning}
          tone={openIssues.length ? "bg-rose-50 text-rose-700" : "bg-[#eef3f5] text-[#3b5560]"}
          value={openIssues.length}
          label="avisos em aberto"
          detail={stats.start ? `começa ~${stats.start}${stats.end ? ` · encerra ~${stats.end}` : ""}` : "sem marcações ainda"}
        />
      </div>

      {stats.toReview.length > 0 && (
        <section data-tour="para-conferir" aria-labelledby="para-conferir" className="space-y-2.5">
          <h2 id="para-conferir" className="flex items-baseline gap-2 text-base font-semibold text-[#0d2a38]">
            Dias para conferir
            <span className="rounded-full bg-amber-100 px-2 py-px text-xs font-semibold text-amber-800">{stats.toReview.length}</span>
          </h2>
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {stats.toReview.map((info) => (
              <li key={info.day.iso} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenDay(info.day.iso)}
                  className={cn(
                    SURFACE,
                    "flex min-w-44 flex-col items-start gap-1 px-4 py-3 text-left outline-none transition-shadow hover:shadow-[0_6px_18px_rgba(4,32,47,0.08)] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                  )}
                >
                  <span className="text-sm font-semibold text-[#0d2a38]">
                    {WEEKDAY_SHORT[info.day.weekday]} {shortDay(info.day.iso)}
                  </span>
                  <span className="text-xs text-[#5a717b]">
                    {info.done} de {info.expected} limpos
                  </span>
                  <span className={cn("mt-1 rounded-full px-2 py-0.5 text-xs font-medium", DAY_STATE[info.state].className)}>
                    {info.state === "encerrado" && info.record?.closed_at
                      ? `Encerrado às ${timeInSaoPaulo(info.record.closed_at)}`
                      : DAY_STATE[info.state].label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {week && (
        <section aria-labelledby="semana" className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 id="semana" className="text-base font-semibold text-[#0d2a38]">
              Semana a semana
            </h2>
            <KindLegend className="mr-auto" />
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Semanas do mês">
              {view.weeks.map((w, index) => {
                const business = w.days.filter((d) => d.business);
                return (
                  <button
                    key={w.monday}
                    type="button"
                    role="tab"
                    aria-selected={index === weekIndex}
                    onClick={() => setWeekIndex(index)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[13px] outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                      index === weekIndex ? "bg-[#347796] font-semibold text-white ring-[#347796]" : "bg-white text-[#3b5560] ring-[#dce9eb] hover:bg-[#f6fafb]"
                    )}
                  >
                    {w.weekOfMonth}ª · {shortDay(business[0].iso)}–{shortDay(business.at(-1)!.iso)}
                  </button>
                );
              })}
            </div>
          </div>
          {week.scheduleWeek !== week.weekOfMonth && (
            <p className="text-xs text-[#5a717b]">
              Esta é a {week.weekOfMonth}ª semana do mês: segue o cronograma da {week.scheduleWeek}ª.
            </p>
          )}

          <div data-tour="semana" className={cn(SURFACE, "overflow-x-auto")}>
            <table className="w-full min-w-[680px] border-collapse text-sm sm:min-w-[760px]">
              <thead>
                <tr className="border-b border-[#e6eef0]">
                  <th scope="col" className="sticky left-0 z-10 w-40 bg-white px-3 py-3 text-left text-xs font-medium text-[#5a717b] sm:w-64 sm:px-4">
                    Ambiente
                  </th>
                  {week.days.map((d) => {
                    const info = days.get(d.iso)!;
                    const state = DAY_STATE[info.state];
                    const isToday = d.iso === view.today;
                    return (
                      <th key={d.iso} scope="col" className={cn("px-1.5 py-2 text-center align-top", isToday && "bg-[#f2f8f9]")}>
                        <button
                          type="button"
                          disabled={!d.inMonth || d.holiday || info.state === "antes"}
                          onClick={() => setOpenDay(d.iso)}
                          className="w-full rounded-md px-1 py-1 outline-none transition-colors hover:bg-[#eef5f7] focus-visible:ring-2 focus-visible:ring-[#47cdd0] disabled:cursor-default disabled:hover:bg-transparent"
                        >
                          <span className={cn("block text-xs", isToday ? "font-semibold text-[#285f7a]" : "font-medium text-[#3b5560]")}>
                            {isToday ? "Hoje" : WEEKDAY_SHORT[d.weekday]}
                          </span>
                          <span className="block text-sm font-semibold tabular-nums text-[#0d2a38]">{shortDay(d.iso)}</span>
                          <span className="mt-1 flex items-center justify-center gap-1">
                            {info.state === "assinado" && info.record?.reviewed_by_name && (
                              <Avatar name={info.record.reviewed_by_name} avatar={info.record.reviewed_by_avatar} className="size-5" />
                            )}
                            {state.label && <span className={cn("rounded-full px-1.5 py-px text-xs", state.className)}>{state.label}</span>}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3f5]">
                {view.areas.map((area) => (
                  <tr key={area.id} className="transition-colors hover:bg-[#fafcfd]">
                    <th scope="row" className="sticky left-0 z-10 max-w-40 bg-white px-3 py-2 text-left sm:max-w-64 sm:px-4">
                      <span className="flex items-center gap-2.5">
                        <AreaTile name={area.name} size="sm" className="hidden sm:grid" />
                        <span className="truncate font-medium text-[#0d2a38]">{area.name}</span>
                      </span>
                    </th>
                    {week.days.map((d) => {
                      const info = days.get(d.iso)!;
                      const isToday = d.iso === view.today;
                      if (!d.business || info.state === "sem_limpeza" || info.state === "antes") {
                        return (
                          <td key={d.iso} className={cn("px-1.5 py-2 text-center text-xs text-[#a8bac1]", isToday && "bg-[#f2f8f9]")}>
                            —
                          </td>
                        );
                      }
                      const check = info.checks.get(area.id);
                      const kind = check?.kind ?? kindFor(view, area.id, week, d.weekday);
                      const title =
                        check?.status === "limpo"
                          ? `Limpo às ${timeInSaoPaulo(check.checked_at)}`
                          : check?.status === "nao_limpo"
                            ? `Não deu: ${check.reason ? NOT_DONE_REASON_LABEL[check.reason] : ""}${check.note ? ` (${check.note})` : ""}`
                            : kind
                              ? `Previsto: limpeza ${CLEANING_KIND_INFO[kind].label.toLowerCase()}`
                              : undefined;
                      return (
                        <td key={d.iso} className={cn("px-1.5 py-1.5", isToday && "bg-[#f2f8f9]")} title={title}>
                          <span className="flex items-center justify-center gap-1.5">
                            <KindLetter kind={kind} size="sm" muted={!check && d.iso > view.today} />
                            {check?.status === "limpo" ? (
                              <span className="inline-flex items-center gap-1 text-xs tabular-nums text-[#13676a]">
                                <CheckCircle2 className="size-4" aria-label="Limpo" />
                                {timeInSaoPaulo(check.checked_at)}
                              </span>
                            ) : check?.status === "nao_limpo" ? (
                              <XCircle className="size-4 text-amber-600" aria-label="Não deu" />
                            ) : d.iso <= view.today ? (
                              <CircleDashed className="size-4 text-[#c3d2d8]" aria-label="Sem marcação" />
                            ) : null}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div data-tour="anotacoes-semana" className={cn(SURFACE, "p-4")}>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#0d2a38]">
              <NotebookPen className="size-4 text-[#3e84a8]" aria-hidden />
              Anotações da semana
            </p>
            <Textarea
              value={noteValue}
              onChange={(e) => setNoteDraft((d) => ({ ...d, [week.monday]: e.target.value }))}
              rows={3}
              placeholder="Como foi a limpeza nesta semana? Combinados, pontos de atenção…"
              aria-label="Anotações da semana"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-[#5a717b]">
                {view.weekNotes[week.monday]
                  ? `Salvo por ${view.weekNotes[week.monday].updated_by_name ?? "—"} em ${shortDay(view.weekNotes[week.monday].updated_at.slice(0, 10))}`
                  : ""}
              </p>
              <Button type="button" size="sm" disabled={!noteChanged || savingNote} onClick={() => void saveNote()}>
                {savingNote && <Loader2 className="size-3.5 animate-spin" />}
                Salvar anotação
              </Button>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section data-tour="avisos" aria-labelledby="avisos" className={cn(SURFACE, "overflow-hidden")}>
          <div className="flex items-center gap-2 border-b border-[#e6eef0] px-4 py-3">
            <MessageSquareWarning className="size-4 text-amber-600" aria-hidden />
            <h2 id="avisos" className="text-base font-semibold text-[#0d2a38]">
              Avisos da limpeza
            </h2>
            {openIssues.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-px text-xs font-semibold text-amber-800">{openIssues.length} em aberto</span>
            )}
          </div>
          {openIssues.length + otherIssues.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-[#e3f7f7] text-[#13676a]">
                <CheckCircle2 className="size-5" aria-hidden />
              </span>
              <p className="text-sm text-[#5a717b]">Nenhum aviso neste mês. Quando a equipe avisar um problema, ele aparece aqui com a foto.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#eef3f5]">
              {[...openIssues, ...otherIssues].map((issue) => (
                <IssueRow key={issue.id} issue={issue} month={view.month} onChange={setView} />
              ))}
            </ul>
          )}
        </section>

        <section data-tour="por-ambiente" aria-labelledby="por-ambiente" className={cn(SURFACE, "p-4")}>
          <h2 id="por-ambiente" className="text-base font-semibold text-[#0d2a38]">
            Por ambiente no mês
          </h2>
          <p className="mb-3 text-xs text-[#5a717b]">Os que mais ficaram para trás aparecem primeiro.</p>
          <ul className="space-y-2">
            {stats.byArea.map(({ area, done, total }) => (
              <li key={area.id} className="grid grid-cols-[minmax(0,1fr)_minmax(5rem,8rem)_2.75rem] items-center gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <AreaTile name={area.name} size="sm" className="size-7 [&_svg]:size-3.5" />
                  <span className="truncate text-[#0d2a38]">{area.name}</span>
                </span>
                <span className="h-2 rounded-full bg-[#eef3f5]" aria-hidden>
                  <span className="block h-full rounded-full bg-[#3e84a8]" style={{ width: `${percent(done, total)}%` }} />
                </span>
                <span className="text-right text-xs tabular-nums text-[#5a717b]">{total ? `${percent(done, total)}%` : "—"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-[#eef3f5] pt-3">
            <p className="mb-2 text-xs font-medium text-[#5a717b]">Limpezas feitas no mês, por tipo</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CLEANING_KINDS.map((kind) => (
                <li key={kind} className="flex items-center gap-2.5 rounded-md bg-[#f7fbfc] px-2.5 py-2">
                  <KindLetter kind={kind} size="md" />
                  <span>
                    <span className="block text-lg font-semibold leading-none tabular-nums text-[#0d2a38]">{stats.kindDone[kind]}</span>
                    <span className="mt-0.5 block text-xs text-[#5a717b]">{CLEANING_KIND_INFO[kind].label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {openDay && days.get(openDay) && <DayDialog info={days.get(openDay)!} view={view} onClose={() => setOpenDay(null)} onChange={setView} />}
    </div>
  );
}
