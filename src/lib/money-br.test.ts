import { describe, expect, it } from "vitest";
import {
  formatBrlInput,
  numberToCentsDigits,
  parseBrlInput,
} from "@/lib/money-br";

describe("parseBrlInput", () => {
  it("interpreta milhares brasileiros com vírgula decimal", () => {
    expect(parseBrlInput("2.323,20")).toBe(2323.2);
    expect(parseBrlInput("R$ 2.323,20")).toBe(2323.2);
    expect(parseBrlInput("3.000,00")).toBe(3000);
  });

  it("não trata ponto como decimal quando há vírgula", () => {
    // regressão: type=number + "2.323" virava ~2.32
    expect(parseBrlInput("2.323")).toBe(2323);
  });

  it("aceita vírgula decimal sem milhares", () => {
    expect(parseBrlInput("38,72")).toBe(38.72);
    expect(parseBrlInput("1.161,60")).toBe(1161.6);
  });

  it("aceita ponto decimal estilo US quando não há vírgula", () => {
    expect(parseBrlInput("2323.20")).toBe(2323.2);
  });

  it("retorna null para vazio ou inválido", () => {
    expect(parseBrlInput("")).toBeNull();
    expect(parseBrlInput("   ")).toBeNull();
    expect(parseBrlInput("abc")).toBeNull();
  });
});

describe("formatBrlInput / numberToCentsDigits", () => {
  it("formata a partir de dígitos em centavos", () => {
    expect(formatBrlInput("232320")).toBe("R$\u00a02.323,20");
    expect(formatBrlInput("300000")).toBe("R$\u00a03.000,00");
    expect(formatBrlInput("3872")).toBe("R$\u00a038,72");
    expect(formatBrlInput("")).toBe("");
  });

  it("converte número para dígitos de centavos", () => {
    expect(numberToCentsDigits(2323.2)).toBe("232320");
    expect(numberToCentsDigits(0)).toBe("");
    expect(numberToCentsDigits(38.72)).toBe("3872");
  });
});
