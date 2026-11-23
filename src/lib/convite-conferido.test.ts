import { describe, expect, it } from "vitest";
import { CONFERIR_CONVITE_A_CADA_MS, conviteConferidoHaPouco, marcarConviteConferido } from "./convite-conferido";

function loja() {
  const dados = new Map<string, string>();
  return { getItem: (chave: string) => dados.get(chave) ?? null, setItem: (chave: string, valor: string) => void dados.set(chave, valor) };
}

describe("convite conferido há pouco (vale para todas as abas)", () => {
  it("depois de perguntar, não pergunta de novo até passar o intervalo", () => {
    const l = loja();
    const agora = Date.UTC(2026, 10, 12, 15, 0);
    expect(conviteConferidoHaPouco("festa:u1", agora, l)).toBe(false);
    marcarConviteConferido("festa:u1", agora, l);
    expect(conviteConferidoHaPouco("festa:u1", agora + 60_000, l)).toBe(true);
    expect(conviteConferidoHaPouco("festa:u1", agora + CONFERIR_CONVITE_A_CADA_MS - 1, l)).toBe(true);
    expect(conviteConferidoHaPouco("festa:u1", agora + CONFERIR_CONVITE_A_CADA_MS, l)).toBe(false);
  });

  it("cada usuário e cada aviso tem a sua chave", () => {
    const l = loja();
    const agora = Date.UTC(2026, 10, 12, 15, 0);
    marcarConviteConferido("festa:u1", agora, l);
    expect(conviteConferidoHaPouco("festa:u2", agora, l)).toBe(false);
    expect(conviteConferidoHaPouco("pesquisa:u1", agora, l)).toBe(false);
  });

  it("valor estranho, data no futuro ou sem armazenamento: pergunta ao servidor", () => {
    const l = loja();
    const agora = Date.UTC(2026, 10, 12, 15, 0);
    l.setItem("a", "1");
    l.setItem("b", "não é número");
    l.setItem("c", String(agora + 60_000));
    expect(conviteConferidoHaPouco("a", agora, l)).toBe(false);
    expect(conviteConferidoHaPouco("b", agora, l)).toBe(false);
    expect(conviteConferidoHaPouco("c", agora, l)).toBe(false);
    expect(conviteConferidoHaPouco("a", agora, null)).toBe(false);
    expect(() => marcarConviteConferido("a", agora, null)).not.toThrow();
  });
});
