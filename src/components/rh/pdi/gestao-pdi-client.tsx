"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  Check,
  CircleCheckBig,
  Hourglass,
  Loader2,
  Network,
  Plus,
  Search,
  Sprout,
  Tags,
  TrendingUp,
  UserRoundX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterMenu } from "@/components/ui/filter-menu";
import { isStale, todayInBrasilia } from "@/lib/rh/pdi/progress";
import type { PdiManagerRow, PdiPerson, PdiPlanSummary, PdiType } from "@/lib/rh/pdi/types";
import { cn } from "@/lib/utils";
import { ChoiceChips, PersonPicker } from "../form-controls";
import { Hint } from "../hint";
import { PlanEditorDialog } from "./plan-editor-dialog";
import { PlanRow, WithoutPlan, sortByAttention } from "./plan-list";
import { AreaTile, BODY, INK, MUTED, PersonLine, ProgressBar, SURFACE, StatTile } from "./pdi-visuals";

type Tab = "planos" | "gestores" | "tipos";
type StatusFilter = "ativos" | "atrasados" | "parados" | "concluidos" | "todos";


function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function SectionHeader({
  icon: Icon,
  tone,
  title,
  subtitle,
  children,
}: {
  icon: typeof Network;
  tone: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6eff1] px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className={cn("text-base font-semibold", INK)}>{title}</h2>
          {subtitle && <p className={cn("text-xs", MUTED)}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </header>
  );
}

/* --------------------------------------------------------- por área */

function AreaGroup({ area, plans }: { area: string; plans: PdiPlanSummary[] }) {
  const active = plans.filter((plan) => plan.status === "ativo");
  const average = active.length ? Math.floor(active.reduce((sum, plan) => sum + plan.progress, 0) / active.length) : 0;
  const late = active.filter((plan) => plan.due_state === "atrasado").length;
  return (
    <section className={SURFACE}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#e6eff1] px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <AreaTile area={area} className="size-9 rounded-lg [&_svg]:size-4" />
          <h2 className={cn("truncate text-base font-semibold", INK)}>{area}</h2>
          <span className="rounded-full bg-[#eaf2f5] px-2 text-xs font-semibold tabular-nums text-[#285f7a]">{plans.length}</span>
        </div>
        {active.length > 0 && (
          <div className="ml-auto flex items-center gap-4 text-xs">
            <span className={cn("flex items-center gap-2", BODY)}>
              média
              <span className="w-24">
                <ProgressBar value={average} size="sm" />
              </span>
              <span className={cn("font-semibold tabular-nums", INK)}>{average}%</span>
            </span>
            {late > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-red-700">
                <AlarmClock className="size-3.5" aria-hidden />
                {late} {late === 1 ? "atrasado" : "atrasados"}
              </span>
            )}
          </div>
        )}
      </header>
      <ul className="divide-y divide-[#e6eff1] px-5 py-1">
        {sortByAttention(plans).map((plan) => (
          <PlanRow key={plan.id} plan={plan} />
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------- gestor direto */

function ManagersTab({ rows: initialRows, people }: { rows: PdiManagerRow[]; people: PdiPerson[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const reports = useMemo(() => {
    const count = new Map<string, number>();
    for (const row of rows) if (row.manager_employee_id) count.set(row.manager_employee_id, (count.get(row.manager_employee_id) ?? 0) + 1);
    return count;
  }, [rows]);
  const missing = rows.filter((row) => !row.manager_employee_id).length;
  const needle = normalize(query);
  const visible = rows.filter((row) => {
    if (onlyMissing && row.manager_employee_id) return false;
    if (!needle) return true;
    return normalize(`${row.employee.full_name} ${row.employee.department ?? ""} ${row.employee.position ?? ""}`).includes(needle);
  });

  async function change(employeeId: string, managerId: string | null) {
    setSavingId(employeeId);
    setError(null);
    try {
      const response = await fetch("/api/rh/pdi/gestores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId, manager_employee_id: managerId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar.");
      setRows((current) => current.map((row) => (row.employee.id === employeeId ? { ...row, manager_employee_id: managerId } : row)));
      setSavedId(employeeId);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className={SURFACE}>
      <SectionHeader
        icon={Network}
        tone="bg-[#e6f0f5] text-[#285f7a]"
        title="Gestor direto de cada pessoa"
        subtitle="Quem acompanha o PDI e vê a equipe em Meu PDI. Coordenadores e sócios também veem a área pela liderança em Usuários."
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pessoa ou área" className="w-56 pl-8" aria-label="Buscar pessoa" />
          </div>
          <Button variant={onlyMissing ? "default" : "outline"} size="sm" onClick={() => setOnlyMissing((value) => !value)} aria-pressed={onlyMissing}>
            Sem gestor
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", onlyMissing ? "bg-white/20" : "bg-amber-100 text-amber-800")}>{missing}</span>
          </Button>
        </div>
      </SectionHeader>
      {error && (
        <p className="border-b border-[#e6eff1] px-5 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <ul className="divide-y divide-[#e6eff1] px-5">
        {visible.map((row) => {
          const count = reports.get(row.employee.id) ?? 0;
          return (
            <li key={row.employee.id} className="grid items-center gap-3 py-3 md:grid-cols-[minmax(0,1fr)_300px_20px]">
              <PersonLine
                person={row.employee}
                size="md"
                extra={count > 0 ? <span className="text-xs font-medium text-[#285f7a]">lidera {count} {count === 1 ? "pessoa" : "pessoas"}</span> : undefined}
              />
              <PersonPicker
                label={`Gestor direto de ${row.employee.name}`}
                emptyLabel="Sem gestor direto"
                value={row.manager_employee_id && byId.has(row.manager_employee_id) ? row.manager_employee_id : null}
                people={people.filter((person) => person.id !== row.employee.id)}
                invalid={!row.manager_employee_id}
                disabled={savingId === row.employee.id}
                onChange={(value) => change(row.employee.id, value)}
              />
              <span className="grid place-items-center" aria-live="polite">
                {savingId === row.employee.id ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Salvando" />
                ) : savedId === row.employee.id ? (
                  <Check className="size-4 text-emerald-700" aria-label="Salvo" />
                ) : null}
              </span>
            </li>
          );
        })}
        {visible.length === 0 && <li className={cn("py-8 text-center text-sm", MUTED)}>Ninguém com esse filtro.</li>}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ tipos */

function TypesTab({ types: initialTypes }: { types: PdiType[] }) {
  const [types, setTypes] = useState(initialTypes);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/rh/pdi/tipos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível criar.");
      setTypes((current) => [...current, body.type as PdiType]);
      setName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(type: PdiType) {
    setError(null);
    const response = await fetch("/api/rh/pdi/tipos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: type.id, is_active: !type.is_active }),
    });
    if (!response.ok) {
      setError("Não foi possível alterar o tipo.");
      return;
    }
    setTypes((current) => current.map((item) => (item.id === type.id ? { ...item, is_active: !item.is_active } : item)));
  }

  return (
    <section className={cn(SURFACE, "max-w-2xl")}>
      <SectionHeader icon={Tags} tone="bg-[#ecebf3] text-[#48466e]" title="Tipos de PDI" subtitle="Tipo desativado some da criação, mas continua nos planos que já o usam." />
      <ul className="divide-y divide-[#e6eff1] px-5">
        {types.map((type) => (
          <li key={type.id} className="flex items-center justify-between gap-3 py-3.5">
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", type.is_active ? INK : "text-muted-foreground line-through")}>{type.name}</p>
              {type.description && <p className={cn("text-xs", MUTED)}>{type.description}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => toggle(type)}>
              {type.is_active ? "Desativar" : "Reativar"}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#e6eff1] px-5 py-4">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Novo tipo (ex.: Sucessão para coordenação)" className="min-w-0 flex-1" aria-label="Nome do novo tipo" />
        <Button onClick={create} disabled={busy || name.trim().length < 2}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          Adicionar
        </Button>
        {error && (
          <p className="w-full text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- página */

export function GestaoPdiClient({
  plans,
  withoutPlan,
  types,
  managers,
}: {
  plans: PdiPlanSummary[];
  withoutPlan: PdiPerson[];
  types: PdiType[];
  managers: PdiManagerRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("planos");
  const [status, setStatus] = useState<StatusFilter>("ativos");
  const [areasOn, setAreasOn] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [creatingFor, setCreatingFor] = useState<PdiPerson | null>(null);
  const today = todayInBrasilia();
  const people = useMemo(() => managers.map((row) => row.employee), [managers]);

  const active = plans.filter((plan) => plan.status === "ativo");
  const averageProgress = active.length ? Math.floor(active.reduce((sum, plan) => sum + plan.progress, 0) / active.length) : 0;
  const counts = {
    ativos: active.length,
    atrasados: active.filter((plan) => plan.due_state === "atrasado").length,
    parados: active.filter((plan) => isStale(plan, today)).length,
    concluidos: plans.filter((plan) => plan.status === "concluido").length,
  };
  const missingManagers = managers.filter((row) => !row.manager_employee_id).length;

  const areas = useMemo(() => [...new Set(plans.map((plan) => plan.employee.department ?? "Sem área"))].sort(), [plans]);
  const needle = normalize(query);
  const filtered = plans.filter((plan) => {
    if (status === "ativos" && plan.status !== "ativo") return false;
    if (status === "atrasados" && !(plan.status === "ativo" && plan.due_state === "atrasado")) return false;
    if (status === "parados" && !isStale(plan, today)) return false;
    if (status === "concluidos" && plan.status !== "concluido") return false;
    if (areasOn.length && !areasOn.includes(plan.employee.department ?? "Sem área")) return false;
    if (needle && !normalize(`${plan.employee.full_name} ${plan.title} ${plan.manager?.full_name ?? ""}`).includes(needle)) return false;
    return true;
  });
  const groups = useMemo(() => {
    const map = new Map<string, PdiPlanSummary[]>();
    for (const plan of filtered) {
      const key = plan.employee.department ?? "Sem área";
      map.set(key, [...(map.get(key) ?? []), plan]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "pt-BR"));
  }, [filtered]);

  const tabs = [
    { id: "planos" as const, label: "Planos", icon: Sprout, count: active.length, alert: false },
    { id: "gestores" as const, label: "Gestores diretos", icon: Network, count: missingManagers, alert: missingManagers > 0 },
    { id: "tipos" as const, label: "Tipos", icon: Tags, count: 0, alert: false },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={cn(SURFACE, "inline-flex flex-wrap p-1")} role="tablist" aria-label="Gestão de PDI">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                tab === item.id ? "bg-[#e8f8f8] text-[#1d5670] shadow-[inset_0_0_0_1px_#47cdd0]" : cn("hover:bg-[#f4fafb]", BODY)
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
              {item.count > 0 && (
                <Hint label={item.alert ? "Pessoas sem gestor direto" : undefined}>
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      tab === item.id ? "bg-[#E1B16D] text-[#0D1E2E]" : item.alert ? "bg-amber-100 text-amber-800" : "bg-[#eaf2f5] text-[#285f7a]"
                    )}
                  >
                    {item.count}
                  </span>
                </Hint>
              )}
            </button>
          ))}
        </div>
        {tab === "planos" && (
          <Button onClick={() => setCreatingFor(withoutPlan[0] ?? people[0] ?? null)}>
            <Plus className="size-4" aria-hidden />
            Novo PDI
          </Button>
        )}
      </div>

      {tab === "planos" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <StatTile icon={Sprout} value={counts.ativos} label="PDIs ativos" tone="bg-[#e6f0f5] text-[#285f7a]" active={status === "ativos"} onClick={() => setStatus("ativos")} />
            <StatTile icon={TrendingUp} value={averageProgress} label="Progresso médio (%)" tone="bg-[#e3f7f7] text-[#1f7f82]" />
            <StatTile icon={AlarmClock} value={counts.atrasados} label="Atrasados" tone="bg-red-50 text-red-700" active={status === "atrasados"} onClick={() => setStatus("atrasados")} />
            <StatTile icon={Hourglass} value={counts.parados} label="Parados há 30+ dias" tone="bg-amber-50 text-amber-700" active={status === "parados"} onClick={() => setStatus("parados")} />
            <StatTile icon={CircleCheckBig} value={counts.concluidos} label="Concluídos" tone="bg-emerald-50 text-emerald-700" active={status === "concluidos"} onClick={() => setStatus("concluidos")} />
            <StatTile icon={UserRoundX} value={withoutPlan.length} label="Pessoas sem PDI" tone="bg-[#f1f5f6] text-[#3b5560]" />
          </div>

          <div className={cn(SURFACE, "flex flex-wrap items-center gap-2 px-4 py-3")}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pessoa, plano ou gestor" className="w-64 pl-8" aria-label="Buscar" />
            </div>
            <ChoiceChips
              label="Situação do plano"
              size="sm"
              value={status}
              onChange={setStatus}
              options={[
                { value: "ativos", label: "Ativos", icon: Sprout, count: counts.ativos },
                { value: "atrasados", label: "Atrasados", icon: AlarmClock, count: counts.atrasados },
                { value: "parados", label: "Parados há 30+ dias", icon: Hourglass, count: counts.parados },
                { value: "concluidos", label: "Concluídos", icon: CircleCheckBig, count: counts.concluidos },
                { value: "todos", label: "Todos", count: plans.length },
              ]}
            />
            <FilterMenu
              label="Área"
              options={areas.map((item) => ({
                value: item,
                label: item,
                count: plans.filter((plan) => (plan.employee.department ?? "Sem área") === item).length,
                leading: <AreaTile area={item} className="size-5 rounded [&_svg]:size-3" />,
              }))}
              selected={areasOn}
              onToggle={(value) => setAreasOn((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))}
              onClear={() => setAreasOn([])}
            />
            <span className={cn("ml-auto text-sm", MUTED)}>
              <span className={cn("font-semibold tabular-nums", INK)}>{filtered.length}</span> {filtered.length === 1 ? "plano" : "planos"}
            </span>
          </div>

          {groups.length === 0 ? (
            <p className={cn(SURFACE, "px-5 py-10 text-center text-sm", MUTED)}>Nenhum PDI com esses filtros.</p>
          ) : (
            <div className="space-y-4">
              {groups.map(([group, items]) => (
                <AreaGroup key={group} area={group} plans={items} />
              ))}
            </div>
          )}

          <WithoutPlan people={withoutPlan} onCreate={setCreatingFor} />
        </>
      )}

      {tab === "gestores" && <ManagersTab rows={managers} people={people} />}
      {tab === "tipos" && <TypesTab types={types} />}

      {creatingFor && (
        <PlanEditorDialog
          people={people}
          managerOptions={people}
          types={types}
          defaultEmployeeId={creatingFor.id}
          onClose={() => setCreatingFor(null)}
          onCreated={(id) => {
            setCreatingFor(null);
            router.push(`/pdi/${id}`);
          }}
        />
      )}
    </div>
  );
}
