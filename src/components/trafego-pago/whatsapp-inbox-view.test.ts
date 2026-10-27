import { describe, expect, it } from "vitest";
import type { WhatsappConversation } from "./whatsapp-crm-types";
import {
  buildInboxView,
  formatDaySeparator,
  formatListTime,
  formatWaitingDuration,
  isStaleOpenConversation,
  lastMessageIsOurs,
  statusTabOf,
  waitingSince,
} from "./whatsapp-inbox-view";

const NOW = new Date(2026, 9, 26, 15, 0); // segunda, 26/10/2026 15:00

function conversation(overrides: Partial<WhatsappConversation>): WhatsappConversation {
  return {
    id: overrides.id ?? "c1",
    remote_jid: "5511999999999@s.whatsapp.net",
    phone: "5511999999999",
    push_name: "Cliente",
    last_message_at: new Date(2026, 9, 26, 14, 0).toISOString(),
    last_message_preview: "Olá",
    last_inbound_at: new Date(2026, 9, 26, 14, 0).toISOString(),
    unread_count: 0,
    tags: [],
    lead_source: null,
    attendance_status: "nao_respondido",
    owner_user_id: null,
    ...overrides,
  };
}

describe("status do atendimento", () => {
  it("separa abertas, aguardando cliente e resolvidas", () => {
    expect(statusTabOf(conversation({ attendance_status: "nao_respondido" }))).toBe("open");
    expect(statusTabOf(conversation({ attendance_status: "em_atendimento" }))).toBe("open");
    expect(statusTabOf(conversation({ attendance_status: null }))).toBe("open");
    expect(statusTabOf(conversation({ attendance_status: "aguardando_cliente" }))).toBe("waiting");
    expect(statusTabOf(conversation({ attendance_status: "resolvido" }))).toBe("resolved");
  });
});

describe("lista da caixa de entrada", () => {
  const me = "user-me";
  const list = [
    conversation({ id: "minha-aberta", owner_user_id: me }),
    conversation({ id: "sem-dono-aberta" }),
    conversation({ id: "outro-aberta", owner_user_id: "user-outro" }),
    conversation({ id: "minha-aguardando", owner_user_id: me, attendance_status: "aguardando_cliente" }),
    conversation({ id: "resolvida", attendance_status: "resolvido" }),
  ];

  it("filtra por responsável e status e conta cada aba", () => {
    const view = buildInboxView(list, {
      ownerTab: "mine",
      statusTab: "open",
      leadFilter: "all",
      search: "",
      myUserId: me,
    });
    expect(view.conversations.map((c) => c.id)).toEqual(["minha-aberta"]);
    expect(view.ownerCounts).toEqual({ mine: 1, unassigned: 1, all: 3 });
    expect(view.statusCounts).toEqual({ open: 1, waiting: 1, resolved: 0 });
  });

  it("sem responsável não inclui conversas de outra pessoa", () => {
    const view = buildInboxView(list, {
      ownerTab: "unassigned",
      statusTab: "open",
      leadFilter: "all",
      search: "",
      myUserId: me,
    });
    expect(view.conversations.map((c) => c.id)).toEqual(["sem-dono-aberta"]);
  });

  it("busca dentro das abas", () => {
    const view = buildInboxView(
      [conversation({ id: "a", push_name: "Mariana" }), conversation({ id: "b", push_name: "Carlos" })],
      { ownerTab: "all", statusTab: "open", leadFilter: "all", search: "mari", myUserId: me }
    );
    expect(view.conversations.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("espera por resposta", () => {
  it("só conta quando a última mensagem é do cliente e a conversa está aberta", () => {
    const waiting = conversation({ last_inbound_at: new Date(2026, 9, 26, 13, 0).toISOString() });
    expect(waitingSince(waiting)).toBe(waiting.last_inbound_at);

    const answered = conversation({
      last_inbound_at: new Date(2026, 9, 26, 13, 0).toISOString(),
      last_outbound_at: new Date(2026, 9, 26, 13, 30).toISOString(),
    });
    expect(lastMessageIsOurs(answered)).toBe(true);
    expect(waitingSince(answered)).toBeNull();

    expect(waitingSince(conversation({ attendance_status: "resolvido" }))).toBeNull();
    expect(waitingSince(conversation({ is_group: true }))).toBeNull();
  });

  it("mostra a duração de forma curta", () => {
    expect(formatWaitingDuration(new Date(2026, 9, 26, 14, 48).toISOString(), NOW)).toBe("12 min");
    expect(formatWaitingDuration(new Date(2026, 9, 26, 12, 0).toISOString(), NOW)).toBe("3h");
    expect(formatWaitingDuration(new Date(2026, 9, 25, 12, 0).toISOString(), NOW)).toBe("1 dia");
    expect(formatWaitingDuration(new Date(2026, 9, 20, 12, 0).toISOString(), NOW)).toBe("6 dias");
  });
});

describe("datas", () => {
  it("formata o horário da lista conforme a distância", () => {
    expect(formatListTime(new Date(2026, 9, 26, 9, 5).toISOString(), NOW)).toBe("09:05");
    expect(formatListTime(new Date(2026, 9, 25, 22, 0).toISOString(), NOW)).toBe("ontem");
    expect(formatListTime(new Date(2026, 9, 22, 10, 0).toISOString(), NOW)).toBe("qui");
    expect(formatListTime(new Date(2026, 9, 12, 10, 0).toISOString(), NOW)).toBe("12/10");
    expect(formatListTime(new Date(2025, 9, 12, 10, 0).toISOString(), NOW)).toBe("12/10/25");
  });

  it("usa Hoje e Ontem nos separadores da conversa", () => {
    expect(formatDaySeparator(new Date(2026, 9, 26, 8, 0).toISOString(), NOW)).toBe("Hoje");
    expect(formatDaySeparator(new Date(2026, 9, 25, 8, 0).toISOString(), NOW)).toBe("Ontem");
    expect(formatDaySeparator(new Date(2026, 9, 12, 8, 0).toISOString(), NOW)).toBe("12 de outubro");
  });
});

describe("conversas paradas", () => {
  it("considera parada a conversa não resolvida sem mensagem há mais de 30 dias", () => {
    const old = new Date(2026, 8, 1).toISOString();
    expect(isStaleOpenConversation(conversation({ last_message_at: old }), NOW)).toBe(true);
    expect(
      isStaleOpenConversation(conversation({ last_message_at: old, attendance_status: "aguardando_cliente" }), NOW)
    ).toBe(true);
    expect(
      isStaleOpenConversation(conversation({ last_message_at: old, attendance_status: "resolvido" }), NOW)
    ).toBe(false);
    expect(isStaleOpenConversation(conversation({}), NOW)).toBe(false);
  });
});
