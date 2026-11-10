"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Box, CalendarDays, Check, ChevronsUpDown, ClipboardList, HardHat, Loader2, Plus, Search, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { duplicateNameOf, facilitiesApi, maintenanceApi } from "@/lib/facilities/client";
import {
  isOneOff,
  MAINTENANCE_PERIODICITIES,
  MAINTENANCE_TEMPLATES,
  MAINTENANCE_TYPE_LABEL,
  MAINTENANCE_TYPES,
  nextDueAfter,
  PERIODICITY_INFO,
  type MaintenancePeriodicity,
  type MaintenanceType,
} from "@/lib/facilities/maintenance";
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABEL,
  CRITICALITY_LABEL,
  type AssetCategory,
  type AssetInput,
  type Criticality,
  type FacilitiesPerson,
  type FacilitiesSupplier,
  type FacilityAsset,
  type MaintenancePlan,
  type MaintenanceSupplierOption,
  type PlanInput,
  type RecordInput,
} from "@/lib/facilities/types";
import { maskCpfCnpj, maskPhoneBR } from "@/lib/masks-br";
import { PARTY_TYPE_SHORT, supplierCategoryLabel } from "@/lib/suppliers/categories";
import { normalizeSupplierName, pickExistingSupplier } from "@/lib/suppliers/unique-name";
import { cn } from "@/lib/utils";
import { formatShortDate, todayIso } from "@/lib/facilities/alerts";
import { SupplierMonogram } from "./facilities-visuals";
import { Field, FormSection, NONE, PersonSelect, Segmented, ToggleField } from "./form-parts";
import { emptySupplierInput } from "./supplier-forms";
import { AssetTile } from "./maintenance-visuals";

/* ------------------------------------------------------------------ ativo */

export function emptyAssetInput(): AssetInput {
  return {
    name: "",
    category: "ar_condicionado",
    location: "",
    manufacturer: "",
    model: "",
    asset_tag: "",
    installed_on: "",
    warranty_until: "",
    criticality: "media",
    notes: "",
    active: true,
  };
}

export function assetToInput(asset: FacilityAsset): AssetInput {
  return {
    name: asset.name,
    category: asset.category,
    location: asset.location ?? "",
    manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "",
    asset_tag: asset.asset_tag ?? "",
    installed_on: asset.installed_on ?? "",
    warranty_until: asset.warranty_until ?? "",
    criticality: asset.criticality,
    notes: asset.notes ?? "",
    active: asset.active,
  };
}

export function AssetCategorySelect({ id, value, onChange }: { id?: string; value: AssetCategory; onChange: (value: AssetCategory) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as AssetCategory)}>
      <SelectTrigger id={id} className="h-10 w-full bg-white text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {ASSET_CATEGORIES.map((category) => (
          <SelectItem key={category} value={category}>
            <span className="flex items-center gap-2">
              <AssetTile category={category} size="sm" className="size-6 [&_svg]:size-3.5" />
              {ASSET_CATEGORY_LABEL[category]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AssetForm({ form, onChange }: { form: AssetInput; onChange: (form: AssetInput) => void }) {
  const set = <K extends keyof AssetInput>(key: K, value: AssetInput[K]) => onChange({ ...form, [key]: value });
  return (
    <div>
      <FormSection icon={Box} title="Equipamento ou instalação">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome *" htmlFor="asset-name" hint="Como a equipe reconhece: “Split da sala de reunião 3”." className="sm:col-span-2">
            <Input id="asset-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Categoria" htmlFor="asset-cat">
            <AssetCategorySelect id="asset-cat" value={form.category} onChange={(value) => set("category", value)} />
          </Field>
          <Field label="Local" htmlFor="asset-loc" hint="Andar, sala ou unidade.">
            <Input id="asset-loc" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Ex.: 3º andar, sala 31" />
          </Field>
          <Field label="Criticidade" className="sm:col-span-2" hint="Alta: se parar, o escritório para (energia, elevador, ar da sala de servidores).">
            <Segmented<Criticality>
              label="Criticidade"
              value={form.criticality}
              options={(Object.keys(CRITICALITY_LABEL) as Criticality[]).map((key) => ({ value: key, label: CRITICALITY_LABEL[key] }))}
              onChange={(value) => set("criticality", value)}
            />
          </Field>
        </div>
      </FormSection>
      <FormSection icon={ClipboardList} title="Ficha técnica">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fabricante" htmlFor="asset-man">
            <Input id="asset-man" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
          </Field>
          <Field label="Modelo" htmlFor="asset-model">
            <Input id="asset-model" value={form.model} onChange={(e) => set("model", e.target.value)} />
          </Field>
          <Field label="Patrimônio / nº de série" htmlFor="asset-tag">
            <Input id="asset-tag" value={form.asset_tag} onChange={(e) => set("asset_tag", e.target.value)} />
          </Field>
          <Field label="Instalado em" htmlFor="asset-inst">
            <DatePickerField id="asset-inst" value={form.installed_on} onChange={(value) => set("installed_on", value)} />
          </Field>
          <Field label="Garantia até" htmlFor="asset-war">
            <DatePickerField id="asset-war" value={form.warranty_until} onChange={(value) => set("warranty_until", value)} />
          </Field>
          <Field label="Situação">
            <ToggleField
              label={form.active ? "Em uso" : "Fora de uso"}
              description={form.active ? "Aparece nos planos e na busca." : "Fica no histórico."}
              checked={form.active}
              onChange={(checked) => set("active", checked)}
            />
          </Field>
          <Field label="Observações" htmlFor="asset-notes" className="sm:col-span-2">
            <Textarea id="asset-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </FormSection>
    </div>
  );
}

/* ----------------------------------------------------- seletores com cadastro rápido */

function QuickBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-md bg-[#f7fbfc] p-3 ring-1 ring-inset ring-[#dce9eb]">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}

/** Escolhe o equipamento; "Cadastrar novo" abre um mini formulário ali mesmo. */
export function AssetPicker({
  value,
  assets,
  onChange,
  onCreated,
}: {
  value: string | null;
  assets: FacilityAsset[];
  onChange: (id: string | null) => void;
  onCreated: (asset: FacilityAsset) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", category: "ar_condicionado" as AssetCategory, location: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = assets.filter((a) => a.active || a.id === value);

  async function save() {
    if (!draft.name.trim()) return setError("Dê um nome ao equipamento.");
    setSaving(true);
    setError(null);
    try {
      const asset = await maintenanceApi.createAsset({ ...emptyAssetInput(), ...draft });
      onCreated(asset);
      onChange(asset.id);
      setCreating(false);
      setDraft({ name: "", category: "ar_condicionado", location: "" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  if (creating) {
    return (
      <QuickBox title="Novo equipamento ou instalação">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome (ex.: Split sala 31)" aria-label="Nome do equipamento" className="sm:col-span-2" autoFocus />
          <AssetCategorySelect value={draft.category} onChange={(category) => setDraft({ ...draft, category })} />
          <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Local" aria-label="Local" />
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setCreating(false)}>
            Cancelar
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Cadastrar equipamento
          </Button>
        </div>
      </QuickBox>
    );
  }

  return (
    <div className="space-y-1.5">
      <Select value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? null : next)}>
        <SelectTrigger className="h-10 w-full bg-white text-sm" aria-label="Equipamento ou instalação">
          <SelectValue placeholder="Escolha o equipamento" />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value={NONE}>Sem equipamento (serviço geral)</SelectItem>
          {active.map((asset) => (
            <SelectItem key={asset.id} value={asset.id}>
              <span className="flex items-center gap-2">
                <AssetTile category={asset.category} size="sm" className="size-6 [&_svg]:size-3.5" />
                {asset.name}
                {asset.location && <span className="text-muted-foreground">· {asset.location}</span>}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1 text-xs font-medium text-[#285f7a] hover:underline">
        <Plus className="size-3.5" aria-hidden />
        Cadastrar equipamento ou instalação
      </button>
    </div>
  );
}

const EMPTY_SUPPLIER_DRAFT = { name: "", document: "", phone: "", contact_name: "" };

/** Cadastro completo → opção do seletor (só contratos que não foram encerrados). */
function toSupplierOption(supplier: FacilitiesSupplier): MaintenanceSupplierOption {
  return {
    id: supplier.id,
    name: supplier.name,
    category: supplier.category,
    party_type: supplier.party_type,
    contracts: supplier.contracts.filter((c) => c.status !== "encerrado").map((c) => ({ id: c.id, title: c.title })),
  };
}

/** Prestador da manutenção: busca no cadastro único e "Cadastrar novo prestador" sem sair do plano. */
export function SupplierPicker({
  value,
  suppliers,
  onChange,
  onCreated,
}: {
  value: string | null;
  suppliers: MaintenanceSupplierOption[];
  onChange: (id: string | null) => void;
  onCreated: (supplier: MaintenanceSupplierOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_SUPPLIER_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Cadastro com o mesmo nome que a API achou (pode ser um inativo, fora da lista). */
  const [found, setFound] = useState<MaintenanceSupplierOption | null>(null);
  const selected = suppliers.find((s) => s.id === value);

  // Quem já cuida de manutenção aparece primeiro.
  const sorted = useMemo(() => {
    const isMaintenance = (s: MaintenanceSupplierOption) => s.category === "manutencao" || s.category === "limpeza";
    return [...suppliers].sort((a, b) => Number(isMaintenance(b)) - Number(isMaintenance(a)) || a.name.localeCompare(b.name, "pt-BR"));
  }, [suppliers]);
  const search = normalizeSupplierName(query);
  const results = sorted.filter((s) => !search || normalizeSupplierName(s.name).includes(search)).slice(0, 40);
  // Um nome, um cadastro: o nome digitado que já existe vira "Usar este prestador".
  const sameName = found ?? pickExistingSupplier(suppliers, draft.name);

  function changeName(name: string) {
    setDraft({ ...draft, name });
    if (found && normalizeSupplierName(name) !== normalizeSupplierName(found.name)) setFound(null);
  }

  function chooseExisting(option: MaintenanceSupplierOption) {
    if (!suppliers.some((s) => s.id === option.id)) onCreated(option);
    onChange(option.id);
    setCreating(false);
    setFound(null);
    setDraft(EMPTY_SUPPLIER_DRAFT);
  }

  async function save() {
    if (!draft.name.trim()) return setError("Informe o nome do prestador.");
    if (sameName) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await facilitiesApi.createSupplier({
        ...emptySupplierInput(),
        name: draft.name.trim(),
        document: draft.document,
        phone: draft.phone,
        contact_name: draft.contact_name,
        category: "manutencao",
        party_type: "prestador",
        third_party_category: "manutencao",
      });
      const option: MaintenanceSupplierOption = {
        id: saved.id,
        name: saved.name,
        category: saved.category,
        party_type: saved.party_type,
        contracts: [],
      };
      onCreated(option);
      onChange(option.id);
      setCreating(false);
      setDraft(EMPTY_SUPPLIER_DRAFT);
    } catch (cause) {
      const existing = duplicateNameOf(cause);
      if (existing) setFound(toSupplierOption(existing));
      else setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  if (creating) {
    return (
      <QuickBox title="Cadastrar novo prestador">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={draft.name} onChange={(e) => changeName(e.target.value)} placeholder="Nome *" aria-label="Nome do prestador" className="sm:col-span-2" autoFocus />
          <Input value={draft.document} inputMode="numeric" onChange={(e) => setDraft({ ...draft, document: maskCpfCnpj(e.target.value) })} placeholder="CNPJ ou CPF" aria-label="CNPJ ou CPF" />
          <Input value={draft.phone} inputMode="tel" onChange={(e) => setDraft({ ...draft, phone: maskPhoneBR(e.target.value) })} placeholder="Telefone" aria-label="Telefone" />
          <Input value={draft.contact_name} onChange={(e) => setDraft({ ...draft, contact_name: e.target.value })} placeholder="Pessoa de contato" aria-label="Pessoa de contato" className="sm:col-span-2" />
        </div>
        <p className="text-xs text-muted-foreground">
          Entra no cadastro de fornecedores e prestadores como prestador de manutenção. Contrato, documentos e nome no OPEX você completa por lá.
        </p>
        {sameName && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm ring-1 ring-inset ring-amber-200">
            <SupplierMonogram name={sameName.name} category={sameName.category} size="sm" className="size-7" />
            <p className="min-w-0 flex-1 text-amber-900">
              <span className="font-medium">{sameName.name}</span> já está no cadastro. Use o existente em vez de criar outro.
            </p>
            <Button type="button" size="sm" variant="outline" className="bg-white" disabled={saving} onClick={() => chooseExisting(sameName)}>
              Usar este prestador
            </Button>
          </div>
        )}
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => {
              setCreating(false);
              setFound(null);
            }}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" disabled={saving || Boolean(sameName)} onClick={() => void save()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Cadastrar prestador
          </Button>
        </div>
      </QuickBox>
    );
  }

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Prestador"
            className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-white px-3 text-left text-sm transition-colors hover:bg-[#f6fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
          >
            {selected ? (
              <>
                <SupplierMonogram name={selected.name} category={selected.category} size="sm" className="size-6" />
                <span className="min-w-0 flex-1 truncate text-foreground">{selected.name}</span>
              </>
            ) : (
              <span className="min-w-0 flex-1 truncate text-muted-foreground">Quem faz a manutenção</span>
            )}
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no cadastro" aria-label="Buscar prestador" className="h-9 pl-8 text-sm" />
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="w-full rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-[#f2f8f9]"
              >
                Sem prestador definido
              </button>
            )}
            {results.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-[#f2f8f9] focus-visible:bg-[#f2f8f9] focus-visible:outline-none"
              >
                <SupplierMonogram name={s.name} category={s.category} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[s.party_type ? PARTY_TYPE_SHORT[s.party_type] : null, supplierCategoryLabel(s.category)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {s.id === value && <Check className="size-4 text-[#285f7a]" aria-hidden />}
              </button>
            ))}
            {results.length === 0 && <p className="px-2.5 py-3 text-sm text-muted-foreground">Ninguém com esse nome no cadastro.</p>}
          </div>
          <div className="mt-2 border-t border-[#eef3f5] pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDraft((d) => ({ ...d, name: query.trim() }));
                setCreating(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-[#285f7a] hover:bg-[#f2f8f9]"
            >
              <Plus className="size-4" aria-hidden />
              Cadastrar novo prestador{query.trim() ? `: “${query.trim()}”` : ""}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#285f7a] hover:underline"
      >
        <Plus className="size-3.5" aria-hidden />
        Cadastrar novo prestador
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ plano */

export function emptyPlanInput(preset?: Partial<PlanInput>): PlanInput {
  return {
    asset_id: null,
    title: "",
    maintenance_type: "preventiva",
    periodicity: "mensal",
    custom_interval_days: null,
    supplier_id: null,
    contract_id: null,
    responsible_user_id: null,
    estimated_cost: null,
    last_done_on: "",
    next_due_on: "",
    status: "ativo",
    notes: "",
    ...preset,
  };
}

export function planToInput(plan: MaintenancePlan): PlanInput {
  return {
    asset_id: plan.asset_id,
    title: plan.title,
    maintenance_type: plan.maintenance_type,
    periodicity: plan.periodicity,
    custom_interval_days: plan.custom_interval_days,
    supplier_id: plan.supplier_id,
    contract_id: plan.contract_id,
    responsible_user_id: plan.responsible_user_id,
    estimated_cost: plan.estimated_cost,
    last_done_on: plan.last_done_on ?? "",
    next_due_on: plan.next_due_on ?? "",
    status: plan.status,
    notes: plan.notes ?? "",
  };
}

export function planMissing(form: PlanInput): string | null {
  if (!form.title.trim()) return "Diga o que será feito (ex.: limpeza dos filtros).";
  if (form.periodicity === "personalizada" && !form.custom_interval_days) return "Informe de quantos em quantos dias.";
  return null;
}

export function PlanForm({
  form,
  onChange,
  assets,
  suppliers,
  people,
  isNew,
  onAssetCreated,
  onSupplierCreated,
}: {
  form: PlanInput;
  onChange: (form: PlanInput) => void;
  assets: FacilityAsset[];
  suppliers: MaintenanceSupplierOption[];
  people: FacilitiesPerson[];
  isNew: boolean;
  onAssetCreated: (asset: FacilityAsset) => void;
  onSupplierCreated: (supplier: MaintenanceSupplierOption) => void;
}) {
  const set = <K extends keyof PlanInput>(key: K, value: PlanInput[K]) => onChange({ ...form, [key]: value });
  const supplier = suppliers.find((s) => s.id === form.supplier_id);
  const computedNext =
    form.last_done_on && !form.next_due_on ? nextDueAfter(form.last_done_on, form.periodicity, form.custom_interval_days) : null;

  return (
    <div>
      {isNew && (
        <section className="border-b border-[#eef3f5] px-6 py-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-[#48466e]" aria-hidden />
            Modelos comuns (preenchem o que será feito e a periodicidade)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MAINTENANCE_TEMPLATES.map((template) => {
              const selected = form.title === template.title;
              return (
                <button
                  key={template.title}
                  type="button"
                  title={template.note}
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({ ...form, title: template.title, periodicity: template.periodicity, maintenance_type: "preventiva", custom_interval_days: null })
                  }
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                    selected ? "bg-[#347796] text-white ring-[#347796]" : "bg-white text-[#285f7a] ring-[#c9dde1] hover:bg-[#f2f8f9]"
                  )}
                >
                  {template.title}
                  <span className={cn("ml-1", selected ? "text-white/80" : "text-muted-foreground")}>· {PERIODICITY_INFO[template.periodicity].label.toLowerCase()}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <FormSection icon={HardHat} title="O que será feito">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Manutenção *" htmlFor="plan-title" className="sm:col-span-2">
            <Input id="plan-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Limpeza de filtros e higienização" />
          </Field>
          <Field label="Equipamento / instalação" className="sm:col-span-2">
            <AssetPicker value={form.asset_id} assets={assets} onChange={(id) => set("asset_id", id)} onCreated={onAssetCreated} />
          </Field>
          <Field label="Tipo de manutenção">
            <Segmented<MaintenanceType>
              label="Tipo de manutenção"
              value={form.maintenance_type}
              options={MAINTENANCE_TYPES.map((type) => ({ value: type, label: MAINTENANCE_TYPE_LABEL[type] }))}
              onChange={(value) => set("maintenance_type", value)}
            />
          </Field>
          <Field label="Periodicidade" htmlFor="plan-period">
            <Select
              value={form.periodicity}
              onValueChange={(next) =>
                onChange({
                  ...form,
                  periodicity: next as MaintenancePeriodicity,
                  custom_interval_days: next === "personalizada" ? form.custom_interval_days ?? 30 : null,
                })
              }
            >
              <SelectTrigger id="plan-period" className="h-10 w-full bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {MAINTENANCE_PERIODICITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-baseline gap-2">
                      {PERIODICITY_INFO[p].label}
                      <span className="text-xs text-muted-foreground">{PERIODICITY_INFO[p].hint}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {form.periodicity === "personalizada" && (
            <Field label="A cada quantos dias *" htmlFor="plan-days">
              <Input
                id="plan-days"
                type="number"
                min={1}
                max={1825}
                value={form.custom_interval_days ?? ""}
                onChange={(e) => set("custom_interval_days", e.target.value ? Math.max(1, Number(e.target.value)) : null)}
              />
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection icon={CalendarDays} title="Quando">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Última manutenção" htmlFor="plan-last">
            <DatePickerField id="plan-last" value={form.last_done_on} onChange={(value) => set("last_done_on", value)} />
          </Field>
          <Field
            label="Próxima manutenção"
            htmlFor="plan-next"
            hint={
              computedNext
                ? `Se ficar em branco: ${formatShortDate(computedNext)} (última + ${PERIODICITY_INFO[form.periodicity].label.toLowerCase()}).`
                : isOneOff(form.periodicity)
                  ? "Data combinada para fazer."
                  : "Em branco, o sistema calcula pela última manutenção."
            }
          >
            <DatePickerField id="plan-next" value={form.next_due_on} onChange={(value) => set("next_due_on", value)} />
          </Field>
          {!isNew && (
            <Field label="Status" className="sm:col-span-2">
              <Segmented<PlanInput["status"]>
                label="Status"
                value={form.status}
                options={[
                  { value: "ativo", label: "Ativo" },
                  { value: "pausado", label: "Pausado" },
                  { value: "concluido", label: "Concluído" },
                ]}
                onChange={(value) => set("status", value)}
              />
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection icon={UserRound} title="Quem faz e quanto custa">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prestador" className="sm:col-span-2">
            <SupplierPicker
              value={form.supplier_id}
              suppliers={suppliers}
              onChange={(id) => onChange({ ...form, supplier_id: id, contract_id: id === form.supplier_id ? form.contract_id : null })}
              onCreated={onSupplierCreated}
            />
          </Field>
          <Field label="Contrato vinculado" htmlFor="plan-contract" hint={!supplier ? "Escolha o prestador primeiro." : supplier.contracts.length ? undefined : "Este prestador não tem contrato vigente no cadastro."}>
            <Select
              value={form.contract_id ?? NONE}
              disabled={!supplier || !supplier.contracts.length}
              onValueChange={(next) => set("contract_id", next === NONE ? null : next)}
            >
              <SelectTrigger id="plan-contract" className="h-10 w-full bg-white text-sm">
                <SelectValue placeholder="Sem contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem contrato</SelectItem>
                {supplier?.contracts.map((contract) => (
                  <SelectItem key={contract.id} value={contract.id}>
                    {contract.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Custo estimado (por vez)" htmlFor="plan-cost">
            <CurrencyInput
              id="plan-cost"
              value={form.estimated_cost == null ? "" : String(form.estimated_cost)}
              onChange={(value) => set("estimated_cost", value === "" ? null : Number(value))}
            />
          </Field>
          <Field label="Responsável interno" htmlFor="plan-owner" className="sm:col-span-2" hint="Quem acompanha e registra a execução.">
            <PersonSelect id="plan-owner" value={form.responsible_user_id} people={people} onChange={(id) => set("responsible_user_id", id)} />
          </Field>
          <Field label="Observações" htmlFor="plan-notes" className="sm:col-span-2">
            <Textarea id="plan-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Checklist, acesso ao local, garantia…" />
          </Field>
        </div>
      </FormSection>
    </div>
  );
}

/* -------------------------------------------------------------- execução */

export function emptyRecordInput(plan: MaintenancePlan): RecordInput {
  return { done_on: todayIso(), cost: plan.estimated_cost, supplier_id: plan.supplier_id, notes: "" };
}
