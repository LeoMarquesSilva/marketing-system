import { describe, expect, it } from "vitest";
import { faseDaRotina, falhaDoPedido, leituraAtrasada, rotinaDaResposta, type RotinaNoRobo, type SituacaoDoFluxoVios } from "./rotina-vios";

const parado: RotinaNoRobo = { rodando: false, inicio: null, fim: null, fluxos: null, erroFluxos: null, erro: null };

function situacao(robo: Partial<RotinaNoRobo> | null, lidoEm: string | null = "2026-11-06T17:55:41.99+00:00"): SituacaoDoFluxoVios {
  return { lidoEm, tipos: 326, robo: robo ? { ...parado, ...robo } : null, semRobo: robo ? null : "O robô não respondeu a tempo." };
}

describe("rotinaDaResposta", () => {
  it("lê o estado do GET /catalogo do robô", () => {
    const resposta = {
      ok: true,
      catalogo: { rodando: true, inicio: "2026-11-11T14:00:00.000Z", fim: null, grupos: 0, pastas: 0, fluxos: null, materias: null, erro: null },
    };
    expect(rotinaDaResposta(resposta)).toEqual({ ...parado, rodando: true, inicio: "2026-11-11T14:00:00.000Z" });
  });

  it("guarda os erros da rodada", () => {
    const resposta = { ok: true, catalogo: { rodando: false, inicio: "a", fim: "b", fluxos: null, erroFluxos: "net::ERR_CERT_DATE_INVALID", erro: " " } };
    expect(rotinaDaResposta(resposta)).toMatchObject({ erroFluxos: "net::ERR_CERT_DATE_INVALID", erro: null, fluxos: null });
  });

  it("sem o estado (POST que só iniciou, ou resposta estranha) devolve null", () => {
    expect(rotinaDaResposta({ ok: true, iniciado: true, refrescar: true })).toBeNull();
    expect(rotinaDaResposta("Bad Gateway")).toBeNull();
    expect(rotinaDaResposta(null)).toBeNull();
  });
});

describe("falhaDoPedido", () => {
  const base = { status: 202, conteudo: { ok: true }, tempo_esgotado: false, erro: null };

  it("2xx não é falha", () => {
    expect(falhaDoPedido(base)).toBeNull();
    expect(falhaDoPedido({ ...base, status: 200 })).toBeNull();
  });

  it("explica tempo esgotado, erro de rede, 401 e os outros status", () => {
    expect(falhaDoPedido({ ...base, tempo_esgotado: true })).toMatch(/não respondeu a tempo/);
    expect(falhaDoPedido({ ...base, status: null, erro: "Couldn't resolve host" })).toMatch(/Couldn't resolve host/);
    expect(falhaDoPedido({ ...base, status: 401, conteudo: { ok: false, erro: "Não autorizado." } })).toMatch(/401/);
    expect(falhaDoPedido({ ...base, status: 502, conteudo: { ok: false, erro: "TypeError: fetch failed" } })).toBe(
      "O robô respondeu 502: TypeError: fetch failed."
    );
    expect(falhaDoPedido({ ...base, status: 500, conteudo: "Internal Server Error" })).toBe("O robô respondeu 500: Internal Server Error.");
  });
});

describe("faseDaRotina", () => {
  it("sem resposta do robô", () => {
    expect(faseDaRotina(situacao(null))).toEqual({ fase: "sem_robo", motivo: "O robô não respondeu a tempo." });
  });

  it("rodando e o fluxo gravado é de antes da rodada: lendo o fluxo", () => {
    expect(faseDaRotina(situacao({ rodando: true, inicio: "2026-11-11T14:00:00.000Z" }))).toEqual({ fase: "lendo_fluxo", desde: "2026-11-11T14:00:00.000Z" });
  });

  it("rodando e o fluxo já foi gravado nesta rodada: segue no catálogo", () => {
    expect(faseDaRotina(situacao({ rodando: true, inicio: "2026-11-11T14:00:00.000Z" }, "2026-11-11T14:03:10.5+00:00"))).toEqual({
      fase: "lendo_catalogo",
      desde: "2026-11-11T14:00:00.000Z",
    });
  });

  it("rodando sem início conhecido conta como lendo o fluxo", () => {
    expect(faseDaRotina(situacao({ rodando: true }))).toMatchObject({ fase: "lendo_fluxo" });
  });

  it("falha do fluxo vem antes da do catálogo", () => {
    const fase = faseDaRotina(situacao({ inicio: "2026-11-09T01:00:00.000Z", erroFluxos: "net::ERR_CERT_DATE_INVALID", erro: "outro" }));
    expect(fase).toEqual({ fase: "falhou", em: "2026-11-09T01:00:00.000Z", parte: "fluxo", erro: "net::ERR_CERT_DATE_INVALID" });
    expect(faseDaRotina(situacao({ erro: "timeout" }))).toMatchObject({ fase: "falhou", parte: "catálogo das pastas", erro: "timeout" });
  });

  it("parado, com ou sem rodada desde o último reinício", () => {
    expect(faseDaRotina(situacao({ fim: "2026-11-11T14:05:00.000Z" }))).toEqual({ fase: "parado", terminouEm: "2026-11-11T14:05:00.000Z" });
    expect(faseDaRotina(situacao({}))).toEqual({ fase: "parado", terminouEm: null });
  });
});

describe("leituraAtrasada", () => {
  const agora = Date.parse("2026-11-11T15:00:00Z");

  it("até 8 dias está em dia", () => {
    expect(leituraAtrasada("2026-11-06T17:55:41.99+00:00", agora)).toBe(false);
    expect(leituraAtrasada("2026-11-03T16:00:00Z", agora)).toBe(false);
  });

  it("mais de 8 dias, sem leitura ou data inválida, está atrasada", () => {
    expect(leituraAtrasada("2026-11-02T10:00:00Z", agora)).toBe(true);
    expect(leituraAtrasada(null, agora)).toBe(true);
    expect(leituraAtrasada("ontem", agora)).toBe(true);
  });
});
