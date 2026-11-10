"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Mail,
  MessageCircle,
  PartyPopper,
  Pencil,
  Phone,
  Search,
  Send,
  UserPlus,
  UserRoundX,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PersonFace } from "@/components/pesquisas/shared";
import { cn } from "@/lib/utils";
import {
  invitePath,
  inviteUrl,
  stageOf,
  type BoardAction,
  type BoardInvite,
  type BoardPerson,
  type ConvitesBoard,
} from "@/lib/festa-convite";
import { ClientFace, StageBadge, copyText, formatDay, messageFor } from "./convites-festa-client";

const DIALOG = "flex max-h-[90dvh] flex-col gap-0 p-0";
const HEADER = "border-b border-[#e6eef0] px-5 py-4 pr-12";
const FOOTER = "flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3";
const LABEL = "text-xs font-semibold uppercase text-muted-foreground";

const CHANNEL_LABEL = { whatsapp: "pelo WhatsApp", copia: "com a mensagem copiada", manual: "marcado à mão" } as const;

function Step({ icon: Icon, done, title, detail }: { icon: LucideIcon; done: boolean; title: string; detail?: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          done ? "bg-[#347796] text-white" : "border border-dashed border-slate-300 text-slate-400"
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 pt-1">
        <span className={cn("block text-sm", done ? "font-medium text-foreground" : "text-muted-foreground")}>{title}</span>
        {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
      </span>
    </li>
  );
}

/** Detalhe do convite: andamento, contato, mensagem pronta e ações. */
export function InviteDialog({
  invite,
  board,
  busy,
  onClose,
  onSendWhatsapp,
  onAct,
  onChangeSender,
}: {
  invite: BoardInvite;
  board: ConvitesBoard;
  busy: boolean;
  onClose: () => void;
  onSendWhatsapp: () => void;
  onAct: (action: BoardAction, success?: string) => Promise<boolean>;
  onChangeSender: () => void;
}) {
  const [copied, setCopied] = useState<"msg" | "link" | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phone, setPhone] = useState(invite.phone.kind === "celular" ? (invite.phone.display ?? "") : "");
  const message = messageFor(invite, board);
  const mine = invite.senderUserId === board.viewer.userId;
  const sender = board.people.find((person) => person.userId === invite.senderUserId);
  const answered = invite.attending !== null;

  const copy = async (kind: "msg" | "link") => {
    await copyText(kind === "msg" ? message : inviteUrl(invite.token));
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
    if (kind === "msg" && !invite.sentAt && !invite.phone.waNumber && mine) {
      // Sem celular no cadastro: a cópia é o envio (a pessoa cola no contato que tiver).
      void onAct({ action: "mark_sent", inviteId: invite.id, channel: "copia" });
    }
  };

  const phoneLabel =
    invite.phone.kind === "celular"
      ? invite.phone.display
      : invite.phone.kind === "fixo"
        ? `${invite.phone.display} (fixo, sem WhatsApp)`
        : invite.phone.kind === "revisar"
          ? `${invite.phone.display} (confira o número)`
          : "Sem celular no cadastro";

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(DIALOG, "sm:max-w-xl")}>
        <div className={cn(HEADER, "flex items-center gap-3")}>
          <ClientFace invite={invite} size="lg" />
          <div className="min-w-0">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
              {invite.name}
              <StageBadge stage={stageOf(invite)} />
            </DialogTitle>
            <DialogDescription className="truncate text-sm">
              {[invite.company, invite.area].filter(Boolean).join(" · ") || "Cliente"}
            </DialogDescription>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section aria-label="Andamento">
            <ol className="grid gap-3 sm:grid-cols-3">
              <Step
                icon={Send}
                done={Boolean(invite.sentAt)}
                title={invite.sentAt ? `Enviado em ${formatDay(invite.sentAt)}` : "Ainda não enviado"}
                detail={invite.sentAt && invite.sentChannel ? CHANNEL_LABEL[invite.sentChannel] : undefined}
              />
              <Step
                icon={Eye}
                done={Boolean(invite.openedAt)}
                title={invite.openedAt ? `Abriu em ${formatDay(invite.openedAt)}` : "Não abriu o convite"}
              />
              <Step
                icon={invite.attending === false ? UserRoundX : CheckCheck}
                done={answered}
                title={invite.attending === true ? "Confirmou presença" : invite.attending === false ? "Não vai" : "Sem resposta"}
                detail={answered ? `em ${formatDay(invite.respondedAt)}` : undefined}
              />
            </ol>
            {invite.attending === true && (
              <div className="mt-3 grid gap-2 rounded-md bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                <p className="flex items-center gap-2">
                  {invite.plusOne ? <UserPlus className="size-4 shrink-0" aria-hidden /> : <PartyPopper className="size-4 shrink-0" aria-hidden />}
                  {invite.plusOne && invite.plusOneName ? `Vai com 1 convidado: ${invite.plusOneName}` : "Vai sem convidado"}
                </p>
                {invite.dietary && (
                  <p className="flex items-center gap-2">
                    <UtensilsCrossed className="size-4 shrink-0" aria-hidden />
                    Restrição alimentar: {invite.dietary}
                  </p>
                )}
              </div>
            )}
          </section>

          <section aria-label="Contato" className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div className="min-w-0">
              <p className={LABEL}>Celular</p>
              {editingPhone ? (
                <form
                  className="mt-1.5 flex gap-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (await onAct({ action: "set_phone", inviteId: invite.id, phone }, "Celular atualizado.")) setEditingPhone(false);
                  }}
                >
                  <Input aria-label="Celular com DDD" placeholder="(19) 91234-5678" value={phone} onChange={(event) => setPhone(event.target.value)} className="h-9" autoFocus />
                  <Button type="submit" size="sm" disabled={busy}>
                    Salvar
                  </Button>
                </form>
              ) : (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
                  <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{phoneLabel}</span>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setEditingPhone(true)}>
                    <Pencil className="size-3" aria-hidden />
                    {invite.phone.kind === "celular" ? "Corrigir" : "Informar celular"}
                  </Button>
                </p>
              )}
            </div>
            <div className="min-w-0">
              <p className={LABEL}>E-mail</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
                <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{invite.email ?? "Sem e-mail no cadastro"}</span>
              </p>
            </div>
            {board.manager && (
              <div className="min-w-0 sm:col-span-2">
                <p className={LABEL}>Quem envia</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  {sender ? (
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <PersonFace person={{ short_name: sender.name, avatar_url: sender.avatarUrl }} />
                      {sender.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                      A definir
                    </span>
                  )}
                  <Button variant="outline" size="sm" onClick={onChangeSender}>
                    {sender ? "Trocar" : "Definir"}
                  </Button>
                </div>
              </div>
            )}
          </section>

          {invite.logoUrl && (
            <section aria-label="Logo no convite" className="flex flex-wrap items-center gap-3 rounded-md border border-[#dce9eb] px-3 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={invite.logoUrl}
                alt=""
                className={cn("size-12 shrink-0 rounded-md border border-[#dce9eb] bg-white object-contain", !invite.showLogo && "opacity-40 grayscale")}
              />
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium text-foreground">{invite.showLogo ? "A logo aparece no convite" : "Logo oculta no convite"}</p>
                <p className="text-xs text-muted-foreground">Confira se esta é a logo certa{invite.company ? ` (${invite.company})` : ""}. Se não for, oculte.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void onAct(
                    { action: "set_logo", inviteId: invite.id, show: !invite.showLogo },
                    invite.showLogo ? "Logo oculta neste convite." : "Logo de volta no convite."
                  )
                }
              >
                {invite.showLogo ? "Ocultar" : "Mostrar"}
              </Button>
            </section>
          )}

          <section aria-label="Mensagem">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn(LABEL, "mr-auto")}>Mensagem</p>
              <Button variant="ghost" size="xs" onClick={() => void copy("link")}>
                {copied === "link" ? <Check aria-hidden /> : <Link2 aria-hidden />}
                {copied === "link" ? "Link copiado" : "Copiar só o link"}
              </Button>
              <Button variant="secondary" size="xs" onClick={() => void copy("msg")}>
                {copied === "msg" ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied === "msg" ? "Copiada" : "Copiar mensagem"}
              </Button>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words rounded-md border border-[#dce9eb] bg-[#f7fbfc] px-3.5 py-3 text-sm leading-6 text-foreground">
              {message}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {mine
                ? "Você pode ajustar o texto no WhatsApp antes de enviar. O link é só deste cliente."
                : sender
                  ? `A mensagem sai em nome de ${sender.firstName}. O link é só deste cliente.`
                  : "Defina quem envia para a mensagem levar o nome do remetente."}
            </p>
          </section>
        </div>

        <div className={FOOTER}>
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto"
            disabled={busy}
            onClick={() =>
              void onAct(
                invite.sentAt ? { action: "unmark_sent", inviteId: invite.id } : { action: "mark_sent", inviteId: invite.id, channel: "manual" },
                invite.sentAt ? "Envio desfeito." : "Marcado como enviado."
              )
            }
          >
            {invite.sentAt ? "Desfazer envio" : "Marcar como enviado"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`${invitePath(invite.token)}?previa=1`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              Ver convite
            </a>
          </Button>
          {mine && invite.phone.waNumber && (
            <Button size="sm" onClick={onSendWhatsapp} disabled={busy}>
              <MessageCircle className="size-4" aria-hidden />
              {invite.sentAt ? "Enviar de novo" : "Enviar no WhatsApp"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Escolha do remetente: sócios primeiro; a busca alcança qualquer pessoa da equipe. */
export function SenderDialog({
  title,
  count,
  people,
  current,
  busy,
  onClose,
  onPick,
}: {
  title: string;
  count: number;
  people: BoardPerson[];
  current: string | null;
  busy: boolean;
  onClose: () => void;
  onPick: (senderUserId: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    const pool = term ? people.filter((person) => person.name.toLowerCase().includes(term)) : people.filter((person) => person.partner || person.userId === current);
    return [...pool].sort((a, b) => Number(b.partner) - Number(a.partner) || a.name.localeCompare(b.name, "pt-BR"));
  }, [people, search, current]);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(DIALOG, "sm:max-w-lg")}>
        <div className={HEADER}>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-sm">
            {count === 1 ? "A mensagem deste cliente sai em nome de quem você escolher." : `Vale para os ${count} clientes da área. Dá para trocar um a um depois.`}
          </DialogDescription>
        </div>
        <div className="border-b border-[#e6eef0] px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Buscar pessoa da equipe" placeholder="Buscar outra pessoa da equipe" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Ninguém com esse nome.</li>}
          {shown.map((person) => (
            <li key={person.userId}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(person.userId)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left outline-none transition-colors hover:bg-[#47cdd0]/10 focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40 disabled:opacity-60",
                  person.userId === current && "bg-[#f3fafb]"
                )}
              >
                <PersonFace person={{ short_name: person.name, avatar_url: person.avatarUrl }} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{person.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[person.position, person.department === "Sócio" ? null : person.department].filter(Boolean).join(" · ")}</span>
                </span>
                {person.userId === current && <Check className="size-4 shrink-0 text-[#347796]" aria-label="Remetente atual" />}
              </button>
            </li>
          ))}
        </ul>
        <div className={FOOTER}>
          {current && (
            <Button variant="ghost" size="sm" className="mr-auto" disabled={busy} onClick={() => onPick(null)}>
              Deixar sem remetente
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : "";
}

/** Prazo da confirmação que aparece na mensagem e na página do cliente (vale até o fim do dia, em Brasília). */
export function DeadlineDialog({
  closesAt,
  busy,
  onClose,
  onSave,
}: {
  closesAt: string | null;
  busy: boolean;
  onClose: () => void;
  onSave: (closesAt: string | null) => void;
}) {
  const [date, setDate] = useState(toDateInput(closesAt));
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(DIALOG, "sm:max-w-md")}>
        <div className={HEADER}>
          <DialogTitle className="text-base">Prazo da confirmação</DialogTitle>
          <DialogDescription className="text-sm">
            A data entra na mensagem (&quot;pedimos até…&quot;) e na página do cliente. Depois dela, ele não consegue mais responder pelo link.
          </DialogDescription>
        </div>
        <div className="px-5 py-4">
          <label htmlFor="convites-prazo" className={LABEL}>
            Confirmar até
          </label>
          <Input id="convites-prazo" type="date" value={date} min="2026-11-10" max="2026-12-17" onChange={(event) => setDate(event.target.value)} className="mt-1.5 w-48" />
        </div>
        <div className={FOOTER}>
          {closesAt && (
            <Button variant="ghost" size="sm" className="mr-auto" disabled={busy} onClick={() => onSave(null)}>
              Tirar o prazo
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={busy || !date} onClick={() => onSave(`${date}T23:59:59-03:00`)}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
