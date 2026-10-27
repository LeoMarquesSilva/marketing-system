/**
 * Datas-chave e alertas dos contratos de fornecedores.
 *
 * A regra que mais pesa: contrato com renovação automática e aviso prévio
 * precisa de uma decisão ANTES do prazo de aviso, não no vencimento. Por isso o
 * alerta principal é "avisar até", e ele aparece 60 dias antes desse prazo.
 * Datas são ISO (AAAA-MM-DD) e as contas são feitas em UTC para não escorregar
 * um dia com fuso.
 */

import {
  ADJUSTMENT_INDEX_LABEL,
  DOCUMENT_KIND_LABEL,
  MONTH_LABELS,
  type FacilitiesSupplier,
  type Periodicity,
  type SupplierContract,
  type SupplierDocument,
  type SupplierService,
} from "./types";

export type AlertSeverity = "danger" | "warning" | "info";
export type AlertKind = "aviso" | "vencimento" | "reajuste" | "sem_arquivo" | "sem_vigencia" | "documento";

export interface FacilitiesAlert {
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  /** Data que o alerta mira (prazo, vencimento, validade). */
  date: string | null;
  /** Dias até a data (negativo = já passou). */
  days: number | null;
  contractId?: string;
  documentId?: string;
}

/** Janela para começar a avisar do prazo de aviso prévio. */
export const NOTICE_WINDOW_DAYS = 60;
/** Janela para avisar do fim de um contrato que não renova sozinho. */
export const EXPIRY_WINDOW_DAYS = 90;
/** Janela para avisar da validade de certidões, alvarás e seguros. */
export const DOCUMENT_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

export function todayIso(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function toUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** Soma meses mantendo o dia (31/01 + 1 mês = 28 ou 29/02). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type TermFields = Pick<SupplierContract, "end_date" | "auto_renew" | "renewal_months">;

/**
 * Fim do período atual. Contrato que renova sozinho e já passou do fim gravado
 * é empurrado de renovação em renovação até a próxima data futura.
 */
export function currentTermEnd(contract: TermFields, today: string): string | null {
  if (!contract.end_date) return null;
  let end = contract.end_date;
  if (contract.auto_renew && contract.renewal_months) {
    let guard = 0;
    while (end < today && guard < 600) {
      end = addMonths(end, contract.renewal_months);
      guard++;
    }
  }
  return end;
}

export interface TermProgress {
  /** Início do período atual (renovação mais recente, ou o início do contrato). */
  start: string | null;
  end: string | null;
  /** 0–1 do período já corrido; null sem início ou sem fim. */
  elapsed: number | null;
  /** Posição 0–1 do prazo de aviso dentro do período. */
  notice: number | null;
  /** Dias até o fim (negativo = já passou). */
  daysLeft: number | null;
}

/** Onde o contrato está dentro do período atual — base da barra de vigência. */
export function termProgress(
  contract: TermFields & Pick<SupplierContract, "start_date" | "notice_days">,
  today: string
): TermProgress {
  const end = currentTermEnd(contract, today);
  let start = contract.start_date;
  if (end && contract.auto_renew && contract.renewal_months) {
    const renewedStart = addMonths(end, -contract.renewal_months);
    if (!start || renewedStart > start) start = renewedStart;
  }
  if (!end) return { start, end: null, elapsed: null, notice: null, daysLeft: null };
  const daysLeft = daysBetween(today, end);
  if (!start || start >= end) return { start, end, elapsed: null, notice: null, daysLeft };
  const span = daysBetween(start, end);
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const deadline = noticeDeadline(contract, today);
  return {
    start,
    end,
    elapsed: clamp(daysBetween(start, today) / span),
    notice: deadline && deadline > start ? clamp(daysBetween(start, deadline) / span) : null,
    daysLeft,
  };
}

/** Último dia para avisar o fornecedor (fim do período menos o aviso prévio). */
export function noticeDeadline(
  contract: TermFields & Pick<SupplierContract, "notice_days">,
  today: string
): string | null {
  const end = currentTermEnd(contract, today);
  if (!end || contract.notice_days == null) return null;
  return addDays(end, -contract.notice_days);
}

/** Mês do próximo reajuste anual (1-12) e quantos meses faltam (0 = este mês). */
export function nextAdjustment(
  contract: Pick<SupplierContract, "adjustment_month">,
  today: string
): { month: number; monthsAhead: number } | null {
  if (!contract.adjustment_month) return null;
  const current = Number(today.slice(5, 7));
  return { month: contract.adjustment_month, monthsAhead: (contract.adjustment_month - current + 12) % 12 };
}

const FILE_KINDS = new Set(["contrato", "aditivo", "proposta"]);

export function contractAlerts(
  contract: SupplierContract,
  documents: SupplierDocument[],
  today: string
): FacilitiesAlert[] {
  if (contract.status !== "vigente") return [];
  const alerts: FacilitiesAlert[] = [];
  const base = { contractId: contract.id };
  const end = currentTermEnd(contract, today);
  const deadline = noticeDeadline(contract, today);

  if (deadline && end) {
    const days = daysBetween(today, deadline);
    if (days >= 0 && days <= NOTICE_WINDOW_DAYS) {
      alerts.push({
        ...base,
        kind: "aviso",
        severity: days <= 15 ? "danger" : "warning",
        title: contract.auto_renew
          ? `Avisar até ${formatShortDate(deadline)} para não renovar`
          : `Avisar até ${formatShortDate(deadline)} se não for continuar`,
        date: deadline,
        days,
      });
    } else if (days < 0 && contract.auto_renew && daysBetween(today, end) >= 0) {
      alerts.push({
        ...base,
        kind: "aviso",
        severity: "info",
        title: `Prazo de aviso passou: renova sozinho em ${formatShortDate(end)}`,
        date: end,
        days: daysBetween(today, end),
      });
    }
  }

  if (end && !contract.auto_renew) {
    const days = daysBetween(today, end);
    if (days < 0) {
      alerts.push({ ...base, kind: "vencimento", severity: "danger", title: `Venceu em ${formatShortDate(end)}`, date: end, days });
    } else if (days <= EXPIRY_WINDOW_DAYS && !alerts.some((a) => a.kind === "aviso" && a.severity !== "info")) {
      alerts.push({
        ...base,
        kind: "vencimento",
        severity: days <= 30 ? "danger" : "warning",
        title: `Vence em ${formatShortDate(end)}`,
        date: end,
        days,
      });
    }
  }

  const adjustment = nextAdjustment(contract, today);
  if (adjustment && adjustment.monthsAhead <= 1) {
    const index = contract.adjustment_index ? ` (${ADJUSTMENT_INDEX_LABEL[contract.adjustment_index]})` : "";
    alerts.push({
      ...base,
      kind: "reajuste",
      severity: "info",
      title: `Reajuste${index} ${adjustment.monthsAhead === 0 ? "neste mês" : `em ${MONTH_LABELS[adjustment.month - 1]}`}`,
      date: null,
      days: null,
    });
  }

  const hasFile = contract.sharepoint_url || documents.some((doc) => doc.contract_id === contract.id && FILE_KINDS.has(doc.kind));
  if (!hasFile) {
    alerts.push({ ...base, kind: "sem_arquivo", severity: "info", title: "Sem arquivo do contrato", date: null, days: null });
  }
  if (!contract.start_date && !contract.end_date) {
    alerts.push({ ...base, kind: "sem_vigencia", severity: "info", title: "Vigência não preenchida", date: null, days: null });
  }
  return alerts;
}

export function documentAlerts(documents: SupplierDocument[], today: string): FacilitiesAlert[] {
  return documents.flatMap((doc) => {
    if (!doc.valid_until) return [];
    const days = daysBetween(today, doc.valid_until);
    if (days > DOCUMENT_WINDOW_DAYS) return [];
    const label = doc.title || DOCUMENT_KIND_LABEL[doc.kind];
    return [
      {
        kind: "documento" as const,
        severity: days < 0 ? ("danger" as const) : ("warning" as const),
        title: days < 0 ? `${label} venceu em ${formatShortDate(doc.valid_until)}` : `${label} vence em ${formatShortDate(doc.valid_until)}`,
        date: doc.valid_until,
        days,
        documentId: doc.id,
        contractId: doc.contract_id ?? undefined,
      },
    ];
  });
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { danger: 0, warning: 1, info: 2 };

export function sortAlerts(alerts: FacilitiesAlert[]): FacilitiesAlert[] {
  return [...alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (a.days ?? 9999) - (b.days ?? 9999)
  );
}

export type KeyDateKind = "aviso" | "fim" | "renovacao" | "reajuste";

export interface KeyDate {
  kind: KeyDateKind;
  /** AAAA-MM-DD; reajuste cai no dia 1º do mês-base. */
  date: string;
  contract: SupplierContract;
}

/** Datas-chave dos contratos vigentes de hoje até `months` meses à frente, em ordem. */
export function upcomingKeyDates(contracts: SupplierContract[], today: string, months = 12): KeyDate[] {
  const limit = addMonths(today, months);
  const inWindow = (date: string | null): date is string => Boolean(date && date >= today && date <= limit);
  const dates: KeyDate[] = [];
  for (const contract of contracts) {
    if (contract.status !== "vigente") continue;
    const end = currentTermEnd(contract, today);
    const deadline = noticeDeadline(contract, today);
    if (inWindow(deadline)) dates.push({ kind: "aviso", date: deadline, contract });
    if (inWindow(end)) dates.push({ kind: contract.auto_renew ? "renovacao" : "fim", date: end, contract });
    const adjustment = nextAdjustment(contract, today);
    if (adjustment) {
      const year = Number(today.slice(0, 4)) + (adjustment.month < Number(today.slice(5, 7)) ? 1 : 0);
      const date = `${year}-${String(adjustment.month).padStart(2, "0")}-01`;
      // O mês corrente entra mesmo já tendo passado o dia 1º.
      if (date <= limit) dates.push({ kind: "reajuste", date: date < today ? today.slice(0, 8) + "01" : date, contract });
    }
  }
  return dates.sort((a, b) => a.date.localeCompare(b.date));
}

/** Tudo o que pede atenção num fornecedor ativo: contratos vigentes e documentos com validade. */
export function supplierAlerts(
  supplier: Pick<FacilitiesSupplier, "active" | "contracts" | "documents">,
  today: string
): FacilitiesAlert[] {
  if (!supplier.active) return [];
  return sortAlerts([
    ...supplier.contracts.flatMap((contract) => contractAlerts(contract, supplier.documents, today)),
    ...documentAlerts(supplier.documents, today),
  ]);
}

/** Alertas que pedem ação (exclui os informativos). */
export function isActionable(alert: FacilitiesAlert): boolean {
  return alert.severity !== "info";
}

const MONTHLY_FACTOR: Record<Periodicity, number> = {
  mensal: 1,
  bimestral: 1 / 2,
  trimestral: 1 / 3,
  semestral: 1 / 6,
  anual: 1 / 12,
  semanal: 52 / 12,
  eventual: 0,
};

/** Custo mensal equivalente das linhas ativas (eventuais não entram). */
export function monthlyCost(services: Pick<SupplierService, "amount" | "periodicity" | "active">[]): number {
  return services.reduce(
    (sum, service) => (service.active && service.amount ? sum + service.amount * MONTHLY_FACTOR[service.periodicity] : sum),
    0
  );
}
