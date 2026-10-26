import { describe, expect, it } from "vitest";
import {
  audiosWithoutTranscript,
  formatConversationTranscript,
  formatLeadSummary,
  formatTranscriptLine,
  type TranscriptMessage,
} from "./whatsapp-conversation-transcript";

function message(overrides: Partial<TranscriptMessage>): TranscriptMessage {
  return {
    from_me: false,
    body: "Olá",
    message_type: "conversation",
    message_timestamp: "2026-10-23T18:36:00.000Z",
    ...overrides,
  };
}

describe("texto da conversa", () => {
  it("identifica quem falou, usa o horário de Brasília e traz a citação", () => {
    expect(formatTranscriptLine(message({ body: "Preciso de ajuda" }), { leadName: "Daniela" })).toBe(
      '[23/10/2026, 15:36] Daniela: Preciso de ajuda'
    );
    expect(
      formatTranscriptLine(message({ from_me: true, body: "Claro!", quoted_body: "Preciso de ajuda" }), {
        leadName: "Daniela",
      })
    ).toBe('[23/10/2026, 15:36] Escritório (respondendo a: "Preciso de ajuda"): Claro!');
  });

  it("coloca a transcrição no lugar do áudio", () => {
    expect(
      formatTranscriptLine(message({ body: "[áudio]", message_type: "audioMessage", audio_transcript: "Somos do ramo de paisagismo" }), {
        leadName: "Daniela",
      })
    ).toBe('[23/10/2026, 15:36] Daniela: [áudio] "Somos do ramo de paisagismo"');
    expect(
      formatTranscriptLine(message({ body: "[áudio]", message_type: "audioMessage" }), { leadName: "Daniela" })
    ).toBe("[23/10/2026, 15:36] Daniela: [áudio sem transcrição]");
  });

  it("em grupo usa o nome de quem mandou", () => {
    expect(
      formatTranscriptLine(message({ participant_name: "Letícia" }), { leadName: "Financeiro", isGroup: true })
    ).toBe("[23/10/2026, 15:36] Letícia: Olá");
  });

  it("quando não cabe, mantém a abertura e as mais recentes", () => {
    const messages = Array.from({ length: 40 }, (_, i) => message({ body: `mensagem ${i + 1} ${"x".repeat(40)}` }));
    const text = formatConversationTranscript(messages, { leadName: "Lead", maxChars: 1200 });
    expect(text.length).toBeLessThanOrEqual(1200);
    expect(text).toContain("mensagem 1 ");
    expect(text).toContain("mensagem 6 ");
    expect(text).not.toContain("mensagem 7 ");
    expect(text).toContain("mensagem 40 ");
    expect(text).toMatch(/\[… \d+ mensagens do meio omitidas …\]/);
  });

  it("conversa curta sai inteira", () => {
    const text = formatConversationTranscript([message({}), message({ from_me: true, body: "Oi" })], { leadName: "Lead" });
    expect(text.split("\n")).toHaveLength(2);
  });
});

describe("resumo do lead", () => {
  it("mostra só o que está preenchido, com rótulos legíveis", () => {
    const summary = formatLeadSummary(
      {
        push_name: "Daniela",
        phone: "5519995875961",
        lead_source: "site_whatsapp",
        site_lead_page_title: "Escritório de advocacia",
        attendance_status: "nao_respondido",
        tags: ["Site"],
        qualification: { interesse: "Trabalhista", colaboradores: "" },
        notes: null,
      },
      "Leonardo"
    );
    expect(summary).toBe(
      [
        "Nome: Daniela",
        "Telefone: 5519995875961",
        "Origem: Botão de WhatsApp do site",
        "Página do site: Escritório de advocacia",
        "Situação: Esperando resposta do escritório",
        "Responsável: Leonardo",
        "Tags: Site",
        "Qualificação: interesse: Trabalhista",
      ].join("\n")
    );
  });
});

describe("áudios pendentes", () => {
  it("lista só áudios sem transcrição, do mais recente para o mais antigo", () => {
    const pending = audiosWithoutTranscript([
      { ...message({ body: "[áudio]", message_type: "audioMessage" }), id: "a1" },
      { ...message({ body: "[áudio]", message_type: "audioMessage", audio_transcript: "ok" }), id: "a2" },
      { ...message({ body: "texto" }), id: "t1" },
      { ...message({ body: "[áudio]", message_type: "audioMessage" }), id: "a3" },
    ]);
    expect(pending.map((m) => m.id)).toEqual(["a3", "a1"]);
  });
});
