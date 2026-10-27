"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Contact,
  Forward,
  History,
  Loader2,
  Phone,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import {
  buildLeadForwardMessage,
  formatBrazilPhone,
  formatLeadPhone,
  matchesRecipientSearch,
  normalizeBrazilPhone,
  type LeadForwardRecipient,
  type LeadForwardRecord,
} from "@/lib/whatsapp-lead-forward-format";
import { WhatsappLeadAvatar } from "@/components/trafego-pago/whatsapp-lead-avatar";
import { leadOriginMeta } from "@/components/trafego-pago/whatsapp-lead-origin";
import { firstName } from "@/components/trafego-pago/whatsapp-agent-avatar";
import type { WhatsappConversation } from "./whatsapp-crm-types";
import { leadDisplayName } from "./whatsapp-crm-utils";

/** Quem recebeu o último lead: já vem marcado da próxima vez. */
const LAST_RECIPIENT_KEY = "orqestrai:lead-forward-last-recipient";
const OTHER_NUMBER = "other";

function readLastRecipient(): string | null {
  try {
    return window.localStorage.getItem(LAST_RECIPIENT_KEY);
  } catch {
    return null;
  }
}

function saveLastRecipient(userId: string) {
  try {
    window.localStorage.setItem(LAST_RECIPIENT_KEY, userId);
  } catch {
    /* sem armazenamento: só não lembra da escolha */
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase() || "?";
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

type SummaryState = "loading" | "ready" | "error";

interface LeadForwardDialogProps {
  conversation: WhatsappConversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Encaminhar o lead para alguém da equipe (gestor, advogado da área): vai pelo
 * WhatsApp do escritório o resumo da conversa, feito pela IA e editável, e o
 * cartão de contato do lead.
 */
export function LeadForwardDialog({ conversation, open, onOpenChange }: LeadForwardDialogProps) {
  const { profile } = useAuth();
  const leadName = leadDisplayName(conversation);
  const origin = leadOriginMeta(conversation);
  const OriginIcon = origin.icon;
  const leadPhone = formatLeadPhone(conversation.phone);

  const [recipients, setRecipients] = useState<LeadForwardRecipient[]>([]);
  const [forwards, setForwards] = useState<LeadForwardRecord[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [otherPhone, setOtherPhone] = useState("");

  const [summaryState, setSummaryState] = useState<SummaryState>("loading");
  const [message, setMessage] = useState("");
  const editedRef = useRef(false);
  const [includeContact, setIncludeContact] = useState(true);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ name: string; contactSent: boolean } | null>(null);

  const composeMessage = useCallback(
    (summary: string) =>
      buildLeadForwardMessage({
        leadName,
        leadPhone: conversation.phone,
        origin: origin.label,
        campaign: conversation.meta_campaign_name || conversation.site_lead_page_title || null,
        summary,
        senderName: profile?.name ?? null,
      }),
    [leadName, conversation.phone, conversation.meta_campaign_name, conversation.site_lead_page_title, origin.label, profile?.name]
  );

  const loadSummary = useCallback(async () => {
    setSummaryState("loading");
    editedRef.current = false;
    try {
      const res = await authFetch("/api/evolution/forward/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };
      if (!res.ok || !json.summary) throw new Error(json.error);
      if (!editedRef.current) setMessage(composeMessage(json.summary));
      setSummaryState("ready");
    } catch {
      if (!editedRef.current) setMessage(composeMessage("- "));
      setSummaryState("error");
    }
  }, [conversation.id, composeMessage]);

  // Cada vez que abre: equipe, histórico e um resumo novo da conversa.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQuery("");
    setOtherPhone("");
    setSendError(null);
    setSent(null);
    setIncludeContact(Boolean(leadPhone));
    setLoadingRecipients(true);
    setRecipientsError(null);
    authFetch(`/api/evolution/forward?conversationId=${encodeURIComponent(conversation.id)}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          recipients?: LeadForwardRecipient[];
          forwards?: LeadForwardRecord[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Não deu para carregar a equipe.");
        if (cancelled) return;
        const list = json.recipients ?? [];
        setRecipients(list);
        setForwards(json.forwards ?? []);
        const last = readLastRecipient();
        setSelectedId(last && list.some((r) => r.userId === last) ? last : null);
      })
      .catch((err: Error) => {
        if (!cancelled) setRecipientsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipients(false);
      });
    void loadSummary();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só ao abrir ou trocar de conversa
  }, [open, conversation.id]);

  const visible = useMemo(
    () => recipients.filter((recipient) => matchesRecipientSearch(recipient, query)),
    [recipients, query]
  );
  const leaders = visible.filter((recipient) => recipient.isLeader);
  const team = visible.filter((recipient) => !recipient.isLeader);
  const selected = recipients.find((recipient) => recipient.userId === selectedId) ?? null;
  const otherPhoneValid = Boolean(normalizeBrazilPhone(otherPhone));
  const canSend =
    !sending &&
    summaryState !== "loading" &&
    message.trim().length > 0 &&
    (selected !== null || (selectedId === OTHER_NUMBER && otherPhoneValid));

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await authFetch("/api/evolution/forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          recipientUserId: selected?.userId ?? null,
          recipientPhone: selected ? null : otherPhone,
          message,
          includeContact: includeContact && Boolean(leadPhone),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { contactSent?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || "Não foi possível encaminhar o lead.");
      if (selected) saveLastRecipient(selected.userId);
      setSent({
        name: selected?.name ?? formatBrazilPhone(otherPhone),
        contactSent: Boolean(json.contactSent),
      });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Não foi possível encaminhar o lead.");
    } finally {
      setSending(false);
    }
  };

  const lastForward = forwards[0] ?? null;

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-xl">
        {sent ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15">
              <CheckCircle2 className="size-7" aria-hidden />
            </span>
            <DialogTitle className="text-lg">Lead enviado para {sent.name}</DialogTitle>
            <DialogDescription className="max-w-sm">
              {sent.contactSent
                ? "O resumo e o cartão de contato chegaram pelo WhatsApp do escritório."
                : "O resumo chegou pelo WhatsApp do escritório."}
            </DialogDescription>
            <Button type="button" className="mt-2" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="flex-row items-start gap-3 border-b px-6 pb-4 pt-6 text-left">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#347796]/10 text-[#285f7a]">
                <Forward className="size-5" aria-hidden />
              </span>
              <div className="space-y-1">
                <DialogTitle>Encaminhar lead</DialogTitle>
                <DialogDescription>
                  O resumo e o contato vão pelo WhatsApp do escritório para quem você escolher.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <WhatsappLeadAvatar
                  name={leadName}
                  avatarUrl={conversation.avatar_url}
                  conversationId={conversation.id}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{leadName}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <OriginIcon className="size-3.5 shrink-0" aria-hidden />
                    {origin.label}
                    {leadPhone ? ` · ${leadPhone}` : ""}
                  </p>
                </div>
              </div>

              {lastForward && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <History className="mt-px size-3.5 shrink-0" aria-hidden />
                  <span>
                    Já encaminhado para{" "}
                    <span className="font-medium text-foreground">
                      {lastForward.recipientName ?? formatBrazilPhone(lastForward.recipientPhone)}
                    </span>{" "}
                    em {formatWhen(lastForward.createdAt)}
                    {lastForward.sentByName ? ` por ${firstName(lastForward.sentByName)}` : ""}
                    {forwards.length > 1 ? ` (${forwards.length} envios)` : ""}.
                  </span>
                </p>
              )}

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Para quem</h3>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por nome, cargo ou área"
                    className="pl-9"
                    aria-label="Buscar pessoa da equipe"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl border p-1">
                  {loadingRecipients ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Carregando a equipe…
                    </div>
                  ) : recipientsError ? (
                    <p className="flex items-center gap-2 px-3 py-6 text-sm text-destructive">
                      <AlertCircle className="size-4 shrink-0" aria-hidden />
                      {recipientsError}
                    </p>
                  ) : (
                    <>
                      {leaders.length > 0 && <GroupLabel>Liderança</GroupLabel>}
                      {leaders.map((recipient) => (
                        <RecipientOption
                          key={recipient.userId}
                          recipient={recipient}
                          selected={selectedId === recipient.userId}
                          onSelect={setSelectedId}
                        />
                      ))}
                      {team.length > 0 && <GroupLabel>Equipe</GroupLabel>}
                      {team.map((recipient) => (
                        <RecipientOption
                          key={recipient.userId}
                          recipient={recipient}
                          selected={selectedId === recipient.userId}
                          onSelect={setSelectedId}
                        />
                      ))}
                      {visible.length === 0 && (
                        <p className="px-3 py-4 text-sm text-muted-foreground">
                          Ninguém com esse nome tem telefone profissional cadastrado.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedId(OTHER_NUMBER)}
                        className={cn(
                          "mt-1 flex w-full items-center gap-3 rounded-lg border-t px-2.5 py-2 text-left text-sm hover:bg-muted",
                          selectedId === OTHER_NUMBER && "bg-[#347796]/8 ring-1 ring-[#347796]/35"
                        )}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Phone className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">Outro número</span>
                          <span className="block text-xs text-muted-foreground">
                            Para quem não está na lista
                          </span>
                        </span>
                        {selectedId === OTHER_NUMBER && <Check className="size-4 text-[#347796]" aria-hidden />}
                      </button>
                    </>
                  )}
                </div>
                {selectedId === OTHER_NUMBER && (
                  <Input
                    value={otherPhone}
                    onChange={(event) => setOtherPhone(event.target.value)}
                    placeholder="(19) 99999-9999"
                    inputMode="tel"
                    autoFocus
                    aria-label="WhatsApp de quem vai receber"
                    aria-invalid={otherPhone.length > 0 && !otherPhoneValid}
                  />
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Mensagem</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={summaryState === "loading"}
                    onClick={() => void loadSummary()}
                  >
                    <Sparkles aria-hidden />
                    Refazer resumo
                  </Button>
                </div>
                <div className="relative">
                  <Textarea
                    value={message}
                    onChange={(event) => {
                      editedRef.current = true;
                      setMessage(event.target.value);
                    }}
                    disabled={summaryState === "loading"}
                    rows={11}
                    className="min-h-56 resize-y text-sm leading-relaxed"
                    aria-label="Mensagem que vai junto com o lead"
                  />
                  {summaryState === "loading" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-white/85 text-sm text-muted-foreground dark:bg-background/85">
                      <Loader2 className="size-5 animate-spin text-[#347796]" aria-hidden />
                      Lendo a conversa e montando o resumo…
                    </div>
                  )}
                </div>
                {summaryState === "error" && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Não deu para gerar o resumo agora. Escreva no lugar do traço ou tente de novo.
                  </p>
                )}
              </section>

              <label
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3",
                  leadPhone ? "cursor-pointer hover:bg-muted/40" : "opacity-60"
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[#347796]"
                  checked={includeContact && Boolean(leadPhone)}
                  disabled={!leadPhone}
                  onChange={(event) => setIncludeContact(event.target.checked)}
                />
                <Contact className="mt-0.5 size-4 shrink-0 text-[#285f7a]" aria-hidden />
                <span className="text-sm">
                  <span className="block font-medium">Enviar também o cartão de contato</span>
                  <span className="block text-xs text-muted-foreground">
                    {leadPhone
                      ? "Quem receber toca no cartão e já abre a conversa com o lead."
                      : "Este contato não mostra o número no WhatsApp."}
                  </span>
                </span>
              </label>

              {sendError && (
                <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" aria-hidden />
                  {sendError}
                </p>
              )}
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button type="button" variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={!canSend} onClick={() => void send()}>
                {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                {sending
                  ? "Enviando…"
                  : selected
                    ? `Enviar para ${firstName(selected.name)}`
                    : "Enviar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function RecipientOption({
  recipient,
  selected,
  onSelect,
}: {
  recipient: LeadForwardRecipient;
  selected: boolean;
  onSelect: (userId: string) => void;
}) {
  const subtitle = [recipient.position, recipient.area].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => onSelect(recipient.userId)}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted",
        selected && "bg-[#347796]/8 ring-1 ring-[#347796]/35"
      )}
    >
      <Avatar className="bg-[#347796]/10">
        {recipient.avatarUrl ? <AvatarImage src={recipient.avatarUrl} alt={recipient.name} /> : null}
        <AvatarFallback className="bg-[#347796]/10 text-xs font-semibold text-[#285f7a]">
          {initials(recipient.name)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{recipient.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {subtitle || formatBrazilPhone(recipient.phone)}
        </span>
      </span>
      {selected && <Check className="size-4 shrink-0 text-[#347796]" aria-hidden />}
    </button>
  );
}
