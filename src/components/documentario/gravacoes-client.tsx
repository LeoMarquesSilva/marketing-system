"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarPlus, Clapperboard, MessagesSquare, Mic, Plus, Search, Trash2, UsersRound, Video, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  SHOOT_KIND_LABELS,
  SHOOT_STATUS_LABELS,
  daysBefore,
  formatDayMonth,
  formatHour,
  formatWeekdayDate,
  normalizeForSearch,
  parseRelativeSchedule,
  shootWindow,
  todayInSaoPaulo,
  type DocBoard,
  type DocParticipant,
  type DocShoot,
  type RelativePhase,
  type ShootKind,
  type ShootStatus,
} from "@/lib/documentario/types";
import { BlockHeader, CARD, FILM, Face, Feedback, SELECT, docRequest } from "./shared";

export const SHOOT_ICONS: Record<ShootKind, LucideIcon> = {
  pre_entrevista: MessagesSquare,
  entrevista: Mic,
  conversa_conjunta: UsersRound,
  broll: Video,
  outro: Clapperboard,
};

const STATUS_STYLE: Record<ShootStatus, string> = {
  a_marcar: "bg-amber-50 text-amber-800 ring-amber-200",
  marcada: "bg-[#e9f3f8] text-[#285f7a] ring-[#3e84a8]/30",
  realizada: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelada: "bg-slate-50 text-slate-500 ring-slate-200",
};

const ROLES = ["Entrevistado", "Entrevistador", "Filmmaker", "Coordenação", "Apoio"];

/** Cor de cada etapa do cronograma relativo (faixa fina no topo do dia). */
const PHASE_COLORS = ["#47cdd0", "#347796", "#48466e", "#b8894a", "#0D1E2E"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(iso: string): string {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
}

function phaseName(phase: RelativePhase): string {
  const text = phase.text.replace(/\.$/, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function windowWarning(shoot: DocShoot, phases: RelativePhase[], eventDate: string | null): string | null {
  if (!shoot.scheduled_date || !eventDate) return null;
  if (shoot.scheduled_date >= eventDate) return "Data no dia da festa ou depois dela.";
  const window = shootWindow(shoot.kind, phases);
  if (!window) return null;
  const start = daysBefore(eventDate, window.from);
  const end = daysBefore(eventDate, window.to);
  if (shoot.scheduled_date > end) return `Depois da referência (${formatDayMonth(start)} a ${formatDayMonth(end)}): sobra menos tempo para montar.`;
  return null;
}

/* ------------------------------------------------------------------ calendário */

function Calendar({
  board,
  phases,
  onOpen,
  onPickDay,
}: {
  board: DocBoard;
  phases: RelativePhase[];
  onOpen: (shoot: DocShoot) => void;
  onPickDay: (day: string) => void;
}) {
  const eventDate = board.event?.event_date;
  const today = todayInSaoPaulo();
  if (!eventDate) return null;
  const firstPhase = phases.length ? daysBefore(eventDate, Math.max(...phases.map((phase) => phase.from))) : eventDate;
  const start = mondayOf(today < firstPhase ? today : firstPhase);
  const end = addDays(mondayOf(eventDate), 6);
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  const phaseOf = (day: string) => phases.findIndex((phase) => day >= daysBefore(eventDate, phase.from) && day <= daysBefore(eventDate, phase.to));
  const shootsOn = (day: string) => board.shoots.filter((shoot) => shoot.scheduled_date === day && shoot.status !== "cancelada");
  const canPick = board.viewer.can_edit;

  return (
    <section aria-labelledby="calendario" className={cn(CARD, "overflow-hidden")}>
      <div className="px-5 pb-4 pt-5 sm:px-6">
        <BlockHeader
          id="calendario"
          title="Agenda até a festa"
          hint={canPick ? "Clique num dia para marcar uma gravação nele. A cor no topo do dia mostra a etapa de referência (seção 16)." : "A cor no topo do dia mostra a etapa de referência (seção 16)."}
        />
        <ul className="mt-3 grid gap-x-5 gap-y-1.5 text-[13px] text-foreground/80 sm:grid-cols-2 xl:grid-cols-3">
          {phases.map((phase, index) => (
            <li key={phase.from} className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-5 shrink-0 rounded-full" style={{ backgroundColor: PHASE_COLORS[index % PHASE_COLORS.length] }} aria-hidden />
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {formatDayMonth(daysBefore(eventDate, phase.from))}–{formatDayMonth(daysBefore(eventDate, phase.to))}
              </span>
              <span className="truncate" title={phaseName(phase)}>
                {phaseName(phase)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-7 border-y border-[#e6eef0] bg-[#f8fbfc] text-center text-xs font-semibold text-muted-foreground">
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((weekday) => (
          <span key={weekday} className="py-2">
            {weekday}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const phase = phaseOf(day);
          const shoots = shootsOn(day);
          const isToday = day === today;
          const isFesta = day === eventDate;
          const past = day < today;
          const weekend = index % 7 >= 5;
          const pickable = canPick && !past && day < eventDate;
          return (
            <div
              key={day}
              className={cn(
                "group relative min-h-[84px] border-b border-r border-[#eef3f4] px-1.5 pb-1.5 pt-2.5 sm:min-h-[96px] sm:px-2 [&:nth-child(7n)]:border-r-0",
                weekend && !isFesta && "bg-[#fafcfd]",
                isFesta && "text-white",
              )}
              style={isFesta ? { backgroundColor: FILM.navy } : undefined}
            >
              {phase >= 0 && <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: PHASE_COLORS[phase % PHASE_COLORS.length] }} aria-hidden />}
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-[13px] font-medium tabular-nums",
                    isToday ? "bg-[#347796] font-semibold text-white" : past ? "text-muted-foreground/60" : isFesta ? "text-white" : "text-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                {(day.slice(8) === "01" || index === 0) && <span className={cn("text-xs font-medium", isFesta ? "text-white/70" : "text-muted-foreground")}>{MONTHS[Number(day.slice(5, 7)) - 1]}</span>}
                {pickable && shoots.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onPickDay(day)}
                    aria-label={`Marcar gravação em ${WEEKDAYS_SHORT[new Date(`${day}T12:00:00Z`).getUTCDay()]}, ${formatDayMonth(day)}`}
                    className="absolute inset-0 z-0 rounded-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]"
                  >
                    <span className="absolute bottom-2 right-2 grid size-6 place-items-center rounded-md bg-[#eaf2f5] text-[#285f7a] opacity-0 transition-opacity group-hover:opacity-100">
                      <Plus className="size-3.5" aria-hidden />
                    </span>
                  </button>
                )}
              </div>
              {isFesta && (
                <p className="mt-1 text-[13px] font-semibold leading-4" style={{ color: FILM.gold }}>
                  Festa
                  {board.event?.slot?.start_time ? <span className="block text-xs font-normal text-white/70">vídeo às {formatHour(board.event.slot.start_time)}</span> : null}
                </p>
              )}
              <div className="relative z-10 mt-1 space-y-1">
                {shoots.map((shoot) => {
                  const Icon = SHOOT_ICONS[shoot.kind];
                  return (
                    <button
                      key={shoot.id}
                      type="button"
                      onClick={() => onOpen(shoot)}
                      title={`${shoot.title}${shoot.start_time ? ` · ${formatHour(shoot.start_time)}` : ""}`}
                      className="flex w-full items-center gap-1 rounded-md bg-[#347796] px-1.5 py-1 text-left text-xs font-medium leading-4 text-white hover:bg-[#285f7a]"
                    >
                      <Icon className="size-3.5 shrink-0" aria-hidden />
                      <span className="hidden truncate sm:inline">
                        {shoot.start_time ? `${formatHour(shoot.start_time)} ` : ""}
                        {shoot.title.replace(/^(Pré-entrevista|Entrevista) com /, "")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Ao clicar num dia: qual gravação sem data vai para ele (ou uma nova). */
function PickShootDialog({
  board,
  day,
  onClose,
  onPick,
}: {
  board: DocBoard;
  day: string;
  onClose: () => void;
  onPick: (shoot: DocShoot | null) => void;
}) {
  const undated = board.shoots.filter((shoot) => !shoot.scheduled_date && shoot.status !== "cancelada");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-md">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">Marcar em {formatWeekdayDate(day)}</DialogTitle>
          <DialogDescription className="text-sm">Escolha a gravação que vai acontecer neste dia.</DialogDescription>
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {undated.map((shoot) => {
            const Icon = SHOOT_ICONS[shoot.kind];
            return (
              <li key={shoot.id}>
                <button type="button" onClick={() => onPick(shoot)} className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-[#f3f8fa]">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#eaf2f5] text-[#285f7a]">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{shoot.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {SHOOT_KIND_LABELS[shoot.kind]}
                      {shoot.estimate ? ` · ${shoot.estimate}` : ""}
                      {shoot.optional ? " · opcional" : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => onPick(null)} className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-[#285f7a] hover:bg-[#f3f8fa]">
              <span className="grid size-9 shrink-0 place-items-center rounded-md border border-dashed border-[#9cc3d2]">
                <Plus className="size-4" aria-hidden />
              </span>
              Outra gravação
            </button>
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ diálogo */

function ParticipantPicker({ board, value, onChange }: { board: DocBoard; value: DocParticipant[]; onChange: (next: DocParticipant[]) => void }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const term = normalizeForSearch(query.trim());
    if (term.length < 2) return [];
    return board.team.filter((member) => normalizeForSearch(member.name).includes(term) && !value.some((item) => item.user_id === member.user_id)).slice(0, 6);
  }, [query, board.team, value]);
  const avatarOf = (participant: DocParticipant) => (participant.user_id ? board.team.find((member) => member.user_id === participant.user_id)?.avatar_url ?? null : null);
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((participant, index) => (
            <li key={`${participant.user_id ?? participant.name}-${index}`} className="flex items-center gap-2 rounded-md border border-[#e6eef0] px-2 py-1.5">
              <Face name={participant.name} avatarUrl={avatarOf(participant)} size="xs" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {participant.name}
                {!participant.user_id && <span className="text-xs text-muted-foreground"> · externo</span>}
              </span>
              <select
                aria-label={`Papel de ${participant.name}`}
                className="h-8 rounded-md border border-input bg-white px-2 text-xs"
                value={participant.role ?? ""}
                onChange={(event) => onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, role: event.target.value || null } : item)))}
              >
                <option value="">Papel</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <Button size="icon-sm" variant="ghost" className="size-7" aria-label={`Tirar ${participant.name}`} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pessoa do escritório ou digitar nome de fora" className="pl-9" aria-label="Adicionar participante" />
      </div>
      {(matches.length > 0 || query.trim().length >= 2) && (
        <ul className="rounded-md border border-[#e6eef0] bg-white py-1 shadow-sm">
          {matches.map((member) => (
            <li key={member.user_id}>
              <button
                type="button"
                className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm hover:bg-[#f3f8fa]"
                onClick={() => {
                  onChange([...value, { name: member.name, user_id: member.user_id, role: null }]);
                  setQuery("");
                }}
              >
                <Face name={member.name} avatarUrl={member.avatar_url} size="xs" />
                {member.name}
              </button>
            </li>
          ))}
          {query.trim().length >= 2 && (
            <li>
              <button
                type="button"
                className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm text-[#285f7a] hover:bg-[#f3f8fa]"
                onClick={() => {
                  onChange([...value, { name: query.trim(), user_id: null, role: null }]);
                  setQuery("");
                }}
              >
                <Plus className="size-4" aria-hidden />
                Adicionar “{query.trim()}” (de fora do escritório)
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function ShootDialog({
  board,
  shoot,
  defaultDate,
  phases,
  onClose,
  onSaved,
}: {
  board: DocBoard;
  shoot: DocShoot | null;
  defaultDate?: string;
  phases: RelativePhase[];
  onClose: () => void;
  onSaved: (shoots: DocShoot[], text: string) => void;
}) {
  const [form, setForm] = useState({
    kind: shoot?.kind ?? ("entrevista" as ShootKind),
    title: shoot?.title ?? "",
    person_keys: shoot?.person_keys ?? [],
    estimate: shoot?.estimate ?? "",
    optional: shoot?.optional ?? false,
    scheduled_date: shoot?.scheduled_date ?? defaultDate ?? "",
    start_time: shoot?.start_time ?? "",
    end_time: shoot?.end_time ?? "",
    location: shoot?.location ?? "",
    participants: shoot?.participants ?? [],
    status: shoot?.status ?? ("a_marcar" as ShootStatus),
    notes: shoot?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventDate = board.event?.event_date ?? null;
  const window = shootWindow(form.kind, phases);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function send(payload: Record<string, unknown>, text: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await docRequest<{ shoots: DocShoot[] }>(payload);
      onSaved(result.shoots, text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  const timesValid = !form.start_time || !form.end_time || form.end_time > form.start_time;
  const valid = form.title.trim().length >= 3 && timesValid;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">{shoot ? shoot.title : "Nova gravação"}</DialogTitle>
          <DialogDescription className="text-sm">
            {window && eventDate
              ? `Referência no cronograma: ${formatWeekdayDate(daysBefore(eventDate, window.from))} a ${formatWeekdayDate(daysBefore(eventDate, window.to))} (D-${window.from} a D-${window.to}).`
              : "Data, horário, local e quem participa."}
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="grav-tipo">Tipo</Label>
              <select id="grav-tipo" className={SELECT} value={form.kind} onChange={(event) => set("kind", event.target.value as ShootKind)}>
                {(Object.keys(SHOOT_KIND_LABELS) as ShootKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {SHOOT_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grav-titulo">Nome</Label>
              <Input id="grav-titulo" value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="Ex.: Entrevista com Ricardo" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <DatePickerField value={form.scheduled_date} onChange={(value) => set("scheduled_date", value)} className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grav-inicio">Início</Label>
              <Input id="grav-inicio" type="time" value={form.start_time} onChange={(event) => set("start_time", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grav-fim">Fim</Label>
              <Input id="grav-fim" type="time" value={form.end_time} onChange={(event) => set("end_time", event.target.value)} aria-invalid={!timesValid} />
            </div>
          </div>
          {!timesValid && <p className="-mt-2 text-xs text-rose-700">O fim precisa ser depois do início.</p>}
          {form.scheduled_date && (
            <button type="button" className="-mt-2 text-xs font-medium text-[#285f7a] hover:underline" onClick={() => setForm((current) => ({ ...current, scheduled_date: "", start_time: "", end_time: "", status: "a_marcar" }))}>
              Tirar a data
            </button>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="grav-local">Local</Label>
            <Input id="grav-local" value={form.location} onChange={(event) => set("location", event.target.value)} placeholder="Sala, endereço ou cenário" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Quem é entrevistado</legend>
              <div className="flex flex-wrap gap-3 pt-1">
                {board.people.map((person) => (
                  <label key={person.key} className="inline-flex min-h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#347796]"
                      checked={form.person_keys.includes(person.key)}
                      onChange={(event) => set("person_keys", event.target.checked ? [...form.person_keys, person.key] : form.person_keys.filter((key) => key !== person.key))}
                    />
                    <Face name={person.name} avatarUrl={person.avatar_url} size="xs" />
                    {person.short_name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="grav-duracao">Duração prevista</Label>
                <Input id="grav-duracao" value={form.estimate} onChange={(event) => set("estimate", event.target.value)} placeholder="45–60 min" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grav-status">Situação</Label>
                <select id="grav-status" className={SELECT} value={form.status} onChange={(event) => set("status", event.target.value as ShootStatus)}>
                  {(Object.keys(SHOOT_STATUS_LABELS) as ShootStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {SHOOT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Quem participa</p>
            <ParticipantPicker board={board} value={form.participants} onChange={(next) => set("participants", next)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[#347796]" checked={form.optional} onChange={(event) => set("optional", event.target.checked)} />
            Gravação opcional
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="grav-notas">Anotações</Label>
            <Textarea id="grav-notas" rows={3} value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Equipamento, roupa, quem confirmar, cenário…" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {shoot && (
            <Button variant="ghost" size="sm" className="mr-auto text-rose-700" disabled={busy} onClick={() => void send({ action: "shoot.delete", id: shoot.id }, "Gravação excluída.")}>
              <Trash2 className="size-4" />
              Excluir
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy || !valid}
            onClick={() =>
              void send(
                {
                  action: "shoot.save",
                  id: shoot?.id,
                  ...form,
                  title: form.title.trim(),
                  estimate: form.estimate.trim() || null,
                  scheduled_date: form.scheduled_date || null,
                  start_time: form.start_time || null,
                  end_time: form.end_time || null,
                  location: form.location.trim() || null,
                  notes: form.notes.trim() || null,
                },
                form.scheduled_date ? `Gravação marcada para ${formatWeekdayDate(form.scheduled_date)}.` : "Gravação salva.",
              )
            }
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ lista */

function DateBlock({ shoot, onClick, canEdit }: { shoot: DocShoot; onClick: () => void; canEdit: boolean }) {
  if (!shoot.scheduled_date) {
    return (
      <button
        type="button"
        onClick={canEdit ? onClick : undefined}
        disabled={!canEdit}
        className="grid h-[68px] w-16 shrink-0 place-items-center content-center gap-0.5 rounded-md border border-dashed border-[#9cc3d2] text-[#285f7a] outline-none enabled:hover:border-[#347796] enabled:hover:bg-[#f3fafb] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40"
        aria-label={canEdit ? `Marcar data de ${shoot.title}` : "Sem data"}
      >
        <CalendarPlus className="size-5" aria-hidden />
        <span className="text-xs font-medium">sem data</span>
      </button>
    );
  }
  const date = new Date(`${shoot.scheduled_date}T12:00:00Z`);
  return (
    <span className="flex h-[68px] w-16 shrink-0 flex-col items-center justify-center rounded-md text-white" style={{ backgroundColor: FILM.navy }}>
      <span className="text-xs text-white/70">{WEEKDAYS_SHORT[date.getUTCDay()]}</span>
      <span className="text-[22px] font-semibold leading-6 tabular-nums">{date.getUTCDate()}</span>
      <span className="text-xs" style={{ color: FILM.gold }}>
        {MONTHS[date.getUTCMonth()]}
      </span>
    </span>
  );
}

function ShootRow({ board, shoot, phases, onOpen }: { board: DocBoard; shoot: DocShoot; phases: RelativePhase[]; onOpen: () => void }) {
  const eventDate = board.event?.event_date ?? null;
  const window = shootWindow(shoot.kind, phases);
  const warning = windowWarning(shoot, phases, eventDate);
  const avatarOf = (participant: DocParticipant) => (participant.user_id ? board.team.find((member) => member.user_id === participant.user_id)?.avatar_url ?? null : null);
  const protagonists = shoot.person_keys.map((key) => board.people.find((person) => person.key === key)).filter(Boolean) as DocBoard["people"];
  const interview = shoot.kind !== "broll" && shoot.kind !== "outro";
  const meta = [
    shoot.start_time ? `${formatHour(shoot.start_time)}${shoot.end_time ? `–${formatHour(shoot.end_time)}` : ""}` : null,
    shoot.estimate,
    shoot.location,
  ].filter(Boolean);
  return (
    <li className={cn("flex flex-wrap items-start gap-4 px-5 py-4 sm:flex-nowrap", shoot.status === "cancelada" && "opacity-60")}>
      <DateBlock shoot={shoot} onClick={onOpen} canEdit={board.viewer.can_edit} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={board.viewer.can_edit ? onOpen : undefined} className="text-left text-[15px] font-semibold leading-6 text-foreground enabled:hover:underline">
            {shoot.title}
          </button>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_STYLE[shoot.status])}>{SHOOT_STATUS_LABELS[shoot.status]}</span>
          {shoot.optional && <span className="rounded-full bg-[#f1f4f5] px-2 py-0.5 text-xs text-muted-foreground">opcional</span>}
        </div>
        <p className="mt-0.5 text-sm text-foreground/75">
          {meta.length ? meta.join(" · ") : "Horário e local a definir"}
        </p>
        {!shoot.scheduled_date && window && eventDate && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Referência: {formatWeekdayDate(daysBefore(eventDate, window.from))} a {formatWeekdayDate(daysBefore(eventDate, window.to))}
          </p>
        )}
        {warning && (
          <p className="mt-1 flex items-center gap-1 text-[13px] text-amber-800">
            <AlertTriangle className="size-3.5" aria-hidden />
            {warning}
          </p>
        )}
        {(protagonists.length > 0 || shoot.participants.length > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {protagonists.map((person) => (
              <span key={person.key} className="inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-white" style={{ backgroundColor: FILM.navy }}>
                <Face name={person.name} avatarUrl={person.avatar_url} size="xs" />
                {person.short_name}
              </span>
            ))}
            {shoot.participants.map((participant, index) => (
              <span key={`${participant.name}-${index}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f6f8] py-0.5 pl-0.5 pr-2.5 text-xs text-foreground/85">
                <Face name={participant.name} avatarUrl={avatarOf(participant)} size="xs" />
                {participant.name.split(" ")[0]}
                {participant.role && <span className="text-muted-foreground">· {participant.role}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {interview && (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/documentario/dia?gravacao=${shoot.id}`}>Abrir no dia</Link>
          </Button>
        )}
        {board.viewer.can_edit && (
          <Button size="sm" variant="outline" onClick={onOpen}>
            {shoot.scheduled_date ? "Editar" : "Marcar data"}
          </Button>
        )}
      </div>
    </li>
  );
}

const GROUPS: { title: string; kinds: ShootKind[]; icon: LucideIcon }[] = [
  { title: "Pré-entrevistas", kinds: ["pre_entrevista"], icon: MessagesSquare },
  { title: "Entrevistas", kinds: ["entrevista", "conversa_conjunta"], icon: Mic },
  { title: "Cenas da operação e outras captações", kinds: ["broll", "outro"], icon: Video },
];

export function DocGravacoesClient({ initialBoard }: { initialBoard: DocBoard }) {
  const [board, setBoard] = useState(initialBoard);
  const [editing, setEditing] = useState<{ shoot: DocShoot | null; date?: string } | null>(null);
  const [pickingDay, setPickingDay] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "erro"; text: string } | null>(null);
  const phases = useMemo(() => parseRelativeSchedule(board.sections.find((section) => section.slug === "etapas")?.body ?? ""), [board.sections]);
  const eventDate = board.event?.event_date ?? null;
  const open = (shoot: DocShoot | null, date?: string) => (board.viewer.can_edit ? setEditing({ shoot, date }) : undefined);
  const sortShoots = (list: DocShoot[]) =>
    [...list].sort((a, b) => `${a.scheduled_date ?? "9"}${a.start_time ?? ""}${a.sort}`.localeCompare(`${b.scheduled_date ?? "9"}${b.start_time ?? ""}${b.sort}`));
  const undated = board.shoots.filter((shoot) => !shoot.scheduled_date && shoot.status !== "cancelada").length;

  return (
    <div className="space-y-6">
      <Feedback message={message} onClose={() => setMessage(null)} />
      <Calendar
        board={board}
        phases={phases}
        onOpen={(shoot) => open(shoot)}
        onPickDay={(day) => (board.shoots.some((shoot) => !shoot.scheduled_date && shoot.status !== "cancelada") ? setPickingDay(day) : open(null, day))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {undated ? `${undated} ${undated === 1 ? "gravação espera" : "gravações esperam"} data.` : "Todas as gravações têm data."} Durações estimadas na seção 16.
        </p>
        {board.viewer.can_edit && (
          <Button onClick={() => open(null)}>
            <Plus className="size-4" />
            Nova gravação
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {GROUPS.map((group) => {
          const list = sortShoots(board.shoots.filter((shoot) => group.kinds.includes(shoot.kind)));
          if (!list.length) return null;
          const window = shootWindow(group.kinds[0], phases);
          return (
            <section key={group.title} aria-label={group.title} className={cn(CARD, "overflow-hidden")}>
              <div className="flex flex-wrap items-center gap-3 border-b border-[#e6eef0] px-5 py-3.5">
                <span className="grid size-9 place-items-center rounded-md bg-[#eaf2f5] text-[#285f7a]">
                  <group.icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-semibold text-foreground">{group.title}</h2>
                  {window && eventDate && (
                    <p className="text-[13px] text-muted-foreground">
                      Referência {formatDayMonth(daysBefore(eventDate, window.from))} a {formatDayMonth(daysBefore(eventDate, window.to))}
                    </p>
                  )}
                </div>
                <span className="text-[13px] text-muted-foreground">
                  {list.filter((shoot) => shoot.scheduled_date).length} de {list.length} com data
                </span>
              </div>
              <ul className="divide-y divide-[#eef3f4]">
                {list.map((shoot) => (
                  <ShootRow key={shoot.id} board={board} shoot={shoot} phases={phases} onOpen={() => open(shoot)} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {pickingDay && (
        <PickShootDialog
          board={board}
          day={pickingDay}
          onClose={() => setPickingDay(null)}
          onPick={(shoot) => {
            setPickingDay(null);
            open(shoot, pickingDay);
          }}
        />
      )}
      {editing && (
        <ShootDialog
          board={board}
          shoot={editing.shoot}
          defaultDate={editing.date}
          phases={phases}
          onClose={() => setEditing(null)}
          onSaved={(shoots, text) => {
            setBoard((current) => ({ ...current, shoots }));
            setEditing(null);
            setMessage({ type: "ok", text });
          }}
        />
      )}
    </div>
  );
}
