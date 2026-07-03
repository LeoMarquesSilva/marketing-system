"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Layers,
  Pencil,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type EmailAreaManagerRow,
  type EmailCompany,
  type EmailContact,
  type EmailGroupResponsible,
  type EmailPerson,
} from "@/lib/email-marketing";
import type { MeusClientesSyncMeta } from "@/lib/meus-clientes-server";
import {
  clientProfileIsIncomplete,
  contactToEnrichable,
  listClientMissingFieldLabels,
  personToEnrichable,
} from "@/lib/email-marketing-enrichment";
import {
  buildAreaManagerSummary,
  buildManagerSummary,
  compareGroupsByPendingFirst,
  computeEnrichmentTotals,
  expandRootArea,
  getAreaParent,
  isSubArea,
  resolveContactGroupKey,
  totalsFromAreaGroup,
  type AreaSummaryGroup,
  type EnrichmentTotals,
  type MyClientScope,
} from "@/lib/meus-clientes";
import { EmailStatCard } from "@/components/email-marketing/email-marketing-ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { PersonEditDialog } from "./person-edit-dialog";
import { ContactCreateDialog } from "./contact-create-dialog";

type StatusFilter = "all" | "pending" | "complete";

const FILTER_SEM_AREA = "__sem_area__";

function formatSyncDate(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveGroupAreas(
  groupKey: string,
  companies: EmailCompany[],
  people: EmailPerson[],
  personAreas: Map<string, string[]>,
  responsibles: EmailGroupResponsible[] = []
): string[] {
  const set = new Set<string>();
  for (const company of companies) {
    if (resolveGroupKey(company) !== groupKey) continue;
    for (const area of company.legalAreas) set.add(area);
  }
  for (const person of people) {
    if (resolveGroupKey(person) !== groupKey) continue;
    for (const area of personAreas.get(person.id) ?? []) set.add(area);
  }
  for (const r of responsibles) {
    if (!r.area || r.clientGroupId !== groupKey) continue;
    set.add(r.area);
  }
  return Array.from(set);
}

interface ClientGroupBucket {
  key: string;
  name: string;
  clientGroupId: string | null;
  companies: EmailCompany[];
  groupPeople: EmailPerson[];
}

function resolveGroupKey(entity: { clientGroupId: string | null; clientGroupName?: string | null }): string {
  return entity.clientGroupId ?? entity.clientGroupName ?? "__sem_grupo__";
}

function personInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function isContactPending(contact: EmailContact): boolean {
  return clientProfileIsIncomplete(contactToEnrichable(contact));
}

function isPersonPending(person: EmailPerson): boolean {
  return clientProfileIsIncomplete(personToEnrichable(person));
}

function AreaBadges({ areas }: { areas: string[] }) {
  if (areas.length === 0) return null;
  return (
    <>
      {areas.map((area) => (
        <Badge
          key={area}
          variant="outline"
          className="text-[10px] text-sky-700 border-sky-200 bg-sky-50"
        >
          {area}
        </Badge>
      ))}
    </>
  );
}

function EditableRow({
  title,
  subtitle,
  npsEligible,
  partyInvite,
  areas,
  missing,
  onEdit,
}: {
  title: string;
  subtitle: string;
  npsEligible: boolean;
  partyInvite: boolean;
  areas?: string[];
  missing: string[];
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700 ring-2 ring-violet-200/60">
        {personInitials(title)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium flex items-center gap-1.5 flex-wrap">
          {title}
          {npsEligible && (
            <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200 bg-blue-50">
              NPS
            </Badge>
          )}
          {partyInvite && (
            <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-200 bg-violet-50">
              Festa 10 anos
            </Badge>
          )}
          <AreaBadges areas={areas ?? []} />
        </p>
        <p className="truncate text-xs text-muted-foreground">{subtitle || "Cadastro pendente"}</p>
      </div>
      {missing.length > 0 && (
        <Badge variant="outline" className="shrink-0 text-[10px] text-amber-700 border-amber-200 bg-amber-50">
          Falta: {missing.join(", ")}
        </Badge>
      )}
      <Button variant="ghost" size="icon-sm" onClick={onEdit} className="shrink-0">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function AreaIconBadge({ area, size = "md" }: { area: string; size?: "sm" | "md" }) {
  const Icon = getAreaIcon(area);
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg ring-1 ${box} ${getAreaIconStyle(area)}`}
      aria-hidden
    >
      <Icon className={icon} />
    </span>
  );
}

function UserAvatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "default";
}) {
  return (
    <Avatar size={size}>
      <AvatarImage src={avatarUrl || undefined} alt={name} />
      <AvatarFallback className="text-[10px] font-semibold">{personInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

function TotalSummaryBar({ title, totals }: { title: string; totals: EnrichmentTotals }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[11px]">
          {totals.groupsCount} grupo{totals.groupsCount === 1 ? "" : "s"}
        </Badge>
        {totals.groupsWithoutContact > 0 && (
          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">
            {totals.groupsWithoutContact} sem contato
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">
          {totals.profilesComplete} completo{totals.profilesComplete === 1 ? "" : "s"}
        </Badge>
        {totals.profilesPending > 0 && (
          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">
            {totals.profilesPending} pendente{totals.profilesPending === 1 ? "" : "s"}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] text-sky-700 border-sky-200 bg-sky-50">
          {totals.adjustedComplete} ajustado{totals.adjustedComplete === 1 ? "" : "s"} completo
          {totals.adjustedComplete === 1 ? "" : "s"}
        </Badge>
      </div>
    </div>
  );
}

function AreaStatsBadges({
  groupsCount,
  groupsWithoutContact,
  profilesComplete,
  profilesPending,
  compact,
}: {
  groupsCount: number;
  groupsWithoutContact: number;
  profilesComplete: number;
  profilesPending: number;
  compact?: boolean;
}) {
  const badgeClass = compact ? "text-[10px]" : "text-[11px]";
  return (
    <>
      <Badge variant="outline" className={badgeClass}>
        {groupsCount} grupo{groupsCount === 1 ? "" : "s"}
      </Badge>
      {groupsWithoutContact > 0 && (
        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">
          {groupsWithoutContact} sem contato
        </Badge>
      )}
      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">
        {profilesComplete} completo{profilesComplete === 1 ? "" : "s"}
      </Badge>
      {profilesPending > 0 && (
        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">
          {profilesPending} pendente{profilesPending === 1 ? "" : "s"}
        </Badge>
      )}
    </>
  );
}

function AreaGroupCard({
  group,
  userAvatarById,
}: {
  group: AreaSummaryGroup;
  userAvatarById: Map<string, string | null>;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border bg-card/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-2.5 px-3.5 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <AreaIconBadge area={group.area} />
        <span className="text-sm font-semibold">{group.area}</span>
        <AreaStatsBadges
          groupsCount={group.groupsCount}
          groupsWithoutContact={group.groupsWithoutContact}
          profilesComplete={group.profilesComplete}
          profilesPending={group.profilesPending}
        />
        {group.managers.length > 0 && (
          <span className="ml-auto hidden sm:inline-flex items-center -space-x-2">
            {group.managers.slice(0, 4).map((m) => (
              <UserAvatar
                key={m.userId}
                name={m.userName}
                avatarUrl={userAvatarById.get(m.userId)}
                size="sm"
              />
            ))}
            {group.managers.length > 4 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
                +{group.managers.length - 4}
              </span>
            )}
          </span>
        )}
      </button>
      {open && group.subAreas.length > 0 && (
        <div className="border-t bg-muted/5">
          {group.subAreas.map((sub) => (
            <div
              key={sub.area}
              className="flex flex-wrap items-center gap-2 border-b border-border/50 px-3.5 py-2.5 pl-11 last:border-b-0"
            >
              <AreaIconBadge area={sub.area} size="sm" />
              <span className="text-xs font-medium text-muted-foreground">{sub.area}</span>
              <AreaStatsBadges
                groupsCount={sub.groupsCount}
                groupsWithoutContact={sub.groupsWithoutContact}
                profilesComplete={sub.profilesComplete}
                profilesPending={sub.profilesPending}
                compact
              />
            </div>
          ))}
        </div>
      )}
      {open && group.managers.length > 0 && (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Gestor</th>
                <th className="px-3 py-2 text-right font-medium">Ajustados</th>
                <th className="px-3 py-2 text-right font-medium">Completos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {group.managers.map((m) => (
                <tr key={m.userId} className="hover:bg-muted/10">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar
                        name={m.userName}
                        avatarUrl={userAvatarById.get(m.userId)}
                        size="sm"
                      />
                      <span className="font-medium">{m.userName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {m.adjustedCount > 0 ? (
                      <span className="font-medium">{m.adjustedCount}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {m.adjustedComplete > 0 ? (
                      <span className="text-emerald-700 font-medium">{m.adjustedComplete}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ManagerSummaryTable({
  groups,
  totals,
  totalsTitle,
  userAvatarById,
}: {
  groups: AreaSummaryGroup[];
  totals: EnrichmentTotals;
  totalsTitle: string;
  userAvatarById: Map<string, string | null>;
}) {
  const [open, setOpen] = useState(true);
  if (groups.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        <span className="text-sm font-semibold">Visão por área e gestor ({groups.length} área{groups.length === 1 ? "" : "s"})</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t p-3 space-y-2.5 bg-muted/5">
          <TotalSummaryBar title={totalsTitle} totals={totals} />
          {groups.map((group) => (
            <AreaGroupCard key={group.area} group={group} userAvatarById={userAvatarById} />
          ))}
        </div>
      )}
    </section>
  );
}

function mergeGroupMembers(groupContacts: EmailContact[], groupPeople: EmailPerson[]) {
  const contactEmails = new Set(groupContacts.map((c) => c.email.toLowerCase()));
  const people = groupPeople.filter((p) => !p.email || !contactEmails.has(p.email.toLowerCase()));
  return { contacts: groupContacts, people };
}

function GroupSection({
  group,
  groupContacts,
  personAreas,
  defaultOpen,
  onEditContact,
  onEditPerson,
  onAddContact,
}: {
  group: ClientGroupBucket;
  groupContacts: EmailContact[];
  personAreas: Map<string, string[]>;
  defaultOpen?: boolean;
  onEditContact: (contact: EmailContact) => void;
  onEditPerson: (person: EmailPerson) => void;
  onAddContact: (group: ClientGroupBucket) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const { contacts: mergedContacts, people: mergedPeople } = mergeGroupMembers(
    groupContacts,
    group.groupPeople
  );
  const memberCount = mergedContacts.length + mergedPeople.length;
  const pendingCount =
    mergedPeople.filter(isPersonPending).length + mergedContacts.filter(isContactPending).length;

  const groupAreas = useMemo(() => {
    const set = new Set<string>();
    for (const company of group.companies) {
      for (const area of company.legalAreas) set.add(area);
    }
    for (const person of group.groupPeople) {
      for (const area of personAreas.get(person.id) ?? []) set.add(area);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [group.companies, group.groupPeople, personAreas]);

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
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="block text-base font-semibold leading-snug">{group.name}</span>
            <AreaBadges areas={groupAreas} />
          </span>
          <span className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{memberCount} contato{memberCount === 1 ? "" : "s"}</span>
            {groupAreas.length === 0 && (
              <>
                <span>·</span>
                <span className="text-muted-foreground/70">Área jurídica não identificada</span>
              </>
            )}
            {pendingCount > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <AlertCircle className="h-3 w-3" />
                  {pendingCount} pendência{pendingCount === 1 ? "" : "s"}
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
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Contatos do grupo
              </p>
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => onAddContact(group)}>
                <UserPlus className="h-3.5 w-3.5" />
                Adicionar contato
              </Button>
            </div>
            {memberCount === 0 ? (
              <p className="text-xs text-muted-foreground rounded-xl border border-dashed px-3 py-4 text-center">
                Nenhum contato cadastrado para este grupo ainda.
              </p>
            ) : (
              <div className="space-y-1.5">
                {mergedContacts
                  .slice()
                  .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, "pt-BR"))
                  .map((contact) => (
                    <EditableRow
                      key={`c-${contact.id}`}
                      title={contact.name ?? contact.email}
                      subtitle={[contact.cargo, contact.email, contact.phone].filter(Boolean).join(" · ")}
                      npsEligible={contact.npsEligible}
                      partyInvite={contact.partyInvite}
                      missing={listClientMissingFieldLabels(contactToEnrichable(contact))}
                      onEdit={() => onEditContact(contact)}
                    />
                  ))}
                {mergedPeople
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                  .map((person) => (
                    <EditableRow
                      key={`p-${person.id}`}
                      title={person.name}
                      subtitle={[person.cargo, person.email, person.phone]
                        .filter(Boolean)
                        .join(" · ")}
                      npsEligible={person.npsEligible}
                      partyInvite={person.partyInvite}
                      areas={personAreas.get(person.id) ?? []}
                      missing={listClientMissingFieldLabels(personToEnrichable(person))}
                      onEdit={() => onEditPerson(person)}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function MeusClientesClient() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [serverScope, setServerScope] = useState<MyClientScope | null>(null);
  const [companies, setCompanies] = useState<EmailCompany[]>([]);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [people, setPeople] = useState<EmailPerson[]>([]);
  const [responsibles, setResponsibles] = useState<EmailGroupResponsible[]>([]);
  const [areaManagers, setAreaManagers] = useState<EmailAreaManagerRow[]>([]);
  const [systemUsers, setSystemUsers] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [syncMeta, setSyncMeta] = useState<MeusClientesSyncMeta | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [viewAll, setViewAll] = useState(false);
  const [filterArea, setFilterArea] = useState("");
  const [filterGestor, setFilterGestor] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [editingPerson, setEditingPerson] = useState<EmailPerson | null>(null);
  const [editingContact, setEditingContact] = useState<EmailContact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creatingContactGroup, setCreatingContactGroup] = useState<ClientGroupBucket | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (viewAll) params.set("viewAll", "1");
      if (filterGestor) params.set("gestorId", filterGestor);
      const res = await fetch(`/api/meus-clientes?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar dados.");
      setCompanies(data.companies ?? []);
      setContacts(data.contacts ?? []);
      setPeople(data.people ?? []);
      setResponsibles(data.responsibles ?? []);
      setAreaManagers(data.areaManagers ?? []);
      setSystemUsers(data.systemUsers ?? []);
      setServerScope(data.scope ?? null);
      setIsAdmin(Boolean(data.isAdmin));
      setSyncMeta(data.syncMeta ?? null);
    } catch (err) {
      setToast({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao carregar Meus Clientes.",
      });
    } finally {
      setLoading(false);
    }
  }, [viewAll, filterGestor]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSync = async (mode: "responsibles" | "full" = "responsibles") => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/email-marketing/sioe-sync?mode=${mode}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao sincronizar.");
      setToast({
        type: "success",
        text:
          mode === "full"
            ? `Sync completo: ${data.contactsUpserted ?? 0} contatos, ${data.responsiblesUpserted ?? 0} responsáveis.`
            : `Responsáveis atualizados: ${data.responsiblesUpserted ?? 0} vínculos.`,
      });
      await reload();
    } catch (err) {
      setToast({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao sincronizar SIOE.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (viewAll) params.set("viewAll", "1");
    if (filterGestor) params.set("gestorId", filterGestor);
    window.open(`/api/meus-clientes/export?${params.toString()}`, "_blank");
  };

  const userNameById = useMemo(() => new Map(systemUsers.map((u) => [u.id, u.name])), [systemUsers]);
  const userAvatarById = useMemo(
    () => new Map(systemUsers.map((u) => [u.id, u.avatar_url])),
    [systemUsers]
  );

  const clientCompanies = companies;
  const clientPeople = people;
  const clientContacts = contacts;
  const clientResponsibles = responsibles;
  const scope = serverScope;
  const showAll = isAdmin && viewAll;

  const baseCompanies = clientCompanies;
  const basePeople = clientPeople;

  const companiesById = useMemo(() => new Map(clientCompanies.map((c) => [c.id, c])), [clientCompanies]);

  const contactsByGroup = useMemo(() => {
    const map = new Map<string, EmailContact[]>();
    for (const contact of clientContacts) {
      const key = resolveContactGroupKey(contact, companiesById);
      const list = map.get(key) ?? [];
      list.push(contact);
      map.set(key, list);
    }
    return map;
  }, [clientContacts, companiesById]);

  const personAreas = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of clientResponsibles) {
      if (!r.personId || !r.area) continue;
      const set = map.get(r.personId) ?? new Set<string>();
      set.add(r.area);
      map.set(r.personId, set);
    }
    const result = new Map<string, string[]>();
    for (const [personId, set] of map) {
      result.set(personId, Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR")));
    }
    return result;
  }, [clientResponsibles]);

  const allAreasList = useMemo(() => {
    const set = new Set<string>();
    for (const c of clientCompanies) {
      for (const a of c.legalAreas) set.add(getAreaParent(a));
    }
    for (const areas of personAreas.values()) {
      for (const a of areas) set.add(getAreaParent(a));
    }
    return Array.from(set)
      .filter((a) => !isSubArea(a))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [clientCompanies, personAreas]);

  const managerSummary = useMemo(
    () =>
      buildManagerSummary(
        clientCompanies,
        clientContacts,
        clientPeople,
        clientResponsibles,
        areaManagers,
        userNameById
      ),
    [clientCompanies, clientContacts, clientPeople, clientResponsibles, areaManagers, userNameById]
  );

  const areaManagerSummary = useMemo(
    () =>
      buildAreaManagerSummary(
        clientCompanies,
        clientContacts,
        clientPeople,
        clientResponsibles,
        areaManagers,
        userNameById
      ),
    [clientCompanies, clientContacts, clientPeople, clientResponsibles, areaManagers, userNameById]
  );

  const displayAreaGroups = useMemo(() => {
    let groups = areaManagerSummary;
    if (filterArea && filterArea !== FILTER_SEM_AREA) {
      groups = groups.filter((g) => g.area === getAreaParent(filterArea));
    }
    if (filterGestor) groups = groups.filter((g) => g.managers.some((m) => m.userId === filterGestor));
    return groups;
  }, [areaManagerSummary, filterArea, filterGestor]);

  const groupKeysWithoutArea = useMemo(() => {
    const keys = new Set<string>();
    for (const c of baseCompanies) keys.add(resolveGroupKey(c));
    for (const p of basePeople) keys.add(resolveGroupKey(p));
    const without = new Set<string>();
    for (const key of keys) {
      if (resolveGroupAreas(key, baseCompanies, basePeople, personAreas, clientResponsibles).length === 0)
        without.add(key);
    }
    return without;
  }, [baseCompanies, basePeople, personAreas, clientResponsibles]);

  const areaFilteredCompanies = useMemo(() => {
    if (!filterArea) return baseCompanies;
    if (filterArea === FILTER_SEM_AREA) {
      return baseCompanies.filter((c) => groupKeysWithoutArea.has(resolveGroupKey(c)));
    }
    const labels = expandRootArea(filterArea);
    return baseCompanies.filter((c) => c.legalAreas.some((a) => labels.includes(a)));
  }, [baseCompanies, filterArea, groupKeysWithoutArea]);

  const areaFilteredPeople = useMemo(() => {
    if (!filterArea) return basePeople;
    if (filterArea === FILTER_SEM_AREA) {
      return basePeople.filter((p) => groupKeysWithoutArea.has(resolveGroupKey(p)));
    }
    const labels = expandRootArea(filterArea);
    return basePeople.filter((p) => (personAreas.get(p.id) ?? []).some((a) => labels.includes(a)));
  }, [basePeople, filterArea, personAreas, groupKeysWithoutArea]);

  const groupPassesStatus = useCallback(
    (groupKey: string, groupPeople: EmailPerson[] = []) => {
      if (filterStatus === "all") return true;
      const contactList = contactsByGroup.get(groupKey) ?? [];
      const profiles = [...contactList.map(contactToEnrichable), ...groupPeople.map(personToEnrichable)];
      if (profiles.length === 0) return filterStatus === "pending";
      const anyPending = profiles.some((p) => listClientMissingFieldLabels(p).length > 0);
      return filterStatus === "pending" ? anyPending : !anyPending;
    },
    [filterStatus, contactsByGroup]
  );

  const scopedCompanies = useMemo(() => {
    if (filterStatus === "all") return areaFilteredCompanies;
    return areaFilteredCompanies.filter((c) => {
      const key = resolveGroupKey(c);
      const groupPeople = areaFilteredPeople.filter((p) => resolveGroupKey(p) === key);
      return groupPassesStatus(key, groupPeople);
    });
  }, [areaFilteredCompanies, areaFilteredPeople, filterStatus, groupPassesStatus]);

  const scopedPeople = useMemo(() => {
    if (filterStatus === "all") return areaFilteredPeople;
    return areaFilteredPeople.filter((p) =>
      filterStatus === "pending" ? isPersonPending(p) : !isPersonPending(p)
    );
  }, [areaFilteredPeople, filterStatus]);

  const summaryTotals = useMemo((): { title: string; totals: EnrichmentTotals } => {
    if (filterArea === FILTER_SEM_AREA) {
      return {
        title: "Total — sem área",
        totals: computeEnrichmentTotals(clientCompanies, clientContacts, clientPeople, {
          companyIds: new Set(areaFilteredCompanies.map((c) => c.id)),
          personIds: new Set(areaFilteredPeople.map((p) => p.id)),
        }),
      };
    }
    if (filterArea && filterArea !== FILTER_SEM_AREA) {
      const group = areaManagerSummary.find((g) => g.area === getAreaParent(filterArea));
      if (group) return { title: `Total — ${group.area}`, totals: totalsFromAreaGroup(group) };
    }
    if (filterGestor && scope) {
      const name = userNameById.get(filterGestor) ?? "Gestor";
      return {
        title: `Total — ${name}`,
        totals: computeEnrichmentTotals(clientCompanies, clientContacts, clientPeople, scope),
      };
    }
    if (filterStatus !== "all") {
      return {
        title: "Total — filtro ativo",
        totals: computeEnrichmentTotals(clientCompanies, clientContacts, clientPeople, {
          companyIds: new Set(scopedCompanies.map((c) => c.id)),
          personIds: new Set(scopedPeople.map((p) => p.id)),
        }),
      };
    }
    return {
      title: showAll || !scope ? "Total geral" : "Meus clientes",
      totals: computeEnrichmentTotals(
        clientCompanies,
        clientContacts,
        clientPeople,
        showAll || !scope ? undefined : { companyIds: scope.companyIds, personIds: scope.personIds }
      ),
    };
  }, [
    filterArea,
    filterGestor,
    filterStatus,
    areaManagerSummary,
    scope,
    clientCompanies,
    clientContacts,
    clientPeople,
    scopedCompanies,
    scopedPeople,
    userNameById,
    showAll,
    scope,
  ]);

  const displayContactsByGroup = useMemo(() => {
    if (filterStatus === "all") return contactsByGroup;
    const map = new Map<string, EmailContact[]>();
    for (const [groupKey, list] of contactsByGroup) {
      const filtered =
        filterStatus === "pending" ? list.filter(isContactPending) : list.filter((c) => !isContactPending(c));
      map.set(groupKey, filtered);
    }
    return map;
  }, [contactsByGroup, filterStatus]);

  const groups = useMemo(() => {
    const buckets = new Map<string, ClientGroupBucket>();
    for (const company of scopedCompanies) {
      const key = resolveGroupKey(company);
      const existing = buckets.get(key);
      if (existing) {
        existing.companies.push(company);
        if (!existing.clientGroupId && company.clientGroupId) existing.clientGroupId = company.clientGroupId;
      } else
        buckets.set(key, {
          key,
          name: company.clientGroupName ?? "Sem grupo",
          clientGroupId: company.clientGroupId,
          companies: [company],
          groupPeople: [],
        });
    }
    for (const person of scopedPeople) {
      const key = resolveGroupKey(person);
      const existing = buckets.get(key);
      if (existing) {
        existing.groupPeople.push(person);
        if (!existing.clientGroupId && person.clientGroupId) existing.clientGroupId = person.clientGroupId;
      } else
        buckets.set(key, {
          key,
          name: person.clientGroupName ?? "Sem grupo",
          clientGroupId: person.clientGroupId,
          companies: [],
          groupPeople: [person],
        });
    }
    return Array.from(buckets.values())
      .filter((g) => filterStatus === "all" || groupPassesStatus(g.key, g.groupPeople))
      .sort((a, b) => compareGroupsByPendingFirst(a, b, contactsByGroup, (g) => g.key));
  }, [scopedCompanies, scopedPeople, filterStatus, groupPassesStatus, contactsByGroup]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups.filter((group) => {
      if (group.name.toLowerCase().includes(q)) return true;
      if (group.companies.some((c) => c.name.toLowerCase().includes(q))) return true;
      const groupContacts = contactsByGroup.get(group.key) ?? [];
      if (groupContacts.some((c) => (c.name ?? c.email).toLowerCase().includes(q))) return true;
      return group.groupPeople.some(
        (p) => p.name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [groups, search, contactsByGroup]);

  const stats = useMemo(() => {
    const scopedGroupKeys = new Set(groups.map((g) => g.key));
    const contactEmails = new Set<string>();
    const scopedContacts = clientContacts.filter((c) => {
      if (!scopedGroupKeys.has(resolveContactGroupKey(c, companiesById))) return false;
      contactEmails.add(c.email.toLowerCase());
      return true;
    });
    const scopedPeopleDeduped = scopedPeople.filter(
      (p) =>
        scopedGroupKeys.has(resolveGroupKey(p)) &&
        (!p.email || !contactEmails.has(p.email.toLowerCase()))
    );
    const profiles = [
      ...scopedPeopleDeduped.map(personToEnrichable),
      ...scopedContacts.map(contactToEnrichable),
    ];
    const incompleto = profiles.filter((p) => listClientMissingFieldLabels(p).length > 0).length;
    return { total: profiles.length, incompleto, completo: profiles.length - incompleto };
  }, [scopedPeople, clientContacts, groups, companiesById]);

  const hasActiveFilters = Boolean(filterArea || filterGestor || filterStatus !== "all");

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Meus Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preencha e confirme e-mail, telefone, cargo e sócios dos clientes sob sua responsabilidade.
          </p>
          {syncMeta && (
            <p className="text-xs text-muted-foreground mt-2">
              Último sync SIOE: {formatSyncDate(syncMeta.lastSyncedAt)}
              {syncMeta.groupsWithoutArea > 0 && (
                <span> · {syncMeta.groupsWithoutArea} grupo{syncMeta.groupsWithoutArea === 1 ? "" : "s"} sem área</span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={syncing || !syncMeta?.configured}
                onClick={() => handleSync("responsibles")}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                Sync SIOE
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setViewAll((v) => !v)}>
                <Eye className="h-4 w-4" />
                {viewAll ? "Ver só meus clientes" : "Ver todos (admin)"}
              </Button>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <ManagerSummaryTable
          groups={displayAreaGroups}
          totals={summaryTotals.totals}
          totalsTitle={summaryTotals.title}
          userAvatarById={userAvatarById}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <EmailStatCard
          label={
            hasActiveFilters
              ? "Grupos no filtro"
              : showAll || !scope
                ? "Total de grupos"
                : "Meus grupos"
          }
          value={summaryTotals.totals.groupsCount}
        />
        <EmailStatCard label="Cadastros completos" value={stats.completo} />
        <EmailStatCard label="Cadastros pendentes" value={stats.incompleto} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo, contato ou pessoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={filterArea || "__all__"} onValueChange={(v) => setFilterArea(v === "__all__" ? "" : v)}>
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as áreas</SelectItem>
            <SelectItem value={FILTER_SEM_AREA}>Sem área</SelectItem>
            {allAreasList.map((area) => (
              <SelectItem key={area} value={area}>
                {area}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <>
            <Select value={filterGestor || "__all__"} onValueChange={(v) => setFilterGestor(v === "__all__" ? "" : v)}>
              <SelectTrigger size="sm" className="w-52">
                <SelectValue placeholder="Gestor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os gestores</SelectItem>
                {managerSummary.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.userName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="complete">Completos</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterArea("");
                  setFilterGestor("");
                  setFilterStatus("all");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </>
        )}

        {!isAdmin && filterArea && (
          <Button variant="ghost" size="sm" onClick={() => setFilterArea("")}>
            Limpar filtros
          </Button>
        )}
      </div>

      {filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
          <Users className="h-9 w-9 opacity-40" />
          <p className="text-sm font-medium text-foreground">
            {groups.length === 0
              ? "Nenhum cliente encontrado com os filtros atuais"
              : "Nenhum resultado com esta busca"}
          </p>
          <p className="text-xs max-w-sm">
            {groups.length === 0
              ? "Se você é responsável por algum cliente e não vê nada aqui, avise o admin para vincular seu usuário aos processos do SIOE em Configurações → E-mail Marketing."
              : "Tente limpar a busca."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => (
            <GroupSection
              key={group.key}
              group={group}
              groupContacts={displayContactsByGroup.get(group.key) ?? []}
              personAreas={personAreas}
              defaultOpen={false}
              onEditContact={(contact) => {
                setEditingContact(contact);
                setEditingPerson(null);
                setDialogOpen(true);
              }}
              onEditPerson={(person) => {
                setEditingPerson(person);
                setEditingContact(null);
                setDialogOpen(true);
              }}
              onAddContact={(g) => {
                setCreatingContactGroup(g);
                setCreateDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <PersonEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        person={editingPerson}
        contact={editingContact}
        onSaved={() => {
          setToast({ type: "success", text: "Cadastro salvo com sucesso." });
          reload();
        }}
      />

      <ContactCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        group={creatingContactGroup}
        onCreated={() => {
          setToast({ type: "success", text: "Contato adicionado com sucesso." });
          reload();
        }}
      />
    </div>
  );
}
