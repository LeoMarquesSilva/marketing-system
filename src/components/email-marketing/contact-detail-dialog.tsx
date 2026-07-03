"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  History,
  Mail,
  Phone,
  RefreshCw,
  Tag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EMAIL_CONTACT_STATUS_LABEL,
  type EmailCompany,
  type EmailContact,
  type EmailContactStatus,
} from "@/lib/email-marketing";
import { contactRdDisplayFields } from "@/lib/email-marketing-rd-fields";
import { ContactAvatar, TagList } from "./email-marketing-ui";

interface ContactDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: EmailContact | null;
  company?: EmailCompany | null;
  onEdit?: () => void;
}

interface RdEvent {
  event_type: string;
  event_identifier?: string;
  event_timestamp?: string;
  payload?: Record<string, unknown>;
}

const STATUS_VARIANT: Record<EmailContactStatus, "default" | "secondary" | "destructive" | "outline"> = {
  subscribed: "default",
  unsubscribed: "secondary",
  bounced: "destructive",
  complained: "destructive",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactDetailDialog({
  open,
  onOpenChange,
  contact,
  company,
  onEdit,
}: ContactDetailDialogProps) {
  const [events, setEvents] = useState<RdEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const rdUuid = contact?.rdUuid ?? (contact?.customFields?.rd_uuid as string | undefined);

  useEffect(() => {
    if (!open || !rdUuid) {
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

  if (!contact) return null;

  const displayFields = contactRdDisplayFields(contact.customFields);
  const companyName = company?.name ?? contact.companyName ?? contact.company;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-5 shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <ContactAvatar contact={contact} className="h-11 w-11 text-sm" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-left leading-snug">
                {contact.name ?? "Sem nome"}
              </DialogTitle>
              <p className="mt-1 truncate text-sm text-muted-foreground">{contact.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={STATUS_VARIANT[contact.status]}>
                  {EMAIL_CONTACT_STATUS_LABEL[contact.status]}
                </Badge>
                {contact.source && (
                  <Badge variant="outline" className="font-normal">
                    {contact.source}
                  </Badge>
                )}
              </div>
            </div>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                Editar
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="rounded-xl shadow-none">
              <CardContent className="flex items-start gap-2.5 p-3">
                <Phone className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Telefone</p>
                  <p className="mt-0.5 text-sm font-medium">{contact.phone ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-none">
              <CardContent className="flex items-start gap-2.5 p-3">
                <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Empresa</p>
                  <p className="mt-0.5 text-sm font-medium">{companyName ?? "—"}</p>
                  {(company?.city || company?.state) && (
                    <p className="text-xs text-muted-foreground">
                      {[company?.city, company?.state].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {contact.tags.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Tags</p>
              </div>
              <TagList tags={contact.tags} max={20} />
            </div>
          )}

          {displayFields.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Informações do RD Station</p>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2">
                {displayFields.map((field) => (
                  <div key={field.key} className="rounded-xl border bg-muted/20 px-3 py-2.5">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {field.label}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium break-words">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {displayFields.length === 0 && !rdUuid && (
            <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              Nenhum campo adicional cadastrado. Sincronize com o RD Station em Configurações para
              importar cargo, CNPJ, cidade e demais campos personalizados.
            </div>
          )}

          {rdUuid && (
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Histórico no RD</p>
                </div>
                {contact.rdSyncedAt && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    Sync {formatDate(contact.rdSyncedAt)}
                  </span>
                )}
              </div>

              {eventsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : eventsError ? (
                <p className="text-sm text-muted-foreground">{eventsError}</p>
              ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conversão ou oportunidade registrada para este contato.
                </p>
              ) : (
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div key={`${event.event_timestamp}-${index}`} className="rounded-xl border px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {event.event_identifier ?? event.event_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {event.event_type === "CONVERSION" ? "Conversão" : "Oportunidade"}
                          </p>
                        </div>
                        <span className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(event.event_timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-2 text-xs text-muted-foreground">
                A API do RD não expõe aberturas/cliques por contato individualmente. O histórico de
                e-mails enviados está na aba Campanhas.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
