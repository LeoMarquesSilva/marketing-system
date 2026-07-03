"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronRight,
  Layers,
  Search,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { EmailCompany, EmailContact, EmailPerson } from "@/lib/email-marketing";
import {
  computeEnrichmentStats,
  contactToEnrichable,
  listMissingFieldLabels,
  matchesEnrichmentFilter,
  personToEnrichable,
  type EnrichmentFilterId,
} from "@/lib/email-marketing-enrichment";
import { CompanyDetailDialog } from "./company-detail-dialog";
import { EnrichmentFiltersBar } from "./enrichment-filters";
import { ContactAvatar, EmailStatCard } from "./email-marketing-ui";

interface CompaniesTabProps {
  companies: EmailCompany[];
  contacts: EmailContact[];
  people: EmailPerson[];
}

interface ClientGroupBucket {
  key: string;
  id: string | null;
  name: string;
  companies: EmailCompany[];
  groupPeople: EmailPerson[];
  pendingCount: number;
}

function resolveGroupKey(entity: { clientGroupId: string | null; clientGroupName?: string | null }): string {
  return entity.clientGroupId ?? entity.clientGroupName ?? "__sem_grupo__";
}

function buildGroupBuckets(companies: EmailCompany[], people: EmailPerson[]): ClientGroupBucket[] {
  const buckets = new Map<string, ClientGroupBucket>();

  for (const company of companies) {
    const key = resolveGroupKey(company);
    const existing = buckets.get(key);
    if (existing) {
      existing.companies.push(company);
      continue;
    }
    buckets.set(key, {
      key,
      id: company.clientGroupId,
      name: company.clientGroupName ?? "Sem grupo",
      companies: [company],
      groupPeople: [],
      pendingCount: 0,
    });
  }

  for (const person of people) {
    const key = resolveGroupKey(person);
    const name = person.clientGroupName ?? "Sem grupo";
    const existing = buckets.get(key);
    if (existing) {
      existing.groupPeople.push(person);
      continue;
    }
    buckets.set(key, {
      key,
      id: person.clientGroupId,
      name,
      companies: [],
      groupPeople: [person],
      pendingCount: 0,
    });
  }

  return Array.from(buckets.values()).sort((a, b) => {
    if (a.key === "__sem_grupo__") return 1;
    if (b.key === "__sem_grupo__") return -1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function personInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function PersonRow({ person }: { person: EmailPerson }) {
  const missing = listMissingFieldLabels(personToEnrichable(person));

  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700 ring-2 ring-violet-200/60">
        {personInitials(person.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{person.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[person.cargo, person.area, person.email, person.phone, person.cpfCnpj]
            .filter(Boolean)
            .join(" · ") || "Cadastro pendente"}
        </p>
      </div>
      {missing.length > 0 && (
        <Badge variant="outline" className="shrink-0 text-[10px] text-amber-700 border-amber-200 bg-amber-50">
          Falta: {missing.join(", ")}
        </Badge>
      )}
    </div>
  );
}

function ContactRow({ contact }: { contact: EmailContact }) {
  const missing = listMissingFieldLabels(contactToEnrichable(contact));

  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2">
      <ContactAvatar contact={contact} className="h-7 w-7 text-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{contact.name ?? "Sem nome"}</p>
        <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
      </div>
      {missing.length > 0 && (
        <Badge variant="outline" className="shrink-0 text-[10px] text-amber-700 border-amber-200 bg-amber-50">
          Falta: {missing.join(", ")}
        </Badge>
      )}
    </div>
  );
}

function CompanyRow({
  company,
  contacts,
  onOpen,
}: {
  company: EmailCompany;
  contacts: EmailContact[];
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const location = [company.city, company.state].filter(Boolean).join(" · ");
  const pendingInCompany = contacts.filter((c) =>
    listMissingFieldLabels(contactToEnrichable(c)).length > 0
  ).length;

  return (
    <div className="rounded-xl border bg-card/80 overflow-hidden">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted/60"
          aria-label={open ? "Recolher empresa" : "Expandir empresa"}
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-start gap-3 text-left hover:opacity-90"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{company.name}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {[company.cnpj, location].filter(Boolean).join(" · ") || "Sem CNPJ/local"}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="outline" className="text-[11px]">
            {contacts.length} contato{contacts.length === 1 ? "" : "s"}
          </Badge>
          {pendingInCompany > 0 && (
            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">
              {pendingInCompany} pendente{pendingInCompany === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t bg-muted/10 px-3 py-2 space-y-1.5">
          {contacts.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Nenhum contato vinculado.</p>
          ) : (
            contacts.map((contact) => <ContactRow key={contact.id} contact={contact} />)
          )}
        </div>
      )}
    </div>
  );
}

function ClientGroupSection({
  group,
  contactsByCompany,
  defaultOpen,
  onOpenCompany,
}: {
  group: ClientGroupBucket;
  contactsByCompany: Map<string, EmailContact[]>;
  defaultOpen?: boolean;
  onOpenCompany: (company: EmailCompany) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <section className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-muted/20 transition-colors"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700">
          <Layers className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold leading-snug">{group.name}</span>
          <span className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{group.companies.length} empresa{group.companies.length === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>{group.groupPeople.length} pessoa{group.groupPeople.length === 1 ? "" : "s"}</span>
            {group.pendingCount > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <AlertCircle className="h-3 w-3" />
                  {group.pendingCount} pendência{group.pendingCount === 1 ? "" : "s"}
                </span>
              </>
            )}
          </span>
        </span>
        {open ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4 bg-muted/5">
          {group.companies.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Empresas</p>
              <div className="space-y-2">
                {group.companies
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                  .map((company) => (
                    <CompanyRow
                      key={company.id}
                      company={company}
                      contacts={contactsByCompany.get(company.id) ?? []}
                      onOpen={() => onOpenCompany(company)}
                    />
                  ))}
              </div>
            </div>
          )}

          {group.groupPeople.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                Pessoas do grupo
              </p>
              <div className="space-y-1.5">
                {group.groupPeople
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                  .map((person) => (
                    <PersonRow key={person.id} person={person} />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function CompaniesTab({ companies, contacts, people }: CompaniesTabProps) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("__all__");
  const [enrichmentFilter, setEnrichmentFilter] = useState<EnrichmentFilterId>("all");
  const [onlyPendingGroups, setOnlyPendingGroups] = useState(false);
  const [selected, setSelected] = useState<EmailCompany | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const allProfiles = useMemo(
    () => [...people.map(personToEnrichable), ...contacts.map(contactToEnrichable)],
    [people, contacts]
  );

  const enrichmentStats = useMemo(() => computeEnrichmentStats(allProfiles), [allProfiles]);

  const groupOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of people) {
      const key = resolveGroupKey(person);
      if (key !== "__sem_grupo__") map.set(key, person.clientGroupName ?? "Sem grupo");
    }
    for (const company of companies) {
      const key = resolveGroupKey(company);
      if (key !== "__sem_grupo__") map.set(key, company.clientGroupName ?? "Sem grupo");
    }
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [people, companies]);

  const filteredPeople = useMemo(() => {
    return people.filter((person) => {
      if (groupFilter !== "__all__" && resolveGroupKey(person) !== groupFilter) return false;
      return matchesEnrichmentFilter(personToEnrichable(person), enrichmentFilter);
    });
  }, [people, groupFilter, enrichmentFilter]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      if (groupFilter !== "__all__" && resolveGroupKey(contact) !== groupFilter) return false;
      return matchesEnrichmentFilter(contactToEnrichable(contact), enrichmentFilter);
    });
  }, [contacts, groupFilter, enrichmentFilter]);

  const contactsByCompany = useMemo(() => {
    const map = new Map<string, EmailContact[]>();
    for (const contact of filteredContacts) {
      if (!contact.companyId) continue;
      const list = map.get(contact.companyId) ?? [];
      list.push(contact);
      map.set(contact.companyId, list);
    }
    return map;
  }, [filteredContacts]);

  const filteredCompanies = useMemo(() => {
    if (groupFilter === "__all__") return companies;
    return companies.filter((company) => resolveGroupKey(company) === groupFilter);
  }, [companies, groupFilter]);

  const groups = useMemo(() => {
    const buckets = buildGroupBuckets(filteredCompanies, filteredPeople);

    return buckets
      .map((group) => {
        const visibleCompanies =
          enrichmentFilter === "all"
            ? group.companies
            : group.companies.filter((company) => (contactsByCompany.get(company.id)?.length ?? 0) > 0);

        const pendingCount =
          group.groupPeople.filter((p) => profileIsIncompleteLocal(p)).length +
          group.companies.reduce((sum, company) => {
            const companyContacts = contactsByCompany.get(company.id) ?? [];
            return (
              sum +
              companyContacts.filter((c) => listMissingFieldLabels(contactToEnrichable(c)).length > 0).length
            );
          }, 0);

        return { ...group, companies: visibleCompanies, pendingCount };
      })
      .filter((group) => {
        if (onlyPendingGroups && group.pendingCount === 0) return false;
        if (enrichmentFilter !== "all" && group.companies.length === 0 && group.groupPeople.length === 0) {
          return false;
        }
        return true;
      });
  }, [filteredCompanies, filteredPeople, contactsByCompany, enrichmentFilter, onlyPendingGroups]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups
      .map((group) => {
        if (group.name.toLowerCase().includes(q)) return group;
        const matchedCompanies = group.companies.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.city ?? "").toLowerCase().includes(q) ||
            (c.cnpj ?? "").includes(q)
        );
        const matchedPeople = group.groupPeople.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.email ?? "").toLowerCase().includes(q) ||
            (p.cargo ?? "").toLowerCase().includes(q) ||
            (p.cpfCnpj ?? "").includes(q)
        );
        if (matchedCompanies.length === 0 && matchedPeople.length === 0) return null;
        return { ...group, companies: matchedCompanies, groupPeople: matchedPeople };
      })
      .filter(Boolean) as ClientGroupBucket[];
  }, [groups, search]);

  const visiblePeopleCount = filteredPeople.length + filteredContacts.length;

  const openCompany = (company: EmailCompany) => {
    setSelected(company);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <EmailStatCard label="Grupos" value={groupOptions.length} hint="Grupo Cliente (SIOE)" />
        <EmailStatCard label="Pessoas" value={people.length + contacts.length} />
        <EmailStatCard label="Cadastros incompletos" value={enrichmentStats.incompleto} />
        <EmailStatCard label="Sem e-mail" value={enrichmentStats.semEmail} hint="Prioridade para gestores" />
      </div>

      <EnrichmentFiltersBar
        groupOptions={groupOptions}
        groupFilter={groupFilter}
        onGroupFilterChange={setGroupFilter}
        enrichmentFilter={enrichmentFilter}
        onEnrichmentFilterChange={setEnrichmentFilter}
        onlyPendingGroups={onlyPendingGroups}
        onOnlyPendingGroupsChange={setOnlyPendingGroups}
        stats={enrichmentStats}
        resultCount={visiblePeopleCount}
      />

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo, empresa ou pessoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-80"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {filteredGroups.length} grupo{filteredGroups.length === 1 ? "" : "s"} visíveis
        </p>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
          <Building2 className="h-9 w-9 opacity-40" />
          <p className="text-sm font-medium text-foreground">Nenhum resultado com estes filtros</p>
          <p className="text-xs max-w-sm">
            Tente limpar os filtros ou escolher outra pendência (sem e-mail, sem cargo, etc.).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group, index) => (
            <ClientGroupSection
              key={group.key}
              group={group}
              contactsByCompany={contactsByCompany}
              defaultOpen={index === 0 || filteredGroups.length === 1}
              onOpenCompany={openCompany}
            />
          ))}
        </div>
      )}

      <CompanyDetailDialog open={detailOpen} onOpenChange={setDetailOpen} company={selected} />
    </div>
  );
}

function profileIsIncompleteLocal(person: EmailPerson): boolean {
  return listMissingFieldLabels(personToEnrichable(person)).length > 0;
}
