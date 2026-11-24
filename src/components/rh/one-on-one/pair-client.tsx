"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarDays, CalendarPlus, Check, ExternalLink, ListChecks, Repeat, type LucideIcon } from "lucide-react";
import { InfoTooltip, TooltipProvider } from "@/components/ui/tooltip";
import type { OneOnOneAction, OneOnOnePairDetail } from "@/lib/rh/one-on-one/types";
import { cn } from "@/lib/utils";
import { InlineDelete } from "../form-controls";
import { PersonPhoto, formatDate } from "../pdi/pdi-visuals";
import { MeetingCard } from "./meeting-card";
import { formatDayLong, formatTime } from "./one-on-one-visuals";
import { ScheduleDialog } from "./schedule-dialog";

const FREQUENCY_LABEL = { semanal: "Toda semana", quinzenal: "A cada 15 dias", mensal: "Todo mês" } as const;
const CARD = "rounded-2xl border border-[#e1ebee] bg-white shadow-[0_1px_3px_rgba(4,32,47,0.05)]";
const INK = "text-[#0d2a38]";
const MUTED = "text-[#5a717b]";

/** Anel de progresso (PDI) no topo da dupla. */
function ProgressRing({ value }: { value: number | null }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const progress = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <span className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 60 60" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="30" cy="30" r={radius} fill="none" stroke="#e3eef0" strokeWidth="6" />
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="none"
          stroke="url(#pdi-ring)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
        />
        <defs>
          <linearGradient id="pdi-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2bb3b1" />
            <stop offset="100%" stopColor="#0f5f70" />
          </linearGradient>
        </defs>
      </svg>
      <span className={cn("relative text-sm font-semibold tabular-nums", INK)}>{value === null ? "—" : `${progress}%`}</span>
    </span>
  );
}

function StatCard({ icon: Icon, label, value, children }: { icon: LucideIcon; label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-[#e3ecef] bg-white px-4 py-3.5">
      <Icon className="mt-0.5 size-5 shrink-0 text-[#1d7086]" aria-hidden />
      <div className="min-w-0">
        <p className={cn("text-sm", MUTED)}>{label}</p>
        <p className={cn("text-xl font-semibold leading-tight", INK)}>{value}</p>
        {children && <div className={cn("mt-0.5 flex flex-wrap items-center gap-1.5 text-xs", MUTED)}>{children}</div>}
      </div>
    </div>
  );
}

function SideCard({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className={cn(CARD, "p-5")}>
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eaf4f6] text-[#1d7086]">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className={cn("text-lg font-semibold leading-tight", INK)}>{title}</h2>
          <p className={cn("text-sm", MUTED)}>{subtitle}</p>
        </div>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PairClient({ initial, me }: { initial: OneOnOnePairDetail; me: string | null }) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const [scheduling, setScheduling] = useState(false);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [actionsTab, setActionsTab] = useState<"abertas" | "feitas">("abertas");
  const [actionError, setActionError] = useState<string | null>(null);
  const { summary } = detail;
  const leader = summary.leader;
  const member = summary.member;

  const reload = useCallback(
    async (message?: string | null) => {
      if (message) setWarning(message);
      const response = await fetch(`/api/1-1/dupla/${leader.id}/${member.id}`);
      if (response.ok) setDetail((await response.json()) as OneOnOnePairDetail);
      router.refresh();
    },
    [leader.id, member.id, router]
  );

  /** Chama a API das ações e, se falhar, mostra o motivo no quadro (nada de falha silenciosa). */
  async function actionRequest(url: string, init: RequestInit, failure: string) {
    setActionError(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? failure);
      }
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error && caught.message !== "Failed to fetch" ? caught.message : failure);
    }
  }

  function toggleAction(action: OneOnOneAction) {
    return actionRequest(
      `/api/1-1/acoes/${action.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !action.done_at }) },
      action.done_at ? "Não foi possível reabrir a ação." : "Não foi possível concluir a ação."
    );
  }

  function removeAction(action: OneOnOneAction) {
    return actionRequest(`/api/1-1/acoes/${action.id}`, { method: "DELETE" }, "Não foi possível excluir a ação.");
  }

  const upcoming = detail.meetings.filter((meeting) => meeting.status === "agendada").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const others = detail.meetings.filter((meeting) => meeting.status !== "agendada");
  const openActions = detail.actions.filter((action) => !action.done_at);
  const doneActions = detail.actions.filter((action) => action.done_at);
  const shownActions = actionsTab === "abertas" ? openActions : doneActions;
  const isParticipant = summary.viewer_role !== "rh";
  const meetingToReschedule = detail.meetings.find((meeting) => meeting.id === rescheduling);
  const cadence =
    summary.cadence === "em_dia"
      ? { label: "em dia", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" }
      : summary.cadence === "atrasada"
        ? { label: "atrasada", className: "bg-red-50 text-red-700 ring-red-600/15" }
        : { label: "sem 1:1 ainda", className: "bg-[#f1f5f6] text-[#5a717b] ring-[#cfdadd]" };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Topo da dupla */}
        <section className={cn(CARD, "relative overflow-hidden")}>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 -top-40 h-80 w-[44rem] rounded-full bg-[radial-gradient(closest-side,#dcf1f1,rgba(220,241,241,0))]"
          />
          <div className="relative grid gap-6 px-6 pb-4 pt-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5 xl:border-r xl:border-[#e6eef0] xl:pr-6">
              <div className="flex shrink-0 items-center">
                <PersonPhoto person={leader} size="lg" className="size-14 ring-4 ring-white sm:size-20 xl:size-24" />
                <PersonPhoto person={member} size="lg" className="-ml-4 size-14 ring-2 ring-[#E1B16D] ring-offset-[3px] ring-offset-white sm:-ml-5 sm:size-20 xl:size-24" />
              </div>
              <div className="min-w-0">
                <h1 className={cn("text-xl font-semibold leading-tight sm:text-2xl xl:text-[28px]", INK)}>
                  {leader.name.split(" ")[0]} <span className="font-normal text-[#5a717b]">e</span> <span className="text-[#1d7086]">{member.name}</span>
                </h1>
                <p className={cn("mt-1 flex flex-wrap items-center gap-x-2 text-sm sm:text-[15px]", MUTED)}>
                  {[member.position, member.department].filter(Boolean).map((item, index) => (
                    <span key={item} className="inline-flex items-center gap-2">
                      {index > 0 && <span className="size-1 rounded-full bg-[#9fb1b8]" aria-hidden />}
                      {item}
                    </span>
                  ))}
                </p>
                {summary.next_meeting && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#eaf4f6] px-2.5 py-1 text-xs font-medium text-[#1d5670]">
                    <CalendarClock className="size-3.5" aria-hidden />
                    Próxima: <span className="first-letter:uppercase">{formatDayLong(summary.next_meeting.starts_at)}</span>, {formatTime(summary.next_meeting.starts_at)}
                    {summary.next_meeting.room ? ` · ${summary.next_meeting.room}` : ""}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[44rem]">
              <StatCard icon={CalendarDays} label="Frequência" value={summary.days_since_last === null ? "Sem 1:1" : `${summary.days_since_last} dias`}>
                {summary.days_since_last !== null && <span>desde a última</span>}
                <span className={cn("rounded-full px-1.5 py-px font-medium ring-1 ring-inset", cadence.className)}>{cadence.label}</span>
              </StatCard>
              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e3ecef] bg-white px-4 py-2.5">
                <ProgressRing value={summary.pdi ? summary.pdi.progress : null} />
                <div className="min-w-0">
                  <p className={cn("font-semibold", INK)}>PDI</p>
                  <p className={cn("text-xs", summary.pdi?.overdue_actions ? "font-medium text-red-700" : MUTED)}>
                    {!summary.pdi
                      ? "Sem PDI ativo"
                      : summary.pdi.overdue_actions
                        ? `${summary.pdi.overdue_actions} ${summary.pdi.overdue_actions === 1 ? "ação vencida" : "ações vencidas"}`
                        : "sem ações vencidas"}
                  </p>
                </div>
              </div>
              <StatCard icon={ListChecks} label="Ações combinadas" value={`${openActions.length} em aberto`}>
                <span>
                  {doneActions.length} {doneActions.length === 1 ? "concluída" : "concluídas"}
                </span>
              </StatCard>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3 px-6 pb-6">
            {summary.pdi ? (
              <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:max-w-xl sm:flex-1">
                <span className={cn("inline-flex shrink-0 items-center gap-1 text-sm", MUTED)}>
                  Progresso do PDI
                  <InfoTooltip
                    title="Progresso do PDI"
                    description="Progresso de cada frente = média das suas ações. Progresso do PDI = média das frentes. Frente sem ação não entra na conta; as casas decimais são descartadas."
                  />
                </span>
                <span className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-[#e6eef0]">
                  <span className="block h-full rounded-full bg-[linear-gradient(90deg,#2bb3b1,#0f6f80)]" style={{ width: `${summary.pdi.progress}%` }} />
                </span>
                <span className={cn("shrink-0 text-base font-semibold tabular-nums", INK)}>{summary.pdi.progress}%</span>
              </div>
            ) : (
              <p className={cn("w-full text-sm sm:w-auto sm:flex-1", MUTED)}>Sem PDI ativo para acompanhar nas 1:1.</p>
            )}
            <div className="flex w-full flex-wrap gap-2.5 sm:ml-auto sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
              {summary.pdi && (
                <Link
                  href={`/pdi/${summary.pdi.id}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d5e3e7] bg-white px-5 text-sm font-semibold text-[#1d5670] outline-none transition-colors hover:border-[#47cdd0]/70 hover:bg-[#f4fafb] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Ver PDI
                </Link>
              )}
              {detail.permissions.canSchedule && (
                <button
                  type="button"
                  onClick={() => setScheduling(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0f5f70] px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#0c5262] focus-visible:ring-2 focus-visible:ring-[#47cdd0] focus-visible:ring-offset-2"
                >
                  <CalendarPlus className="size-4" aria-hidden />
                  Marcar 1:1
                </button>
              )}
            </div>
          </div>
        </section>

        {warning && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{warning}</p>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className={cn("text-lg font-semibold", INK)}>Próximas reuniões</h2>
                {upcoming.map((meeting, index) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    leader={leader}
                    member={member}
                    me={me}
                    defaultOpen={index === 0}
                    onChanged={reload}
                    onReschedule={() => setRescheduling(meeting.id)}
                  />
                ))}
              </section>
            )}
            <section className="space-y-3">
              <h2 className={cn("text-lg font-semibold", INK)}>Histórico de reuniões</h2>
              {others.length === 0 ? (
                <p className={cn(CARD, "px-5 py-10 text-center text-sm", MUTED)}>Nenhuma 1:1 realizada ainda.</p>
              ) : (
                others.map((meeting, index) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    leader={leader}
                    member={member}
                    me={me}
                    defaultOpen={upcoming.length === 0 && index === 0}
                    onChanged={reload}
                    onReschedule={() => setRescheduling(meeting.id)}
                  />
                ))
              )}
            </section>
          </div>

          <aside className="min-w-0 space-y-5 xl:sticky xl:top-4 xl:self-start">
            <SideCard icon={ListChecks} title="Ações combinadas" subtitle="As tarefas entram como sugestão na próxima pauta.">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#f1f5f6] p-1" role="tablist" aria-label="Ações combinadas">
                {(
                  [
                    ["abertas", `Em andamento (${openActions.length})`],
                    ["feitas", `Concluídas (${doneActions.length})`],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={actionsTab === id}
                    onClick={() => setActionsTab(id)}
                    className={cn(
                      "rounded-lg px-2 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                      actionsTab === id ? "bg-white font-semibold text-[#0f5f70] shadow-[0_1px_2px_rgba(4,32,47,0.08),inset_0_0_0_1px_#9fd9da]" : "text-[#5a717b] hover:text-[#0d2a38]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {actionError && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {actionError}
                </p>
              )}
              {shownActions.length === 0 ? (
                <p className={cn("py-6 text-center text-sm", MUTED)}>{actionsTab === "abertas" ? "Nenhuma ação em andamento." : "Nenhuma ação concluída."}</p>
              ) : (
                <ul className="mt-2 divide-y divide-[#eef3f5]">
                  {shownActions.map((action) => (
                    <li key={action.id} className="group flex items-start gap-3 py-3.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={Boolean(action.done_at)}
                        disabled={!isParticipant}
                        onClick={() => toggleAction(action)}
                        aria-label={action.done_at ? "Reabrir ação" : "Concluir ação"}
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60 disabled:cursor-default",
                          action.done_at ? "border-[#1d7086] bg-[#1d7086] text-white" : "border-[#b9c8cd] bg-white hover:border-[#47cdd0]"
                        )}
                      >
                        {action.done_at && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[15px] leading-snug", action.done_at ? "text-[#5a717b] line-through" : INK)}>{action.title}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={cn("flex min-w-0 items-center gap-2 text-sm", MUTED)}>
                            {action.owner && <PersonPhoto person={action.owner} size="xs" />}
                            <span className="truncate">{action.owner?.name.split(" ")[0] ?? "Sem responsável"}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
                                action.overdue ? "border-red-200 bg-red-50 font-medium text-red-700" : "border-[#e1ebee] text-[#5a717b]"
                              )}
                            >
                              <CalendarDays className="size-3.5" aria-hidden />
                              {action.done_at ? `feita em ${formatDate(action.done_at)}` : action.due_date ? `até ${formatDate(action.due_date)}` : "Sem prazo"}
                            </span>
                            {isParticipant && (
                              <InlineDelete
                                label="Excluir ação"
                                question="Excluir?"
                                idleClassName="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                                onConfirm={() => removeAction(action)}
                              />
                            )}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SideCard>

            <SideCard icon={Repeat} title="Recorrência" subtitle="Mantém as 1:1 marcadas sem esquecer.">
              {detail.series.length === 0 ? (
                <div className="flex items-start gap-3 rounded-xl bg-[#eef7f7] p-4">
                  <CalendarDays className="mt-0.5 size-5 shrink-0 text-[#1d7086]" aria-hidden />
                  <div>
                    <p className={cn("font-semibold", INK)}>Sem recorrência</p>
                    <p className={cn("text-sm", MUTED)}>Ao marcar uma 1:1, escolha &quot;Repetir&quot; para manter encontros recorrentes.</p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {detail.series.map((series) => (
                    <li key={series.id} className="flex items-start gap-3 rounded-xl bg-[#eef7f7] p-4">
                      <Repeat className="mt-0.5 size-5 shrink-0 text-[#1d7086]" aria-hidden />
                      <div>
                        <p className={cn("font-semibold", INK)}>
                          {FREQUENCY_LABEL[series.frequency]} às {series.start_time}
                        </p>
                        <p className={cn("text-sm", MUTED)}>
                          até {formatDate(series.ends_on)}
                          {series.category ? ` · ${series.category}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {detail.permissions.canSchedule && (
                <button
                  type="button"
                  onClick={() => setScheduling(true)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#d5e3e7] bg-white text-sm font-semibold text-[#1d5670] outline-none transition-colors hover:border-[#47cdd0]/70 hover:bg-[#f4fafb] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                >
                  <CalendarPlus className="size-4" aria-hidden />
                  {detail.series.length ? "Nova recorrência" : "Configurar recorrência"}
                </button>
              )}
            </SideCard>
          </aside>
        </div>

        {scheduling && (
          <ScheduleDialog
            pairs={[{ leader, member, label: `${leader.name} e ${member.name}` }]}
            initialPair={{ leaderId: leader.id, memberId: member.id }}
            onClose={() => setScheduling(false)}
            onDone={(message) => {
              setScheduling(false);
              reload(message);
            }}
          />
        )}
        {meetingToReschedule && (
          <ScheduleDialog
            pairs={[{ leader, member, label: `${leader.name} e ${member.name}` }]}
            initialPair={{ leaderId: leader.id, memberId: member.id }}
            reschedule={{
              meetingId: meetingToReschedule.id,
              starts_at: meetingToReschedule.starts_at,
              ends_at: meetingToReschedule.ends_at,
              room_key: meetingToReschedule.room?.key ?? null,
            }}
            onClose={() => setRescheduling(null)}
            onDone={(message) => {
              setRescheduling(null);
              reload(message);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
