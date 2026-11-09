import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resumoSlaDoJuridico = vi.fn(async () => ({ texto: "t", html: "h", diaUtil: true }));
vi.mock("@/lib/vistagem/resumo-sla-server", () => ({ resumoSlaDoJuridico }));

const { GET } = await import("./route");

function chamada(token?: string): Request {
  return new Request("http://localhost/api/cron/vistagem-resumo-sla", { headers: token ? { authorization: `Bearer ${token}` } : {} });
}

describe("GET /api/cron/vistagem-resumo-sla", () => {
  beforeEach(() => {
    resumoSlaDoJuridico.mockClear();
    vi.stubEnv("VISTAGEM_RESUMO_SLA_TOKEN", "segredo");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("recusa sem o token ou com o token errado", async () => {
    expect((await GET(chamada())).status).toBe(401);
    expect((await GET(chamada("outro"))).status).toBe(401);
    expect(resumoSlaDoJuridico).not.toHaveBeenCalled();
  });

  it("recusa tudo se a variável não existir", async () => {
    vi.stubEnv("VISTAGEM_RESUMO_SLA_TOKEN", "");
    expect((await GET(chamada(""))).status).toBe(401);
    expect(resumoSlaDoJuridico).not.toHaveBeenCalled();
  });

  it("devolve o resumo com o token certo", async () => {
    const resposta = await GET(chamada("segredo"));
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ texto: "t", html: "h", diaUtil: true });
  });
});
