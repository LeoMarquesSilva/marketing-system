"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleCheckBig,
  Compass,
  DownloadCloud,
  Flag,
  Handshake,
  Hourglass,
  Loader2,
  MessageSquareText,
  PencilLine,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { dueLabel, isStale, todayInBrasilia } from "@/lib/rh/pdi/progress";
import {
  PDI_LEARNING_KINDS,
  PDI_LEARNING_KIND_ORDER,
  type PdiAction,
  type PdiActivity,
  type PdiGoal,
  type PdiPerson,
  type PdiPlanDetail,
  type PdiStatus,
  type PdiType,
} from "@/lib/rh/pdi/types";
import { cn } from "@/lib/utils";
import { ActionDialog } from "./action-dialog";
import { PlanEditorDialog } from "./plan-editor-dialog";
import {
  BODY,
  CivilSeal,
  GOLD,
  INK,
  KIND_STYLES,
  KindIcon,
  MUTED,
  PersonPhoto,
  ProgressBar,
  SURFACE,
  formatDate,
  kindIconOf,
  relativeDays,
} from "./pdi-visuals";

/* ------------------------------------------------------------------- topo */

const HERO_CHIP = "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-white/85";
const HERO_BUTTON =
  "inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-[#47cdd0] disabled:opacity-60";

const DUE_ON_DARK: Record<PdiPlanDetail["due_state"], string> = {
  em_dia: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/25",
  vence_em_breve: "bg-amber-400/15 text-amber-200 ring-amber-300/30",
  atrasado: "bg-red-400/15 text-red-200 ring-red-300/30",
  concluido: "bg-white/10 text-white/85 ring-white/20",
  cancelado: "bg-white/10 text-white/70 ring-white/20",
};

function firstName(person: PdiPerson): string {
  return person.name.split(" ")[0] ?? person.name;
}

function PlanHero({
  plan,
  stale,
  agreeing,
  agreeError,
  onAgree,
  onEdit,
  onStatus,
}: {
  plan: PdiPlanDetail;
  stale: boolean;
  agreeing: boolean;
  agreeError: string | null;
  onAgree: () => void;
  onEdit: () => void;
  onStatus: (status: PdiStatus) => void;
}) {
  const mine = plan.viewer_role === "dono";
  return (
    <section className="relative overflow-hidden rounded-xl bg-[#03070c] text-[#f9f9f9]">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_140%_at_85%_0%,#0b3a52_0%,#04202f_42%,#03070c_100%)]" />
      <div className="relative grid gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <PersonPhoto
            person={plan.employee}
            size="lg"
            className="size-20 text-xl ring-2 ring-[#E1B16D] ring-offset-4 ring-offset-[#04202f] sm:size-24"
          />
          <div className="min-w-0">
            <p className="text-sm text-white/75">
              {mine ? "Seu plano de desenvolvimento" : `Plano de desenvolvimento de ${firstName(plan.employee)}`}
              {!mine && plan.employee.position ? ` · ${plan.employee.position}` : ""}
            </p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight sm:text-[28px]">{plan.title}</h2>
            <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
              {plan.type_name && (
                <span className={HERO_CHIP}>
                  <Sparkles className="size-4" style={{ color: GOLD }} aria-hidden />
                  {plan.type_name}
                </span>
              )}
              <span className={HERO_CHIP}>
                <CalendarDays className="size-4" style={{ color: GOLD }} aria-hidden />
                <span className="tabular-nums">
                  {formatDate(plan.start_date)} a {formatDate(plan.due_date)}
                </span>
              </span>
              {plan.origin === "feedz" && (
                <span className={HERO_CHIP}>
                  <DownloadCloud className="size-4" style={{ color: GOLD }} aria-hidden />
                  Trazido do Feedz
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/12 bg-white/[0.05] p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="leading-none">
              <span className="text-5xl font-semibold tabular-nums" style={{ color: GOLD }}>
                {plan.progress}
              </span>
              <span className="ml-0.5 text-2xl text-white/70">%</span>
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                DUE_ON_DARK[plan.due_state]
              )}
            >
              <Flag className="size-3" aria-hidden />
              {dueLabel(plan.days_left, plan.status)}
            </span>
          </div>
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={plan.progress}
            aria-label="Progresso do plano"
          >
            <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${plan.progress}%`, background: GOLD }} />
          </div>
          <p className="mt-3 text-sm text-white/80">
            <span className="font-semibold text-white">{plan.actions_done}</span> de {plan.actions_total} ações concluídas
          </p>
          {(stale || plan.actions_overdue > 0) && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-200">
              <Hourglass className="size-3.5" aria-hidden />
              {plan.actions_overdue > 0
                ? `${plan.actions_overdue} ${plan.actions_overdue === 1 ? "ação com prazo vencido" : "ações com prazo vencido"}`
                : plan.last_update_at
                  ? `Sem atualização ${relativeDays(plan.last_update_at)}`
                  : "Nenhuma atualização registrada"}
            </p>
          )}
        </div>
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-5 py-4 sm:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
          {plan.manager ? (
            <div className="flex items-center gap-3">
              <PersonPhoto person={plan.manager} size="sm" className="ring-1 ring-white/20" />
              <div className="text-sm leading-tight">
                <p className="text-xs text-white/65">Acompanhado por</p>
                <p className="font-medium text-white">{plan.manager.name}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/65">Sem gestor acompanhando</p>
          )}
          {plan.agreed_at ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-200">
              <Handshake className="size-4" aria-hidden />
              De acordo{plan.agreed_by_name ? ` · ${plan.agreed_by_name.split(" ")[0]}` : ""} em {formatDate(plan.agreed_at)}
            </span>
          ) : (
            plan.status === "ativo" &&
            !plan.permissions.canAgree && (
              <span className="inline-flex items-center gap-1.5 text-sm text-white/65">
                <Handshake className="size-4" aria-hidden />
                Aguardando o de acordo do gestor
              </span>
            )
          )}
          {agreeError && <span className="text-xs text-red-200">{agreeError}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.permissions.canAgree && (
            <button
              type="button"
              onClick={onAgree}
              disabled={agreeing}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-[#0D1E2E] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
              style={{ background: GOLD }}
            >
              {agreeing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Handshake className="size-4" aria-hidden />}
              Estou de acordo
            </button>
          )}
          {plan.permissions.canEdit && (
            <button type="button" onClick={onEdit} className={HERO_BUTTON}>
              <PencilLine className="size-4" aria-hidden />
              Editar plano
            </button>
          )}
          {plan.permissions.canChangeStatus && plan.status === "ativo" && (
            <button type="button" onClick={() => onStatus("concluido")} className={HERO_BUTTON}>
              <CircleCheckBig className="size-4" aria-hidden />
              Concluir
            </button>
          )}
          {plan.permissions.canChangeStatus && plan.status !== "ativo" && (
            <button type="button" onClick={() => onStatus("ativo")} className={HERO_BUTTON}>
              <RotateCcw className="size-4" aria-hidden />
              Reabrir
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ frentes */

function ActionRow({ action, onOpen }: { action: PdiAction; onOpen: () => void }) {
  const done = action.progress >= 100;
  const kind = action.learning_kind ? PDI_LEARNING_KINDS[action.learning_kind] : null;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3.5 rounded-md px-2 py-3 text-left outline-none transition-colors hover:bg-[#f4fafb] focus-visible:bg-[#f4fafb] focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
      >
        <KindIcon kind={action.learning_kind} className="size-9 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm font-medium leading-snug", done ? MUTED : INK)}>{action.title}</span>
          <span className={cn("mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs", MUTED)}>
            {kind && <span>{kind.label}</span>}
            {action.due_date && (
              <span className={cn(action.overdue && "font-medium text-red-700")}>
                {action.overdue ? "venceu em" : "até"} {formatDate(action.due_date)}
              </span>
            )}
            {!done && action.last_update_at && <span>atualizada {relativeDays(action.last_update_at)}</span>}
          </span>
        </span>
        {done ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="size-4" aria-hidden />
            <span className="hidden sm:inline">{action.completed_at ? formatDate(action.completed_at) : "Concluída"}</span>
          </span>
        ) : (
          <span className="flex w-24 shrink-0 items-center gap-2 sm:w-32">
            <ProgressBar value={action.progress} size="sm" tone={action.overdue ? "late" : "default"} />
            <span className={cn("w-9 text-right text-xs font-semibold tabular-nums", INK)}>{action.progress}%</span>
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-[#7b929c] transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
    </li>
  );
}

function GoalCard({ goal, onOpenAction }: { goal: PdiGoal; onOpenAction: (action: PdiAction) => void }) {
  const [expanded, setExpanded] = useState(false);
  const done = goal.actions.filter((action) => action.progress >= 100).length;
  const long = (goal.description ?? "").length > 220;
  return (
    <section className={cn(SURFACE, "overflow-hidden")}>
      <header className="flex flex-col gap-4 bg-[#f7fafb] px-5 py-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 gap-4">
          <CivilSeal competency={goal.competency} className="size-14" />
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs font-semibold", goal.competency ? "text-[#48466e]" : MUTED)}>
              {goal.competency ?? "Frente de desenvolvimento"}
            </p>
            <h3 className={cn("mt-0.5 text-base font-semibold leading-snug", INK)}>{goal.title}</h3>
            {goal.description && (
              <div className="mt-1.5">
                <p className={cn("whitespace-pre-line text-sm leading-6", BODY, !expanded && long && "line-clamp-2")}>{goal.description}</p>
                {long && (
                  <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className="mt-0.5 text-xs font-semibold text-[#347796] outline-none hover:underline focus-visible:underline"
                  >
                    {expanded ? "Mostrar menos" : "Ler tudo"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="w-full shrink-0 space-y-2 sm:w-44">
          <div className="flex items-baseline justify-between gap-2 sm:justify-end sm:gap-3">
            <span className={cn("text-xs sm:order-first", MUTED)}>
              {done} de {goal.actions.length} {goal.actions.length === 1 ? "ação" : "ações"}
            </span>
            <span className={cn("text-2xl font-semibold leading-none tabular-nums", goal.progress >= 100 ? "text-emerald-700" : INK)}>
              {goal.progress}
              <span className={cn("text-base font-normal", MUTED)}>%</span>
            </span>
          </div>
          <ProgressBar value={goal.progress} tone={goal.progress >= 100 ? "done" : "default"} label={`Progresso de ${goal.title}`} />
        </div>
      </header>
      <ul className="divide-y divide-[#e6eff1] border-t border-[#e6eff1] px-5 py-1">
        {goal.actions.map((action) => (
          <ActionRow key={action.id} action={action} onOpen={() => onOpenAction(action)} />
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------- coluna */

/** Próxima ação: vencida primeiro, depois a de prazo mais perto, depois a mais adiantada. */
function pickNextAction(plan: PdiPlanDetail): { action: PdiAction; goal: PdiGoal } | null {
  const open = plan.goals.flatMap((goal) => goal.actions.filter((action) => action.progress < 100).map((action) => ({ action, goal })));
  if (open.length === 0) return null;
  return open.sort((a, b) => {
    if (a.action.overdue !== b.action.overdue) return a.action.overdue ? -1 : 1;
    const dueA = a.action.due_date ?? "9999";
    const dueB = b.action.due_date ?? "9999";
    if (dueA !== dueB) return dueA.localeCompare(dueB);
    return b.action.progress - a.action.progress;
  })[0];
}

function NextStep({
  plan,
  onOpen,
  onConclude,
}: {
  plan: PdiPlanDetail;
  onOpen: (action: PdiAction) => void;
  onConclude: () => void;
}) {
  const next = pickNextAction(plan);
  return (
    <section className={cn(SURFACE, "p-5")}>
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e6f0f5] text-[#285f7a]">
          <TrendingUp className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className={cn("text-base font-semibold", INK)}>Próximo passo</h2>
          <p className={cn("text-xs", MUTED)}>{next ? "A ação que mais pede atenção agora" : "Todas as ações chegaram a 100%"}</p>
        </div>
      </header>
      {next ? (
        <button
          type="button"
          onClick={() => onOpen(next.action)}
          className="group mt-4 block w-full rounded-lg border border-[#dce9eb] bg-[#f7fafb] p-4 text-left outline-none transition-colors hover:border-[#47cdd0]/60 hover:bg-[#f4fafb] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
        >
          <span className={cn("block text-xs", MUTED)}>{next.goal.title}</span>
          <span className={cn("mt-1 block text-sm font-semibold leading-snug", INK)}>{next.action.title}</span>
          <span className="mt-3 flex items-center gap-2">
            <ProgressBar value={next.action.progress} size="sm" tone={next.action.overdue ? "late" : "default"} />
            <span className={cn("w-9 text-right text-xs font-semibold tabular-nums", INK)}>{next.action.progress}%</span>
          </span>
          {plan.permissions.canUpdateProgress && (
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#347796] group-hover:underline">
              Atualizar progresso
              <ArrowRight className="size-3.5" aria-hidden />
            </span>
          )}
        </button>
      ) : (
        plan.permissions.canChangeStatus &&
        plan.status === "ativo" && (
          <Button className="mt-4 w-full" onClick={onConclude}>
            <CircleCheckBig className="size-4" aria-hidden />
            Concluir o plano
          </Button>
        )
      )}
    </section>
  );
}

function LearningMix({ plan }: { plan: PdiPlanDetail }) {
  const total = plan.actions_total;
  const rows = PDI_LEARNING_KIND_ORDER.map((kind) => ({ kind, count: plan.kinds[kind] }));
  return (
    <section className={cn(SURFACE, "p-5")}>
      <header>
        <h2 className={cn("text-base font-semibold", INK)}>Como você aprende</h2>
        <p className={cn("text-xs", MUTED)}>Mistura das ações no modelo 70-20-10</p>
      </header>
      <ul className="mt-4 space-y-3.5">
        {rows.map(({ kind, count }) => {
          const Icon = kindIconOf(kind);
          const share = total ? Math.round((count / total) * 100) : 0;
          return (
            <li key={kind} className="flex items-center gap-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", KIND_STYLES[kind].tile)}>
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-sm", INK)}>{PDI_LEARNING_KINDS[kind].label}</span>
                  <span className={cn("shrink-0 text-xs tabular-nums", MUTED)}>
                    <span className={cn("font-semibold", INK)}>{share}%</span> · ideal {PDI_LEARNING_KINDS[kind].share}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e3edf0]">
                  <div className={cn("h-full rounded-full", KIND_STYLES[kind].bar)} style={{ width: `${share}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {plan.kinds.sem > 0 && (
        <p className={cn("mt-4 text-xs", MUTED)}>
          {plan.kinds.sem} {plan.kinds.sem === 1 ? "ação ainda não tem" : "ações ainda não têm"} tipo definido.
        </p>
      )}
    </section>
  );
}

function activityText(item: PdiActivity): string {
  switch (item.kind) {
    case "progresso":
      return item.progress_from !== item.progress_to
        ? `levou ${item.action_title ? `"${item.action_title}"` : "uma ação"} de ${item.progress_from}% para ${item.progress_to}%`
        : `registrou avanço em ${item.action_title ? `"${item.action_title}"` : "uma ação"}`;
    case "comentario":
      return item.action_title ? `comentou em "${item.action_title}"` : "comentou";
    case "acordo":
      return "deu o de acordo com o plano";
    case "criacao":
      return "criou o plano";
    case "edicao":
      return "editou o plano";
    case "status":
      return item.body ?? "mudou o status";
  }
}

function Timeline({ plan, onUpdated }: { plan: PdiPlanDetail; onUpdated: (plan: PdiPlanDetail) => void }) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = plan.activity.slice(0, 30);

  async function send() {
    if (!comment.trim()) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/pdi/${plan.id}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível comentar.");
      setComment("");
      onUpdated(body.plan as PdiPlanDetail);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível comentar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={cn(SURFACE, "p-5")} aria-labelledby="pdi-timeline">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#ecebf3] text-[#48466e]">
          <MessageSquareText className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="pdi-timeline" className={cn("text-base font-semibold", INK)}>
            Acompanhamento
          </h2>
          <p className={cn("text-xs", MUTED)}>Conversas e avanços do plano</p>
        </div>
      </header>
      {plan.permissions.canComment && (
        <div className="mt-4 space-y-2">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder={plan.viewer_role === "dono" ? "Conte como está indo ou peça ajuda ao seu gestor." : `Deixe um retorno para ${firstName(plan.employee)}.`}
            aria-label="Comentário no plano"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
            <Button size="sm" onClick={send} disabled={sending || !comment.trim()}>
              {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              Comentar
            </Button>
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <p className={cn("mt-4 text-sm", MUTED)}>Nenhuma atualização ainda.</p>
      ) : (
        <ol className="mt-5 space-y-0">
          {items.map((item, index) => (
            <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
              {index < items.length - 1 && <span className="absolute bottom-0 left-[13px] top-8 w-px bg-[#dce9eb]" aria-hidden />}
              {item.author_name ? (
                <PersonPhoto person={{ name: item.author_name, avatar_url: item.author_avatar_url }} size="xs" className="mt-0.5 size-7" />
              ) : (
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[#eef6f8] text-[#285f7a]" aria-hidden>
                  <DownloadCloud className="size-3.5" />
                </span>
              )}
              <div className="min-w-0 text-sm">
                <p className={INK}>
                  {item.author_name ? (
                    <>
                      <span className="font-semibold">{item.author_name.split(" ")[0]}</span> {activityText(item)}
                    </>
                  ) : item.kind === "criacao" ? (
                    "Plano trazido do Feedz"
                  ) : (
                    activityText(item)
                  )}
                </p>
                {item.body && item.author_name && item.kind !== "status" && item.kind !== "acordo" && (
                  <p
                    className={cn(
                      "mt-1.5 whitespace-pre-line",
                      item.kind === "comentario" ? cn("rounded-lg bg-[#f4f9fa] px-3 py-2", INK) : BODY
                    )}
                  >
                    {item.body}
                  </p>
                )}
                <p className={cn("mt-1 text-xs", MUTED)}>
                  {item.author_name ? relativeDays(item.created_at) : `início do plano em ${formatDate(item.created_at)}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ status */

function StatusDialog({
  plan,
  target,
  onClose,
  onDone,
}: {
  plan: PdiPlanDetail;
  target: PdiStatus | "excluir";
  onClose: () => void;
  onDone: (plan: PdiPlanDetail | null) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = {
    concluido: {
      title: "Concluir o PDI",
      text:
        plan.progress < 100
          ? `O plano está em ${plan.progress}%. Ao concluir, ele sai dos ativos e fica no histórico.`
          : "Todas as ações chegaram a 100%. O plano vai para o histórico.",
      button: "Concluir",
    },
    cancelado: { title: "Cancelar o PDI", text: "Use quando o plano deixou de fazer sentido (troca de área, saída etc.).", button: "Cancelar plano" },
    ativo: { title: "Reabrir o PDI", text: "O plano volta para os ativos e pode ser editado de novo.", button: "Reabrir" },
    excluir: { title: "Excluir o PDI", text: "Apaga o plano, as ações e o histórico. Não dá para desfazer.", button: "Excluir" },
  }[target];

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const response =
        target === "excluir"
          ? await fetch(`/api/pdi/${plan.id}`, { method: "DELETE" })
          : await fetch(`/api/pdi/${plan.id}/status`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: target, note: note.trim() || null }),
            });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível concluir a ação.");
      onDone(target === "excluir" ? null : (body.plan as PdiPlanDetail));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a ação.");
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg" showCloseButton={!busy}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-lg">{copy.title}</DialogTitle>
          <DialogDescription>{copy.text}</DialogDescription>
        </DialogHeader>
        {target !== "excluir" && (
          <div className="px-6 py-5">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder={target === "concluido" ? "Fechamento: o que mudou, próximos passos (opcional)." : "Motivo (opcional)."}
              aria-label="Observação"
            />
          </div>
        )}
        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-[#e6eef0] px-6 py-4 sm:justify-between">
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Voltar
            </Button>
            <Button variant={target === "excluir" || target === "cancelado" ? "destructive" : "default"} onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {copy.button}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------- plano */

export function PlanView({
  plan: initialPlan,
  types,
  managerOptions,
}: {
  plan: PdiPlanDetail;
  types: PdiType[];
  managerOptions?: PdiPerson[];
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [statusTarget, setStatusTarget] = useState<PdiStatus | "excluir" | null>(null);
  const [agreeing, setAgreeing] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);
  const stale = isStale(plan, todayInBrasilia());
  const openAction = useMemo(
    () => plan.goals.flatMap((goal) => goal.actions).find((action) => action.id === openActionId) ?? null,
    [plan, openActionId]
  );

  function refresh(next: PdiPlanDetail) {
    setPlan(next);
    router.refresh();
  }

  async function agree() {
    setAgreeing(true);
    setAgreeError(null);
    try {
      const response = await fetch(`/api/pdi/${plan.id}/acordo`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar.");
      refresh(body.plan as PdiPlanDetail);
    } catch (caught) {
      setAgreeError(caught instanceof Error ? caught.message : "Não foi possível registrar.");
    } finally {
      setAgreeing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PlanHero
        plan={plan}
        stale={stale}
        agreeing={agreeing}
        agreeError={agreeError}
        onAgree={agree}
        onEdit={() => setEditing(true)}
        onStatus={setStatusTarget}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {plan.career_goal && (
            <section className="flex gap-3.5 rounded-lg border border-[#e8dcc4] bg-[#fbf7ef] px-5 py-4">
              <Compass className="mt-0.5 size-5 shrink-0" style={{ color: "#b58a45" }} aria-hidden />
              <div>
                <p className="text-xs font-semibold text-[#8a6a35]">Onde quero chegar</p>
                <p className={cn("mt-0.5 whitespace-pre-line text-[15px] leading-6", INK)}>{plan.career_goal}</p>
              </div>
            </section>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={cn("text-base font-semibold", INK)}>Frentes de desenvolvimento</h2>
            <p className={cn("text-xs", MUTED)}>
              {plan.goals.length} {plan.goals.length === 1 ? "frente" : "frentes"} · {plan.actions_total}{" "}
              {plan.actions_total === 1 ? "ação" : "ações"}
            </p>
          </div>
          {plan.goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onOpenAction={(action) => setOpenActionId(action.id)} />
          ))}

          {(plan.permissions.canChangeStatus || plan.permissions.canDelete) && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {plan.permissions.canChangeStatus && plan.status === "ativo" && (
                <Button variant="ghost" size="sm" onClick={() => setStatusTarget("cancelado")}>
                  <XCircle className="size-4" aria-hidden />
                  Cancelar plano
                </Button>
              )}
              {plan.permissions.canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => setStatusTarget("excluir")}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Excluir
                </Button>
              )}
              <p className={cn("ml-auto text-xs", MUTED)}>
                {plan.origin === "feedz"
                  ? `Trazido do Feedz em ${formatDate(plan.created_at)}`
                  : `Criado ${plan.created_by_name ? `por ${plan.created_by_name} ` : ""}em ${formatDate(plan.created_at)}`}
              </p>
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          {plan.status === "ativo" && (
            <NextStep plan={plan} onOpen={(action) => setOpenActionId(action.id)} onConclude={() => setStatusTarget("concluido")} />
          )}
          <LearningMix plan={plan} />
          <Timeline plan={plan} onUpdated={refresh} />
        </aside>
      </div>

      {openAction && <ActionDialog plan={plan} action={openAction} onClose={() => setOpenActionId(null)} onSaved={refresh} />}
      {editing && (
        <PlanEditorDialog
          plan={plan}
          people={[plan.employee]}
          managerOptions={plan.viewer_role === "dono" ? undefined : managerOptions}
          types={types}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setEditing(false);
            refresh(next);
          }}
        />
      )}
      {statusTarget && (
        <StatusDialog
          plan={plan}
          target={statusTarget}
          onClose={() => setStatusTarget(null)}
          onDone={(next) => {
            setStatusTarget(null);
            if (next) refresh(next);
            else router.push(plan.viewer_role === "rh" ? "/rh/pdi" : "/pdi");
          }}
        />
      )}
    </div>
  );
}
