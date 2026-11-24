import { describe, expect, it } from "vitest";
import { inicioDoDiaBr, resumirFila, type LinhaDaFila } from "./fila-resumo";

// 24/11/2026 10:00 em Brasília (13:00 UTC). Números de processo fictícios.
const AGORA = Date.parse("2026-11-24T13:00:00Z");
const linha = (parcial: Partial<LinhaDaFila>): LinhaDaFila => ({
  status: "pendente",
  motivo_espera: null,
  sistema: "jusbr",
  tribunal: "TJSP",
  cnj: "0000000-00.0000.8.26.0000",
  robo: null,
  erro: null,
  criado_em: "2026-11-24T12:00:00Z",
  atualizado_em: "2026-11-24T12:00:00Z",
  concluido_em: null,
  ...parcial,
});

describe("resumo da fila do robô de autos", () => {
  it("0h de Brasília, mesmo entre 21h e meia-noite (já é outro dia em UTC)", () => {
    expect(new Date(inicioDoDiaBr(AGORA)).toISOString()).toBe("2026-11-24T03:00:00.000Z");
    expect(new Date(inicioDoDiaBr(Date.parse("2026-11-25T01:30:00Z"))).toISOString()).toBe("2026-11-24T03:00:00.000Z");
  });

  it("conta fila, download, espera por motivo, e o que terminou hoje; erros sem o Call log nem o diagnóstico", () => {
    const r = resumirFila(
      [
        linha({ criado_em: "2026-11-24T11:00:00Z" }),
        linha({ sistema: "eproc", criado_em: "2026-11-23T20:00:00Z" }),
        linha({ status: "em_andamento", robo: "servidor-jusbr", atualizado_em: "2026-11-24T12:59:00Z" }),
        linha({ status: "aguardando_pessoa", motivo_espera: "segundo_fator", sistema: "eproc" }),
      ],
      [
        linha({ status: "concluido", robo: "servidor-jusbr", concluido_em: "2026-11-24T10:00:00Z" }),
        linha({ status: "concluido", concluido_em: "2026-11-24T02:00:00Z" }), // ontem, 23h em Brasília
        linha({ status: "erro", erro: "locator.click: Timeout Diagnóstico guardado em /dados/d.png\nCall log:\n - x", concluido_em: "2026-11-24T09:00:00Z" }),
      ],
      AGORA
    );
    expect(r.agora).toEqual({ naFila: 2, baixando: 1, aguardandoPessoa: 1, motivos: { segundo_fator: 1 }, maisAntigoNaFilaEm: "2026-11-23T20:00:00Z" });
    expect(r.hoje).toEqual({ concluidos: 1, erros: 1 });
    expect(r.porSistema).toEqual({ jusbr: 2, eproc: 2 });
    expect(r.robos).toEqual([{ nome: "servidor-jusbr", ultimoEm: "2026-11-24T12:59:00Z", baixando: 1 }]);
    expect(r.erros[0].erro).toBe("locator.click: Timeout");
  });
});
