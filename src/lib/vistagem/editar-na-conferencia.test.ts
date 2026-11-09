import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseDaData, RegraDePrazo, TipoNaArvore } from "./fluxo-vios";
import type { LinhaFilaSama } from "./fila-vios";

type Linha = Record<string, unknown>;

/** O banco em memória: só o que `editarTarefaNaConferencia` e o envio ao robô usam do Supabase. */
const banco = vi.hoisted(() => ({ tabelas: {} as Record<string, Record<string, unknown>[]> }));
const fila = vi.hoisted(() => ({ linhas: [] as unknown[] }));

class Consulta {
  private filtros: ((linha: Linha) => boolean)[] = [];
  private mudanca: Linha | null = null;
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
  or() {
    return this;
  }
  order() {
    return this;
  }
  update(mudanca: Linha) {
    this.mudanca = mudanca;
    return this;
  }
  private async executar() {
    const achadas = this.linhas.filter((linha) => this.filtros.every((filtro) => filtro(linha)));
    if (this.mudanca) for (const linha of achadas) Object.assign(linha, this.mudanca);
    return { data: achadas.map((linha) => ({ ...linha })), error: null };
  }
  async maybeSingle() {
    const { data, error } = await this.executar();
    return { data: data[0] ?? null, error };
  }
  then<T>(resolver: (valor: { data: Linha[]; error: null }) => T) {
    return this.executar().then(resolver);
  }
}

vi.mock("server-only", () => ({}));
vi.mock("./server", async (original) => ({
  ...(await original<typeof import("./server")>()),
  admin: () => ({ from: (tabela: string) => new Consulta((banco.tabelas[tabela] ??= [])) }),
  hojeEmSaoPaulo: () => "2026-11-09",
}));
vi.mock("./feriados", () => ({ carregarFeriados: async () => [] }));
vi.mock("./sama", async (original) => {
  const uteis = (dias: number): RegraDePrazo => ({ dias, negativo: false, corridos: false });
  const tipo = (nome: string, regraPrazo: RegraDePrazo | null, criacao: [number, BaseDaData][] = []): TipoNaArvore => ({
    nome,
    prazo: null,
    criacao: criacao.map(([id]) => id),
    conclusao: [],
    regraPrazo,
    baseDasFilhas: new Map(criacao),
  });
  return {
    ...(await original<typeof import("./sama")>()),
    envioSimulado: () => false,
    modoAgendamento: () => "intimacao",
    carregarArvoreVios: async () =>
      new Map<number, TipoNaArvore>([
        [100, tipo("RECURSO ORDINÁRIO", null, [[313, "pai"], [314, "pai"]])],
        [313, tipo("2. REVISAR", uteis(1))],
        [314, tipo("3. PROTOCOLAR", uteis(2))],
      ]),
    carregarCatalogoProcessos: async () => [
      {
        area: "Trabalhista",
        atualizadoEm: "2026-11-08",
        etapas: [
          { id: "100", nome: "RECURSO ORDINÁRIO", etiquetas: [1] },
          { id: "313", nome: "2. REVISAR", etiquetas: [2] },
          { id: "314", nome: "3. PROTOCOLAR", etiquetas: [3] },
        ],
        usuarios: [
          { id: "1", nome: "Ana Souza" },
          { id: "2", nome: "Bia Lima" },
          { id: "3", nome: "Carla Dias" },
        ],
      },
    ],
    enfileirarNoSama: async (linhas: unknown[]) => {
      fila.linhas.push(...linhas);
      return linhas.map((_, indice) => `fila-${indice}`);
    },
  };
});

const { editarTarefaNaConferencia, rodarNovamente, validarVistagem } = await import("./juridico-server");

const EDICAO = {
  agendamentoId: "a1",
  data: "2026-11-17",
  dataFatal: "2026-11-20",
  hora: null,
  horaFim: null,
  responsavel: "Ana Souza",
  revisor: "Bia Lima",
  fluxoDatas: [],
};

const publicacao = () => banco.tabelas.vistagem_publicacoes[0];
const tarefa = () => banco.tabelas.vistagem_agendamentos[0];
const naFila = () => (fila.linhas[0] as LinhaFilaSama).lancamento?.tarefas[0];

beforeEach(() => {
  fila.linhas.length = 0;
  banco.tabelas = {
    users: [{ auth_id: "u1", name: "Maria Heloiza" }],
    vistagem_publicacoes: [
      {
        id: "p1",
        status: "controladoria_vistar",
        numero_processo: "0000001-00.2026.5.02.0001",
        pasta_ci: "123",
        pendencia: null,
        area_processo: "Trabalhista",
        escritorio_responsavel: "Trabalhista",
        data_publicacao: "2026-11-06",
        tribunal: "TRT2",
        djen_id_comunicacao: 777,
        duplicidade_de: null,
      },
    ],
    vistagem_agendamentos: [
      {
        id: "a1",
        publicacao_id: "p1",
        ordem: 1,
        etiqueta: "PRAZO",
        tarefa: "RECURSO ORDINÁRIO",
        tarefa_id: "100",
        data: "2026-11-17",
        data_fatal: "2026-11-20",
        dias_prazo: 8,
        contagem_prazo: "uteis",
        hora: null,
        hora_fim: null,
        responsavel: "Ana Souza",
        responsavel_id: "1",
        revisor: "Bia Lima",
        revisor_id: "2",
        observacao: "Recorrer da sentença",
        fluxo_datas: null,
        ajustes: null,
        envio_status: "nao_enviado",
        envio_simulado: null,
        envio_erro: null,
      },
    ],
  };
});

describe("editarTarefaNaConferencia", () => {
  it("troca o responsável na tarefa, com o id do VIOS, e registra quem mudou", async () => {
    expect(await editarTarefaNaConferencia("p1", { ...EDICAO, responsavel: "Carla Dias" }, "u1")).toEqual({ mudancas: 1 });
    expect(tarefa()).toMatchObject({ responsavel: "Carla Dias", responsavel_id: "3", revisor: "Bia Lima", observacao: "Recorrer da sentença", dias_prazo: 8 });
    expect(tarefa().ajustes).toEqual([{ por: "Maria Heloiza", em: expect.any(String), mudancas: [{ campo: "Responsável", de: "Ana Souza", para: "Carla Dias" }] }]);
  });

  it("outra fatal: guarda a data pedida e larga os dias, que não valem mais", async () => {
    await editarTarefaNaConferencia("p1", { ...EDICAO, dataFatal: "2026-11-24", data: "2026-11-19" }, "u1");
    expect(tarefa()).toMatchObject({ data_fatal: "2026-11-24", data: "2026-11-19", dias_prazo: null, contagem_prazo: null });
  });

  it("guarda o Enviar escolhido à mão, sem mudar a fatal nem os dias", async () => {
    await editarTarefaNaConferencia("p1", { ...EDICAO, data: "2026-11-12" }, "u1");
    expect(tarefa()).toMatchObject({ data: "2026-11-12", data_fatal: "2026-11-20", dias_prazo: 8 });
  });

  it("acumula os ajustes em vez de apagar o anterior", async () => {
    await editarTarefaNaConferencia("p1", { ...EDICAO, responsavel: "Carla Dias" }, "u1");
    await editarTarefaNaConferencia("p1", { ...EDICAO, responsavel: "Carla Dias", data: "2026-11-12" }, "u1");
    expect((tarefa().ajustes as unknown[]).length).toBe(2);
  });

  it("nada mudou: não grava nem registra ajuste", async () => {
    expect(await editarTarefaNaConferencia("p1", EDICAO, "u1")).toEqual({ mudancas: 0 });
    expect(tarefa().ajustes).toBeNull();
  });

  it("segue as regras da vistagem", async () => {
    await expect(editarTarefaNaConferencia("p1", { ...EDICAO, responsavel: "Fulano de Fora" }, "u1")).rejects.toThrow("escolha o responsável na lista de usuários do VIOS");
    await expect(editarTarefaNaConferencia("p1", { ...EDICAO, revisor: null }, "u1")).rejects.toThrow("no Prazo o revisor é obrigatório");
    await expect(editarTarefaNaConferencia("p1", { ...EDICAO, dataFatal: null }, "u1")).rejects.toThrow("escolha a data fatal do prazo");
    await expect(
      editarTarefaNaConferencia("p1", { ...EDICAO, fluxoDatas: [{ caminho: ["TAREFA QUE NÃO EXISTE"], data: "2026-11-18" }] }, "u1")
    ).rejects.toThrow("tarefa do fluxo que esse tipo não cria");
    await expect(editarTarefaNaConferencia("p1", { ...EDICAO, data: "2026-11-21" }, "u1")).rejects.toThrow("depois da data fatal");
    await expect(editarTarefaNaConferencia("p1", { ...EDICAO, data: "2026-11-06" }, "u1")).rejects.toThrow("no passado");
    expect(tarefa().ajustes).toBeNull();
  });

  it("não mexe em tarefa de outra publicação", async () => {
    await expect(editarTarefaNaConferencia("p1", { ...EDICAO, agendamentoId: "outra" }, "u1")).rejects.toThrow("Tarefa não encontrada");
  });

  it("recusa depois que a tarefa foi para o robô: a alteração não chegaria ao VIOS", async () => {
    publicacao().status = "pronto_para_agendar";
    tarefa().envio_status = "pendente";
    await expect(editarTarefaNaConferencia("p1", { ...EDICAO, responsavel: "Carla Dias" }, "u1")).rejects.toThrow("não está mais na conferência");
    expect(tarefa().responsavel).toBe("Ana Souza");
  });

  it("recusa a publicação que voltou para o jurídico", async () => {
    publicacao().status = "juridico_vistar";
    await expect(editarTarefaNaConferencia("p1", { ...EDICAO, responsavel: "Carla Dias" }, "u1")).rejects.toThrow("não está mais na conferência");
  });
});

describe("a alteração chega ao robô", () => {
  it("ao validar, a fila leva a data, o responsável e o fluxo ajustados na conferência", async () => {
    await editarTarefaNaConferencia(
      "p1",
      {
        ...EDICAO,
        data: "2026-11-12",
        responsavel: "Carla Dias",
        revisor: "Ana Souza",
        fluxoDatas: [{ caminho: ["3. PROTOCOLAR"], data: "2026-11-18", responsaveis: ["Bia Lima"] }],
      },
      "u1"
    );
    await validarVistagem("p1", "u1");

    expect(fila.linhas).toHaveLength(1);
    expect(naFila()).toMatchObject({
      data: "12/11/2026",
      responsavel: "Carla Dias",
      revisor: "Ana Souza",
      fluxo_datas: [{ caminho: ["3. PROTOCOLAR"], data: "18/11/2026", responsaveis: ["Bia Lima"] }],
    });
    expect(tarefa().envio_status).toBe("pendente");
  });

  it("sem ajuste, a fila continua igual", async () => {
    await validarVistagem("p1", "u1");
    expect(naFila()).toMatchObject({ data: "17/11/2026", responsavel: "Ana Souza", revisor: "Bia Lima", fluxo_datas: [] });
  });

  it("prazo curto: o Enviar escolhido à mão não é trocado pelo de hoje", async () => {
    // Fatal 11/11: a conta daria o Enviar em 06/11, no passado, e o robô receberia o de hoje; a pessoa escolheu 10/11.
    Object.assign(tarefa(), { data: "2026-11-09", data_fatal: "2026-11-11" });
    await editarTarefaNaConferencia("p1", { ...EDICAO, dataFatal: "2026-11-11", data: "2026-11-10" }, "u1");
    await validarVistagem("p1", "u1");
    expect(naFila()).toMatchObject({ data: "10/11/2026" });
  });

  it("prazo curto validado noutro dia, sem ajuste: continua indo com a data de hoje", async () => {
    Object.assign(tarefa(), { data: "2026-11-06", data_fatal: "2026-11-11" });
    await validarVistagem("p1", "u1");
    expect(naFila()).toMatchObject({ data: "09/11/2026" });
  });

  it("erro no robô: ajusta e, ao rodar de novo, a fila leva o ajuste", async () => {
    publicacao().status = "pronto_para_agendar";
    Object.assign(tarefa(), { envio_status: "erro", envio_erro: "Responsável não encontrado" });
    await editarTarefaNaConferencia("p1", { ...EDICAO, responsavel: "Carla Dias" }, "u1");
    await rodarNovamente("p1", false);
    expect(naFila()).toMatchObject({ responsavel: "Carla Dias" });
    expect(tarefa()).toMatchObject({ envio_status: "pendente", envio_erro: null });
  });
});
