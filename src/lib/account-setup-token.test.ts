import { describe, expect, it } from "vitest";
import {
  firstAccessLink,
  generateSetupToken,
  hashSetupToken,
  isSetupTokenFormat,
  setupTokenStatus,
} from "./account-setup-token";
import { validateNewPassword } from "./password-rules";

describe("token de primeiro acesso", () => {
  it("gera tokens únicos no formato esperado", () => {
    const a = generateSetupToken();
    const b = generateSetupToken();
    expect(isSetupTokenFormat(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(isSetupTokenFormat("pa_curto")).toBe(false);
    expect(isSetupTokenFormat("fc_" + a.slice(3))).toBe(false);
  });

  it("guarda só o hash (sempre o mesmo para o mesmo token)", () => {
    const token = generateSetupToken();
    expect(hashSetupToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSetupToken(token)).toBe(hashSetupToken(token));
    expect(hashSetupToken(token)).not.toContain(token);
  });

  it("monta o link para /primeiro-acesso", () => {
    expect(firstAccessLink("https://orqestrai.com.br/", "pa_a-b_c")).toBe(
      "https://orqestrai.com.br/primeiro-acesso?token=pa_a-b_c"
    );
  });

  it("situação do link: válido, usado, vencido ou inexistente", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    expect(setupTokenStatus({ expires_at: "2026-11-16T12:00:00Z", used_at: null }, now)).toBe("valid");
    expect(setupTokenStatus({ expires_at: "2026-11-16T12:00:00Z", used_at: "2026-11-10T09:00:00Z" }, now)).toBe("used");
    expect(setupTokenStatus({ expires_at: "2026-11-09T11:59:59Z", used_at: null }, now)).toBe("expired");
    expect(setupTokenStatus(null, now)).toBe("invalid");
  });
});

describe("validateNewPassword", () => {
  it("mesma regra das outras telas de senha", () => {
    expect(validateNewPassword("12345")).toMatch(/6 caracteres/);
    expect(validateNewPassword("123456")).toMatch(/diferente da padrão/);
    expect(validateNewPassword("x".repeat(73))).toMatch(/72/);
    expect(validateNewPassword("senha-boa")).toBeNull();
  });
});
