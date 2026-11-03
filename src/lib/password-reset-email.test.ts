import { describe, expect, it } from "vitest";
import { buildPasswordResetEmail, formatRequestedAt, passwordResetLink } from "./password-reset-email";

describe("passwordResetLink", () => {
  it("aponta para /redefinir-senha com o token codificado", () => {
    expect(passwordResetLink("https://orqestrai.com.br/", "abc+123")).toBe(
      "https://orqestrai.com.br/redefinir-senha?token=abc%2B123"
    );
  });
});

describe("formatRequestedAt", () => {
  it("mostra data e hora no horário de Brasília", () => {
    expect(formatRequestedAt(new Date("2026-11-03T12:41:00Z"))).toBe(
      "3 de novembro de 2026, às 09:41 (horário de Brasília)"
    );
  });
});

describe("buildPasswordResetEmail", () => {
  it("cumprimenta pelo primeiro nome e inclui o link, o pedido e as imagens do www", () => {
    const { subject, html } = buildPasswordResetEmail({
      name: "Maria Clara Souza",
      link: "https://orqestrai.com.br/redefinir-senha?token=t1",
      requestedAt: new Date("2026-11-03T12:41:00Z"),
    });
    expect(subject).toBe("Redefinição de senha do ORQESTRAI");
    expect(html).toContain("Olá, Maria.");
    expect(html).toContain('href="https://orqestrai.com.br/redefinir-senha?token=t1"');
    expect(html).toContain("3 de novembro de 2026, às 09:41");
    expect(html).toContain('src="https://www.orqestrai.com.br/ORQESTRAI/identidade-visual/email/topo-orqestrai.jpg"');
  });

  it("escapa HTML no nome e funciona sem nome", () => {
    expect(buildPasswordResetEmail({ name: "<b>Ana</b>", link: "x" }).html).toContain("Olá, &lt;b&gt;Ana&lt;/b&gt;.");
    expect(buildPasswordResetEmail({ name: null, link: "x" }).html).toContain("Olá.");
  });
});
