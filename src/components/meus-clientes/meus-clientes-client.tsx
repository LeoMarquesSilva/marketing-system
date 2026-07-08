"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  Eye,
  LayoutList,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  emptySioeClienteAtividadeIndex,
  grupoClienteKey,
  listSioeOnlyInactiveGroups,
  type SioeClienteAtividadeIndex,
} from "@/lib/sioe-cliente-atividade";
import {
  resolveGroupAtividade,
  type ClientGroupGestorStatus,
} from "@/lib/client-group-gestor-status";
import {
  clientProfileIsIncomplete,
  contactToClientProfile,
  listClientMissingFieldLabels,
  personToClientProfile,
} from "@/lib/email-marketing-enrichment";
import {
  buildAreaManagerSummary,
  buildClientGroupKeysForAreaFilter,
  buildManagerSummary,
  compareGroupsByPendingFirst,
  computeEnrichmentTotals,
  computeMyClientScope,
  resolveClientGroupAreas,
  filterPeopleNotInContacts,
  getAreaParent,
  groupHasNoContacts,
  groupIsPending,
  resolveContactGroupKey,
  isSubArea,
  totalsFromAreaGroup,
} from "@/lib/meus-clientes";
import { PersonEditDialog } from "./person-edit-dialog";
import { ContactCreateDialog } from "./contact-create-dialog";
import { GroupStatusDialog } from "./group-status-dialog";
import { MeusClientesTour } from "./meus-clientes-tour";
import { useAuth } from "@/contexts/auth-context";
import {
  MeusClientesTourProvider,
  useMeusClientesTour,
} from "@/contexts/meus-clientes-tour-context";
import { MEUS_CLIENTES_TOUR_EXPAND_STEPS } from "@/lib/meus-clientes-tour";
import { useMeusClientesRealtime } from "@/hooks/use-meus-clientes-realtime";
import {
  type ClientGroupBucket,
  type SelectKey,
  type StatusFilter,
  type AtividadeFilter,
  ClickableStatCard,
  DeleteConfirmDialog,
  EmptyState,
  FILTER_SEM_AREA,
  FilterChips,
  FilterAreaIcon,
  FilterUserAvatar,
  FixedToast,
  GroupSection,
  HealthPanel,
  ManagerSummaryTable,
  MeusClientesSkeleton,
  ProgressBarCard,
  SEM_GRUPO_KEY,
  StatusToggle,
  contactSearchHaystack,
  contactSelectKey,
  formatSyncDate,
  isContactPending,
  isPersonPending,
  parseSelectKey,
  personSelectKey,
} from "./meus-clientes-ui";

function resolveGroupKey(entity: {
  clientGroupId: string | null;
  clientGroupName?: string | null;
}): string {
  return entity.clientGroupId ?? entity.clientGroupName ?? SEM_GRUPO_KEY;
}

function buildGroupBuckets(
  companies: EmailCompany[],
  people: EmailPerson[]
): ClientGroupBucket[] {
  const buckets = new Map<string, ClientGroupBucket>();
  for (const company of companies) {
    const key = resolveGroupKey(company);
    const existing = buckets.get(key);
    if (existing) {
      existing.companies.push(company);
      if (!existing.clientGroupId && company.clientGroupId) existing.clientGroupId = company.clientGroupId;
    } else {
      buckets.set(key, {
        key,
        name: company.clientGroupName ?? "Sem grupo",
        clientGroupId: company.clientGroupId,
        companies: [company],
        groupPeople: [],
      });
    }
  }
  for (const person of people) {
    const key = resolveGroupKey(person);
    const existing = buckets.get(key);
    if (existing) {
      existing.groupPeople.push(person);
      if (!existing.clientGroupId && person.clientGroupId) existing.clientGroupId = person.clientGroupId;
    } else {
      buckets.set(key, {
        key,
        name: person.clientGroupName ?? "Sem grupo",
        clientGroupId: person.clientGroupId,
        companies: [],
        groupPeople: [person],
      });
    }
  }
  return Array.from(buckets.values());
}

function groupMatchesSearch(
  group: ClientGroupBucket,
  query: string,
  contactsByGroup: Map<string, EmailContact[]>
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (group.name.toLowerCase().includes(q)) return true;
  if (group.companies.some((c) => c.name.toLowerCase().includes(q))) return true;
  const groupContacts = contactsByGroup.get(group.key) ?? [];
  if (groupContacts.some((c) => contactSearchHaystack(c).includes(q))) return true;
  return group.groupPeople.some(
    (p) =>
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q) ||
      (p.cargo ?? "").toLowerCase().includes(q)
  );
}

function MeusClientesClientContent() {
  const { user } = useAuth();
  const { active: tourActive, stepId: tourStepId, setTourState } = useMeusClientesTour();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [companies, setCompanies] = useState<EmailCompany[]>([]);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [people, setPeople] = useState<EmailPerson[]>([]);
  const [responsibles, setResponsibles] = useState<EmailGroupResponsible[]>([]);
  const [areaManagers, setAreaManagers] = useState<EmailAreaManagerRow[]>([]);
  const [systemUsers, setSystemUsers] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [syncMeta, setSyncMeta] = useState<MeusClientesSyncMeta | null>(null);
  const [clienteAtividade, setClienteAtividade] = useState<SioeClienteAtividadeIndex>(
    () => emptySioeClienteAtividadeIndex("")
  );
  const [clientGroupStatusById, setClientGroupStatusById] = useState<
    Record<string, ClientGroupGestorStatus>
  >({});
  const [syncing, setSyncing] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [viewAll, setViewAll] = useState(false);
  const [filterArea, setFilterArea] = useState("");
  const [filterGestor, setFilterGestor] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterAtividade, setFilterAtividade] = useState<AtividadeFilter>("all");
  const [compactMode, setCompactMode] = useState(false);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [editingPerson, setEditingPerson] = useState<EmailPerson | null>(null);
  const [editingContact, setEditingContact] = useState<EmailContact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creatingContactGroup, setCreatingContactGroup] = useState<ClientGroupBucket | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [groupStatusDialogOpen, setGroupStatusDialogOpen] = useState(false);
  const [editingGroupStatus, setEditingGroupStatus] = useState<ClientGroupBucket | null>(null);

  const resolveGroupAtividadeForBucket = useCallback(
    (group: ClientGroupBucket) =>
      resolveGroupAtividade(
        { name: group.name, clientGroupId: group.clientGroupId },
        group.clientGroupId ? clientGroupStatusById[group.clientGroupId] : null,
        clienteAtividade
      ),
    [clientGroupStatusById, clienteAtividade]
  );

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
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
      setIsAdmin(Boolean(data.isAdmin));
      setSyncMeta(data.syncMeta ?? null);
      setClienteAtividade(data.clienteAtividade ?? emptySioeClienteAtividadeIndex(""));
      setClientGroupStatusById(data.clientGroupStatusById ?? {});
    } catch (err) {
      setToast({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao carregar Meus Clientes.",
      });
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [viewAll, filterGestor]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const realtimePaused = dialogOpen || createDialogOpen || deleteConfirmOpen || groupStatusDialogOpen;
  useMeusClientesRealtime({
    enabled: Boolean(user) && !loading,
    paused: realtimePaused,
    onRefresh: () => {
      void reloadRef.current({ silent: true });
    },
  });

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    setTourState({ dataLoaded: !loading });
  }, [loading, setTourState]);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [viewAll, filterGestor, filterArea, filterStatus, filterAtividade, search]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSelectedKeys(new Set());
        setSearch("");
        setSyncMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleToggleSelect = useCallback((key: SelectKey, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const handleToggleSelectAllInGroup = useCallback((keys: SelectKey[], checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => setSelectedKeys(new Set()), []);

  const confirmDeleteSelected = async () => {
    const contactIds: string[] = [];
    const personIds: string[] = [];
    for (const key of selectedKeys) {
      const parsed = parseSelectKey(key);
      if (!parsed) continue;
      if (parsed.type === "contact") contactIds.push(parsed.id);
      else personIds.push(parsed.id);
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/meus-clientes/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, personIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir.");

      const removedContacts = new Set(contactIds);
      const removedPeople = new Set(personIds);
      setContacts((prev) => {
        const next = prev.filter((c) => !removedContacts.has(c.id));
        const companyIdsStillUsed = new Set(
          next.map((c) => c.companyId).filter((id): id is string => Boolean(id))
        );
        setCompanies((companies) =>
          companies.filter((c) => {
            if (c.clientGroupId || c.source !== "rd-station") return true;
            return companyIdsStillUsed.has(c.id);
          })
        );
        return next;
      });
      setPeople((prev) => prev.filter((p) => !removedPeople.has(p.id)));
      setSelectedKeys(new Set());
      setDeleteConfirmOpen(false);
      setToast({
        type: "success",
        text: `${(data.deletedContacts ?? 0) + (data.deletedPeople ?? 0)} item(ns) excluído(s).`,
      });
    } catch (err) {
      setToast({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao excluir itens selecionados.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSync = async (mode: "responsibles" | "full") => {
    setSyncMenuOpen(false);
    setSyncing(true);
    try {
      const res = await fetch(`/api/email-marketing/sioe-sync?mode=${mode}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao sincronizar.");
      setToast({
        type: "success",
        text:
          mode === "full"
            ? `Sync SIOE: ${data.contactsUpserted ?? 0} contatos.`
            : `${data.responsiblesUpserted ?? 0} responsáveis atualizados.`,
      });
      await reload({ silent: true });
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
    if (filterArea) params.set("area", filterArea);
    if (filterStatus !== "all") params.set("status", filterStatus);
    params.set("excludeSemGrupo", "1");
    setToast({ type: "success", text: "Exportando CSV com filtros atuais…" });
    window.open(`/api/meus-clientes/export?${params.toString()}`, "_blank");
  };

  const userNameById = useMemo(() => new Map(systemUsers.map((u) => [u.id, u.name])), [systemUsers]);
  const userAvatarById = useMemo(
    () => new Map(systemUsers.map((u) => [u.id, u.avatar_url])),
    [systemUsers]
  );

  const showAll = isAdmin && viewAll;
  const companiesById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  const contactsByGroup = useMemo(() => {
    const map = new Map<string, EmailContact[]>();
    for (const contact of contacts) {
      const key = resolveContactGroupKey(contact, companiesById);
      const list = map.get(key) ?? [];
      list.push(contact);
      map.set(key, list);
    }
    return map;
  }, [contacts, companiesById]);

  const personAreas = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of responsibles) {
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
  }, [responsibles]);

  const allAreasList = useMemo(() => {
    const set = new Set<string>();
    for (const c of companies) {
      for (const a of c.legalAreas) set.add(getAreaParent(a));
    }
    for (const areas of personAreas.values()) {
      for (const a of areas) set.add(getAreaParent(a));
    }
    return Array.from(set)
      .filter((a) => !isSubArea(a))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [companies, personAreas]);

  const managerSummary = useMemo(
    () => buildManagerSummary(companies, contacts, people, responsibles, areaManagers, userNameById),
    [companies, contacts, people, responsibles, areaManagers, userNameById]
  );

  const areaManagerSummary = useMemo(
    () =>
      buildAreaManagerSummary(companies, contacts, people, responsibles, areaManagers, userNameById),
    [companies, contacts, people, responsibles, areaManagers, userNameById]
  );

  const displayAreaGroups = useMemo(() => {
    let groups = areaManagerSummary;
    if (filterArea && filterArea !== FILTER_SEM_AREA) {
      groups = groups.filter((g) => g.area === getAreaParent(filterArea));
    }
    if (filterGestor) groups = groups.filter((g) => g.managers.some((m) => m.userId === filterGestor));
    return groups;
  }, [areaManagerSummary, filterArea, filterGestor]);

  const groupKeysForAreaFilter = useMemo(() => {
    if (!filterArea) return null;
    return buildClientGroupKeysForAreaFilter(
      filterArea,
      companies,
      people,
      personAreas,
      responsibles
    );
  }, [filterArea, companies, people, personAreas, responsibles]);

  const scopedCompanies = useMemo(() => {
    if (!groupKeysForAreaFilter) return companies;
    return companies.filter((c) => groupKeysForAreaFilter.has(resolveGroupKey(c)));
  }, [companies, groupKeysForAreaFilter]);

  const scopedPeople = useMemo(() => {
    if (!groupKeysForAreaFilter) return people;
    return people.filter((p) => groupKeysForAreaFilter.has(resolveGroupKey(p)));
  }, [people, groupKeysForAreaFilter]);

  const groupPassesStatus = useCallback(
    (groupKey: string, groupPeople: EmailPerson[]) => {
      if (filterStatus === "all") return true;
      const groupContacts = contactsByGroup.get(groupKey) ?? [];
      if (groupHasNoContacts(groupPeople, groupContacts)) {
        return filterStatus === "pending";
      }
      const profiles = [
        ...groupPeople.map(personToClientProfile),
        ...groupContacts.map(contactToClientProfile),
      ];
      const hasPending = profiles.some((p) => listClientMissingFieldLabels(p).length > 0);
      return filterStatus === "pending" ? hasPending : !hasPending;
    },
    [filterStatus, contactsByGroup]
  );

  const groupsBeforeStatus = useMemo(
    () =>
      buildGroupBuckets(scopedCompanies, scopedPeople).sort((a, b) =>
        compareGroupsByPendingFirst(a, b, contactsByGroup, (g) => g.key)
      ),
    [scopedCompanies, scopedPeople, contactsByGroup]
  );

  const groups = useMemo(
    () =>
      groupsBeforeStatus.filter(
        (g) => filterStatus === "all" || groupPassesStatus(g.key, g.groupPeople)
      ),
    [groupsBeforeStatus, filterStatus, groupPassesStatus]
  );

  const groupsWithSioeInactive = useMemo(() => {
    if (!isAdmin || filterAtividade !== "inativo") return groups;
    const existingKeys = new Set(groups.map((g) => grupoClienteKey(g.name)));
    const extras = listSioeOnlyInactiveGroups(clienteAtividade, existingKeys).map(
      ({ key, name }) =>
        ({
          key,
          name,
          clientGroupId: null,
          companies: [],
          groupPeople: [],
        }) satisfies ClientGroupBucket
    );
    if (extras.length === 0) return groups;
    return [...groups, ...extras].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR")
    );
  }, [groups, isAdmin, clienteAtividade, filterAtividade]);

  const filteredGroups = useMemo(() => {
    let list = groupsWithSioeInactive;
    if (!search.trim()) return list;
    return list.filter((group) => groupMatchesSearch(group, search, contactsByGroup));
  }, [groupsWithSioeInactive, search, contactsByGroup]);

  const clientGroups = useMemo(
    () => filteredGroups.filter((g) => g.key !== SEM_GRUPO_KEY),
    [filteredGroups]
  );

  const displayGroups = useMemo(() => {
    if (!isAdmin || filterAtividade === "all") return clientGroups;
    return clientGroups.filter((group) => {
      const status = resolveGroupAtividadeForBucket(group);
      return status === filterAtividade;
    });
  }, [clientGroups, filterAtividade, isAdmin, resolveGroupAtividadeForBucket]);

  const tourSampleGroupKey = displayGroups[0]?.key ?? null;

  useEffect(() => {
    if (!tourActive || !tourStepId || !tourSampleGroupKey) return;
    if (!MEUS_CLIENTES_TOUR_EXPAND_STEPS.has(tourStepId)) return;
    setGroupOpen((prev) => ({ ...prev, [tourSampleGroupKey]: true }));
  }, [tourActive, tourStepId, tourSampleGroupKey]);

  useEffect(() => {
    setTourState({ hasSampleGroup: Boolean(tourSampleGroupKey) });
  }, [tourSampleGroupKey, setTourState]);

  const groupsForAtividadeCounts = useMemo(() => {
    let list = groups.filter((g) => g.key !== SEM_GRUPO_KEY);
    if (search.trim()) {
      list = list.filter((g) => groupMatchesSearch(g, search, contactsByGroup));
    }
    return list;
  }, [groups, search, contactsByGroup]);

  const atividadeFilterCounts = useMemo(() => {
    let ativo = 0;
    let inativo = 0;
    for (const group of groupsForAtividadeCounts) {
      const status = resolveGroupAtividadeForBucket(group);
      if (status === "ativo") ativo++;
      else if (status === "inativo") inativo++;
    }
    let sioeOnlyInactive = 0;
    if (isAdmin) {
      const existingKeys = new Set(groupsForAtividadeCounts.map((g) => grupoClienteKey(g.name)));
      sioeOnlyInactive = listSioeOnlyInactiveGroups(clienteAtividade, existingKeys).length;
      inativo += sioeOnlyInactive;
    }
    return {
      all: groupsForAtividadeCounts.length + sioeOnlyInactive,
      ativo,
      inativo,
    };
  }, [groupsForAtividadeCounts, clienteAtividade, isAdmin, resolveGroupAtividadeForBucket]);

  const groupsForStatusCounts = useMemo(() => {
    let list = groupsBeforeStatus.filter((g) => g.key !== SEM_GRUPO_KEY);
    if (isAdmin && filterAtividade !== "all") {
      list = list.filter((group) => {
        const status = resolveGroupAtividadeForBucket(group);
        return status === filterAtividade;
      });
    }
    if (search.trim()) {
      list = list.filter((g) => groupMatchesSearch(g, search, contactsByGroup));
    }
    return list;
  }, [groupsBeforeStatus, filterAtividade, isAdmin, search, contactsByGroup, resolveGroupAtividadeForBucket]);

  const statusFilterCounts = useMemo(() => {
    let pending = 0;
    let complete = 0;
    for (const group of groupsForStatusCounts) {
      const groupContacts = contactsByGroup.get(group.key) ?? [];
      if (groupHasNoContacts(group.groupPeople, groupContacts)) {
        pending++;
        continue;
      }
      const profiles = [
        ...group.groupPeople.map(personToClientProfile),
        ...groupContacts.map(contactToClientProfile),
      ];
      const hasPending = profiles.some((p) => listClientMissingFieldLabels(p).length > 0);
      if (hasPending) pending++;
      else complete++;
    }
    return {
      all: groupsForStatusCounts.length,
      pending,
      complete,
    };
  }, [groupsForStatusCounts, contactsByGroup]);

  const areaFilterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const baseGroups = buildGroupBuckets(companies, people).filter((g) => g.key !== SEM_GRUPO_KEY);
    counts.set("__all__", baseGroups.length);
    counts.set(FILTER_SEM_AREA, 0);
    for (const area of allAreasList) counts.set(area, 0);

    for (const group of baseGroups) {
      const areas = resolveClientGroupAreas(
        group.key,
        companies,
        people,
        personAreas,
        responsibles
      );
      if (areas.length === 0) {
        counts.set(FILTER_SEM_AREA, (counts.get(FILTER_SEM_AREA) ?? 0) + 1);
        continue;
      }
      const roots = new Set(
        areas.map(getAreaParent).filter((area) => area && !isSubArea(area))
      );
      for (const root of roots) {
        counts.set(root, (counts.get(root) ?? 0) + 1);
      }
    }
    return counts;
  }, [companies, people, allAreasList, personAreas, responsibles]);

  const gestorFilterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of managerSummary) {
      const scope = computeMyClientScope(companies, responsibles, row.userId, areaManagers);
      const groupKeys = new Set<string>();
      for (const company of companies) {
        if (scope.companyIds.has(company.id)) groupKeys.add(resolveGroupKey(company));
      }
      for (const person of people) {
        if (scope.personIds.has(person.id)) groupKeys.add(resolveGroupKey(person));
      }
      groupKeys.delete(SEM_GRUPO_KEY);
      counts.set(row.userId, groupKeys.size);
    }
    return counts;
  }, [managerSummary, companies, people, responsibles, areaManagers]);

  const displayContactsByGroup = useMemo(() => {
    const map = new Map<string, EmailContact[]>();
    for (const [key, list] of contactsByGroup) {
      if (filterStatus === "all") {
        map.set(key, list);
        continue;
      }
      map.set(
        key,
        list.filter((c) => {
          const pending = isContactPending(c);
          return filterStatus === "pending" ? pending : !pending;
        })
      );
    }
    return map;
  }, [contactsByGroup, filterStatus]);

  const summaryTotals = useMemo(() => {
    // companies/contacts/people já vêm filtrados pelo escopo do usuário na API.
    const totals = computeEnrichmentTotals(companies, contacts, people);
    return { title: showAll ? "Total geral" : "Meus clientes", totals };
  }, [showAll, companies, contacts, people]);

  const stats = useMemo(() => {
    const scopedGroupKeys = new Set(groups.map((g) => g.key));
    const scopedContacts = contacts.filter((c) =>
      scopedGroupKeys.has(resolveContactGroupKey(c, companiesById))
    );
    const scopedPeopleDeduped = filterPeopleNotInContacts(
      people.filter((p) => scopedGroupKeys.has(resolveGroupKey(p))),
      scopedContacts
    );
    const profiles = [
      ...scopedPeopleDeduped.map(personToClientProfile),
      ...scopedContacts.map(contactToClientProfile),
    ];
    const emptyGroups = groups.filter((g) =>
      groupHasNoContacts(g.groupPeople, contactsByGroup.get(g.key) ?? [])
    ).length;
    const profileIncompleto = profiles.filter((p) => listClientMissingFieldLabels(p).length > 0).length;
    const incompleto = profileIncompleto + emptyGroups;
    const total = profiles.length + emptyGroups;
    return { total, incompleto, completo: total - incompleto };
  }, [people, contacts, groups, companiesById, contactsByGroup]);

  const hasActiveFilters = Boolean(
    filterArea ||
      filterGestor ||
      filterStatus !== "all" ||
      (isAdmin && filterAtividade !== "all") ||
      search.trim()
  );

  const expandAllPending = () => {
    const next: Record<string, boolean> = { ...groupOpen };
    for (const g of displayGroups) {
      const gc = displayContactsByGroup.get(g.key) ?? [];
      if (groupIsPending(g.groupPeople, gc)) next[g.key] = true;
    }
    setGroupOpen(next);
    listRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const clearAllFilters = () => {
    setFilterArea("");
    setFilterGestor("");
    setFilterStatus("all");
    setFilterAtividade("all");
    setSearch("");
  };

  const gestorName = filterGestor ? userNameById.get(filterGestor) : undefined;

  if (loading) {
    return <MeusClientesSkeleton />;
  }

  const emptyVariant =
    groups.length === 0
      ? "no-scope"
      : displayGroups.length === 0 && filterStatus === "complete" && stats.incompleto === 0
        ? "all-complete"
        : "no-search";

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6 pb-24">
      <FixedToast toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-wrap items-start justify-between gap-3" data-tour="mc-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preencha e confirme e-mail, telefone, cargo e sócios dos clientes sob sua responsabilidade.
          </p>
          {syncMeta?.lastSyncedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Dados atualizados em {formatSyncDate(syncMeta.lastSyncedAt)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExport}
            title="Exportar (E)"
            data-tour="mc-export"
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setCompactMode((v) => !v)}
          >
            <LayoutList className="h-4 w-4" />
            {compactMode ? "Normal" : "Compacto"}
          </Button>
          {isAdmin && (
            <>
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={syncing}
                  onClick={() => setSyncMenuOpen((v) => !v)}
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  Sincronizar
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
                {syncMenuOpen && (
                  <div className="absolute right-0 top-full z-40 mt-1 min-w-[220px] rounded-xl border bg-card py-1 shadow-lg">
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                      onClick={() => handleSync("responsibles")}
                    >
                      SIOE — responsáveis
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                      onClick={() => handleSync("full")}
                    >
                      SIOE — sync completo
                    </button>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setViewAll((v) => !v)}>
                <Eye className="h-4 w-4" />
                {viewAll ? "Só meus" : "Ver todos"}
              </Button>
            </>
          )}
        </div>
      </div>

      {isAdmin && syncMeta && (
        <HealthPanel syncMeta={syncMeta} clienteAtividade={clienteAtividade} />
      )}

      {isAdmin && (
        <ManagerSummaryTable
          groups={displayAreaGroups}
          totals={summaryTotals.totals}
          totalsTitle={summaryTotals.title}
          userAvatarById={userAvatarById}
          onAreaClick={(area) => {
            setFilterArea(area);
            listRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          onGestorClick={(userId) => {
            setFilterGestor(userId);
            listRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      )}

      <div data-tour="mc-progress">
        <ProgressBarCard
          complete={stats.completo}
          total={stats.total}
          onShowPending={stats.incompleto > 0 ? () => setFilterStatus("pending") : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-tour="mc-stats">
        <ClickableStatCard
          label={hasActiveFilters ? "Grupos no filtro" : showAll ? "Total de grupos" : "Meus grupos"}
          value={hasActiveFilters ? displayGroups.length : summaryTotals.totals.groupsCount}
        />
        <ClickableStatCard
          label="Cadastros completos"
          value={stats.completo}
          variant="success"
          active={filterStatus === "complete"}
          onClick={() => setFilterStatus((s) => (s === "complete" ? "all" : "complete"))}
        />
        <ClickableStatCard
          label="Cadastros pendentes"
          value={stats.incompleto}
          variant="warning"
          active={filterStatus === "pending"}
          onClick={() => setFilterStatus((s) => (s === "pending" ? "all" : "pending"))}
        />
      </div>

      <div
        className="sticky top-0 z-30 -mx-1 space-y-2 rounded-xl border border-border/80 bg-background/95 px-3 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"
        data-tour="mc-filters"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Buscar… (/ para focar)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <StatusToggle
            value={filterStatus}
            onChange={setFilterStatus}
            counts={statusFilterCounts}
          />

          <Select value={filterArea || "__all__"} onValueChange={(v) => setFilterArea(v === "__all__" ? "" : v)}>
            <SelectTrigger size="sm" className="w-48">
              {filterArea ? (
                <span className="flex min-w-0 items-center gap-2">
                  {filterArea !== FILTER_SEM_AREA && <FilterAreaIcon area={filterArea} size="sm" />}
                  <span className="truncate">
                    {filterArea === FILTER_SEM_AREA ? "Sem área" : filterArea}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    ({areaFilterCounts.get(filterArea) ?? 0})
                  </span>
                </span>
              ) : (
                <SelectValue placeholder="Área" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">
                <span className="flex w-full items-center gap-2">
                  <span className="flex-1">Todas as áreas</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {areaFilterCounts.get("__all__") ?? 0}
                  </span>
                </span>
              </SelectItem>
              <SelectItem value={FILTER_SEM_AREA}>
                <span className="flex w-full items-center gap-2">
                  <span className="flex-1">Sem área</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {areaFilterCounts.get(FILTER_SEM_AREA) ?? 0}
                  </span>
                </span>
              </SelectItem>
              {allAreasList.map((area) => (
                <SelectItem key={area} value={area}>
                  <span className="flex w-full items-center gap-2">
                    <FilterAreaIcon area={area} size="sm" />
                    <span className="truncate flex-1">{area}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {areaFilterCounts.get(area) ?? 0}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && (
            <>
              <Select
                value={filterGestor || "__all__"}
                onValueChange={(v) => setFilterGestor(v === "__all__" ? "" : v)}
              >
                <SelectTrigger size="sm" className="w-52">
                  {filterGestor ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <FilterUserAvatar
                        name={gestorName ?? "Gestor"}
                        avatarUrl={userAvatarById.get(filterGestor)}
                        size="sm"
                      />
                      <span className="truncate">{gestorName ?? filterGestor}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        ({gestorFilterCounts.get(filterGestor) ?? 0})
                      </span>
                    </span>
                  ) : (
                    <SelectValue placeholder="Gestor" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-1">Todos os gestores</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {areaFilterCounts.get("__all__") ?? 0}
                      </span>
                    </span>
                  </SelectItem>
                  {managerSummary.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      <span className="flex w-full items-center gap-2">
                        <FilterUserAvatar
                          name={m.userName}
                          avatarUrl={userAvatarById.get(m.userId)}
                          size="sm"
                        />
                        <span className="truncate flex-1">{m.userName}</span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {gestorFilterCounts.get(m.userId) ?? 0}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterAtividade}
                onValueChange={(v) => setFilterAtividade(v as AtividadeFilter)}
              >
                <SelectTrigger size="sm" className="w-44">
                  {filterAtividade !== "all" ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span>{filterAtividade === "ativo" ? "Ativos" : "Inativos"}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        ({atividadeFilterCounts[filterAtividade] ?? 0})
                      </span>
                    </span>
                  ) : (
                    <SelectValue placeholder="Status comercial" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-1">Todos</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {atividadeFilterCounts.all}
                      </span>
                    </span>
                  </SelectItem>
                  <SelectItem value="ativo">
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-1">Ativos</span>
                      <span className="tabular-nums text-xs text-emerald-700">
                        {atividadeFilterCounts.ativo}
                      </span>
                    </span>
                  </SelectItem>
                  <SelectItem value="inativo">
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-1">Inativos</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {atividadeFilterCounts.inativo}
                      </span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </>
          )}

          {displayGroups.some((g) => {
            const gc = displayContactsByGroup.get(g.key) ?? [];
            return groupIsPending(g.groupPeople, gc);
          }) && (
            <Button variant="ghost" size="sm" onClick={expandAllPending}>
              Expandir pendentes
            </Button>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Limpar
            </Button>
          )}
        </div>

        <FilterChips
          filterArea={filterArea}
          filterGestor={filterGestor}
          filterStatus={filterStatus}
          filterAtividade={isAdmin ? filterAtividade : "all"}
          gestorName={gestorName}
          filterResultCount={hasActiveFilters ? displayGroups.length : undefined}
          onClearArea={() => setFilterArea("")}
          onClearGestor={() => setFilterGestor("")}
          onClearStatus={() => setFilterStatus("all")}
          onClearAtividade={() => setFilterAtividade("all")}
        />
      </div>

      <div ref={listRef}>
        {displayGroups.length === 0 ? (
          <EmptyState
            variant={emptyVariant}
            isAdmin={isAdmin}
            onClearSearch={() => setSearch("")}
            onClearFilters={clearAllFilters}
          />
        ) : (
          <div className={`space-y-3 ${compactMode ? "space-y-2" : ""}`}>
            {displayGroups.map((group, index) => (
              <GroupSection
                key={group.key}
                group={group}
                groupContacts={displayContactsByGroup.get(group.key) ?? []}
                personAreas={personAreas}
                clienteAtividadeIndex={clienteAtividade}
                open={groupOpen[group.key] ?? false}
                onOpenChange={(v) => setGroupOpen((p) => ({ ...p, [group.key]: v }))}
                isAdmin={isAdmin}
                selectedKeys={selectedKeys}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAllInGroup={handleToggleSelectAllInGroup}
                compact={compactMode}
                searchQuery={search}
                tourGroupSample={index === 0}
                tourContactEdit={index === 0 && tourActive}
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
                gestorStatus={
                  group.clientGroupId ? clientGroupStatusById[group.clientGroupId] : null
                }
                onEditGroupStatus={(g) => {
                  setEditingGroupStatus(g);
                  setGroupStatusDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <PersonEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        person={editingPerson}
        contact={editingContact}
        onSaved={() => {
          setToast({ type: "success", text: "Cadastro salvo." });
          reload({ silent: true });
        }}
      />

      <ContactCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        group={creatingContactGroup}
        onCreated={() => {
          setToast({ type: "success", text: "Contato adicionado." });
          reload({ silent: true });
        }}
      />

      <GroupStatusDialog
        open={groupStatusDialogOpen}
        onOpenChange={setGroupStatusDialogOpen}
        group={editingGroupStatus}
        gestorStatus={
          editingGroupStatus?.clientGroupId
            ? clientGroupStatusById[editingGroupStatus.clientGroupId]
            : null
        }
        onSaved={(clientGroupId, status) => {
          setClientGroupStatusById((prev) => ({ ...prev, [clientGroupId]: status }));
          setToast({ type: "success", text: "Status do grupo salvo." });
        }}
      />

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        count={selectedKeys.size}
        loading={deleting}
        onConfirm={confirmDeleteSelected}
        onOpenChange={setDeleteConfirmOpen}
      />

      {isAdmin && selectedKeys.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
          <span className="text-sm font-medium whitespace-nowrap">
            {selectedKeys.size} selecionado{selectedKeys.size === 1 ? "" : "s"}
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            disabled={deleting}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </Button>
          <Button variant="ghost" size="sm" disabled={deleting} onClick={handleClearSelection}>
            Limpar
          </Button>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}

export function MeusClientesClient() {
  return (
    <MeusClientesTourProvider>
      <Suspense fallback={null}>
        <MeusClientesClientContent />
        <MeusClientesTour />
      </Suspense>
    </MeusClientesTourProvider>
  );
}
