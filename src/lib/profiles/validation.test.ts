import { describe, expect, it } from "vitest";
import {
  externalUrlSchema,
  profileImportRowSchema,
  profileStatusSchema,
  profileUpdateSchema,
} from "@/lib/profiles/validation";

const validImportRow = {
  email: "leticia.rodrigues@bismarchipires.com.br",
  name: "Letícia Rodrigues",
  role: "Sócia",
  area: "Tributário",
};

describe("profileImportRowSchema — privacidade", () => {
  it("nunca deixa passar data de nascimento em inglês", () => {
    const parsed = profileImportRowSchema.parse({ ...validImportRow, birthDate: "1985-04-02" });
    expect(parsed).not.toHaveProperty("birthDate");
    expect(JSON.stringify(parsed)).not.toContain("1985-04-02");
  });

  it("nunca deixa passar data de nascimento em português", () => {
    const parsed = profileImportRowSchema.parse({
      ...validImportRow,
      dataNascimento: "02/04/1985",
    });
    expect(parsed).not.toHaveProperty("dataNascimento");
    expect(JSON.stringify(parsed)).not.toContain("1985");
  });

  it("descarta qualquer campo desconhecido em vez de repassá-lo", () => {
    const parsed = profileImportRowSchema.parse({
      ...validImportRow,
      cpf: "000.000.000-00",
      salario: "12345",
    });
    expect(parsed).not.toHaveProperty("cpf");
    expect(parsed).not.toHaveProperty("salario");
  });

  it("normaliza o e-mail corporativo para minúsculas sem espaços", () => {
    const parsed = profileImportRowSchema.parse({
      ...validImportRow,
      email: "  Leticia.Rodrigues@BismarchiPires.com.br  ",
    });
    expect(parsed.email).toBe("leticia.rodrigues@bismarchipires.com.br");
  });

  it("rejeita linha sem e-mail válido", () => {
    expect(profileImportRowSchema.safeParse({ ...validImportRow, email: "sem-arroba" }).success).toBe(
      false
    );
    expect(profileImportRowSchema.safeParse({ ...validImportRow, email: "" }).success).toBe(false);
  });

  it("aceita data de admissão, que não é dado sensível", () => {
    const parsed = profileImportRowSchema.parse({ ...validImportRow, joinedOn: "2019-03-01" });
    expect(parsed.joinedOn).toBe("2019-03-01");
  });

  it("mantém acentos de nome, cargo e área", () => {
    const parsed = profileImportRowSchema.parse(validImportRow);
    expect(parsed.name).toBe("Letícia Rodrigues");
    expect(parsed.role).toBe("Sócia");
    expect(parsed.area).toBe("Tributário");
  });

  it("nunca aceita mudança de atividade, papel ou permissões do usuário", () => {
    const parsed = profileImportRowSchema.parse({
      ...validImportRow,
      isActive: false,
      role_system: "admin",
      permissions: ["/admin"],
    });
    expect(parsed).not.toHaveProperty("isActive");
    expect(parsed).not.toHaveProperty("role_system");
    expect(parsed).not.toHaveProperty("permissions");
  });
});

describe("externalUrlSchema", () => {
  it("aceita http e https", () => {
    expect(externalUrlSchema.safeParse("https://www.linkedin.com/in/leticia").success).toBe(true);
    expect(externalUrlSchema.safeParse("http://bismarchipires.com.br").success).toBe(true);
  });

  it("rejeita URL malformada", () => {
    expect(externalUrlSchema.safeParse("não é url").success).toBe(false);
    expect(externalUrlSchema.safeParse("www.exemplo.com").success).toBe(false);
  });

  it("rejeita esquemas perigosos", () => {
    expect(externalUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(externalUrlSchema.safeParse("data:text/html;base64,PHNjcmlwdD4=").success).toBe(false);
    expect(externalUrlSchema.safeParse("file:///etc/passwd").success).toBe(false);
  });
});

describe("profileStatusSchema", () => {
  it("aceita apenas os três status do domínio", () => {
    expect(profileStatusSchema.safeParse("draft").success).toBe(true);
    expect(profileStatusSchema.safeParse("published").success).toBe(true);
    expect(profileStatusSchema.safeParse("archived").success).toBe(true);
    expect(profileStatusSchema.safeParse("deleted").success).toBe(false);
  });
});

describe("profileUpdateSchema", () => {
  it("aceita atualização parcial com localizações", () => {
    const parsed = profileUpdateSchema.safeParse({
      slug: "leticia-rodrigues",
      showEmail: true,
      localizations: [
        { locale: "pt-BR", isApproved: true, displayName: "Letícia Rodrigues", role: "Sócia" },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita slug fora do formato público", () => {
    expect(profileUpdateSchema.safeParse({ slug: "Letícia Rodrigues" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ slug: "com espaço" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ slug: "" }).success).toBe(false);
  });

  it("rejeita locale fora do par suportado", () => {
    const parsed = profileUpdateSchema.safeParse({
      localizations: [{ locale: "es", displayName: "Letícia" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejeita LinkedIn com URL inválida", () => {
    expect(profileUpdateSchema.safeParse({ linkedinUrl: "javascript:alert(1)" }).success).toBe(
      false
    );
  });

  it("rejeita título de entrada acima de 240 caracteres com mensagem clara", () => {
    const parsed = profileUpdateSchema.safeParse({
      sections: [
        {
          key: "education",
          enabled: true,
          entries: [
            {
              entryType: "education",
              localizations: [
                {
                  locale: "pt-BR",
                  title: "x".repeat(241),
                },
              ],
            },
          ],
        },
      ],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.message).toContain("240");
  });
});
