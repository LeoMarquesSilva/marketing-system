import { describe, expect, it } from "vitest";
import type { EventBudgetItem } from "@/lib/eventos";
import {
  approvalLinkHref,
  attentionPoints,
  budgetTotals,
  groupApprovals,
  groupBudget,
  paymentState,
  paymentTotals,
  sortPayments,
  transportPlan,
  type EventApproval,
  type EventPayment,
} from "./eventos-orcamento";

function line(partial: Partial<EventBudgetItem>): EventBudgetItem {
  return {
    id: Math.random().toString(36),
    eventId: "e1",
    category: "outros",
    description: "Despesa",
    vendorName: null,
    amountPlanned: 0,
    amountQuoted: null,
    amountActual: null,
    paymentStatus: "pendente",
    dueDate: null,
    paymentDueDate: null,
    paymentPaidDate: null,
    invoiceLink: null,
    receiptLink: null,
    approvedByUserId: null,
    notes: null,
    managedBy: "escritorio",
    approvalStatus: "aprovado",
    attentionNote: null,
    sortOrder: 0,
    createdAt: "",
    ...partial,
  };
}

function payment(partial: Partial<EventPayment>): EventPayment {
  return { id: Math.random().toString(36), eventId: "e1", vendorName: null, description: "Parcela", amount: 100, dueDate: null, paid: false, paidDate: null, notes: null, sortOrder: 0, ...partial };
}

function approval(partial: Partial<EventApproval>): EventApproval {
  return { id: Math.random().toString(36), eventId: "e1", title: "Item", context: null, approverName: "Felipe Camargo", approverUserId: null, status: "pendente", decisionNote: null, decidedOn: null, decidedByUserId: null, taskId: null, amount: null, linkUrl: null, linkLabel: null, sortOrder: 0, createdAt: "2026-11-10", ...partial };
}

const items = [
  line({ managedBy: "produtora", vendorName: "Produtora", category: "catering", amountPlanned: 500 }),
  line({ managedBy: "produtora", vendorName: "Produtora", category: "decoracao", amountPlanned: 300 }),
  line({ vendorName: "Acrílicos", amountPlanned: 200, approvalStatus: "em_analise", attentionNote: "Entrega depois da festa" }),
  line({ vendorName: "Brindes", category: "brindes", amountPlanned: 50 }),
  line({ vendorName: "Brindes", amountPlanned: 999, approvalStatus: "descartado" }),
];

describe("orçamento do evento", () => {
  it("soma aprovado e em análise, sem as descartadas", () => {
    expect(budgetTotals(items)).toEqual({ approved: 850, pending: 200, projected: 1050, byScope: { produtora: 800, escritorio: 250 } });
  });

  it("separa por quem cuida, fornecedor e categoria", () => {
    const [package_, own] = groupBudget(items);
    expect(package_.managedBy).toBe("produtora");
    expect(package_.vendors[0].categories.map((group) => [group.label, group.total])).toEqual([
      ["Buffet e bebidas", 500],
      ["Decoração e cenografia", 300],
    ]);
    expect(own.vendors.map((vendor) => [vendor.vendor, vendor.approved, vendor.pending, vendor.attention])).toEqual([
      ["Acrílicos", 0, 200, 1],
      ["Brindes", 50, 0, 0],
    ]);
  });
});

describe("pagamentos", () => {
  const today = "2026-11-10";

  it("classifica pelo vencimento", () => {
    expect(paymentState(payment({ paid: true, dueDate: "2026-10-14" }), today)).toBe("pago");
    expect(paymentState(payment({ dueDate: "2026-11-09" }), today)).toBe("vencido");
    expect(paymentState(payment({ dueDate: "2026-11-14" }), today)).toBe("proximo");
    expect(paymentState(payment({ dueDate: "2026-12-14" }), today)).toBe("futuro");
    expect(paymentState(payment({}), today)).toBe("sem_data");
  });

  it("ordena o que falta pagar antes do que já foi pago", () => {
    const list = sortPayments([
      payment({ description: "pago", paid: true, dueDate: "2026-09-28" }),
      payment({ description: "sem data" }),
      payment({ description: "dezembro", dueDate: "2026-12-14" }),
      payment({ description: "novembro", dueDate: "2026-11-14" }),
    ]);
    expect(list.map((item) => item.description)).toEqual(["novembro", "dezembro", "sem data", "pago"]);
    expect(paymentTotals(list)).toEqual({ paid: 100, open: 300 });
  });

  it("avisa do que vence em 7 dias, do que não tem data e das despesas marcadas", () => {
    const points = attentionPoints(items, [payment({ id: "a", description: "Parcela 2", vendorName: "Produtora", dueDate: "2026-11-14" }), payment({ id: "b", description: "Extras" }), payment({ id: "c", dueDate: "2026-12-14" })], today);
    expect(points.map((point) => [point.kind, point.title, point.detail])).toEqual([
      ["pagamento", "Produtora: Parcela 2", "Vence em 4 dias, em 14/11."],
      ["pagamento", "Extras", "Pagamento ainda sem data definida."],
      ["despesa", "Despesa", "Entrega depois da festa"],
    ]);
  });
});

describe("aprovações", () => {
  it("agrupa por quem decide, com mais pendências primeiro", () => {
    const groups = groupApprovals([
      approval({ approverName: "Ricardo Pires", status: "aprovado", decidedOn: "2026-11-06" }),
      approval({ approverName: "Felipe Camargo", title: "Backdrop" }),
      approval({ approverName: "felipe camargo", title: "Chão", sortOrder: 1 }),
      approval({ approverName: "Ricardo Pires", title: "Teto" }),
    ]);
    expect(groups.map((group) => [group.approverName, group.pending.length, group.decided.length])).toEqual([
      ["Felipe Camargo", 2, 0],
      ["Ricardo Pires", 1, 1],
    ]);
  });

  it("só aceita atalho para tela do sistema ou endereço https", () => {
    expect(approvalLinkHref(" /convites-festa ")).toBe("/convites-festa");
    expect(approvalLinkHref("https://www.orqestrai.com.br/convites-festa")).toBe("https://www.orqestrai.com.br/convites-festa");
    expect(approvalLinkHref("//outro.site/x")).toBeNull();
    expect(approvalLinkHref("javascript:alert(1)")).toBeNull();
    expect(approvalLinkHref("http://sem-https.com")).toBeNull();
    expect(approvalLinkHref("")).toBeNull();
    expect(approvalLinkHref(null)).toBeNull();
  });
});

describe("transporte por veículo", () => {
  const team = (transport: string | null, count: number, answered = true) =>
    Array.from({ length: count }, () => ({ guestType: "colaborador", transport, respondedAt: answered ? "2026-11-09" : null }));
  const line = { amountPlanned: 2700, unitAmount: 2700, unitSeats: 24 };

  it("conta pelo trecho mais cheio e reserva o veículo que ainda pode entrar", () => {
    const plan = transportPlan(line, [...team("ida_volta", 13), ...team("so_ida", 4), ...team("nao", 16), ...team(null, 28, false), { guestType: "cliente", transport: null, respondedAt: null }]);
    expect(plan).toMatchObject({ outbound: 17, inbound: 13, peak: 17, vehiclesNow: 1, costNow: 2700, seatsLeft: 7, waiting: 28, worstPeak: 45, worstVehicles: 2, worstCost: 5400, shortfall: 0, reserve: 2700 });
    expect(plan?.tiers).toEqual([
      { vehicles: 1, fromPeople: 1, toPeople: 24, cost: 2700 },
      { vehicles: 2, fromPeople: 25, toPeople: 48, cost: 5400 },
    ]);
  });

  it("avisa quando os pedidos já passam do que a linha prevê", () => {
    const plan = transportPlan(line, [...team("ida_volta", 25)]);
    expect(plan).toMatchObject({ vehiclesNow: 2, costNow: 5400, shortfall: 2700, reserve: 0, seatsLeft: 23 });
  });

  it("o acompanhante ocupa lugar no ônibus de quem o leva", () => {
    const plan = transportPlan(line, [...team("ida_volta", 22), { guestType: "colaborador", transport: "ida_volta", respondedAt: "2026-11-12", plusOne: true }]);
    expect(plan).toMatchObject({ outbound: 24, inbound: 24, vehiclesNow: 1, seatsLeft: 0 });
  });

  it("não calcula sem valor ou sem lugares por veículo", () => {
    expect(transportPlan({ amountPlanned: 2700 }, team("ida_volta", 3))).toBeNull();
  });
});
