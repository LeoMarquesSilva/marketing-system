"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, CalendarDays, Check, ClipboardList, Clock3, Lock, Loader2, MessageCircle, Send, Trash2, UsersRound, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackDetail } from "@/lib/rh/feedback/types";
import { cn } from "@/lib/utils";
import { PersonPhoto, formatDate, relativeDays } from "../pdi/pdi-visuals";
import { INK, KindBadge, MUTED, ValueChip, VisibilityTag, feedzRatings, formatWhen } from "./feedback-visuals";

const VIEWER_NOTE: Partial<Record<FeedbackDetail["viewer"], string>> = {
  gestor: "Você vê porque lidera quem recebeu (o feedback foi enviado para a pessoa e o gestor).",
  rh: "Você vê como Pessoas e Cultura.",
  mural: "Reconhecimento público, no mural.",
};

export function FeedbackDetailDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<FeedbackDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved">("idle");

  // `withNote` só na abertura: recarregar depois de uma resposta não pode apagar a anotação que está sendo digitada.
  const load = useCallback(
    async (withNote: boolean) => {
      try {
        const response = await fetch(`/api/feedback/${id}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Não foi possível abrir o feedback.");
        setDetail(body as FeedbackDetail);
        if (withNote) setNote((body as FeedbackDetail).my_note ?? "");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível abrir o feedback.");
      }
    },
    [id],
  );

  useEffect(() => {
    // Abrir marca como lido no servidor; a lista atrás atualiza o contador.
    load(true).then(onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function sendReply() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/feedback/${id}/respostas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply.trim() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível responder.");
      setReply("");
      await load(false);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível responder.");
    } finally {
      setSending(false);
    }
  }

  async function saveNote() {
    if (!detail || note === detail.my_note) return;
    const saved = note;
    setNoteState("saving");
    const response = await fetch(`/api/feedback/${id}/anotacao`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: saved }) });
    if (response.ok) {
      // Atualiza só a anotação: a conversa pode ter mudado enquanto salvava.
      setDetail((current) => (current ? { ...current, my_note: saved } : current));
      setNoteState("saved");
    } else {
      setNoteState("idle");
      setError("Não foi possível salvar a anotação.");
    }
  }

  async function remove() {
    const response = await fetch(`/api/feedback/${id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "Não foi possível apagar.");
      return;
    }
    onChanged();
    onClose();
  }

  const ratings = detail ? feedzRatings(detail.value_ratings) : [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        {!detail ? (
          <div className="flex min-h-60 items-center justify-center p-8">
            <DialogHeader className="sr-only">
              <DialogTitle>Feedback</DialogTitle>
              <DialogDescription>Carregando</DialogDescription>
            </DialogHeader>
            {error ? <p className="text-sm text-red-700">{error}</p> : <Loader2 className="size-6 animate-spin text-[#3e84a8]" aria-label="Carregando" />}
          </div>
        ) : (
          <>
            <DialogHeader className="gap-3 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
              <div className="flex items-center gap-3">
                <span className="flex shrink-0">
                  <PersonPhoto person={detail.from} size="md" className="size-11 ring-2 ring-white" />
                  <PersonPhoto person={detail.to} size="md" className="-ml-3 size-11 ring-2 ring-white" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-base leading-snug">
                    {detail.from.name} <span className="font-normal text-[#7b929c]">para</span> {detail.to.name}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <CalendarDays className="size-3.5" aria-hidden />
                      {formatWhen(detail.created_at)}
                    </span>
                    <VisibilityTag visibility={detail.visibility} />
                    {detail.in_person && (
                      <span className="inline-flex items-center gap-1">
                        <UsersRound className="size-3.5" aria-hidden />
                        Conversado pessoalmente
                      </span>
                    )}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {detail.kind !== "sem_tipo" && <KindBadge kind={detail.kind} />}
                {detail.civil_values.map((value) => (
                  <ValueChip key={value} value={value} />
                ))}
                {detail.civil_values.length === 0 &&
                  ratings.map((entry) => (
                    <span key={entry.label} className="rounded-full border border-[#e1ebee] px-2 py-0.5 text-xs text-[#3b5560]">
                      {entry.label} <span className="font-semibold tabular-nums text-[#9a6a2c]">{entry.rating}/5</span>
                    </span>
                  ))}
                {detail.template_name && <span className={cn("text-xs", MUTED)}>· modelo {detail.template_name}</span>}
                {detail.ai_assisted && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#5b3fa3]">
                    <Wand2 className="size-3.5" aria-hidden />
                    escrito com ajuda da IA
                  </span>
                )}
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 [scrollbar-color:#c9d6da_transparent] [scrollbar-width:thin]">
              {VIEWER_NOTE[detail.viewer] && <p className="rounded-lg bg-[#f4f8f9] px-3 py-2 text-xs text-[#5a717b]">{VIEWER_NOTE[detail.viewer]}</p>}

              <p className={cn("whitespace-pre-line break-words text-[15px] leading-7", INK)}>{detail.message}</p>

              {detail.good_practice && (
                <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <ClipboardList className="size-4" aria-hidden />
                    {detail.good_practice.category}
                  </p>
                  <p className="text-xs text-amber-900/80">
                    Ocorrência de {formatDate(detail.good_practice.occurred_on)} · {detail.good_practice.employee_name} · {detail.good_practice.area}
                  </p>
                  {detail.good_practice.attachments.length > 0 && (
                    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {detail.good_practice.attachments.map((file) => (
                        <li key={file.id}>
                          <a href={file.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-amber-200 bg-white outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]">
                            {file.content_type.startsWith("video/") ? (
                              <video src={file.url} className="aspect-square w-full object-cover" muted preload="metadata" />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={file.url} alt={file.file_name} className="aspect-square w-full object-cover" />
                            )}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {detail.good_practice.manual_page && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-900/80">
                      <BookOpen className="size-3.5" aria-hidden />
                      Manual de Boas Práticas, página {detail.good_practice.manual_page}
                    </p>
                  )}
                </section>
              )}

              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0d2a38]">
                  <MessageCircle className="size-4 text-[#1d7086]" aria-hidden />
                  Conversa
                  <span className={cn("font-normal", MUTED)}>
                    {detail.read_at ? `· lido ${relativeDays(detail.read_at)}` : detail.viewer === "remetente" ? "· ainda não lido" : ""}
                  </span>
                </h3>
                {detail.replies.length === 0 ? (
                  <p className={cn("text-sm", MUTED)}>{detail.permissions.canReply ? "Nenhuma resposta ainda." : "Sem respostas."}</p>
                ) : (
                  <ul className="space-y-3">
                    {detail.replies.map((item) => (
                      <li key={item.id} className={cn("flex gap-2.5", item.mine && "flex-row-reverse")}>
                        <PersonPhoto person={item.author} size="sm" />
                        <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2.5", item.mine ? "bg-[#e8f8f8]" : "bg-[#f4f6f7]")}>
                          <p className={cn("whitespace-pre-line text-sm leading-6", INK)}>{item.message}</p>
                          <p className={cn("mt-0.5 text-xs", MUTED)}>
                            {item.author.name.split(" ")[0]} · {formatWhen(item.created_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {detail.permissions.canReply && (
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      rows={2}
                      placeholder={detail.kind === "boa_pratica" && detail.viewer === "destinatario" ? "Conte o que foi conversado com a pessoa" : "Responder"}
                      className="max-h-40 min-h-11 resize-none rounded-xl border-[#dce6e9] text-sm [field-sizing:content]"
                      aria-label="Resposta"
                    />
                    <Button onClick={sendReply} disabled={sending || !reply.trim()} className="h-11 bg-[#0f5f70] hover:bg-[#0c5262]" aria-label="Enviar resposta">
                      {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                    </Button>
                  </div>
                )}
              </section>

              {detail.permissions.canWriteNote && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0d2a38]">
                      <Lock className="size-3.5 text-[#5a717b]" aria-hidden />
                      Anotação só minha
                    </h3>
                    <NoteStatus state={noteState} dirty={note !== detail.my_note} />
                  </div>
                  <Textarea
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setNoteState("idle");
                    }}
                    onBlur={saveNote}
                    rows={2}
                    placeholder="Só você vê (nem Pessoas e Cultura)."
                    className="max-h-48 resize-none rounded-xl border-[#dce6e9] text-sm [field-sizing:content]"
                    aria-label="Anotação só minha"
                  />
                </section>
              )}

              {error && <p className="text-sm text-red-700">{error}</p>}
            </div>

            {detail.permissions.canDelete && (
              <DeleteFooter deleteUntil={detail.permissions.deleteUntil} recipientName={detail.viewer === "remetente" ? detail.to.name : null} onConfirm={remove} />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Situação da anotação, ao lado do título (sem linha solta embaixo do campo). */
function NoteStatus({ state, dirty }: { state: "idle" | "saving" | "saved"; dirty: boolean }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#5a717b]">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Salvando
      </span>
    );
  }
  if (state === "saved" && !dirty) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <Check className="size-3.5" aria-hidden />
        Salvo
      </span>
    );
  }
  if (dirty) return <span className="text-xs text-[#7b929c]">Salva quando você sair do campo</span>;
  return null;
}

/** "hoje, 18:20", "amanhã, 12:04" ou "24/11, 12:04", no horário de Brasília. */
function deadlineLabel(iso: string): string {
  const zone = "America/Sao_Paulo";
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const target = new Date(iso);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(target);
  const now = new Date();
  if (day(target) === day(now)) return `hoje, ${time}`;
  if (day(target) === day(new Date(now.getTime() + 86_400_000))) return `amanhã, ${time}`;
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, day: "2-digit", month: "2-digit" }).format(target);
  return `${date}, ${time}`;
}

/** Rodapé de apagar: prazo à esquerda, botão claro à direita e confirmação na própria faixa. */
function DeleteFooter({ deleteUntil, recipientName, onConfirm }: { deleteUntil: string | null; recipientName: string | null; onConfirm: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const first = recipientName?.split(" ")[0];

  if (asking) {
    return (
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-red-100 bg-red-50/70 px-6 py-3" role="group" aria-label="Confirmar apagar">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-800">Apagar este feedback?</p>
          <p className="text-xs text-red-800/80">
            {first ? `${first} deixa de ver. ` : ""}Ele fica guardado em Apagados, que só Pessoas e Cultura vê.
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setAsking(false)} className="text-[#3b5560] hover:bg-white">
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            autoFocus
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
                setAsking(false);
              }
            }}
            className="bg-red-700 text-white hover:bg-red-800"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
            Apagar
          </Button>
        </div>
      </footer>
    );
  }

  return (
    <footer className="flex items-center justify-between gap-3 border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-3">
      <p className="flex min-w-0 items-center gap-2 text-xs text-[#5a717b]">
        <Clock3 className="size-3.5 shrink-0 text-[#7b929c]" aria-hidden />
        {deleteUntil ? (
          <span>
            Dá para apagar até <span className="font-medium text-[#3b5560]">{deadlineLabel(deleteUntil)}</span>
          </span>
        ) : (
          <span>Apagar guarda em Apagados, que só Pessoas e Cultura vê.</span>
        )}
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(true)} className="shrink-0 gap-1.5 text-[#8a3b3b] hover:bg-red-50 hover:text-red-700" aria-label="Apagar feedback">
        <Trash2 className="size-4" aria-hidden />
        Apagar
      </Button>
    </footer>
  );
}
