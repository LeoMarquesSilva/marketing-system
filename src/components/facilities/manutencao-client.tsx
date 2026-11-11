"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CalendarCheck2,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  HardHat,
  Plus,
  Search,
  Siren,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, addMonths, formatShortDate, todayIso } from "@/lib/facilities/alerts";
import {
  MAINTENANCE_TYPE_LABEL,
  occurrencesBetween,
  PERIODICITY_INFO,
  planSituation,
  type MaintenanceSituation,
  type MaintenanceType,
} from "@/lib/facilities/maintenance";
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABEL,
  FACILITIES_ASSETS_PATH,
  type FacilityAsset,
  type MaintenanceData,
  type MaintenancePlan,
  type MaintenanceSupplierOption,
  type PlanInput,
} from "@/lib/facilities/types";
import { cn } from "@/lib/utils";
import { formatBrl, PersonAvatar, SupplierMonogram } from "./facilities-visuals";
import { Segmented } from "./form-parts";
import { AssetTile, periodicityText, SITUATION_STYLE, SituationBadge } from "./maintenance-visuals";
import { PlanDialog } from "./plan-dialog";

const ALL = "__all__";
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Ordem da lista: o que pede ação primeiro. */
const SITUATION_ORDER: Record<MaintenanceSituation, number> = {
  atrasada: 0,
  proxima: 1,
  em_dia: 2,
  sem_data: 3,
  pausada: 4,
  concluida: 5,
};

type SituationFilter = "abertas" | MaintenanceSituation;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function KpiCell({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  tone: "neutral" | "ok" | "warning" | "danger";
  active: boolean;
  onClick: () => void;
}) {
  const color = { neutral: "text-[#10293a]", ok: "text-[#1f6f72]", warning: "text-amber-700", danger: "text-red-700" }[tone];
  const iconColor = { neutral: "text-[#3e84a8]", ok: "text-[#1f6f72]", warning: "text-amber-600", danger: "text-red-600" }[tone];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col items-start bg-white px-5 py-4 text-left transition-colors duration-150",
        "hover:bg-[#f6fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]/60",
        active && "bg-[#f2f8f9] shadow-[inset_0_-2px_0_#347796]"
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className={cn("size-3.5", iconColor)} aria-hidden />
        {label}
      </span>
      <span className={cn("mt-1 text-[32px] font-semibold leading-9 tabular-nums", color)}>{value}</span>
      <span className="mt-0.5 text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

function PlanRow({
  plan,
  asset,
  supplier,
  owner,
  today,
  onOpen,
}: {
  plan: MaintenancePlan;
  asset?: FacilityAsset;
  supplier?: MaintenanceSupplierOption;
  owner?: MaintenanceData["people"][number];
  today: string;
  onOpen: () => void;
}) {
  const { situation, days } = planSituation(plan, today);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors duration-150",
          "hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none",
          "lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1.3fr)_1.75rem]"
        )}
      >
        <span className={cn("flex min-w-0 items-center gap-3", (situation === "pausada" || situation === "concluida") && "opacity-60")}>
          {asset ? (
            <AssetTile category={asset.category} />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200">
              <Wrench className="size-5" aria-hidden />
            </span>
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{plan.title}</span>
              {plan.maintenance_type === "corretiva" && (
                <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-px text-xs text-red-800 ring-1 ring-inset ring-red-200">Corretiva</span>
              )}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {asset ? [asset.name, asset.location].filter(Boolean).join(" · ") : "Serviço geral"}
            </span>
          </span>
        </span>

        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-sm text-foreground">{periodicityText(plan)}</span>
          <span className="block truncate text-xs text-muted-foreground">{PERIODICITY_INFO[plan.periodicity].hint}</span>
        </span>

        <span className="col-start-2 row-start-1 flex flex-col items-end gap-1 lg:col-start-3 lg:items-start">
          <span className="text-sm font-semibold tabular-nums text-foreground">{plan.next_due_on ? formatShortDate(plan.next_due_on) : "—"}</span>
          <SituationBadge situation={situation} days={days} />
        </span>

        <span className="col-span-2 flex min-w-0 items-center gap-2 pl-[3.25rem] lg:col-span-1 lg:pl-0">
          {supplier ? (
            <>
              <SupplierMonogram name={supplier.name} category={supplier.category} size="sm" className="size-6" />
              <span className="truncate text-xs text-foreground lg:text-sm">{supplier.name}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Sem prestador</span>
          )}
          {owner && <PersonAvatar person={owner} size="xs" className="ml-auto lg:hidden" />}
        </span>

        <span className="hidden justify-end lg:flex">
          {owner ? (
            <PersonAvatar person={owner} size="xs" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-[#285f7a]" aria-hidden />
          )}
        </span>
      </button>
    </li>
  );
}

/** Próximos seis meses: quantas manutenções e quanto deve custar (pelo custo estimado de cada vez). */
function MonthAgenda({ plans, today }: { plans: MaintenancePlan[]; today: string }) {
  const { months, yearCost, missingCost } = useMemo(() => {
    const start = `${today.slice(0, 7)}-01`;
    const rows = Array.from({ length: 6 }, (_, i) => ({ key: addMonths(start, i).slice(0, 7), count: 0, cost: 0 }));
    const yearEnd = addDays(addMonths(today, 12), -1);
    let total = 0;
    let missing = 0;
    for (const plan of plans) {
      const dates = occurrencesBetween(plan, today, yearEnd);
      if (dates.length && plan.estimated_cost == null) missing++;
      total += dates.length * (plan.estimated_cost ?? 0);
      for (const date of dates) {
        const row = rows.find((r) => r.key === date.slice(0, 7));
        if (!row) continue;
        row.count++;
        row.cost += plan.estimated_cost ?? 0;
      }
    }
    return { months: rows, yearCost: total, missingCost: missing };
  }, [plans, today]);
  const max = Math.max(1, ...months.map((m) => m.count));

  return (
    <Card className="gap-0 py-0">
      <div className="border-b border-[#e6eef0] px-5 py-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarRange className="size-3.5 text-[#3e84a8]" aria-hidden />
          Custo previsto nos próximos 12 meses
        </p>
        <p className="mt-1 text-[28px] font-semibold leading-8 text-[#10293a]">{formatBrl(yearCost, { compact: true })}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          pelo custo estimado de cada vez
          {missingCost > 0 && ` · ${missingCost} ${missingCost === 1 ? "plano sem custo estimado" : "planos sem custo estimado"}`}
        </p>
      </div>
      <ul className="space-y-2.5 px-5 py-4" aria-label="Manutenções previstas por mês">
        {months.map((m) => {
          const [y, mm] = m.key.split("-");
          return (
            <li key={m.key} className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                {MONTH_SHORT[Number(mm) - 1]}/{y.slice(2)}
              </span>
              <span className="h-2 rounded-[3px] bg-[#eef3f5]" aria-hidden>
                {m.count > 0 && <span className="block h-full rounded-r-[4px] bg-[#3e84a8]" style={{ width: `${(m.count / max) * 100}%` }} />}
              </span>
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{m.count}</span> {m.count === 1 ? "manutenção" : "manutenções"}
                {m.cost > 0 && <span className="block">{formatBrl(m.cost, { compact: true })}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function EmptyGuide({ assetsCount, onNewPlan }: { assetsCount: number; onNewPlan: () => void }) {
  const steps: Array<{ icon: LucideIcon; title: string; text: string; action: ReactNode }> = [
    {
      icon: Box,
      title: "Ativos e instalações",
      text: "O que precisa receber manutenção: ar-condicionado, elevador, gerador, extintores, caixa d'água.",
      action: (
        <Button asChild variant={assetsCount ? "outline" : "default"} size="sm" className="gap-1.5">
          <Link href={FACILITIES_ASSETS_PATH}>
            {assetsCount ? `${assetsCount} cadastrados` : "Cadastrar ativos"}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      ),
    },
    {
      icon: ClipboardList,
      title: "Plano de manutenção",
      text: "O que será feito, por qual prestador, com qual periodicidade e quando é a próxima.",
      action: (
        <Button type="button" size="sm" variant={assetsCount ? "default" : "outline"} className="gap-1.5" onClick={onNewPlan}>
          <Plus className="size-3.5" />
          Novo plano
        </Button>
      ),
    },
    {
      icon: CalendarCheck2,
      title: "Execuções",
      text: "A cada manutenção feita, registre a data, o custo e o laudo, NF ou OS. A próxima data se recalcula.",
      action: null,
    },
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="border-b border-[#e6eef0] px-6 py-5">
        <p className="text-lg font-semibold text-[#10293a]">Comece pelos três cadastros</p>
        <p className="mt-1 text-sm text-muted-foreground">Prestador (já no cadastro de fornecedores), o que recebe manutenção e o plano que liga os dois.</p>
      </div>
      <ol className="grid gap-px bg-[#e6eef0] md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-3 bg-white px-6 py-5">
            <span className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-[#e8f8f8] text-xs font-semibold text-[#1f6f72]">{index + 1}</span>
              <step.icon className="size-4 text-[#3e84a8]" aria-hidden />
              <span className="text-sm font-semibold text-foreground">{step.title}</span>
            </span>
            <p className="text-sm leading-6 text-muted-foreground">{step.text}</p>
            {step.action && <div className="mt-auto">{step.action}</div>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

type DialogState = { plan: MaintenancePlan | null; preset?: Partial<PlanInput>; key: number };

export function ManutencaoClient({ data, initialPlanId, newForAssetId }: { data: MaintenanceData; initialPlanId?: string; newForAssetId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState(data.plans);
  const [assets, setAssets] = useState(data.assets);
  const [suppliers, setSuppliers] = useState(data.suppliers);
  const [query, setQuery] = useState("");
  const [situation, setSituation] = useState<SituationFilter>("abertas");
  const [type, setType] = useState<"todas" | MaintenanceType>("todas");
  const [category, setCategory] = useState(ALL);
  const seq = useRef(0);
  const [dialog, setDialog] = useState<DialogState | null>(() => {
    if (newForAssetId) return { plan: null, preset: { asset_id: newForAssetId }, key: 0 };
    const plan = initialPlanId ? data.plans.find((p) => p.id === initialPlanId) : undefined;
    return plan ? { plan, key: 0 } : null;
  });
  const today = todayIso();

  const assetIndex = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const supplierIndex = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const peopleIndex = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data.people]);

  const withSituation = useMemo(() => plans.map((plan) => ({ plan, ...planSituation(plan, today) })), [plans, today]);

  const counts = useMemo(() => {
    const active = withSituation.filter((p) => p.plan.status === "ativo");
    return {
      cadastradas: active.length,
      preventivas: active.filter((p) => p.plan.maintenance_type === "preventiva").length,
      corretivas: active.filter((p) => p.plan.maintenance_type === "corretiva").length,
      em_dia: active.filter((p) => p.situation === "em_dia").length,
      proxima: active.filter((p) => p.situation === "proxima").length,
      atrasada: active.filter((p) => p.situation === "atrasada").length,
      sem_data: active.filter((p) => p.situation === "sem_data").length,
      encerradas: withSituation.length - active.length,
    };
  }, [withSituation]);

  const assetsWithoutPlan = assets.filter((a) => a.active && !plans.some((p) => p.asset_id === a.id && p.status !== "concluido")).length;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return withSituation
      .filter(({ plan, situation: s }) => {
        if (situation === "abertas" ? s === "concluida" || s === "pausada" : s !== situation) return false;
        if (type !== "todas" && plan.maintenance_type !== type) return false;
        const asset = plan.asset_id ? assetIndex.get(plan.asset_id) : undefined;
        if (category !== ALL && asset?.category !== category) return false;
        if (!q) return true;
        const supplier = plan.supplier_id ? supplierIndex.get(plan.supplier_id) : undefined;
        return [plan.title, asset?.name, asset?.location, supplier?.name].some((text) => text && normalize(text).includes(q));
      })
      .sort(
        (a, b) =>
          SITUATION_ORDER[a.situation] - SITUATION_ORDER[b.situation] ||
          (a.plan.next_due_on ?? "9999").localeCompare(b.plan.next_due_on ?? "9999") ||
          a.plan.title.localeCompare(b.plan.title, "pt-BR")
      );
  }, [withSituation, situation, type, category, query, assetIndex, supplierIndex]);

  const hasFilters = Boolean(query) || situation !== "abertas" || type !== "todas" || category !== ALL;

  function replaceParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("novo");
    update(params);
    router.replace(params.size ? `?${params}` : "?", { scroll: false });
  }

  function openPlan(plan: MaintenancePlan | null, preset?: Partial<PlanInput>) {
    setDialog({ plan, preset, key: ++seq.current });
    replaceParams((params) => (plan ? params.set("plano", plan.id) : params.delete("plano")));
  }

  function closeDialog() {
    setDialog(null);
    replaceParams((params) => params.delete("plano"));
  }

  function upsertPlan(saved: MaintenancePlan) {
    setPlans((current) => [saved, ...current.filter((p) => p.id !== saved.id)]);
  }

  const toggle = (value: SituationFilter) => setSituation((current) => (current === value ? "abertas" : value));

  return (
    <div className="space-y-6">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid grid-cols-2 gap-px bg-[#e6eef0] lg:grid-cols-4">
          <KpiCell
            icon={ClipboardList}
            label="Manutenções cadastradas"
            value={counts.cadastradas}
            hint={`${counts.preventivas} preventivas · ${counts.corretivas} corretivas`}
            tone="neutral"
            active={situation === "abertas" && !hasFilters}
            onClick={() => setSituation("abertas")}
          />
          <KpiCell
            icon={CheckCircle2}
            label="Em dia"
            value={counts.em_dia}
            hint={counts.sem_data ? `${counts.sem_data} sem data prevista` : "dentro do prazo"}
            tone="ok"
            active={situation === "em_dia"}
            onClick={() => toggle("em_dia")}
          />
          <KpiCell
            icon={CalendarClock}
            label="Próximas do vencimento"
            value={counts.proxima}
            hint="vencem nos próximos dias"
            tone={counts.proxima ? "warning" : "neutral"}
            active={situation === "proxima"}
            onClick={() => toggle("proxima")}
          />
          <KpiCell
            icon={AlertTriangle}
            label="Atrasadas"
            value={counts.atrasada}
            hint={counts.atrasada ? "passaram da data" : "nenhuma atrasada"}
            tone={counts.atrasada ? "danger" : "neutral"}
            active={situation === "atrasada"}
            onClick={() => toggle("atrasada")}
          />
        </div>
      </Card>

      {plans.length === 0 ? (
        <EmptyGuide assetsCount={assets.length} onNewPlan={() => openPlan(null)} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full lg:w-auto lg:min-w-[240px] lg:flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por manutenção, equipamento, local ou prestador"
                  aria-label="Buscar manutenção"
                  className="h-10 bg-white pl-9 text-sm"
                />
              </div>
              <Segmented<"todas" | MaintenanceType>
                label="Tipo de manutenção"
                value={type}
                options={[
                  { value: "todas", label: "Todas" },
                  { value: "preventiva", label: MAINTENANCE_TYPE_LABEL.preventiva },
                  { value: "corretiva", label: MAINTENANCE_TYPE_LABEL.corretiva },
                ]}
                onChange={setType}
              />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-10 w-full bg-white text-sm sm:w-[210px]" aria-label="Categoria do equipamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={ALL}>Todos os equipamentos</SelectItem>
                  {ASSET_CATEGORIES.filter((c) => assets.some((a) => a.category === c)).map((c) => (
                    <SelectItem key={c} value={c}>
                      {ASSET_CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={situation} onValueChange={(value) => setSituation(value as SituationFilter)}>
                <SelectTrigger className="h-10 w-full bg-white text-sm sm:w-[190px]" aria-label="Situação">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abertas">Em andamento</SelectItem>
                  <SelectItem value="atrasada">Atrasadas</SelectItem>
                  <SelectItem value="proxima">Próximas do vencimento</SelectItem>
                  <SelectItem value="em_dia">Em dia</SelectItem>
                  <SelectItem value="sem_data">Sem data prevista</SelectItem>
                  <SelectItem value="pausada">Pausadas</SelectItem>
                  <SelectItem value="concluida">Concluídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-h-7 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {filtered.length} {filtered.length === 1 ? "manutenção" : "manutenções"}
                {counts.encerradas > 0 && situation === "abertas" && ` · ${counts.encerradas} pausadas ou concluídas fora da lista`}
              </span>
              {hasFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => {
                    setQuery("");
                    setSituation("abertas");
                    setType("todas");
                    setCategory(ALL);
                  }}
                >
                  <X className="size-3.5" />
                  Limpar filtros
                </Button>
              )}
              <span className="ml-auto flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => openPlan(null, { maintenance_type: "corretiva", periodicity: "emergencial", next_due_on: today })}
                >
                  <Siren className="size-4" />
                  Registrar corretiva
                </Button>
                <Button type="button" className="gap-2" onClick={() => openPlan(null)}>
                  <Plus className="size-4" />
                  Novo plano
                </Button>
              </span>
            </div>

            <section
              aria-label="Próximas manutenções"
              className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(16,41,58,0.05)]"
            >
              <header className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1.3fr)_1.75rem] gap-x-4 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
                <span>Manutenção e equipamento</span>
                <span>Periodicidade</span>
                <span>Próxima data</span>
                <span>Prestador</span>
                <span />
              </header>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <span className="grid size-11 place-items-center rounded-full bg-[#e8f8f8] text-[#285f7a]">
                    <HardHat className="size-5" aria-hidden />
                  </span>
                  <p className="font-semibold text-foreground">Nada aqui</p>
                  <p className="text-sm text-muted-foreground">Tente outra busca ou limpe os filtros.</p>
                </div>
              ) : (
                <ul className="divide-y divide-[#eef3f5]">
                  {filtered.map(({ plan }) => (
                    <PlanRow
                      key={plan.id}
                      plan={plan}
                      asset={plan.asset_id ? assetIndex.get(plan.asset_id) : undefined}
                      supplier={plan.supplier_id ? supplierIndex.get(plan.supplier_id) : undefined}
                      owner={plan.responsible_user_id ? peopleIndex.get(plan.responsible_user_id) : undefined}
                      today={today}
                      onOpen={() => openPlan(plan)}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-4" aria-label="Agenda e ativos">
            <MonthAgenda plans={plans} today={today} />
            <Card className="gap-0 py-0">
              <Link
                href={FACILITIES_ASSETS_PATH}
                className="group flex items-center gap-3 px-5 py-4 hover:bg-[#f6fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]/60"
              >
                <span className="grid size-10 place-items-center rounded-md bg-[#eef3f5] text-[#285f7a]">
                  <Box className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">Ativos e instalações</span>
                  <span className="block text-xs text-muted-foreground">
                    {assets.length} cadastrados
                    {assetsWithoutPlan > 0 && ` · ${assetsWithoutPlan} sem plano de manutenção`}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </Card>
            <p className="flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground">
              <span className="mt-1 size-2 shrink-0 rounded-full" style={{ backgroundColor: SITUATION_STYLE.proxima.color }} aria-hidden />
              Próxima do vencimento: 2 dias antes (semanal), 4 (quinzenal), 7 (mensal) e 15 dias antes nas demais.
            </p>
          </aside>
        </div>
      )}

      {dialog && (
        <PlanDialog
          key={dialog.key}
          plan={dialog.plan}
          preset={dialog.preset}
          assets={assets}
          suppliers={suppliers}
          people={data.people}
          onClose={closeDialog}
          onSaved={upsertPlan}
          onDeleted={(id) => {
            setPlans((current) => current.filter((p) => p.id !== id));
            closeDialog();
          }}
          onAssetCreated={(asset) => setAssets((current) => [...current, asset].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")))}
          onSupplierCreated={(supplier) => setSuppliers((current) => [...current, supplier].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")))}
        />
      )}
    </div>
  );
}
