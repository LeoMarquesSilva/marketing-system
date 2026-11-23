import { describe, expect, it } from "vitest";
import type { FichaJusbr } from "./conectores/jusbr-urls.ts";
import { lerSoNoVios, linhaDoMovimento, movimentosDeAudiencia } from "./pauta-jusbr.ts";

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
