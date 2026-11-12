import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, unknown>;

/** O banco em memória: só o que a aba Vistado (`listarAgendadasJuridico`) lê do Supabase. */
const banco = vi.hoisted(() => ({ tabelas: {} as Record<string, Record<string, unknown>[]> }));

class Consulta {
  private filtros: ((linha: Linha) => boolean)[] = [];
  constructor(private linhas: Linha[]) {}
  select() {
    return this;
  }
  eq(coluna: string, valor: unknown) {
    this.filtros.push((linha) => linha[coluna] === valor);
    return this;
  }
  in(coluna: string, valores: unknown[]) {
    this.filtros.push((linha) => valores.includes(linha[coluna]));
    return this;
  }
  gte(coluna: string, valor: string) {
    this.filtros.push((linha) => typeof linha[coluna] === "string" && (linha[coluna] as string) >= valor);
    return this;
  }
  not(coluna: string, operador: string, valor: unknown) {
    if (operador === "is") this.filtros.push((linha) => (linha[coluna] ?? null) !== valor);
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  private async executar() {
    const achadas = this.linhas.filter((linha) => this.filtros.every((filtro) => filtro(linha)));
    return { data: achadas.map((linha) => ({ ...linha })), error: null };
  }
  then<T>(resolver: (valor: { data: Linha[]; error: null }) => T) {
    return this.executar().then(resolver);
  }
}

vi.mock("server-only", () => ({}));
vi.mock("./server", async (original) => ({
  ...(await original<typeof import("./server")>()),
  admin: () => ({ from: (tabela: string) => new Consulta((banco.tabelas[tabela] ??= [])) }),
  hojeEmSaoPaulo: () => "2026-11-12",
}));
vi.mock("./pessoas-server", () => ({ pessoasPorNome: async () => ({ fotos: {}, areas: {}, rotulos: {} }) }));

const { listarAgendadasJuridico } = await import("./juridico-server");

const INSOLVENCIA = ["Cível | Insolvência", "Insolvência"];
const ontem = () => new Date(Date.now() - 86_400_000).toISOString();

function publicacao(id: string, escritorio: string, risco: boolean, vistadoPor: string): Linha {
  return {
    id,
    status: "agendado",
    numero_processo: `000000${id.slice(1)}-00.2026.8.26.0100`,
    escritorio_responsavel: escritorio,
    demanda_risco: risco,
    vistado_por: vistadoPor,
    vistado_em: ontem(),
    data_publicacao: "2026-11-06",
    teor: "Intime-se.",
  };
}

beforeEach(() => {
  banco.tabelas = {
    users: [
      { auth_id: "pedro", name: "Pedro Vittale Rossi" },
      { auth_id: "ana", name: "Ana Clara Borba Tavares" },
      { auth_id: "caroline", name: "Caroline Simel Abdalla" },
    ],
    vistagem_publicacoes: [
      publicacao("p1", "Cível | Insolvência", true, "ana"),
      publicacao("p2", "Insolvência", false, "pedro"),
      publicacao("p3", "Insolvência", true, "ana"),
      publicacao("p4", "Trabalhista", false, "caroline"),
    ],
    vistagem_agendamentos: [],
    vistagem_inconsistencias: [],
  };
});

describe("aba Vistado: o que a área vistou", () => {
  it("quem não vista risco vê tudo o que a sua área vistou, inclusive as de risco e o que outras pessoas vistaram", async () => {
    // Como a Lavínia: das duas áreas da insolvência, sem vistar risco, e sem ter vistado nada.
    const { itens } = await listarAgendadasJuridico(null, INSOLVENCIA, "lavinia");
    expect(itens.map((item) => item.publicacao.id).sort()).toEqual(["p1", "p2", "p3"]);
    expect(itens.find((item) => item.publicacao.id === "p1")?.vistadoPor).toBe("Ana Clara Borba Tavares");
  });

  it("não mostra o que é de outra área", async () => {
    const { itens } = await listarAgendadasJuridico(null, INSOLVENCIA, "lavinia");
    expect(itens.some((item) => item.publicacao.escritorioResponsavel === "Trabalhista")).toBe(false);
  });

  it("com uma área escolhida, mostra só ela; uma área que não é da pessoa vem vazia", async () => {
    const soInsolvencia = await listarAgendadasJuridico("Insolvência", INSOLVENCIA, "lavinia");
    expect(soInsolvencia.itens.map((item) => item.publicacao.id).sort()).toEqual(["p2", "p3"]);
    const deOutra = await listarAgendadasJuridico("Trabalhista", INSOLVENCIA, "lavinia");
    expect(deOutra.itens).toEqual([]);
  });

  it("a controladoria (sem lista de áreas) vê todas as áreas", async () => {
    const { itens } = await listarAgendadasJuridico(null, null, "controladoria");
    expect(itens).toHaveLength(4);
  });
});
