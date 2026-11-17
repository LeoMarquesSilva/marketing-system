import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TextoSintese } from "./texto-sintese";

// Dados fictícios (o repositório é público).
const TEXTO = [
  "Texto da equipe <b>sem</b> formatação.",
  "",
  "17/11/2026 (IA, leitura dos autos):",
  "Resumo",
  "Empresa Alfa cobra R$ 1.234,56 de Comércio Beta.",
  "Andamento",
  "05/02/2024: Distribuição (p. 1)",
  "Situação atual",
  "Aguarda citação.",
  "Pontos de atenção",
  "Devedor não localizado.",
].join("\n");

describe("TextoSintese", () => {
  it("mostra títulos, linha do tempo, selo da IA e o bloco de atenção", () => {
    const html = renderToStaticMarkup(<TextoSintese texto={TEXTO} />);
    for (const titulo of ["Resumo", "Andamento", "Situação atual", "Pontos de atenção"]) expect(html).toContain(`>${titulo}</h4>`);
    expect(html).toContain("Leitura dos autos · 17/11/2026");
    expect(html).toContain("05/02/2024</span>");
    expect(html).toContain(">p. 1</span>");
    expect(html).toMatch(/<mark[^>]*>R\$ 1\.234,56<\/mark>/);
    expect(html).toContain("bg-amber-50");
  });

  it("trata o texto como dado: marcação do texto sai escapada", () => {
    const html = renderToStaticMarkup(<TextoSintese texto={TEXTO} />);
    expect(html).toContain("&lt;b&gt;sem&lt;/b&gt;");
    expect(html).not.toContain("<b>");
  });

  it("recolhe texto longo com Ver tudo só quando pedido", () => {
    expect(renderToStaticMarkup(<TextoSintese texto={TEXTO} recolher />)).toContain("Ver tudo");
    expect(renderToStaticMarkup(<TextoSintese texto={TEXTO} />)).not.toContain("Ver tudo");
    expect(renderToStaticMarkup(<TextoSintese texto="Curto." recolher />)).not.toContain("Ver tudo");
  });
});
