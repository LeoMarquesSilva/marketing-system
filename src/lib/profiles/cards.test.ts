import { describe, expect, it } from "vitest";
import {
  assertCanActivateProfileCard,
  buildProfessionalProfilePublicAction,
  buildProfileRedirectPath,
  canRedirectProfileCard,
  nextProfileCardCode,
} from "@/lib/profiles/cards";
import { getNfcPublicUrl } from "@/lib/nfc/public-url";
import { ProfileHttpError } from "@/lib/profiles/admin";

const PROFILE_ID = "7e3bd4e6-156a-4bdf-bc0f-61a0f08a9134";

describe("assertCanActivateProfileCard", () => {
  it("só permite ativar cartão de perfil publicado", () => {
    expect(() => assertCanActivateProfileCard("published")).not.toThrow();
    expect(() => assertCanActivateProfileCard("draft")).toThrow(ProfileHttpError);
    expect(() => assertCanActivateProfileCard("archived")).toThrow(ProfileHttpError);
  });
});

describe("canRedirectProfileCard", () => {
  it("não redireciona cartões desativados ou substituídos", () => {
    expect(canRedirectProfileCard("active")).toBe(true);
    expect(canRedirectProfileCard("pending")).toBe(true);
    expect(canRedirectProfileCard("inactive")).toBe(false);
    expect(canRedirectProfileCard("replaced")).toBe(false);
  });
});

describe("buildProfessionalProfilePublicAction", () => {
  it("expõe apenas slug, nome público e locale — sem campos privados", () => {
    const action = buildProfessionalProfilePublicAction({
      id: PROFILE_ID,
      slug: "leticia-rodrigues",
      status: "published",
      displayName: "Letícia Rodrigues",
      locale: "pt-BR",
      professionalEmail: "leticia@bismarchipires.com.br",
      professionalPhone: "+5519999999999",
      oab: "OAB/SP 123",
      linkedinUrl: "https://linkedin.com/in/leticia",
    });

    expect(action).toEqual({
      type: "professional_profile",
      requiresConfirmation: false,
      loadingMessage: "Abrindo o perfil de Letícia Rodrigues",
      profile: {
        slug: "leticia-rodrigues",
        displayName: "Letícia Rodrigues",
        locale: "pt-BR",
      },
    });
    expect(JSON.stringify(action)).not.toContain("leticia@");
    expect(JSON.stringify(action)).not.toContain("+5519");
    expect(JSON.stringify(action)).not.toContain("OAB");
    expect(JSON.stringify(action)).not.toContain("linkedin");
  });
});

describe("URLs NFC/QR de cartão", () => {
  it("monta URL de NFC programado com source=nfc", () => {
    expect(getNfcPublicUrl("nfc_tokenABC1234567890", {}, { source: "nfc" })).toBe(
      "https://marketing-system-xi.vercel.app/t/nfc_tokenABC1234567890?source=nfc"
    );
  });

  it("monta URL de QR com source=qr", () => {
    expect(getNfcPublicUrl("nfc_tokenABC1234567890", {}, { source: "qr" })).toBe(
      "https://marketing-system-xi.vercel.app/t/nfc_tokenABC1234567890?source=qr"
    );
  });

  it("mantém a base oficial fora do ambiente local", () => {
    expect(getNfcPublicUrl("nfc_abc", {})).toBe(
      "https://marketing-system-xi.vercel.app/t/nfc_abc"
    );
    expect(getNfcPublicUrl("nfc_abc", {})).not.toContain("localhost");
  });

  it("redireciona execução para /perfil/<slug>?source=", () => {
    expect(buildProfileRedirectPath("leticia-rodrigues", "nfc")).toBe(
      "/perfil/leticia-rodrigues?source=nfc"
    );
    expect(buildProfileRedirectPath("leticia-rodrigues", "qr")).toBe(
      "/perfil/leticia-rodrigues?source=qr"
    );
  });
});

describe("nextProfileCardCode", () => {
  it("gera o próximo código sequencial", () => {
    expect(nextProfileCardCode(["PPC-0001", "PPC-0003", "OUTRO"])).toBe("PPC-0004");
    expect(nextProfileCardCode([])).toBe("PPC-0001");
  });
});
