import { describe, expect, it } from "vitest";
import { ESPERA_PARADA_MS, PEDIDO_PARADO_MS, TENTATIVAS_COM_PESSOA, TENTATIVAS_PARADO, conectorDoPedido, decidirFila, type PedidoDaFila } from "./fila-escolha";

const AGORA = Date.parse("2026-11-27T12:00:00Z");
const ha = (ms: number) => new Date(AGORA - ms).toISOString();

type Pedido = PedidoDaFila & { id: string };

function pedido(id: string, extra: Partial<Pedido> = {}): Pedido {
  return { id, sistema: "pje", tribunal: "TJRJ", status: "pendente", motivoEspera: null, tentativas: 0, criadoEm: ha(60 * 60_000), atualizadoEm: ha(60 * 60_000), ...extra };
}

const ROBO = new Set(["pje:TJRJ", "eproc:TJSP", "jusbr:BR"]);
const ofertas = (decisoes: ReturnType<typeof decidirFila<Pedido>>) => decisoes.filter((d) => d.tipo === "oferecer").map((d) => d.pedido.id);
const tirados = (decisoes: ReturnType<typeof decidirFila<Pedido>>) => decisoes.filter((d) => d.tipo === "tirar").map((d) => d.pedido.id);

describe("conectorDoPedido", () => {
  it("usa sistema:tribunal, e jusbr:BR para o Jus.br", () => {
    expect(conectorDoPedido({ sistema: "pje", tribunal: "TJRJ" })).toBe("pje:TJRJ");
    expect(conectorDoPedido({ sistema: "jusbr", tribunal: "TJRJ" })).toBe("jusbr:BR");
  });
});

describe("decidirFila", () => {
  it("pedido novo vem antes do mais antigo que parou esperando uma pessoa (a fila não trava nele)", () => {
    const parado = pedido("parado", { status: "aguardando_pessoa", motivoEspera: "login", tentativas: 1, criadoEm: ha(24 * 3600_000), atualizadoEm: ha(ESPERA_PARADA_MS + 1) });
    const novo = pedido("novo", { sistema: "eproc", tribunal: "TJSP", criadoEm: ha(5 * 60_000) });
    expect(ofertas(decidirFila([parado, novo], ROBO, AGORA))).toEqual(["novo", "parado"]);
  });

  it("pendentes e parados, cada grupo do mais antigo para o mais novo", () => {
    const decisoes = decidirFila(
      [
        pedido("p2", { criadoEm: ha(10 * 60_000) }),
        pedido("caiu", { status: "em_andamento", tentativas: 1, criadoEm: ha(90 * 60_000), atualizadoEm: ha(PEDIDO_PARADO_MS + 1) }),
        pedido("p1", { criadoEm: ha(30 * 60_000) }),
      ],
      ROBO,
      AGORA
    );
    expect(ofertas(decisoes)).toEqual(["p1", "p2", "caiu"]);
  });

  it("enquanto o robô dá sinal, o pedido que espera a pessoa ou baixa não é oferecido a outro", () => {
    const decisoes = decidirFila(
      [
        pedido("esperando", { status: "aguardando_pessoa", motivoEspera: "segundo_fator", tentativas: 1, atualizadoEm: ha(60_000) }),
        pedido("baixando", { status: "em_andamento", tentativas: 1, atualizadoEm: ha(5 * 60_000) }),
      ],
      ROBO,
      AGORA
    );
    expect(decisoes).toEqual([]);
  });

  it("segredo de justiça sem liberação nunca volta ao robô nem sai sozinho", () => {
    const segredo = pedido("segredo", { status: "aguardando_pessoa", motivoEspera: "segredo_justica", tentativas: 9, atualizadoEm: ha(48 * 3600_000) });
    expect(decidirFila([segredo], ROBO, AGORA)).toEqual([]);
  });

  it("depois de parar vezes demais esperando uma pessoa, o pedido sai da fila com a mensagem do que faltou", () => {
    const cansado = pedido("cansado", { status: "aguardando_pessoa", motivoEspera: "segundo_fator", tentativas: TENTATIVAS_COM_PESSOA, atualizadoEm: ha(ESPERA_PARADA_MS + 1) });
    const ainda = pedido("ainda", { status: "aguardando_pessoa", motivoEspera: "login", tentativas: TENTATIVAS_COM_PESSOA - 1, atualizadoEm: ha(ESPERA_PARADA_MS + 1) });
    const decisoes = decidirFila([cansado, ainda], ROBO, AGORA);
    expect(tirados(decisoes)).toEqual(["cansado"]);
    expect(ofertas(decisoes)).toEqual(["ainda"]);
    const saida = decisoes.find((d) => d.tipo === "tirar");
    expect(saida?.tipo === "tirar" && saida.mensagem).toMatch(/código de verificação/);
    expect(saida?.tipo === "tirar" && saida.mensagem).toMatch(/peça os autos de novo/);
  });

  it("pedido que derrubou o robô no meio várias vezes também sai", () => {
    const decisoes = decidirFila([pedido("pesado", { status: "em_andamento", tentativas: TENTATIVAS_PARADO, atualizadoEm: ha(PEDIDO_PARADO_MS + 1) })], ROBO, AGORA);
    expect(tirados(decisoes)).toEqual(["pesado"]);
  });

  it("tira o pedido parado mesmo de conector que este robô não atende (senão ninguém limparia)", () => {
    const decisoes = decidirFila([pedido("dcp", { sistema: "dcp", status: "aguardando_pessoa", motivoEspera: "login", tentativas: TENTATIVAS_COM_PESSOA, atualizadoEm: ha(ESPERA_PARADA_MS + 1) })], ROBO, AGORA);
    expect(tirados(decisoes)).toEqual(["dcp"]);
  });

  it("só oferece o que algum conector deste robô atende", () => {
    const decisoes = decidirFila([pedido("dcp", { sistema: "dcp" }), pedido("jusbr", { sistema: "jusbr" })], ROBO, AGORA);
    expect(ofertas(decisoes)).toEqual(["jusbr"]);
  });
});
