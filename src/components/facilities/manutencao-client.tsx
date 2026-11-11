"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Box, ChevronRight, ClipboardList, HardHat, Plus, Search, Siren, Truck, Wrench, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatShortDate, todayIso } from "@/lib/facilities/alerts";
import { PERIODICITY_INFO, planSituation, type MaintenanceSituation } from "@/lib/facilities/maintenance";
import {
  ASSET_CATEGORY_LABEL,
  FACILITIES_ASSETS_PATH,
  FACILITIES_SUPPLIERS_PATH,
  type FacilityAsset,
  type MaintenanceData,
  type MaintenancePlan,
  type PlanInput,
} from "@/lib/facilities/types";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./facilities-visuals";
import { AssetTile, periodicityText, SituationBadge } from "./maintenance-visuals";
import { PlanDialog } from "./plan-dialog";

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

/** Número do painel "Controle de manutenções" (como na imagem do gestor), clicável para filtrar. */
function KpiCell({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: "neutral" | "ok" | "warning" | "danger";
  active: boolean;
  onClick: () => void;
}) {
  const color = { neutral: "text-[#10293a]", ok: "text-[#1f7a4d]", warning: "text-amber-700", danger: "text-red-700" }[tone];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col items-start rounded-md px-4 py-3 text-left transition-colors duration-150",
        "hover:bg-[#f6fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
        active && "bg-[#f2f8f9] ring-1 ring-inset ring-[#c9dde1]"
      )}
    >
      <span className={cn("text-[32px] font-semibold leading-9 tabular-nums", color)}>{value}</span>
      <span className="mt-1 text-sm text-muted-foreground">{label}</span>
    </button>
  );
}

function PlanRow({
  plan,
  asset,
  owner,
  today,
  onOpen,
}: {
  plan: MaintenancePlan;
  asset?: FacilityAsset;
  owner?: MaintenanceData["people"][number];
  today: string;
  onOpen: () => void;
}) {
  const { situation, days } = planSituation(plan, today);
  const category = asset?.category ?? plan.category;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left transition-colors duration-150",
          "hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none",
          "md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_1.75rem]"
        )}
      >
        <span className={cn("flex min-w-0 items-center gap-3", (situation === "pausada" || situation === "concluida") && "opacity-60")}>
          {category ? (
            <AssetTile category={category} />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200">
              <Wrench className="size-5" aria-hidden />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {asset ? asset.name : category ? ASSET_CATEGORY_LABEL[category] : "Serviço geral"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {[plan.title, plan.maintenance_type === "corretiva" ? "Corretiva" : null, asset?.location].filter(Boolean).join(" · ")}
            </span>
          </span>
        </span>

        <span className="hidden min-w-0 md:block">
          <span className="block truncate text-sm text-foreground">{periodicityText(plan)}</span>
          {PERIODICITY_INFO[plan.periodicity].hint && (
            <span className="block truncate text-xs text-muted-foreground">{PERIODICITY_INFO[plan.periodicity].hint}</span>
          )}
        </span>

        <span className="col-start-2 row-start-1 flex flex-col items-end gap-1 md:col-start-3 md:items-start">
          <span className="text-sm font-semibold tabular-nums text-foreground">{plan.next_due_on ? formatShortDate(plan.next_due_on) : "—"}</span>
          <SituationBadge situation={situation} days={days} />
        </span>

        <span className="hidden justify-end md:flex">
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

/** Sem plano ainda: os três cadastros do gestor, na ordem dele. */
function EmptyGuide({ assetsCount, onNewPlan }: { assetsCount: number; onNewPlan: () => void }) {
  const steps: Array<{ icon: LucideIcon; title: string; text: string; action: ReactNode }> = [
    {
      icon: Truck,
      title: "Cadastro de fornecedores",
      text: "Quem presta o serviço.",
      action: (
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={FACILITIES_SUPPLIERS_PATH}>
            Fornecedores
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      ),
    },
    {
      icon: Box,
      title: "Cadastro de ativos e instalações",
      text: "O que precisa receber manutenção.",
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
      text: "O que será feito, por quem, com qual periodicidade e quando.",
      action: (
        <Button type="button" size="sm" variant={assetsCount ? "default" : "outline"} className="gap-1.5" onClick={onNewPlan}>
          <Plus className="size-3.5" />
          Novo plano
        </Button>
      ),
    },
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="border-b border-[#e6eef0] px-6 py-5">
        <p className="text-lg font-semibold text-[#10293a]">Nenhuma manutenção cadastrada</p>
        <p className="mt-1 text-sm text-muted-foreground">O plano liga os outros dois cadastros: o fornecedor e o equipamento ou instalação.</p>
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
            <div className="mt-auto">{step.action}</div>
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
  const seq = useRef(0);
  const [dialog, setDialog] = useState<DialogState | null>(() => {
    if (newForAssetId) {
      const asset = data.assets.find((a) => a.id === newForAssetId);
      return { plan: null, preset: { asset_id: newForAssetId, category: asset?.category ?? "" }, key: 0 };
    }
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
      em_dia: active.filter((p) => p.situation === "em_dia").length,
      proxima: active.filter((p) => p.situation === "proxima").length,
      atrasada: active.filter((p) => p.situation === "atrasada").length,
    };
  }, [withSituation]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return withSituation
      .filter(({ plan, situation: s }) => {
        if (situation === "abertas" ? s === "concluida" || s === "pausada" : s !== situation) return false;
        if (!q) return true;
        const asset = plan.asset_id ? assetIndex.get(plan.asset_id) : undefined;
        const supplier = plan.supplier_id ? supplierIndex.get(plan.supplier_id) : undefined;
        return [plan.title, asset?.name, asset?.location, supplier?.name].some((text) => text && normalize(text).includes(q));
      })
      .sort(
        (a, b) =>
          SITUATION_ORDER[a.situation] - SITUATION_ORDER[b.situation] ||
          (a.plan.next_due_on ?? "9999").localeCompare(b.plan.next_due_on ?? "9999") ||
          a.plan.title.localeCompare(b.plan.title, "pt-BR")
      );
  }, [withSituation, situation, query, assetIndex, supplierIndex]);

  const hasFilters = Boolean(query) || situation !== "abertas";

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
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
          <h2 className="text-base font-semibold text-foreground">Controle de manutenções</h2>
          <div className="flex gap-2">
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
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 p-2 lg:grid-cols-4">
          <KpiCell
            label="Manutenções cadastradas"
            value={counts.cadastradas}
            tone="neutral"
            active={situation === "abertas" && !query}
            onClick={() => setSituation("abertas")}
          />
          <KpiCell label="Em dia" value={counts.em_dia} tone="ok" active={situation === "em_dia"} onClick={() => toggle("em_dia")} />
          <KpiCell
            label="Próximas do vencimento"
            value={counts.proxima}
            tone={counts.proxima ? "warning" : "neutral"}
            active={situation === "proxima"}
            onClick={() => toggle("proxima")}
          />
          <KpiCell
            label="Atrasadas"
            value={counts.atrasada}
            tone={counts.atrasada ? "danger" : "neutral"}
            active={situation === "atrasada"}
            onClick={() => toggle("atrasada")}
          />
        </div>
      </Card>

      {plans.length === 0 ? (
        <EmptyGuide assetsCount={assets.length} onNewPlan={() => openPlan(null)} />
      ) : (
        <section aria-labelledby="proximas-manutencoes" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="proximas-manutencoes" className="mr-auto text-base font-semibold text-foreground">
              Próximas manutenções
            </h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar equipamento, local ou fornecedor"
                aria-label="Buscar manutenção"
                className="h-10 bg-white pl-9 text-sm"
              />
            </div>
            <Select value={situation} onValueChange={(value) => setSituation(value as SituationFilter)}>
              <SelectTrigger className="h-10 w-full bg-white text-sm sm:w-[200px]" aria-label="Situação">
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
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1 px-2 text-xs"
                onClick={() => {
                  setQuery("");
                  setSituation("abertas");
                }}
              >
                <X className="size-3.5" />
                Limpar
              </Button>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(16,41,58,0.05)]">
            <div className="hidden grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_1.75rem] gap-x-4 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
              <span>Equipamento</span>
              <span>Periodicidade</span>
              <span>Próxima data</span>
              <span />
            </div>
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
                    owner={plan.responsible_user_id ? peopleIndex.get(plan.responsible_user_id) : undefined}
                    today={today}
                    onOpen={() => openPlan(plan)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
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
