"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  FileSignature,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRoundX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addMonths,
  contractAlerts,
  daysBetween,
  documentAlerts,
  formatShortDate,
  isActionable,
  sortAlerts,
  termProgress,
  todayIso,
  upcomingKeyDates,
  type FacilitiesAlert,
  type KeyDate,
  type KeyDateKind,
} from "@/lib/facilities/alerts";
import {
  ADJUSTMENT_INDEX_LABEL,
  CONTRACT_STATUS_LABEL,
  FORMALIZATION_LABEL,
  MONTH_LABELS,
  type ContractStatus,
  type FacilitiesPerson,
  type Formalization,
  type FacilitiesSupplier,
  type SupplierContract,
} from "@/lib/facilities/types";
import { cn } from "@/lib/utils";
import { AlertPill, contractHeadline, formatBrl, PersonAvatar, shortPersonName, SupplierMonogram, TermBar } from "./facilities-visuals";
import { Segmented } from "./form-parts";
import { contractValue, SupplierDialog, type SupplierView } from "./supplier-dialog";

type StatusFilter = ContractStatus | "todos";

const KEY_DATE: Record<KeyDateKind, { label: string; icon: LucideIcon; tile: string }> = {
  aviso: { label: "Prazo de aviso prévio", icon: CalendarClock, tile: "bg-amber-50 text-amber-700 ring-amber-200" },
  fim: { label: "Fim da vigência", icon: CalendarRange, tile: "bg-red-50 text-red-700 ring-red-200" },
  renovacao: { label: "Renova automaticamente", icon: RefreshCw, tile: "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/30" },
  reajuste: { label: "Reajuste anual", icon: RefreshCw, tile: "bg-[#eeedf5] text-[#48466e] ring-[#48466e]/10" },
};

const MONTH_SHORT = MONTH_LABELS.map((month) => month.charAt(0).toUpperCase() + month.slice(1, 3));

const FORMALIZATION_COUNT: Record<Formalization, [string, string]> = {
  contrato_assinado: ["assinado", "assinados"],
  proposta_aceita: ["proposta aceita", "propostas aceitas"],
  aceite_por_email: ["aceite por e-mail", "aceites por e-mail"],
  termo_de_adesao: ["termo de adesão", "termos de adesão"],
};

function monthlyValue(contract: SupplierContract): number {
  if (contract.value == null || contract.status !== "vigente") return 0;
  return contract.value_period === "mensal" ? contract.value : contract.value_period === "anual" ? contract.value / 12 : 0;
}

/** "23 dias", "5 meses atrás", "4 anos atrás": o selo tem largura fixa e prazos antigos não cabem em dias. */
function distance(days: number | null): { value: string; unit: string } {
  if (days == null) return { value: "—", unit: "" };
  const abs = Math.abs(days);
  const [value, singular, plural] =
    abs < 100 ? [abs, "dia", "dias"] : abs < 730 ? [Math.round(abs / 30), "mês", "meses"] : [Math.floor(abs / 365), "ano", "anos"];
  return { value: String(value), unit: `${value === 1 ? singular : plural}${days < 0 ? " atrás" : ""}` };
}

/** O que fazer com cada alerta, em uma frase. */
function decisionHint(alert: FacilitiesAlert, contract: SupplierContract | null): string {
  if (alert.kind === "documento") return "Peça a versão atualizada ao fornecedor e anexe aqui.";
  if (alert.kind === "aviso" && contract?.auto_renew) {
    return `Sem aviso até essa data, renova por mais ${contract.renewal_months ?? 12} meses.`;
  }
  if (alert.kind === "aviso") return "Avise o fornecedor até essa data se não for continuar.";
  if (alert.days !== null && alert.days < 0) return "Renove, renegocie ou marque como encerrado.";
  return "Decida se renova, renegocia ou encerra.";
}

interface ContractEntry {
  contract: SupplierContract;
  supplier: FacilitiesSupplier;
  alerts: FacilitiesAlert[];
}

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
  tone?: "neutral" | "warning";
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 bg-white px-5 py-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 text-[#3e84a8]" aria-hidden />
        {label}
      </p>
      <p className={cn("mt-1 text-[28px] font-semibold leading-8", tone === "warning" ? "text-amber-700" : "text-[#10293a]")}>{value}</p>
      {children && <div className="mt-1 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

function Owner({ person }: { person?: FacilitiesPerson }) {
  if (!person) return null;
  return (
    <span className="flex items-center gap-1.5" title={`Gestor: ${person.name}`}>
      <PersonAvatar person={person} size="xs" />
      <span className="hidden text-xs text-muted-foreground xl:inline">{shortPersonName(person.name)}</span>
    </span>
  );
}

/* ------------------------------------------------------------ agenda */

function AgendaRail({
  months,
  selected,
  onSelect,
  today,
  bySupplier,
  people,
  onOpen,
}: {
  months: Array<{ key: string; items: KeyDate[] }>;
  selected: string;
  onSelect: (key: string) => void;
  today: string;
  bySupplier: Map<string, FacilitiesSupplier>;
  people: Map<string, FacilitiesPerson>;
  onOpen: (supplierId: string, contractId: string | null) => void;
}) {
  const max = Math.max(1, ...months.map((month) => month.items.length));
  const current = months.find((month) => month.key === selected) ?? months[0];
  const [year, monthNumber] = current.key.split("-").map(Number);
  const total = months.reduce((sum, month) => sum + month.items.length, 0);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#e6eef0] px-5 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Agenda dos próximos 12 meses</h2>
          <p className="text-xs text-muted-foreground">
            {total} {total === 1 ? "data-chave" : "datas-chave"} de contratos vigentes · escolha um mês
          </p>
        </div>
        <ul className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Legenda">
          {(Object.keys(KEY_DATE) as KeyDateKind[]).map((kind) => {
            const meta = KEY_DATE[kind];
            return (
              <li key={kind} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("grid size-5 place-items-center rounded ring-1 ring-inset", meta.tile)} aria-hidden>
                  <meta.icon className="size-3" />
                </span>
                {meta.label}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-12 gap-1 px-3 py-3" role="group" aria-label="Meses">
          {months.map((month, index) => {
            const [, m] = month.key.split("-").map(Number);
            const isSelected = month.key === current.key;
            const count = month.items.length;
            const urgent = month.items.some((item) => item.kind === "aviso" || item.kind === "fim");
            return (
              <button
                key={month.key}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${MONTH_LABELS[m - 1]}: ${count} ${count === 1 ? "data" : "datas"}`}
                onClick={() => onSelect(month.key)}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-md px-1 pb-1.5 pt-2 transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
                  isSelected ? "bg-[#e8f8f8] ring-1 ring-inset ring-[#47cdd0]/40" : "hover:bg-[#f2f8f9]"
                )}
              >
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    isSelected ? "font-semibold text-[#285f7a]" : count ? "text-foreground" : "text-muted-foreground/60"
                  )}
                >
                  {count || "–"}
                </span>
                <span className="flex h-12 w-full items-end justify-center" aria-hidden>
                  <span
                    className={cn(
                      "w-full max-w-7 rounded-t-[4px] transition-colors duration-150",
                      isSelected ? "bg-[#347796]" : count ? "bg-[#bcd5e1] group-hover:bg-[#9cc0d2]" : "bg-[#eef3f5]"
                    )}
                    style={{ height: count ? `${Math.max(14, (count / max) * 100)}%` : "3px" }}
                  />
                </span>
                <span className={cn("flex items-center gap-1 text-xs", isSelected ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {MONTH_SHORT[m - 1]}
                  {urgent && <span className="size-1.5 rounded-full bg-amber-500" title="Tem prazo de aviso ou fim de vigência" />}
                </span>
                {index === 0 && <span className="text-xs leading-none text-[#285f7a]">agora</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[#e6eef0] bg-[#fafcfc]">
        <p className="px-5 pb-1 pt-3 text-xs font-semibold text-[#285f7a]">
          {MONTH_LABELS[monthNumber - 1].charAt(0).toUpperCase() + MONTH_LABELS[monthNumber - 1].slice(1)} de {year}
        </p>
        {current.items.length === 0 ? (
          <p className="px-5 pb-4 pt-1 text-sm text-muted-foreground">Nenhuma data-chave neste mês.</p>
        ) : (
          <ul className="grid gap-x-6 px-3 pb-3 md:grid-cols-2">
            {current.items.map((item, index) => {
              const meta = KEY_DATE[item.kind];
              const supplier = bySupplier.get(item.contract.supplier_id);
              const ownerId = item.contract.responsible_user_id ?? supplier?.responsible_user_id ?? null;
              const days = daysBetween(today, item.date);
              return (
                <li key={`${item.contract.id}-${item.kind}-${index}`}>
                  <button
                    type="button"
                    onClick={() => onOpen(item.contract.supplier_id, item.contract.id)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
                  >
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-md ring-1 ring-inset", meta.tile)} aria-hidden>
                      <meta.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{item.contract.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {supplier?.name} · {meta.label}
                        {item.kind === "reajuste" && item.contract.adjustment_index
                          ? ` (${ADJUSTMENT_INDEX_LABEL[item.contract.adjustment_index]})`
                          : ""}
                      </span>
                    </span>
                    <Owner person={ownerId ? people.get(ownerId) : undefined} />
                    {item.kind !== "reajuste" && (
                      <span className="w-16 shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums text-foreground">{formatShortDate(item.date).slice(0, 5)}</span>
                        <span className="block text-xs tabular-nums text-muted-foreground">em {days} {days === 1 ? "dia" : "dias"}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ decisões */

function DecisionList({
  items,
  people,
  onOpen,
}: {
  items: Array<{ alert: FacilitiesAlert; supplier: FacilitiesSupplier; contract: SupplierContract | null }>;
  people: Map<string, FacilitiesPerson>;
  onOpen: (supplierId: string, contractId: string | null) => void;
}) {
  return (
    <Card className="min-w-0 gap-0 py-0">
      <div className="flex items-center gap-2.5 border-b border-[#e6eef0] px-5 py-3">
        <ShieldAlert className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Pede decisão</h2>
          <p className="text-xs text-muted-foreground">Aviso prévio nos próximos 60 dias, vencimento em 90 e documentos vencendo</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="flex items-start gap-3 px-5 py-8">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <CheckCircle2 className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum prazo correndo</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Os alertas aparecem sozinhos quando a vigência e o aviso prévio dos contratos estão preenchidos.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-[#eef3f5]">
          {items.map(({ alert, supplier, contract }, index) => {
            const ownerId = contract?.responsible_user_id ?? supplier.responsible_user_id;
            const owner = ownerId ? people.get(ownerId) : undefined;
            const gap = distance(alert.days);
            const value = contract ? contractValue(contract) : null;
            return (
              <li key={`${alert.kind}-${alert.contractId ?? ""}-${alert.documentId ?? ""}-${index}`}>
                <button
                  type="button"
                  onClick={() => onOpen(supplier.id, contract?.id ?? null)}
                  className="group flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "flex w-16 shrink-0 flex-col items-center rounded-md py-2 text-center leading-none ring-1 ring-inset",
                      alert.severity === "danger" ? "bg-red-50 text-red-700 ring-red-200" : "bg-amber-50 text-amber-800 ring-amber-200"
                    )}
                  >
                    <span className="text-2xl font-semibold">{gap.value}</span>
                    <span className="mt-1 text-xs">{gap.unit}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <SupplierMonogram name={supplier.name} category={supplier.category} size="sm" />
                      <span className="truncate text-xs font-medium text-muted-foreground">{supplier.name}</span>
                    </span>
                    <span className="mt-1 block truncate text-sm font-semibold text-foreground">{contract?.title ?? "Documento do fornecedor"}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2">
                      <AlertPill alert={alert} />
                      {value && <span className="text-xs tabular-nums text-muted-foreground">{value}</span>}
                    </span>
                    <span className="mt-1.5 block text-xs text-muted-foreground">{decisionHint(alert, contract)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-2">
                    {owner ? (
                      <PersonAvatar person={owner} size="sm" />
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                        <UserRoundX className="size-3" aria-hidden />
                        Sem gestor
                      </span>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-[#285f7a]" aria-hidden />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ tela */

export function ContratosClient({
  initialSuppliers,
  people,
}: {
  initialSuppliers: FacilitiesSupplier[];
  people: FacilitiesPerson[];
}) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("vigente");
  const [dialog, setDialog] = useState<{ supplier: FacilitiesSupplier; view: SupplierView; key: number } | null>(null);
  // Cada abertura remonta o modal do zero (estado do formulário não vaza entre fornecedores).
  const dialogSeq = useRef(0);
  const today = todayIso();
  const peopleIndex = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const bySupplier = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const entries: ContractEntry[] = useMemo(
    () =>
      suppliers.flatMap((supplier) =>
        supplier.contracts.map((contract) => ({
          contract,
          supplier,
          alerts: supplier.active ? contractAlerts(contract, supplier.documents, today) : [],
        }))
      ),
    [suppliers, today]
  );

  const vigentes = useMemo(() => entries.filter((e) => e.contract.status === "vigente" && e.supplier.active), [entries]);
  const monthly = vigentes.reduce((sum, e) => sum + monthlyValue(e.contract), 0);
  const autoRenew = vigentes.filter((e) => e.contract.auto_renew).length;
  const withoutOwner = vigentes.filter((e) => !e.contract.responsible_user_id && !e.supplier.responsible_user_id).length;
  const withoutFile = vigentes.filter((e) => e.alerts.some((a) => a.kind === "sem_arquivo")).length;
  const formalCounts = vigentes.reduce<Record<string, number>>((acc, e) => {
    acc[e.contract.formalization] = (acc[e.contract.formalization] ?? 0) + 1;
    return acc;
  }, {});

  // Pede decisão: contratos com prazo/vencimento + documentos com validade, os mais urgentes primeiro.
  const decisions = useMemo(() => {
    const items = [
      ...entries.flatMap((entry) =>
        entry.alerts.filter(isActionable).map((alert) => ({ alert, supplier: entry.supplier, contract: entry.contract as SupplierContract | null }))
      ),
      ...suppliers
        .filter((s) => s.active)
        .flatMap((supplier) =>
          documentAlerts(supplier.documents, today).map((alert) => ({
            alert,
            supplier,
            contract: alert.contractId ? (supplier.contracts.find((c) => c.id === alert.contractId) ?? null) : null,
          }))
        ),
    ];
    return sortAlerts(items.map((item) => item.alert)).map((alert) => items.find((item) => item.alert === alert)!);
  }, [entries, suppliers, today]);

  // Agenda: 12 meses a partir do atual, mesmo os vazios (a régua mostra o ritmo do ano).
  const months = useMemo(() => {
    const keyDates = upcomingKeyDates(
      vigentes.map((e) => e.contract),
      today
    );
    return Array.from({ length: 12 }, (_, index) => {
      const key = addMonths(`${today.slice(0, 7)}-01`, index).slice(0, 7);
      return { key, items: keyDates.filter((item) => item.date.startsWith(key)) };
    });
  }, [vigentes, today]);
  const [selectedMonth, setSelectedMonth] = useState(() => months.find((m) => m.items.length > 0)?.key ?? months[0].key);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter(
        (e) =>
          (status === "todos" || e.contract.status === status) &&
          (!q || e.contract.title.toLowerCase().includes(q) || e.supplier.name.toLowerCase().includes(q))
      )
      .sort(
        (a, b) =>
          (a.alerts.some(isActionable) ? 0 : 1) - (b.alerts.some(isActionable) ? 0 : 1) ||
          (termProgress(a.contract, today).end ?? "9999").localeCompare(termProgress(b.contract, today).end ?? "9999")
      );
  }, [entries, status, query, today]);

  function open(supplierId: string, contractId: string | null) {
    const supplier = bySupplier.get(supplierId);
    if (!supplier) return;
    setDialog({
      supplier,
      view: contractId ? { kind: "contract", contractId, mode: "view" } : { kind: "supplier", mode: "view", tab: "documentos" },
      key: ++dialogSeq.current,
    });
  }

  function upsert(saved: FacilitiesSupplier) {
    setSuppliers((current) => current.map((s) => (s.id === saved.id ? saved : s)));
  }

  const statusCount = (value: StatusFilter) => (value === "todos" ? entries.length : entries.filter((e) => e.contract.status === value).length);

  return (
    <div className="space-y-6">
      <AgendaRail
        months={months}
        selected={selectedMonth}
        onSelect={setSelectedMonth}
        today={today}
        bySupplier={bySupplier}
        people={peopleIndex}
        onOpen={open}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <DecisionList items={decisions} people={peopleIndex} onOpen={open} />

        <Card className="gap-0 self-start overflow-hidden py-0">
          <div className="grid gap-px bg-[#e6eef0] sm:grid-cols-2 xl:grid-cols-1">
            <SideStat icon={FileSignature} label="Contratos vigentes" value={vigentes.length}>
              {Object.entries(formalCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([key, count]) => {
                  const [one, many] = FORMALIZATION_COUNT[key as Formalization];
                  return `${count} ${count === 1 ? one : many}`;
                })
                .join(" · ") || "Nenhum"}
            </SideStat>
            <SideStat icon={Wallet} label="Valor mensal sob contrato" value={formatBrl(monthly, { compact: true })}>
              Mensais e anuais ÷ 12 · cerca de {formatBrl(monthly * 12, { compact: true })} por ano
            </SideStat>
            <SideStat icon={RefreshCw} label="Renovam sozinhos" value={autoRenew}>
              Sem aviso no prazo, continuam por mais um período
            </SideStat>
            <SideStat icon={UserRoundX} label="Sem gestor definido" value={withoutOwner} tone={withoutOwner ? "warning" : "neutral"}>
              {withoutOwner
                ? "Defina quem decide e recebe os alertas de cada contrato"
                : withoutFile
                  ? `${withoutFile} ainda sem arquivo no sistema`
                  : "Todos com gestor e arquivo"}
            </SideStat>
          </div>
        </Card>
      </div>

      <section aria-labelledby="todos" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="todos" className="mr-2 text-base font-semibold text-foreground">
            Todos os contratos
          </h2>
          <div className="relative w-full sm:w-auto sm:min-w-[260px] sm:flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar contrato ou fornecedor"
              aria-label="Buscar contrato"
              className="h-10 bg-white pl-9 text-sm"
            />
          </div>
          <Segmented
            label="Situação do contrato"
            value={status}
            options={(["vigente", "em_negociacao", "encerrado", "todos"] as StatusFilter[]).map((value) => ({
              value,
              label: `${value === "todos" ? "Todos" : CONTRACT_STATUS_LABEL[value]} ${statusCount(value)}`,
            }))}
            onChange={setStatus}
          />
        </div>

        {filtered.length === 0 ? (
          <Card className="items-center gap-2 px-6 py-12 text-center">
            <FileSignature className="size-6 text-[#3e84a8]" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {entries.length ? "Nenhum contrato com esses filtros." : "Nenhum contrato ainda. Abra um fornecedor e cadastre o contrato dele."}
            </p>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(16,41,58,0.05)]">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.7fr)_9.5rem_2rem] gap-x-5 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2 text-xs font-medium text-muted-foreground lg:grid">
              <span>Contrato</span>
              <span>Vigência</span>
              <span className="text-right">Valor</span>
              <span className="sr-only">Gestor</span>
            </div>
            <ul className="divide-y divide-[#eef3f5]">
              {filtered.map(({ contract, supplier, alerts }) => {
                const value = contractValue(contract);
                const ownerId = contract.responsible_user_id ?? supplier.responsible_user_id;
                const owner = ownerId ? peopleIndex.get(ownerId) : undefined;
                const term = termProgress(contract, today);
                const headline = contractHeadline(contract, today);
                const actionable = alerts.filter(isActionable);
                // O selo que repete a frase da vigência ("Venceu em ...") só pesa a linha.
                const extraAlerts = actionable.filter((alert) => alert.title !== headline);
                return (
                  <li key={contract.id}>
                    <button
                      type="button"
                      onClick={() => open(supplier.id, contract.id)}
                      className={cn(
                        "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2.5 px-4 py-3 text-left transition-colors duration-150",
                        "hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none",
                        "lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.7fr)_9.5rem_2rem]"
                      )}
                    >
                      <span className={cn("flex min-w-0 items-center gap-3", contract.status === "encerrado" && "opacity-60")}>
                        <SupplierMonogram name={supplier.name} category={supplier.category} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">{contract.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {supplier.name} · {FORMALIZATION_LABEL[contract.formalization]}
                          </span>
                        </span>
                      </span>

                      <span className="col-span-2 min-w-0 pl-[3.25rem] lg:col-span-1 lg:pl-0">
                        <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                          <span
                            className={cn(
                              "truncate",
                              actionable.some((alert) => alert.severity === "danger")
                                ? "font-medium text-red-700"
                                : actionable.length
                                  ? "font-medium text-amber-800"
                                  : "text-muted-foreground"
                            )}
                          >
                            {headline}
                          </span>
                          {term.daysLeft !== null && term.daysLeft >= 0 && contract.status === "vigente" && (
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {distance(term.daysLeft).value} {distance(term.daysLeft).unit}
                            </span>
                          )}
                        </span>
                        <TermBar contract={contract} today={today} />
                        {extraAlerts.length > 0 && (
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {extraAlerts.map((alert) => (
                              <AlertPill key={alert.kind} alert={alert} />
                            ))}
                          </span>
                        )}
                      </span>

                      <span className="col-start-2 row-start-1 text-right lg:col-start-3">
                        <span className="block text-sm font-semibold tabular-nums text-foreground">{value ?? "—"}</span>
                        {contract.auto_renew && contract.status === "vigente" && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <RefreshCw className="size-3" aria-hidden />
                            renova sozinho
                          </span>
                        )}
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
              })}
            </ul>
          </div>
        )}
      </section>

      {dialog && (
        <SupplierDialog
          key={dialog.key}
          supplier={dialog.supplier}
          initialView={dialog.view}
          people={people}
          onClose={() => setDialog(null)}
          onSaved={upsert}
          onDeleted={(id) => {
            setSuppliers((current) => current.filter((s) => s.id !== id));
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
