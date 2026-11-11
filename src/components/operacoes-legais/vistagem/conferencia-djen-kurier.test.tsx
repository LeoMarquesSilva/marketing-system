import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ConferenciaDjenKurier } from "@/lib/vistagem/djen-kurier";
import { ConferenciaDjenKurierView } from "./conferencia-djen-kurier";

const DADOS: ConferenciaDjenKurier = {
  dias: [
    {
      data: "2026-11-11",
      buscado: true,
      djen: 3,
      kurier: 2,
      nosDois: 1,
      soDjen: [
        {
          id: 777,
          data: "2026-11-11",
          processo: "0000379-29.2019.5.12.0029",
          tribunal: "TRT12",
          tipo: "Lista de distribuição",
          orgao: "Gab. Des. Marcos",
          classe: null,
          advogados: ["275477/SP", "353389/SP"],
          ativo: true,
          link: "https://comunica.pje.jus.br/x",
        },
      ],
      soKurier: [
        { id: "k9", djenId: 999, data: "2026-11-11", processo: "5555555-55.2026.5.02.0001", tribunal: "TRT2", nomeLocalizado: "RICARDO VISCARDI PIRES", status: "descartada" },
      ],
      cobertura: 0.5,
    },
    { data: "2026-11-10", buscado: false, djen: 0, kurier: 4, nosDois: 0, soDjen: [], soKurier: [], cobertura: null },
  ],
  totais: { djen: 3, kurier: 2, nosDois: 1, soDjen: 1, soKurier: 1, cobertura: 0.5 },
  ultimaBusca: { em: "2026-11-11T11:00:00.000Z", origem: "cron", erro: null },
};

const tela = (props: Partial<Parameters<typeof ConferenciaDjenKurierView>[0]> = {}) =>
  renderToStaticMarkup(
    <ConferenciaDjenKurierView
      dados={DADOS}
      erro=""
      periodo="14"
      onPeriodo={vi.fn()}
      buscando={false}
      onBuscarAgora={vi.fn()}
      aberto={null}
      onAbrir={vi.fn()}
      {...props}
    />
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

describe("ConferenciaDjenKurierView", () => {
  it("mostra a cobertura, os totais, o quadro por dia e a última busca", () => {
    const texto = tela();
    expect(texto).toContain("Conferência DJEN × Kurier");
    expect(texto).toContain("Não muda nada no fluxo das publicações");
    expect(texto).toContain("Gustavo Bismarchi Motta (OAB 275477/SP)");
    expect(texto).toContain("Ricardo Viscardi Pires (OAB 353389/SP)");
    expect(texto).toContain("50%");
    expect(texto).toContain("1 de 2 publicações da Kurier também no DJEN");
    expect(texto).toContain("11/nov qua");
    expect(texto).toContain("sem busca no DJEN");
    expect(texto).toContain("automática");
  });

  it("o dia aberto lista o que ficou só de um lado", () => {
    const texto = tela({ aberto: "2026-11-11" });
    expect(texto).toContain("Só na Kurier · o DJEN não trouxe (1)");
    expect(texto).toContain("5555555-55.2026.5.02.0001");
    expect(texto).toContain("RICARDO VISCARDI PIRES");
    expect(texto).toContain("Descartada");
    expect(texto).toContain("Só no DJEN · a Kurier não trouxe (1)");
    expect(texto).toContain("GBM + RVP");
  });

  it("enquanto carrega e com erro", () => {
    expect(tela({ dados: null })).toContain("Comparando o DJEN com a Kurier");
    expect(tela({ dados: null, erro: "Falha ao carregar a conferência." })).toContain("Falha ao carregar a conferência.");
  });
});
