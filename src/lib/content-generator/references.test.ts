import { describe, expect, it } from "vitest";
import { parseCarousel } from "@/lib/content-word";
import { buildCarouselPrompt, buildRelevancePrompt, carouselStructure } from "./prompt";
import {
  normalizeUsername,
  referenceEngagement,
  referencesPromptBlock,
  summarizeReferences,
  type ReferenceAccount,
  type ReferencePost,
} from "./references";
import { normalizeAreaGuidelines, settingsFromRow } from "./settings";

const NOW = new Date("2026-11-18T12:00:00.000Z");

const account: ReferenceAccount = {
  id: "a1",
  username: "tozzinifreire",
  displayName: "TozziniFreire Advogados",
  followersCount: 10000,
  mediaCount: 1700,
  profilePictureUrl: null,
  kind: "referencia",
  focusArea: "Geral",
  isActive: true,
  lastSyncedAt: null,
  lastError: null,
};

function post(id: string, likes: number | null, daysAgo: number, caption = `Post ${id}`): ReferencePost {
  return {
    id,
    accountId: "a1",
    caption,
    mediaType: "CAROUSEL_ALBUM",
    mediaProductType: "FEED",
    permalink: null,
    mediaUrl: null,
    publishedAt: new Date(NOW.getTime() - daysAgo * 864e5).toISOString(),
    likeCount: likes,
    commentsCount: 10,
    followersAtSync: 10000,
  };
}

describe("escritórios de referência", () => {
  it("aceita @, link do Instagram ou nome solto", () => {
    expect(normalizeUsername("@TozziniFreire")).toBe("tozzinifreire");
    expect(normalizeUsername("https://www.instagram.com/felsbergadvogados/")).toBe("felsbergadvogados");
  });

  it("engajamento sobre seguidores, e nada quando a conta esconde as curtidas", () => {
    expect(referenceEngagement(post("p", 90, 1))).toBe(1);
    expect(referenceEngagement(post("p", null, 1))).toBeNull();
  });

  it("resume os últimos 90 dias, ordena os melhores e ignora os antigos", () => {
    const [summary] = summarizeReferences(
      [account],
      [post("a", 40, 2), post("b", 190, 10, "STJ define quais aplicações são impenhoráveis\nTexto"), post("velho", 500, 120)],
      90,
      NOW,
    );
    expect(summary.posts).toBe(2);
    expect(summary.top[0].id).toBe("b");
    expect(summary.avgEngagement).toBe(1.3);
    const block = referencesPromptBlock([summary]);
    expect(block).toContain("@tozzinifreire");
    expect(block).toContain("STJ define quais aplicações são impenhoráveis");
    expect(referencesPromptBlock([{ ...summary, posts: 0 }])).toBe("");
  });
});

describe("linha editorial por área", () => {
  const settings = settingsFromRow({
    area_guidelines: { Reestruturação: "Não explique o que é recuperação judicial.", Inventada: "ignorar", Cível: "  " },
  });

  it("guarda só áreas conhecidas e com texto", () => {
    expect(settings.areaGuidelines).toEqual({ Reestruturação: "Não explique o que é recuperação judicial." });
    expect(normalizeAreaGuidelines(null)).toEqual({});
  });

  it("na área com linha própria, usa slides de análise e a linha prevalece", () => {
    const prompt = buildCarouselPrompt({ title: "T", snippet: "S", link: "", area: "Reestruturação", settings });
    expect(prompt).toContain("advogado sênior");
    expect(prompt).toContain("Leitura do caso");
    expect(prompt).toContain("LINHA EDITORIAL DE REESTRUTURAÇÃO");
    expect(prompt).toContain("Não explique o que é recuperação judicial.");
    expect(prompt).not.toContain("Benefícios ou Justificativas");
  });

  it("sem linha própria, segue o molde de sempre", () => {
    const prompt = buildCarouselPrompt({ title: "T", snippet: "S", link: "", area: "Cível", settings });
    expect(prompt).toContain("Benefícios ou Justificativas");
    expect(prompt).not.toContain("LINHA EDITORIAL");
  });

  it("os slides de análise continuam legíveis pela tela", () => {
    expect(parseCarousel(carouselStructure(5, "CTA", true)).map((slide) => slide.heading)).toEqual([
      "Slide de Capa",
      "Slide de Desenvolvimento 1",
      "Slide de Desenvolvimento 2",
      "Slide de Desenvolvimento 3",
      "Slide Final",
    ]);
  });

  it("a nota valoriza notícia que permite conteúdo no nível da linha", () => {
    const prompt = buildRelevancePrompt({ title: "T", snippet: "", area: "Reestruturação", areaGuideline: "Nível especialista." });
    expect(prompt).toContain("LINHA EDITORIAL DE REESTRUTURAÇÃO");
    expect(prompt).toContain("explicação básica");
  });
});
