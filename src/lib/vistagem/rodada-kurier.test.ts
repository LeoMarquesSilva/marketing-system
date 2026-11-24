import { describe, expect, it } from "vitest";
import { etapasComErro, resumoDaRodada, type EtapasDaRodada } from "./rodada-kurier";

const rodadaDeHoje: EtapasDaRodada = {
  pastasVios: { pastas: 35109 },
  central: { pendentes: 0, enviadas: 0, erros: 0 },
  bkp: { ligado: true, gravadas: 1204, faltavam: 0 },
  sugestoesPasta: { pendentes: 0, geradas: 0, porNumero: 0, porParte: 0, porIa: 0, erros: 0, custoUS: 0 },
  sugestoesIa: { pendentes: 28, geradas: 28, erros: 0, custoUS: 0.0055 },
  envios: { consultadas: 0, concluidas: 0, erros: 0, checadasSozinhas: 0 },
};

describe("resumo da rodada da Kurier", () => {
  it("conta o que a rodada fez, como a de 23/11 rodada à mão", () => {
    expect(resumoDaRodada(rodadaDeHoje)).toBe(
      " Rodada do cron: 35.109 pastas do VIOS atualizadas, 28 sugestão(ões) da IA e BKP do SIOE conferido."
    );
  });

  it("aponta cada etapa que falhou, sem esconder as que deram certo", () => {
    const etapas: EtapasDaRodada = { ...rodadaDeHoje, bkp: { erro: "SIOE fora do ar" }, envios: { erro: "SAMA 503" } };
    expect(etapasComErro(etapas)).toEqual(["BKP do SIOE (SIOE fora do ar)", "envios ao robô (SAMA 503)"]);
    expect(resumoDaRodada(etapas)).toBe(
      " Rodada do cron: 35.109 pastas do VIOS atualizadas e 28 sugestão(ões) da IA. Falhou: BKP do SIOE (SIOE fora do ar); envios ao robô (SAMA 503)."
    );
  });

  it("mostra sugestões de pasta, aberturas reenviadas e envios concluídos quando houver", () => {
    const etapas: EtapasDaRodada = {
      ...rodadaDeHoje,
      bkp: { ligado: false, gravadas: 0, faltavam: 0 },
      sugestoesPasta: { pendentes: 2, geradas: 2, porNumero: 1, porParte: 1, porIa: 0, erros: 0, custoUS: 0 },
      sugestoesIa: { pendentes: 3, geradas: 1, erros: 2, custoUS: 0.001 },
      central: { pendentes: 2, enviadas: 1, erros: 1 },
      envios: { consultadas: 4, concluidas: 3, erros: 0, checadasSozinhas: 1 },
    };
    expect(resumoDaRodada(etapas)).toBe(
      " Rodada do cron: 35.109 pastas do VIOS atualizadas, 1 sugestão(ões) da IA, 2 sugestão(ões) da IA com erro (a tela gera ao abrir), 2 sugestão(ões) de pasta, 1 abertura(s) de pasta reenviada(s) à Central, 1 abertura(s) de pasta ainda sem a Central e 3 envio(s) ao robô concluído(s)."
    );
  });

  it("fica vazio quando a resposta não traz a rodada (resposta antiga)", () => {
    expect(resumoDaRodada({})).toBe("");
    expect(etapasComErro({})).toEqual([]);
  });
});
