import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ConferenciaDjenKurier } from "@/lib/vistagem/djen-kurier";
import { ConferenciaDjenKurierView } from "./conferencia-djen-kurier";

const DADOS: ConferenciaDjenKurier = {
  dias: [
    // Disponibilizado hoje (12/11): publica amanhã, a Kurier ainda não chegou.
    { data: "2026-11-12", publicacao: "2026-11-13", buscado: true, comKurier: false, emAberto: true, djen: 115, kurier: 0, doBkp: 0, porArquivo: [], nosDois: 0, soDjen: 0, soKurier: 0, cobertura: null },
    // Disponibilizado ontem (11/11): publicado hoje, é o que a Kurier entregou.
    { data: "2026-11-11", publicacao: "2026-11-12", buscado: true, comKurier: true, emAberto: false, djen: 103, kurier: 106, doBkp: 0, porArquivo: [{ arquivo: "2026-11-11", quantas: 53 }, { arquivo: "2026-11-12", quantas: 53 }], nosDois: 101, soDjen: 2, soKurier: 5, cobertura: 101 / 106 },
    { data: "2026-11-08", publicacao: "2026-11-09", buscado: true, comKurier: false, emAberto: false, djen: 0, kurier: 0, doBkp: 0, porArquivo: [], nosDois: 0, soDjen: 0, soKurier: 0, cobertura: null },
    { data: "2026-11-05", publicacao: "2026-11-06", buscado: true, comKurier: true, emAberto: false, djen: 126, kurier: 128, doBkp: 74, porArquivo: [{ arquivo: "2026-11-05", quantas: 52 }, { arquivo: "2026-11-06", quantas: 2 }, { arquivo: "BKP", quantas: 74 }], nosDois: 110, soDjen: 3, soKurier: 18, cobertura: 110 / 128 },
    { data: "2026-10-12", publicacao: "2026-10-13", buscado: false, comKurier: true, emAberto: false, djen: 0, kurier: 4, doBkp: 4, porArquivo: [{ arquivo: "BKP", quantas: 4 }], nosDois: 0, soDjen: 0, soKurier: 0, cobertura: null },
  ],
  totais: { djen: 229, kurier: 234, nosDois: 211, soDjen: 5, soKurier: 23, cobertura: 211 / 234 },
  ultimaBusca: { em: "2026-11-12T11:00:00.000Z", origem: "cron", erro: null },
  erroBkp: null,
};

const tela = (props: Partial<Parameters<typeof ConferenciaDjenKurierView>[0]> = {}) =>
  renderToStaticMarkup(
    <ConferenciaDjenKurierView dados={DADOS} erro="" periodo="tudo" onPeriodo={vi.fn()} buscando={false} onBuscarAgora={vi.fn()} {...props} />
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

describe("ConferenciaDjenKurierView", () => {
  it("mostra a cobertura, os totais e o quadro por dia de publicação", () => {
    const texto = tela();
    expect(texto).toContain("Conferência DJEN × Kurier");
    expect(texto).toContain("Não muda nada no fluxo das publicações");
    expect(texto).toContain("Gustavo Bismarchi Motta (OAB 275477/SP)");
    expect(texto).toContain("Ricardo Viscardi Pires (OAB 353389/SP)");
    expect(texto).toContain("90,2%");
    expect(texto).toContain("211 de 234 publicações da Kurier também no DJEN");
    expect(texto).toContain("Publicação Disponibilizado no DJEN");
    // A linha de hoje (publicação 12/11) traz o que a Kurier entregou hoje, disponibilizado ontem.
    expect(texto).toContain("12/nov qui 11/nov qua 103 106 arq. 11/11: 53 + arq. 12/11: 53 101 5 2");
    // A de amanhã já tem o DJEN de hoje; a Kurier chega amanhã.
    expect(texto).toContain("13/nov sex aguardando a Kurier 12/nov qui 115 — —");
    expect(texto).toContain("128 arq. 05/11: 52 + arq. 06/11: 2 + BKP: 74");
    expect(texto).toContain("sem busca no DJEN");
    expect(texto).toContain("Cada linha é um dia de publicação");
    expect(texto).toContain("Baixar Excel");
    expect(texto).toContain("Desde 01/10");
    expect(texto).toContain("automática");
    expect(texto).not.toContain("Não deu para ler o BKP do SIOE");
  });

  it("dia sem nada nos dois lados não aparece", () => {
    expect(tela()).not.toContain("09/nov seg");
  });

  it("avisa quando não deu para ler o BKP do SIOE", () => {
    expect(tela({ dados: { ...DADOS, erroBkp: "o SIOE não respondeu em 20 segundos" } })).toContain(
      "Não deu para ler o BKP do SIOE (o SIOE não respondeu em 20 segundos)"
    );
  });

  it("enquanto carrega e com erro", () => {
    expect(tela({ dados: null })).toContain("Comparando o DJEN com a Kurier");
    const comErro = tela({ dados: null, erro: "A conferência demorou mais de 1 minuto para responder. Tente de novo em instantes." });
    expect(comErro).toContain("demorou mais de 1 minuto");
    expect(comErro).not.toContain("Comparando o DJEN com a Kurier");
  });
});
