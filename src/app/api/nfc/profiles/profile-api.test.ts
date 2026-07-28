import { describe, expect, it } from "vitest";
import { ProfileHttpError, toProfileApiError } from "@/lib/profiles/admin";
import {
  profileContentOverrideSchema,
  profileStatusUpdateSchema,
  profileUpdateSchema,
} from "@/lib/profiles/validation";

/**
 * As rotas são casca fina: autorizam, validam com Zod, chamam uma operação do
 * repositório e traduzem erro em código estável. O que dá para testar sem
 * subir o Next é justamente esse contrato — códigos, status e validação.
 */

describe("toProfileApiError", () => {
  it("preserva status e código de erro do domínio", () => {
    const mapped = toProfileApiError(
      new ProfileHttpError("Não autenticado.", 401, "PROFILE_UNAUTHENTICATED")
    );
    expect(mapped.status).toBe(401);
    expect(mapped.body.code).toBe("PROFILE_UNAUTHENTICATED");
  });

  it("mapeia 403 de quem não é admin", () => {
    const mapped = toProfileApiError(
      new ProfileHttpError("Apenas administradores.", 403, "PROFILE_FORBIDDEN")
    );
    expect(mapped.status).toBe(403);
    expect(mapped.body.code).toBe("PROFILE_FORBIDDEN");
  });

  it("mapeia 404 de perfil inexistente", () => {
    const mapped = toProfileApiError(
      new ProfileHttpError("Perfil não encontrado.", 404, "PROFILE_NOT_FOUND")
    );
    expect(mapped.status).toBe(404);
    expect(mapped.body.code).toBe("PROFILE_NOT_FOUND");
  });

  it("não vaza mensagem interna em erro inesperado", () => {
    const mapped = toProfileApiError(
      new Error("connection to db-primary at 10.0.0.4 failed: password authentication")
    );
    expect(mapped.status).toBe(500);
    expect(mapped.body.code).toBe("PROFILE_INTERNAL_ERROR");
    expect(mapped.body.error).toBe("Ocorreu um erro inesperado.");
    expect(JSON.stringify(mapped)).not.toContain("10.0.0.4");
    expect(JSON.stringify(mapped)).not.toContain("password");
  });

  it("não vaza contato privado presente em erro inesperado", () => {
    const mapped = toProfileApiError(
      new Error("falha ao gravar professional_phone=+5519999999999")
    );
    expect(JSON.stringify(mapped)).not.toContain("5519999999999");
  });
});

describe("payload de status", () => {
  it("aceita os três status", () => {
    for (const status of ["draft", "published", "archived"]) {
      expect(profileStatusUpdateSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejeita status desconhecido", () => {
    expect(profileStatusUpdateSchema.safeParse({ status: "deleted" }).success).toBe(false);
    expect(profileStatusUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("payload de atualização", () => {
  it("aceita atualização parcial", () => {
    expect(profileUpdateSchema.safeParse({ showWhatsapp: true }).success).toBe(true);
  });

  it("rejeita corpo com slug inválido", () => {
    expect(profileUpdateSchema.safeParse({ slug: "COM MAIÚSCULA" }).success).toBe(false);
  });

  it("rejeita URL com esquema perigoso no corpo", () => {
    expect(
      profileUpdateSchema.safeParse({ websiteUrl: "javascript:alert(document.cookie)" }).success
    ).toBe(false);
  });

  it("aceita seções com entradas ordenadas", () => {
    const parsed = profileUpdateSchema.safeParse({
      sections: [
        {
          key: "practice",
          enabled: true,
          sortOrder: 0,
          entries: [
            {
              entryType: "area",
              sortOrder: 1,
              localizations: [{ locale: "pt-BR", title: "Contencioso tributário" }],
            },
          ],
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita seção fora do catálogo", () => {
    expect(
      profileUpdateSchema.safeParse({ sections: [{ key: "inventada" }] }).success
    ).toBe(false);
  });
});

describe("payload de override de conteúdo", () => {
  it("aceita as três fontes suportadas", () => {
    for (const sourceType of ["instagram", "linkedin", "reel_studio"]) {
      expect(
        profileContentOverrideSchema.safeParse({ sourceType, sourceId: "abc", hidden: true }).success
      ).toBe(true);
    }
  });

  it("rejeita fonte desconhecida", () => {
    expect(
      profileContentOverrideSchema.safeParse({ sourceType: "tiktok", sourceId: "a", hidden: true })
        .success
    ).toBe(false);
  });

  it("exige o identificador da publicação", () => {
    expect(
      profileContentOverrideSchema.safeParse({ sourceType: "instagram", sourceId: "", hidden: true })
        .success
    ).toBe(false);
  });
});
