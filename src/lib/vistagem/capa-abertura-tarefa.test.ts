import { describe, expect, it } from "vitest";
import { tarefasDaAbertura, TAREFA_DA_PASTA_NOVA } from "./capa-abertura";
import { criarCalendario } from "./dias-uteis";

// A pasta aberta pelo robô já leva a ATUALIZAÇÃO DE CADASTRO, para o dia útil seguinte (pedido de 17/11/2026).
const TIPO_539 = { id: 539, etiquetas: [204], responsaveis: ["Ana Controle", "Davi Gestor"] };
const semFeriado = criarCalendario([]);

describe("tarefasDaAbertura", () => {
  it("a ATUALIZAÇÃO DE CADASTRO, com o tipo, a etiqueta e os fixos do cadastro", () => {
    expect(tarefasDaAbertura(TIPO_539, "2026-11-17", semFeriado)).toEqual([
      {
        tarefa: TAREFA_DA_PASTA_NOVA,
        tarefa_id: "539",
        etiqueta_id: "204",
        data: "18/11/2026",
        responsaveis_do_tipo: ["Ana Controle", "Davi Gestor"],
        observacao: expect.stringContaining("Conferir e completar o cadastro"),
      },
    ]);
  });

  it("aberta na sexta, a tarefa vai para a segunda", () => {
    expect(tarefasDaAbertura(TIPO_539, "2026-11-20", semFeriado)[0].data).toBe("23/11/2026");
  });

  it("pula o feriado", () => {
    expect(tarefasDaAbertura(TIPO_539, "2026-11-19", criarCalendario(["2026-11-20"]))[0].data).toBe("23/11/2026");
  });

  it("sem o tipo na cópia do SAMA, vai pelo nome, com a etiqueta PROVIDÊNCIA e sem fixos", () => {
    expect(tarefasDaAbertura(null, "2026-11-17", semFeriado)[0]).toMatchObject({
      tarefa: "ATUALIZAÇÃO DE CADASTRO",
      tarefa_id: null,
      etiqueta_id: "204",
      responsaveis_do_tipo: [],
    });
  });
});
