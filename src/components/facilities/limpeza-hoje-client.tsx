"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  Camera,
  Check,
  CheckCheck,
  CircleAlert,
  ClipboardCheck,
  Loader2,
  MessageSquareWarning,
  PartyPopper,
  ShieldCheck,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CLEANING_KIND_INFO,
  CLEANING_KINDS,
  dayStats,
  isoWeekday,
  NOT_DONE_REASON_LABEL,
  NOT_DONE_REASONS,
  timeInSaoPaulo,
  WEEKDAY_LONG,
  type NotDoneReason,
} from "@/lib/facilities/cleaning";
import { cleaningApi, openIssuePhoto, sendCleaningIssue } from "@/lib/facilities/cleaning-client";
import type { CleaningDayView } from "@/lib/facilities/cleaning-server";
import { cn } from "@/lib/utils";
import { AreaTile, DARK_HERO, GOLD, GoldRingAvatar, KindBadge, KindLetter } from "./cleaning-visuals";
import { GuiaLimpeza } from "./guia-limpeza";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function longDate(iso: string): string {
  const weekday = isoWeekday(iso);
  const name = weekday <= 5 ? WEEKDAY_LONG[weekday] : weekday === 6 ? "Sábado" : "Domingo";
  return `${name}, ${Number(iso.slice(8, 10))} de ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
}

type Area = CleaningDayView["areas"][number];

/** Motivo de não ter limpado: botões grandes, sem lista suspensa. */
function NotDoneDialog({
  area,
  busy,
  onCancel,
  onSave,
}: {
  area: Area;
  busy: boolean;
  onCancel: () => void;
  onSave: (reason: NotDoneReason, note: string) => void;
}) {
  const [reason, setReason] = useState<NotDoneReason | null>(null);
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-lg">Não deu para limpar</DialogTitle>
          <DialogDescription>{area.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Motivo">
            {NOT_DONE_REASONS.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={reason === key}
                onClick={() => setReason(key)}
                className={cn(
                  "min-h-14 rounded-lg px-3 py-2 text-left text-sm font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                  reason === key ? "bg-[#347796] text-white ring-[#347796]" : "bg-white text-foreground ring-[#dce9eb] hover:bg-[#f6fafb]"
                )}
              >
                {NOT_DONE_REASON_LABEL[key]}
              </button>
            ))}
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Quer explicar? (opcional)" aria-label="Observação" />
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Voltar
          </Button>
          <Button type="button" disabled={!reason || busy} onClick={() => reason && onSave(reason, note)}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Avisar um problema: onde, o que aconteceu e uma foto (opcional). */
function IssueDialog({ day, areas, onCancel, onSent }: { day: string; areas: Area[]; onCancel: () => void; onSent: (view: CleaningDayView) => void }) {
  // undefined = ainda não escolheu; null = "Outro lugar".
  const [areaId, setAreaId] = useState<string | null | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function choosePhoto(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function send() {
    if (description.trim().length < 3) return setError("Conte o que aconteceu.");
    setBusy(true);
    setError(null);
    try {
      onSent(await sendCleaningIssue({ day, areaId: areaId ?? null, description: description.trim(), photo }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar.");
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-lg">Avisar um problema</DialogTitle>
          <DialogDescription>Falta de material, algo quebrado, vazamento… Vai direto para Facilities.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Onde?</p>
            <div className="flex flex-wrap gap-1.5">
              {[...areas.map((a) => ({ id: a.id as string | null, name: a.name })), { id: null, name: "Outro lugar" }].map((option) => (
                <button
                  key={option.id ?? "outro"}
                  type="button"
                  aria-pressed={areaId === option.id}
                  onClick={() => setAreaId(option.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                    areaId === option.id ? "bg-[#347796] text-white ring-[#347796]" : "bg-white text-foreground ring-[#dce9eb] hover:bg-[#f6fafb]"
                  )}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">O que aconteceu?</p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Ex.: acabou o papel toalha do banheiro de cima"
              aria-label="O que aconteceu"
            />
          </div>
          <div>
            <input
              ref={input}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <div className="relative overflow-hidden rounded-lg ring-1 ring-[#dce9eb]">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local da foto, antes de subir */}
                <img src={preview} alt="Foto do problema" className="max-h-56 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => choosePhoto(null)}
                  aria-label="Tirar a foto"
                  className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-foreground shadow"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="h-12 w-full gap-2" onClick={() => input.current?.click()}>
                <Camera className="size-5" />
                Tirar foto (opcional)
              </Button>
            )}
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy} onClick={() => void send()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Enviar aviso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Resumo antes de encerrar o dia. */
function CloseDialog({ view, busy, onCancel, onConfirm }: { view: CleaningDayView; busy: boolean; onCancel: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState("");
  const stats = dayStats(
    view.areas.map((a) => a.id),
    view.areas.flatMap((a) => (a.check ? [{ day: view.day, area_id: a.id, status: a.check.status, checked_at: a.check.checked_at }] : []))
  );
  const pending = view.areas.filter((a) => !a.check);
  const notDone = view.areas.filter((a) => a.check?.status === "nao_limpo");
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-lg">Encerrar o dia</DialogTitle>
          <DialogDescription>Confira antes de enviar para Facilities.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[#e8f8f8] px-2 py-3">
              <p className="text-2xl font-semibold tabular-nums text-[#13676a]">{stats.done}</p>
              <p className="text-xs text-[#13676a]">limpos</p>
            </div>
            <div className="rounded-lg bg-amber-50 px-2 py-3">
              <p className="text-2xl font-semibold tabular-nums text-amber-800">{stats.notDone}</p>
              <p className="text-xs text-amber-800">não deu</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-2 py-3">
              <p className="text-2xl font-semibold tabular-nums text-slate-700">{stats.pending}</p>
              <p className="text-xs text-slate-600">sem marcar</p>
            </div>
          </div>
          {notDone.length > 0 && (
            <ul className="space-y-1 text-sm">
              {notDone.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span className="truncate">{a.name}</span>
                  <span className="shrink-0 text-muted-foreground">{a.check?.reason ? NOT_DONE_REASON_LABEL[a.check.reason] : ""}</span>
                </li>
              ))}
            </ul>
          )}
          {pending.length > 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              Ficam sem marcar: {pending.map((a) => a.name).join(", ")}.
            </p>
          )}
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Algum recado para Facilities? (opcional)"
            aria-label="Recado"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Voltar
          </Button>
          <Button type="button" disabled={busy} onClick={() => onConfirm(note)}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Encerrar o dia
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const KIND_PLURAL: Record<(typeof CLEANING_KINDS)[number], string> = {
  simples: "simples",
  media: "médias",
  completa: "completas",
  lavagem: "lavagens",
};

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

function Banner({ tone, icon: Icon, children, action }: { tone: "ok" | "info" | "warn"; icon: LucideIcon; children: ReactNode; action?: ReactNode }) {
  const tones = {
    ok: "bg-[#e8f8f8] text-[#13676a]",
    info: "bg-[#eef3f5] text-[#3b5560]",
    warn: "bg-amber-50 text-amber-900",
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-4 py-3 text-sm", tones[tone])}>
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

function SectionTitle({ children, count }: { children: ReactNode; count: number }) {
  return (
    <h3 className="flex items-baseline gap-2 px-1 text-sm font-semibold text-[#0d2a38]">
      {children}
      <span className="rounded-full bg-[#eaf2f5] px-2 py-px text-xs font-semibold tabular-nums text-[#285f7a]">{count}</span>
    </h3>
  );
}

export function LimpezaHojeClient({ initialView, guideSeen }: { initialView: CleaningDayView; guideSeen: boolean }) {
  const [view, setView] = useState(initialView);
  const [busyArea, setBusyArea] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notDone, setNotDone] = useState<Area | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const record = view.record;
  const signed = Boolean(record?.reviewed_at);
  const noCleaning = Boolean(record?.no_cleaning_reason);
  const closed = Boolean(record?.closed_at);
  const locked = signed || noCleaning || !view.business;
  const pending = view.areas.filter((a) => !a.check);
  const skipped = view.areas.filter((a) => a.check?.status === "nao_limpo");
  const done = view.areas.filter((a) => a.check?.status === "limpo").sort((a, b) => (b.check?.checked_at ?? "").localeCompare(a.check?.checked_at ?? ""));
  const marked = done.length + skipped.length;
  const progress = view.areas.length ? Math.round((marked / view.areas.length) * 100) : 0;
  const heavy = CLEANING_KINDS.map((kind) => ({ kind, count: view.areas.filter((a) => a.kind === kind).length })).filter((k) => k.count > 0);
  const firstName = view.user.name.trim().split(/\s+/)[0] ?? "";

  async function run(task: () => Promise<CleaningDayView>, areaId: string | null = null) {
    setError(null);
    if (areaId) setBusyArea(areaId);
    else setBusy(true);
    try {
      setView(await task());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
      return false;
    } finally {
      setBusyArea(null);
      setBusy(false);
    }
  }

  const undoButton = (area: Area) =>
    !locked && (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-10 shrink-0 gap-1.5 px-3 text-[#3b5560]"
        disabled={busyArea === area.id}
        aria-label={`Desfazer ${area.name}`}
        onClick={() => void run(() => cleaningApi.unmark(view.day, area.id), area.id)}
      >
        {busyArea === area.id ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
        Desfazer
      </Button>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-32">
      <section className="relative overflow-hidden rounded-xl bg-[#03070c] text-[#f9f9f9]">
        <div aria-hidden className={cn("absolute inset-0", DARK_HERO)} />
        <div className="relative px-5 pb-5 pt-4 sm:px-7 sm:pt-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-white/75">{longDate(view.day)}</p>
            <GuiaLimpeza guide="limpeza-hoje" seen={guideSeen} canManage={view.canManage} autoOpen={view.business && !locked} tone="dark" />
          </div>
          <div className="flex items-center gap-4">
            <GoldRingAvatar name={view.user.name} avatar={view.user.avatar} className="size-16 sm:size-20" />
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-tight sm:text-[28px]">
                {view.day === view.today ? greeting() : "Limpeza do dia"}
                {view.day === view.today && firstName && (
                  <>
                    , <span style={{ color: GOLD }}>{firstName}</span>
                  </>
                )}
              </p>
              {view.business && view.weekOfMonth && (
                <p className="mt-1 text-sm text-white/75">
                  {view.weekOfMonth}ª semana do mês{view.scheduleWeek !== view.weekOfMonth && ` · cronograma da ${view.scheduleWeek}ª`}
                </p>
              )}
            </div>
          </div>

          {view.business && !noCleaning && (
            <div className="mt-6" data-tour="progresso">
              <div className="flex items-end justify-between gap-3">
                <p className="text-sm text-white/80">
                  <span className="text-4xl font-semibold leading-none tabular-nums" style={{ color: GOLD }}>
                    {marked}
                  </span>
                  <span className="ml-1.5 text-lg text-white/70">de {view.areas.length}</span>
                  <span className="ml-2">ambientes marcados</span>
                </p>
                <p className="pb-1 text-sm font-semibold tabular-nums text-white/85">{progress}%</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${progress}%`, backgroundColor: GOLD }} />
              </div>
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Limpezas de hoje por tipo">
                {heavy.map(({ kind, count }) => (
                  <li
                    key={kind}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] py-1 pl-1 pr-3 text-[13px] text-white/90"
                  >
                    <KindLetter kind={kind} size="sm" className="ring-0" />
                    {count} {count === 1 ? CLEANING_KIND_INFO[kind].label.toLowerCase() : KIND_PLURAL[kind]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {!view.business && (
        <section className="flex flex-col items-center gap-2 rounded-xl border border-[#dce9eb] bg-white px-6 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-[#eef5f7] text-[#285f7a]">
            <PartyPopper className="size-7" aria-hidden />
          </span>
          <p className="mt-1 text-lg font-semibold text-[#0d2a38]">{view.holiday ? "Hoje é feriado" : "Hoje não tem limpeza"}</p>
          <p className="text-sm text-[#5a717b]">A lista volta no próximo dia útil.</p>
        </section>
      )}

      {noCleaning && (
        <Banner tone="info" icon={CircleAlert}>
          Facilities marcou este dia como <strong>sem limpeza</strong>: {record?.no_cleaning_reason}
        </Banner>
      )}
      {signed && (
        <Banner tone="ok" icon={ShieldCheck}>
          Conferido e assinado por {record?.reviewed_by_name ?? "Facilities"} às {record?.reviewed_at ? timeInSaoPaulo(record.reviewed_at) : ""}.
        </Banner>
      )}
      {closed && !signed && (
        <Banner
          tone="ok"
          icon={ClipboardCheck}
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1 text-[#13676a] hover:bg-white/60"
              disabled={busy}
              onClick={() => void run(() => cleaningApi.undoClose(view.day))}
            >
              <Undo2 className="size-3.5" />
              Desfazer
            </Button>
          }
        >
          Dia encerrado às {record?.closed_at ? timeInSaoPaulo(record.closed_at) : ""}. Agora Facilities confere.
        </Banner>
      )}
      {error && (
        <div role="alert">
          <Banner tone="warn" icon={CircleAlert}>
            {error}
          </Banner>
        </div>
      )}

      {view.business && !noCleaning && (
        <>
          {pending.length > 0 ? (
            <section className="space-y-2.5" aria-label="A fazer">
              <SectionTitle count={pending.length}>A fazer</SectionTitle>
              <ul className="divide-y divide-[#eef3f5] overflow-hidden rounded-xl border border-[#dce9eb] bg-white">
                {pending.map((area, index) => (
                  <li key={area.id} data-tour={index === 0 ? "ambiente" : undefined} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                    <AreaTile name={area.name} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-snug text-[#0d2a38]">{area.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <KindBadge kind={area.kind} />
                        {!locked && (
                          <button
                            type="button"
                            data-tour={index === 0 ? "nao-deu" : undefined}
                            onClick={() => setNotDone(area)}
                            className="text-[13px] font-medium text-[#347796] underline-offset-2 outline-none hover:underline focus-visible:underline"
                          >
                            Não deu
                          </button>
                        )}
                      </div>
                    </div>
                    {!locked && (
                      <button
                        type="button"
                        aria-label={`Marcar ${area.name} como limpo`}
                        disabled={busyArea === area.id}
                        onClick={() => void run(() => cleaningApi.mark({ day: view.day, area_id: area.id, status: "limpo" }), area.id)}
                        className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-[#347796] text-[#347796] transition-colors duration-150 hover:bg-[#347796] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#47cdd0]/40 active:scale-95 disabled:opacity-60"
                      >
                        {busyArea === area.id ? <Loader2 className="size-6 animate-spin" /> : <Check className="size-7" strokeWidth={2.5} />}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            !closed &&
            !signed && (
              <section className="flex flex-col items-center gap-3 rounded-xl border border-[#8edfe1] bg-[#f1fbfb] px-6 py-8 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-[#13676a] text-white">
                  <CheckCheck className="size-7" aria-hidden />
                </span>
                <div>
                  <p className="text-lg font-semibold text-[#0d2a38]">Tudo marcado!</p>
                  <p className="text-sm text-[#3b5560]">Encerre o dia para Facilities conferir.</p>
                </div>
                <Button type="button" data-tour="encerrar" className="h-12 gap-2 px-6 text-base" onClick={() => setCloseOpen(true)}>
                  <ClipboardCheck className="size-5" />
                  Encerrar o dia
                </Button>
              </section>
            )
          )}

          {skipped.length > 0 && (
            <section className="space-y-2.5" aria-label="Não deu para limpar">
              <SectionTitle count={skipped.length}>Não deu para limpar</SectionTitle>
              <ul className="divide-y divide-amber-100 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/50">
                {skipped.map((area) => (
                  <li key={area.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                    <AreaTile name={area.name} size="sm" className="bg-amber-100 text-amber-800" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#0d2a38]">{area.name}</p>
                      <p className="text-[13px] text-amber-900">
                        {area.check?.reason ? NOT_DONE_REASON_LABEL[area.check.reason] : "Não deu"}
                        {area.check?.note ? ` · ${area.check.note}` : ""}
                      </p>
                    </div>
                    {undoButton(area)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section className="space-y-2.5" aria-label="Feitos">
              <SectionTitle count={done.length}>Feitos</SectionTitle>
              <ul className="divide-y divide-[#e2f3f3] overflow-hidden rounded-xl border border-[#c5eaea] bg-[#f6fcfc]">
                {done.map((area) => (
                  <li key={area.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#13676a] text-white">
                      <Check className="size-4" strokeWidth={3} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#0d2a38]">{area.name}</p>
                      <p className="text-[13px] text-[#3b5560]">
                        {area.kind ? `${CLEANING_KIND_INFO[area.kind].label} · ` : ""}
                        {area.check ? `às ${timeInSaoPaulo(area.check.checked_at)}` : ""}
                      </p>
                    </div>
                    {undoButton(area)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {view.issues.length > 0 && (
        <section className="space-y-2.5" aria-label="Avisos de hoje">
          <SectionTitle count={view.issues.length}>Avisos de hoje</SectionTitle>
          <ul className="divide-y divide-[#eef3f5] overflow-hidden rounded-xl border border-[#dce9eb] bg-white">
            {view.issues.map((issue) => (
              <li key={issue.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <MessageSquareWarning className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[#0d2a38]">
                    {issue.area_name && <span className="font-semibold">{issue.area_name}: </span>}
                    {issue.description}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#5a717b]">
                    {timeInSaoPaulo(issue.created_at)} ·{" "}
                    {issue.status === "aberto" ? "Facilities ainda não viu" : issue.status === "resolvido" ? "Resolvido" : "Virou manutenção"}
                  </p>
                </div>
                {issue.has_photo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 gap-1"
                    onClick={() => openIssuePhoto(issue.id).catch((e) => setError(e.message))}
                  >
                    <Camera className="size-3.5" />
                    Foto
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.business && !signed && !noCleaning && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 px-4 lg:bottom-6 lg:left-auto lg:right-8 lg:px-0">
          <div className="mx-auto flex max-w-2xl gap-2 rounded-xl border border-[#dce9eb] bg-white/95 p-2 shadow-[0_10px_30px_rgba(4,32,47,0.18)] backdrop-blur">
            <Button type="button" variant="outline" data-tour="avisar" className="h-12 flex-1 gap-2 text-[15px]" onClick={() => setIssueOpen(true)}>
              <MessageSquareWarning className="size-5" />
              Avisar problema
            </Button>
            {!closed && pending.length > 0 && (
              <Button type="button" data-tour="encerrar" className="h-12 flex-1 gap-2 text-[15px]" disabled={busy} onClick={() => setCloseOpen(true)}>
                <ClipboardCheck className="size-5" />
                Encerrar o dia
              </Button>
            )}
          </div>
        </div>
      )}

      {notDone && (
        <NotDoneDialog
          area={notDone}
          busy={busyArea === notDone.id}
          onCancel={() => setNotDone(null)}
          onSave={(reason, note) =>
            void run(() => cleaningApi.mark({ day: view.day, area_id: notDone.id, status: "nao_limpo", reason, note }), notDone.id).then(
              (ok) => ok && setNotDone(null)
            )
          }
        />
      )}
      {issueOpen && (
        <IssueDialog
          day={view.day}
          areas={view.areas}
          onCancel={() => setIssueOpen(false)}
          onSent={(next) => {
            setView(next);
            setIssueOpen(false);
          }}
        />
      )}
      {closeOpen && (
        <CloseDialog
          view={view}
          busy={busy}
          onCancel={() => setCloseOpen(false)}
          onConfirm={(note) => void run(() => cleaningApi.close(view.day, note)).then((ok) => ok && setCloseOpen(false))}
        />
      )}
    </div>
  );
}
