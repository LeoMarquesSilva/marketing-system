import { describe, expect, it } from "vitest";
import { alteracaoDaVistagem, CONFERENCIA_SEGURA_MS, emConferencia, inicioDaConferenciaSegura, reabertaParaAlterar } from "./alterar-vistagem";

const AGORA = Date.parse("2026-11-11T17:00:00.000Z");
const ADVOGADA = "advogada-1";
const situacao = (extra: Partial<Parameters<typeof alteracaoDaVistagem>[0]> = {}) => ({
  status: "controladoria_vistar",
  quemVistou: ADVOGADA,
  ajustada: false,
  conferenciaAbertaEm: null,
  ...extra,
});

describe("alterar a vistagem antes da Conferência (pedido de 11/11/2026)", () => {
  it("quem vistou pode alterar enquanto a controladoria não agiu", () => {
    expect(alteracaoDaVistagem(situacao(), ADVOGADA, AGORA)).toEqual({ pode: true });
  });

  it("depois da Conferência (enviada, devolvida, abertura de pasta), não", () => {
    for (const status of ["pronto_para_agendar", "abertura_pasta", "agendado", "juridico_vistar"]) {
      expect(alteracaoDaVistagem(situacao({ status }), ADVOGADA, AGORA)).toEqual({ pode: false, texto: "A controladoria já conferiu esta vistagem." });
    }
  });

  it("só quem vistou por último", () => {
    expect(alteracaoDaVistagem(situacao({ quemVistou: "outra-pessoa" }), ADVOGADA, AGORA).pode).toBe(false);
    expect(alteracaoDaVistagem(situacao({ quemVistou: null }), ADVOGADA, AGORA).pode).toBe(false);
  });

  it("admin pode alterar a vistagem de outra pessoa, mas a controladoria continua valendo", () => {
    expect(alteracaoDaVistagem(situacao({ quemVistou: "outra-pessoa" }), "admin-1", AGORA, true)).toEqual({ pode: true });
    expect(alteracaoDaVistagem(situacao({ quemVistou: "outra-pessoa" }), "admin-1", AGORA)).toEqual({
      pode: false,
      texto: "Só quem vistou (ou um admin) pode alterar a vistagem.",
    });
    expect(alteracaoDaVistagem(situacao({ status: "pronto_para_agendar" }), "admin-1", AGORA, true).pode).toBe(false);
    expect(alteracaoDaVistagem(situacao({ ajustada: true }), "admin-1", AGORA, true).pode).toBe(false);
    const conferindo = situacao({ conferenciaAbertaEm: new Date(AGORA - 60_000).toISOString() });
    expect(alteracaoDaVistagem(conferindo, "admin-1", AGORA, true).pode).toBe(false);
  });

  it("com ajuste da controladoria na Conferência, não", () => {
    const resultado = alteracaoDaVistagem(situacao({ ajustada: true }), ADVOGADA, AGORA);
    expect(resultado.pode).toBe(false);
    expect(!resultado.pode && resultado.texto).toContain("peça que ela devolva");
  });

  it("ao mesmo tempo que a controladoria: vale a decisão dela", () => {
    const abertaHa = (ms: number) => new Date(AGORA - ms).toISOString();
    const resultado = alteracaoDaVistagem(situacao({ conferenciaAbertaEm: abertaHa(2 * 60_000) }), ADVOGADA, AGORA);
    expect(resultado.pode).toBe(false);
    expect(!resultado.pode && resultado.texto).toContain("a decisão dela vale");
    // passado o tempo sem a controladoria renovar (saiu da tela), libera
    expect(alteracaoDaVistagem(situacao({ conferenciaAbertaEm: abertaHa(CONFERENCIA_SEGURA_MS + 1) }), ADVOGADA, AGORA)).toEqual({ pode: true });
  });

  it("a marca da Conferência vale pelo tempo combinado", () => {
    expect(emConferencia(null, AGORA)).toBe(false);
    expect(emConferencia("data ruim", AGORA)).toBe(false);
    expect(emConferencia(new Date(AGORA - 60_000).toISOString(), AGORA)).toBe(true);
    expect(inicioDaConferenciaSegura(AGORA)).toBe(new Date(AGORA - CONFERENCIA_SEGURA_MS).toISOString());
  });

  it("o aviso de reaberta só vale se veio depois da última devolução", () => {
    expect(reabertaParaAlterar({ reabertaEm: null, devolvidoEm: null })).toBe(false);
    expect(reabertaParaAlterar({ reabertaEm: "2026-11-11T16:00:00Z", devolvidoEm: null })).toBe(true);
    expect(reabertaParaAlterar({ reabertaEm: "2026-11-11T16:00:00Z", devolvidoEm: "2026-11-11T15:00:00Z" })).toBe(true);
    expect(reabertaParaAlterar({ reabertaEm: "2026-11-11T16:00:00Z", devolvidoEm: "2026-11-11T16:30:00Z" })).toBe(false);
  });
});
