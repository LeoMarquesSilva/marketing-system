import { describe, expect, it } from "vitest";
import { manualLinkSchema } from "@/lib/content-manual-link";
import { extractArticleTitle } from "@/lib/content-extraction";

describe("validação do link colado", () => {
  it("aceita http e https", () => {
    expect(manualLinkSchema.safeParse({ url: "https://valor.globo.com/noticia" }).success).toBe(true);
    expect(manualLinkSchema.safeParse({ url: "http://conjur.com.br/x" }).success).toBe(true);
  });

  it("apara espaços em volta do link colado", () => {
    const parsed = manualLinkSchema.parse({ url: "  https://exemplo.com/noticia  " });
    expect(parsed.url).toBe("https://exemplo.com/noticia");
  });

  it("rejeita link vazio", () => {
    expect(manualLinkSchema.safeParse({ url: "" }).success).toBe(false);
    expect(manualLinkSchema.safeParse({ url: "   " }).success).toBe(false);
  });

  it("rejeita texto que não é URL", () => {
    expect(manualLinkSchema.safeParse({ url: "não é link" }).success).toBe(false);
    expect(manualLinkSchema.safeParse({ url: "www.exemplo.com" }).success).toBe(false);
  });

  it("rejeita esquemas que o servidor não deve buscar", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "file:///etc/passwd",
    ]) {
      expect(manualLinkSchema.safeParse({ url }).success, url).toBe(false);
    }
  });
});

describe("extração do título da notícia", () => {
  it("prefere og:title", () => {
    const html = `
      <head>
        <title>Outro texto — Veículo</title>
        <meta property="og:title" content="Reforma tributária muda regras do split payment" />
      </head>`;
    expect(extractArticleTitle(html)).toBe("Reforma tributária muda regras do split payment");
  });

  it("aceita og:title com atributos na ordem inversa", () => {
    const html = `<meta content="STJ decide sobre recuperação judicial" property="og:title" />`;
    expect(extractArticleTitle(html)).toBe("STJ decide sobre recuperação judicial");
  });

  it("cai para twitter:title", () => {
    const html = `<meta name="twitter:title" content="Nova súmula sobre contratos bancários" />`;
    expect(extractArticleTitle(html)).toBe("Nova súmula sobre contratos bancários");
  });

  it("cai para <title> quando não há meta", () => {
    const html = `<head><title>Tribunal fixa tese sobre honorários de sucumbência</title></head>`;
    expect(extractArticleTitle(html)).toBe("Tribunal fixa tese sobre honorários de sucumbência");
  });

  it("remove o sufixo do veículo do <title>", () => {
    const html = `<title>Reforma trabalhista completa oito anos - Valor Econômico</title>`;
    expect(extractArticleTitle(html)).toBe("Reforma trabalhista completa oito anos");
  });

  it("não corta quando o que sobraria é curto demais para ser título", () => {
    const html = `<title>STJ - Notícias do Superior Tribunal de Justiça</title>`;
    // Cortar deixaria só "STJ", que não é manchete: preserva o texto inteiro.
    expect(extractArticleTitle(html)).toBe("STJ - Notícias do Superior Tribunal de Justiça");
  });

  it("decodifica entidades HTML", () => {
    const html = `<meta property="og:title" content="Cr&eacute;dito &amp; garantias na insolv&#234;ncia" />`;
    const title = extractArticleTitle(html);
    expect(title).toContain("&");
    expect(title).not.toContain("&amp;");
    expect(title).not.toContain("&#234;");
  });

  it("devolve null para HTML sem título", () => {
    expect(extractArticleTitle("<div>sem cabeçalho</div>")).toBeNull();
    expect(extractArticleTitle("")).toBeNull();
  });

  it("normaliza espaços e quebras de linha do <title>", () => {
    const html = `<title>
        Decisão   sobre    penhora
        de faturamento
      </title>`;
    expect(extractArticleTitle(html)).toBe("Decisão sobre penhora de faturamento");
  });
});
