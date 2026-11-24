"use client";

import { useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  ListChecks,
  Loader2,
  Lock,
  MapPin,
  Plus,
  PlusCircle,
  RotateCcw,
  Star,
  Target,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { OneOnOneMeeting } from "@/lib/rh/one-on-one/types";
import type { PdiPerson } from "@/lib/rh/pdi/types";
import { addDays, todayInBrasilia } from "@/lib/rh/pdi/progress";
import { cn } from "@/lib/utils";
import { DateField, InlineDelete } from "../form-controls";
import { Hint } from "../hint";
import { INK, MUTED, PersonPhoto, formatDate } from "../pdi/pdi-visuals";
import { CategoryIcon, DateBlock, MeetingStatusBadge, SourceTag, formatDayLong, formatTime } from "./one-on-one-visuals";

async function call(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar.");
  return data as { warning?: string | null };
}

/** Tópico da pauta. Os que vieram do Feedz podem ser uma ata inteira: mostra recolhido. */
function TopicText({ text, done }: { text: string; done: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 240 || text.split("\n").length > 4;
  return (
    <span className={cn("min-w-0 flex-1 text-sm", done ? "text-[#5a717b]" : INK)}>
      <span className={cn("block whitespace-pre-line break-words", done && !long && "line-through", long && !expanded && "line-clamp-4")}>{text}</span>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-0.5 rounded text-xs font-medium text-[#285f7a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
        >
          {expanded ? "Ver menos" : "Ver tudo"}
        </button>
      )}
    </span>
  );
}

/** Anotação de outra pessoa (as do Feedz chegam a virar ata de várias páginas): mostra o começo. */
function NoteText({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = body.length > 700 || body.split("\n").length > 12;
  const lines = body.split("\n");
  const title = lines.length > 1 && lines[0].trim().length > 0 && lines[0].trim().length <= 90 ? lines[0].trim() : null;
  const rest = title ? lines.slice(1).join("\n").trim() : body;
  return (
    <div className="mt-2 rounded-xl border border-[#dce6e9] bg-white px-4 py-3">
      {title && <p className={cn("mb-2 text-sm font-semibold", INK)}>{title}</p>}
      <p className={cn("whitespace-pre-line break-words text-sm leading-6 text-[#3b5560]", long && !expanded && "line-clamp-[10]")}>{rest}</p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 rounded text-xs font-medium text-[#285f7a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
        >
          {expanded ? "Ver menos" : "Ver a anotação inteira"}
        </button>
      )}
    </div>
  );
}

export function Stars({ value, onChange, size = "md" }: { value: number; onChange?: (value: number) => void; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={onChange ? "radiogroup" : undefined} aria-label="Nota da 1:1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const icon = <Star className={cn(size === "sm" ? "size-3.5" : "size-6", filled ? "fill-[#E1B16D] text-[#c9963f]" : "text-[#c9d6da]")} aria-hidden />;
        return onChange ? (
          <button key={star} type="button" role="radio" aria-checked={value === star} aria-label={`${star} de 5`} onClick={() => onChange(star)} className="rounded p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60">
            {icon}
          </button>
        ) : (
          <span key={star}>{icon}</span>
        );
      })}
    </span>
  );
}

export function MeetingCard({
  meeting,
  leader,
  member,
  me,
  defaultOpen,
  onChanged,
  onReschedule,
}: {
  meeting: OneOnOneMeeting;
  leader: PdiPerson;
  member: PdiPerson;
  me: string | null;
  defaultOpen: boolean;
  onChanged: (warning?: string | null) => void | Promise<void>;
  onReschedule: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [topic, setTopic] = useState("");
  const [action, setAction] = useState("");
  const [actionOwner, setActionOwner] = useState<string>(member.id);
  const [actionDue, setActionDue] = useState("");
  const [note, setNote] = useState(meeting.my_note);
  const [noteSaved, setNoteSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"cancelar" | "excluir" | "avaliar" | null>(null);
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(meeting.rating ?? 0);
  const [ratingComment, setRatingComment] = useState(meeting.rating_comment ?? "");
  const p = meeting.permissions;

  async function run(task: () => Promise<{ warning?: string | null } | void>) {
    setBusy(true);
    setError(null);
    try {
      const result = await task();
      await onChanged(result && "warning" in result ? result.warning : null);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (note === meeting.my_note) return;
    setNoteSaved("saving");
    try {
      await call(`/api/1-1/reunioes/${meeting.id}/anotacao`, "PUT", { body: note });
      setNoteSaved("saved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar a anotação.");
      setNoteSaved("idle");
    }
  }

  const others = meeting.notes.filter((item) => !item.mine);
  const ghostButton =
    "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60 disabled:opacity-50";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-white transition-shadow",
        open ? "border-[#9fd9da] shadow-[0_0_0_1px_#d3eff0,0_8px_24px_-12px_rgba(4,32,47,0.18)]" : "border-[#e1ebee] shadow-[0_1px_3px_rgba(4,32,47,0.05)]"
      )}
    >
      <header className="flex flex-wrap items-center gap-4 px-5 py-4">
        <DateBlock iso={meeting.starts_at} className="size-14 rounded-xl" />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="min-w-0 flex-1 text-left outline-none focus-visible:underline"
          aria-expanded={open}
        >
          <span className={cn("block text-base font-semibold first-letter:uppercase", INK)}>{formatDayLong(meeting.starts_at)}</span>
          <span className={cn("mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm", MUTED)}>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <CalendarDays className="size-4" aria-hidden />
              {formatTime(meeting.starts_at)} às {formatTime(meeting.ends_at)}
            </span>
            {meeting.room && meeting.room.key !== "SOMENTE_ONLINE" && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden />
                {meeting.room.label}
              </span>
            )}
            {meeting.category && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#e9eef8] px-2 py-0.5 text-xs font-medium text-[#34507e]">
                <CategoryIcon name={meeting.category.name} className="size-3.5" />
                {meeting.category.name}
              </span>
            )}
            {meeting.from_feedz && <span className="rounded-md bg-[#f1f5f6] px-2 py-0.5 text-xs text-[#5a717b]">do Feedz</span>}
          </span>
        </button>
        <div className="flex items-center gap-2">
          {meeting.rating ? <Stars value={meeting.rating} size="sm" /> : null}
          <MeetingStatusBadge status={meeting.display_status} className="px-2.5 py-1" />
          {meeting.teams_join_url && meeting.status === "agendada" && (
            <a
              href={meeting.teams_join_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d5e3e7] px-2.5 text-xs font-semibold text-[#1d5670] hover:bg-[#f4fafb]"
            >
              <Video className="size-3.5" aria-hidden />
              Entrar no Teams
            </a>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Recolher reunião" : "Abrir reunião"}
            className="grid size-9 place-items-center rounded-lg text-[#3b5560] outline-none hover:bg-[#f4fafb] focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
          >
            <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        </div>
      </header>

      {open && (
        <div className="grid border-t border-[#e6eff1] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Pauta + ações */}
          <div className="space-y-6 px-5 py-5 lg:border-r lg:border-[#e6eff1]">
            <section>
              <h4 className={cn("flex items-center gap-2 text-[15px] font-semibold", INK)}>
                <ListChecks className="size-[18px] text-[#1d7086]" aria-hidden />
                Pauta compartilhada
              </h4>
              {meeting.topics.length === 0 ? (
                <p className={cn("mt-2 text-sm", MUTED)}>Nenhum tópico ainda.</p>
              ) : (
                <ul className="mt-2 space-y-0.5">
                  {meeting.topics.map((item) => (
                    <li key={item.id} className="group flex items-start gap-3 rounded-lg px-1.5 py-2 hover:bg-[#f7fafb]">
                      <button
                        type="button"
                        disabled={!p.canEditAgenda || busy}
                        onClick={() => run(() => call(`/api/1-1/pauta/${item.id}`, "PATCH", { discussed: !item.discussed }))}
                        aria-label={item.discussed ? "Marcar como não conversado" : "Marcar como conversado"}
                        className={cn(
                          "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60 disabled:cursor-default",
                          item.discussed ? "border-[#1d7086] bg-[#1d7086] text-white" : "border-[#b9c8cd] bg-white enabled:hover:border-[#47cdd0]"
                        )}
                      >
                        {item.discussed && <Check className="size-3" strokeWidth={3} aria-hidden />}
                      </button>
                      <TopicText text={item.title} done={item.discussed} />
                      <SourceTag source={item.source} />
                      {item.author && <PersonPhoto person={item.author} size="xs" className="size-7" />}
                      {p.canEditAgenda && (
                        <InlineDelete
                          label="Tirar da pauta"
                          question="Tirar da pauta?"
                          idleClassName="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                          onConfirm={() => run(() => call(`/api/1-1/pauta/${item.id}`, "DELETE"))}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {p.canEditAgenda && (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!topic.trim()) return;
                    if (await run(() => call(`/api/1-1/reunioes/${meeting.id}/pauta`, "POST", { title: topic.trim(), source: "livre" }))) setTopic("");
                  }}
                >
                  <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Incluir tópico na pauta" className="h-10 rounded-lg" aria-label="Novo tópico" />
                  <button
                    type="submit"
                    disabled={!topic.trim() || busy}
                    aria-label="Incluir tópico"
                    className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#9fd9da] bg-white text-[#1d7086] outline-none transition-colors hover:bg-[#eef8f8] focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60 disabled:opacity-50"
                  >
                    <Plus className="size-5" aria-hidden />
                  </button>
                </form>
              )}
            </section>

            <section>
              <h4 className={cn("flex items-center gap-2 text-[15px] font-semibold", INK)}>
                <Target className="size-[18px] text-[#1d7086]" aria-hidden />
                Ações desta reunião
              </h4>
              {meeting.actions.length === 0 ? (
                <p className={cn("mt-2 text-sm", MUTED)}>Nenhuma ação registrada.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {meeting.actions.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 px-1.5 text-sm">
                      <span
                        className={cn(
                          "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-md border-2",
                          item.done_at ? "border-[#1d7086] bg-[#1d7086] text-white" : "border-[#b9c8cd] bg-white"
                        )}
                        aria-hidden
                      >
                        {item.done_at && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className={cn("min-w-0 flex-1", item.done_at ? "text-[#5a717b] line-through" : INK)}>{item.title}</span>
                      {item.owner && <PersonPhoto person={item.owner} size="xs" className="size-7" />}
                    </li>
                  ))}
                </ul>
              )}
              {p.canEditAgenda && (
                <form
                  className="mt-3 space-y-2.5"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!action.trim()) return;
                    const ok = await run(() =>
                      call("/api/1-1/acoes", "POST", {
                        leader_employee_id: leader.id,
                        member_employee_id: member.id,
                        meeting_id: meeting.id,
                        title: action.trim(),
                        owner_employee_id: actionOwner,
                        due_date: actionDue || null,
                      })
                    );
                    if (ok) {
                      setAction("");
                      setActionDue("");
                    }
                  }}
                >
                  <div className="relative">
                    <PlusCircle className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7b929c]" aria-hidden />
                    <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="O que ficou combinado?" className="h-10 rounded-lg pl-9" aria-label="Nova ação" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1.5" role="radiogroup" aria-label="Responsável">
                      {[member, leader].map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          role="radio"
                          aria-checked={actionOwner === person.id}
                          onClick={() => setActionOwner(person.id)}
                          className={cn(
                            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                            actionOwner === person.id
                              ? "border-[#47cdd0] bg-[#e8f8f8] font-semibold text-[#1d5670] shadow-[inset_0_0_0_1px_#47cdd0]"
                              : "border-[#dce6e9] bg-white text-[#3b5560] hover:bg-[#f4fafb]"
                          )}
                        >
                          <PersonPhoto person={person} size="xs" className="size-5" />
                          {person.name.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                    <DateField
                      label="Prazo da ação"
                      placeholder="Sem prazo"
                      size="sm"
                      className="w-36"
                      value={actionDue}
                      min={todayInBrasilia()}
                      clearable
                      onChange={setActionDue}
                      presets={[
                        { label: "Próxima semana", value: addDays(todayInBrasilia(), 7) },
                        { label: "Em 15 dias", value: addDays(todayInBrasilia(), 15) },
                        { label: "Em 30 dias", value: addDays(todayInBrasilia(), 30) },
                      ]}
                    />
                    <button
                      type="submit"
                      disabled={!action.trim() || busy}
                      className={cn(ghostButton, "border border-[#bfe5e5] bg-[#e6f6f6] text-[#0f5f70] hover:bg-[#d8f0f0]")}
                    >
                      Registrar
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>

          {/* Anotações privadas */}
          <div className="space-y-4 px-5 py-5">
            <section>
              <h4 className={cn("flex items-center gap-2 text-[15px] font-semibold", INK)}>
                <FileText className="size-[18px] text-[#1d7086]" aria-hidden />
                {p.canWriteNote ? "Minhas anotações privadas" : "Anotações privadas"}
              </h4>
              {p.canWriteNote ? (
                <>
                  <Textarea
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setNoteSaved("idle");
                    }}
                    onBlur={saveNote}
                    rows={9}
                    placeholder="Pontos importantes do que foi conversado. A outra pessoa da 1:1 não vê."
                    className="mt-3 max-h-[36rem] min-h-56 rounded-xl border-[#dce6e9] bg-white px-4 py-3 text-sm leading-6 [field-sizing:content]"
                    aria-label="Anotações privadas"
                  />
                  <p className={cn("mt-1.5 flex h-4 items-center gap-1.5 text-xs", MUTED)}>
                    <Lock className="size-3" aria-hidden />
                    {noteSaved === "saving" ? "Salvando…" : noteSaved === "saved" ? "Salvo" : note !== meeting.my_note ? "Salva ao sair do campo" : "Só você vê"}
                  </p>
                </>
              ) : (
                <p className={cn("mt-1 flex items-center gap-1.5 text-xs", MUTED)}>
                  <Lock className="size-3" aria-hidden />
                  Só o líder e o liderado escrevem. Você lê pela regra definida em Gestão › Configurações.
                </p>
              )}
            </section>
            {others.length > 0 && (
              <section className="space-y-3">
                {others.map((item) => (
                  <div key={item.author.id}>
                    <p className={cn("flex items-center gap-2 text-xs font-medium", MUTED)}>
                      <PersonPhoto person={item.author} size="xs" className="size-5" />
                      Anotações de {item.author.name.split(" ")[0]} · {formatDate(item.updated_at)}
                    </p>
                    <NoteText body={item.body} />
                  </div>
                ))}
              </section>
            )}
          </div>

          {/* Rodapé */}
          <footer className="flex flex-wrap items-center gap-2 border-t border-[#e6eff1] px-4 py-3 lg:col-span-2">
            {error && <p className="w-full px-1 text-sm text-red-700">{error}</p>}
            {p.canFinish && (
              <button
                type="button"
                onClick={() => run(() => call(`/api/1-1/reunioes/${meeting.id}`, "PATCH", { action: "finalizar" }))}
                disabled={busy}
                className={cn(ghostButton, "bg-[#0f5f70] text-white hover:bg-[#0c5262]")}
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
                Finalizar 1:1
              </button>
            )}
            {p.canReschedule && (
              <button type="button" onClick={onReschedule} disabled={busy} className={cn(ghostButton, "border border-[#d5e3e7] bg-white text-[#1d5670] hover:bg-[#f4fafb]")}>
                <CalendarClock className="size-4" aria-hidden />
                Remarcar
              </button>
            )}
            {p.canRate && (
              <button type="button" onClick={() => setConfirm("avaliar")} disabled={busy} className={cn(ghostButton, "border border-[#d5e3e7] bg-white text-[#1d5670] hover:bg-[#f4fafb]")}>
                <Star className="size-4" aria-hidden />
                {meeting.rating ? "Mudar avaliação" : "Avaliar a 1:1"}
              </button>
            )}
            {meeting.status === "realizada" && meeting.permissions.canFinish === false && me === leader.id && (
              <button
                type="button"
                onClick={() => run(() => call(`/api/1-1/reunioes/${meeting.id}`, "PATCH", { action: "reabrir" }))}
                disabled={busy}
                className={cn(ghostButton, "text-[#1d7086] hover:bg-[#eef8f8]")}
              >
                <RotateCcw className="size-4" aria-hidden />
                Reabrir
              </button>
            )}
            <div className="ml-auto flex items-center gap-1">
              {meeting.rating_comment && (
                <Hint label={meeting.rating_comment}>
                  <span className={cn("mr-2 max-w-72 truncate text-xs italic", MUTED)}>“{meeting.rating_comment}”</span>
                </Hint>
              )}
              {meeting.in_outlook && (
                <span className={cn("mr-1 inline-flex items-center gap-1 text-xs", MUTED)}>
                  <ExternalLink className="size-3" aria-hidden />
                  No Outlook
                </span>
              )}
              {p.canCancel && (
                <button type="button" onClick={() => setConfirm("cancelar")} disabled={busy} className={cn(ghostButton, "text-[#3b5560] hover:bg-[#f4fafb]")}>
                  <XCircle className="size-4" aria-hidden />
                  Cancelar
                </button>
              )}
              {(me === leader.id || p.canCancel) && (
                <button
                  type="button"
                  onClick={() => setConfirm("excluir")}
                  disabled={busy}
                  aria-label="Excluir reunião"
                  className="grid size-9 place-items-center rounded-lg text-red-600 outline-none transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50"
                >
                  <Trash2 className="size-[18px]" aria-hidden />
                </button>
              )}
            </div>
          </footer>
        </div>
      )}

      {confirm && (
        <Dialog open onOpenChange={(value) => !value && !busy && setConfirm(null)}>
          <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
            <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
              <DialogTitle className="text-lg">
                {confirm === "cancelar" ? "Cancelar a 1:1" : confirm === "excluir" ? "Excluir a 1:1" : "Como foi esta 1:1?"}
              </DialogTitle>
              <DialogDescription>
                {confirm === "cancelar"
                  ? "A reunião fica no histórico como cancelada e o convite do Outlook é cancelado."
                  : confirm === "excluir"
                    ? "Apaga a reunião, a pauta, as ações desta reunião e as anotações. Não dá para desfazer."
                    : "A nota fica visível para o seu gestor e para Pessoas e Cultura."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-6 py-5">
              {confirm === "avaliar" && <Stars value={rating} onChange={setRating} />}
              {confirm !== "excluir" && (
                <Textarea
                  value={confirm === "avaliar" ? ratingComment : reason}
                  onChange={(event) => (confirm === "avaliar" ? setRatingComment(event.target.value) : setReason(event.target.value))}
                  rows={3}
                  placeholder={confirm === "avaliar" ? "Comentário (opcional)" : "Motivo (opcional)"}
                  aria-label="Comentário"
                />
              )}
              {error && <p className="text-sm text-red-700">{error}</p>}
            </div>
            <DialogFooter className="flex-row justify-end gap-2 border-t border-[#e6eef0] px-6 py-4">
              <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
                Voltar
              </Button>
              <Button
                variant={confirm === "avaliar" ? "default" : "destructive"}
                disabled={busy || (confirm === "avaliar" && rating === 0)}
                onClick={async () => {
                  const ok = await run(() =>
                    confirm === "excluir"
                      ? call(`/api/1-1/reunioes/${meeting.id}`, "DELETE")
                      : confirm === "cancelar"
                        ? call(`/api/1-1/reunioes/${meeting.id}`, "PATCH", { action: "cancelar", reason: reason.trim() || null })
                        : call(`/api/1-1/reunioes/${meeting.id}`, "PATCH", { action: "avaliar", rating, rating_comment: ratingComment.trim() || null })
                  );
                  if (ok) setConfirm(null);
                }}
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {confirm === "cancelar" ? "Cancelar 1:1" : confirm === "excluir" ? "Excluir" : "Enviar nota"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
}

