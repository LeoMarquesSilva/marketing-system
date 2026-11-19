"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Building2, Check, Contact, Loader2, Mail, MessageCircle, Search } from "lucide-react";
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
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { formatBrazilPhone } from "@/lib/whatsapp-lead-forward-format";
import {
  citableArea,
  contactShareText,
  RECEPTION_CONTACT_ID,
  type TeamContact,
} from "@/lib/whatsapp-team-contacts";
import type { WhatsappMessage } from "./whatsapp-crm-types";
import { useTeamContacts } from "./use-team-contacts";
import { friendlyError } from "./whatsapp-inbox-view";

export interface SendContactPreset {
  contactId: string;
  card?: boolean;
  email?: boolean;
}

interface SendContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  leadName: string;
  preset?: SendContactPreset | null;
  onSent: (messages: WhatsappMessage[]) => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Passar ao cliente o contato da recepção ou de alguém da equipe: o cartão do
 * WhatsApp e/ou o e-mail, com uma frase que o atendente pode editar.
 */
export function SendContactDialog({
  open,
  onOpenChange,
  conversationId,
  leadName,
  preset,
  onSent,
}: SendContactDialogProps) {
  const { team, reception, loaded, error: loadError, retry } = useTeamContacts(open);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [withCard, setWithCard] = useState(true);
  const [withEmail, setWithEmail] = useState(true);
  const [text, setText] = useState("");
  const [textEdited, setTextEdited] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const isReception = selectedId === RECEPTION_CONTACT_ID;
  const person = isReception ? null : team.find((contact) => contact.id === selectedId) ?? null;
  const canCard = isReception || Boolean(person?.cardPhone);
  const canEmail = Boolean(person?.email);

  // Ao abrir: limpa e aplica a escolha sugerida (ação da IA).
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSendError(null);
    setTextEdited(false);
    setSelectedId(preset?.contactId ?? null);
    setWithCard(preset?.card ?? true);
    setWithEmail(preset?.email ?? true);
  }, [open, preset]);

  // A frase acompanha a escolha até a pessoa editar o texto.
  useEffect(() => {
    if (textEdited) return;
    if (!selectedId) {
      setText("");
      return;
    }
    if (isReception) {
      setText(contactShareText({ kind: "reception" }, { email: false, card: true }));
      return;
    }
    if (person) {
      setText(
        contactShareText(
          { kind: "team", person },
          { email: withEmail && canEmail, card: withCard && canCard }
        )
      );
    }
  }, [selectedId, isReception, person, withCard, withEmail, canCard, canEmail, textEdited]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return team;
    return team.filter((contact) =>
      normalize([contact.name, contact.position, contact.area, contact.email].filter(Boolean).join(" ")).includes(q)
    );
  }, [team, query]);
  const leaders = visible.filter((contact) => contact.isLeader);
  const others = visible.filter((contact) => !contact.isLeader);
  const showReception = !query.trim() || normalize("recepcao").includes(normalize(query.trim()));

  const sendCard = isReception ? true : withCard && canCard;
  const canSend = Boolean(selectedId) && (text.trim().length > 0 || sendCard) && !sending;

  const send = async () => {
    if (!canSend || !selectedId) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await authFetch("/api/evolution/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, contactId: selectedId, text: text.trim(), sendCard }),
      });
      const json = (await res.json().catch(() => ({}))) as { messages?: WhatsappMessage[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Não foi possível enviar o contato.");
      onSent(json.messages ?? []);
      onOpenChange(false);
    } catch (err) {
      setSendError(friendlyError(err, "Não foi possível enviar o contato."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="flex-row items-start gap-3 border-b px-6 pb-4 pt-6 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#347796]/10 text-[#285f7a]">
            <Contact className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <DialogTitle>Enviar contato</DialogTitle>
            <DialogDescription>
              Vai na conversa com {leadName}: o cartão do WhatsApp e/ou o e-mail de quem você escolher.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Quem</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, área ou e-mail"
                className="pl-9"
                aria-label="Buscar pessoa da equipe"
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border p-1">
              {showReception && (
                <ContactOption
                  selected={isReception}
                  onSelect={() => setSelectedId(RECEPTION_CONTACT_ID)}
                  icon={
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <Building2 className="size-4" aria-hidden />
                    </span>
                  }
                  title="Recepção"
                  subtitle={`WhatsApp ${formatBrazilPhone(reception.phone)}`}
                  badges={<AvailabilityBadge kind="card" />}
                />
              )}
              {!loaded && !loadError ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Carregando a equipe…
                </div>
              ) : loadError ? (
                <div className="flex items-center justify-between gap-2 px-3 py-4 text-sm text-destructive">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" aria-hidden />
                    {loadError}
                  </span>
                  <Button type="button" variant="outline" size="xs" onClick={retry}>
                    Tentar de novo
                  </Button>
                </div>
              ) : (
                <>
                  {leaders.length > 0 && <GroupLabel>Liderança</GroupLabel>}
                  {leaders.map((contact) => (
                    <TeamOption key={contact.id} contact={contact} selected={selectedId === contact.id} onSelect={setSelectedId} />
                  ))}
                  {others.length > 0 && <GroupLabel>Equipe</GroupLabel>}
                  {others.map((contact) => (
                    <TeamOption key={contact.id} contact={contact} selected={selectedId === contact.id} onSelect={setSelectedId} />
                  ))}
                  {visible.length === 0 && !showReception && (
                    <p className="px-3 py-4 text-sm text-muted-foreground">Ninguém da equipe com esse nome.</p>
                  )}
                </>
              )}
            </div>
          </section>

          {person && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">O que mandar</h3>
              <div className="flex flex-wrap gap-2">
                <ToggleChip
                  pressed={withEmail && canEmail}
                  disabled={!canEmail}
                  onClick={() => setWithEmail((value) => !value)}
                  icon={<Mail className="size-3.5" aria-hidden />}
                  label={canEmail ? "E-mail na mensagem" : "Sem e-mail no perfil"}
                />
                <ToggleChip
                  pressed={withCard && canCard}
                  disabled={!canCard}
                  onClick={() => setWithCard((value) => !value)}
                  icon={<MessageCircle className="size-3.5" aria-hidden />}
                  label={canCard ? "Cartão do WhatsApp" : "WhatsApp não liberado no perfil"}
                />
              </div>
            </section>
          )}

          {selectedId && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Mensagem</h3>
                {textEdited && (
                  <Button type="button" variant="ghost" size="xs" onClick={() => setTextEdited(false)}>
                    Voltar ao texto padrão
                  </Button>
                )}
              </div>
              <Textarea
                value={text}
                rows={4}
                onChange={(event) => {
                  setTextEdited(true);
                  setText(event.target.value);
                }}
                aria-label="Mensagem que vai junto com o contato"
              />
              <p className="text-xs text-muted-foreground">
                {sendCard ? "O cartão vai logo depois desta mensagem." : "Só a mensagem será enviada."}
              </p>
            </section>
          )}

          {sendError && (
            <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {sendError}
            </p>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canSend} onClick={() => void send()}>
            {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Contact aria-hidden />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function AvailabilityBadge({ kind }: { kind: "card" | "email" }) {
  return (
    <span
      className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
      title={kind === "card" ? "Tem cartão do WhatsApp" : "Tem e-mail profissional"}
    >
      {kind === "card" ? <MessageCircle className="size-3" aria-hidden /> : <Mail className="size-3" aria-hidden />}
    </span>
  );
}

function ContactOption({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
  badges,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  subtitle: string;
  badges?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted",
        selected && "bg-[#347796]/8 ring-1 ring-[#347796]/35"
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">{badges}</span>
      {selected && <Check className="size-4 shrink-0 text-[#347796]" aria-hidden />}
    </button>
  );
}

function TeamOption({
  contact,
  selected,
  onSelect,
}: {
  contact: TeamContact;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const area = citableArea(contact.area);
  return (
    <ContactOption
      selected={selected}
      onSelect={() => onSelect(contact.id)}
      icon={
        <Avatar className="size-9">
          {contact.avatarUrl ? <AvatarImage src={contact.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-xs">{initials(contact.name)}</AvatarFallback>
        </Avatar>
      }
      title={contact.name}
      subtitle={[contact.position, area].filter(Boolean).join(" · ") || "Equipe"}
      badges={
        <>
          {contact.email && <AvailabilityBadge kind="email" />}
          {contact.cardPhone && <AvailabilityBadge kind="card" />}
        </>
      }
    />
  );
}

function ToggleChip({
  pressed,
  disabled,
  onClick,
  icon,
  label,
}: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        pressed
          ? "border-[#347796]/40 bg-[#347796]/10 text-[#285f7a] dark:text-[#47cdd0]"
          : "bg-white text-muted-foreground hover:bg-muted dark:bg-background",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      {pressed ? <Check className="size-3.5" aria-hidden /> : icon}
      {label}
    </button>
  );
}
