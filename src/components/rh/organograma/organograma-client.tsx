"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Network, PencilRuler, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FichaColaboradorDialog } from "@/components/rh/ficha-colaborador-dialog";
import {
  ORG_DIVISIONS,
  buildOrgChart,
  findTeamView,
  firstTeamOf,
  memberContext,
  searchOrgMembers,
  suggestDisplayName,
  type OrgChartData,
  type OrgChartView,
  type OrgMember,
  type OrgPendingEmployee,
} from "@/lib/rh/org-chart";
import { cn } from "@/lib/utils";
import { CommitteesSection, StructureOverview, TeamDetail } from "@/components/rh/organograma/org-team-view";
import { OrgFullChart } from "@/components/rh/organograma/org-full-chart";
import { OrgPendingPanel } from "@/components/rh/organograma/org-pending-panel";
import {
  OrgPlacementDialog,
  type PlacementPayload,
  type PlacementRequest,
} from "@/components/rh/organograma/org-placement-dialog";
import { OrgAvatar } from "@/components/rh/organograma/org-visuals";

type ViewMode = "equipe" | "completo";

const DEFAULT_TEAM = ORG_DIVISIONS[0].teams[0].key;
const DEFAULT_DIVISION = ORG_DIVISIONS[0].key;

function pluralPessoas(count: number) {
  return `${count} ${count === 1 ? "pessoa" : "pessoas"}`;
}

async function orgRequest(path: string, init: RequestInit): Promise<{ data?: OrgChartData; error?: string }> {
  try {
    const response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { error: body.error ?? "Não foi possível salvar." };
    return { data: body as OrgChartData };
  } catch {
    return { error: "Falha de conexão. Tente de novo." };
  }
}

function PeopleSearch({
  view,
  onPick,
}: {
  view: OrgChartView;
  onPick: (member: OrgMember) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => searchOrgMembers(view, query).slice(0, 8), [view, query]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [open]);

  function pick(member: OrgMember) {
    onPick(member);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-72">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) pick(results[0]);
          if (e.key === "Escape") {
            setQuery("");
            setOpen(false);
          }
        }}
        placeholder="Buscar pessoa ou cargo"
        aria-label="Buscar pessoa ou cargo no organograma"
        className="pl-9 pr-9"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      )}
      {open && query.trim() && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Ninguém encontrado.</p>
          ) : (
            <ul role="listbox" aria-label="Resultados">
              {results.map((member) => (
                <li key={member.employeeId}>
                  <button
                    type="button"
                    onClick={() => pick(member)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#47cdd0]/10"
                  >
                    <OrgAvatar name={member.name} photoUrl={member.photoUrl} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{member.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.role} · {memberContext(view, member.employeeId)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function OrganogramaClient({
  initialData,
  initialMode,
  initialTeam,
  initialDivision,
  initialEditing,
}: {
  initialData: OrgChartData;
  initialMode?: string;
  initialTeam?: string;
  initialDivision?: string;
  initialEditing?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [mode, setMode] = useState<ViewMode>(initialMode === "completo" ? "completo" : "equipe");
  const [selectedTeam, setSelectedTeam] = useState(initialTeam ?? DEFAULT_TEAM);
  const [divisionKey, setDivisionKey] = useState(
    ORG_DIVISIONS.some((d) => d.key === initialDivision) ? (initialDivision as string) : DEFAULT_DIVISION
  );
  const [editing, setEditing] = useState(Boolean(initialEditing));
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [fichaEmployeeId, setFichaEmployeeId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<PlacementRequest | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const view = useMemo(() => buildOrgChart(data.members), [data.members]);
  const selected = findTeamView(view, selectedTeam) ?? findTeamView(view, DEFAULT_TEAM)!;
  const totalTeams = ORG_DIVISIONS.reduce((sum, d) => sum + d.teams.length, 0);
  const adjustments = data.pending.length + view.departed.length;

  const activeEmployees = useMemo(() => {
    const map = new Map<string, { employeeId: string; fullName: string; photoUrl: string | null; role: string; displayName: string }>();
    for (const m of data.members) {
      if (!m.isActive || map.has(m.employeeId)) continue;
      map.set(m.employeeId, { employeeId: m.employeeId, fullName: m.employeeName, photoUrl: m.photoUrl, role: m.role, displayName: m.name });
    }
    for (const p of data.pending) {
      map.set(p.employeeId, {
        employeeId: p.employeeId,
        fullName: p.fullName,
        photoUrl: p.photoUrl,
        role: p.position ?? "",
        displayName: suggestDisplayName(p.fullName),
      });
    }
    return [...map.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  }, [data]);

  function syncUrl(next: { visao?: ViewMode; equipe?: string; area?: string; ajustar?: boolean }) {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const visao = next.visao ?? mode;
    params.set("visao", visao);
    params.set("equipe", next.equipe ?? selectedTeam);
    params.set("area", next.area ?? divisionKey);
    if (next.ajustar ?? editing) params.set("ajustar", "1");
    else params.delete("ajustar");
    window.history.replaceState(null, "", url);
  }

  function selectTeam(key: string) {
    setSelectedTeam(key);
    setHighlightId(null);
    syncUrl({ equipe: key });
  }

  function openTeam(key: string) {
    setSelectedTeam(key);
    setMode("equipe");
    syncUrl({ equipe: key, visao: "equipe" });
    requestAnimationFrame(() =>
      document.getElementById("org-team-title")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  function changeMode(next: ViewMode) {
    setMode(next);
    if (next === "completo") setDivisionKey(selected.division.key);
    syncUrl({ visao: next, area: next === "completo" ? selected.division.key : divisionKey });
  }

  function changeDivision(key: string) {
    setDivisionKey(key);
    syncUrl({ area: key });
  }

  function toggleEditing() {
    setEditing((current) => {
      syncUrl({ ajustar: !current });
      return !current;
    });
  }

  function selectMember(member: OrgMember) {
    if (editing) setPlacement({ mode: "edit", member });
    else setFichaEmployeeId(member.employeeId);
  }

  function pickFromSearch(member: OrgMember) {
    const team = firstTeamOf(view, member.employeeId);
    if (mode === "equipe" && team && !selected.team.members.some((m) => m.employeeId === member.employeeId)) {
      setSelectedTeam(team);
      syncUrl({ equipe: team });
    }
    if (mode === "completo") {
      const division = view.divisions.find((d) =>
        [...d.leaders.flat(), ...d.teams.flatMap((t) => t.members)].some((m) => m.employeeId === member.employeeId)
      );
      if (division && division.key !== divisionKey) changeDivision(division.key);
    }
    setHighlightId(member.employeeId);
  }

  useEffect(() => {
    if (!highlightId) return;
    const frame = requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector(`[data-employee="${highlightId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
    const timer = setTimeout(() => setHighlightId(null), 4500);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [highlightId, selectedTeam, mode, divisionKey]);

  useEffect(() => {
    if (initialEditing && adjustments > 0) {
      pendingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Só na chegada pela notificação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePlacement(payload: PlacementPayload, memberId?: string): Promise<string | null> {
    const result = memberId
      ? await orgRequest(`/api/rh/organograma/${memberId}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await orgRequest("/api/rh/organograma", { method: "POST", body: JSON.stringify(payload) });
    if (result.error || !result.data) return result.error ?? "Não foi possível salvar.";
    setData(result.data);
    setPlacement(null);
    if (payload.employeeId && payload.placement !== "hidden") setHighlightId(payload.employeeId);
    if (payload.placement === "team" && payload.teamKey && mode === "equipe") {
      setSelectedTeam(payload.teamKey);
      syncUrl({ equipe: payload.teamKey });
    }
    return null;
  }

  async function deletePlacement(memberId: string): Promise<string | null> {
    const result = await orgRequest(`/api/rh/organograma/${memberId}`, { method: "DELETE" });
    if (result.error || !result.data) return result.error ?? "Não foi possível remover.";
    setData(result.data);
    setPlacement(null);
    return null;
  }

  async function hideEmployee(employee: OrgPendingEmployee) {
    const result = await orgRequest("/api/rh/organograma", {
      method: "POST",
      body: JSON.stringify({
        employeeId: employee.employeeId,
        displayName: employee.fullName,
        role: employee.position ?? "",
        placement: "hidden",
      }),
    });
    if (result.data) setData(result.data);
  }

  async function removeDeparted(employeeId: string) {
    const result = await orgRequest(`/api/rh/organograma/colaborador/${employeeId}`, { method: "DELETE" });
    if (result.data) setData(result.data);
  }

  const handlers = { highlightId, editing, onSelectMember: selectMember };

  return (
    <div ref={rootRef} className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Organograma</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {pluralPessoas(view.totalPeople)} em {ORG_DIVISIONS.length} áreas executivas e {totalTeams} equipes.
            Clique em alguém para abrir a ficha do RH.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <PeopleSearch view={view} onPick={pickFromSearch} />
          <Button
            type="button"
            variant={editing ? "default" : "outline"}
            className="relative gap-2"
            onClick={toggleEditing}
            aria-pressed={editing}
          >
            <PencilRuler className="size-4" />
            {editing ? "Concluir ajustes" : "Ajustar organograma"}
            {!editing && adjustments > 0 && (
              <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                {adjustments}
              </span>
            )}
          </Button>
        </div>
      </div>

      <OrgPendingPanel
        ref={pendingRef}
        pending={data.pending}
        departed={view.departed}
        onPlace={(employee) =>
          setPlacement({
            mode: "create",
            employeeId: employee.employeeId,
            fullName: employee.fullName,
            photoUrl: employee.photoUrl,
            displayName: suggestDisplayName(employee.fullName),
            role: employee.position ?? "",
          })
        }
        onHide={hideEmployee}
        onRemoveDeparted={removeDeparted}
      />

      {editing && (
        <p className="rounded-md bg-[#e8f8f8] px-4 py-2.5 text-sm text-[#285f7a]">
          Modo de ajuste: clique em uma pessoa para mudar equipe, nível, nome ou cargo. Clique em “Concluir ajustes”
          para voltar a abrir as fichas.
        </p>
      )}

      <div role="tablist" aria-label="Forma de visualizar" className="inline-flex rounded-md border border-[#dce9eb] bg-card p-1">
        {(
          [
            { key: "equipe", label: "Por equipe", icon: LayoutGrid },
            { key: "completo", label: "Organograma completo", icon: Network },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => changeMode(key)}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orquestrai-cyan",
              mode === key
                ? "bg-[var(--orquestrai-surface-to)] text-white"
                : "text-muted-foreground hover:bg-[#47cdd0]/8 hover:text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {mode === "equipe" ? (
        <>
          <StructureOverview
            view={view}
            selectedTeam={selected.team.key}
            onSelectTeam={selectTeam}
            {...handlers}
          />
          <TeamDetail
            division={selected.division}
            team={selected.team}
            onOpenFullChart={() => changeMode("completo")}
            onAddPerson={() =>
              setPlacement({
                mode: "create",
                employeeId: "",
                fullName: "",
                photoUrl: null,
                displayName: "",
                role: "",
                targetValue: `team:${selected.division.key}:${selected.team.key}`,
              })
            }
            {...handlers}
          />
          <CommitteesSection view={view} contextOf={(id) => memberContext(view, id)} {...handlers} />
        </>
      ) : (
        <OrgFullChart
          view={view}
          divisionKey={divisionKey}
          onChangeDivision={changeDivision}
          onOpenTeam={openTeam}
          {...handlers}
        />
      )}

      <OrgPlacementDialog
        request={placement}
        members={data.members}
        employees={activeEmployees}
        onClose={() => setPlacement(null)}
        onSubmit={savePlacement}
        onDelete={deletePlacement}
        onOpenFicha={(employeeId) => {
          setPlacement(null);
          setFichaEmployeeId(employeeId);
        }}
      />

      <FichaColaboradorDialog
        employeeId={fichaEmployeeId}
        onOpenChange={(open) => !open && setFichaEmployeeId(null)}
        onSaved={() => {
          setFichaEmployeeId(null);
          router.refresh();
        }}
      />
    </div>
  );
}
