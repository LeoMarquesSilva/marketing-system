"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  Eye,
  HelpCircle,
  LayoutList,
  MessageSquareHeart,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  resolveClienteCategoriaAtividade,
  resolveClienteFaturamentoIndicios,
  resolveClientePrevistoDate,
  type SioeClienteFaturamentoIndicios,
  type SioeClienteAtividade,
  type SioeClienteAtividadeIndex,
} from "@/lib/sioe-cliente-atividade";
import {
  resolveGroupAtividade,
  type ClientGroupGestorStatus,
} from "@/lib/client-group-gestor-status";
import {
  contactToClientProfile,
  listClientMissingFieldLabels,
  personToClientProfile,
} from "@/lib/email-marketing-enrichment";
import {
  PARTY_INVITE_TYPES,
  getPartyInviteTipoLabel,
  type PartyInviteTipo,
} from "@/lib/party-invite-types";
import {
  AREA_SUBAREAS,
  buildAreaManagerSummary,
  buildClientGroupKeysForAreaFilter,
  compareGroupsByPendingFirst,
  computeEnrichmentTotals,
  computeMyClientScope,
  resolveUserMeusClientesAreas,
  resolveClientGroupAreas,
  resolveNpsCollectionArea,
  filterPeopleNotInContacts,
  getAreaParent,
  groupHasNoContacts,
  groupIsPending,
  mergeGroupMembers,
  resolveContactGroupKey,
  isSubArea,
  userBelongsToClientArea,
  userManagesClientGroupArea,
} from "@/lib/meus-clientes";
import { PersonEditDialog } from "./person-edit-dialog";
import { ContactCreateDialog } from "./contact-create-dialog";
import { GroupStatusDialog } from "./group-status-dialog";
import { NpsLinkDialog } from "./nps-link-dialog";
import { MeusClientesTour, startMeusClientesTour } from "./meus-clientes-tour";
import { useAuth } from "@/contexts/auth-context";
import {
  MeusClientesTourProvider,
  useMeusClientesTour,
} from "@/contexts/meus-clientes-tour-context";
import { MEUS_CLIENTES_TOUR_EXPAND_STEPS } from "@/lib/meus-clientes-tour";
import { useMeusClientesRealtime } from "@/hooks/use-meus-clientes-realtime";
import {
  GESTOR_DEFAULT_INVITE_FILTER,
  groupMatchesInviteFilter,
  memberMatchesInviteFilter,
  resolveGestorInviteFilter,
  type InviteFilter,
} from "@/lib/meus-clientes-invite-filter";
import {
  type ClientGroupBucket,
  type SelectKey,
  type StatusFilter,
  type AtividadeFilter,
  type FaturamentoPrevistoFilter,
  ClickableStatCard,
  DeleteConfirmDialog,
  EmptyState,
  FILTER_SEM_AREA,
  FILTER_SEM_RESPONSAVEL,
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
  formatSyncDate,
  isContactPending,
  parseSelectKey,
} from "./meus-clientes-ui";

function resolveGroupKey(entity: {
  clientGroupId: string | null;
  clientGroupName?: string | null;
}): string {
  return entity.clientGroupId ?? entity.clientGroupName ?? SEM_GRUPO_KEY;
}

function buildGroupBuckets(
  companies: EmailCompany[],
  people: EmailPerson[],
  personAreas: Map<string, string[]> = new Map(),
  responsibles: EmailGroupResponsible[] = [],
  collectorDepartmentByGroupId: Map<string, string | null> = new Map()
): ClientGroupBucket[] {
  const buckets = new Map<string, ClientGroupBucket>();
  for (const company of companies) {
    const key = resolveGroupKey(company);
    const existing = buckets.get(key);
    if (existing) {
      existing.companies.push(company);
      if (!existing.clientGroupId && company.clientGroupId) existing.clientGroupId = company.clientGroupId;
      if (!existing.responsibleArea && company.responsibleArea) {
        existing.responsibleArea = company.responsibleArea;
      }
    } else {
      buckets.set(key, {
        key,
        name: company.clientGroupName ?? "Sem grupo",
        clientGroupId: company.clientGroupId,
        companies: [company],
        groupPeople: [],
        responsibleArea: company.responsibleArea ?? null,
      });
    }
  }
  for (const person of people) {
    const key = resolveGroupKey(person);
    const existing = buckets.get(key);
    if (existing) {
      existing.groupPeople.push(person);
      if (!existing.clientGroupId && person.clientGroupId) existing.clientGroupId = person.clientGroupId;
      if (!existing.responsibleArea && person.responsibleArea) {
        existing.responsibleArea = person.responsibleArea;
      }
    } else {
      buckets.set(key, {
        key,
        name: person.clientGroupName ?? "Sem grupo",
        clientGroupId: person.clientGroupId,
        companies: [],
        groupPeople: [person],
        responsibleArea: person.responsibleArea ?? null,
      });
    }
  }
  for (const bucket of buckets.values()) {
    bucket.responsibleArea = resolveNpsCollectionArea({
      responsibleArea: bucket.responsibleArea,
      involvedAreas: resolveClientGroupAreas(
        bucket.key,
        companies,
        people,
        personAreas,
        responsibles
      ),
      collectorDepartment: bucket.clientGroupId
        ? collectorDepartmentByGroupId.get(bucket.clientGroupId) ?? null
        : collectorDepartmentByGroupId.get(bucket.key) ?? null,
    });
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

function groupMatchesInviteFilters(
  group: ClientGroupBucket,
  contactsByGroup: Map<string, EmailContact[]>,
  inviteFilter: InviteFilter,
  partyTipoFilter: PartyInviteTipo | "all"
): boolean {
  const { contacts, people } = mergeGroupMembers(
    contactsByGroup.get(group.key) ?? [],
    group.groupPeople
  );
  return groupMatchesInviteFilter([...contacts, ...people], inviteFilter, partyTipoFilter);
}

function MeusClientesClientContent({ onRestartTour }: { onRestartTour: () => void }) {
  const { user, profile } = useAuth();
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
  const [systemUsers, setSystemUsers] = useState<
    { id: string; name: string; avatar_url: string | null; department: string | null }[]
  >([]);
  const [syncMeta, setSyncMeta] = useState<MeusClientesSyncMeta | null>(null);
  const [clienteAtividade, setClienteAtividade] = useState<SioeClienteAtividadeIndex>(
    () => emptySioeClienteAtividadeIndex("")
  );
  const [clientGroupStatusById, setClientGroupStatusById] = useState<
    Record<string, ClientGroupGestorStatus>
  >({});
  const [areaContactByGroupId, setAreaContactByGroupId] = useState<Record<string, string | null>>(
    {}
  );
  const [npsSentByGroupId, setNpsSentByGroupId] = useState<
    Record<string, { sentAt: string; sentByName: string }>
  >({});
  const [syncing, setSyncing] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [viewAll, setViewAll] = useState(true);
  const [filterArea, setFilterArea] = useState("");
  const [filterGestor, setFilterGestor] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterAtividade, setFilterAtividade] = useState<AtividadeFilter>("all");
  const [filterFaturamentoPrevisto, setFilterFaturamentoPrevisto] =
    useState<FaturamentoPrevistoFilter>("all");
  const [filterInvite, setFilterInvite] = useState<InviteFilter>("all");
  const [filterPartyTipo, setFilterPartyTipo] = useState<PartyInviteTipo | "all">("all");
  const [filterResponsibleArea, setFilterResponsibleArea] = useState("");
  const [savingResponsibleGroupId, setSavingResponsibleGroupId] = useState<string | null>(null);
  const [savingAreaContactGroupId, setSavingAreaContactGroupId] = useState<string | null>(null);
  const [atividadeMenuOpen, setAtividadeMenuOpen] = useState(false);
  const [faturamentoMenuOpen, setFaturamentoMenuOpen] = useState(false);
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
  const [npsLinkDialogOpen, setNpsLinkDialogOpen] = useState(false);
  const [npsLinkGroup, setNpsLinkGroup] = useState<ClientGroupBucket | null>(null);
  const [npsLinkEligibleCount, setNpsLinkEligibleCount] = useState(0);
  const [editingGroupAtividadeIndicio, setEditingGroupAtividadeIndicio] =
    useState<SioeClienteAtividade | null>(null);
  const [editingGroupCategoriaIndicio, setEditingGroupCategoriaIndicio] =
    useState<SioeClienteAtividade | null>(null);
  const [editingGroupFaturamentoIndicios, setEditingGroupFaturamentoIndicios] =
    useState<SioeClienteFaturamentoIndicios | null>(null);
  const [editingGroupPrevistoDate, setEditingGroupPrevistoDate] = useState<string | null>(null);

  const resolveClienteStatusForFilter = useCallback(
    (group: ClientGroupBucket) => {
      const gestorStatus = group.clientGroupId ? clientGroupStatusById[group.clientGroupId] : null;
      if (gestorStatus?.gestorAtividade) return gestorStatus.gestorAtividade;
      return resolveClienteCategoriaAtividade(clienteAtividade, { grupoName: group.name });
    },
    [clientGroupStatusById, clienteAtividade]
  );

  const resolveSioeAtividadeForBucket = useCallback(
    (group: ClientGroupBucket) =>
      resolveGroupAtividade(
        { name: group.name, clientGroupId: group.clientGroupId },
        null,
        clienteAtividade
      ),
    [clienteAtividade]
  );

  const resolveSioePrevistoDateForBucket = useCallback(
    (group: ClientGroupBucket) =>
      resolveClientePrevistoDate(clienteAtividade, { grupoName: group.name }),
    [clienteAtividade]
  );

  const resolveSioeFaturamentoIndiciosForBucket = useCallback(
    (group: ClientGroupBucket) =>
      resolveClienteFaturamentoIndicios(clienteAtividade, { grupoName: group.name }),
    [clienteAtividade]
  );

  const groupHasFaturamentoPrevisto = useCallback(
    (group: ClientGroupBucket) => Boolean(resolveSioePrevistoDateForBucket(group)),
    [resolveSioePrevistoDateForBucket]
  );

  const resolveSioeCategoriaForBucket = useCallback(
    (group: ClientGroupBucket) =>
      resolveClienteCategoriaAtividade(clienteAtividade, { grupoName: group.name }),
    [clienteAtividade]
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
      setAreaContactByGroupId(data.areaContactByGroupId ?? {});
      setNpsSentByGroupId(data.npsSentByGroupId ?? {});
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

  const realtimePaused =
    dialogOpen || createDialogOpen || deleteConfirmOpen || groupStatusDialogOpen || npsLinkDialogOpen;
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
  }, [
    viewAll,
    filterGestor,
    filterArea,
    filterStatus,
    filterAtividade,
    filterFaturamentoPrevisto,
    filterInvite,
    filterPartyTipo,
    filterResponsibleArea,
    search,
  ]);

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
        setAtividadeMenuOpen(false);
        setFaturamentoMenuOpen(false);
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

  const handleResponsibleAreaChange = useCallback(
    async (group: ClientGroupBucket, area: string | null) => {
      if (!group.clientGroupId) return;
      setSavingResponsibleGroupId(group.clientGroupId);
      try {
        const res = await fetch(`/api/meus-clientes/groups/${group.clientGroupId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responsibleArea: area }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao salvar área responsável.");
        const nextArea = (data.responsibleArea as string | null) ?? null;
        setCompanies((prev) =>
          prev.map((company) =>
            company.clientGroupId === group.clientGroupId
              ? { ...company, responsibleArea: nextArea }
              : company
          )
        );
        setPeople((prev) =>
          prev.map((person) =>
            person.clientGroupId === group.clientGroupId
              ? { ...person, responsibleArea: nextArea }
              : person
          )
        );
        setToast({
          type: "success",
          text: nextArea
            ? `Área responsável: ${nextArea}. Só os gestores dessa área veem este cliente.`
            : "Área responsável removida. O cliente volta a aparecer para todas as áreas dele.",
        });
      } catch (err) {
        setToast({
          type: "error",
          text: err instanceof Error ? err.message : "Erro ao salvar área responsável.",
        });
      } finally {
        setSavingResponsibleGroupId(null);
      }
    },
    []
  );

  const handleAreaContactChange = useCallback(
    async (group: ClientGroupBucket, userId: string | null) => {
      if (!group.clientGroupId) return;
      setSavingAreaContactGroupId(group.clientGroupId);
      try {
        const res = await fetch(`/api/meus-clientes/groups/${group.clientGroupId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ areaContactUserId: userId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao salvar contato da área.");
        const nextUserId = (data.areaContactUserId as string | null) ?? null;
        setAreaContactByGroupId((prev) => ({ ...prev, [group.clientGroupId!]: nextUserId }));
        const assigneeName = nextUserId
          ? systemUsers.find((u) => u.id === nextUserId)?.name ?? "Colaborador"
          : null;
        setToast({
          type: "success",
          text: assigneeName
            ? `Contato da área: ${assigneeName}.`
            : "Contato da área removido.",
        });
      } catch (err) {
        setToast({
          type: "error",
          text: err instanceof Error ? err.message : "Erro ao salvar contato da área.",
        });
      } finally {
        setSavingAreaContactGroupId(null);
      }
    },
    [systemUsers]
  );

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
    const inviteForExport = isAdmin ? filterInvite : GESTOR_DEFAULT_INVITE_FILTER;
    if (inviteForExport !== "all") params.set("invite", inviteForExport);
    if (isAdmin && filterPartyTipo !== "all") params.set("partyTipo", filterPartyTipo);
    if (search.trim()) params.set("search", search.trim());
    params.set("excludeSemGrupo", "1");
    setToast({ type: "success", text: "Exportando CSV com filtros atuais…" });
    window.open(`/api/meus-clientes/export?${params.toString()}`, "_blank");
  };

  const userNameById = useMemo(() => new Map(systemUsers.map((u) => [u.id, u.name])), [systemUsers]);
  const userAvatarById = useMemo(
    () => new Map(systemUsers.map((u) => [u.id, u.avatar_url])),
    [systemUsers]
  );
  const managerFilterOptions = useMemo(() => {
    const userIds = Array.from(new Set(areaManagers.map((m) => m.userId)));
    return userIds
      .map((userId) => ({
        userId,
        userName: userNameById.get(userId) ?? "Usuário removido",
      }))
      .sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
  }, [areaManagers, userNameById]);

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
      for (const a of c.legalAreas) {
        set.add(a);
        set.add(getAreaParent(a));
      }
    }
    for (const areas of personAreas.values()) {
      for (const a of areas) {
        set.add(a);
        set.add(getAreaParent(a));
      }
    }
    for (const manager of areaManagers) {
      set.add(manager.area);
      set.add(getAreaParent(manager.area));
    }
    for (const [parent, subs] of Object.entries(AREA_SUBAREAS)) {
      set.add(parent);
      for (const sub of subs) set.add(sub);
    }
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [companies, personAreas, areaManagers]);

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

  const departmentByUserId = useMemo(
    () => new Map(systemUsers.map((user) => [user.id, user.department])),
    [systemUsers]
  );

  const collectorDepartmentByGroupId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const [groupId, userId] of Object.entries(areaContactByGroupId)) {
      if (!userId) continue;
      map.set(groupId, departmentByUserId.get(userId) ?? null);
    }
    return map;
  }, [areaContactByGroupId, departmentByUserId]);

  const groupKeysForAreaFilter = useMemo(() => {
    if (!filterArea) return null;
    return buildClientGroupKeysForAreaFilter(
      filterArea,
      companies,
      people,
      personAreas,
      responsibles,
      collectorDepartmentByGroupId
    );
  }, [filterArea, companies, people, personAreas, responsibles, collectorDepartmentByGroupId]);

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
      buildGroupBuckets(
        scopedCompanies,
        scopedPeople,
        personAreas,
        responsibles,
        collectorDepartmentByGroupId
      ).sort((a, b) =>
        compareGroupsByPendingFirst(a, b, contactsByGroup, (g) => g.key)
      ),
    [scopedCompanies, scopedPeople, contactsByGroup, personAreas, responsibles, collectorDepartmentByGroupId]
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
          responsibleArea: null,
        }) satisfies ClientGroupBucket
    );
    if (extras.length === 0) return groups;
    return [...groups, ...extras].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR")
    );
  }, [groups, isAdmin, clienteAtividade, filterAtividade]);

  const filteredGroups = useMemo(() => {
    const list = groupsWithSioeInactive;
    if (!search.trim()) return list;
    return list.filter((group) => groupMatchesSearch(group, search, contactsByGroup));
  }, [groupsWithSioeInactive, search, contactsByGroup]);

  const clientGroups = useMemo(
    () => filteredGroups.filter((g) => g.key !== SEM_GRUPO_KEY),
    [filteredGroups]
  );

  const displayGroupsBeforeInvite = useMemo(() => {
    let list = clientGroups;
    if (isAdmin && filterAtividade !== "all") {
      list = list.filter((group) => {
        const status = resolveClienteStatusForFilter(group);
        return status === filterAtividade;
      });
    }
    if (isAdmin && filterFaturamentoPrevisto !== "all") {
      list = list.filter((group) => {
        const hasPrevisto = groupHasFaturamentoPrevisto(group);
        return filterFaturamentoPrevisto === "com" ? hasPrevisto : !hasPrevisto;
      });
    }
    if (isAdmin && filterResponsibleArea) {
      list = list.filter((group) => {
        const area = group.responsibleArea ?? null;
        if (filterResponsibleArea === FILTER_SEM_RESPONSAVEL) return !area;
        return area === filterResponsibleArea;
      });
    }
    return list;
  }, [
    clientGroups,
    filterAtividade,
    filterFaturamentoPrevisto,
    filterResponsibleArea,
    groupHasFaturamentoPrevisto,
    isAdmin,
    resolveClienteStatusForFilter,
  ]);

  /** Gestores: NPS sim ou pendente — exclui só quem marcou NPS não explicitamente. */
  const effectiveInviteFilter = resolveGestorInviteFilter(isAdmin, filterInvite);
  const effectivePartyTipoFilter: PartyInviteTipo | "all" = isAdmin ? filterPartyTipo : "all";

  const displayGroups = useMemo(
    () =>
      displayGroupsBeforeInvite.filter((group) =>
        groupMatchesInviteFilters(
          group,
          contactsByGroup,
          effectiveInviteFilter,
          effectivePartyTipoFilter
        )
      ),
    [displayGroupsBeforeInvite, contactsByGroup, effectiveInviteFilter, effectivePartyTipoFilter]
  );

  const tourSampleGroupKey = displayGroups[0]?.key ?? null;
  const tourSampleGroup = displayGroups[0] ?? null;

  const isAreaManager = useMemo(() => {
    if (!profile?.id) return false;
    return areaManagers.some((manager) => manager.userId === profile.id);
  }, [areaManagers, profile?.id]);

  const canShowAreaContactStep = useMemo(() => {
    if (!profile?.id || !tourSampleGroup?.responsibleArea) return false;
    return userManagesClientGroupArea(
      profile.id,
      tourSampleGroup.responsibleArea,
      areaManagers
    );
  }, [profile?.id, tourSampleGroup, areaManagers]);

  useEffect(() => {
    if (!tourActive || !tourStepId || !tourSampleGroupKey) return;
    if (!MEUS_CLIENTES_TOUR_EXPAND_STEPS.has(tourStepId)) return;
    setGroupOpen((prev) => ({ ...prev, [tourSampleGroupKey]: true }));
  }, [tourActive, tourStepId, tourSampleGroupKey]);

  useEffect(() => {
    setTourState({
      hasSampleGroup: Boolean(tourSampleGroupKey),
      isAreaManager,
      canShowAreaContactStep,
    });
  }, [tourSampleGroupKey, isAreaManager, canShowAreaContactStep, setTourState]);

  const groupsForAtividadeCounts = useMemo(() => {
    let list = groups.filter((g) => g.key !== SEM_GRUPO_KEY);
    if (isAdmin && filterFaturamentoPrevisto !== "all") {
      list = list.filter((group) => {
        const hasPrevisto = groupHasFaturamentoPrevisto(group);
        return filterFaturamentoPrevisto === "com" ? hasPrevisto : !hasPrevisto;
      });
    }
    if (search.trim()) {
      list = list.filter((g) => groupMatchesSearch(g, search, contactsByGroup));
    }
    return list;
  }, [
    groups,
    filterFaturamentoPrevisto,
    groupHasFaturamentoPrevisto,
    isAdmin,
    search,
    contactsByGroup,
  ]);

  const atividadeFilterCounts = useMemo(() => {
    let ativo = 0;
    let inativo = 0;
    for (const group of groupsForAtividadeCounts) {
      const status = resolveClienteStatusForFilter(group);
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
  }, [groupsForAtividadeCounts, clienteAtividade, isAdmin, resolveClienteStatusForFilter]);

  const atividadeFilterOptions = useMemo(
    () =>
      [
        { value: "all" as const, label: "Todos", count: atividadeFilterCounts.all },
        { value: "ativo" as const, label: "Status ativo", count: atividadeFilterCounts.ativo },
        { value: "inativo" as const, label: "Status inativo", count: atividadeFilterCounts.inativo },
      ] satisfies Array<{ value: AtividadeFilter; label: string; count: number }>,
    [atividadeFilterCounts]
  );

  const selectedAtividadeOption =
    atividadeFilterOptions.find((option) => option.value === filterAtividade) ??
    atividadeFilterOptions[0];

  const groupsForFaturamentoCounts = useMemo(() => {
    let list = clientGroups;
    if (isAdmin && filterAtividade !== "all") {
      list = list.filter((group) => {
        const status = resolveClienteStatusForFilter(group);
        return status === filterAtividade;
      });
    }
    return list;
  }, [clientGroups, filterAtividade, isAdmin, resolveClienteStatusForFilter]);

  const faturamentoFilterCounts = useMemo(() => {
    let com = 0;
    let sem = 0;
    for (const group of groupsForFaturamentoCounts) {
      if (groupHasFaturamentoPrevisto(group)) com++;
      else sem++;
    }
    return {
      all: groupsForFaturamentoCounts.length,
      com,
      sem,
    };
  }, [groupsForFaturamentoCounts, groupHasFaturamentoPrevisto]);

  const faturamentoFilterOptions = useMemo(
    () =>
      [
        { value: "all" as const, label: "Todos", count: faturamentoFilterCounts.all },
        {
          value: "com" as const,
          label: "Com indício",
          count: faturamentoFilterCounts.com,
        },
        {
          value: "sem" as const,
          label: "Sem indício",
          count: faturamentoFilterCounts.sem,
        },
      ] satisfies Array<{ value: FaturamentoPrevistoFilter; label: string; count: number }>,
    [faturamentoFilterCounts]
  );

  const selectedFaturamentoOption =
    faturamentoFilterOptions.find((option) => option.value === filterFaturamentoPrevisto) ??
    faturamentoFilterOptions[0];

  const inviteFilterCounts = useMemo(() => {
    const counts = {
      all: 0,
      party: 0,
      nps: 0,
      both: 0,
      none: 0,
      notParty: 0,
      notNps: 0,
      partyGroups: 0,
      npsGroups: 0,
      gestorDefaultGroups: 0,
    };
    const partyTipoCounts = new Map<PartyInviteTipo, number>(
      PARTY_INVITE_TYPES.map((tipo) => [tipo.id, 0])
    );

    for (const group of displayGroupsBeforeInvite) {
      const { contacts: groupContacts, people: groupPeople } = mergeGroupMembers(
        contactsByGroup.get(group.key) ?? [],
        group.groupPeople
      );
      const members = [...groupContacts, ...groupPeople];
      if (members.length === 0) continue;

      let groupHasParty = false;
      let groupHasNps = false;
      let groupMatchesGestorDefault = members.length === 0;
      for (const member of members) {
        if (member.partyInvite && member.partyInviteTipo) {
          partyTipoCounts.set(
            member.partyInviteTipo,
            (partyTipoCounts.get(member.partyInviteTipo) ?? 0) + 1
          );
        }
        if (filterPartyTipo !== "all" && member.partyInviteTipo !== filterPartyTipo) continue;
        counts.all++;
        if (member.partyInvite) {
          counts.party++;
          groupHasParty = true;
        }
        if (member.npsEligible) {
          counts.nps++;
          groupHasNps = true;
        }
        if (member.partyInvite && member.npsEligible) counts.both++;
        if (!member.partyInvite && !member.npsEligible) counts.none++;
        if (!member.partyInvite) counts.notParty++;
        if (!member.npsEligible) counts.notNps++;
        if (memberMatchesInviteFilter(member, "gestor_default", "all")) {
          groupMatchesGestorDefault = true;
        }
      }
      if (groupHasParty) counts.partyGroups++;
      if (groupHasNps) counts.npsGroups++;
      if (groupMatchesGestorDefault) counts.gestorDefaultGroups++;
    }

    return { ...counts, partyTipoCounts };
  }, [displayGroupsBeforeInvite, contactsByGroup, filterPartyTipo]);

  const inviteFilterOptions = useMemo(
    () =>
      [
        { value: "all" as const, label: "NPS/Festa", count: inviteFilterCounts.all },
        { value: "party" as const, label: "Festa: sim", count: inviteFilterCounts.party },
        { value: "not_party" as const, label: "Festa: não", count: inviteFilterCounts.notParty },
        { value: "nps" as const, label: "NPS: sim", count: inviteFilterCounts.nps },
        { value: "not_nps" as const, label: "NPS: não", count: inviteFilterCounts.notNps },
        { value: "both" as const, label: "NPS + Festa", count: inviteFilterCounts.both },
        { value: "none" as const, label: "Sem NPS/Festa", count: inviteFilterCounts.none },
      ] satisfies Array<{ value: InviteFilter; label: string; count: number }>,
    [inviteFilterCounts]
  );

  const selectedInviteOption =
    inviteFilterOptions.find((option) => option.value === filterInvite) ?? inviteFilterOptions[0];

  const groupsForStatusCounts = useMemo(() => {
    let list = groupsBeforeStatus.filter((g) => g.key !== SEM_GRUPO_KEY);
    if (isAdmin && filterAtividade !== "all") {
      list = list.filter((group) => {
        const status = resolveClienteStatusForFilter(group);
        return status === filterAtividade;
      });
    }
    if (isAdmin && filterFaturamentoPrevisto !== "all") {
      list = list.filter((group) => {
        const hasPrevisto = groupHasFaturamentoPrevisto(group);
        return filterFaturamentoPrevisto === "com" ? hasPrevisto : !hasPrevisto;
      });
    }
    if (search.trim()) {
      list = list.filter((g) => groupMatchesSearch(g, search, contactsByGroup));
    }
    return list;
  }, [
    groupsBeforeStatus,
    filterAtividade,
    filterFaturamentoPrevisto,
    groupHasFaturamentoPrevisto,
    isAdmin,
    search,
    contactsByGroup,
    resolveClienteStatusForFilter,
  ]);

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
    const baseGroups = buildGroupBuckets(
      companies,
      people,
      personAreas,
      responsibles,
      collectorDepartmentByGroupId
    ).filter((g) => g.key !== SEM_GRUPO_KEY);
    counts.set("__all__", baseGroups.length);
    counts.set(FILTER_SEM_AREA, 0);
    for (const area of allAreasList) counts.set(area, 0);

    for (const group of baseGroups) {
      const area = group.responsibleArea;
      if (!area) {
        counts.set(FILTER_SEM_AREA, (counts.get(FILTER_SEM_AREA) ?? 0) + 1);
        continue;
      }
      const root = getAreaParent(area);
      if (root && !isSubArea(root)) {
        counts.set(root, (counts.get(root) ?? 0) + 1);
      }
    }
    return counts;
  }, [companies, people, allAreasList, personAreas, responsibles, collectorDepartmentByGroupId]);

  const areaContactCandidatesByArea = useMemo(() => {
    const map = new Map<string, typeof systemUsers>();
    const areas = new Set(allAreasList);
    for (const group of displayGroups) {
      if (group.responsibleArea) areas.add(group.responsibleArea);
    }
    for (const area of areas) {
      map.set(
        area,
        systemUsers
          .filter((candidate) => userBelongsToClientArea(candidate.department, area))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      );
    }
    return map;
  }, [allAreasList, displayGroups, systemUsers]);

  const gestorFilterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of managerFilterOptions) {
      const scope = computeMyClientScope(
        companies,
        responsibles,
        resolveUserMeusClientesAreas(departmentByUserId.get(row.userId)),
        people
      );
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
  }, [managerFilterOptions, companies, people, responsibles, departmentByUserId]);

  const responsibleAreaFilterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const baseGroups = buildGroupBuckets(
      companies,
      people,
      personAreas,
      responsibles,
      collectorDepartmentByGroupId
    ).filter(
      (g) => g.key !== SEM_GRUPO_KEY
    );
    counts.set("__all__", baseGroups.length);
    counts.set(FILTER_SEM_RESPONSAVEL, 0);
    for (const area of allAreasList) counts.set(area, 0);
    for (const group of baseGroups) {
      const area = group.responsibleArea ?? null;
      if (!area) {
        counts.set(FILTER_SEM_RESPONSAVEL, (counts.get(FILTER_SEM_RESPONSAVEL) ?? 0) + 1);
        continue;
      }
      counts.set(area, (counts.get(area) ?? 0) + 1);
    }
    return counts;
  }, [companies, people, allAreasList, personAreas, responsibles, collectorDepartmentByGroupId]);

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
      (isAdmin && filterFaturamentoPrevisto !== "all") ||
      filterInvite !== "all" ||
      filterPartyTipo !== "all" ||
      (isAdmin && Boolean(filterResponsibleArea)) ||
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
    setFilterFaturamentoPrevisto("all");
    setFilterInvite("all");
    setFilterPartyTipo("all");
    setFilterResponsibleArea("");
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
          <h2 className="text-2xl font-bold tracking-tight">Meus Clientes</h2>
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
          <Button variant="outline" size="sm" className="gap-2" type="button" onClick={onRestartTour}>
            <HelpCircle className="h-4 w-4" />
            Ver guia
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/meus-clientes/nps" title="Resultados NPS">
              <MessageSquareHeart className="h-4 w-4" />
              Resultados NPS
            </Link>
          </Button>
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

      <ProgressBarCard
        complete={stats.completo}
        total={stats.completo + stats.incompleto}
        onShowPending={() => setFilterStatus("pending")}
        tourAnchor
      />

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-tour="mc-stats">
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
        {isAdmin && (
          <ClickableStatCard
            label="Pessoas para festa"
            value={inviteFilterCounts.party}
            active={filterInvite === "party"}
            onClick={() => setFilterInvite((s) => (s === "party" ? "all" : "party"))}
          />
        )}
        <ClickableStatCard
          label="Pessoas NPS"
          value={inviteFilterCounts.nps}
          active={!isAdmin || filterInvite === "nps"}
          onClick={
            isAdmin
              ? () => setFilterInvite((s) => (s === "nps" ? "all" : "nps"))
              : undefined
          }
        />
        {isAdmin && (
          <ClickableStatCard
            label="Grupos com festa"
            value={inviteFilterCounts.partyGroups}
            active={filterInvite === "party"}
            onClick={() => setFilterInvite((s) => (s === "party" ? "all" : "party"))}
          />
        )}
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

          {isAdmin ? (
            <Select
              value={filterInvite}
              onValueChange={(v) => setFilterInvite(v as InviteFilter)}
            >
              <SelectTrigger size="sm" className="w-44">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">
                    {filterInvite === "all" ? "NPS/Festa" : selectedInviteOption.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    ({selectedInviteOption.count})
                  </span>
                </span>
              </SelectTrigger>
              <SelectContent>
                {inviteFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-1">{option.label}</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {option.count}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge
              variant="outline"
              className="h-8 border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-800"
              title="Gestores veem clientes da sua área, excluindo quem já foi marcado como NPS não"
            >
              NPS sim ou pendente ({inviteFilterCounts.gestorDefaultGroups})
            </Badge>
          )}

          {isAdmin && (
          <Select
            value={filterPartyTipo}
            onValueChange={(v) => setFilterPartyTipo(v as PartyInviteTipo | "all")}
          >
            <SelectTrigger size="sm" className="w-52">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">
                  {filterPartyTipo === "all"
                    ? "Critério festa"
                    : getPartyInviteTipoLabel(filterPartyTipo)}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  (
                  {filterPartyTipo === "all"
                    ? inviteFilterCounts.party
                    : inviteFilterCounts.partyTipoCounts.get(filterPartyTipo) ?? 0}
                  )
                </span>
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="flex w-full items-center gap-2">
                  <span className="flex-1">Todos os critérios</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {inviteFilterCounts.party}
                  </span>
                </span>
              </SelectItem>
              {PARTY_INVITE_TYPES.map((tipo) => (
                <SelectItem key={tipo.id} value={tipo.id}>
                  <span className="flex w-full items-center gap-2">
                    <span className="truncate flex-1">{tipo.label}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {inviteFilterCounts.partyTipoCounts.get(tipo.id) ?? 0}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}

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
                value={filterResponsibleArea || "__all__"}
                onValueChange={(v) => setFilterResponsibleArea(v === "__all__" ? "" : v)}
              >
                <SelectTrigger size="sm" className="w-52">
                  {filterResponsibleArea ? (
                    <span className="flex min-w-0 items-center gap-2">
                      {filterResponsibleArea !== FILTER_SEM_RESPONSAVEL && (
                        <FilterAreaIcon area={filterResponsibleArea} size="sm" />
                      )}
                      <span className="truncate">
                        {filterResponsibleArea === FILTER_SEM_RESPONSAVEL
                          ? "Sem responsável"
                          : filterResponsibleArea}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        ({responsibleAreaFilterCounts.get(filterResponsibleArea) ?? 0})
                      </span>
                    </span>
                  ) : (
                    <SelectValue placeholder="Área responsável" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-1">Todas (responsável)</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {responsibleAreaFilterCounts.get("__all__") ?? 0}
                      </span>
                    </span>
                  </SelectItem>
                  <SelectItem value={FILTER_SEM_RESPONSAVEL}>
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-1">Sem responsável</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {responsibleAreaFilterCounts.get(FILTER_SEM_RESPONSAVEL) ?? 0}
                      </span>
                    </span>
                  </SelectItem>
                  {allAreasList.map((area) => (
                    <SelectItem key={`resp-${area}`} value={area}>
                      <span className="flex w-full items-center gap-2">
                        <FilterAreaIcon area={area} size="sm" />
                        <span className="truncate flex-1">{area}</span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {responsibleAreaFilterCounts.get(area) ?? 0}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {managerFilterOptions.map((m) => (
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
              <div
                className="relative"
                onBlur={(e) => {
                  const nextFocus = e.relatedTarget;
                  if (!(nextFocus instanceof Node) || !e.currentTarget.contains(nextFocus)) {
                    setAtividadeMenuOpen(false);
                  }
                }}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-44 justify-between gap-2 font-normal"
                  aria-expanded={atividadeMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setAtividadeMenuOpen((open) => !open)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">
                      {filterAtividade === "all"
                        ? "Status do cliente"
                        : selectedAtividadeOption.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      ({selectedAtividadeOption.count})
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${
                      atividadeMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
                {atividadeMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                  >
                    {atividadeFilterOptions.map((option) => {
                      const selected = option.value === filterAtividade;
                      const countClass =
                        option.value === "ativo"
                          ? "text-emerald-700"
                          : option.value === "inativo"
                            ? "text-red-700"
                            : "text-muted-foreground";
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          className={`flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground ${
                            selected ? "bg-accent/70 text-accent-foreground" : ""
                          }`}
                          onClick={() => {
                            setFilterAtividade(option.value);
                            setAtividadeMenuOpen(false);
                          }}
                        >
                          <span>{option.label}</span>
                          <span className={`tabular-nums text-xs ${countClass}`}>
                            {option.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div
                className="relative"
                onBlur={(e) => {
                  const nextFocus = e.relatedTarget;
                  if (!(nextFocus instanceof Node) || !e.currentTarget.contains(nextFocus)) {
                    setFaturamentoMenuOpen(false);
                  }
                }}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-56 justify-between gap-2 font-normal"
                  aria-expanded={faturamentoMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setFaturamentoMenuOpen((open) => !open)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">
                      {filterFaturamentoPrevisto === "all"
                        ? "Indício faturamento"
                        : selectedFaturamentoOption.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      ({selectedFaturamentoOption.count})
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${
                      faturamentoMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
                {faturamentoMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                  >
                    {faturamentoFilterOptions.map((option) => {
                      const selected = option.value === filterFaturamentoPrevisto;
                      const countClass =
                        option.value === "com"
                          ? "text-emerald-700"
                          : option.value === "sem"
                            ? "text-red-700"
                            : "text-muted-foreground";
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          className={`flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground ${
                            selected ? "bg-accent/70 text-accent-foreground" : ""
                          }`}
                          onClick={() => {
                            setFilterFaturamentoPrevisto(option.value);
                            setFaturamentoMenuOpen(false);
                          }}
                        >
                          <span>{option.label}</span>
                          <span className={`tabular-nums text-xs ${countClass}`}>
                            {option.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
          filterFaturamentoPrevisto={isAdmin ? filterFaturamentoPrevisto : "all"}
          filterInvite={isAdmin ? filterInvite : "nps"}
          filterPartyTipo={isAdmin ? filterPartyTipo : "all"}
          filterResponsibleArea={isAdmin ? filterResponsibleArea : ""}
          gestorName={gestorName}
          filterResultCount={hasActiveFilters ? displayGroups.length : undefined}
          onClearArea={() => setFilterArea("")}
          onClearGestor={() => setFilterGestor("")}
          onClearStatus={() => setFilterStatus("all")}
          onClearAtividade={() => setFilterAtividade("all")}
          onClearFaturamentoPrevisto={() => setFilterFaturamentoPrevisto("all")}
          onClearInvite={() => setFilterInvite("all")}
          onClearPartyTipo={() => setFilterPartyTipo("all")}
          onClearResponsibleArea={() => setFilterResponsibleArea("")}
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
                inviteFilter={effectiveInviteFilter}
                partyTipoFilter={effectivePartyTipoFilter}
                tourGroupSample={index === 0}
                tourContactEdit={
                  index === 0 &&
                  tourActive &&
                  (tourStepId === "contact-edit" || tourStepId === "contact-nps")
                }
                tourAreaContact={index === 0 && tourActive && tourStepId === "area-contact"}
                tourNpsButton={
                  index === 0 &&
                  tourActive &&
                  (tourStepId === "nps-send" || tourStepId === "nps-mark-sent")
                }
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
                npsSent={
                  group.clientGroupId ? npsSentByGroupId[group.clientGroupId] ?? null : null
                }
                onEditGroupStatus={(g) => {
                  setEditingGroupStatus(g);
                  setEditingGroupAtividadeIndicio(resolveSioeAtividadeForBucket(g));
                  setEditingGroupCategoriaIndicio(resolveSioeCategoriaForBucket(g));
                  setEditingGroupFaturamentoIndicios(resolveSioeFaturamentoIndiciosForBucket(g));
                  setEditingGroupPrevistoDate(resolveSioePrevistoDateForBucket(g));
                  setGroupStatusDialogOpen(true);
                }}
                onGenerateNpsLink={(g) => {
                  const groupContacts = displayContactsByGroup.get(g.key) ?? [];
                  const { contacts: mergedC, people: mergedP } = mergeGroupMembers(
                    groupContacts,
                    g.groupPeople
                  );
                  const count =
                    mergedC.filter((c) => c.npsEligible).length +
                    mergedP.filter((p) => p.npsEligible).length;
                  setNpsLinkEligibleCount(count);
                  setNpsLinkGroup(g);
                  setNpsLinkDialogOpen(true);
                }}
                fallbackAreaOptions={allAreasList}
                onResponsibleAreaChange={handleResponsibleAreaChange}
                savingResponsible={
                  Boolean(group.clientGroupId) && savingResponsibleGroupId === group.clientGroupId
                }
                areaContactUserId={
                  group.clientGroupId ? areaContactByGroupId[group.clientGroupId] ?? null : null
                }
                canAssignAreaContact={Boolean(
                  profile?.id &&
                    group.responsibleArea &&
                    userManagesClientGroupArea(profile.id, group.responsibleArea, areaManagers)
                )}
                areaContactCandidates={
                  group.responsibleArea
                    ? areaContactCandidatesByArea.get(group.responsibleArea) ?? []
                    : []
                }
                onAreaContactChange={handleAreaContactChange}
                savingAreaContact={
                  Boolean(group.clientGroupId) &&
                  savingAreaContactGroupId === group.clientGroupId
                }
                userNameById={userNameById}
                userAvatarById={userAvatarById}
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
        onOpenChange={(open) => {
          setGroupStatusDialogOpen(open);
          if (!open) {
            setEditingGroupAtividadeIndicio(null);
            setEditingGroupCategoriaIndicio(null);
            setEditingGroupFaturamentoIndicios(null);
            setEditingGroupPrevistoDate(null);
          }
        }}
        group={editingGroupStatus}
        gestorStatus={
          editingGroupStatus?.clientGroupId
            ? clientGroupStatusById[editingGroupStatus.clientGroupId]
            : null
        }
        sioeAtividadeIndicio={editingGroupAtividadeIndicio}
        categoriaAtividadeIndicio={editingGroupCategoriaIndicio}
        ultimoFaturamentoDate={editingGroupFaturamentoIndicios?.ultimoFaturamentoDate ?? null}
        proximoPrevistoDate={editingGroupFaturamentoIndicios?.proximoPrevistoDate ?? null}
        previstoDate={editingGroupPrevistoDate}
        onSaved={(clientGroupId, status) => {
          setClientGroupStatusById((prev) => ({ ...prev, [clientGroupId]: status }));
          setToast({ type: "success", text: "Status do grupo salvo." });
        }}
      />

      <NpsLinkDialog
        open={npsLinkDialogOpen}
        onOpenChange={(open) => {
          setNpsLinkDialogOpen(open);
          if (!open) setNpsLinkGroup(null);
        }}
        group={npsLinkGroup}
        eligibleCount={npsLinkEligibleCount}
        onMarkedSent={(info) => {
          if (!npsLinkGroup?.clientGroupId) return;
          setNpsSentByGroupId((prev) => ({
            ...prev,
            [npsLinkGroup.clientGroupId!]: info,
          }));
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
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
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
  const [tourKey, setTourKey] = useState(0);

  const restartTour = useCallback(() => {
    startMeusClientesTour();
    setTourKey((key) => key + 1);
  }, []);

  return (
    <MeusClientesTourProvider>
      <Suspense fallback={null}>
        <MeusClientesClientContent onRestartTour={restartTour} />
        <MeusClientesTour restartKey={tourKey} />
      </Suspense>
    </MeusClientesTourProvider>
  );
}
