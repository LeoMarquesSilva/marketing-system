"use client";

import { useState } from "react";
import { Landmark, Loader2, Share2, Target, Unplug } from "lucide-react";
import { opexApi } from "@/lib/facilities/client";
import { ALLOCATION_LABEL, type OpexSummary } from "@/lib/facilities/opex";
import type { FacilitiesSupplier } from "@/lib/facilities/types";
import { PARTY_TYPE_LABEL, PARTY_TYPE_SHORT, THIRD_PARTY_CATEGORY_DEFS, type PartyType } from "@/lib/suppliers/categories";
import { cn } from "@/lib/utils";
import { formatBrl } from "./facilities-visuals";
import { OpexNamesField } from "./opex-names-field";

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-03-01" → "mar/26". */
export function monthLabel(mes: string): string {
  const [year, month] = mes.split("-");
  return `${MONTH_SHORT[Number(month) - 1]}/${year.slice(2)}`;
}

const DEPARTMENT_KIND_LABEL: Record<string, string> = {
  area_juridica: "área",
  indireto: "rateado",
  socio: "sócio",
  conta_de_cliente: "conta de cliente",
  encerrado: "encerrado",
};

/** Como o custo cai nas áreas: rateado (indireto), direto de uma área, dividido ou fora delas. */
export function AllocationBadge({ opex, compact = false, className }: { opex: OpexSummary; compact?: boolean; className?: string }) {
  const Icon = opex.allocation === "direto" ? Target : opex.allocation === "outro" ? Unplug : Share2;
  const label =
    opex.allocation === "direto" && opex.mainArea
      ? compact
        ? opex.mainArea
        : `Direto: ${opex.mainArea}`
      : compact && opex.allocation === "indireto"
        ? "Rateado"
        : ALLOCATION_LABEL[opex.allocation];
  return (
    <span
      title={`${ALLOCATION_LABEL[opex.allocation]}${opex.mainArea ? ` (${opex.mainArea})` : ""}, pelos departamentos do OPEX`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        opex.allocation === "indireto" && "bg-[#eeedf5] text-[#48466e]",
        opex.allocation === "direto" && "bg-[#e8f8f8] text-[#1f4a5e]",
        opex.allocation === "misto" && "bg-[#eef3f5] text-[#285f7a]",
        opex.allocation === "outro" && "bg-slate-100 text-slate-600",
        className
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function PartyTypeBadge({ type, short = false }: { type: PartyType | null; short?: boolean }) {
  if (!type) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-white px-1.5 py-px text-xs text-[#285f7a] ring-1 ring-inset ring-[#c9dde1]">
      {short ? PARTY_TYPE_SHORT[type] : PARTY_TYPE_LABEL[type]}
    </span>
  );
}

export function ThirdPartyCategoryChip({ category }: { category: string | null }) {
  const def = THIRD_PARTY_CATEGORY_DEFS.find((d) => d.key === category);
  if (!def) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#eeedf5] px-2 py-0.5 text-xs font-medium text-[#48466e]">
      <def.icon className="size-3" aria-hidden />
      {def.label}
    </span>
  );
}

/** Doze barras (mês a mês), com o valor no title de cada uma. */
function MonthBars({ months }: { months: OpexSummary["months"] }) {
  const max = Math.max(1, ...months.map((m) => m.valor));
  return (
    <figure className="mt-4" aria-label="Pago mês a mês nos últimos 12 meses">
      <div className="flex h-16 items-end gap-1">
        {months.map((m) => (
          <div key={m.mes} className="flex h-full flex-1 items-end" title={`${monthLabel(m.mes)}: ${formatBrl(m.valor)}`}>
            {m.valor > 0 ? (
              <div className="w-full rounded-t-[3px] bg-[#3e84a8]" style={{ height: `${Math.max((m.valor / max) * 100, 4)}%` }} />
            ) : (
              <div className="h-0.5 w-full rounded-full bg-[#dce9eb]" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {months.map((m, index) => (
          <span key={m.mes} className="flex-1 text-center text-xs text-muted-foreground">
            {/* No celular, só um mês sim, outro não. */}
            <span className={cn(index % 2 === 1 && "hidden sm:inline")}>{MONTH_SHORT[Number(m.mes.slice(5, 7)) - 1]}</span>
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Bloco "Pago (OPEX)" do resumo do fornecedor; sem vínculo, convida a ligar o nome. */
export function OpexPaidPanel({ supplier, onSaved }: { supplier: FacilitiesSupplier; onSaved: (supplier: FacilitiesSupplier) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opex = supplier.opex;

  async function link(names: string[]) {
    setSaving(true);
    setError(null);
    try {
      onSaved(await opexApi.link(supplier.id, names));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível ligar o nome.");
    } finally {
      setSaving(false);
    }
  }

  const field = (
    <div className="relative">
      <OpexNamesField
        value={supplier.opex_names}
        supplierName={supplier.name}
        legalName={supplier.legal_name ?? ""}
        supplierId={supplier.id}
        onChange={(names) => void link(names)}
      />
      {saving && (
        <span className="absolute right-3 top-2.5 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-label="Salvando" />
        </span>
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );

  if (!opex || opex.total12m <= 0) {
    return (
      <section className="rounded-md border border-dashed border-[#c9dde1] p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Landmark className="size-4 text-[#3e84a8]" aria-hidden />
          {supplier.opex_names.length ? "Sem pagamento no OPEX nos últimos 12 meses" : "Valor pago: ligue ao OPEX"}
        </p>
        <p className="mb-3 mt-1 text-xs leading-5 text-muted-foreground">
          {supplier.opex_names.length
            ? "Os nomes abaixo estão ligados, mas o financeiro não registrou pagamento para eles no período."
            : "O financeiro chama cada fornecedor pelo nome do terceiro no SIOE. Escolha o nome dele e o total pago, a média por mês e o rateio entre as áreas aparecem aqui."}
        </p>
        {field}
      </section>
    );
  }

  const departments = opex.byDepartment.slice(0, 4);
  const restDepartments = opex.byDepartment.length - departments.length;

  return (
    <section className="rounded-md bg-[#f7fbfc] p-4 ring-1 ring-inset ring-[#e6eef0]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Landmark className="size-3.5 text-[#3e84a8]" aria-hidden />
            Pago nos últimos 12 meses (OPEX)
          </p>
          <p className="mt-1 text-[28px] font-semibold leading-8 text-[#10293a]">{formatBrl(opex.total12m)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            média de {formatBrl(opex.monthlyAverage)} por mês
            {opex.lastPaymentMonth && ` · último pagamento em ${monthLabel(opex.lastPaymentMonth)}`}
          </p>
        </div>
        <AllocationBadge opex={opex} />
      </div>

      <MonthBars months={opex.months} />

      <div className="mt-4 grid gap-4 border-t border-[#e6eef0] pt-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Por departamento</p>
          <ul className="mt-1.5 space-y-1.5">
            {departments.map((dep) => (
              <li key={dep.departamento} className="text-sm">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-foreground">
                    {dep.departamento}
                    {dep.tipo && DEPARTMENT_KIND_LABEL[dep.tipo] && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{DEPARTMENT_KIND_LABEL[dep.tipo]}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {Math.round((dep.valor / opex.total12m) * 100)}%
                  </span>
                </span>
                <span className="mt-1 block h-1 rounded-full bg-[#e3eef2]" aria-hidden>
                  <span
                    className={cn("block h-full rounded-full", dep.tipo === "indireto" ? "bg-[#48466e]" : "bg-[#3e84a8]")}
                    style={{ width: `${Math.max((dep.valor / opex.total12m) * 100, 2)}%` }}
                  />
                </span>
              </li>
            ))}
            {restDepartments > 0 && <li className="text-xs text-muted-foreground">+{restDepartments} departamentos</li>}
          </ul>
        </div>
        <div className="min-w-0 space-y-3">
          {opex.mainAccount && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Conta do plano de contas</p>
              <p className="mt-0.5 text-sm text-foreground">{opex.mainAccount}</p>
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Nome no OPEX</p>
            {field}
          </div>
        </div>
      </div>
    </section>
  );
}
