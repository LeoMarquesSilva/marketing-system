/**
 * Leitura do orçamento do evento: quem cuida de cada despesa (pacote da produtora ou o
 * escritório, direto), por fornecedor e categoria, com totais, pontos de atenção,
 * calendário de pagamentos e aprovações. Só regras, sem banco.
 */
import type { BudgetManagedBy, EventBudgetItem } from "@/lib/eventos";

export const BUDGET_CATEGORY_NAME: Record<string, string> = {
  catering: "Buffet e bebidas",
  decoracao: "Decoração e cenografia",
  locacao: "Locação e estrutura",
  fornecedor: "Equipe e serviços",
  brindes: "Brindes",
  outros: "Outros",
};

const CATEGORY_ORDER = ["catering", "decoracao", "locacao", "fornecedor", "brindes", "outros"];

export function budgetCategoryName(category: string): string {
  return BUDGET_CATEGORY_NAME[category] ?? category.replaceAll("_", " ");
}

export interface BudgetCategoryGroup {
  category: string;
  label: string;
  items: EventBudgetItem[];
  total: number;
}

export interface BudgetVendorGroup {
  vendor: string;
  items: EventBudgetItem[];
  categories: BudgetCategoryGroup[];
  /** Soma do previsto das linhas aprovadas. */
  approved: number;
  /** Soma do previsto das linhas em análise. */
  pending: number;
  attention: number;
}

export interface BudgetScopeGroup {
  managedBy: BudgetManagedBy;
  vendors: BudgetVendorGroup[];
  approved: number;
  pending: number;
  count: number;
}

export interface BudgetTotals {
  approved: number;
  pending: number;
  /** Aprovado + em análise: o que a festa custa se tudo for aprovado. */
  projected: number;
  byScope: Record<BudgetManagedBy, number>;
}

const NO_VENDOR = "Sem fornecedor definido";

function sumBy(items: EventBudgetItem[], status: "aprovado" | "em_analise"): number {
  return items.filter((item) => item.approvalStatus === status).reduce((total, item) => total + item.amountPlanned, 0);
}

/** Linhas descartadas ficam fora dos grupos e dos totais. */
export function activeBudgetItems(items: EventBudgetItem[]): EventBudgetItem[] {
  return items.filter((item) => item.approvalStatus !== "descartado");
}

function groupCategories(items: EventBudgetItem[]): BudgetCategoryGroup[] {
  const map = new Map<string, EventBudgetItem[]>();
  for (const item of items) map.set(item.category, [...(map.get(item.category) ?? []), item]);
  return [...map.entries()]
    .map(([category, list]) => ({
      category,
      label: budgetCategoryName(category),
      items: list,
      total: list.reduce((total, item) => total + item.amountPlanned, 0),
    }))
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.category);
      const ib = CATEGORY_ORDER.indexOf(b.category);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.label.localeCompare(b.label, "pt-BR");
    });
}

/** Pacote da produtora primeiro, depois o que é por nossa conta; dentro, fornecedores do maior para o menor. */
export function groupBudget(items: EventBudgetItem[]): BudgetScopeGroup[] {
  const active = activeBudgetItems(items);
  return (["produtora", "escritorio"] as BudgetManagedBy[]).map((managedBy) => {
    const scoped = active.filter((item) => item.managedBy === managedBy);
    const byVendor = new Map<string, EventBudgetItem[]>();
    for (const item of scoped) {
      const vendor = item.vendorName?.trim() || NO_VENDOR;
      byVendor.set(vendor, [...(byVendor.get(vendor) ?? []), item]);
    }
    const vendors = [...byVendor.entries()]
      .map(([vendor, list]) => ({
        vendor,
        items: list,
        categories: groupCategories(list),
        approved: sumBy(list, "aprovado"),
        pending: sumBy(list, "em_analise"),
        attention: list.filter((item) => item.attentionNote).length,
      }))
      .sort((a, b) => b.approved + b.pending - (a.approved + a.pending) || a.vendor.localeCompare(b.vendor, "pt-BR"));
    return { managedBy, vendors, approved: sumBy(scoped, "aprovado"), pending: sumBy(scoped, "em_analise"), count: scoped.length };
  });
}

export function budgetTotals(items: EventBudgetItem[]): BudgetTotals {
  const active = activeBudgetItems(items);
  const approved = sumBy(active, "aprovado");
  const pending = sumBy(active, "em_analise");
  const scope = (managedBy: BudgetManagedBy) => active.filter((item) => item.managedBy === managedBy).reduce((total, item) => total + item.amountPlanned, 0);
  return { approved, pending, projected: approved + pending, byScope: { produtora: scope("produtora"), escritorio: scope("escritorio") } };
}

/* ───────────────────────── Pagamentos ───────────────────────── */

export interface EventPayment {
  id: string;
  eventId: string;
  vendorName: string | null;
  description: string;
  amount: number;
  dueDate: string | null;
  paid: boolean;
  paidDate: string | null;
  notes: string | null;
  sortOrder: number;
}

export type PaymentState = "pago" | "vencido" | "proximo" | "futuro" | "sem_data";

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** "proximo" = vence em até 7 dias. `today` no formato AAAA-MM-DD. */
export function paymentState(payment: EventPayment, today: string): PaymentState {
  if (payment.paid) return "pago";
  if (!payment.dueDate) return "sem_data";
  const days = daysBetween(today, payment.dueDate);
  if (days < 0) return "vencido";
  return days <= 7 ? "proximo" : "futuro";
}

/** A pagar primeiro (vencidos, depois por data; sem data no fim); pagos por último. */
export function sortPayments(payments: EventPayment[]): EventPayment[] {
  const rank = (payment: EventPayment) => (payment.paid ? 2 : payment.dueDate ? 0 : 1);
  return [...payments].sort(
    (a, b) => rank(a) - rank(b) || (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.sortOrder - b.sortOrder
  );
}

export function paymentTotals(payments: EventPayment[]): { paid: number; open: number } {
  let paid = 0;
  let open = 0;
  for (const payment of payments) {
    if (payment.paid) paid += payment.amount;
    else open += payment.amount;
  }
  return { paid, open };
}

/* ───────────────────────── Pontos de atenção ───────────────────────── */

export interface AttentionPoint {
  key: string;
  kind: "despesa" | "pagamento";
  title: string;
  detail: string;
  budgetItemId?: string;
  paymentId?: string;
}

function formatDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

/** Pagamentos vencidos ou a vencer em 7 dias, pagamentos sem data e as despesas com ponto de atenção. */
export function attentionPoints(items: EventBudgetItem[], payments: EventPayment[], today: string): AttentionPoint[] {
  const points: AttentionPoint[] = [];
  for (const payment of sortPayments(payments)) {
    const state = paymentState(payment, today);
    const who = payment.vendorName ? `${payment.vendorName}: ` : "";
    if (state === "vencido" && payment.dueDate) {
      points.push({ key: `p-${payment.id}`, kind: "pagamento", paymentId: payment.id, title: `${who}${payment.description}`, detail: `Venceu em ${formatDay(payment.dueDate)} e não está marcado como pago.` });
    } else if (state === "proximo" && payment.dueDate) {
      const days = daysBetween(today, payment.dueDate);
      const when = days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
      points.push({ key: `p-${payment.id}`, kind: "pagamento", paymentId: payment.id, title: `${who}${payment.description}`, detail: `Vence ${when}, em ${formatDay(payment.dueDate)}.` });
    } else if (state === "sem_data") {
      points.push({ key: `p-${payment.id}`, kind: "pagamento", paymentId: payment.id, title: `${who}${payment.description}`, detail: "Pagamento ainda sem data definida." });
    }
  }
  for (const item of activeBudgetItems(items)) {
    if (!item.attentionNote) continue;
    points.push({ key: `b-${item.id}`, kind: "despesa", budgetItemId: item.id, title: item.description?.trim() || "Despesa sem descrição", detail: item.attentionNote });
  }
  return points;
}

/* ───────────────────────── Aprovações ───────────────────────── */

export type ApprovalStatus = "pendente" | "aprovado" | "ajustar" | "reprovado";

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  pendente: "Para decidir",
  aprovado: "Aprovado",
  ajustar: "Aprovado com ajuste",
  reprovado: "Não segue",
};

export interface EventApproval {
  id: string;
  eventId: string;
  title: string;
  context: string | null;
  approverName: string;
  approverUserId: string | null;
  status: ApprovalStatus;
  decisionNote: string | null;
  decidedOn: string | null;
  decidedByUserId: string | null;
  taskId: string | null;
  amount: number | null;
  /** Atalho mostrado no cartão: tela do sistema ("/convites-festa") ou endereço https. */
  linkUrl: string | null;
  linkLabel: string | null;
  sortOrder: number;
  createdAt: string;
}

/** Só aceita tela do próprio sistema ("/…") ou endereço https; o resto fica sem atalho. */
export function approvalLinkHref(url: string | null | undefined): string | null {
  const value = (url ?? "").trim();
  if (/^\/(?!\/)\S*$/.test(value)) return value;
  if (/^https:\/\/\S+$/i.test(value)) return value;
  return null;
}

export interface ApproverGroup {
  approverName: string;
  approverUserId: string | null;
  pending: EventApproval[];
  decided: EventApproval[];
}

/** Um grupo por pessoa que decide; quem tem mais pendências aparece primeiro. */
export function groupApprovals(approvals: EventApproval[]): ApproverGroup[] {
  const map = new Map<string, ApproverGroup>();
  for (const approval of approvals) {
    const key = approval.approverName.trim().toLowerCase();
    const group = map.get(key) ?? { approverName: approval.approverName.trim(), approverUserId: approval.approverUserId, pending: [], decided: [] };
    if (!group.approverUserId && approval.approverUserId) group.approverUserId = approval.approverUserId;
    (approval.status === "pendente" ? group.pending : group.decided).push(approval);
    map.set(key, group);
  }
  const groups = [...map.values()];
  for (const group of groups) {
    group.pending.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
    group.decided.sort((a, b) => (b.decidedOn ?? "").localeCompare(a.decidedOn ?? "") || a.sortOrder - b.sortOrder);
  }
  return groups.sort((a, b) => b.pending.length - a.pending.length || a.approverName.localeCompare(b.approverName, "pt-BR"));
}

/* ─────────────────────────── Transporte por veículo ─────────────────────────── */

export interface TransportAnswer {
  guestType: string;
  /** ida_volta | so_ida | so_volta | nao | null (ainda não respondeu). */
  transport: string | null;
  respondedAt: string | null;
}

export interface TransportTier {
  vehicles: number;
  fromPeople: number;
  toPeople: number;
  cost: number;
}

export interface TransportPlan {
  seats: number;
  unitAmount: number;
  outbound: number;
  inbound: number;
  /** Maior lotação entre ida e volta: é ela que define quantos veículos. */
  peak: number;
  vehiclesNow: number;
  costNow: number;
  /** Lugares livres nos veículos de hoje; o pedido seguinte a isso exige mais um. */
  seatsLeft: number;
  /** Colaboradores que ainda não responderam. */
  waiting: number;
  /** Se todos os que faltam pedirem transporte. */
  worstPeak: number;
  worstVehicles: number;
  worstCost: number;
  tiers: TransportTier[];
  /** Quanto a linha do orçamento prevê hoje. */
  budgeted: number;
  /** Falta na linha para o que os pedidos de hoje já exigem. */
  shortfall: number;
  /** O que ainda pode entrar se os que faltam pedirem transporte (além do maior entre linha e custo de hoje). */
  reserve: number;
}

/**
 * Transporte cobrado por veículo: o custo não é por pessoa, sobe em degraus a cada lotação completa.
 * Só os colaboradores respondem sobre transporte, então são eles que contam como "falta responder".
 */
export function transportPlan(
  line: { amountPlanned: number; unitAmount?: number | null; unitSeats?: number | null },
  answers: TransportAnswer[]
): TransportPlan | null {
  const seats = line.unitSeats ?? 0;
  const unitAmount = line.unitAmount ?? 0;
  if (seats <= 0 || unitAmount <= 0) return null;
  const team = answers.filter((answer) => answer.guestType === "colaborador");
  const outbound = team.filter((answer) => answer.transport === "ida_volta" || answer.transport === "so_ida").length;
  const inbound = team.filter((answer) => answer.transport === "ida_volta" || answer.transport === "so_volta").length;
  const waiting = team.filter((answer) => !answer.respondedAt).length;
  const peak = Math.max(outbound, inbound);
  const vehiclesFor = (people: number) => Math.ceil(people / seats);
  const vehiclesNow = vehiclesFor(peak);
  const worstPeak = peak + waiting;
  const worstVehicles = vehiclesFor(worstPeak);
  const costNow = vehiclesNow * unitAmount;
  const worstCost = worstVehicles * unitAmount;
  const budgeted = line.amountPlanned;
  const lastTier = Math.max(worstVehicles, vehiclesNow + 1, 1);
  return {
    seats,
    unitAmount,
    outbound,
    inbound,
    peak,
    vehiclesNow,
    costNow,
    seatsLeft: Math.max(vehiclesNow, 1) * seats - peak,
    waiting,
    worstPeak,
    worstVehicles,
    worstCost,
    tiers: Array.from({ length: lastTier }, (_, index) => ({
      vehicles: index + 1,
      fromPeople: index * seats + 1,
      toPeople: (index + 1) * seats,
      cost: (index + 1) * unitAmount,
    })),
    budgeted,
    shortfall: Math.max(0, costNow - budgeted),
    reserve: Math.max(0, worstCost - Math.max(budgeted, costNow)),
  };
}
