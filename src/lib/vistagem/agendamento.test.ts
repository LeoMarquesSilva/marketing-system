import { describe, expect, it } from "vitest";
import { criarCalendario } from "./dias-uteis";
import { CADEIA_PADRAO } from "./fluxo-vios";
import {
  areaDoCatalogo,
  areasDaPessoa,
  departamentoNaVistagem,
  escritorioDaArea,
  pessoasDaArea,
  TODAS_AS_AREAS,
  siglasDoNome,
  usuarioPorSigla,
  avisosDaData,
  LIMITE_TEOR_VIOS,
  atalhosDePrazo,
  montarObservacaoVios,
  referenciaDaPublicacao,
  responsaveisNaArea,
  separarNomes,
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
      [{ etiqueta: "PRAZO", tarefa: "contestação", data: "", dataFatal: "2026-11-02", diasPrazo: 15, contagemPrazo: "corridos", responsavel: "advogada exemplo", revisor: "Revisor Exemplo", observacao: " ver laudo " }],
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
          contagemPrazo: "corridos",
          hora: null,
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
      [{ etiqueta: "PRAZO", tarefa: "APELAÇÃO (tipo 486)", tarefaId: "486", data: "", dataFatal: "2026-11-02", responsavel: "Advogada Exemplo", revisor: "Revisor Exemplo", observacao: "ver teor" }],
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
      [{ etiqueta: "COMPROMISSO", tarefa: "AUDIÊNCIA DE INSTRUÇÃO", tarefaId: "54", data: "2026-11-10", hora: "14:30", responsavel: "Advogada Exemplo", observacao: "levar testemunhas" }],
      contexto
    );
    expect(resultado.ok && resultado.itens[0]).toMatchObject({ etiqueta: "COMPROMISSO", tarefaId: "54", data: "2026-11-10", hora: "14:30", revisor: null });
    const naClasseErrada = validarAgendamentos(
      [{ etiqueta: "PROVIDENCIA", tarefa: "AUDIÊNCIA DE INSTRUÇÃO", tarefaId: "54", data: "2026-11-10", responsavel: "Advogada Exemplo" }],
      contexto
    );
    expect(naClasseErrada.ok).toBe(false);
  });

  it("atalho de dias exige a contagem (úteis ou corridos); fatal no calendário não", () => {
    const prazo = { etiqueta: "PRAZO" as const, tarefa: "CONTESTAÇÃO", data: "", dataFatal: "2026-11-02", responsavel: "Advogada Exemplo", revisor: "Revisor Exemplo", observacao: "ver teor" };
    expect(validarAgendamentos([{ ...prazo, diasPrazo: 15 }], contexto)).toEqual({
      ok: false,
      erros: ["Tarefa 1: escolha se o prazo é em dias úteis ou corridos."],
    });
    expect(validarAgendamentos([{ ...prazo, diasPrazo: 15, contagemPrazo: "uteis" }], contexto)).toMatchObject({ ok: true, itens: [{ contagemPrazo: "uteis" }] });
    // sem atalho, a contagem que vier é descartada
    expect(validarAgendamentos([{ ...prazo, contagemPrazo: "corridos" }], contexto)).toMatchObject({
      ok: true,
      itens: [{ diasPrazo: null, contagemPrazo: null }],
    });
  });

  it("compromisso exige o horário; nas outras classes ele é ignorado", () => {
    const audiencia = { etiqueta: "COMPROMISSO" as const, tarefa: "AUDIÊNCIA DE INSTRUÇÃO", tarefaId: "54", data: "2026-11-10", responsavel: "Advogada Exemplo", observacao: "ver teor" };
    for (const hora of [undefined, null, "", "24:00", "9:30", "14h30"]) {
      const resultado = validarAgendamentos([{ ...audiencia, hora }], contexto);
      expect(resultado).toEqual({ ok: false, erros: ["Tarefa 1: informe o horário do compromisso."] });
    }
    expect(validarAgendamentos([{ ...audiencia, hora: " 09:05 " }], contexto)).toMatchObject({ ok: true, itens: [{ hora: "09:05" }] });
    const providencia = validarAgendamentos(
      [{ etiqueta: "PROVIDENCIA", tarefa: "1. CIÊNCIA DOS AGENDAMENTOS", data: "2026-11-10", hora: "10:00", responsavel: "Advogada Exemplo", observacao: "ciência" }],
      contexto
    );
    expect(providencia.ok && providencia.itens[0].hora).toBeNull();
  });

  it("no Prazo a data do VIOS segue o 3. PROTOCOLAR do fluxo da tarefa", () => {
    const entrada = [
      { etiqueta: "PRAZO" as const, tarefa: "CONTESTAÇÃO", data: "", dataFatal: "2026-11-02", responsavel: "Advogada Exemplo", revisor: "Revisor Exemplo", observacao: "ver teor" },
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
    // tarefa fora da lista, data inválida, responsável desconhecido e observação vazia
    if (!resultado.ok) expect(resultado.erros).toHaveLength(4);
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

  it("exige a observação, que vai na descrição da tarefa", () => {
    const providencia = { etiqueta: "PROVIDENCIA" as const, tarefa: "1. CIÊNCIA DOS AGENDAMENTOS", data: "2026-11-10", responsavel: "Advogada Exemplo" };
    expect(validarAgendamentos([{ ...providencia, observacao: "  " }], contexto)).toEqual({
      ok: false,
      erros: ["Tarefa 1: escreva a observação (vai na descrição da tarefa)."],
    });
    expect(validarAgendamentos([{ ...providencia, observacao: "prazo do reclamante" }], contexto).ok).toBe(true);
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

  it("a descrição da tarefa é só a observação (o VIOS junta o texto da intimação)", () => {
    expect(montarObservacaoVios(null, " Prazo de 8 dias ")).toBe("Prazo de 8 dias");
    expect(referenciaDaPublicacao({ dataPublicacao: "2026-10-14", tribunal: "TRT2", numeroProcesso: "0001234-56.2026.5.02.0001", djenIdComunicacao: 123 })).toBe(
      "Publicação de 14/10/2026 · TRT2 · Processo 0001234-56.2026.5.02.0001 · ID comunicação 123"
    );
  });

  it("na pasta leva a observação e o teor inteiro da publicação, sem cabeçalho", () => {
    expect(montarObservacaoVios("PROCESSO:1 ORGÃO:Vara TEXTO: Intime-se a parte.", "ver laudo")).toBe(
      "ver laudo\n\nTEOR DA PUBLICAÇÃO\nPROCESSO:1 ORGÃO:Vara\nTEXTO:\nIntime-se a parte."
    );
    expect(montarObservacaoVios("Intime-se a parte.", null)).toBe("TEOR DA PUBLICAÇÃO\nIntime-se a parte.");
    const enorme = montarObservacaoVios("x".repeat(LIMITE_TEOR_VIOS + 500), null);
    expect(enorme).toContain(`(Teor cortado: 30.000 de 30.500 caracteres. Íntegra no Orquestra.)`);
    expect(enorme.length).toBeLessThan(LIMITE_TEOR_VIOS + 200);
  });

  it("o Trabalhista tem atalhos de 8 e 16 dias", () => {
    expect(atalhosDePrazo("Trabalhista")).toEqual([5, 8, 10, 15, 16, 30, 60, 90, 180]);
    expect(atalhosDePrazo("Cível")).toEqual([5, 10, 15, 30, 60, 90, 180]);
  });
});

describe("responsáveis", () => {
  it("separa nomes por vírgula sem repetir", () => {
    expect(separarNomes(" Maria Julia , Isadora,, maria julia ,Samuel ")).toEqual(["Maria Julia", "Isadora", "Samuel"]);
    expect(separarNomes(null)).toEqual([]);
  });

  it("os responsáveis fixos do tipo vão para a opção da lista", () => {
    const etapas: EtapaVios[] = [{ id: "539", nome: "ATUALIZAÇÃO DE CADASTRO", etiquetas: [204], responsaveis: ["Maria Julia", "Isadora"] }];
    expect(tarefasPermitidas(etapas, "PROVIDENCIA")).toEqual([{ id: "539", nome: "ATUALIZAÇÃO DE CADASTRO", responsaveis: ["Maria Julia", "Isadora"] }]);
  });

  it("só ficam os que são usuários do VIOS na área, com a grafia de lá", () => {
    expect(responsaveisNaArea(["advogada exemplo", "Fora da Lista"], USUARIOS)).toEqual(["Advogada Exemplo"]);
  });

  it("aceita mais de um responsável e guarda nomes e ids na ordem", () => {
    const providencia = { etiqueta: "PROVIDENCIA" as const, tarefa: "1. CIÊNCIA DOS AGENDAMENTOS", data: "2026-11-10", observacao: "ciência" };
    const resultado = validarAgendamentos([{ ...providencia, responsavel: "revisor exemplo, Advogada Exemplo" }], {
      tarefas: { PRAZO: [], PROVIDENCIA: tarefasPermitidas(ETAPAS, "PROVIDENCIA"), COMPROMISSO: [] },
      usuarios: USUARIOS,
      ehDiaUtil: () => true,
      cadeiaDaTarefa: () => null,
    });
    expect(resultado.ok && resultado.itens[0]).toMatchObject({ responsavel: "Revisor Exemplo, Advogada Exemplo", responsavelId: "5,4" });
    const comUmFora = validarAgendamentos([{ ...providencia, responsavel: "Advogada Exemplo, Fulano" }], {
      tarefas: { PRAZO: [], PROVIDENCIA: tarefasPermitidas(ETAPAS, "PROVIDENCIA"), COMPROMISSO: [] },
      usuarios: USUARIOS,
      ehDiaUtil: () => true,
      cadeiaDaTarefa: () => null,
    });
    expect(comUmFora.ok).toBe(false);
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

describe("pessoas da área", () => {
  const usuarios: OpcaoVios[] = [
    { id: "1", nome: "Advogada Trabalhista" },
    { id: "2", nome: "Advogado Cível" },
    { id: "3", nome: "Advogada Reestruturação" },
    { id: "4", nome: "Sócio Patrimonial" },
    { id: "5", nome: "Pessoa Sem Cadastro" },
    { id: "6", nome: "Líder de Crédito" },
    { id: "7", nome: "Analista da Controladoria" },
  ];
  const areasDe: Record<string, string[]> = {
    "ADVOGADA TRABALHISTA": areasDaPessoa("Trabalhista"),
    "ADVOGADO CIVEL": areasDaPessoa("Cível"),
    "ADVOGADA REESTRUTURACAO": areasDaPessoa("Insolvência"),
    "SOCIO PATRIMONIAL": areasDaPessoa("Sócio"),
    "LIDER DE CREDITO": areasDaPessoa("Recuperação de Crédito", ["Recuperação de Crédito", "Trabalhista"]),
    "ANALISTA DA CONTROLADORIA": areasDaPessoa("Operações Legais"),
  };

  it("traduz os nomes de área do RH, do VIOS e de Usuários para os escritórios", () => {
    expect(escritorioDaArea("Cível | Insolvência")).toBe("Reestruturação");
    expect(escritorioDaArea("Insolvência")).toBe("Reestruturação");
    expect(escritorioDaArea("Special Situations")).toBe("Distressed Deals");
    expect(escritorioDaArea("Operações Legais (Legal Ops)")).toBe("Operações Legais");
    expect(escritorioDaArea("Societário e Contratos")).toBe("Contratos");
    expect(escritorioDaArea(" Trabalhista ")).toBe("Trabalhista");
    expect(escritorioDaArea("")).toBeNull();
  });

  it("a pessoa vale para o departamento e o escopo de liderança; sócio e escopo * valem para todas", () => {
    expect(areasDaPessoa("Insolvência", ["Reestruturação"])).toEqual(["Reestruturação"]);
    expect(areasDaPessoa("Recuperação de Crédito", ["Trabalhista"])).toEqual(["Recuperação de Crédito", "Trabalhista"]);
    expect(areasDaPessoa("Sócio")).toEqual([TODAS_AS_AREAS]);
    expect(areasDaPessoa("Facilities", ["*"])).toEqual(["Facilities", TODAS_AS_AREAS]);
    expect(areasDaPessoa(null)).toEqual([]);
  });

  it("publicação do Trabalhista mostra a área, os sócios, a liderança e quem não tem área conhecida", () => {
    expect(pessoasDaArea(usuarios, areasDe, ["Trabalhista", "Trabalhista"])).toEqual({
      area: "Trabalhista",
      nomes: ["Advogada Trabalhista", "Sócio Patrimonial", "Pessoa Sem Cadastro", "Líder de Crédito"],
    });
  });

  it("as pessoas da pasta (advogado e auxiliar) aparecem mesmo sendo de outra área", () => {
    expect(pessoasDaArea(usuarios, areasDe, ["Trabalhista"], ["advogado civel", null])?.nomes).toContain("Advogado Cível");
  });

  it("junta o escritório da fila e a área do processo (ex-cliente em Operações Legais)", () => {
    const resultado = pessoasDaArea(usuarios, areasDe, ["Operações Legais", "Trabalhista"]);
    expect(resultado?.area).toBe("Operações Legais e Trabalhista");
    expect(resultado?.nomes).toEqual(["Advogada Trabalhista", "Sócio Patrimonial", "Pessoa Sem Cadastro", "Líder de Crédito", "Analista da Controladoria"]);
  });

  it("a área do catálogo do VIOS vira o escritório (Cível | Insolvência é Reestruturação)", () => {
    expect(pessoasDaArea(usuarios, areasDe, ["Reestruturação", "Cível | Insolvência"])).toEqual({
      area: "Reestruturação",
      nomes: ["Advogada Reestruturação", "Sócio Patrimonial", "Pessoa Sem Cadastro"],
    });
  });

  it("sem ninguém da área ou sem área, não filtra (lista inteira)", () => {
    expect(pessoasDaArea(usuarios, areasDe, ["Special Situations"])).toBeNull();
    expect(pessoasDaArea(usuarios, areasDe, [null, ""])).toBeNull();
    expect(pessoasDaArea(usuarios, {}, ["Trabalhista"])).toBeNull();
  });
});

describe("departamentoNaVistagem", () => {
  const controladoria = { chave: "controladoria", rotulo: "Controladoria Jurídica" };
  const financeiro = { chave: "financeiro", rotulo: "Financeiro" };

  it("em Operações Legais só a Controladoria (e a liderança, sem time) continua na área", () => {
    expect(departamentoNaVistagem("Operações Legais", [controladoria])).toBe("Operações Legais");
    expect(departamentoNaVistagem("Operações Legais", [])).toBe("Operações Legais");
    expect(departamentoNaVistagem("Operações Legais", [financeiro])).toBe("Financeiro");
    expect(departamentoNaVistagem("Operações Legais (Legal Ops)", [financeiro, controladoria])).toBe("Operações Legais (Legal Ops)");
  });

  it("não mexe nas outras áreas", () => {
    expect(departamentoNaVistagem("Trabalhista", [financeiro])).toBe("Trabalhista");
    expect(departamentoNaVistagem(null, [financeiro])).toBeNull();
  });
});
