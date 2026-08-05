import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateProfileContentItems,
  contentItemKey,
  dedupeLinkedInstagram,
  instagramRowBelongsToUser,
  linkedinBylineMatches,
  linkedinRowBelongsToUser,
  listRecentProfessionalContent,
  normalizeInstagramRow,
  normalizeLinkedinRow,
  normalizeReelStudioRow,
  truncateContentTitle,
  type InstagramContentRow,
  type LinkedinContentRow,
  type ReelStudioContentRow,
} from "@/lib/profiles/content";
import type { ProfileContentItem } from "@/lib/profiles/types";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const USER_NAME = "Letícia Rodrigues";

const igOwnedById: InstagramContentRow = {
  id: "ig-1",
  caption: "Post sobre contencioso tributário no STJ",
  thumbnail_url: "https://cdn.exemplo.com/ig-1.jpg",
  media_url: "https://cdn.exemplo.com/ig-1-full.jpg",
  permalink: "https://instagram.com/p/ig-1",
  published_at: "2026-07-20T10:00:00.000Z",
  solicitante_id: USER_ID,
  solicitantes: [],
};

const igOwnedByJson: InstagramContentRow = {
  id: "ig-2",
  caption: "Outro post via solicitantes jsonb",
  thumbnail_url: null,
  media_url: "https://cdn.exemplo.com/ig-2.jpg",
  permalink: "https://instagram.com/p/ig-2",
  published_at: "2026-07-18T10:00:00.000Z",
  solicitante_id: null,
  solicitantes: [{ id: USER_ID, name: USER_NAME }],
};

const igOther: InstagramContentRow = {
  id: "ig-other",
  caption: "Post de outra pessoa",
  thumbnail_url: null,
  media_url: null,
  permalink: null,
  published_at: "2026-07-21T10:00:00.000Z",
  solicitante_id: "99999999-9999-4999-8999-999999999999",
  solicitantes: [{ id: "99999999-9999-4999-8999-999999999999", name: "Outra" }],
};

const liLinked: LinkedinContentRow = {
  id: "li-1",
  caption: "Versão LinkedIn do mesmo tema",
  permalink: "https://linkedin.com/feed/update/li-1",
  published_at: "2026-07-20T12:00:00.000Z",
  byline: null,
  instagram_post_id: "ig-1",
};

const liByline: LinkedinContentRow = {
  id: "li-2",
  caption: "Artigo só no LinkedIn",
  permalink: "https://linkedin.com/feed/update/li-2",
  published_at: "2026-07-15T09:00:00.000Z",
  byline: "  letícia rodrigues ",
  instagram_post_id: null,
};

const reelRow: ReelStudioContentRow = {
  id: "reel-1",
  title: "Reel sobre reforma tributária",
  cover_image_url: "https://cdn.exemplo.com/reel-1.jpg",
  updated_at: "2026-07-22T08:00:00.000Z",
  created_at: "2026-07-01T08:00:00.000Z",
};

describe("contentItemKey", () => {
  it("gera chave estável sourceType:sourceId", () => {
    expect(contentItemKey("instagram", "ig-1")).toBe("instagram:ig-1");
    expect(contentItemKey("linkedin", "li-1")).toBe("linkedin:li-1");
    expect(contentItemKey("reel_studio", "reel-1")).toBe("reel_studio:reel-1");
  });
});

describe("truncateContentTitle", () => {
  it("trunca legendas longas e trata vazio", () => {
    expect(truncateContentTitle(null)).toBe("Sem título");
    expect(truncateContentTitle("  curta  ")).toBe("curta");
    const long = "a".repeat(200);
    expect(truncateContentTitle(long).endsWith("…")).toBe(true);
    expect(truncateContentTitle(long).length).toBeLessThanOrEqual(120);
  });
});

describe("adaptadores Instagram", () => {
  it("vincula por solicitante_id ou solicitantes jsonb", () => {
    expect(instagramRowBelongsToUser(igOwnedById, USER_ID)).toBe(true);
    expect(instagramRowBelongsToUser(igOwnedByJson, USER_ID)).toBe(true);
    expect(instagramRowBelongsToUser(igOther, USER_ID)).toBe(false);
  });

  it("normaliza campos e prefere thumbnail_url", () => {
    expect(normalizeInstagramRow(igOwnedById)).toEqual({
      sourceType: "instagram",
      sourceId: "ig-1",
      key: "instagram:ig-1",
      title: "Post sobre contencioso tributário no STJ",
      imageUrl: "https://cdn.exemplo.com/ig-1.jpg",
      url: "https://instagram.com/p/ig-1",
      publishedAt: "2026-07-20T10:00:00.000Z",
    });
    expect(normalizeInstagramRow(igOwnedByJson).imageUrl).toBe(
      "https://cdn.exemplo.com/ig-2.jpg"
    );
  });
});

describe("adaptadores LinkedIn", () => {
  it("vincula pela relação Instagram ou byline (case-insensitive)", () => {
    const owned = new Set(["ig-1"]);
    expect(linkedinRowBelongsToUser(liLinked, USER_NAME, owned)).toBe(true);
    expect(linkedinRowBelongsToUser(liByline, USER_NAME, owned)).toBe(true);
    expect(linkedinBylineMatches("LETÍCIA RODRIGUES", USER_NAME)).toBe(true);
    expect(
      linkedinRowBelongsToUser(
        { ...liLinked, instagram_post_id: "ig-other", byline: null },
        USER_NAME,
        owned
      )
    ).toBe(false);
  });

  it("usa imagem do Instagram relacionado quando disponível", () => {
    const images = new Map<string, string | null>([
      ["ig-1", "https://cdn.exemplo.com/ig-1.jpg"],
    ]);
    expect(normalizeLinkedinRow(liLinked, images).imageUrl).toBe(
      "https://cdn.exemplo.com/ig-1.jpg"
    );
    expect(normalizeLinkedinRow(liByline, images).imageUrl).toBeNull();
    expect(normalizeLinkedinRow(liLinked).key).toBe("linkedin:li-1");
  });
});

describe("adaptador Reel Studio", () => {
  it("normaliza título, capa e publishedAt via updated_at", () => {
    expect(normalizeReelStudioRow(reelRow)).toEqual({
      sourceType: "reel_studio",
      sourceId: "reel-1",
      key: "reel_studio:reel-1",
      title: "Reel sobre reforma tributária",
      imageUrl: "https://cdn.exemplo.com/reel-1.jpg",
      url: null,
      publishedAt: "2026-07-22T08:00:00.000Z",
    });
  });

  it("cai para created_at quando updated_at falta", () => {
    expect(
      normalizeReelStudioRow({
        id: "reel-2",
        title: "Sem update",
        cover_image_url: null,
        updated_at: null,
        created_at: "2026-06-01T00:00:00.000Z",
      }).publishedAt
    ).toBe("2026-06-01T00:00:00.000Z");
  });
});

describe("agregação", () => {
  const items: ProfileContentItem[] = [
    normalizeInstagramRow(igOwnedById),
    normalizeInstagramRow(igOwnedByJson),
    normalizeLinkedinRow(liLinked, new Map([["ig-1", "https://cdn.exemplo.com/ig-1.jpg"]])),
    normalizeLinkedinRow(liByline),
    normalizeReelStudioRow(reelRow),
  ];

  it("remove Instagram duplicado quando LinkedIn aponta para o mesmo post", () => {
    const deduped = dedupeLinkedInstagram(items, new Set(["ig-1"]));
    expect(deduped.find((item) => item.key === "instagram:ig-1")).toBeUndefined();
    expect(deduped.find((item) => item.key === "linkedin:li-1")).toBeDefined();
  });

  it("ordena do mais novo para o mais antigo", () => {
    const result = aggregateProfileContentItems(items, {
      hiddenKeys: new Set(),
      limit: 10,
      linkedinInstagramIds: new Set(["ig-1"]),
    });
    expect(result.map((item) => item.key)).toEqual([
      "reel_studio:reel-1",
      "linkedin:li-1",
      "instagram:ig-2",
      "linkedin:li-2",
    ]);
  });

  it("remove itens ocultos antes do limite", () => {
    const result = aggregateProfileContentItems(items, {
      hiddenKeys: new Set(["reel_studio:reel-1", "linkedin:li-1"]),
      limit: 2,
      linkedinInstagramIds: new Set(["ig-1"]),
    });
    expect(result.map((item) => item.key)).toEqual(["instagram:ig-2", "linkedin:li-2"]);
  });

  it("respeita o máximo de itens visíveis", () => {
    const result = aggregateProfileContentItems(items, {
      hiddenKeys: new Set(),
      limit: 3,
      linkedinInstagramIds: new Set(["ig-1"]),
    });
    expect(result).toHaveLength(3);
    expect(result[0].key).toBe("reel_studio:reel-1");
  });
});

type QueryResult = { data: unknown[] | null; error: { message: string } | null };

function createSupabaseStub(handlers: {
  instagramBySolicitante?: () => QueryResult | Promise<QueryResult>;
  instagramByContains?: () => QueryResult | Promise<QueryResult>;
  linkedin?: () => QueryResult | Promise<QueryResult>;
  reels?: () => QueryResult | Promise<QueryResult>;
}): SupabaseClient {
  const resolve = async (
    factory: (() => QueryResult | Promise<QueryResult>) | undefined,
    fallback: QueryResult
  ): Promise<QueryResult> => {
    if (!factory) return fallback;
    return factory();
  };

  const client = {
    from(table: string) {
      if (table === "instagram_posts") {
        let mode: "solicitante" | "contains" = "solicitante";
        const builder = {
          select() {
            return builder;
          },
          eq() {
            mode = "solicitante";
            return builder;
          },
          contains() {
            mode = "contains";
            return builder;
          },
          order() {
            return builder;
          },
          limit() {
            return mode === "contains"
              ? resolve(handlers.instagramByContains, { data: [], error: null })
              : resolve(handlers.instagramBySolicitante, { data: [], error: null });
          },
        };
        return builder;
      }

      if (table === "linkedin_posts") {
        const builder = {
          select() {
            return builder;
          },
          or() {
            return builder;
          },
          order() {
            return builder;
          },
          limit() {
            return resolve(handlers.linkedin, { data: [], error: null });
          },
        };
        return builder;
      }

      if (table === "reel_studio_items") {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          order() {
            return builder;
          },
          limit() {
            return resolve(handlers.reels, { data: [], error: null });
          },
        };
        return builder;
      }

      throw new Error(`tabela inesperada: ${table}`);
    },
  };

  return client as unknown as SupabaseClient;
}

describe("listRecentProfessionalContent", () => {
  it("agrega apenas Instagram com chave estável e limite", async () => {
    const supabase = createSupabaseStub({
      instagramBySolicitante: () => ({ data: [igOwnedById], error: null }),
      instagramByContains: () => ({ data: [igOwnedByJson], error: null }),
      linkedin: () => ({ data: [liLinked, liByline], error: null }),
      reels: () => ({ data: [reelRow], error: null }),
    });

    const result = await listRecentProfessionalContent(supabase, {
      userId: USER_ID,
      userName: USER_NAME,
      hiddenKeys: new Set(),
      limit: 3,
    });

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.key)).toEqual([
      "instagram:ig-1",
      "instagram:ig-2",
    ]);
    expect(result.every((item) => item.sourceType === "instagram")).toBe(true);
  });

  it("ignora LinkedIn e Reel Studio mesmo quando disponíveis", async () => {
    const supabase = createSupabaseStub({
      instagramBySolicitante: () => ({ data: [igOwnedById], error: null }),
      instagramByContains: () => ({ data: [], error: null }),
      linkedin: () => ({ data: [liLinked], error: null }),
      reels: () => ({ data: [reelRow], error: null }),
    });

    const result = await listRecentProfessionalContent(supabase, {
      userId: USER_ID,
      userName: USER_NAME,
      hiddenKeys: new Set(),
      limit: 5,
    });

    expect(result.map((item) => item.key)).toEqual(["instagram:ig-1"]);
  });

  it("ignora override oculto antes do limite", async () => {
    const supabase = createSupabaseStub({
      instagramBySolicitante: () => ({ data: [igOwnedById, igOwnedByJson], error: null }),
      instagramByContains: () => ({ data: [], error: null }),
      linkedin: () => ({ data: [liByline], error: null }),
      reels: () => ({ data: [reelRow], error: null }),
    });

    const result = await listRecentProfessionalContent(supabase, {
      userId: USER_ID,
      userName: USER_NAME,
      hiddenKeys: new Set(["instagram:ig-1"]),
      limit: 2,
    });

    expect(result.map((item) => item.key)).toEqual(["instagram:ig-2"]);
  });

  it("propaga falha quando o Instagram não responde", async () => {
    const supabase = createSupabaseStub({
      instagramBySolicitante: () => ({ data: null, error: { message: "boom" } }),
      instagramByContains: () => ({ data: null, error: { message: "boom" } }),
      linkedin: () => ({ data: [liByline], error: null }),
      reels: () => ({ data: [reelRow], error: null }),
    });

    await expect(
      listRecentProfessionalContent(supabase, {
        userId: USER_ID,
        userName: USER_NAME,
        hiddenKeys: new Set(),
        limit: 5,
      })
    ).rejects.toThrow();
  });

  it("consulta apenas instagram_posts", async () => {
    const fromSpy = vi.fn();
    const supabase = createSupabaseStub({
      instagramBySolicitante: () => ({ data: [], error: null }),
      instagramByContains: () => ({ data: [], error: null }),
      linkedin: () => ({ data: [], error: null }),
      reels: () => ({ data: [], error: null }),
    });
    const originalFrom = supabase.from.bind(supabase);
    (supabase as { from: typeof supabase.from }).from = ((table: string) => {
      fromSpy(table);
      return originalFrom(table);
    }) as typeof supabase.from;

    await listRecentProfessionalContent(supabase, {
      userId: USER_ID,
      userName: USER_NAME,
      hiddenKeys: new Set(),
      limit: 3,
    });

    expect(fromSpy).not.toHaveBeenCalledWith("content_roteiros");
    expect(fromSpy).not.toHaveBeenCalledWith("linkedin_posts");
    expect(fromSpy).not.toHaveBeenCalledWith("reel_studio_items");
    expect(fromSpy.mock.calls.map((call) => call[0]).sort()).toEqual([
      "instagram_posts",
      "instagram_posts",
    ]);
  });
});
