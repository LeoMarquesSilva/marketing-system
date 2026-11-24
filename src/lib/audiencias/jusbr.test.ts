import { describe, expect, it } from "vitest";
import { heranca, jusbrComPje, linhaDoJusbr } from "./jusbr";
import type { Audiencia } from "./tipos";

let seq = 0;
function aud(p: Partial<Audiencia> = {}): Audiencia {
  seq += 1;
  return {
    id: `a${seq}`,
    chave: `pje:TRT15:${seq}`,
    origem: "pje",
    tribunal: "TRT15",
    cnj: "0011887-91.2026.5.15.0077",
    inicio: "2026-12-10T17:05:00.000Z",
    fim: null,
    tipo: "inicial",
    tipoDescricao: null,
    ritoSumarissimo: false,
    modalidadeTribunal: "video",
    modalidadeEquipe: null,
    orgao: null,
    sala: null,
    juizoDigital: null,
    situacao: "designada",
    linkSala: null,
    linkFonte: null,
    linkFonteData: null,
    linkAnterior: null,
    cliente: null,
    grupoCliente: null,
    ciProcesso: null,
    reclamanteIniciais: null,
    titularId: null,
    backupId: null,
    substituiId: null,
    mudancas: [],
    mudancaConferidaEm: null,
    viosInicio: null,
    viosSituacao: null,
    viosTarefaCi: null,
    viosConferidoEm: null,
    djenConferidoEm: null,
    djenData: null,
    djenInicio: null,
    djenModalidade: null,
    correspondente: null,
    observacao: null,
    lidaEm: "2026-11-23T20:00:00.000Z",
    ...p,
  };
}

describe("audiências do Jus.br na pauta", () => {
  it("monta a linha: chave por processo, dia e hora; horário de Brasília; tipo, rito e modalidade pela descrição", () => {
    expect(
      linhaDoJusbr({
        cnj: "00118879120265150077",
        inicio: "2026-12-10T14:05",
        descricao: "inicial (rito sumaríssimo) por videoconferência",
        situacao: "designada",
        sala: "VT077 - FULANA",
        orgao: "CON1 - Jundiaí",
        movimentoEm: "2026-05-22T14:19:00",
      })
    ).toEqual({
      chave: "jusbr:0011887-91.2026.5.15.0077:2026-12-10T14:05",
      origem: "jusbr",
      tribunal: "TRT15",
      cnj: "0011887-91.2026.5.15.0077",
      inicio: "2026-12-10T17:05:00.000Z",
      tipo: "inicial",
      tipo_descricao: "Inicial (rito sumaríssimo) por videoconferência",
      rito_sumarissimo: true,
      modalidade_tribunal: "video",
      orgao: "CON1 - Jundiaí",
      sala: "VT077 - FULANA",
      situacao: "designada",
    });
    const julgamento = linhaDoJusbr({ cnj: "1001022-27.2025.5.02.0323", inicio: "2026-12-09T17:32", descricao: "de julgamento", situacao: "designada", sala: null, orgao: "13ª Vara do Trabalho de Guarulhos", movimentoEm: null });
    expect([julgamento?.tribunal, julgamento?.tipo, julgamento?.modalidade_tribunal]).toEqual(["TRT2", "julgamento", "presencial"]);
    expect(linhaDoJusbr({ cnj: "123", inicio: "2026-12-09T17:32", descricao: "una", situacao: "designada", sala: null, orgao: null, movimentoEm: null })).toBeNull();
  });

  it("a do PJe substitui a do Jus.br no mesmo processo e dia (só designadas)", () => {
    const jusbr = aud({ origem: "jusbr", chave: "jusbr:x", inicio: "2026-12-10T17:05:00.000Z" });
    const pje = aud({ inicio: "2026-12-10T17:00:00.000Z" });
    const outroDia = aud({ origem: "jusbr", chave: "jusbr:y", inicio: "2026-12-11T17:05:00.000Z" });
    const jaSubstituida = aud({ origem: "jusbr", chave: "jusbr:z", situacao: "cancelada" });
    expect(jusbrComPje([jusbr, pje, outroDia, jaSubstituida])).toEqual([{ jusbr, pje }]);
    expect(jusbrComPje([jusbr, aud({ situacao: "cancelada" })])).toEqual([]);
  });

  it("a do PJe herda o que a equipe completou na do Jus.br, sem sobrescrever o que já tem", () => {
    const jusbr = aud({ origem: "jusbr", titularId: "t1", backupId: "b1", observacao: "levar preposto", correspondente: "Fulano", modalidadeEquipe: "video" });
    expect(heranca(jusbr, aud({ titularId: "t9" }))).toEqual({ backup_id: "b1", observacao: "levar preposto", correspondente: "Fulano", modalidade_equipe: "video", substitui_id: jusbr.id });
  });
});
