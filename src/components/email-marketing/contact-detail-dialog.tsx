"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Calendar, History, Mail, MailOpen, Pencil, Phone, RefreshCw, Send, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase/client";
import {
  EMAIL_RECIPIENT_STATUS_LABEL,
  type EmailCompany,
  type EmailContact,
  type EmailRecipientStatus,
} from "@/lib/email-marketing";
import { contactToEnrichable, getProfileCargo } from "@/lib/email-marketing-enrichment";
import { contactRdDisplayFields } from "@/lib/email-marketing-rd-fields";
import { ContactAvatar, TagList } from "./email-marketing-ui";
import { ClientLogo, clientOf, ContactStatusPill, SeloArea } from "./email-marketing-visuals";

interface ContactDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: EmailContact | null;
  company?: EmailCompany | null;
  /** Área do escritório que cuida do cliente (do grupo no SIOE). */
  area?: string | null;
  onEdit?: () => void;
}

interface RdEvent {
  event_type: string;
  event_identifier?: string;
  event_timestamp?: string;
  payload?: Record<string, unknown>;
}

interface ReceivedCampaign {
  id: string;
  status: EmailRecipientStatus;
  sentAt: string | null;
  openCount: number;
  clickCount: number;
  campaignName: string;
  campaignSentAt: string | null;
}

const RECIPIENT_TONE: Partial<Record<EmailRecipientStatus, string>> = {
  opened: "bg-[#47cdd0]/15 text-[#285f7a]",
  clicked: "bg-[#48466e]/10 text-[#48466e]",
  delivered: "bg-emerald-50 text-emerald-800",
  bounced: "bg-red-50 text-red-800",
  complained: "bg-red-50 text-red-800",
  failed: "bg-red-50 text-red-800",
  skipped: "bg-amber-50 text-amber-900",
};

function formatDate(value: string | null | undefined, withTime = true): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function Block({ icon: Icon, title, aside, children }: { icon: typeof Mail; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-[#eaf2f5] px-6 py-5 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0d2a38]">
          <Icon className="h-4 w-4 text-[#3e84a8]" />
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, icon: Icon }: { label: string; children: ReactNode; icon?: typeof Mail }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#5a717b]">{label}</dt>
      <dd className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-[#0d2a38]">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 break-words">{children}</span>
      </dd>
    </div>
  );
}

export function ContactDetailDialog({ open, onOpenChange, contact, company, area, onEdit }: ContactDetailDialogProps) {
  const [events, setEvents] = useState<RdEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [received, setReceived] = useState<ReceivedCampaign[] | null>(null);

  const rdUuid = contact?.rdUuid ?? (contact?.customFields?.rd_uuid as string | undefined);
  const contactId = contact?.id;

  useEffect(() => {
    if (!open || !rdUuid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Limpa o histórico quando o contato deixa de ser o alvo do diálogo.
      setEvents([]);
      setEventsError(null);
      return;
    }
    setEventsLoading(true);
    setEventsError(null);
    fetch(`/api/email-marketing/rd-contact-events/${rdUuid}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEvents(data.events ?? []);
      })
      .catch((err) => {
        setEventsError(err instanceof Error ? err.message : "Erro ao carregar histórico.");
        setEvents([]);
      })
      .finally(() => setEventsLoading(false));
  }, [open, rdUuid]);

  // Campanhas que o contato recebeu pelo ORQESTRAI (o histórico por pessoa, como no perfil do contato do Mailchimp).
  useEffect(() => {
    if (!open || !contactId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- "carregando" a cada contato aberto.
    setReceived(null);
    void Promise.resolve(
      supabase
        .from("email_campaign_recipients")
        .select("id, status, sent_at, open_count, click_count, email_campaigns(name, sent_at)")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(20)
    ).then(({ data }) => {
      if (cancelled) return;
      setReceived(
        ((data ?? []) as Record<string, unknown>[]).map((row) => {
          const campaign = row.email_campaigns as { name?: string; sent_at?: string | null } | null;
          return {
            id: row.id as string,
            status: row.status as EmailRecipientStatus,
            sentAt: (row.sent_at as string | null) ?? null,
            openCount: (row.open_count as number) ?? 0,
            clickCount: (row.click_count as number) ?? 0,
            campaignName: campaign?.name ?? "Campanha",
            campaignSentAt: campaign?.sent_at ?? null,
          };
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, contactId]);

  if (!contact) return null;

  const displayFields = contactRdDisplayFields(contact.customFields);
  const cargo = getProfileCargo(contactToEnrichable(contact));
  const client = clientOf(contact);
  const companyName = company?.name ?? contact.companyName ?? contact.company;
  const location = [company?.city, company?.state].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-[#eaf2f5] px-6 py-5 pr-12 text-left">
          <div className="flex items-start gap-4">
            <ContactAvatar contact={contact} className="h-12 w-12 text-sm" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg leading-snug text-[#0d2a38]">{contact.name ?? "Sem nome"}</DialogTitle>
              <DialogDescription className="mt-0.5 truncate">
                {cargo ? `${cargo} · ` : ""}
                {contact.email}
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ContactStatusPill status={contact.status} />
                {contact.source && (
                  <span className="inline-flex h-6 items-center rounded-full bg-[#f1f5f7] px-2 text-xs text-[#3b5560]">
                    Origem: {contact.source}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Cliente: o que mais orienta quem vai escrever para a pessoa. */}
          <div className="flex items-center gap-4 bg-[#f7fafb] px-6 py-4">
            <ClientLogo group={client?.group} company={client?.company ?? companyName} size="xl" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#5a717b]">Cliente</p>
              <p className="truncate font-semibold text-[#0d2a38]">{client?.group ?? companyName ?? "Sem cliente vinculado"}</p>
              {(companyName && companyName !== client?.group) || location ? (
                <p className="truncate text-sm text-[#3b5560]">{[companyName !== client?.group ? companyName : null, location].filter(Boolean).join(" · ")}</p>
              ) : null}
            </div>
            {area && <SeloArea area={area} className="hidden shrink-0 sm:inline-flex" />}
          </div>

          <Block icon={Mail} title="Contato">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="E-mail" icon={Mail}>
                <a href={`mailto:${contact.email}`} className="text-[#285f7a] underline-offset-2 hover:underline">
                  {contact.email}
                </a>
              </Field>
              <Field label="Telefone" icon={Phone}>
                {contact.phone ?? <span className="text-muted-foreground">Não informado</span>}
              </Field>
              <Field label="Cargo">{cargo ?? <span className="text-muted-foreground">Não informado</span>}</Field>
              {area && (
                <Field label="Área que cuida do cliente">
                  <SeloArea area={area} />
                </Field>
              )}
              <Field label="Na base desde" icon={Calendar}>
                {formatDate(contact.createdAt, false)}
              </Field>
              {contact.unsubscribedAt && (
                <Field label="Descadastrou em" icon={Calendar}>
                  {formatDate(contact.unsubscribedAt)}
                </Field>
              )}
            </dl>
          </Block>

          {contact.tags.length > 0 && (
            <Block icon={Tag} title="Tags">
              <TagList tags={contact.tags} max={30} />
            </Block>
          )}

          <Block icon={Send} title="Campanhas recebidas">
            {received === null ? (
              <div className="h-10 animate-pulse rounded-md bg-[#f4f6f8]" />
            ) : received.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não recebeu nenhuma campanha pelo ORQESTRAI.</p>
            ) : (
              <ul className="divide-y divide-[#eaf2f5]">
                {received.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#0d2a38]">{item.campaignName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.sentAt ?? item.campaignSentAt)}</p>
                    </div>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs", RECIPIENT_TONE[item.status] ?? "bg-[#eef2f4] text-[#4b5b66]")}>
                      {(item.status === "opened" || item.status === "clicked") && <MailOpen className="h-3 w-3" />}
                      {EMAIL_RECIPIENT_STATUS_LABEL[item.status]}
                      {item.clickCount > 1 && ` · ${item.clickCount}×`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          {displayFields.length > 0 && (
            <Block icon={Mail} title="Informações do RD Station">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {displayFields.map((field) => (
                  <Field key={field.key} label={field.label}>
                    {field.value}
                  </Field>
                ))}
              </dl>
            </Block>
          )}

          {rdUuid && (
            <Block
              icon={History}
              title="Histórico no RD"
              aside={
                contact.rdSyncedAt ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    Sincronizado {formatDate(contact.rdSyncedAt)}
                  </span>
                ) : null
              }
            >
              {eventsLoading ? (
                <div className="h-10 animate-pulse rounded-md bg-[#f4f6f8]" />
              ) : eventsError ? (
                <p className="text-sm text-muted-foreground">{eventsError}</p>
              ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conversão ou oportunidade registrada para este contato.</p>
              ) : (
                <ul className="divide-y divide-[#eaf2f5]">
                  {events.map((event, index) => (
                    <li key={`${event.event_timestamp}-${index}`} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0d2a38]">{event.event_identifier ?? event.event_type}</p>
                        <p className="text-xs text-muted-foreground">{event.event_type === "CONVERSION" ? "Conversão" : "Oportunidade"}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(event.event_timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#eaf2f5] bg-white px-6 py-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {onEdit && (
            <Button className="gap-1.5" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Editar contato
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
