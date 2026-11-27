import { describe, expect, it } from "vitest";
import { diaBr, estadoDosAutos, montarPainelDoRobo, motivoDoErro, ritmoDoRobo, type DocumentoDoPainel, type PedidoDoPainel, type ProcessoDoPainel } from "./painel-robo";

const AGORA = Date.parse("2026-11-24T15:00:00Z"); // 12h em Brasília
const semSugestoes = { pendentes: 0, aprovadas: 0, recusadas: 0, pendentesPorProcesso: [] };

function pedido(parcial: Partial<PedidoDoPainel> & { processo_id: string; status: string }): PedidoDoPainel {
  return {
    id: `${parcial.processo_id}-${parcial.status}-${parcial.criado_em ?? "x"}`,
    cnj: "0000001-11.2024.8.26.0001",
    sistema: "esaj",
    tribunal: "TJSP",
    motivo_espera: null,
    erro: null,
    tentativas: 1,
    robo: "robo-a",
    criado_em: "2026-11-24T12:00:00Z",
    atualizado_em: "2026-11-24T12:10:00Z",
    iniciado_em: null,
    concluido_em: null,
    ...parcial,
  };
}

function documento(processo_id: string, leitura_status: string, paginas = 100): DocumentoDoPainel {
  return { processo_id, origem: "robo", leitura_status, paginas, paginas_lidas: paginas - 2, paginas_sem_texto: 2, leitura_custo_us: 0.02, criado_em: "2026-11-24T12:10:00Z" };
}

function processo(id: string, parcial: Partial<ProcessoDoPainel> = {}): ProcessoDoPainel {
  return { id, ci: id, cnj: "0000001-11.2024.8.26.0001", situacao: "Ativo", dataEncerramento: null, tribunal: "TJSP", sistema: "esaj", temRobo: true, ...parcial };
}

describe("motivo do erro do robô", () => {
  it("tira o que muda de processo para processo, para agrupar", () => {
    expect(motivoDoErro("0000001-11.2024.8.26.0001: a sessão do Jus.br venceu.")).toBe("A sessão do Jus.br venceu.");
    expect(motivoDoErro("0000002-22.2023.8.26.0002: a sessão do Jus.br venceu.")).toBe("A sessão do Jus.br venceu.");
    expect(motivoDoErro("Falha inesperada no robô: locator.click: Timeout 30000ms exceeded.\nCall log:\n  - waiting")).toBe("Falha inesperada no robô: locator.click: Timeout 30000ms exceeded.");
    expect(motivoDoErro("Não abriu a pasta. Diagnóstico guardado em /tmp/x/y.png")).toBe("Não abriu a pasta.");
    expect(motivoDoErro(null)).toBe("Erro sem descrição");
  });
});

describe("estado dos autos de um processo", () => {
  it("com autos, vale o que a IA fez deles, mesmo com atualização na fila", () => {
    expect(estadoDosAutos([pedido({ processo_id: "p", status: "pendente" })], [documento("p", "lida")], true)).toBe("lido");
    expect(estadoDosAutos([], [documento("p", "lida"), documento("p", "pendente")], true)).toBe("a_ler");
    expect(estadoDosAutos([], [documento("p", "lendo")], true)).toBe("a_ler");
    expect(estadoDosAutos([], [documento("p", "erro")], true)).toBe("leitura_falhou");
    expect(estadoDosAutos([], [documento("p", "erro"), documento("p", "sem_texto")], true)).toBe("lido");
  });

  it("sem autos, vale a fila e depois o pedido mais recente", () => {
    expect(estadoDosAutos([pedido({ processo_id: "p", status: "em_andamento" })], [], true)).toBe("na_fila");
    expect(estadoDosAutos([pedido({ processo_id: "p", status: "aguardando_pessoa" })], [], true)).toBe("aguardando_pessoa");
    expect(estadoDosAutos([pedido({ processo_id: "p", status: "erro" })], [], true)).toBe("falhou");
    const erroAntigo = pedido({ processo_id: "p", status: "erro", criado_em: "2026-11-20T12:00:00Z" });
    expect(estadoDosAutos([erroAntigo, pedido({ processo_id: "p", status: "cancelado", criado_em: "2026-11-23T12:00:00Z" })], [], true)).toBe("nunca_pedido");
    expect(estadoDosAutos([], [], true)).toBe("nunca_pedido");
    expect(estadoDosAutos([], [], false)).toBe("sem_robo");
  });
});

describe("ritmo e projeção da fila", () => {
  const feito = (minutos: number, fim: string) => {
    const termino = Date.parse(fim);
    return pedido({ processo_id: `f${fim}`, status: "concluido", iniciado_em: new Date(termino - minutos * 60_000).toISOString(), concluido_em: fim, atualizado_em: fim });
  };

  it("média com teto de 3x a mediana: um pedido que esperou horas não distorce", () => {
    const finais = [feito(4, "2026-11-24T10:00:00Z"), feito(6, "2026-11-24T11:00:00Z"), feito(300, "2026-11-24T12:00:00Z")];
    // 4, 6 e 300 (que conta como 18): média 9,3.
    expect(ritmoDoRobo(finais)).toEqual({ minutosPorPedido: 9.3, amostra: 3 });
    expect(ritmoDoRobo([])).toEqual({ minutosPorPedido: null, amostra: 0 });
  });

  it("com fila contínua, vale o ciclo entre um término e o seguinte, não só o download", () => {
    // Downloads de 1 min, mas um a cada 5 min: o que anda a fila é o ciclo.
    const finais = ["14:00", "14:05", "14:10", "14:15"].map((fim) => feito(1, `2026-11-24T${fim}:00Z`));
    expect(ritmoDoRobo(finais)).toEqual({ minutosPorPedido: 5, amostra: 3 });
    // Pedido criado depois que o anterior terminou não é ciclo de fila (o robô ficou parado esperando).
    const espacados = ["10:00", "11:00", "12:00", "13:00"].map((fim) => ({ ...feito(2, `2026-11-24T${fim}:00Z`), criado_em: `2026-11-24T${fim.replace(":00", ":58").replace(/^(\d+)/, (h) => String(Number(h) - 1).padStart(2, "0"))}:00Z` }));
    expect(ritmoDoRobo(espacados)).toEqual({ minutosPorPedido: 2, amostra: 4 });
  });

  it("projeta o fim pela posição na fila e por quem está baixando", () => {
    const pedidos = [
      feito(10, "2026-11-24T14:00:00Z"),
      feito(10, "2026-11-24T14:30:00Z"),
      pedido({ processo_id: "a", status: "em_andamento", criado_em: "2026-11-24T14:40:00Z", iniciado_em: "2026-11-24T14:55:00Z", atualizado_em: "2026-11-24T14:59:00Z" }),
      pedido({ processo_id: "b", status: "pendente", robo: null, criado_em: "2026-11-24T14:45:00Z" }),
      pedido({ processo_id: "c", status: "pendente", robo: null, criado_em: "2026-11-24T14:50:00Z" }),
    ];
    const painel = montarPainelDoRobo({ processos: [], pedidos, documentos: [], sugestoes: semSugestoes, agoraMs: AGORA });
    expect(painel.projecao).toMatchObject({ minutosPorPedido: 10, amostra: 2, emParalelo: 1, parada: false });
    // Quem baixa começou há 5 min e o ritmo é 10: termina em 5 min; depois 10 min por pedido: 15 min e 25 min.
    expect(painel.abertos.map((item) => [item.status, item.posicao, item.previsaoEm])).toEqual([
      ["em_andamento", null, "2026-11-24T15:05:00.000Z"],
      ["pendente", 1, "2026-11-24T15:15:00.000Z"],
      ["pendente", 2, "2026-11-24T15:25:00.000Z"],
    ]);
    expect(painel.projecao.fimEm).toBe("2026-11-24T15:25:00.000Z");
  });

  it("download que já passou do ritmo não tem hora: termina a qualquer momento", () => {
    const pedidos = [
      feito(10, "2026-11-24T14:00:00Z"),
      pedido({ processo_id: "a", status: "em_andamento", iniciado_em: "2026-11-24T14:20:00Z", atualizado_em: "2026-11-24T14:59:00Z" }),
      pedido({ processo_id: "b", status: "pendente", robo: null, criado_em: "2026-11-24T14:45:00Z" }),
    ];
    const painel = montarPainelDoRobo({ processos: [], pedidos, documentos: [], sugestoes: semSugestoes, agoraMs: AGORA });
    expect(painel.abertos.map((item) => item.previsaoEm)).toEqual([null, "2026-11-24T15:10:00.000Z"]);
    expect(painel.abertos[0].iniciadoEm).toBe("2026-11-24T14:20:00Z");
    expect(painel.projecao.fimEm).toBe("2026-11-24T15:10:00.000Z");
  });

  it("fila esperando sem robô dando sinal: parada, sem previsão", () => {
    const pedidos = [feito(10, "2026-11-24T10:00:00Z"), pedido({ processo_id: "b", status: "pendente", robo: null, criado_em: "2026-11-24T13:00:00Z" })];
    const painel = montarPainelDoRobo({ processos: [], pedidos, documentos: [], sugestoes: semSugestoes, agoraMs: AGORA });
    expect(painel.projecao.parada).toBe(true);
    expect(painel.projecao.fimEm).toBeNull();
    expect(painel.abertos[0]).toMatchObject({ posicao: 1, previsaoEm: null });
  });

  it("fila vazia não tem fim a projetar", () => {
    const painel = montarPainelDoRobo({ processos: [], pedidos: [feito(10, "2026-11-24T14:00:00Z")], documentos: [], sugestoes: semSugestoes, agoraMs: AGORA });
    expect(painel.projecao).toMatchObject({ fimEm: null, parada: false });
  });
});

describe("painel do robô", () => {
  it("conta a fila, o dia, os tribunais, os erros que ainda valem e a leitura", () => {
    const pedidos = [
      pedido({ processo_id: "lido", status: "concluido", iniciado_em: "2026-11-24T12:00:00Z", concluido_em: "2026-11-24T12:08:00Z" }),
      pedido({ processo_id: "falhou", status: "erro", erro: "0000001-11.2024.8.26.0001: a sessão do Jus.br venceu.", sistema: "jusbr", concluido_em: "2026-11-23T20:00:00Z", criado_em: "2026-11-23T19:00:00Z" }),
      pedido({ processo_id: "refeito", status: "erro", erro: "Falhou", concluido_em: "2026-11-22T20:00:00Z", criado_em: "2026-11-22T19:00:00Z" }),
      pedido({ processo_id: "refeito", status: "concluido", concluido_em: "2026-11-23T02:00:00Z", criado_em: "2026-11-23T01:00:00Z" }),
      pedido({ processo_id: "espera", status: "aguardando_pessoa", motivo_espera: "segundo_fator" }),
    ];
    const painel = montarPainelDoRobo({
      processos: [processo("lido"), processo("falhou"), processo("refeito"), processo("espera"), processo("nunca"), processo("sem", { temRobo: false }), processo("velho", { situacao: "Arquivado definitivamente" })],
      pedidos,
      documentos: [documento("lido", "lida", 200), documento("refeito", "lida", 50)],
      sugestoes: { pendentes: 3, aprovadas: 2, recusadas: 1, pendentesPorProcesso: ["lido", "lido", "refeito"] },
      agoraMs: AGORA,
    });
    expect(painel.fila).toMatchObject({ pendentes: 0, baixando: 0, aguardandoPessoa: 1, motivos: { segundo_fator: 1 } });
    expect(painel.hoje).toEqual({ concluidos: 1, erros: 0 });
    expect(painel.porDia).toHaveLength(14);
    expect(painel.porDia.at(-1)).toEqual({ dia: "2026-11-24", concluidos: 1, erros: 0 });
    // 02:00Z do dia 23 ainda é dia 22 em Brasília.
    expect(painel.porDia.find((ponto) => ponto.dia === "2026-11-22")).toEqual({ dia: "2026-11-22", concluidos: 1, erros: 1 });
    expect(painel.porTribunal[0]).toEqual({ tribunal: "TJSP", sistema: "esaj", concluidos: 2, erros: 1, abertos: 1 });
    expect(painel.leitura).toMatchObject({ documentos: 2, lidos: 2, paginas: 250, paginasSemTexto: 4, custoUs: 0.04 });
    expect(painel.sugestoes).toEqual({ pendentes: 3, aprovadas: 2, recusadas: 1, processosComPendentes: 2 });
    expect(Object.fromEntries(painel.processos.map((item) => [item.id, item.estado]))).toEqual({
      lido: "lido",
      falhou: "falhou",
      refeito: "lido",
      espera: "aguardando_pessoa",
      nunca: "nunca_pedido",
      sem: "sem_robo",
      velho: "nunca_pedido",
    });
    expect(painel.processos.find((item) => item.id === "velho")?.ativo).toBe(false);
    expect(painel.processos.find((item) => item.id === "lido")).toMatchObject({ documentos: 1, paginas: 200, sugestoesPendentes: 2 });
    expect(painel.processos.find((item) => item.id === "falhou")?.ultimoPedido).toMatchObject({ status: "erro", erro: "A sessão do Jus.br venceu." });
  });

  it("o dia é o de Brasília", () => {
    expect(diaBr(Date.parse("2026-11-24T02:59:00Z"))).toBe("2026-11-23");
    expect(diaBr(Date.parse("2026-11-24T03:00:00Z"))).toBe("2026-11-24");
  });
});

describe("fila com o grupo do cliente", () => {
  it("cada pedido aberto traz o grupo do cliente do processo", () => {
    const painel = montarPainelDoRobo({
      processos: [processo("a", { grupoCliente: "Grupo Exemplo" }), processo("b")],
      pedidos: [pedido({ processo_id: "a", status: "pendente" }), pedido({ processo_id: "b", status: "pendente" })],
      documentos: [],
      sugestoes: semSugestoes,
      agoraMs: AGORA,
    });
    expect(painel.abertos.map((item) => [item.processoId, item.grupoCliente])).toEqual([
      ["a", "Grupo Exemplo"],
      ["b", null],
    ]);
  });
});
