"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  Eye,
  LayoutList,
  RefreshCw,
  Search,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  contactToClientProfile,
  listClientMissingFieldLabels,
  personToClientProfile,
} from "@/lib/email-marketing-enrichment";
import {
  buildAreaManagerSummary,
  buildManagerSummary,
  compareGroupsByPendingFirst,
  computeEnrichmentTotals,
  expandRootArea,
  getAreaParent,
  groupHasNoContacts,
  groupIsPending,
  resolveContactGroupKey,
  isSubArea,
  totalsFromAreaGroup,
} from "@/lib/meus-clientes";
import { PersonEditDialog } from "./person-edit-dialog";
import { ContactCreateDialog } from "./contact-create-dialog";
import { useAuth } from "@/contexts/auth-context";
import { useMeusClientesRealtime } from "@/hooks/use-meus-clientes-realtime";
import {
  type ClientGroupBucket,
  type SelectKey,
  type StatusFilter,
  ClickableStatCard,
  DeleteConfirmDialog,
  EmptyState,
  FILTER_SEM_AREA,
  FilterChips,
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

export function MeusClientesClient() {
  const { user } = useAuth();
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
  const [syncing, setSyncing] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [viewAll, setViewAll] = useState(false);
  const [filterArea, setFilterArea] = useState("");
  const [filterGestor, setFilterGestor] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
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

  const realtimePaused = dialogOpen || createDialogOpen || deleteConfirmOpen;
  const { status: realtimeStatus } = useMeusClientesRealtime({
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
    setSelectedKeys(new Set());
  }, [viewAll, filterGestor, filterArea, filterStatus, search]);

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

  const groupKeysWithoutArea = useMemo(() => {
    const keys = new Set<string>();
    for (const c of companies) {
      if (c.legalAreas.length === 0) keys.add(resolveGroupKey(c));
    }
    return keys;
  }, [companies]);

  const scopedCompanies = useMemo(() => {
    let list = companies;
    if (filterArea === FILTER_SEM_AREA) {
      list = list.filter((c) => groupKeysWithoutArea.has(resolveGroupKey(c)));
    } else if (filterArea) {
      const root = getAreaParent(filterArea);
      list = list.filter((c) =>
        c.legalAreas.some((a) => getAreaParent(a) === root || expandRootArea(root).includes(a))
      );
    }
    return list;
  }, [companies, filterArea, groupKeysWithoutArea]);

  const scopedPeople = useMemo(() => {
    let list = people;
    if (filterArea === FILTER_SEM_AREA) {
      list = list.filter((p) => {
        const areas = personAreas.get(p.id) ?? [];
        return areas.length === 0 && groupKeysWithoutArea.has(resolveGroupKey(p));
      });
    } else if (filterArea) {
      const root = getAreaParent(filterArea);
      list = list.filter((p) => {
        const areas = personAreas.get(p.id) ?? [];
        return areas.some((a) => getAreaParent(a) === root || expandRootArea(root).includes(a));
      });
    }
    return list;
  }, [people, filterArea, personAreas, groupKeysWithoutArea]);

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

  const groups = useMemo(() => {
    const buckets = new Map<string, ClientGroupBucket>();
    for (const company of scopedCompanies) {
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
    for (const person of scopedPeople) {
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
    return Array.from(buckets.values())
      .filter((g) => filterStatus === "all" || groupPassesStatus(g.key, g.groupPeople))
      .sort((a, b) => compareGroupsByPendingFirst(a, b, contactsByGroup, (g) => g.key));
  }, [scopedCompanies, scopedPeople, filterStatus, groupPassesStatus, contactsByGroup]);

  const filteredGroups = useMemo(() => {
    let list = groups;
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((group) => {
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
    });
  }, [groups, search, contactsByGroup]);

  const clientGroups = useMemo(
    () => filteredGroups.filter((g) => g.key !== SEM_GRUPO_KEY),
    [filteredGroups]
  );
  const displayGroups = clientGroups;

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
    const contactEmails = new Set<string>();
    const scopedContacts = contacts.filter((c) => {
      if (!scopedGroupKeys.has(resolveContactGroupKey(c, companiesById))) return false;
      contactEmails.add(c.email.toLowerCase());
      return true;
    });
    const scopedPeopleDeduped = people.filter(
      (p) =>
        scopedGroupKeys.has(resolveGroupKey(p)) &&
        (!p.email || !contactEmails.has(p.email.toLowerCase()))
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

  const hasActiveFilters = Boolean(filterArea || filterGestor || filterStatus !== "all");

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
    <div className="space-y-6 pb-24">
      <FixedToast toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-wrap items-start justify-between gap-3">
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
          <div
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              realtimeStatus === "connected"
                ? "bg-emerald-100 text-emerald-700"
                : realtimeStatus === "connecting"
                  ? "bg-muted text-muted-foreground"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            {realtimeStatus === "connected" ? (
              <Wifi className="h-3 w-3" aria-hidden />
            ) : (
              <WifiOff className="h-3 w-3" aria-hidden />
            )}
            {realtimeStatus === "connected"
              ? "Tempo real ativo"
              : realtimeStatus === "connecting"
                ? "Conectando…"
                : "Tempo real indisponível"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} title="Exportar (E)">
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

      {isAdmin && syncMeta && <HealthPanel syncMeta={syncMeta} />}

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

      <ProgressBarCard
        complete={stats.completo}
        total={stats.total}
        onShowPending={stats.incompleto > 0 ? () => setFilterStatus("pending") : undefined}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ClickableStatCard
          label={hasActiveFilters ? "Grupos no filtro" : showAll ? "Total de grupos" : "Meus grupos"}
          value={summaryTotals.totals.groupsCount}
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

      <div className="sticky top-0 z-30 -mx-1 space-y-2 rounded-xl border border-border/80 bg-background/95 px-3 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
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

          <StatusToggle value={filterStatus} onChange={setFilterStatus} />

          <Select value={filterArea || "__all__"} onValueChange={(v) => setFilterArea(v === "__all__" ? "" : v)}>
            <SelectTrigger size="sm" className="w-44">
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
            <Select value={filterGestor || "__all__"} onValueChange={(v) => setFilterGestor(v === "__all__" ? "" : v)}>
              <SelectTrigger size="sm" className="w-48">
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
          gestorName={gestorName}
          onClearArea={() => setFilterArea("")}
          onClearGestor={() => setFilterGestor("")}
          onClearStatus={() => setFilterStatus("all")}
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
            {displayGroups.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                groupContacts={displayContactsByGroup.get(group.key) ?? []}
                personAreas={personAreas}
                open={groupOpen[group.key] ?? false}
                onOpenChange={(v) => setGroupOpen((p) => ({ ...p, [group.key]: v }))}
                isAdmin={isAdmin}
                selectedKeys={selectedKeys}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAllInGroup={handleToggleSelectAllInGroup}
                compact={compactMode}
                searchQuery={search}
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
  );
}
