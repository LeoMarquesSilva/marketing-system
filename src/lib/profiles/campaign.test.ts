import { describe, expect, it } from "vitest";
import { isProfileCampaignActive, resolveCampaignMessage } from "@/lib/profiles/campaign";
import type { ProfileCampaign } from "@/lib/profiles/types";

const now = new Date("2026-08-11T12:00:00.000Z");
const startsAt = "2026-08-01T00:00:00.000Z";
const endsAt = "2026-08-31T23:59:59.000Z";

const base: ProfileCampaign = {
  enabled: true,
  startsAt,
  endsAt,
  titlePt: "Dia da Advocacia 2026",
  titleEn: "Lawyers' Day 2026",
  messagePt: "A advocacia começa pela escuta.",
  messageEn: "Advocacy begins with listening.",
  callToActionPt: null,
  callToActionEn: null,
};

describe("isProfileCampaignActive", () => {
  it("desligado manualmente sempre vence a janela de datas", () => {
    expect(isProfileCampaignActive({ ...base, enabled: false }, now)).toBe(false);
  });

  it("ativa dentro da janela", () => {
    expect(isProfileCampaignActive(base, now)).toBe(true);
  });

  it("não ativa antes do início", () => {
    expect(isProfileCampaignActive(base, new Date("2026-07-31T23:59:59.000Z"))).toBe(false);
  });

  it("não ativa depois do fim", () => {
    expect(isProfileCampaignActive(base, new Date("2026-09-01T00:00:00.000Z"))).toBe(false);
  });

  it("trata limites ausentes como janela aberta", () => {
    expect(isProfileCampaignActive({ ...base, startsAt: null, endsAt: null }, now)).toBe(true);
    expect(isProfileCampaignActive({ ...base, startsAt: null }, now)).toBe(true);
    expect(isProfileCampaignActive({ ...base, endsAt: null }, now)).toBe(true);
  });

  it("inclui os instantes de borda", () => {
    expect(isProfileCampaignActive(base, new Date(startsAt))).toBe(true);
    expect(isProfileCampaignActive(base, new Date(endsAt))).toBe(true);
  });

  it("é inativa quando a campanha não existe", () => {
    expect(isProfileCampaignActive(null, now)).toBe(false);
  });

  it("ignora datas inválidas em vez de quebrar", () => {
    expect(isProfileCampaignActive({ ...base, startsAt: "não é data" }, now)).toBe(true);
  });
});

describe("resolveCampaignMessage", () => {
  it("devolve null quando inativa", () => {
    expect(resolveCampaignMessage({ ...base, enabled: false }, "pt-BR", now)).toBeNull();
  });

  it("devolve a mensagem no idioma pedido", () => {
    expect(resolveCampaignMessage(base, "pt-BR", now)).toBe("A advocacia começa pela escuta.");
    expect(resolveCampaignMessage(base, "en", now)).toBe("Advocacy begins with listening.");
  });

  it("cai para PT quando a mensagem em inglês está vazia", () => {
    expect(resolveCampaignMessage({ ...base, messageEn: "" }, "en", now)).toBe(
      "A advocacia começa pela escuta."
    );
  });
});
