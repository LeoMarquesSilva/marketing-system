import { describe, expect, it } from "vitest";
import {
  contentRoteiroWordHref,
  contentRoteiroWordPublicUrl,
  parseContentRoteiroWordId,
} from "@/lib/content-word";

const id = "7c730d69-a82a-4f60-a1ed-c53feddccd85";

describe("content roteiro word URL", () => {
  it("grava o domínio público, nunca o host da Vercel", () => {
    expect(contentRoteiroWordPublicUrl(id)).toBe(
      `https://orqestrai.com.br/api/content-roteiros/word?id=${id}`
    );
    expect(contentRoteiroWordPublicUrl(id)).not.toContain("vercel.app");
  });

  it("expõe um caminho same-origin para o download autenticado", () => {
    expect(contentRoteiroWordHref(id)).toBe(
      `/api/content-roteiros/word?id=${id}`
    );
  });

  it("reconhece o id mesmo quando o card guardou um host antigo", () => {
    expect(
      parseContentRoteiroWordId(
        `https://marketing-system-xi.vercel.app/api/content-roteiros/word?id=${id}`
      )
    ).toBe(id);
    expect(
      parseContentRoteiroWordId(
        `https://www.orqestrai.com.br/api/content-roteiros/word?id=${id}`
      )
    ).toBe(id);
    expect(
      parseContentRoteiroWordId(`/api/content-roteiros/word?id=${id}`)
    ).toBe(id);
  });

  it("ignora links que não são o Word do módulo de conteúdos", () => {
    expect(parseContentRoteiroWordId("https://news.google.com/rss/articles/abc")).toBeNull();
    expect(parseContentRoteiroWordId(null)).toBeNull();
  });
});
