import { describe, expect, it } from "vitest";
import {
  computeTeamMemberStats,
  orderSlideMedia,
  personInAreas,
  pickSlideMediaIds,
  resolveTeamAreaOptions,
  resolveTeamPostsAccess,
  scopeTeamPosts,
  teamAreaKey,
  type TeamPerson,
  type TeamPostsAccessInput,
} from "@/lib/team-posts/domain";
import type { InstagramPost } from "@/lib/instagram-posts";

const base: TeamPostsAccessInput = {
  isActive: true,
  role: null,
  permissions: ["/conteudo/roteiros"],
  accessMode: "auto",
  areaScope: null,
  position: "Advogado Pleno",
  department: "Trabalhista",
};

function post(overrides: Partial<InstagramPost> = {}): InstagramPost {
  return {
    id: "post-1",
    ig_media_id: "ig-1",
    caption: null,
    media_type: "IMAGE",
    media_url: null,
    thumbnail_url: null,
    permalink: null,
    published_at: "2026-09-10T12:00:00.000Z",
    area: null,
    areas: [],
    solicitante_id: null,
    solicitante: null,
    solicitantes: [],
    skip_participants: false,
    tags: [],
    likes: 0,
    comments: 0,
    reach: 0,
    views: 0,
    saves: 0,
    shares: 0,
    total_interactions: 0,
    media_product_type: null,
    follows: 0,
    profile_visits: 0,
    reposts: 0,
    profile_activity: 0,
    link_clicks: 0,
    reels_avg_watch_time: 0,
    reels_total_watch_time: 0,
    synced_at: "2026-09-10T12:00:00.000Z",
    created_at: "2026-09-10T12:00:00.000Z",
    ...overrides,
  };
}

const ana: TeamPerson = { id: "ana", name: "Ana", avatar_url: null, area: "Trabalhista" };
const bruno: TeamPerson = { id: "bruno", name: "Bruno", avatar_url: null, area: "Trabalhista" };

describe("resolveTeamPostsAccess", () => {
  it("nega colaborador sem liderança e perfil inativo", () => {
    expect(resolveTeamPostsAccess(base)).toEqual({ allowed: false, areas: [] });
    expect(resolveTeamPostsAccess({ ...base, isActive: false, role: "admin" }).allowed).toBe(false);
  });

  it("libera a área de quem lidera por cargo no RH", () => {
    expect(resolveTeamPostsAccess({ ...base, position: "Sócio de Área" })).toEqual({
      allowed: true,
      areas: ["Trabalhista"],
    });
    expect(resolveTeamPostsAccess({ ...base, position: "Coordenador", department: "Insolvência" }).areas)
      .toEqual(["Reestruturação"]);
  });

  it("respeita escopo personalizado e o desligamento em Usuários", () => {
    expect(resolveTeamPostsAccess({
      ...base,
      accessMode: "custom",
      areaScope: ["Recuperação de Crédito", "Trabalhista"],
    }).areas).toEqual(["Recuperação de Crédito", "Trabalhista"]);
    expect(resolveTeamPostsAccess({ ...base, accessMode: "custom", areaScope: ["*"] }).areas).toBeNull();
    expect(resolveTeamPostsAccess({ ...base, position: "Gerente", accessMode: "disabled" }).allowed)
      .toBe(false);
  });

  it("dá todas as áreas ao Marketing e a quem já vê o Instagram Insights", () => {
    expect(resolveTeamPostsAccess({ ...base, role: "admin" }).areas).toBeNull();
    expect(resolveTeamPostsAccess({ ...base, department: "Marketing" }).areas).toBeNull();
    expect(resolveTeamPostsAccess({ ...base, permissions: ["/instagram-insights"] }).areas).toBeNull();
  });

  it("não transforma permissão de RH em visão de Marketing", () => {
    expect(resolveTeamPostsAccess({ ...base, permissions: ["/rh"] }).allowed).toBe(false);
  });
});

describe("teamAreaKey e opções de área", () => {
  it("aproxima nomes legados e agrupados da área do post", () => {
    expect(teamAreaKey("Contratos")).toBe(teamAreaKey("Societário e Contratos"));
    expect(teamAreaKey("Insolvência")).toBe(teamAreaKey("Reestruturação"));
    expect(teamAreaKey("Marketing")).toBe(teamAreaKey("Operações Legais"));
    expect(teamAreaKey("Distressed Deals")).toBe(teamAreaKey("Distressed Deals - Special Situations"));
    expect(teamAreaKey("  ")).toBeNull();
  });

  it("lista só as áreas lideradas, ou as dos posts sem o Institucional", () => {
    expect(resolveTeamAreaOptions({ allowed: true, areas: ["Trabalhista"] }, ["Cível"]))
      .toEqual([{ key: "trabalhista", label: "Trabalhista" }]);
    expect(resolveTeamAreaOptions({ allowed: true, areas: null }, [
      "Institucional",
      "Cível",
      "Contratos",
      "Societário e Contratos",
    ]).map((option) => option.label)).toEqual(["Cível", "Societário e Contratos"]);
  });

  it("reconhece o integrante pela área canônica", () => {
    expect(personInAreas({ area: "Insolvência" }, new Set(["reestruturacao"]))).toBe(true);
    expect(personInAreas({ area: "Cível" }, new Set(["reestruturacao"]))).toBe(false);
  });
});

describe("scopeTeamPosts", () => {
  const posts = [
    post({ id: "area", areas: ["Trabalhista"] }),
    post({ id: "collab", areas: ["Cível"], solicitantes: [{ id: "ana", name: "Ana" }] }),
    post({ id: "outra", areas: ["Cível"], solicitantes: [{ id: "carla", name: "Carla" }] }),
  ];

  it("inclui posts da área e collabs com autor da equipe", () => {
    expect(scopeTeamPosts(posts, new Set(["trabalhista"]), new Set(["ana"])).map((p) => p.id))
      .toEqual(["area", "collab"]);
  });

  it("devolve tudo para quem vê todas as áreas", () => {
    expect(scopeTeamPosts(posts, null, new Set())).toHaveLength(3);
  });
});

describe("computeTeamMemberStats", () => {
  it("soma por autor, conta reels e mantém quem não publicou", () => {
    const rows = computeTeamMemberStats(
      [
        post({
          id: "1",
          media_type: "VIDEO",
          solicitantes: [{ id: "ana", name: "Ana" }],
          reach: 100,
          likes: 8,
          comments: 1,
          saves: 1,
          published_at: "2026-09-01T10:00:00.000Z",
        }),
        post({
          id: "2",
          solicitantes: [{ id: "ana", name: "Ana" }, { id: "fora", name: "Fora" }],
          reach: 100,
          likes: 10,
          published_at: "2026-09-20T10:00:00.000Z",
        }),
      ],
      [bruno, ana]
    );

    expect(rows.map((row) => row.id)).toEqual(["ana", "bruno"]);
    expect(rows[0]).toMatchObject({
      posts: 2,
      reels: 1,
      reach: 200,
      engagementActions: 20,
      engagementRate: 10,
      lastPostAt: "2026-09-20T10:00:00.000Z",
    });
    expect(rows[1]).toMatchObject({ posts: 0, reach: 0, engagementRate: 0, lastPostAt: null });
  });
});

describe("mídias do slide", () => {
  const posts = [
    post({ id: "baixa", reach: 100, likes: 2, published_at: "2026-08-01T10:00:00.000Z" }),
    post({ id: "alta", reach: 100, likes: 9, published_at: "2026-08-24T10:00:00.000Z" }),
    post({ id: "media", reach: 100, likes: 5, published_at: "2026-08-05T10:00:00.000Z" }),
    post({ id: "sem-alcance", reach: 0, likes: 50, published_at: "2026-08-10T10:00:00.000Z" }),
  ];

  it("pré-seleciona as de maior taxa de engajamento, ignorando post sem alcance", () => {
    expect(pickSlideMediaIds(posts, 2)).toEqual(["alta", "media"]);
  });

  it("monta o slide em ordem cronológica", () => {
    expect(orderSlideMedia(posts, ["alta", "baixa", "media"]).map((p) => p.id)).toEqual([
      "baixa",
      "media",
      "alta",
    ]);
  });
});
