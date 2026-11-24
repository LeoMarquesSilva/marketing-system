import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chaveDosEnvios } from "@/lib/vistagem/envios-auth";

const rodarRotina = vi.fn(async () => ({ vios: "em dia" }));
vi.mock("@/lib/audiencias/rotina-server", () => ({ rodarRotina }));

const { GET } = await import("./route");

function chamada(token?: string, ping = false): Request {
  return new Request(`http://localhost/api/cron/pauta-tick${ping ? "?ping" : ""}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
}

describe("GET /api/cron/pauta-tick", () => {
  beforeEach(() => {
    rodarRotina.mockClear();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-de-teste");
    vi.stubEnv("CRON_SECRET", "segredo-do-cron");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("recusa sem chave ou com chave errada, sem rodar a rotina", async () => {
    expect((await GET(chamada())).status).toBe(401);
    expect((await GET(chamada("errada"))).status).toBe(401);
    expect((await GET(chamada("service-role-de-teste"))).status).toBe(401);
    expect(rodarRotina).not.toHaveBeenCalled();
  });

  it("?ping com a chave do SAMA só confere a chave", async () => {
    const resposta = await GET(chamada(chaveDosEnvios("service-role-de-teste")!, true));
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ success: true, ping: true });
    expect(rodarRotina).not.toHaveBeenCalled();
  });

  it("roda a rotina com a chave do SAMA (pg_cron) ou com o CRON_SECRET (Vercel)", async () => {
    expect((await GET(chamada(chaveDosEnvios("service-role-de-teste")!))).status).toBe(200);
    expect((await GET(chamada("segredo-do-cron"))).status).toBe(200);
    expect(rodarRotina).toHaveBeenCalledTimes(2);
  });
});
