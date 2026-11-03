import { describe, expect, it } from "vitest";
import {
  sameApplicationServerKey,
  urlBase64ToUint8Array,
  whatsappConversationUrl,
} from "@/lib/whatsapp-lead-push";
import { buildLeadPush } from "../../supabase/functions/evolution-webhook/lead-push-format";

describe("urlBase64ToUint8Array", () => {
  it("decodifica base64url sem padding", () => {
    const bytes = Uint8Array.from([251, 255, 0, 1, 2]);
    const encoded = Buffer.from(bytes).toString("base64url");
    expect(Array.from(urlBase64ToUint8Array(encoded))).toEqual(Array.from(bytes));
  });
});

describe("sameApplicationServerKey", () => {
  const key = Uint8Array.from([4, 1, 2, 3]);

  it("reconhece a mesma chave", () => {
    expect(sameApplicationServerKey(Uint8Array.from([4, 1, 2, 3]).buffer, key)).toBe(true);
  });

  it("pede nova inscrição quando a chave mudou ou não existe", () => {
    expect(sameApplicationServerKey(Uint8Array.from([4, 1, 2, 9]).buffer, key)).toBe(false);
    expect(sameApplicationServerKey(Uint8Array.from([4, 1]).buffer, key)).toBe(false);
    expect(sameApplicationServerKey(null, key)).toBe(false);
  });
});

describe("whatsappConversationUrl", () => {
  it("aponta para a caixa de entrada com a conversa", () => {
    expect(whatsappConversationUrl("abc-123")).toBe("/trafego-pago?conversa=abc-123");
  });
});

describe("buildLeadPush", () => {
  const base = {
    conversationId: "c1",
    name: null,
    phone: null,
    leadSource: null,
    isNewConversation: false,
    body: "Olá, quero saber sobre o processo",
  };

  it("usa o nome do contato e a mensagem", () => {
    expect(buildLeadPush({ ...base, name: "Maria Souza" })).toEqual({
      conversationId: "c1",
      title: "Maria Souza",
      body: "Olá, quero saber sobre o processo",
    });
  });

  it("marca lead novo e a origem", () => {
    expect(
      buildLeadPush({ ...base, name: "Maria", leadSource: "meta_ads", isNewConversation: true })
        .title
    ).toBe("Novo lead: Maria · Meta Ads");
    expect(buildLeadPush({ ...base, name: "João", leadSource: "site_whatsapp" }).title).toBe(
      "João · Site"
    );
  });

  it("sem nome, mostra o telefone formatado", () => {
    expect(buildLeadPush({ ...base, phone: "5519999887766" }).title).toBe("(19) 99988-7766");
    expect(buildLeadPush({ ...base, phone: "551933445566" }).title).toBe("(19) 3344-5566");
    expect(buildLeadPush(base).title).toBe("Contato no WhatsApp");
  });

  it("corta mensagem longa", () => {
    const push = buildLeadPush({ ...base, body: "a".repeat(300) });
    expect(push.body).toHaveLength(158);
    expect(push.body.endsWith("…")).toBe(true);
  });
});
