import { describe, expect, it } from "vitest";
import { buildWelcomeEmail, firstNameOf } from "./email";

const BASE = {
  fullName: "Maria da Silva",
  loginEmail: "maria.silva@bismarchipires.com.br",
  access: { kind: "setup" as const, url: "https://orqestrai.com.br/primeiro-acesso?token=pa_abc&x=1" },
  assetBaseUrl: "https://www.orqestrai.com.br",
};

describe("buildWelcomeEmail", () => {
  it("assunto e saudação usam o primeiro nome", () => {
    const { subject, html } = buildWelcomeEmail(BASE);
    expect(subject).toBe("Boas-vindas ao time BP, Maria!");
    expect(html).toContain("Olá, Maria!");
    expect(firstNameOf("  Ana  Paula ")).toBe("Ana");
  });

  it("primeiro acesso: botão para criar a senha, com validade e login", () => {
    const { html } = buildWelcomeEmail(BASE);
    expect(html).toContain('href="https://orqestrai.com.br/primeiro-acesso?token=pa_abc&amp;x=1"');
    expect(html).toContain("Criar minha senha");
    expect(html).toContain("7 dias");
    expect(html).toContain("maria.silva@bismarchipires.com.br");
  });

  it("quem já entra no ORQESTRAI recebe o botão de entrar", () => {
    const { html } = buildWelcomeEmail({
      ...BASE,
      access: { kind: "login", url: "https://orqestrai.com.br/meus-links" },
    });
    expect(html).toContain("Entrar no ORQESTRAI");
    expect(html).not.toContain("Criar minha senha");
  });

  it("é curto: aponta para Meus links e não lista endereços de ferramentas", () => {
    const { html } = buildWelcomeEmail(BASE);
    expect(html).toContain("Meus links");
    expect(html).not.toMatch(/sharepoint|vios\.com|responsum\.com|feedz/i);
    // Só dois endereços clicáveis: o botão e a cópia dele no rodapé.
    expect(html.match(/<a href=/g)).toHaveLength(2);
  });

  it("escapa nome e login vindos do cadastro", () => {
    const { html } = buildWelcomeEmail({ ...BASE, fullName: "<script>x</script> Silva", loginEmail: '"a"@b.com' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;a&quot;@b.com");
  });

  it("usa o logo do escritório servido pelo www", () => {
    expect(buildWelcomeEmail(BASE).html).toContain(
      'src="https://www.orqestrai.com.br/rh/boas-vindas/email/logo-bismarchi-pires.png"'
    );
  });
});
