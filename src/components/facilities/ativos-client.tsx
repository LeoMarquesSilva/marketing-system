"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Box, ClipboardList, Gauge, Loader2, PencilLine, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { daysBetween, formatShortDate, todayIso } from "@/lib/facilities/alerts";
import { maintenanceApi } from "@/lib/facilities/client";
import { planSituation, type MaintenanceSituation } from "@/lib/facilities/maintenance";
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABEL,
  CRITICALITY_LABEL,
  FACILITIES_MAINTENANCE_PATH,
  type AssetInput,
  type Criticality,
  type FacilityAsset,
  type MaintenanceData,
  type MaintenancePlan,
} from "@/lib/facilities/types";
import { cn } from "@/lib/utils";
import { Segmented } from "./form-parts";
import { assetToInput, AssetForm, emptyAssetInput } from "./maintenance-forms";
import { AssetTile, periodicityText, SituationBadge } from "./maintenance-visuals";

const SITUATION_RANK: Record<MaintenanceSituation, number> = { atrasada: 0, proxima: 1, em_dia: 2, sem_data: 3, pausada: 4, concluida: 5 };

const CRITICALITY_STYLE: Record<Criticality, string> = {
  alta: "bg-red-50 text-red-800 ring-red-200",
  media: "bg-amber-50 text-amber-800 ring-amber-200",
  baixa: "bg-slate-50 text-slate-600 ring-slate-200",
};

function CriticalityChip({ value }: { value: Criticality }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", CRITICALITY_STYLE[value])}>
      <Gauge className="size-3" aria-hidden />
      Criticidade {CRITICALITY_LABEL[value].toLowerCase()}
    </span>
  );
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** O plano que representa o ativo: o mais urgente entre os em andamento. */
function worstPlan(plans: MaintenancePlan[], today: string) {
  return plans
    .map((plan) => ({ plan, ...planSituation(plan, today) }))
    .sort((a, b) => SITUATION_RANK[a.situation] - SITUATION_RANK[b.situation] || (a.plan.next_due_on ?? "9999").localeCompare(b.plan.next_due_on ?? "9999"))[0];
}

function AssetDialog({
  asset: initialAsset,
  plans,
  onClose,
  onSaved,
  onDeleted,
}: {
  asset: FacilityAsset | null;
  plans: MaintenancePlan[];
  onClose: () => void;
  onSaved: (asset: FacilityAsset) => void;
  onDeleted: (id: string) => void;
}) {
  const [asset, setAsset] = useState(initialAsset);
  const [editing, setEditing] = useState(!initialAsset);
  const [form, setForm] = useState<AssetInput>(() => (initialAsset ? assetToInput(initialAsset) : emptyAssetInput()));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayIso();

  async function run(task: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const save = () =>
    run(async () => {
      if (!form.name.trim()) throw new Error("Dê um nome ao equipamento ou instalação.");
      const saved = asset ? await maintenanceApi.updateAsset(asset.id, form) : await maintenanceApi.createAsset(form);
      setAsset(saved);
      onSaved(saved);
      setForm(assetToInput(saved));
      setEditing(false);
    });

  const remove = () =>
    run(async () => {
      if (!asset) return;
      await maintenanceApi.deleteAsset(asset.id);
      onDeleted(asset.id);
    });

  const ownPlans = asset ? plans.filter((p) => p.asset_id === asset.id) : [];
  const warrantyDays = asset?.warranty_until ? daysBetween(today, asset.warranty_until) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton={!saving}>
        {editing || !asset ? (
          <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
            <DialogTitle className="text-lg">{asset ? `Editar ${asset.name}` : "Novo ativo ou instalação"}</DialogTitle>
            <DialogDescription>O que precisa receber manutenção. O plano (o que, quem e quando) vem depois.</DialogDescription>
          </DialogHeader>
        ) : (
          <DialogHeader className="gap-0 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
            <div className="flex items-start gap-4">
              <AssetTile category={asset.category} size="lg" />
              <div className="min-w-0 space-y-1.5">
                <DialogTitle className="text-lg">{asset.name}</DialogTitle>
                <DialogDescription className="mt-0">
                  {[ASSET_CATEGORY_LABEL[asset.category], asset.location].filter(Boolean).join(" · ")}
                </DialogDescription>
                <div className="flex flex-wrap gap-1.5">
                  <CriticalityChip value={asset.criticality} />
                  {!asset.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Fora de uso</span>}
                </div>
              </div>
            </div>
          </DialogHeader>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {editing || !asset ? (
            <AssetForm form={form} onChange={setForm} />
          ) : (
            <div className="space-y-6 px-6 py-5">
              <section className="grid gap-4 sm:grid-cols-3">
                {[
                  ["Fabricante e modelo", [asset.manufacturer, asset.model].filter(Boolean).join(" ") || "—"],
                  ["Patrimônio / nº de série", asset.asset_tag || "—"],
                  ["Instalado em", asset.installed_on ? formatShortDate(asset.installed_on) : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm text-foreground">{value}</p>
                  </div>
                ))}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Garantia</p>
                  <p className={cn("flex items-center gap-1.5 text-sm", warrantyDays !== null && warrantyDays < 0 ? "text-muted-foreground" : "text-foreground")}>
                    <ShieldCheck className="size-4 text-[#3e84a8]" aria-hidden />
                    {asset.warranty_until
                      ? `${warrantyDays !== null && warrantyDays < 0 ? "Venceu em" : "Até"} ${formatShortDate(asset.warranty_until)}`
                      : "Não informada"}
                  </p>
                </div>
              </section>
              {asset.notes && <p className="whitespace-pre-line rounded-md bg-[#f2f8f9] px-3 py-2 text-sm leading-6 text-foreground">{asset.notes}</p>}

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <ClipboardList className="size-4 text-[#3e84a8]" aria-hidden />
                    Planos de manutenção
                  </h3>
                  <Button asChild size="sm" variant="outline" className="h-8 gap-1">
                    <Link href={`${FACILITIES_MAINTENANCE_PATH}?novo=${asset.id}`}>
                      <Plus className="size-3.5" />
                      Novo plano
                    </Link>
                  </Button>
                </div>
                {ownPlans.length === 0 ? (
                  <p className="rounded-md border border-dashed border-[#dce9eb] px-4 py-4 text-sm text-muted-foreground">
                    Nenhum plano para este equipamento ainda.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#eef3f5] rounded-md ring-1 ring-[#e6eef0]">
                    {ownPlans.map((plan) => {
                      const { situation, days } = planSituation(plan, today);
                      return (
                        <li key={plan.id}>
                          <Link
                            href={`${FACILITIES_MAINTENANCE_PATH}?plano=${plan.id}`}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">{plan.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {periodicityText(plan)} · próxima {plan.next_due_on ? formatShortDate(plan.next_due_on) : "sem data"}
                              </span>
                            </span>
                            <SituationBadge situation={situation} days={days} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>

        {error && <p className="border-t border-red-100 bg-red-50 px-6 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex items-center justify-between gap-2 border-t border-[#e6eef0] px-6 py-3">
          {asset && !editing ? (
            <>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="destructive" disabled={saving} onClick={() => void remove()}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    Confirmar exclusão
                  </Button>
                  <Button type="button" variant="ghost" disabled={saving} onClick={() => setConfirmDelete(false)}>
                    Manter
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="ghost" className="gap-2 px-3 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" />
                  <span className="hidden sm:inline">Excluir</span>
                </Button>
              )}
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
                <PencilLine className="size-4" />
                Editar
              </Button>
            </>
          ) : (
            <>
              <div />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    if (!asset) return onClose();
                    setForm(assetToInput(asset));
                    setEditing(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" disabled={saving} onClick={() => void save()}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {asset ? "Salvar alterações" : "Cadastrar"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AtivosClient({ data }: { data: MaintenanceData }) {
  const [assets, setAssets] = useState(data.assets);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"uso" | "sem_plano" | "todos">("uso");
  const [dialog, setDialog] = useState<{ asset: FacilityAsset | null; key: number } | null>(null);
  const seq = useRef(0);
  const today = todayIso();

  const plansBy = useMemo(() => {
    const map = new Map<string, MaintenancePlan[]>();
    for (const plan of data.plans) if (plan.asset_id) map.set(plan.asset_id, [...(map.get(plan.asset_id) ?? []), plan]);
    return map;
  }, [data.plans]);
  const openPlans = (id: string) => (plansBy.get(id) ?? []).filter((p) => p.status !== "concluido");

  const filtered = assets.filter((asset) => {
    if (show === "uso" && !asset.active) return false;
    if (show === "sem_plano" && (!asset.active || openPlans(asset.id).length > 0)) return false;
    const q = normalize(query.trim());
    return !q || [asset.name, asset.location, asset.manufacturer, asset.model, asset.asset_tag].some((t) => t && normalize(t).includes(q));
  });

  const groups = ASSET_CATEGORIES.map((category) => ({ category, items: filtered.filter((a) => a.category === category) })).filter((g) => g.items.length);
  const active = assets.filter((a) => a.active);
  const withoutPlan = active.filter((a) => openPlans(a.id).length === 0).length;
  const critical = active.filter((a) => a.criticality === "alta").length;
  const warrantySoon = active.filter((a) => a.warranty_until && daysBetween(today, a.warranty_until) >= 0 && daysBetween(today, a.warranty_until) <= 90).length;

  const open = (asset: FacilityAsset | null) => setDialog({ asset, key: ++seq.current });

  return (
    <div className="space-y-6">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid grid-cols-2 gap-px bg-[#e6eef0] lg:grid-cols-4">
          {[
            { label: "Em uso", value: active.length, hint: `${assets.length - active.length} fora de uso no histórico` },
            { label: "Sem plano de manutenção", value: withoutPlan, hint: withoutPlan ? "ninguém cuidando da data" : "todos com plano" },
            { label: "Criticidade alta", value: critical, hint: "se param, o escritório para" },
            { label: "Garantia vence em 90 dias", value: warrantySoon, hint: "vale acionar antes de acabar" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white px-5 py-4">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-[32px] font-semibold leading-9 tabular-nums text-[#10293a]">{stat.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{stat.hint}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto sm:min-w-[260px] sm:flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, local, modelo ou patrimônio"
            aria-label="Buscar ativo"
            className="h-10 bg-white pl-9 text-sm"
          />
        </div>
        <Segmented
          label="Mostrar"
          value={show}
          options={[
            { value: "uso", label: "Em uso" },
            { value: "sem_plano", label: "Sem plano" },
            { value: "todos", label: "Todos" },
          ]}
          onChange={setShow}
        />
        {(query || show !== "uso") && (
          <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => (setQuery(""), setShow("uso"))}>
            <X className="size-3.5" />
            Limpar
          </Button>
        )}
        <Button type="button" className="ml-auto gap-2" onClick={() => open(null)}>
          <Plus className="size-4" />
          Novo ativo ou instalação
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card className="items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[#e8f8f8] text-[#285f7a]">
            <Box className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-foreground">{assets.length ? "Nada com esses filtros" : "Nenhum ativo cadastrado"}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {assets.length
                ? "Tente outra busca."
                : "Cadastre o que precisa de manutenção: aparelhos de ar-condicionado, elevador, gerador, extintores, caixa d'água, quadro elétrico."}
            </p>
          </div>
          {!assets.length && (
            <Button type="button" className="gap-2" onClick={() => open(null)}>
              <Plus className="size-4" />
              Cadastrar o primeiro
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section
              key={group.category}
              aria-labelledby={`ativos-${group.category}`}
              className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(16,41,58,0.05)]"
            >
              <header className="flex items-center gap-3 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-3">
                <AssetTile category={group.category} size="sm" />
                <h2 id={`ativos-${group.category}`} className="text-sm font-semibold text-foreground">
                  {ASSET_CATEGORY_LABEL[group.category]}
                  <span className="ml-2 font-normal tabular-nums text-muted-foreground">{group.items.length}</span>
                </h2>
              </header>
              <ul className="divide-y divide-[#eef3f5]">
                {group.items.map((asset) => {
                  const plans = openPlans(asset.id);
                  const worst = worstPlan(plans, today);
                  return (
                    <li key={asset.id}>
                      <button
                        type="button"
                        onClick={() => open(asset)}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.3fr)]"
                      >
                        <span className={cn("min-w-0", !asset.active && "opacity-60")}>
                          <span className="block truncate text-sm font-semibold text-foreground">{asset.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[asset.location, [asset.manufacturer, asset.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "Sem local informado"}
                          </span>
                        </span>
                        <span className="hidden md:block">
                          <CriticalityChip value={asset.criticality} />
                        </span>
                        <span className="col-start-2 row-start-1 flex flex-col items-end gap-1 md:col-start-3 md:items-start">
                          {worst ? (
                            <>
                              <SituationBadge situation={worst.situation} days={worst.days} />
                              <span className="text-xs text-muted-foreground">
                                {plans.length} {plans.length === 1 ? "plano" : "planos"}
                                {worst.plan.next_due_on && ` · próxima ${formatShortDate(worst.plan.next_due_on)}`}
                              </span>
                            </>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                              Sem plano
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {dialog && (
        <AssetDialog
          key={dialog.key}
          asset={dialog.asset}
          plans={data.plans}
          onClose={() => setDialog(null)}
          onSaved={(saved) => setAssets((current) => [saved, ...current.filter((a) => a.id !== saved.id)].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")))}
          onDeleted={(id) => {
            setAssets((current) => current.filter((a) => a.id !== id));
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
