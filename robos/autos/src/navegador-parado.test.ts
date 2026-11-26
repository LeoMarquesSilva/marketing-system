import { describe, expect, it } from "vitest";
import { MINUTOS_PARADO_PADRAO, limiteParadoDoNavegador, navegadorParadoDemais } from "./navegador-parado.ts";

const MINUTO = 60_000;

describe("limiteParadoDoNavegador", () => {
  it("sem a variável: 10 min no servidor (playwright) e nunca no Chrome da máquina (comum)", () => {
    expect(MINUTOS_PARADO_PADRAO).toBe(10);
    expect(limiteParadoDoNavegador("", "playwright")).toBe(10 * MINUTO);
    expect(limiteParadoDoNavegador("  ", "playwright")).toBe(10 * MINUTO);
    expect(limiteParadoDoNavegador("", "comum")).toBe(0);
  });

  it("com um número, vale em qualquer modo (com vírgula ou ponto, até 24 h)", () => {
    expect(limiteParadoDoNavegador("30", "playwright")).toBe(30 * MINUTO);
    expect(limiteParadoDoNavegador("5", "comum")).toBe(5 * MINUTO);
    expect(limiteParadoDoNavegador("1,5", "playwright")).toBe(90_000);
    expect(limiteParadoDoNavegador("99999", "playwright")).toBe(1440 * MINUTO);
  });

  it("0, nao, não ou nunca: o navegador fica aberto", () => {
    for (const valor of ["0", "00", "nao", "NÃO", "nunca"]) expect(limiteParadoDoNavegador(valor, "playwright")).toBe(0);
  });

  it("texto inválido ou negativo: o padrão do modo", () => {
    expect(limiteParadoDoNavegador("dez", "playwright")).toBe(10 * MINUTO);
    expect(limiteParadoDoNavegador("-3", "playwright")).toBe(10 * MINUTO);
    expect(limiteParadoDoNavegador("-3", "comum")).toBe(0);
  });
});

describe("navegadorParadoDemais", () => {
  const agoraMs = Date.parse("2026-11-25T18:30:00Z");

  it("fecha quando a fila está vazia há o limite ou mais", () => {
    expect(navegadorParadoDemais({ aberto: true, paradoDesdeMs: agoraMs - 10 * MINUTO, agoraMs, limiteMs: 10 * MINUTO })).toBe(true);
    expect(navegadorParadoDemais({ aberto: true, paradoDesdeMs: agoraMs - 45 * MINUTO, agoraMs, limiteMs: 10 * MINUTO })).toBe(true);
  });

  it("não fecha antes do limite", () => {
    expect(navegadorParadoDemais({ aberto: true, paradoDesdeMs: agoraMs - 9 * MINUTO, agoraMs, limiteMs: 10 * MINUTO })).toBe(false);
  });

  it("não fecha o que já está fechado, com pedido em curso (sem 'parado desde') nem com o limite desligado", () => {
    expect(navegadorParadoDemais({ aberto: false, paradoDesdeMs: agoraMs - 60 * MINUTO, agoraMs, limiteMs: 10 * MINUTO })).toBe(false);
    expect(navegadorParadoDemais({ aberto: true, paradoDesdeMs: null, agoraMs, limiteMs: 10 * MINUTO })).toBe(false);
    expect(navegadorParadoDemais({ aberto: true, paradoDesdeMs: agoraMs - 60 * MINUTO, agoraMs, limiteMs: 0 })).toBe(false);
  });
});
