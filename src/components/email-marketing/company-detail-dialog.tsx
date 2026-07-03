"use client";

import { useEffect, useState } from "react";
import { Building2, Globe, Link2, MapPin, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  EMAIL_CONTACT_STATUS_LABEL,
  fetchEmailCompanyContacts,
  type EmailCompany,
  type EmailContact,
  type EmailContactStatus,
} from "@/lib/email-marketing";
import { ContactAvatar } from "./email-marketing-ui";

interface CompanyDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: EmailCompany | null;
}

const STATUS_VARIANT: Record<EmailContactStatus, "default" | "secondary" | "destructive" | "outline"> = {
  subscribed: "default",
  unsubscribed: "secondary",
  bounced: "destructive",
  complained: "destructive",
};

export function CompanyDetailDialog({ open, onOpenChange, company }: CompanyDetailDialogProps) {
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !company) return;
    setLoading(true);
    fetchEmailCompanyContacts(company.id)
      .then(setContacts)
      .finally(() => setLoading(false));
  }, [open, company]);

  if (!company) return null;

  const location = [company.city, company.state, company.country].filter(Boolean).join(" · ");
  const subscribedCount = contacts.filter((c) => c.status === "subscribed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-5 shrink-0">
          <div className="flex items-start gap-3 pr-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-left leading-snug">{company.name}</DialogTitle>
              {company.clientGroupName && (
                <p className="mt-1 text-xs font-medium text-violet-700">{company.clientGroupName}</p>
              )}
              {company.cnpj && (
                <p className="mt-1 text-xs text-muted-foreground">{company.cnpj}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="rounded-xl shadow-none">
              <CardContent className="p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contatos</p>
                <p className="mt-1 text-xl font-semibold">{company.contactCount ?? contacts.length}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-none">
              <CardContent className="p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Inscritos</p>
                <p className="mt-1 text-xl font-semibold text-emerald-600">{subscribedCount}</p>
              </CardContent>
            </Card>
            {location && (
              <Card className="rounded-xl shadow-none col-span-2">
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Localização</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {location}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {(company.website || company.linkedin) && (
            <div className="flex flex-wrap gap-2">
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Website
                </a>
              )}
              {company.linkedin && (
                <a
                  href={company.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  LinkedIn
                </a>
              )}
            </div>
          )}

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Contatos vinculados</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                Nenhum contato vinculado a esta empresa.
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:bg-muted/20"
                  >
                    <ContactAvatar contact={contact} className="h-8 w-8 text-[10px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{contact.name ?? "Sem nome"}</p>
                      <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[contact.status]} className="shrink-0">
                      {EMAIL_CONTACT_STATUS_LABEL[contact.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
