import { describe, expect, it } from "vitest";
import {
  ProfileHttpError,
  assertProfileAdminRole,
  buildProfileSavePlan,
  computeProfileCompleteness,
  listMissingPublishRequirements,
  matchesProfileListFilters,
  mergeLocalizationForSave,
} from "@/lib/profiles/admin";
import type {
  ProfessionalProfileAdminDetail,
  ProfessionalProfileListItem,
  ProfessionalProfileLocalization,
} from "@/lib/profiles/types";

const ptLocalization: ProfessionalProfileLocalization = {
  locale: "pt-BR",
  isApproved: true,
  displayName: "Letícia Rodrigues",
  role: "Sócia",
  practiceArea: "Tributário",
  tagline: "A advocacia começa pela escuta.",
  bio: "Atua em contencioso tributário há 12 anos.",
};

const completeDetail: ProfessionalProfileAdminDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  userName: "Letícia Rodrigues",
  slug: "leticia-rodrigues",
  status: "draft",
  photoUrl: "https://cdn.exemplo.com/leticia.jpg",
  oab: null,
  joinedOn: "2019-03-01",
  professionalEmail: "leticia@bismarchipires.com.br",
  professionalPhone: "+5519999999999",
  linkedinUrl: null,
  websiteUrl: null,
  showTenure: true,
  showEmail: true,
  showWhatsapp: false,
  showLinkedin: true,
  showWebsite: true,
  publishedAt: null,
  updatedAt: "2026-07-28T12:00:00.000Z",
  localizations: [ptLocalization],
  sections: [],
  cards: [],
  hiddenContentKeys: [],
};

describe("assertProfileAdminRole", () => {
  it("aceita apenas o papel admin", () => {
    expect(() => assertProfileAdminRole({ role: "admin", permissions: [] })).not.toThrow();
    expect(() => assertProfileAdminRole({ role: "ADMIN", permissions: [] })).not.toThrow();
  });

  it("rejeita com 403 quem só tem a permissão /nfc", () => {
    try {
      assertProfileAdminRole({ role: null, permissions: ["/nfc"] });
      throw new Error("deveria ter lançado");
    } catch (error) {
      expect(error).toBeInstanceOf(ProfileHttpError);
      expect((error as ProfileHttpError).status).toBe(403);
      expect((error as ProfileHttpError).code).toBe("PROFILE_FORBIDDEN");
    }
  });

  it("rejeita quem tem /admin nas permissões mas não o papel admin", () => {
    expect(() => assertProfileAdminRole({ role: null, permissions: ["/admin", "/nfc"] })).toThrow(
      ProfileHttpError
    );
  });

  it("rejeita papel vazio ou desconhecido", () => {
    expect(() => assertProfileAdminRole({ role: null, permissions: [] })).toThrow(ProfileHttpError);
    expect(() => assertProfileAdminRole({ role: "designer", permissions: [] })).toThrow(
      ProfileHttpError
    );
  });
});

describe("listMissingPublishRequirements", () => {
  it("não aponta pendência quando o perfil está completo", () => {
    expect(listMissingPublishRequirements(completeDetail)).toEqual([]);
  });

  it("exige foto", () => {
    const missing = listMissingPublishRequirements({ ...completeDetail, photoUrl: null });
    expect(missing).toContain("photo");
  });

  it("exige nome, cargo, área, frase e mini-CV em português", () => {
    const missing = listMissingPublishRequirements({
      ...completeDetail,
      localizations: [
        { ...ptLocalization, displayName: null, role: null, practiceArea: null, tagline: null, bio: null },
      ],
    });
    expect(missing).toEqual(
      expect.arrayContaining(["displayName", "role", "practiceArea", "tagline", "bio"])
    );
  });

  it("exige e-mail institucional", () => {
    const missing = listMissingPublishRequirements({ ...completeDetail, professionalEmail: null });
    expect(missing).toContain("professionalEmail");
  });

  it("exige ao menos uma ação de contato habilitada", () => {
    const missing = listMissingPublishRequirements({
      ...completeDetail,
      showEmail: false,
      showWhatsapp: false,
      showLinkedin: false,
      showWebsite: false,
    });
    expect(missing).toContain("contactAction");
  });

  it("mantém a OAB opcional", () => {
    expect(listMissingPublishRequirements({ ...completeDetail, oab: null })).toEqual([]);
  });

  it("exige slug", () => {
    const missing = listMissingPublishRequirements({ ...completeDetail, slug: "" });
    expect(missing).toContain("slug");
  });
});

describe("buildProfileSavePlan", () => {
  it("registra o slug anterior como redirect ao trocar de slug", () => {
    const plan = buildProfileSavePlan(completeDetail, { slug: "leticia-r-advocacia" });
    expect(plan.slugRedirectToInsert).toBe("leticia-rodrigues");
    expect(plan.profilePatch.slug).toBe("leticia-r-advocacia");
  });

  it("não cria redirect quando o slug não muda", () => {
    const plan = buildProfileSavePlan(completeDetail, { slug: "leticia-rodrigues" });
    expect(plan.slugRedirectToInsert).toBeNull();
  });

  it("não cria redirect quando o slug nem foi enviado", () => {
    const plan = buildProfileSavePlan(completeDetail, { showEmail: false });
    expect(plan.slugRedirectToInsert).toBeNull();
  });

  it("publicar exige checklist completo", () => {
    const plan = buildProfileSavePlan({ ...completeDetail, photoUrl: null }, {});
    expect(plan.canPublish).toBe(false);
    expect(plan.missingForPublish).toContain("photo");
  });

  it("despublicar volta para rascunho sem apagar histórico", () => {
    const published = { ...completeDetail, status: "published" as const };
    const plan = buildProfileSavePlan(published, {});
    expect(plan.canPublish).toBe(true);
    expect(plan.slugRedirectToInsert).toBeNull();
  });
});

describe("mergeLocalizationForSave", () => {
  it("preserva campos localizados que não vieram no payload", () => {
    const merged = mergeLocalizationForSave(ptLocalization, {
      locale: "pt-BR",
      displayName: "Letícia R. Rodrigues",
    });
    expect(merged.displayName).toBe("Letícia R. Rodrigues");
    // bio e tagline não vieram no payload e não podem ser apagados
    expect(merged.bio).toBe(ptLocalization.bio);
    expect(merged.tagline).toBe(ptLocalization.tagline);
    expect(merged.practiceArea).toBe("Tributário");
  });

  it("permite limpar um campo explicitamente com null", () => {
    const merged = mergeLocalizationForSave(ptLocalization, {
      locale: "pt-BR",
      bio: null,
    });
    expect(merged.bio).toBeNull();
    expect(merged.displayName).toBe("Letícia Rodrigues");
  });

  it("cria a localização quando ainda não existe", () => {
    const merged = mergeLocalizationForSave(null, {
      locale: "en",
      displayName: "Leticia Rodrigues",
      role: "Partner",
    });
    expect(merged.locale).toBe("en");
    expect(merged.displayName).toBe("Leticia Rodrigues");
    expect(merged.bio).toBeNull();
    // Tradução nova nunca nasce aprovada.
    expect(merged.isApproved).toBe(false);
  });
});

describe("computeProfileCompleteness", () => {
  it("dá 100 para um perfil pronto para publicar", () => {
    expect(computeProfileCompleteness(completeDetail)).toBe(100);
  });

  it("cai conforme faltam requisitos", () => {
    const partial = computeProfileCompleteness({ ...completeDetail, photoUrl: null });
    expect(partial).toBeLessThan(100);
    expect(partial).toBeGreaterThan(0);
  });

  it("nunca sai da faixa 0..100", () => {
    const empty = computeProfileCompleteness({
      ...completeDetail,
      slug: "",
      photoUrl: null,
      professionalEmail: null,
      showEmail: false,
      showWhatsapp: false,
      showLinkedin: false,
      showWebsite: false,
      localizations: [],
    });
    expect(empty).toBeGreaterThanOrEqual(0);
    expect(empty).toBeLessThanOrEqual(100);
  });
});

describe("matchesProfileListFilters", () => {
  const item: ProfessionalProfileListItem = {
    id: "1",
    userId: "u1",
    slug: "leticia-rodrigues",
    status: "draft",
    photoUrl: null,
    displayName: "Letícia Rodrigues",
    role: "Sócia",
    practiceArea: "Tributário",
    completeness: 60,
    hasApprovedEnglish: false,
    cardCount: 0,
    activeCardCount: 0,
    viewCount: 0,
    scanCount: 0,
    updatedAt: "2026-07-28T12:00:00.000Z",
  };

  it("filtra por status", () => {
    expect(matchesProfileListFilters(item, { status: "draft" })).toBe(true);
    expect(matchesProfileListFilters(item, { status: "published" })).toBe(false);
    expect(matchesProfileListFilters(item, { status: "all" })).toBe(true);
  });

  it("busca por nome ignorando acento e caixa", () => {
    expect(matchesProfileListFilters(item, { search: "leticia" })).toBe(true);
    expect(matchesProfileListFilters(item, { search: "LETÍCIA" })).toBe(true);
    expect(matchesProfileListFilters(item, { search: "tributario" })).toBe(true);
    expect(matchesProfileListFilters(item, { search: "trabalhista" })).toBe(false);
  });

  it("busca pelo slug", () => {
    expect(matchesProfileListFilters(item, { search: "leticia-rod" })).toBe(true);
  });

  it("filtra por completude", () => {
    expect(matchesProfileListFilters(item, { completeness: "incomplete" })).toBe(true);
    expect(matchesProfileListFilters(item, { completeness: "complete" })).toBe(false);
    expect(matchesProfileListFilters({ ...item, completeness: 100 }, { completeness: "complete" })).toBe(
      true
    );
  });

  it("combina filtros", () => {
    expect(
      matchesProfileListFilters(item, { status: "draft", search: "letícia", completeness: "incomplete" })
    ).toBe(true);
    expect(
      matchesProfileListFilters(item, { status: "published", search: "letícia" })
    ).toBe(false);
  });
});
