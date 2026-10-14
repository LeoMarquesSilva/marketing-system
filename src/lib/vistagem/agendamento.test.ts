import { describe, expect, it } from "vitest";
import {
  areaDoCatalogo,
  avisosDaData,
  montarObservacaoVios,
  paraDataVios,
  responsavelSugerido,
  tarefasPermitidas,
  validarAgendamentos,
  type OpcaoVios,
} from "./agendamento";

const ETAPAS: OpcaoVios[] = [
  { id: "321", nome: "1. CIÊNCIA DOS AGENDAMENTOS" },
  { id: "510", nome: "2. REVISAR" },
  { id: "314", nome: "2. REVISAR" },
  { id: "900", nome: "CONTESTAÇÃO" },
  { id: "901", nome: "AGRAVO DE INSTRUMENTO" },
  { id: "999", nome: "TAREFA QUE NÃO ESTÁ NO DE-PARA" },
];
const USUARIOS: OpcaoVios[] = [
  { id: "4", nome: "Advogada Exemplo" },
  { id: "5", nome: "Revisor Exemplo" },
];

describe("tarefasPermitidas", () => {
  it("separa prazo e providência e corta o que não está no de-para", () => {
    expect(tarefasPermitidas(ETAPAS, "PRAZO").map((t) => t.nome)).toEqual(["AGRAVO DE INSTRUMENTO", "CONTESTAÇÃO"]);
    const providencias = tarefasPermitidas(ETAPAS, "PROVIDENCIA").map((t) => t.nome);
    expect(providencias).toContain("1. CIÊNCIA DOS AGENDAMENTOS");
    expect(providencias).not.toContain("TAREFA QUE NÃO ESTÁ NO DE-PARA");
  });

  it("não repete tarefas com o mesmo nome", () => {
    expect(tarefasPermitidas(ETAPAS, "PROVIDENCIA").filter((t) => t.nome === "2. REVISAR")).toHaveLength(1);
  });
});

describe("areaDoCatalogo", () => {
  const areas = ["Cível", "Cível | Insolvência", "Trabalhista", "Operações Legais"];
  it("usa a área do processo, ignorando acentos", () => {
    expect(areaDoCatalogo("CIVEL", "Cível", areas)).toBe("Cível");
  });
  it("cai para o escritório quando a pasta não tem área", () => {
    expect(areaDoCatalogo(null, "Reestruturação", areas)).toBe("Cível | Insolvência");
    expect(areaDoCatalogo(null, "Operações Legais", areas)).toBe("Operações Legais");
    expect(areaDoCatalogo(null, "Desconhecida", areas)).toBeNull();
  });
});

describe("validarAgendamentos", () => {
  const contexto = { tarefas: { PRAZO: tarefasPermitidas(ETAPAS, "PRAZO"), PROVIDENCIA: tarefasPermitidas(ETAPAS, "PROVIDENCIA") }, usuarios: USUARIOS };

  it("aceita tarefas da lista e resolve ids", () => {
    const resultado = validarAgendamentos(
      [{ etiqueta: "PRAZO", tarefa: "contestação", data: "2026-10-30", responsavel: "advogada exemplo", revisor: "Revisor Exemplo", observacao: " ver laudo " }],
      contexto
    );
    expect(resultado).toEqual({
      ok: true,
      itens: [
        {
          etiqueta: "PRAZO",
          tarefa: "CONTESTAÇÃO",
          tarefaId: "900",
          data: "2026-10-30",
          responsavel: "Advogada Exemplo",
          responsavelId: "4",
          revisor: "Revisor Exemplo",
          revisorId: "5",
          observacao: "ver laudo",
        },
      ],
    });
  });

  it("recusa tarefa fora da lista, data inválida, responsável desconhecido e lista vazia", () => {
    const resultado = validarAgendamentos(
      [{ etiqueta: "PRAZO", tarefa: "1. CIÊNCIA DOS AGENDAMENTOS", data: "2026-02-30", responsavel: "Fulano" }],
      contexto
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erros).toHaveLength(3);
    expect(validarAgendamentos([], contexto).ok).toBe(false);
  });
});

describe("auxiliares", () => {
  it("formata a data no padrão da fila do robô", () => {
    expect(paraDataVios("2026-10-30")).toBe("30/10/2026");
  });

  it("avisa data no passado e fim de semana", () => {
    expect(avisosDaData("2026-10-17", "2026-10-14")).toEqual(["Data cai em fim de semana."]);
    expect(avisosDaData("2026-10-13", "2026-10-14")).toEqual(["Data no passado."]);
    expect(avisosDaData("2026-10-15", "2026-10-14")).toEqual([]);
  });

  it("sugere o responsável da pasta quando ele é usuário do VIOS", () => {
    expect(responsavelSugerido("ADVOGADA EXEMPLO", USUARIOS)?.id).toBe("4");
    expect(responsavelSugerido("Outra Pessoa", USUARIOS)).toBeNull();
  });

  it("monta a descrição da tarefa com a referência da publicação", () => {
    expect(
      montarObservacaoVios({ dataPublicacao: "2026-10-14", tribunal: "TRT2", numeroProcesso: "0001234-56.2026.5.02.0001", djenIdComunicacao: 123 }, "Prazo de 8 dias")
    ).toBe("Publicação de 14/10/2026 · TRT2 · Processo 0001234-56.2026.5.02.0001 · ID comunicação 123\nPrazo de 8 dias\nVistagem pelo Orquestra.");
  });
});
