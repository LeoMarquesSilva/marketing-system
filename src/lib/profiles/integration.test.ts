/**
 * Task 13 — aceitação em módulo (sem browser/DB ao vivo).
 *
 * Compõe helpers puros já cobertos em suites unitárias; aqui o foco é a
 * jornada ponta a ponta do domínio Perfis NFC.
 */

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  ProfileHttpError,
  assertProfileAdminRole,
  mergeLocalizationForSave,
} from "@/lib/profiles/admin";
import {
  buildProfessionalProfilePublicAction,
  buildProfileRedirectPath,
} from "@/lib/profiles/cards";
import { isProfileCampaignActive, resolveCampaignMessage } from "@/lib/profiles/campaign";
import { aggregateProfileContentItems } from "@/lib/profiles/content";
import { buildEditorState, buildProfileUpdatePayload } from "@/lib/profiles/editor";
import { buildImportPayload, buildImportPreview, parseCollaboratorWorkbook } from "@/lib/profiles/import";
import { sanitizeProfileEventPayload } from "@/lib/profiles/metrics";
import { recordProfileEvent } from "@/lib/profiles/metrics-record";
import { getNfcPublicUrl } from "@/lib/nfc/public-url";
import {
  getPublicProfessionalProfile,
  projectPublicContacts,
} from "@/lib/profiles/public";
import type {
  ImportExistingProfile,
  ImportUserCandidate,
  ProfessionalProfileAdminDetail,
  ProfessionalProfileLocalization,
  ProfileCampaign,
  ProfileContentItem,
} from "@/lib/profiles/types";
import { profileStatusSchema } from "@/lib/profiles/validation";
import { buildVCard } from "@/lib/profiles/vcard";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const ptLocalization: ProfessionalProfileLocalization = {
  locale: "pt-BR",
  isApproved: true,
  displayName: "Letícia Rodrigues",
  role: "Sócia",
  practiceArea: "Tributário",
  tagline: "A advocacia começa pela escuta.",
  bio: "Atua em contencioso tributário há 12 anos.",
};

const enPartial: ProfessionalProfileLocalization = {
  locale: "en",
  isApproved: false,
  displayName: "Leticia Rodrigues",
  role: "Partner",
  practiceArea: null,
  tagline: null,
  bio: null,
};

const editorDetail: ProfessionalProfileAdminDetail = {
  id: PROFILE_ID,
  userId: USER_ID,
  userName: "Letícia Rodrigues",
  slug: "leticia-rodrigues",
  status: "draft",
  photoUrl: "https://cdn.exemplo.com/leticia.jpg",
  oab: null,
  joinedOn: "2019-03-01",
  professionalEmail: "leticia@bismarchipires.com.br",
  professionalPhone: "+5519999999999",
  linkedinUrl: "https://linkedin.com/in/leticia",
  websiteUrl: null,
  showTenure: true,
  showEmail: true,
  showWhatsapp: false,
  showLinkedin: true,
  showWebsite: false,
  publishedAt: null,
  updatedAt: "2026-07-28T12:00:00.000Z",
  localizations: [ptLocalization, enPartial],
  sections: [],
  cards: [],
  hiddenContentKeys: [],
};

const IMPORT_HEADER = [
  "CadastroNovo",
  "GRUPO EMPRESA2",
  "EMPRESA",
  "CNPJ/CPF",
  "E-MAIL EMPRESA",
  "TIPO",
  "SETOR EMPRESA",
  "NÚMERO DE COLABORADORES EMPRESA",
  "SITE EMPRESA",
  "LINKEDIN EMPRESA",
  "TELEFONE EMPRESA",
  "ESTADO EMPRESA",
  "CIDADE EMPRESA",
  "Colaborador Ativo?",
  "NOME",
  "ÁREA",
  "CARGO",
  "DT. ADMISSÃO",
  "TELEFONE",
  "DATA DE NASC.",
  "E-MAIL",
  "Tag",
];

function importRow(values: {
  ativo: string;
  nome: string;
  area: string;
  cargo: string;
  email: string;
  telefone?: string | null;
}) {
  const line = new Array(IMPORT_HEADER.length).fill(null);
  line[13] = values.ativo;
  line[14] = values.nome;
  line[15] = values.area;
  line[16] = values.cargo;
  line[18] = values.telefone ?? null;
  line[20] = values.email;
  return line;
}

function buildImportWorkbook(rows: unknown[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet([IMPORT_HEADER, ...rows], { cellDates: true });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/** Stub mínimo para resolução pública (slug / redirect / draft). */
function createPublicLookupClient(options: {
  profile?: Record<string, unknown> | null;
  redirect?: { old_slug: string; profile_id: string } | null;
  redirectedProfile?: { slug: string; status: string } | null;
}): SupabaseClient {
  const client = {
    from(table: string) {
      const eqFilters: Record<string, string> = {};
      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: string) {
          eqFilters[column] = value;
          return builder;
        },
        order() {
          return builder;
        },
        in() {
          return builder;
        },
        maybeSingle: async () => {
          if (table === "professional_profiles") {
            if (eqFilters.id && options.redirectedProfile) {
              return { data: options.redirectedProfile, error: null };
            }
            if (eqFilters.slug) {
              return { data: options.profile ?? null, error: null };
            }
            return { data: null, error: null };
          }
          if (table === "professional_profile_slug_redirects") {
            return { data: options.redirect ?? null, error: null };
          }
          if (table === "users") {
            return { data: { name: "Letícia Rodrigues" }, error: null };
          }
          if (table === "professional_profile_campaign") {
            return { data: null, error: null };
          }
          return { data: null, error: null };
        },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          if (table === "professional_profile_localizations") {
            return Promise.resolve({
              data: [
                {
                  profile_id: PROFILE_ID,
                  locale: "pt-BR",
                  is_approved: true,
                  display_name: ptLocalization.displayName,
                  role: ptLocalization.role,
                  practice_area: ptLocalization.practiceArea,
                  tagline: ptLocalization.tagline,
                  bio: ptLocalization.bio,
                },
              ],
              error: null,
            }).then(resolve);
          }
          if (table === "professional_profile_content_overrides") {
            return Promise.resolve({ data: [], error: null }).then(resolve);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

vi.mock("@/lib/profiles/content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profiles/content")>();
  return {
    ...actual,
    listRecentProfessionalContent: vi.fn(async () => []),
  };
});

describe("Task 13 — jornadas Perfis NFC (aceitação em módulo)", () => {
  it("1. non-admin não passa pelo gate assertProfileAdminRole", () => {
    expect(() => assertProfileAdminRole({ role: "admin", permissions: [] })).not.toThrow();
    expect(() => assertProfileAdminRole({ role: null, permissions: ["/nfc"] })).toThrow(
      ProfileHttpError
    );
    try {
      assertProfileAdminRole({ role: "designer", permissions: ["/admin"] });
      throw new Error("deveria ter lançado");
    } catch (error) {
      expect(error).toBeInstanceOf(ProfileHttpError);
      expect((error as ProfileHttpError).status).toBe(403);
      expect((error as ProfileHttpError).code).toBe("PROFILE_FORBIDDEN");
    }
  });

  it("2. preview de importação agrupa create / update / unmatched", () => {
    const workbook = buildImportWorkbook([
      importRow({
        ativo: "SIM",
        nome: "Nova Pessoa",
        area: "Trabalhista",
        cargo: "Associada",
        email: "nova@bismarchipires.com.br",
      }),
      importRow({
        ativo: "SIM",
        nome: "Letícia Atualizada",
        area: "Tributário",
        cargo: "Sócia",
        email: "leticia@bismarchipires.com.br",
        telefone: "(19) 98888-7777",
      }),
      importRow({
        ativo: "SIM",
        nome: "Sem Cadastro",
        area: "Cível",
        cargo: "Estagiária",
        email: "fantasma@bismarchipires.com.br",
      }),
    ]);

    const users: ImportUserCandidate[] = [
      { id: "u-nova", email: "nova@bismarchipires.com.br", name: "Nova Pessoa" },
      { id: USER_ID, email: "leticia@bismarchipires.com.br", name: "Letícia Rodrigues" },
    ];
    const existing: ImportExistingProfile[] = [
      {
        userId: USER_ID,
        slug: "leticia-rodrigues",
        professionalEmail: "leticia@bismarchipires.com.br",
        professionalPhone: "+5519999999999",
        joinedOn: "2019-03-01",
        displayName: "Letícia Rodrigues",
        role: "Sócia",
        practiceArea: "Tributário",
      },
    ];

    const preview = buildImportPreview(parseCollaboratorWorkbook(workbook), users, existing);
    const byEmail = new Map(preview.rows.map((row) => [row.email, row]));

    expect(byEmail.get("nova@bismarchipires.com.br")?.outcome).toBe("create");
    expect(byEmail.get("leticia@bismarchipires.com.br")?.outcome).toBe("update");
    expect(byEmail.get("fantasma@bismarchipires.com.br")?.outcome).toBe("unmatched");
    expect(preview.counts.create).toBe(1);
    expect(preview.counts.update).toBe(1);
    expect(preview.counts.unmatched).toBe(1);
  });

  it("3. payload de apply não publica — linhas aplicadas permanecem draft", () => {
    const workbook = buildImportWorkbook([
      importRow({
        ativo: "SIM",
        nome: "Nova Pessoa",
        area: "Trabalhista",
        cargo: "Associada",
        email: "nova@bismarchipires.com.br",
      }),
    ]);
    const users: ImportUserCandidate[] = [
      { id: "u-nova", email: "nova@bismarchipires.com.br", name: "Nova Pessoa" },
    ];
    const preview = buildImportPreview(parseCollaboratorWorkbook(workbook), users, []);
    const payload = buildImportPayload(preview, ["nova@bismarchipires.com.br"], false);

    expect(payload).toHaveLength(1);
    expect(payload[0]).not.toHaveProperty("status");
    expect(JSON.stringify(payload)).not.toContain("published");
    // Contrato de domínio: status válido inclui draft; importação nunca escolhe published.
    expect(profileStatusSchema.parse("draft")).toBe("draft");
    expect(profileStatusSchema.safeParse("published").success).toBe(true);
  });

  it("4. editor salva PT e EN parcial sem apagar tradução existente", () => {
    const state = buildEditorState(editorDetail);
    state.localizations["pt-BR"].tagline = "Nova frase em português.";
    // EN parcial permanece no estado — payload leva ambas as localizações.
    expect(state.localizations.en.displayName).toBe("Leticia Rodrigues");
    expect(state.localizations.en.practiceArea).toBe("");

    const payload = buildProfileUpdatePayload(state);
    const localizations = payload.localizations ?? [];
    const pt = localizations.find((item) => item.locale === "pt-BR");
    const en = localizations.find((item) => item.locale === "en");

    expect(pt?.tagline).toBe("Nova frase em português.");
    expect(pt?.bio).toBe(ptLocalization.bio);
    expect(en?.displayName).toBe("Leticia Rodrigues");
    expect(en?.role).toBe("Partner");
    expect(en?.practiceArea).toBeNull();

    // Merge parcial no servidor: salvar só PT não limpa EN.
    const mergedEn = mergeLocalizationForSave(enPartial, {
      locale: "en",
      displayName: "Leticia R.",
    });
    expect(mergedEn.displayName).toBe("Leticia R.");
    expect(mergedEn.role).toBe("Partner");
    expect(mergedEn.bio).toBeNull();
  });

  it("5. telefone oculto ausente na projeção pública", () => {
    const contacts = projectPublicContacts({
      professionalEmail: "leticia@bismarchipires.com.br",
      professionalPhone: "+5519999999999",
      linkedinUrl: "https://linkedin.com/in/leticia",
      websiteUrl: null,
      showEmail: true,
      showWhatsapp: false,
      showLinkedin: true,
      showWebsite: false,
    });
    expect(contacts.whatsapp).toBeNull();
    expect(contacts.email).toBe("leticia@bismarchipires.com.br");
    expect(JSON.stringify(contacts)).not.toContain("+5519");
  });

  it("6. rascunho resolve para null publicamente", async () => {
    const client = createPublicLookupClient({
      profile: {
        id: PROFILE_ID,
        user_id: USER_ID,
        slug: "leticia-rodrigues",
        status: "draft",
        photo_url: null,
        oab: null,
        joined_on: null,
        professional_email: "leticia@bismarchipires.com.br",
        professional_phone: "+5519999999999",
        linkedin_url: null,
        website_url: null,
        show_tenure: true,
        show_email: true,
        show_whatsapp: false,
        show_linkedin: true,
        show_website: false,
      },
    });

    await expect(
      getPublicProfessionalProfile("leticia-rodrigues", "pt-BR", { client })
    ).resolves.toBeNull();
  });

  it("7. perfil published resolve com kind profile", async () => {
    const client = createPublicLookupClient({
      profile: {
        id: PROFILE_ID,
        user_id: USER_ID,
        slug: "leticia-rodrigues",
        status: "published",
        photo_url: "https://cdn.exemplo.com/leticia.jpg",
        oab: null,
        joined_on: "2019-03-01",
        professional_email: "leticia@bismarchipires.com.br",
        professional_phone: "+5519999999999",
        linkedin_url: "https://linkedin.com/in/leticia",
        website_url: null,
        show_tenure: true,
        show_email: true,
        show_whatsapp: false,
        show_linkedin: true,
        show_website: false,
      },
    });

    const result = await getPublicProfessionalProfile("leticia-rodrigues", "pt-BR", {
      client,
      now: new Date("2026-07-28T12:00:00.000Z"),
    });
    expect(result?.kind).toBe("profile");
    if (result?.kind !== "profile") return;
    expect(result.profile.slug).toBe("leticia-rodrigues");
    expect(result.profile.identity.name).toBe("Letícia Rodrigues");
  });

  it("8. slug antigo devolve kind redirect", async () => {
    const client = createPublicLookupClient({
      profile: null,
      redirect: { old_slug: "leticia-antiga", profile_id: PROFILE_ID },
      redirectedProfile: { slug: "leticia-rodrigues", status: "published" },
    });

    await expect(
      getPublicProfessionalProfile("leticia-antiga", "pt-BR", { client })
    ).resolves.toEqual({ kind: "redirect", slug: "leticia-rodrigues" });
  });

  it("9. transição NFC professional_profile usa display name", () => {
    const action = buildProfessionalProfilePublicAction({
      id: PROFILE_ID,
      slug: "leticia-rodrigues",
      status: "published",
      displayName: "Letícia Rodrigues",
      locale: "pt-BR",
      professionalEmail: "secreto@empresa.com",
      professionalPhone: "+5519111111111",
    });
    expect(action.type).toBe("professional_profile");
    expect(action.loadingMessage).toBe("Abrindo o perfil de Letícia Rodrigues");
    expect(action.profile?.displayName).toBe("Letícia Rodrigues");
    expect(JSON.stringify(action)).not.toContain("secreto@");
  });

  it("10. URL de QR retém source=qr", () => {
    expect(getNfcPublicUrl("token_qr_abc", {}, { source: "qr" })).toContain("source=qr");
    expect(buildProfileRedirectPath("leticia-rodrigues", "qr")).toBe(
      "/perfil/leticia-rodrigues?source=qr"
    );
  });

  it("11. vCard só inclui contatos visíveis na projeção", () => {
    const contacts = projectPublicContacts({
      professionalEmail: "leticia@bismarchipires.com.br",
      professionalPhone: "+5519999999999",
      linkedinUrl: "https://linkedin.com/in/leticia",
      websiteUrl: "https://bismarchipires.com.br",
      showEmail: true,
      showWhatsapp: false,
      showLinkedin: true,
      showWebsite: false,
    });

    const vcard = buildVCard({
      displayName: "Letícia Rodrigues",
      role: "Sócia",
      email: contacts.email,
      phone: contacts.whatsapp,
      linkedinUrl: contacts.linkedinUrl,
      websiteUrl: contacts.websiteUrl,
    });

    expect(vcard).toContain("EMAIL;CHARSET=UTF-8:leticia@bismarchipires.com.br");
    expect(vcard).toContain("URL;TYPE=LinkedIn:https://linkedin.com/in/leticia");
    expect(vcard).not.toContain("TEL");
    expect(vcard).not.toContain("+5519");
    expect(vcard).not.toContain("bismarchipires.com.br\r\nEND");
    expect(vcard).not.toMatch(/^URL:https:\/\/bismarchipires/m);
  });

  it("12. conteúdo recente oculto some no agregador", () => {
    const items: ProfileContentItem[] = [
      {
        sourceType: "instagram",
        sourceId: "ig-1",
        key: "instagram:ig-1",
        title: "Visível",
        imageUrl: null,
        url: "https://instagram.com/p/ig-1",
        publishedAt: "2026-07-20T10:00:00.000Z",
      },
      {
        sourceType: "reel_studio",
        sourceId: "reel-1",
        key: "reel_studio:reel-1",
        title: "Oculto",
        imageUrl: null,
        url: null,
        publishedAt: "2026-07-22T08:00:00.000Z",
      },
    ];

    const result = aggregateProfileContentItems(items, {
      hiddenKeys: new Set(["reel_studio:reel-1"]),
      limit: 3,
    });
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("instagram:ig-1");
    expect(result.map((item) => item.key)).not.toContain("reel_studio:reel-1");
  });

  it("13. campanha com interruptor manual off vence a janela de datas", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    const campaign: ProfileCampaign = {
      enabled: false,
      startsAt: "2026-08-01T00:00:00.000Z",
      endsAt: "2026-08-31T23:59:59.000Z",
      titlePt: "Campanha",
      titleEn: "Campaign",
      messagePt: "Mensagem ativa na agenda",
      messageEn: "Scheduled message",
      callToActionPt: null,
      callToActionEn: null,
    };

    expect(isProfileCampaignActive(campaign, now)).toBe(false);
    expect(resolveCampaignMessage(campaign, "pt-BR", now)).toBeNull();
  });

  it("14. falha de métricas não propaga para a UI", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sanitized = sanitizeProfileEventPayload({
      eventType: "whatsapp_click",
      source: "nfc",
      locale: "pt-BR",
      phone: "+5519999999999",
      url: "https://evil.example",
    });
    expect(sanitized).toEqual({
      eventType: "whatsapp_click",
      source: "nfc",
      locale: "pt-BR",
    });
    expect(JSON.stringify(sanitized)).not.toContain("+5519");
    expect(JSON.stringify(sanitized)).not.toContain("evil");

    const client = {
      rpc: vi.fn(async () => {
        throw new Error("rpc boom");
      }),
      from: vi.fn(() => ({
        insert: vi.fn(async () => ({ error: { message: "insert boom" } })),
      })),
    } as unknown as SupabaseClient;

    await expect(
      recordProfileEvent(
        {
          profileId: PROFILE_ID,
          eventType: sanitized.eventType,
          source: sanitized.source,
          locale: sanitized.locale,
        },
        { client }
      )
    ).resolves.toBeUndefined();

    errorSpy.mockRestore();
  });
});
