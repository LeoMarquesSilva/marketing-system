import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildTenureLabel,
  getPublicProfessionalProfile,
  mapCampaignRow,
  projectPublicContacts,
  projectPublicIdentity,
  projectPublicSections,
  type PublicEntryLocalizationRow,
  type PublicEntryRow,
  type PublicProfileRow,
  type PublicSectionRow,
} from "@/lib/profiles/public";
import type { ProfessionalProfileLocalization } from "@/lib/profiles/types";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const pt: ProfessionalProfileLocalization = {
  locale: "pt-BR",
  isApproved: true,
  displayName: "Letícia Rodrigues",
  role: "Sócia",
  practiceArea: "Tributário",
  tagline: "A advocacia começa pela escuta.",
  bio: "Atua em contencioso tributário.",
};

const en: ProfessionalProfileLocalization = {
  locale: "en",
  isApproved: true,
  displayName: "Leticia Rodrigues",
  role: "Partner",
  practiceArea: "Tax",
  tagline: "Advocacy begins with listening.",
  bio: "Works in tax litigation.",
};

const publishedRow: PublicProfileRow = {
  id: PROFILE_ID,
  user_id: USER_ID,
  slug: "leticia-rodrigues",
  status: "published",
  photo_url: "https://cdn.exemplo.com/leticia.jpg",
  oab: "OAB/SP 123",
  joined_on: "2019-03-01",
  professional_email: "leticia@bismarchipires.com.br",
  professional_phone: "+5519999999999",
  linkedin_url: "https://linkedin.com/in/leticia",
  website_url: "https://bismarchipires.com.br",
  show_tenure: true,
  show_email: true,
  show_whatsapp: false,
  show_linkedin: true,
  show_website: true,
};

vi.mock("@/lib/profiles/content", () => ({
  listRecentProfessionalContent: vi.fn(async () => [
    {
      sourceType: "instagram",
      sourceId: "ig-1",
      key: "instagram:ig-1",
      title: "Post recente",
      imageUrl: null,
      url: "https://instagram.com/p/ig-1",
      publishedAt: "2026-07-20T10:00:00.000Z",
    },
  ]),
}));

import { listRecentProfessionalContent } from "@/lib/profiles/content";

describe("buildTenureLabel", () => {
  it("monta o rótulo no idioma pedido", () => {
    expect(buildTenureLabel("2019-03-01", true, "pt-BR")).toBe("Desde 2019");
    expect(buildTenureLabel("2019-03-01", true, "en")).toBe("Since 2019");
  });

  it("omite quando tenure está desligado ou sem data", () => {
    expect(buildTenureLabel("2019-03-01", false, "pt-BR")).toBeNull();
    expect(buildTenureLabel(null, true, "pt-BR")).toBeNull();
    expect(buildTenureLabel("invalid", true, "pt-BR")).toBeNull();
  });
});

describe("projectPublicContacts", () => {
  it("oculta e-mail e WhatsApp quando os flags estão desligados", () => {
    expect(
      projectPublicContacts({
        professionalEmail: "a@b.com",
        professionalPhone: "+5511",
        linkedinUrl: "https://linkedin.com/in/x",
        websiteUrl: "https://site.com",
        showEmail: false,
        showWhatsapp: false,
        showLinkedin: true,
        showWebsite: true,
      })
    ).toEqual({
      email: null,
      whatsapp: null,
      linkedinUrl: "https://linkedin.com/in/x",
      websiteUrl: "https://site.com",
    });
  });

  it("respeita flags de LinkedIn e site", () => {
    expect(
      projectPublicContacts({
        professionalEmail: "a@b.com",
        professionalPhone: "+5511",
        linkedinUrl: "https://linkedin.com/in/x",
        websiteUrl: "https://site.com",
        showEmail: true,
        showWhatsapp: true,
        showLinkedin: false,
        showWebsite: false,
      })
    ).toEqual({
      email: "a@b.com",
      whatsapp: "+5511",
      linkedinUrl: null,
      websiteUrl: null,
    });
  });
});

describe("projectPublicIdentity", () => {
  it("cai inteiramente para PT quando o inglês não está aprovado", () => {
    const identity = projectPublicIdentity({
      locale: "en",
      pt,
      en: { ...en, isApproved: false },
      oab: "OAB/SP 123",
      photoUrl: "https://cdn.exemplo.com/leticia.jpg",
      joinedOn: "2019-03-01",
      showTenure: true,
    });
    expect(identity.name).toBe("Letícia Rodrigues");
    expect(identity.role).toBe("Sócia");
    expect(identity.practiceArea).toBe("Tributário");
    expect(identity.tagline).toBe("A advocacia começa pela escuta.");
    expect(identity.bio).toBe("Atua em contencioso tributário.");
    expect(identity.tenureLabel).toBe("Since 2019");
  });

  it("usa inglês aprovado com fallback por campo opcional vazio", () => {
    const identity = projectPublicIdentity({
      locale: "en",
      pt,
      en: { ...en, tagline: "", bio: null },
      oab: null,
      photoUrl: null,
      joinedOn: "2019-03-01",
      showTenure: true,
    });
    expect(identity.name).toBe("Leticia Rodrigues");
    expect(identity.role).toBe("Partner");
    expect(identity.tagline).toBe("A advocacia começa pela escuta.");
    expect(identity.bio).toBe("Atua em contencioso tributário.");
  });

  it("omite joinedOn e tenureLabel quando showTenure é false", () => {
    const identity = projectPublicIdentity({
      locale: "pt-BR",
      pt,
      en,
      oab: null,
      photoUrl: null,
      joinedOn: "2019-03-01",
      showTenure: false,
    });
    expect(identity.joinedOn).toBeNull();
    expect(identity.tenureLabel).toBeNull();
  });
});

describe("projectPublicSections", () => {
  const sections: PublicSectionRow[] = [
    { id: "sec-b", section_key: "education", enabled: true, sort_order: 2 },
    { id: "sec-a", section_key: "practice", enabled: true, sort_order: 1 },
    { id: "sec-c", section_key: "timeline", enabled: false, sort_order: 0 },
  ];

  const entries: PublicEntryRow[] = [
    {
      id: "e2",
      section_id: "sec-a",
      entry_type: "area",
      link_url: null,
      image_url: null,
      occurred_on: null,
      sort_order: 2,
      is_visible: true,
    },
    {
      id: "e1",
      section_id: "sec-a",
      entry_type: "area",
      link_url: null,
      image_url: null,
      occurred_on: null,
      sort_order: 1,
      is_visible: true,
    },
    {
      id: "e-hidden",
      section_id: "sec-a",
      entry_type: "area",
      link_url: null,
      image_url: null,
      occurred_on: null,
      sort_order: 0,
      is_visible: false,
    },
    {
      id: "e3",
      section_id: "sec-b",
      entry_type: "degree",
      link_url: null,
      image_url: null,
      occurred_on: "2010-01-01",
      sort_order: 1,
      is_visible: true,
    },
  ];

  const locs: PublicEntryLocalizationRow[] = [
    {
      entry_id: "e1",
      locale: "pt-BR",
      title: "Contencioso",
      subtitle: null,
      description: "Desc PT",
    },
    {
      entry_id: "e1",
      locale: "en",
      title: "Litigation",
      subtitle: null,
      description: "",
    },
    {
      entry_id: "e2",
      locale: "pt-BR",
      title: "Consultivo",
      subtitle: null,
      description: null,
    },
    {
      entry_id: "e3",
      locale: "pt-BR",
      title: "USP",
      subtitle: "Direito",
      description: null,
    },
  ];

  it("omite seções desabilitadas e entradas ocultas, com ordem estável", () => {
    const result = projectPublicSections({
      locale: "pt-BR",
      sections,
      entries,
      entryLocalizations: locs,
    });
    expect(result.map((s) => s.key)).toEqual(["practice", "education"]);
    expect(result[0]?.entries.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(result[0]?.entries.some((e) => e.id === "e-hidden")).toBe(false);
  });

  it("localiza entradas com fallback por campo", () => {
    const result = projectPublicSections({
      locale: "en",
      sections,
      entries,
      entryLocalizations: locs,
    });
    expect(result[0]?.entries[0]).toMatchObject({
      id: "e1",
      title: "Litigation",
      description: "Desc PT",
    });
  });
});

describe("mapCampaignRow", () => {
  it("mapeia a linha singular da campanha", () => {
    expect(
      mapCampaignRow({
        enabled: true,
        starts_at: "2026-08-01T00:00:00.000Z",
        ends_at: null,
        title_pt: "Título",
        title_en: "Title",
        message_pt: "Mensagem",
        message_en: "Message",
        call_to_action_pt: null,
        call_to_action_en: null,
      })
    ).toEqual({
      enabled: true,
      startsAt: "2026-08-01T00:00:00.000Z",
      endsAt: null,
      titlePt: "Título",
      titleEn: "Title",
      messagePt: "Mensagem",
      messageEn: "Message",
      callToActionPt: null,
      callToActionEn: null,
    });
  });
});

type QueryResult = { data: unknown; error: { message?: string } | null };

function createPublicSupabaseStub(handlers: {
  profileBySlug?: (slug: string) => QueryResult;
  redirectBySlug?: (slug: string) => QueryResult;
  profileById?: (id: string) => QueryResult;
  localizations?: () => QueryResult;
  sections?: () => QueryResult;
  entries?: () => QueryResult;
  entryLocalizations?: () => QueryResult;
  overrides?: () => QueryResult;
  user?: () => QueryResult;
  campaign?: () => QueryResult | never;
}): SupabaseClient {
  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        in() {
          return builder;
        },
        order() {
          return builder;
        },
        maybeSingle() {
          if (table === "professional_profiles") {
            if (typeof filters.id === "string") {
              return Promise.resolve(
                handlers.profileById?.(filters.id as string) ?? {
                  data: null,
                  error: null,
                }
              );
            }
            return Promise.resolve(
              handlers.profileBySlug?.(String(filters.slug ?? "")) ?? {
                data: null,
                error: null,
              }
            );
          }
          if (table === "professional_profile_slug_redirects") {
            return Promise.resolve(
              handlers.redirectBySlug?.(String(filters.old_slug ?? "")) ?? {
                data: null,
                error: null,
              }
            );
          }
          if (table === "users") {
            return Promise.resolve(handlers.user?.() ?? { data: null, error: null });
          }
          if (table === "professional_profile_campaign") {
            if (typeof handlers.campaign === "function") {
              try {
                return Promise.resolve(handlers.campaign());
              } catch (error) {
                return Promise.reject(error);
              }
            }
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
          let result: QueryResult = { data: [], error: null };
          try {
            if (table === "professional_profile_localizations") {
              result = handlers.localizations?.() ?? { data: [], error: null };
            } else if (table === "professional_profile_sections") {
              result = handlers.sections?.() ?? { data: [], error: null };
            } else if (table === "professional_profile_entries") {
              result = handlers.entries?.() ?? { data: [], error: null };
            } else if (table === "professional_profile_entry_localizations") {
              result = handlers.entryLocalizations?.() ?? { data: [], error: null };
            } else if (table === "professional_profile_content_overrides") {
              result = handlers.overrides?.() ?? { data: [], error: null };
            }
            return Promise.resolve(result).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

describe("getPublicProfessionalProfile", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");

  it("só resolve perfis published", async () => {
    const client = createPublicSupabaseStub({
      profileBySlug: () => ({ data: { ...publishedRow, status: "draft" }, error: null }),
    });
    await expect(
      getPublicProfessionalProfile("leticia-rodrigues", "pt-BR", { client, now })
    ).resolves.toBeNull();
  });

  it("arquivado também retorna null", async () => {
    const client = createPublicSupabaseStub({
      profileBySlug: () => ({ data: { ...publishedRow, status: "archived" }, error: null }),
    });
    await expect(
      getPublicProfessionalProfile("leticia-rodrigues", "pt-BR", { client, now })
    ).resolves.toBeNull();
  });

  it("slug atual devolve kind profile", async () => {
    const client = createPublicSupabaseStub({
      profileBySlug: () => ({ data: publishedRow, error: null }),
      localizations: () => ({
        data: [
          {
            profile_id: PROFILE_ID,
            locale: "pt-BR",
            is_approved: true,
            display_name: pt.displayName,
            role: pt.role,
            practice_area: pt.practiceArea,
            tagline: pt.tagline,
            bio: pt.bio,
          },
        ],
        error: null,
      }),
      sections: () => ({ data: [], error: null }),
      user: () => ({ data: { name: "Letícia Rodrigues" }, error: null }),
      overrides: () => ({ data: [], error: null }),
      campaign: () => ({
        data: {
          enabled: true,
          starts_at: "2026-08-01T00:00:00.000Z",
          ends_at: "2026-08-31T23:59:59.000Z",
          title_pt: "Dia",
          title_en: "Day",
          message_pt: "Mensagem da campanha",
          message_en: "Campaign message",
          call_to_action_pt: null,
          call_to_action_en: null,
        },
        error: null,
      }),
    });

    const result = await getPublicProfessionalProfile("leticia-rodrigues", "pt-BR", {
      client,
      now,
    });
    expect(result?.kind).toBe("profile");
    if (result?.kind !== "profile") return;
    expect(result.profile.slug).toBe("leticia-rodrigues");
    expect(result.profile.identity.name).toBe("Letícia Rodrigues");
    expect(result.profile.contacts.email).toBe("leticia@bismarchipires.com.br");
    expect(result.profile.contacts.whatsapp).toBeNull();
    expect(result.profile.campaignMessage).toBe("Mensagem da campanha");
    expect(result.profile.recentContent).toHaveLength(1);
  });

  it("slug antigo devolve redirect para o slug atual", async () => {
    const client = createPublicSupabaseStub({
      profileBySlug: () => ({ data: null, error: null }),
      redirectBySlug: (slug) =>
        slug === "leticia-antiga"
          ? { data: { old_slug: "leticia-antiga", profile_id: PROFILE_ID }, error: null }
          : { data: null, error: null },
      profileById: () => ({
        data: { slug: "leticia-rodrigues", status: "published" },
        error: null,
      }),
    });

    await expect(
      getPublicProfessionalProfile("leticia-antiga", "pt-BR", { client, now })
    ).resolves.toEqual({ kind: "redirect", slug: "leticia-rodrigues" });
  });

  it("continua com recentContent vazio quando a agregação falha", async () => {
    vi.mocked(listRecentProfessionalContent).mockRejectedValueOnce(new Error("boom"));
    const client = createPublicSupabaseStub({
      profileBySlug: () => ({ data: publishedRow, error: null }),
      localizations: () => ({
        data: [
          {
            profile_id: PROFILE_ID,
            locale: "pt-BR",
            is_approved: true,
            display_name: pt.displayName,
            role: pt.role,
            practice_area: pt.practiceArea,
            tagline: pt.tagline,
            bio: pt.bio,
          },
        ],
        error: null,
      }),
      sections: () => ({ data: [], error: null }),
      user: () => ({ data: { name: "Letícia Rodrigues" }, error: null }),
      overrides: () => ({ data: [], error: null }),
      campaign: () => ({ data: null, error: null }),
    });

    const result = await getPublicProfessionalProfile("leticia-rodrigues", "pt-BR", {
      client,
      now,
    });
    expect(result?.kind).toBe("profile");
    if (result?.kind !== "profile") return;
    expect(result.profile.recentContent).toEqual([]);
  });

  it("define campaignMessage=null quando a campanha falha", async () => {
    const client = createPublicSupabaseStub({
      profileBySlug: () => ({ data: publishedRow, error: null }),
      localizations: () => ({
        data: [
          {
            profile_id: PROFILE_ID,
            locale: "pt-BR",
            is_approved: true,
            display_name: pt.displayName,
            role: pt.role,
            practice_area: pt.practiceArea,
            tagline: pt.tagline,
            bio: pt.bio,
          },
        ],
        error: null,
      }),
      sections: () => ({ data: [], error: null }),
      user: () => ({ data: { name: "Letícia" }, error: null }),
      overrides: () => ({ data: [], error: null }),
      campaign: () => {
        throw new Error("campaign down");
      },
    });

    const result = await getPublicProfessionalProfile("leticia-rodrigues", "pt-BR", {
      client,
      now,
    });
    expect(result?.kind).toBe("profile");
    if (result?.kind !== "profile") return;
    expect(result.profile.campaignMessage).toBeNull();
  });
});
