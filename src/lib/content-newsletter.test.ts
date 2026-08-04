import { describe, expect, it } from "vitest";
import { parseGeneratedSection } from "@/lib/content-newsletter";
import {
  buildNewsletterHtml,
  newsletterWordSlug,
  splitParagraphs,
} from "@/lib/content-newsletter-word";

describe("parse da seção redigida pela IA", () => {
  it("separa título e corpo no formato pedido", () => {
    const parsed = parseGeneratedSection(
      "Título: STJ define que cotas condominiais são créditos extraconcursais\nCorpo: Em julgamento concluído em maio, a Segunda Seção decidiu.\n\nA tese fixada tem impacto direto sobre condomínios."
    );
    expect(parsed.headline).toBe(
      "STJ define que cotas condominiais são créditos extraconcursais"
    );
    expect(parsed.body).toContain("Em julgamento concluído em maio");
    expect(parsed.body).toContain("A tese fixada tem impacto direto");
  });

  it("tolera rótulos em negrito e sem acento", () => {
    const parsed = parseGeneratedSection(
      "**Titulo:** Braskem ajuíza medida cautelar\n**Corpo:** A companhia acumula passivo relevante."
    );
    expect(parsed.headline).toBe("Braskem ajuíza medida cautelar");
    expect(parsed.body).toBe("A companhia acumula passivo relevante.");
  });

  it("usa a primeira linha como título quando o rótulo não vem", () => {
    const parsed = parseGeneratedSection(
      "GPA conclui acordo com credores\nO grupo renegociou dívidas de R$ 4,57 bilhões."
    );
    expect(parsed.headline).toBe("GPA conclui acordo com credores");
    expect(parsed.body).toBe("O grupo renegociou dívidas de R$ 4,57 bilhões.");
  });

  it("não deixa linhas em branco sobrando no corpo", () => {
    const parsed = parseGeneratedSection(
      "Título: Teste\nCorpo: Primeiro parágrafo.\n\n\n\nSegundo parágrafo."
    );
    expect(parsed.body).toBe("Primeiro parágrafo.\n\nSegundo parágrafo.");
  });
});

describe("documento da newsletter", () => {
  const newsletter = {
    title: "Newsletter de Reestruturação e Insolvência",
    edition_label: "1ª Edição | 2026",
    area: "Reestruturação (Insolvência)",
    intro_title: "Nesta edição",
    intro_body: "Panorama do período.",
    signature_names: "Ricardo",
    collaborator_names: "Equipe da área",
    signed_by_name: null,
    signed_at: null,
  };

  const items = [
    {
      headline: "Raízen obtém aprovação de plano",
      body: "Primeiro parágrafo.\n\nSegundo parágrafo.",
      source_link: "https://exemplo.com/raizen",
    },
    {
      headline: "STJ firma tese sobre período suspeito",
      body: "Texto da seção.",
      source_link: null,
    },
  ];

  it("monta sumário com todas as manchetes na ordem recebida", () => {
    const html = buildNewsletterHtml(newsletter, items);
    const sumario = html.slice(html.indexOf("Sumário"), html.indexOf("</ol>"));
    expect(sumario).toContain("Raízen obtém aprovação de plano");
    expect(sumario).toContain("STJ firma tese sobre período suspeito");
    expect(sumario.indexOf("Raízen")).toBeLessThan(sumario.indexOf("STJ"));
  });

  it("inclui abertura, assinatura e aviso legal", () => {
    const html = buildNewsletterHtml(newsletter, items);
    expect(html).toContain("Nesta edição");
    expect(html).toContain("Responsáveis pelo conteúdo");
    expect(html).toContain("Ricardo");
    expect(html).toContain("Colaborou para esta newsletter");
    expect(html).toContain("não constitui parecer ou aconselhamento jurídico");
  });

  it("escapa HTML vindo do texto editado", () => {
    const html = buildNewsletterHtml(newsletter, [
      { headline: "<script>alert(1)</script>", body: "ok", source_link: null },
    ]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("omite a assinatura quando não há responsáveis definidos", () => {
    const html = buildNewsletterHtml(
      { ...newsletter, signature_names: null, collaborator_names: null },
      items
    );
    expect(html).not.toContain("Responsáveis pelo conteúdo");
    expect(html).toContain("não constitui parecer ou aconselhamento jurídico");
  });

  it("quebra o corpo em parágrafos com uma ou duas quebras de linha", () => {
    expect(splitParagraphs("um\n\ndois\ntrês")).toEqual(["um", "dois", "três"]);
    expect(splitParagraphs("")).toEqual([]);
  });

  it("gera nome de arquivo sem acento nem espaço", () => {
    expect(newsletterWordSlug("Newsletter de Reestruturação e Insolvência")).toBe(
      "newsletter-de-reestruturacao-e-insolvencia"
    );
    expect(newsletterWordSlug("")).toBe("newsletter");
  });
});
