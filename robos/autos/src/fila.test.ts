import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "./config.ts";
import { Fila, PedidoEncerrado } from "./fila.ts";

const config = { orqestraiUrl: "https://orqestrai.exemplo", token: "token-de-teste", nome: "robo-de-teste" } as Config;
const PEDIDO = "00000000-0000-0000-0000-000000000001";

function respostaFalsa(status: number, corpo: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Fila.repassar", () => {
  it("pede ao ORQESTRAI o repasse ao sistema da reserva", async () => {
    const chamada = respostaFalsa(200, { pedido: { id: PEDIDO, sistema: "esaj", status: "pendente" } });
    vi.stubGlobal("fetch", chamada);
    await new Fila(config).repassar(PEDIDO, "esaj:TJSP");
    expect(chamada).toHaveBeenCalledOnce();
    const [url, opcoes] = chamada.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://orqestrai.exemplo/api/robos/autos/pedidos/${PEDIDO}`);
    expect(opcoes.method).toBe("POST");
    expect(JSON.parse(opcoes.body as string)).toEqual({ acao: "repassar", reserva: "esaj:TJSP" });
  });

  it("pedido cancelado na ficha vira PedidoEncerrado", async () => {
    vi.stubGlobal("fetch", respostaFalsa(409, { error: "O pedido não está mais com o robô (cancelado ou encerrado)." }));
    await expect(new Fila(config).repassar(PEDIDO, "esaj:TJSP")).rejects.toBeInstanceOf(PedidoEncerrado);
  });

  it("recusa do ORQESTRAI vira erro com o motivo", async () => {
    vi.stubGlobal("fetch", respostaFalsa(400, { error: "Sistema desconhecido para o repasse: projudi." }));
    await expect(new Fila(config).repassar(PEDIDO, "projudi:TJSP")).rejects.toThrow("Sistema desconhecido");
  });
});
