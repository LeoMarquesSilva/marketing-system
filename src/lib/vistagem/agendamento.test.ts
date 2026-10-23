import { describe, expect, it } from "vitest";
import { criarCalendario } from "./dias-uteis";
import { CADEIA_PADRAO } from "./fluxo-vios";
import {
  areaDoCatalogo,
  siglasDoNome,
  usuarioPorSigla,
  avisosDaData,
  LIMITE_TEOR_VIOS,
  montarObservacaoVios,
  paraDataVios,
  responsavelSugerido,
  tarefasPermitidas,
  validarAgendamentos,
  type EtapaVios,
  type OpcaoVios,
} from "./agendamento";

// etiquetas do VIOS: 1 ENVIAR (Prazo), 204 PROVIDÊNCIA, 205 COMPROMISSO, 2 REVISAR
const ETAPAS: EtapaVios[] = [
  { id: "321", nome: "1. CIÊNCIA DOS AGENDAMENTOS", etiquetas: [204] },
  { id: "54", nome: "AUDIÊNCIA DE INSTRUÇÃO", etiquetas: [205] },
  { id: "314", nome: "2. REVISAR", etiquetas: [2] },
  { id: "900", nome: "CONTESTAÇÃO", etiquetas: [1] },
  { id: "901", nome: "AGRAVO DE INSTRUMENTO", etiquetas: [1] },
  { id: "36", nome: "APELAÇÃO", etiquetas: [1] },
  { id: "486", nome: "APELAÇÃO", etiquetas: [1] },
  { id: "486", nome: "APELAÇÃO", etiquetas: [1] },
  { id: "999", nome: "TAREFA SEM ETIQUETA", etiquetas: [] },
];
const USUARIOS: OpcaoVios[] = [
  { id: "4", nome: "Advogada Exemplo" },
  { id: "5", nome: "Revisor Exemplo" },
];

describe("tarefasPermitidas", () => {
  it("separa prazo e providência pela etiqueta do VIOS e corta as outras", () => {
    expect(tarefasPermitidas(ETAPAS, "PRAZO").map((t) => t.nome)).toEqual([
      "AGRAVO DE INSTRUMENTO",
      "APELAÇÃO (tipo 36)",
      "APELAÇÃO (tipo 486)",
      "CONTESTAÇÃO",
    ]);
    expect(tarefasPermitidas(ETAPAS, "PROVIDENCIA").map((t) => t.nome)).toEqual(["1. CIÊNCIA DOS AGENDAMENTOS"]);
    expect(tarefasPermitidas(ETAPAS, "COMPROMISSO").map((t) => t.nome)).toEqual(["AUDIÊNCIA DE INSTRUÇÃO"]);
  });

  it("mantém os dois tipos com o mesmo nome, com o tipo no nome, e não repete o mesmo tipo", () => {
    const apelacoes = tarefasPermitidas(ETAPAS, "PRAZO").filter((t) => t.nomeVios === "APELAÇÃO");
    expect(apelacoes.map((t) => t.id)).toEqual(["36", "486"]);
    expect(tarefasPermitidas(ETAPAS, "PRAZO").find((t) => t.id === "900")?.nomeVios).toBeUndefined();
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
  const contexto = {
    tarefas: {
      PRAZO: tarefasPermitidas(ETAPAS, "PRAZO"),
      PROVIDENCIA: tarefasPermitidas(ETAPAS, "PROVIDENCIA"),
      COMPROMISSO: tarefasPermitidas(ETAPAS, "COMPROMISSO"),
    },
    usuarios: USUARIOS,
    ehDiaUtil: criarCalendario([]),
    cadeiaDaTarefa: () => CADEIA_PADRAO,
  };

  it("aceita tarefas da lista e resolve ids", () => {
    const resultado = validarAgendamentos(
      [{ etiqueta: "PRAZO", tarefa: "contestação", data: "", dataFatal: "2026-11-02", diasPrazo: 15, responsavel: "advogada exemplo", revisor: "Revisor Exemplo", observacao: " ver laudo " }],
      contexto
    );
    expect(resultado).toEqual({
      ok: true,
      itens: [
        {
          etiqueta: "PRAZO",
          tarefa: "CONTESTAÇÃO",
          tarefaId: "900",
          data: "2026-10-28",
          dataFatal: "2026-11-02",
          diasPrazo: 15,
          responsavel: "Advogada Exemplo",
          responsavelId: "4",
          revisor: "Revisor Exemplo",
          revisorId: "5",
          observacao: "ver laudo",
        },
      ],
    });
  });

  it("escolhe pelo tipo quando o VIOS tem dois com o mesmo nome e grava o nome do VIOS", () => {
    const resultado = validarAgendamentos(
      [{ etiqueta: "PRAZO", tarefa: "APELAÇÃO (tipo 486)", tarefaId: "486", data: "", dataFatal: "2026-11-02", responsavel: "Advogada Exemplo", revisor: "Revisor Exemplo" }],
      contexto
    );
    expect(resultado.ok && resultado.itens[0]).toMatchObject({ tarefa: "APELAÇÃO", tarefaId: "486" });
    const tipoForaDaLista = validarAgendamentos(
      [{ etiqueta: "PRAZO", tarefa: "APELAÇÃO", tarefaId: "314", data: "", dataFatal: "2026-11-02", responsavel: "Advogada Exemplo", revisor: "Revisor Exemplo" }],
      contexto
    );
    expect(tipoForaDaLista.ok).toBe(false);
  });

  it("compromisso usa a data do calendário e não exige revisor", () => {
    const resultado = validarAgendamentos(
      [{ etiqueta: "COMPROMISSO", tarefa: "AUDIÊNCIA DE INSTRUÇÃO", tarefaId: "54", data: "2026-11-10", responsavel: "Advogada Exemplo" }],
      contexto
    );
    expect(resultado.ok && resultado.itens[0]).toMatchObject({ etiqueta: "COMPROMISSO", tarefaId: "54", data: "2026-11-10", revisor: null });
    const naClasseErrada = validarAgendamentos(
      [{ etiqueta: "PROVIDENCIA", tarefa: "AUDIÊNCIA DE INSTRUÇÃO", tarefaId: "54", data: "2026-11-10", responsavel: "Advogada Exemplo" }],
      contexto
    );
    expect(naClasseErrada.ok).toBe(false);
  });

  it("no Prazo a data do VIOS segue o 3. PROTOCOLAR do fluxo da tarefa", () => {
    const entrada = [
      { etiqueta: "PRAZO" as const, tarefa: "CONTESTAÇÃO", data: "", dataFatal: "2026-11-02", responsavel: "Advogada Exemplo", revisor: "Revisor Exemplo" },
    ];
    // fluxo D-5: Protocolar 4 dias úteis depois do Enviar → Enviar = fatal − 5
    const d5 = validarAgendamentos(entrada, { ...contexto, cadeiaDaTarefa: () => ({ revisar: 1, protocolar: 4 }) });
    expect(d5.ok && d5.itens[0].data).toBe("2026-10-26");
    // sem Protocolar no fluxo: vai com a data do protocolo (fatal − 1)
    const semProtocolar = validarAgendamentos(entrada, { ...contexto, cadeiaDaTarefa: () => null });
    expect(semProtocolar.ok && semProtocolar.itens[0].data).toBe("2026-10-30");
  });

  it("recusa tarefa fora da lista, data inválida, responsável desconhecido e lista vazia", () => {
    const resultado = validarAgendamentos(
      [{ etiqueta: "PROVIDENCIA", tarefa: "AGRAVO INVENTADO", data: "2026-02-30", responsavel: "Fulano" }],
      contexto
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erros).toHaveLength(3);
    const semRevisor = validarAgendamentos(
      [{ etiqueta: "PRAZO", tarefa: "CONTESTAÇÃO", data: "", dataFatal: "2026-11-02", responsavel: "Advogada Exemplo" }],
      contexto
    );
    expect(semRevisor.ok).toBe(false);
    if (!semRevisor.ok) expect(semRevisor.erros.join(" ")).toMatch(/revisor é obrigatório/);
    const semFatal = validarAgendamentos(
      [{ etiqueta: "PRAZO", tarefa: "CONTESTAÇÃO", data: "2026-11-02", responsavel: "Advogada Exemplo", revisor: "Revisor Exemplo" }],
      contexto
    );
    expect(semFatal.ok).toBe(false);
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

  it("leva o teor inteiro da publicação depois do cabeçalho", () => {
    const publicacao = { dataPublicacao: "2026-10-14", tribunal: "TJSP", numeroProcesso: "1", djenIdComunicacao: null };
    expect(montarObservacaoVios({ ...publicacao, teor: "PROCESSO:1 ORGÃO:Vara TEXTO: Intime-se a parte." }, null)).toBe(
      "Publicação de 14/10/2026 · TJSP · Processo 1\nVistagem pelo Orquestra.\n\nTEOR DA PUBLICAÇÃO\nPROCESSO:1 ORGÃO:Vara\nTEXTO:\nIntime-se a parte."
    );
    const enorme = montarObservacaoVios({ ...publicacao, teor: "x".repeat(LIMITE_TEOR_VIOS + 500) }, null);
    expect(enorme).toContain(`(Teor cortado: 30.000 de 30.500 caracteres. Íntegra no Orquestra.)`);
    expect(enorme.length).toBeLessThan(LIMITE_TEOR_VIOS + 200);
  });
});

describe("auxiliar pela sigla", () => {
  const usuarios = [
    { id: "1", nome: "Fernanda Voltarelli Arnoni" },
    { id: "2", nome: "Maria Caroline da Cunha Thomé" },
    { id: "3", nome: "Fabio Vieira Alves" },
  ];
  it("monta a sigla com e sem preposições", () => {
    expect(siglasDoNome("Maria Caroline da Cunha Thomé")).toEqual(["MCCT", "MCDCT"]);
  });
  it("acha o usuário pela sigla e recusa sigla ambígua ou desconhecida", () => {
    expect(usuarioPorSigla("MCDCT", usuarios)?.id).toBe("2");
    expect(usuarioPorSigla("FVA", usuarios)).toBeNull();
    expect(usuarioPorSigla("ZZ", usuarios)).toBeNull();
  });
});
