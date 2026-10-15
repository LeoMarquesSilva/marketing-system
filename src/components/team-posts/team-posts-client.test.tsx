import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamPostsClient } from "./team-posts-client";
import type { InstagramPost } from "@/lib/instagram-posts";

function post(overrides: Partial<InstagramPost>): InstagramPost {
  return {
    id: "post-1",
    ig_media_id: "ig-1",
    caption: "Reforma trabalhista em pauta",
    media_type: "IMAGE",
    media_url: null,
    thumbnail_url: null,
    permalink: "https://www.instagram.com/p/abc",
    published_at: "2026-09-10T12:00:00.000Z",
    area: "Trabalhista",
    areas: ["Trabalhista"],
    solicitante_id: null,
    solicitante: null,
    solicitantes: [{ id: "ana", name: "Ana Souza" }],
    skip_participants: false,
    tags: [],
    likes: 40,
    comments: 5,
    reach: 1000,
    views: 1500,
    saves: 5,
    shares: 2,
    total_interactions: 52,
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

describe("TeamPostsClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00-03:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("explica o acesso negado em vez de mostrar dados", () => {
    const html = renderToStaticMarkup(<TeamPostsClient data={{ status: "denied" }} />);
    expect(html).toContain("Sem acesso às postagens da equipe");
    expect(html).toContain("liderança por área em Usuários");
  });

  it("mostra a equipe do líder, inclusive quem não publicou no período", () => {
    const html = renderToStaticMarkup(
      <TeamPostsClient
        data={{
          status: "ready",
          allAreas: false,
          areaOptions: [{ key: "trabalhista", label: "Trabalhista" }],
          members: [
            { id: "ana", name: "Ana Souza", avatar_url: null, area: "Trabalhista" },
            { id: "bruno", name: "Bruno Lima", avatar_url: null, area: "Trabalhista" },
          ],
          posts: [post({}), post({ id: "post-2", ig_media_id: "ig-2", media_type: "VIDEO", published_at: "2025-03-01T12:00:00.000Z" })],
          office: [
            { published_at: "2026-09-10T12:00:00.000Z", reach: 1000, engagementActions: 50 },
            { published_at: "2026-08-10T12:00:00.000Z", reach: 1000, engagementActions: 10 },
          ],
          accountStats: null,
        }}
      />
    );

    expect(html).toContain("Equipe (2)");
    expect(html).toContain("1 de 2");
    expect(html).toContain("Sem posts no período");
    expect(html).toContain("Escritório no período: 3,00%");
    expect(html).toContain("Relatório (Excel)");
    expect(html).toContain("Todos os posts (1)");
    expect(html).toContain("Mídias para o PPT");
    expect(html).toContain("Copiar imagem");
    expect(html).toContain("1 de 1 selecionada");
    // Uma área só: sem seletor de áreas.
    expect(html).not.toContain("Todas as minhas áreas");
  });

  it("oferece filtro de área quando a pessoa lidera mais de uma", () => {
    const html = renderToStaticMarkup(
      <TeamPostsClient
        data={{
          status: "ready",
          allAreas: false,
          areaOptions: [
            { key: "recuperacao de credito", label: "Recuperação de Crédito" },
            { key: "trabalhista", label: "Trabalhista" },
          ],
          members: [],
          posts: [],
          office: [],
          accountStats: null,
        }}
      />
    );
    expect(html).toContain("Todas as minhas áreas");
    expect(html).toContain("Recuperação de Crédito");
    expect(html).toContain("Nenhum colaborador ativo encontrado nesta área.");
    expect(html).toContain("Nenhum post da equipe no período selecionado.");
    expect(html).toContain("Nenhuma mídia da equipe no período selecionado.");
  });
});
