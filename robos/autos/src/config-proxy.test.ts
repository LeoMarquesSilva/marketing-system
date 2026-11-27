import { describe, expect, it } from "vitest";
import { lerProxy, numeroOuZero } from "./config.ts";

describe("proxy do navegador (NAVEGADOR_PROXY)", () => {
  it("vazio = conexão direta", () => {
    expect(lerProxy("")).toBeNull();
    expect(lerProxy("   ")).toBeNull();
  });
  it("socks5 sem usuário (ex.: o WARP no mesmo projeto do Easypanel)", () => {
    expect(lerProxy("socks5://warp:1080")).toEqual({ server: "socks5://warp:1080" });
  });
  it("http com usuário e senha vai em campos próprios, e a lista de exceções vira bypass", () => {
    expect(lerProxy("http://us%40er:s%3Anha@proxy.exemplo.com:8080", "orqestrai.com.br, localhost")).toEqual({
      server: "http://proxy.exemplo.com:8080",
      username: "us@er",
      password: "s:nha",
      bypass: "orqestrai.com.br,localhost",
    });
  });
  it("recusa o que o navegador não aceita", () => {
    expect(() => lerProxy("warp:1080")).toThrow(/protocolo/);
    expect(() => lerProxy("socks5://warp")).toThrow(/porta/);
    expect(() => lerProxy("socks5://u:s@warp:1080")).toThrow(/socks5/);
    expect(() => lerProxy("ftp://warp:21")).toThrow(/protocolo/);
  });
});

describe("números que aceitam 0 (ESPERA_PESSOA_MINUTOS, PAUSA_APOS_PESSOA_MINUTOS)", () => {
  it("0 desliga", () => {
    expect(numeroOuZero("0", 15)).toBe(0);
  });
  it("vazio ou inválido fica no padrão", () => {
    expect(numeroOuZero("", 15)).toBe(15);
    expect(numeroOuZero("  ", 15)).toBe(15);
    expect(numeroOuZero("abc", 15)).toBe(15);
    expect(numeroOuZero("-3", 15)).toBe(15);
  });
  it("valor informado vale", () => {
    expect(numeroOuZero("5", 15)).toBe(5);
  });
});
