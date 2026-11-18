import { describe, expect, it } from "vitest";
import type { InstagramPost } from "@/lib/instagram-posts";
import { parseCarousel } from "@/lib/content-word";
import {
  captionHeadline,
  collaboratorHintForArea,
  computeLearningStats,
  isLearningStale,
  isWeakSource,
  learningBlockForArea,
  type LearningSnapshot,
} from "./learning";
import { buildCarouselPrompt, buildRelevancePrompt, carouselStructure } from "./prompt";
import { DEFAULT_CTA, DEFAULT_VOICE, settingsFromRow, settingsToRow } from "./settings";

function post(partial: Partial<InstagramPost> & { id: string }): InstagramPost {
  return {
    ig_media_id: partial.id,
    caption: "Legenda",
    media_type: "CAROUSEL_ALBUM",
    media_url: null,
    thumbnail_url: null,
    permalink: null,
    published_at: "2026-10-01T10:00:00.000Z",
    area: null,
    areas: [],
    solicitante_id: null,
    solicitante: null,
    solicitantes: [],
    skip_participants: false,
    tags: [],
    likes: 0,
    comments: 0,
    reach: 100,
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
    ...partial,
  } as InstagramPost;
}

describe("aprendizado do gerador", () => {
  it("separa por área e formato e ordena os melhores posts pelo engajamento", () => {
    const stats = computeLearningStats({
      posts: [
        post({ id: "a", area: "Cível", likes: 10, caption: "STJ muda regra\nresto", reach: 100 }),
        post({ id: "b", area: "Cível", likes: 2, reach: 100 }),
        post({ id: "c", area: "Trabalhista", media_type: "VIDEO", likes: 5, reach: 100 }),
        post({ id: "d", area: "Institucional", likes: 50, reach: 100 }),
        post({ id: "sem-alcance", area: "Cível", likes: 99, reach: 0 }),
      ],
      roteiros: [
        { id: "r1", topic_id: "t1", title: "x", area: "Cível", status: "em_revisao", created_at: "2026-11-01", approved_by_id: "u" },
        { id: "r2", topic_id: "t1", title: "y", area: "Cível", status: "rejeitado", created_at: "2026-11-01" },
        ...Array.from({ length: 30 }, (_, index) => ({
          id: `f${index}`,
          topic_id: "t2",
          title: "z",
          area: "Trabalhista",
          status: "aguardando_aprovacao",
          created_at: "2026-11-01",
        })),
      ],
      topics: [
        { id: "t1", name: "Cível", legal_area: "Cível", is_active: true },
        { id: "t2", name: "Feed fraco", legal_area: "Geral", is_active: true },
      ],
      edits: 2,
    });

    const civel = stats.areas.find((area) => area.area === "Cível")!;
    expect(civel.posts).toBe(2);
    expect(civel.top[0]).toMatchObject({ headline: "STJ muda regra", engagementRate: 10 });
    expect(civel).toMatchObject({ generated: 2, chosen: 1, rejected: 1 });
    // Institucional não entra em nenhuma área jurídica, mas conta no total.
    expect(stats.totals.posts).toBe(4);
    expect(stats.formats.map((format) => format.format)).toEqual(["Carrossel", "Reels"]);
    expect(stats.sources[0]).toMatchObject({ name: "Cível", chooseRate: 50 });
    expect(isWeakSource(stats.sources[1])).toBe(true);
  });

  it("pega a primeira linha útil da legenda como gancho", () => {
    expect(captionHeadline("\n\n  Fim da escala 6x1?  \nTexto")).toBe("Fim da escala 6x1?");
    // A linha padrão dos carrosséis e linhas só de emoji não contam como gancho.
    expect(captionHeadline("🕑 Tempo de leitura: 2 minutos\n✨✨\nSTF muda regra da RJ")).toBe("STF muda regra da RJ");
    expect(captionHeadline("x".repeat(200), 20)).toHaveLength(20);
  });

  it("refaz o aprendizado depois de 7 dias", () => {
    const now = new Date("2026-11-18T12:00:00.000Z");
    expect(isLearningStale(null, now)).toBe(true);
    expect(isLearningStale({ createdAt: "2026-11-15T12:00:00.000Z" }, now)).toBe(false);
    expect(isLearningStale({ createdAt: "2026-11-10T12:00:00.000Z" }, now)).toBe(true);
  });

  it("monta o bloco da área com o que engaja, as correções da equipe e o que evitar", () => {
    const snapshot = {
      id: "s",
      createdAt: "2026-11-18T12:00:00.000Z",
      trigger: "manual",
      createdByName: null,
      postsAnalyzed: 10,
      choicesAnalyzed: 5,
      editsAnalyzed: 2,
      stats: { windowDays: 365, totals: { posts: 10, engagementRate: 6, choices: 5, rejections: 0, edits: 2 }, formats: [], areas: [], sources: [] },
      playbook: {
        resumo: "r",
        geral: { oQueEngaja: ["Decisões de tribunal superior"], ganchos: ["Pergunta direta na capa"], evitar: ["Release corporativo"], formato: "Carrossel" },
        areas: [{ area: "Cível", oQueEngaja: ["Direito do consumidor"], temasPromissores: ["Seguros"], ganchos: [], evitar: ["Crimes"] }],
        preferenciasDaEquipe: ["Matérias com impacto em empresas"],
        edicoesDaEquipe: ["Títulos mais curtos"],
        fontes: [],
      },
    } satisfies LearningSnapshot;

    const block = learningBlockForArea(snapshot, "Cível");
    expect(block).toContain("Direito do consumidor");
    expect(block).toContain("Títulos mais curtos");
    expect(block).toContain("- Release corporativo\n- Crimes");
    expect(learningBlockForArea(null, "Cível")).toBe("");
    expect(collaboratorHintForArea(snapshot, "Cível")).toBe("No nosso Instagram, em Cível: Direito do consumidor");
    expect(collaboratorHintForArea(snapshot, "Trabalhista")).toBeNull();
  });
});

describe("prompts do gerador", () => {
  it("respeita o número de slides e continua no formato que a tela lê", () => {
    const structure = carouselStructure(6, "Fale com a gente.");
    const slides = parseCarousel(structure);
    expect(slides).toHaveLength(6);
    expect(slides[0].heading).toBe("Slide de Capa");
    expect(slides.at(-1)?.heading).toBe("Slide Final");
    expect(structure).toContain("Fale com a gente.");
  });

  it("usa os padrões quando os campos estão vazios e prioriza o pedido do revisor", () => {
    const prompt = buildCarouselPrompt({
      title: "Título",
      snippet: "Resumo",
      link: "https://x",
      area: "Cível",
      settings: settingsFromRow(null),
      learningBlock: "APRENDIZADO",
      extraInstruction: "mais curto",
    });
    expect(prompt).toContain(DEFAULT_VOICE);
    expect(prompt).toContain(DEFAULT_CTA);
    expect(prompt).toContain("exatamente 5 slides");
    expect(prompt).toContain("APRENDIZADO");
    expect(prompt.trim().endsWith("mais curto")).toBe(true);
  });

  it("a nota de potencial leva área, fonte e aprendizado", () => {
    const prompt = buildRelevancePrompt({ title: "T", snippet: "", area: "Trabalhista", sourceName: "JOTA", learningBlock: "APRENDIZADO" });
    expect(prompt).toContain("Área: Trabalhista");
    expect(prompt).toContain("Fonte: JOTA");
    expect(prompt).toContain("(sem resumo)");
    expect(prompt).toContain("APRENDIZADO");
  });
});

describe("configurações do gerador", () => {
  it("limita os números ao que a tabela aceita", () => {
    expect(settingsToRow({ slideCount: 40, minRelevance: -2, maxPerRun: 0 })).toEqual({ slide_count: 10, min_relevance: 0, max_per_run: 1 });
    expect(settingsFromRow({ slide_count: null, min_relevance: 7 })).toMatchObject({ slideCount: 5, minRelevance: 7, useLearning: true });
  });
});
