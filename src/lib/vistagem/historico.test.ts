import { describe, expect, it } from "vitest";
import { montarHistorico, type DadosDoHistorico, type TarefaNoHistorico } from "./historico";

const base = (extra: Partial<DadosDoHistorico> = {}): DadosDoHistorico => ({
  status: "controladoria_vistar",
  capturadaEm: "2026-11-09T10:43:45Z",
  colada: false,
  linhaArquivo: 40,
  dataPublicacao: "2026-11-09",
  triadaEm: "2026-11-09T10:43:47Z",
  pastaCi: "26160",
  pastaVinculo: "PROCESSO PRINCIPAL",
  escritorio: "Cível | Insolvência",
  pendencia: null,
  triagemResolvida: null,
  duplicidadeRevisada: null,
  transferencia: null,
  vistagem: null,
  devolucao: null,
  revistagem: null,
  conferencia: null,
  central: null,
  check: null,
  tarefas: [],
  inconsistencias: [],
  ...extra,
});

const tarefa = (extra: Partial<TarefaNoHistorico> = {}): TarefaNoHistorico => ({
  tarefa: "CIÊNCIA NF",
  data: "2026-11-10",
  responsavel: "Ligia",
  ajustes: [],
  envioStatus: "nao_enviado",
  envioSimulado: false,
  envioErro: null,
  enviadoEm: null,
  envioAtualizadoEm: null,
  ...extra,
});

describe("montarHistorico", () => {
  it("conta a transferência de área com quem fez e o motivo, e a triagem na área de antes (o caso 1054970-89)", () => {
    const eventos = montarHistorico(
      base({
        transferencia: { de: "Cível", por: "Ana", em: "2026-11-09T13:28:11Z", motivo: "Empresa com medida de reestruturação." },
        vistagem: { por: "Maria", em: "2026-11-09T19:57:48Z", observacao: null },
        tarefas: [tarefa()],
      })
    );
    expect(eventos.map((evento) => evento.tipo)).toEqual(["chegada", "triagem", "transferencia", "vistagem"]);
    expect(eventos[1].detalhes).toEqual(["Pasta CI 26160 (PROCESSO PRINCIPAL)", "Área: Cível"]);
    expect(eventos[2]).toMatchObject({
      titulo: "Transferida de Cível para Cível | Insolvência",
      por: "Ana",
      detalhes: ["Motivo: Empresa com medida de reestruturação."],
    });
    expect(eventos[3].detalhes).toEqual(["CIÊNCIA NF · 10/11/2026 · Ligia"]);
  });

  it("reabertura para alterar antes da Conferência aparece com quem reabriu (pedido de 11/11/2026)", () => {
    const eventos = montarHistorico(
      base({
        reabertura: { por: "Ana", em: "2026-11-09T12:30:00Z" },
        vistagem: { por: "Ana", em: "2026-11-09T12:40:00Z", observacao: null },
      })
    );
    expect(eventos.map((evento) => evento.tipo)).toEqual(["chegada", "triagem", "reabertura", "vistagem"]);
    expect(eventos[2]).toMatchObject({ titulo: "Vistagem reaberta para alterar, antes da Conferência", por: "Ana" });
    expect(montarHistorico(base()).some((evento) => evento.tipo === "reabertura")).toBe(false);
  });

  it("põe tudo em ordem de tempo", () => {
    const eventos = montarHistorico(
      base({
        vistagem: { por: "Maria", em: "2026-11-09T12:00:00Z", observacao: "ok" },
        devolucao: { por: "Bia", em: "2026-11-09T13:00:00Z", motivo: "data errada", total: 2 },
        revistagem: { por: "Maria", em: "2026-11-09T14:00:00Z" },
        conferencia: { por: "Bia", em: "2026-11-09T15:00:00Z" },
        inconsistencias: [
          {
            id: "i1", origem: "juridico", tipo: "Data", subtipo: null, descricao: "data errada", criadoPor: "Bia",
            criadoEm: "2026-11-09T13:00:01Z", contestacao: null, contestadoPor: null, contestadoEm: null,
            excluidaEm: null, excluidaPor: null, motivoExclusao: null,
          },
        ],
        tarefas: [tarefa({ ajustes: [{ por: "Bia", em: "2026-11-09T14:30:00Z", mudancas: [{ campo: "Data", de: "10/11", para: "11/11" }] }] })],
      })
    );
    expect(eventos.map((evento) => evento.tipo)).toEqual([
      "chegada", "triagem", "vistagem", "devolucao", "inconsistencia", "revistagem", "ajuste", "conferencia",
    ]);
    // Depois da devolução, as tarefas aparecem na nova vistagem, não na primeira.
    expect(eventos[2].detalhes).toEqual(["Observação: ok"]);
    expect(eventos[5].detalhes).toEqual(["CIÊNCIA NF · 10/11/2026 · Ligia"]);
    expect(eventos[3].detalhes).toEqual(["Motivo: data errada", "Foi devolvida 2 vezes; aqui aparece a última."]);
    expect(eventos[6].detalhes).toEqual(["Data: 10/11 → 11/11"]);
  });

  it("junta as tarefas enviadas juntas e mostra o que o robô respondeu em cada uma", () => {
    const enviadoEm = "2026-11-09T15:00:00Z";
    const eventos = montarHistorico(
      base({
        conferencia: { por: "Bia", em: enviadoEm },
        tarefas: [
          tarefa({ tarefa: "PRAZO", enviadoEm, envioStatus: "concluido", envioAtualizadoEm: "2026-11-09T15:05:00Z" }),
          tarefa({ tarefa: "CIÊNCIA", enviadoEm, envioStatus: "erro", envioErro: "Não achou a pasta", envioAtualizadoEm: "2026-11-09T15:06:00Z" }),
          tarefa({
            tarefa: "SESSÃO", enviadoEm, envioStatus: "pendente", envioAtualizadoEm: "2026-11-09T15:07:00Z",
            envioErro: "Aguardando a disponibilidade da publicação no VIOS. Próxima tentativa às 13:07.",
          }),
        ],
      })
    );
    const doRobo = eventos.filter((evento) => evento.tipo.startsWith("robo_"));
    expect(doRobo.map((evento) => [evento.tipo, evento.titulo])).toEqual([
      ["robo_envio", "3 tarefas enviadas ao robô"],
      ["robo_ok", "PRAZO agendada no VIOS"],
      ["robo_erro", "CIÊNCIA: erro no robô"],
      ["robo_espera", "SESSÃO: aguardando a publicação no VIOS"],
    ]);
    expect(doRobo[2].detalhes).toEqual(["Não achou a pasta"]);
  });

  it("sem pasta: conferida para a Central, com o item criado ou o erro", () => {
    const criada = montarHistorico(
      base({
        status: "abertura_pasta",
        pastaCi: null,
        pendencia: "sem_pasta",
        conferencia: { por: "Bia", em: "2026-11-09T15:00:00Z" },
        central: { itemId: "64033", enviadaEm: "2026-11-09T15:00:02Z", erro: null, tentativaEm: null },
      })
    );
    expect(criada.find((evento) => evento.tipo === "triagem")?.detalhes).toEqual(["Pendência: sem pasta no VIOS", "Área: Cível | Insolvência"]);
    expect(criada.find((evento) => evento.tipo === "conferencia")?.titulo).toBe("Conferida e enviada à Central (abertura de pasta)");
    expect(criada.find((evento) => evento.tipo === "central")?.detalhes).toEqual(["Item 64033"]);

    const comErro = montarHistorico(
      base({
        status: "abertura_pasta",
        conferencia: { por: "Bia", em: "2026-11-09T15:00:00Z" },
        central: { itemId: null, enviadaEm: null, erro: "timeout", tentativaEm: "2026-11-09T15:10:00Z" },
      })
    );
    expect(comErro.at(-1)).toMatchObject({ tipo: "central_erro", em: "2026-11-09T15:10:00Z", detalhes: ["timeout"] });
  });

  it("colada na vistagem não fala de linha do arquivo; pendência resolvida mostra quem resolveu", () => {
    const eventos = montarHistorico(
      base({ colada: true, pendencia: null, triagemResolvida: { por: "Bia", em: "2026-11-09T11:00:00Z" } })
    );
    expect(eventos[0]).toMatchObject({ titulo: "Colada na vistagem", detalhes: ["Publicada em 09/11/2026"] });
    expect(eventos[1].detalhes).toEqual(["Ficou pendente na triagem"]);
    expect(eventos[2]).toMatchObject({ tipo: "pendencia", por: "Bia", detalhes: ["Pasta CI 26160 (PROCESSO PRINCIPAL)", "Área: Cível | Insolvência"] });
  });
});
