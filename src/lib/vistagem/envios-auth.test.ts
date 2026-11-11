import { afterEach, describe, expect, it } from "vitest";
import { autorizadoNosEnvios, chaveDosEnvios } from "./envios-auth";

const original = { cron: process.env.CRON_SECRET, service: process.env.SUPABASE_SERVICE_ROLE_KEY };

afterEach(() => {
  for (const [nome, valor] of [["CRON_SECRET", original.cron], ["SUPABASE_SERVICE_ROLE_KEY", original.service]] as const) {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
});

const pedido = (auth?: string) => new Request("https://example.com/api/cron/vistagem-envios", auth ? { headers: { authorization: auth } } : {});

describe("chave da rota de envios para o pg_cron do SAMA", () => {
  it("é derivada da service role, sempre igual para a mesma chave e sem revelá-la", () => {
    const chave = chaveDosEnvios("service-role-de-teste");
    expect(chave).toMatch(/^[0-9a-f]{64}$/);
    expect(chaveDosEnvios("service-role-de-teste")).toBe(chave);
    expect(chaveDosEnvios("outra-service-role")).not.toBe(chave);
    expect(chave).not.toContain("service-role-de-teste");
    expect(chaveDosEnvios(undefined)).toBeNull();
    expect(chaveDosEnvios("  ")).toBeNull();
  });

  it("aceita a chave derivada ou o CRON_SECRET, e recusa o resto", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-de-teste";
    process.env.CRON_SECRET = "segredo-do-cron";
    expect(autorizadoNosEnvios(pedido(`Bearer ${chaveDosEnvios("service-role-de-teste")}`))).toBe(true);
    expect(autorizadoNosEnvios(pedido("Bearer segredo-do-cron"))).toBe(true);
    expect(autorizadoNosEnvios(pedido("Bearer service-role-de-teste"))).toBe(false);
    expect(autorizadoNosEnvios(pedido("Bearer errado"))).toBe(false);
    expect(autorizadoNosEnvios(pedido())).toBe(false);
  });

  it("sem service role nem CRON_SECRET, ninguém entra", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.CRON_SECRET;
    expect(autorizadoNosEnvios(pedido("Bearer qualquer"))).toBe(false);
  });
});
