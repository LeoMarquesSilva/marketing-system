"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  FileSignature,
  FileX2,
  Landmark,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contractAlerts, isActionable, monthlyCost, supplierAlerts, todayIso, type FacilitiesAlert } from "@/lib/facilities/alerts";
import { opexApi, type OpexNameRow } from "@/lib/facilities/client";
import {
  FACILITIES_CONTRACTS_PATH,
  SUPPLIER_AREAS,
  type FacilitiesPerson,
  type FacilitiesSupplier,
  type SupplierContract,
  type SupplierInput,
} from "@/lib/facilities/types";
import { onlyDigits } from "@/lib/masks-br";
import { PARTY_TYPE_LABEL, PARTY_TYPES, SUPPLIER_CATEGORY_DEFS, supplierCategoryLabel } from "@/lib/suppliers/categories";
import { cn } from "@/lib/utils";
import {
  AlertPill,
  AreaChip,
  CategoryGlyph,
  CategoryTile,
  contractHeadline,
  displayLegalName,
  documentLabel,
  formatBrl,
  PersonAvatar,
  SupplierMonogram,
} from "./facilities-visuals";
import { Segmented } from "./form-parts";
import { invalidateOpexNames } from "./opex-names-field";
import { AllocationBadge, PartyTypeBadge } from "./opex-panel";
import { OpexReviewDialog } from "./opex-review-dialog";
import { SupplierDialog, type SupplierView } from "./supplier-dialog";

const ALL = "__all__";
const NO_TYPE = "__sem_tipo__";
const TOP_CATEGORIES = 6;
type StatusFilter = "ativos" | "inativos" | "todos";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function matches(supplier: FacilitiesSupplier, query: string): boolean {
  if (!query) return true;
  const q = normalize(query);
  const digits = onlyDigits(query);
  return (
    normalize(supplier.name).includes(q) ||
    normalize(supplier.legal_name ?? "").includes(q) ||
    (digits.length >= 3 && (supplier.document ?? "").includes(digits)) ||
    supplier.opex_names.some((name) => normalize(name).includes(q)) ||
    supplier.services.some((service) => normalize(service.description).includes(q))
  );
}

function percent(part: number, total: number): string {
  if (!total) return "0%";
  const value = (part / total) * 100;
  return value > 0 && value < 1 ? "<1%" : `${Math.round(value)}%`;
}

const paid = (supplier: FacilitiesSupplier) => supplier.opex?.total12m ?? 0;

/* ---------------------------------------------------------------- visão geral */

function SideStat({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: "neutral" | "warning" | "danger";
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-center bg-white px-5 py-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 text-[#3e84a8]" aria-hidden />
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-[28px] font-semibold leading-8",
          tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : "text-[#10293a]"
        )}
      >
        {value}
      </p>
      {children && <div className="mt-1.5 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

interface CategorySpend {
  key: string;
  paid: number;
  suppliers: number;
}

/** Quanto do pago cai rateado entre as áreas, direto numa área ou fora delas (pelos departamentos do OPEX). */
interface AllocationSplit {
  rateado: number;
  direto: number;
  outros: number;
}

const SPLIT_PARTS: Array<{ key: keyof AllocationSplit; label: string; hint: string; color: string }> = [
  { key: "rateado", label: "Rateado entre as áreas", hint: "departamentos indiretos", color: "#48466e" },
  { key: "direto", label: "Direto de uma área", hint: "departamento de área jurídica", color: "#3e84a8" },
  { key: "outros", label: "Outros", hint: "sócios, contas de cliente e encerrados", color: "#b8cdd6" },
];

function AllocationBar({ split, total }: { split: AllocationSplit; total: number }) {
  return (
    <div className="mt-5">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-[3px]" role="img" aria-label="Divisão do valor pago entre rateado, direto e outros">
        {SPLIT_PARTS.filter((part) => split[part.key] > 0).map((part) => (
          <span
            key={part.key}
            className="h-full first:rounded-l-[3px] last:rounded-r-[3px]"
            style={{ width: `${(split[part.key] / total) * 100}%`, backgroundColor: part.color }}
            title={`${part.label}: ${formatBrl(split[part.key])}`}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {SPLIT_PARTS.map((part) => (
          <li key={part.key} className="flex items-center gap-1.5 text-xs text-muted-foreground" title={part.hint}>
            <span className="size-2 rounded-[2px]" style={{ backgroundColor: part.color }} aria-hidden />
            <span className="text-foreground">{part.label}</span>
            <span className="tabular-nums">
              {formatBrl(split[part.key], { compact: true })} · {percent(split[part.key], total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpendOverview({
  total,
  linkedCount,
  pendingCount,
  syncedAt,
  sync,
  split,
  categories,
  selected,
  onSelect,
  onReview,
  activeCount,
  inactiveCount,
  partyCounts,
  contracted,
  vigentes,
  withFile,
  autoRenew,
  decisions,
}: {
  total: number;
  linkedCount: number;
  pendingCount: number;
  syncedAt: string | null;
  sync: { run: () => void; running: boolean; error: string | null };
  split: AllocationSplit;
  categories: CategorySpend[];
  selected: string;
  onSelect: (category: string) => void;
  onReview: () => void;
  activeCount: number;
  inactiveCount: number;
  partyCounts: { prestador: number; fornecedor: number; ambos: number; semTipo: number };
  contracted: number;
  vigentes: number;
  withFile: number;
  autoRenew: number;
  decisions: Array<{ alert: FacilitiesAlert; supplier: FacilitiesSupplier }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? categories : categories.slice(0, TOP_CATEGORIES);
  const rest = categories.slice(TOP_CATEGORIES);
  const restTotal = rest.reduce((sum, row) => sum + row.paid, 0);
  const max = Math.max(1, ...categories.map((row) => row.paid));
  const first = decisions[0];
  const synced = syncedAt
    ? new Date(syncedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(17rem,1fr)]">
        <section aria-labelledby="pago-opex" className="min-w-0 px-5 py-5 lg:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p id="pago-opex" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Landmark className="size-3.5 text-[#3e84a8]" aria-hidden />
              Pago nos últimos 12 meses (OPEX)
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {sync.error ? (
                <span className="text-red-700">{sync.error}</span>
              ) : (
                synced && <span>atualizado do financeiro em {synced}</span>
              )}
              <button
                type="button"
                onClick={sync.run}
                disabled={sync.running}
                className="inline-flex items-center gap-1 rounded px-1 font-medium text-[#285f7a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50 disabled:opacity-60"
              >
                {sync.running ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
                {sync.running ? "Atualizando…" : "Atualizar agora"}
              </button>
            </p>
          </div>

          {total > 0 ? (
            <>
              <p className="mt-2 text-5xl font-semibold leading-none text-[#10293a]" title={formatBrl(total)}>
                {formatBrl(total, { compact: true })}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                média de {formatBrl(total / 12, { compact: true })} por mês · {linkedCount}{" "}
                {linkedCount === 1 ? "cadastro ligado" : "cadastros ligados"} ao OPEX
              </p>
              <AllocationBar split={split} total={total} />
            </>
          ) : (
            <div className="mt-3 max-w-xl">
              <p className="text-lg font-semibold text-[#10293a]">O valor pago vem do OPEX do financeiro</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Ligue cada fornecedor ao nome dele nos pagamentos (SIOE) para ver quanto foi pago, a média por mês e quanto é rateado
                entre as áreas.
              </p>
            </div>
          )}

          {pendingCount > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#f2f8f9] px-3 py-2.5 ring-1 ring-inset ring-[#dce9eb]">
              <p className="text-sm text-[#1f4a5e]">
                {pendingCount} {pendingCount === 1 ? "cadastro ativo ainda não está ligado" : "cadastros ativos ainda não estão ligados"} a um nome do
                OPEX{total > 0 ? (pendingCount === 1 ? " e fica fora do total" : " e ficam fora do total") : ""}.
              </p>
              <Button type="button" size="sm" variant={total > 0 ? "outline" : "default"} className={cn("gap-1.5", total > 0 && "bg-white")} onClick={onReview}>
                <ListChecks className="size-4" />
                Conferir nomes do OPEX
              </Button>
            </div>
          )}

          {categories.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Por natureza da despesa</h2>
                <span className="hidden text-xs text-muted-foreground sm:inline">clique numa natureza para filtrar</span>
              </div>
              <ul className="space-y-0.5">
                {visible.map((row) => {
                  const isSelected = selected === row.key;
                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onSelect(isSelected ? ALL : row.key)}
                        title={`${supplierCategoryLabel(row.key)}: ${formatBrl(row.paid)} pagos em 12 meses a ${row.suppliers} ${row.suppliers === 1 ? "cadastro" : "cadastros"}`}
                        className={cn(
                          "grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 sm:grid-cols-[2rem_minmax(0,11rem)_minmax(0,1fr)_7.5rem]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
                          isSelected ? "bg-[#e8f8f8] ring-1 ring-inset ring-[#47cdd0]/40" : "hover:bg-[#f4f9fa]"
                        )}
                      >
                        <CategoryTile category={row.key} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{supplierCategoryLabel(row.key)}</span>
                          <span className="block text-xs text-muted-foreground sm:hidden">
                            {row.suppliers} {row.suppliers === 1 ? "cadastro" : "cadastros"}
                          </span>
                        </span>
                        <span className="hidden h-2 rounded-[3px] bg-[#eef3f5] sm:block" aria-hidden>
                          <span
                            className={cn("block h-full rounded-r-[4px] transition-colors", isSelected ? "bg-[#347796]" : "bg-[#3e84a8]")}
                            style={{ width: `${Math.max((row.paid / max) * 100, 1.5)}%` }}
                          />
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-semibold tabular-nums text-foreground">{formatBrl(row.paid, { compact: true })}</span>
                          <span className="block text-xs tabular-nums text-muted-foreground">{percent(row.paid, total)} do total</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {rest.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#285f7a] hover:bg-[#f4f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
                >
                  <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
                  {expanded ? "Mostrar só as maiores" : `Mais ${rest.length} naturezas · ${formatBrl(restTotal, { compact: true })}`}
                </button>
              )}
            </div>
          )}
        </section>

        <aside className="grid gap-px border-t border-[#e6eef0] bg-[#e6eef0] lg:border-l lg:border-t-0" aria-label="Resumo">
          <SideStat icon={Truck} label="Fornecedores e prestadores ativos" value={activeCount}>
            <span className="block">
              {partyCounts.prestador} prestadores de serviços · {partyCounts.fornecedor} fornecedores
              {partyCounts.ambos > 0 && ` · ${partyCounts.ambos} os dois`}
            </span>
            <span className="block">
              {partyCounts.semTipo > 0 ? `${partyCounts.semTipo} sem tipo · ` : ""}
              {inactiveCount} inativos no histórico
            </span>
          </SideStat>
          <SideStat icon={FileSignature} label="Contratos vigentes" value={vigentes}>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[#e3eef2]" aria-hidden>
                <span className="block h-full rounded-full bg-[#3e84a8]" style={{ width: `${vigentes ? (withFile / vigentes) * 100 : 0}%` }} />
              </span>
              <span>
                {withFile === vigentes ? "todos com arquivo" : `${withFile} de ${vigentes} com arquivo`} · {autoRenew} renovam sozinhos
              </span>
            </span>
            {contracted > 0 && <span className="mt-1 block">{formatBrl(contracted, { compact: true })} por mês em serviços contratados</span>}
          </SideStat>
          <Link
            href={FACILITIES_CONTRACTS_PATH}
            className="group block bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]/60"
          >
            <SideStat
              icon={CalendarClock}
              label="Pedem decisão"
              value={decisions.length}
              tone={decisions.some((d) => d.alert.severity === "danger") ? "danger" : decisions.length ? "warning" : "neutral"}
            >
              <span className="block truncate">
                {first ? `${first.supplier.name}: ${first.alert.title.charAt(0).toLowerCase()}${first.alert.title.slice(1)}` : "Nenhum prazo correndo agora"}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 font-medium text-[#285f7a] group-hover:underline">
                Ver agenda de contratos
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </SideStat>
          </Link>
        </aside>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- lista */

/** O contrato que representa o fornecedor na lista: o que pede ação, senão o que vence antes. */
function mainContract(supplier: FacilitiesSupplier, today: string): { contract: SupplierContract; alert?: FacilitiesAlert } | null {
  const vigentes = supplier.contracts.filter((c) => c.status !== "encerrado");
  for (const contract of vigentes) {
    const alert = contractAlerts(contract, supplier.documents, today).find(isActionable);
    if (alert) return { contract, alert };
  }
  const sorted = [...vigentes].sort((a, b) => (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999"));
  return sorted[0] ? { contract: sorted[0] } : null;
}

function ContractCell({ supplier, today }: { supplier: FacilitiesSupplier; today: string }) {
  const main = mainContract(supplier, today);
  if (!main) {
    const closed = supplier.contracts.length > 0;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileX2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
        {closed ? "Contrato encerrado" : "Sem contrato"}
      </span>
    );
  }
  const others = supplier.contracts.filter((c) => c.status !== "encerrado").length - 1;
  return (
    <span className="flex min-w-0 flex-col gap-1">
      {main.alert ? (
        <AlertPill alert={main.alert} className="w-fit max-w-full" />
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-foreground">
          <FileCheck2 className="size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
          <span className="truncate">{contractHeadline(main.contract, today)}</span>
        </span>
      )}
      <span className="truncate text-xs text-muted-foreground">
        {main.contract.title}
        {others > 0 && ` · +${others}`}
      </span>
    </span>
  );
}

/** Valor da linha: o pago no OPEX; sem vínculo, o contratado (identificado como tal). */
function ValueCell({ supplier, maxPaid }: { supplier: FacilitiesSupplier; maxPaid: number }) {
  const opex = supplier.opex;
  if (opex && opex.total12m > 0) {
    return (
      <>
        <span className="text-sm font-semibold tabular-nums text-foreground" title={`${formatBrl(opex.total12m)} pagos nos últimos 12 meses`}>
          {formatBrl(opex.total12m, { compact: true })}
          <span className="ml-1 text-xs font-normal text-muted-foreground">em 12m</span>
        </span>
        <span className="hidden h-1 w-24 rounded-full bg-[#eef3f5] sm:block" aria-hidden>
          <span className="block h-full rounded-full bg-[#9cc0d2]" style={{ width: `${Math.max((opex.total12m / maxPaid) * 100, 3)}%` }} />
        </span>
        <AllocationBadge opex={opex} compact className="max-w-[9.5rem]" />
      </>
    );
  }
  const monthly = monthlyCost(supplier.services);
  return (
    <>
      {monthly > 0 ? (
        <span className="text-sm tabular-nums text-foreground" title="Valor contratado nos serviços; ainda sem pagamento ligado do OPEX">
          {formatBrl(monthly)}
          <span className="ml-1 text-xs text-muted-foreground">/mês contratado</span>
        </span>
      ) : null}
      {supplier.active && supplier.opex_names.length === 0 && <span className="text-xs text-muted-foreground">sem nome do OPEX</span>}
    </>
  );
}

function SupplierRow({
  supplier,
  owner,
  today,
  maxPaid,
  onOpen,
}: {
  supplier: FacilitiesSupplier;
  owner?: FacilitiesPerson;
  today: string;
  maxPaid: number;
  onOpen: () => void;
}) {
  const legal = displayLegalName(supplier.legal_name);
  // A razão social só aparece quando diz algo além do nome usado no escritório.
  const showLegal = legal && !normalize(legal).startsWith(normalize(supplier.name).split(" (")[0]);
  const subtitle = [showLegal ? legal : null, documentLabel(supplier.document)].filter(Boolean).join(" · ");

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-4 py-3 text-left transition-colors duration-150",
          "hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none",
          "lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)_minmax(0,1.7fr)_10rem_1.75rem]"
        )}
      >
        <span className={cn("flex min-w-0 items-center gap-3", !supplier.active && "opacity-60")}>
          <SupplierMonogram name={supplier.name} category={supplier.category} />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{supplier.name}</span>
              <PartyTypeBadge type={supplier.party_type} short />
              {!supplier.active && (
                <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
                  Inativo
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{subtitle || supplierCategoryLabel(supplier.category)}</span>
          </span>
        </span>

        <span className="hidden min-w-0 flex-wrap gap-1 lg:flex">
          {supplier.areas.slice(0, 2).map((area) => (
            <AreaChip key={area} area={area} />
          ))}
          {supplier.areas.length > 2 && (
            <span className="self-center text-xs text-muted-foreground" title={supplier.areas.slice(2).join(", ")}>
              +{supplier.areas.length - 2}
            </span>
          )}
        </span>

        <span className="col-span-2 min-w-0 pl-[3.25rem] lg:col-span-1 lg:pl-0">
          <ContractCell supplier={supplier} today={today} />
        </span>

        <span className="col-start-2 row-start-1 flex flex-col items-end gap-1 lg:col-start-4">
          <ValueCell supplier={supplier} maxPaid={maxPaid} />
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

/* ---------------------------------------------------------------- tela */

type DialogState = { supplier: FacilitiesSupplier | null; view?: SupplierView; prefill?: Partial<SupplierInput>; key: number };

export function FornecedoresClient({
  initialSuppliers,
  people,
  opexSyncedAt,
  initialSupplierId,
}: {
  initialSuppliers: FacilitiesSupplier[];
  people: FacilitiesPerson[];
  opexSyncedAt: string | null;
  initialSupplierId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [partyType, setPartyType] = useState(ALL);
  const [area, setArea] = useState(ALL);
  const [status, setStatus] = useState<StatusFilter>("ativos");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [syncedAt, setSyncedAt] = useState(opexSyncedAt);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function runSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await opexApi.sync();
      setSuppliers(result.suppliers);
      setSyncedAt(result.finishedAt);
      invalidateOpexNames();
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : "Não foi possível atualizar o OPEX.");
    } finally {
      setSyncing(false);
    }
  }
  const [dialog, setDialog] = useState<DialogState | null>(() => {
    const supplier = initialSupplierId ? initialSuppliers.find((s) => s.id === initialSupplierId) : undefined;
    return supplier ? { supplier, key: 0 } : null;
  });
  // Cada abertura remonta o modal do zero (estado do formulário não vaza entre fornecedores).
  const dialogSeq = useRef(0);
  const today = todayIso();
  const peopleIndex = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  const overview = useMemo(() => {
    const active = suppliers.filter((s) => s.active);
    const spend = new Map<string, CategorySpend>();
    const split: AllocationSplit = { rateado: 0, direto: 0, outros: 0 };
    let total = 0;
    let linked = 0;
    // O pago conta todo cadastro ligado (um inativo hoje pode ter recebido no período).
    for (const supplier of suppliers) {
      if (supplier.opex_names.length) linked++;
      const value = paid(supplier);
      if (value <= 0) continue;
      total += value;
      const row = spend.get(supplier.category) ?? { key: supplier.category, paid: 0, suppliers: 0 };
      row.paid += value;
      row.suppliers++;
      spend.set(supplier.category, row);
      for (const dep of supplier.opex?.byDepartment ?? []) {
        if (dep.tipo === "indireto") split.rateado += dep.valor;
        else if (dep.tipo === "area_juridica") split.direto += dep.valor;
        else split.outros += dep.valor;
      }
    }
    const vigentes = active.flatMap((s) => s.contracts.filter((c) => c.status === "vigente").map((c) => ({ c, s })));
    const withFile = vigentes.filter(
      ({ c, s }) => c.sharepoint_url || s.documents.some((d) => d.contract_id === c.id && ["contrato", "aditivo", "proposta"].includes(d.kind))
    ).length;
    const decisions = active
      .flatMap((supplier) => supplierAlerts(supplier, today).filter(isActionable).map((alert) => ({ alert, supplier })))
      .sort((a, b) => (a.alert.days ?? 9999) - (b.alert.days ?? 9999));
    return {
      total,
      linked,
      pending: active.filter((s) => s.opex_names.length === 0).length,
      split,
      categories: [...spend.values()].sort((a, b) => b.paid - a.paid),
      activeCount: active.length,
      inactiveCount: suppliers.length - active.length,
      partyCounts: {
        prestador: active.filter((s) => s.party_type === "prestador").length,
        fornecedor: active.filter((s) => s.party_type === "fornecedor").length,
        ambos: active.filter((s) => s.party_type === "ambos").length,
        semTipo: active.filter((s) => !s.party_type).length,
      },
      contracted: active.reduce((sum, s) => sum + monthlyCost(s.services), 0),
      vigentes: vigentes.length,
      withFile,
      autoRenew: vigentes.filter(({ c }) => c.auto_renew).length,
      decisions,
      maxPaid: Math.max(1, ...suppliers.map(paid)),
    };
  }, [suppliers, today]);

  const filtered = useMemo(
    () =>
      suppliers.filter(
        (s) =>
          (status === "todos" || (status === "ativos" ? s.active : !s.active)) &&
          (category === ALL || s.category === category) &&
          (partyType === ALL || (partyType === NO_TYPE ? !s.party_type : s.party_type === partyType)) &&
          (area === ALL || s.areas.includes(area) || s.services.some((service) => service.area === area)) &&
          matches(s, query.trim())
      ),
    [suppliers, status, category, partyType, area, query]
  );

  // Blocos por natureza da despesa, do que mais recebeu para o que menos recebeu.
  const groups = useMemo(() => {
    const map = new Map<string, FacilitiesSupplier[]>();
    for (const s of filtered) map.set(s.category, [...(map.get(s.category) ?? []), s]);
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        items: items.sort(
          (a, b) =>
            paid(b) - paid(a) || monthlyCost(b.services) - monthlyCost(a.services) || a.name.localeCompare(b.name, "pt-BR")
        ),
        paid: items.reduce((sum, s) => sum + paid(s), 0),
      }))
      .sort((a, b) => b.paid - a.paid || b.items.length - a.items.length);
  }, [filtered]);

  const usedCategories = SUPPLIER_CATEGORY_DEFS.filter((def) => suppliers.some((s) => s.category === def.key));
  const hasFilters = Boolean(query) || category !== ALL || partyType !== ALL || area !== ALL || status !== "ativos";

  function replaceParam(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("fornecedor", id);
    else params.delete("fornecedor");
    router.replace(params.size ? `?${params}` : "?", { scroll: false });
  }

  function openSupplier(supplier: FacilitiesSupplier | null, prefill?: Partial<SupplierInput>) {
    setDialog({ supplier, prefill, key: ++dialogSeq.current });
    replaceParam(supplier?.id ?? null);
  }

  function closeDialog() {
    setDialog(null);
    replaceParam(null);
  }

  function upsert(saved: FacilitiesSupplier) {
    setSuppliers((current) =>
      [saved, ...current.filter((s) => s.id !== saved.id)].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    );
  }

  function createFromOpex(row: OpexNameRow) {
    setReviewOpen(false);
    openSupplier(null, { name: displayLegalName(row.fornecedor), legal_name: row.fornecedor, opex_names: [row.fornecedor] });
  }

  return (
    <div className="space-y-6">
      <SpendOverview
        total={overview.total}
        linkedCount={overview.linked}
        pendingCount={overview.pending}
        syncedAt={syncedAt}
        sync={{ run: () => void runSync(), running: syncing, error: syncError }}
        split={overview.split}
        categories={overview.categories}
        selected={category}
        onSelect={setCategory}
        onReview={() => setReviewOpen(true)}
        activeCount={overview.activeCount}
        inactiveCount={overview.inactiveCount}
        partyCounts={overview.partyCounts}
        contracted={overview.contracted}
        vigentes={overview.vigentes}
        withFile={overview.withFile}
        autoRenew={overview.autoRenew}
        decisions={overview.decisions}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-auto lg:min-w-[260px] lg:flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, CNPJ, nome no OPEX ou serviço"
              aria-label="Buscar fornecedor ou prestador"
              className="h-10 bg-white pl-9 text-sm"
            />
          </div>
          <Select value={partyType} onValueChange={setPartyType}>
            <SelectTrigger className="h-10 w-[calc(50%-0.25rem)] bg-white text-sm sm:w-[200px]" aria-label="Tipo de terceiro">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os tipos</SelectItem>
              {PARTY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {PARTY_TYPE_LABEL[type]}
                </SelectItem>
              ))}
              <SelectItem value={NO_TYPE}>Tipo não informado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-10 w-[calc(50%-0.25rem)] bg-white text-sm sm:w-[230px]" aria-label="Natureza da despesa">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value={ALL}>Todas as naturezas</SelectItem>
              {usedCategories.map((def) => (
                <SelectItem key={def.key} value={def.key}>
                  <span className="flex items-center gap-2">
                    <CategoryGlyph category={def.key} className="size-4 text-[#285f7a]" />
                    {def.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="h-10 w-[calc(50%-0.25rem)] bg-white text-sm sm:w-[190px]" aria-label="Área">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as áreas</SelectItem>
              {SUPPLIER_AREAS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Segmented
            label="Situação"
            value={status}
            options={[
              { value: "ativos", label: "Ativos" },
              { value: "inativos", label: "Inativos" },
              { value: "todos", label: "Todos" },
            ]}
            onChange={setStatus}
          />
          <Button type="button" className="ml-auto gap-2" onClick={() => openSupplier(null)}>
            <Plus className="size-4" />
            Novo fornecedor ou prestador
          </Button>
        </div>
        <div className="flex min-h-7 items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {filtered.length} {filtered.length === 1 ? "cadastro" : "cadastros"}
            {groups.length > 1 && ` em ${groups.length} naturezas`}
          </span>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => {
                setQuery("");
                setCategory(ALL);
                setPartyType(ALL);
                setArea(ALL);
                setStatus("ativos");
              }}
            >
              <X className="size-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <Card className="items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[#e8f8f8] text-[#285f7a]">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-foreground">{suppliers.length ? "Nada com esses filtros" : "Nenhum cadastro ainda"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {suppliers.length ? "Tente outra busca ou limpe os filtros." : "Cadastre o primeiro fornecedor ou prestador do escritório."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section
              key={group.key}
              aria-labelledby={`grupo-${group.key}`}
              className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(16,41,58,0.05)]"
            >
              <header className="flex items-center gap-3 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-3">
                <CategoryTile category={group.key} size="sm" />
                <div className="min-w-0 flex-1">
                  <h2 id={`grupo-${group.key}`} className="truncate text-sm font-semibold text-foreground">
                    {supplierCategoryLabel(group.key)}
                    <span className="ml-2 font-normal tabular-nums text-muted-foreground">{group.items.length}</span>
                  </h2>
                </div>
                {group.paid > 0 && (
                  <p className="text-right text-xs text-muted-foreground">
                    <span className="text-sm font-semibold tabular-nums text-[#285f7a]">{formatBrl(group.paid, { compact: true })}</span>
                    <span className="ml-1">em 12 meses · {percent(group.paid, overview.total)}</span>
                  </p>
                )}
              </header>
              <ul className="divide-y divide-[#eef3f5]">
                {group.items.map((supplier) => (
                  <SupplierRow
                    key={supplier.id}
                    supplier={supplier}
                    owner={supplier.responsible_user_id ? peopleIndex.get(supplier.responsible_user_id) : undefined}
                    today={today}
                    maxPaid={overview.maxPaid}
                    onOpen={() => openSupplier(supplier)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {reviewOpen && (
        <OpexReviewDialog suppliers={suppliers} onSaved={upsert} onCreate={createFromOpex} onClose={() => setReviewOpen(false)} />
      )}

      {dialog && (
        <SupplierDialog
          key={dialog.key}
          supplier={dialog.supplier}
          initialView={dialog.view}
          prefill={dialog.prefill}
          people={people}
          onClose={closeDialog}
          onSaved={upsert}
          onDeleted={(id) => {
            setSuppliers((current) => current.filter((s) => s.id !== id));
            closeDialog();
          }}
        />
      )}
    </div>
  );
}
