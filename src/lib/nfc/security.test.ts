import { describe, expect, it } from "vitest";
import {
  appendSafeParams,
  generateIdempotencyKey,
  generatePublicToken,
  isSensitiveAction,
  isValidPublicToken,
  sanitizePublicUrl,
  signN8nPayload,
} from "@/lib/nfc/security";

describe("NFC security", () => {
  it("gera token público aleatório sem expor UUID ou sequência", () => {
    const first = generatePublicToken();
    const second = generatePublicToken();
    expect(isValidPublicToken(first)).toBe(true);
    expect(first).not.toBe(second);
  });

  it("aceita somente URLs HTTP(S) sem credenciais", () => {
    expect(sanitizePublicUrl("https://orquestrai.example/t/teste")).toContain("https://");
    expect(sanitizePublicUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizePublicUrl("https://user:secret@example.com")).toBeNull();
  });

  it("acrescenta somente parâmetros com chaves seguras", () => {
    const value = appendSafeParams("https://example.com/path", {
      origem: "nfc",
      "chave perigosa?": "ignorada",
    });
    expect(value).toContain("origem=nfc");
    expect(value).not.toContain("perigosa");
  });

  it("força confirmação para ações com impacto", () => {
    expect(isSensitiveAction("webhook", { workflowKey: "ticket" })).toBe(true);
    expect(isSensitiveAction("asset_loan", {})).toBe(true);
    expect(isSensitiveAction("url", { destinationUrl: "https://example.com" })).toBe(false);
    expect(
      isSensitiveAction("professional_profile", {
        profileId: "7e3bd4e6-156a-4bdf-bc0f-61a0f08a9134",
      })
    ).toBe(false);
  });

  it("mantém idempotência por leitura e ação", () => {
    expect(generateIdempotencyKey("scan", "webhook")).toBe(
      generateIdempotencyKey("scan", "webhook")
    );
    expect(generateIdempotencyKey("scan", "webhook")).not.toBe(
      generateIdempotencyKey("scan", "url")
    );
  });

  it("assina payloads com HMAC SHA-256", () => {
    expect(signN8nPayload('{"event":"nfc.tag.scanned"}', "secret")).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});
