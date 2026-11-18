"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Building2, ChevronDown, Mail, MapPin, UserRound, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmailCompany, EmailContact, EmailPerson } from "@/lib/email-marketing";
import { contactToEnrichable, getProfileCargo } from "@/lib/email-marketing-enrichment";
import { ContactAvatar } from "./email-marketing-ui";
import { contactMissing, personMissing, type ClientGroupBucket } from "./client-groups";
import { ClientLogo, ContactStatusPill, PersonPhoto, SeloArea, shortName, useTeam } from "./email-marketing-visuals";

function Missing({ fields }: { fields: string[] }) {
  if (!fields.length) return null;
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-amber-50 px-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
      Falta {fields.join(", ").toLowerCase()}
    </span>
  );
}

function Block({ icon: Icon, title, count, children }: { icon: typeof Mail; title: string; count: number; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-[#eaf2f5] px-6 py-5 first:border-t-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0d2a38]">
        <Icon className="h-4 w-4 text-[#3e84a8]" />
        {title}
        <span className="rounded-full bg-[#eaf2f5] px-1.5 text-xs font-medium tabular-nums text-[#285f7a]">{count}</span>
      </h3>
      {children}
    </section>
  );
}

function ContactLine({ contact }: { contact: EmailContact }) {
  const cargo = getProfileCargo(contactToEnrichable(contact));
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <ContactAvatar contact={contact} className="h-8 w-8 text-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#0d2a38]">{contact.name ?? "Sem nome"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {cargo ? `${cargo} · ` : ""}
          {contact.email}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-11 sm:pl-0">
        <Missing fields={contactMissing(contact)} />
        <ContactStatusPill status={contact.status} />
      </div>
    </li>
  );
}

function PersonLine({ person }: { person: EmailPerson }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1f3f5] text-[#7a8b94]">
        <UserRound className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#0d2a38]">{person.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[person.cargo, person.email, person.phone].filter(Boolean).join(" · ") || "Só o nome no SIOE"}
        </p>
      </div>
      <div className="pl-11 sm:pl-0">
        <Missing fields={personMissing(person)} />
      </div>
    </li>
  );
}

function CompanyBlock({ company, contacts }: { company: EmailCompany; contacts: EmailContact[] }) {
  const [open, setOpen] = useState(false);
  const location = [company.city, company.state].filter(Boolean).join(" · ");
  return (
    <li className="py-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-[#f5f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eaf2f5] text-[#285f7a]">
          <Building2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[#0d2a38]">{company.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[company.cnpj, location].filter(Boolean).join(" · ") || "Sem CNPJ e cidade"}
          </span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-[#3b5560]">
          {contacts.length} contato{contacts.length === 1 ? "" : "s"}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-4 border-l border-[#eaf2f5] pl-4">
          {contacts.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">Nenhum contato com e-mail nesta empresa.</p>
          ) : (
            <ul className="divide-y divide-[#eaf2f5]">
              {contacts.map((contact) => (
                <ContactLine key={contact.id} contact={contact} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** Ficha do cliente: quem cuida, empresas, contatos com e-mail e pessoas do SIOE com o que falta preencher. */
export function ClientGroupDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ClientGroupBucket | null;
}) {
  const team = useTeam();
  const responsibles = useMemo(
    () => (group?.responsibleUserIds ?? []).map((id) => team.get(id)).filter((m): m is NonNullable<typeof m> => Boolean(m)),
    [group, team]
  );

  if (!group) return null;

  const contactsByCompany = new Map<string, EmailContact[]>();
  const looseContacts: EmailContact[] = [];
  const companyIds = new Set(group.companies.map((c) => c.id));
  for (const contact of group.contacts) {
    if (contact.companyId && companyIds.has(contact.companyId)) {
      const list = contactsByCompany.get(contact.companyId) ?? [];
      list.push(contact);
      contactsByCompany.set(contact.companyId, list);
    } else looseContacts.push(contact);
  }
  const percent = group.profiles ? Math.round((group.complete / group.profiles) * 100) : 0;
  const cities = Array.from(
    new Set(
      group.companies
        .map((c) => [c.city, c.state].filter((v) => v && !/n[aã]o informad/i.test(v)).join(" · "))
        .filter(Boolean)
    )
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-[#eaf2f5] px-6 py-5 pr-12 text-left">
          <div className="flex items-start gap-4">
            <ClientLogo group={group.name} size="xl" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg leading-snug text-[#0d2a38]">{group.name}</DialogTitle>
              <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  {group.companies.length} empresa{group.companies.length === 1 ? "" : "s"} · {group.contacts.length} contato
                  {group.contacts.length === 1 ? "" : "s"} com e-mail
                </span>
                {cities.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {cities.slice(0, 2).join(", ")}
                    {cities.length > 2 && ` e mais ${cities.length - 2}`}
                  </span>
                )}
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {group.area && <SeloArea area={group.area} />}
                {group.inactive && (
                  <span className="inline-flex h-6 items-center rounded-full bg-[#eef2f4] px-2 text-xs font-medium text-[#4b5b66]">Cliente inativo</span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 bg-[#f7fafb] px-6 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="text-xs text-[#5a717b]">Quem cuida no escritório</p>
              {responsibles.length ? (
                <ul className="mt-2 space-y-1.5">
                  {responsibles.slice(0, 4).map((person) => (
                    <li key={person.id} className="flex items-center gap-2">
                      <PersonPhoto name={person.name} photo={person.photo} size="sm" />
                      <span className="truncate text-sm text-[#0d2a38]">{shortName(person.name)}</span>
                    </li>
                  ))}
                  {responsibles.length > 4 && <li className="text-xs text-muted-foreground">e mais {responsibles.length - 4}</li>}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Ninguém vinculado no SIOE</p>
              )}
            </div>
            <div>
              <p className="text-xs text-[#5a717b]">Cadastro</p>
              <p className="mt-1 text-sm text-[#0d2a38]">
                <strong className="text-2xl font-semibold tabular-nums">{percent}%</strong>{" "}
                <span className="text-[#3b5560]">
                  completo · {group.complete} de {group.profiles}
                </span>
              </p>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#e3edf0]">
                <span
                  className={cn("block h-full rounded-full", percent >= 80 ? "bg-emerald-500" : percent >= 40 ? "bg-amber-500" : "bg-rose-500")}
                  style={{ width: `${Math.max(percent, group.profiles ? 3 : 0)}%` }}
                />
              </span>
              <p className="mt-1.5 text-xs text-[#5a717b]">
                {group.subscribed} inscrito{group.subscribed === 1 ? "" : "s"} recebe{group.subscribed === 1 ? "" : "m"} campanhas
              </p>
            </div>
          </div>

          {group.companies.length > 0 && (
            <Block icon={Building2} title="Empresas" count={group.companies.length}>
              <ul className="divide-y divide-[#eaf2f5]">
                {group.companies
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                  .map((company) => (
                    <CompanyBlock key={company.id} company={company} contacts={contactsByCompany.get(company.id) ?? []} />
                  ))}
              </ul>
            </Block>
          )}

          {looseContacts.length > 0 && (
            <Block icon={Users} title={group.companies.length ? "Outros contatos do cliente" : "Contatos"} count={looseContacts.length}>
              <ul className="divide-y divide-[#eaf2f5]">
                {looseContacts.map((contact) => (
                  <ContactLine key={contact.id} contact={contact} />
                ))}
              </ul>
            </Block>
          )}

          {group.people.length > 0 && (
            <Block icon={UserRound} title="Pessoas do SIOE" count={group.people.length}>
              <p className="text-xs text-[#5a717b]">Cadastro de pessoas do cliente; quem não tem e-mail não recebe campanhas.</p>
              <ul className="divide-y divide-[#eaf2f5]">
                {group.people
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                  .map((person) => (
                    <PersonLine key={person.id} person={person} />
                  ))}
              </ul>
            </Block>
          )}
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
