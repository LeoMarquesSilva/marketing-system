"use client";

import { useEffect, useState } from "react";
import { Globe, Link2, MapPin, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchEmailCompanyContacts, type EmailCompany, type EmailContact } from "@/lib/email-marketing";
import { contactToEnrichable, getProfileCargo } from "@/lib/email-marketing-enrichment";
import { ContactAvatar } from "./email-marketing-ui";
import { ClientLogo, ContactStatusPill, PeopleStack, SeloArea, useTeam } from "./email-marketing-visuals";

interface CompanyDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: EmailCompany | null;
}

export function CompanyDetailDialog({ open, onOpenChange, company }: CompanyDetailDialogProps) {
  const team = useTeam();
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !company) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- O estado de carregamento acompanha a abertura e a empresa selecionada.
    setLoading(true);
    fetchEmailCompanyContacts(company.id)
      .then(setContacts)
      .finally(() => setLoading(false));
  }, [open, company]);

  if (!company) return null;

  const location = [company.city, company.state, company.country].filter(Boolean).join(" · ");
  const subscribedCount = contacts.filter((c) => c.status === "subscribed").length;
  const responsibles = company.responsibleUserIds.map((id) => team.get(id)).filter((m): m is NonNullable<typeof m> => Boolean(m));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-[#eaf2f5] px-6 py-5 pr-12 text-left">
          <div className="flex items-start gap-4">
            <ClientLogo group={company.clientGroupName} company={company.name} size="xl" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg leading-snug text-[#0d2a38]">{company.name}</DialogTitle>
              <DialogDescription className="mt-0.5">
                {[company.clientGroupName, company.cnpj].filter(Boolean).join(" · ") || "Sem grupo e CNPJ"}
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {company.responsibleArea && <SeloArea area={company.responsibleArea} />}
                {location && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#3b5560]">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 bg-[#f7fafb] px-6 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[#5a717b]">Contatos</p>
              <p className="text-2xl font-semibold tabular-nums text-[#0d2a38]">{company.contactCount ?? contacts.length}</p>
            </div>
            <div>
              <p className="text-xs text-[#5a717b]">Inscritos</p>
              <p className="text-2xl font-semibold tabular-nums text-emerald-700">{loading ? "—" : subscribedCount}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-[#5a717b]">Quem cuida</p>
              {responsibles.length ? (
                <div className="mt-1 flex items-center gap-2">
                  <PeopleStack people={responsibles} size="sm" />
                  {responsibles.length === 1 && <span className="truncate text-sm text-[#0d2a38]">{responsibles[0].name.split(" ")[0]}</span>}
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Ninguém vinculado</p>
              )}
            </div>
          </div>

          {(company.website || company.linkedin) && (
            <div className="flex flex-wrap gap-2 border-t border-[#eaf2f5] px-6 py-3">
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dce9eb] px-2.5 text-sm text-[#285f7a] hover:bg-[#eaf2f5]"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Site
                </a>
              )}
              {company.linkedin && (
                <a
                  href={company.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dce9eb] px-2.5 text-sm text-[#285f7a] hover:bg-[#eaf2f5]"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  LinkedIn
                </a>
              )}
            </div>
          )}

          <section className="space-y-2 border-t border-[#eaf2f5] px-6 py-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0d2a38]">
              <Users className="h-4 w-4 text-[#3e84a8]" />
              Contatos da empresa
            </h3>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-11 animate-pulse rounded-md bg-[#f4f6f8]" />
                ))}
              </div>
            ) : contacts.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nenhum contato vinculado a esta empresa.</p>
            ) : (
              <ul className="divide-y divide-[#eaf2f5]">
                {contacts.map((contact) => {
                  const cargo = getProfileCargo(contactToEnrichable(contact));
                  return (
                    <li key={contact.id} className="flex items-center gap-3 py-2.5">
                      <ContactAvatar contact={contact} className="h-8 w-8 text-[10px]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#0d2a38]">{contact.name ?? "Sem nome"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {cargo ? `${cargo} · ` : ""}
                          {contact.email}
                        </p>
                      </div>
                      <ContactStatusPill status={contact.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="flex shrink-0 justify-end border-t border-[#eaf2f5] bg-white px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
