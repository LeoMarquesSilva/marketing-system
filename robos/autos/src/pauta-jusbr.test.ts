import { describe, expect, it } from "vitest";
import type { FichaJusbr } from "./conectores/jusbr-urls.ts";
import { audienciasDosMovimentos, lerAcompanhar, lerSoNoVios, linhaDoMovimento, movimentosDeAudiencia, salaEOrgao, type MovimentoDeAudiencia } from "./pauta-jusbr.ts";

// Textos reais do log do robô (Jus.br, 23/11/2026), com os nomes trocados.
const mov = (dataHora: string, descricao: string): MovimentoDeAudiencia => ({ dataHora, descricao, complementos: [] });

describe("audiências tiradas dos movimentos do Jus.br", () => {
  it("lê dia, hora, descrição, situação, sala e órgão", () => {
    const r = audienciasDosMovimentos("0011887-91.2026.5.15.0077", [
      mov("2026-05-22T14:19:00", "Audiência inicial (rito sumaríssimo) por videoconferência designada (10/12/2026 14:05 VT077 - FULANA DE TAL - CON1 - Jundiaí)"),
    ]);
    expect(r).toEqual([
      {
        cnj: "0011887-91.2026.5.15.0077",
        inicio: "2026-12-10T14:05",
        descricao: "inicial (rito sumaríssimo) por videoconferência",
        situacao: "designada",
        sala: "VT077 - FULANA DE TAL",
        orgao: "CON1 - Jundiaí",
        movimentoEm: "2026-05-22T14:19:00",
      },
    ]);
  });

  it("remarcação (cancelada e designada no mesmo minuto) continua designada; a mais recente decide", () => {
    const r = audienciasDosMovimentos("0010587-02.2026.5.15.0140", [
      mov("2026-09-29T15:44:00", "Audiência una por videoconferência designada (26/11/2026 10:00 SALA B - CON1 - Jundiaí)"),
      mov("2026-09-29T15:44:00", "Audiência una por videoconferência cancelada (26/11/2026 10:00 SALA B - CON1 - Jundiaí)"),
      mov("2026-03-02T13:53:00", "Audiência una por videoconferência designada (26/11/2026 10:00 VT140 - SALA B - CON1 - Jundiaí)"),
      mov("2026-11-17T16:50:00", "Audiência inicial por videoconferência realizada (17/11/2026 14:55 SALA C - CON1 - Araraquara)"),
      mov("2026-09-23T13:49:00", "Audiência inicial por videoconferência designada (17/11/2026 14:55 SALA C - CON1 - Araraquara)"),
      mov("2026-10-01T10:00:00", "Audiência de instrução cancelada (03/12/2026 09:00 Sala 2 - 1ª Vara do Trabalho de Campinas)"),
      mov("2026-08-01T10:00:00", "Audiência de instrução designada (03/12/2026 09:00 Sala 2 - 1ª Vara do Trabalho de Campinas)"),
    ]);
    expect(r.map((a) => [a.inicio, a.situacao, a.sala])).toEqual([
      ["2026-11-17T14:55", "realizada", "SALA C"],
      ["2026-11-26T10:00", "designada", "SALA B"],
      ["2026-12-03T09:00", "cancelada", "Sala 2"],
    ]);
  });

  it("separa sala e órgão (vara, CON, sala com parênteses)", () => {
    expect(salaEOrgao("Sala par - (Dr Fulano) - 13ª Vara do Trabalho de Guarulhos")).toEqual({ sala: "Sala par - (Dr Fulano)", orgao: "13ª Vara do Trabalho de Guarulhos" });
    expect(salaEOrgao("BRUNO SILVA - CON1 - Jundiaí")).toEqual({ sala: "BRUNO SILVA", orgao: "CON1 - Jundiaí" });
    expect(salaEOrgao("Sala única")).toEqual({ sala: null, orgao: "Sala única" });
    expect(salaEOrgao("")).toEqual({ sala: null, orgao: null });
  });

  it("ignora o que não é designação/cancelamento/realização com data", () => {
    expect(audienciasDosMovimentos("x", [mov("2026-01-01T10:00:00", "Audiência na modalidade presencial como prioritária")])).toEqual([]);
  });

  it("lista de acompanhamento do ORQESTRAI", () => {
    expect(lerAcompanhar({ acompanhar: ["a", "a", 3, "b"] })).toEqual(["a", "b"]);
    expect(lerAcompanhar({})).toEqual([]);
  });
});

describe("audiências só no VIOS para o Jus.br", () => {
  it("lê a lista do ORQESTRAI e descarta o que vem sem número ou data", () => {
    const corpo = {
      conferidaEm: "2026-11-23T19:00:00.000Z",
      audiencias: [
        { cnj: "0010587-02.2026.5.15.0140", inicio: "2026-11-26T13:00:00.000Z", tarefaCi: "937122", tarefa: "AUDIÊNCIA UNA/INICIAL", ciProcesso: "1", responsaveis: [] },
        { cnj: "0012788-61.2026.5.15.0044" },
        "lixo",
      ],
    };
    expect(lerSoNoVios(corpo)).toEqual([{ cnj: "0010587-02.2026.5.15.0140", inicio: "2026-11-26T13:00:00.000Z", tarefaCi: "937122", tarefa: "AUDIÊNCIA UNA/INICIAL" }]);
    expect(lerSoNoVios(null)).toEqual([]);
    expect(lerSoNoVios({ error: "Não autorizado." })).toEqual([]);
  });

  it("separa os movimentos de audiência (texto ou complementos), sem repetir entre graus, do mais novo ao mais antigo", () => {
    const designada = { dataHora: "2026-10-14T17:12:00", descricao: "Audiência de julgamento designada (09/12/2026 17:32 Sala par - 13ª Vara do Trabalho de Guarulhos)" };
    const porComplemento = {
      dataHora: "2026-08-01T10:00:00",
      descricao: "Designada",
      complementos: [{ nome: "tipo_de_audiencia", valor: { descricao: "Audiência una" } }, { nome: "data", valor: { valor: "26/11/2026 10:00" } }],
    };
    const outro = { dataHora: "2026-10-15T09:00:00", descricao: "Conclusos para julgamento" };
    const g1 = { grau: { sigla: "G1" }, movimentos: [porComplemento, designada, outro] };
    const fichas = [{ tramitacaoAtual: g1, tramitacoes: [g1, { grau: { sigla: "G2" }, movimentos: [designada] }] }] as unknown as FichaJusbr[];
    const movimentos = movimentosDeAudiencia(fichas);
    expect(movimentos.map((m) => m.dataHora)).toEqual(["2026-10-14T17:12:00", "2026-08-01T10:00:00"]);
    expect(movimentos[1]!.complementos).toEqual(["tipo_de_audiencia: Audiência una", "data: 26/11/2026 10:00"]);
    expect(linhaDoMovimento(movimentos[0]!)).toBe("2026-10-14 17:12 · Audiência de julgamento designada (09/12/2026 17:32 Sala par - 13ª Vara do Trabalho de Guarulhos)");
    expect(linhaDoMovimento(movimentos[1]!)).toBe("2026-08-01 10:00 · Designada · [tipo_de_audiencia: Audiência una; data: 26/11/2026 10:00]");
  });

  it("ficha sem movimentos não quebra", () => {
    expect(movimentosDeAudiencia([{} as FichaJusbr])).toEqual([]);
  });
});
