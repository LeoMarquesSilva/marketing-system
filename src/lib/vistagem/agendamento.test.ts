import { describe, expect, it } from "vitest";
import { criarCalendario } from "./dias-uteis";
import { CADEIA_PADRAO } from "./fluxo-vios";
import {
  areaDoCatalogo,
  areasDaPessoa,
  classeDasEtiquetas,
  contagemPadraoDaArea,
  contagemPadraoDaPublicacao,
  departamentoNaVistagem,
  nomesDasPessoas,
  escritorioDaArea,
  pessoasDaArea,
  TODAS_AS_AREAS,
  siglasDoNome,
  usuarioPorSigla,
  avisosDaData,
  atalhosDePrazo,
  montarObservacaoVios,
  dataLimiteDaTarefa,
  dataPadraoDaTarefa,
  observacaoObrigatoria,
  origemDoPrazo,
  pedeDataLimite,
  referenciaDaPublicacao,
  responsaveisNaArea,
  separarNomes,
  paraDataVios,
  responsavelSugerido,
  revisorFicaNaTarefa,
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
  const areas = ["Cível", "Cível | Insolvência", "Insolvência", "Trabalhista", "Operações Legais"];
  it("usa a área do processo, ignorando acentos", () => {
    expect(areaDoCatalogo("CIVEL", "Cível", areas)).toBe("Cível");
    expect(areaDoCatalogo("Insolvência", "Cível | Insolvência", areas)).toBe("Insolvência");
  });
  it("cai para o escritório quando a pasta não tem área", () => {
    expect(areaDoCatalogo(null, "Cível | Insolvência", areas)).toBe("Cível | Insolvência");
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
          origemPrazo: null,
          hora: null,
          horaFim: null,
          dataLimite: null,
          responsavel: "Advogada Exemplo",
          responsavelId: "4",
          revisor: "Revisor Exemplo",
          revisorId: "5",
          observacao: "ver laudo",
          fluxoDatas: [],
        },
      ],
    });
  });

  describe("SESSÃO DE JULGAMENTO: data limite própria", () => {
    const comSessao = {
      ...contexto,
      tarefas: { ...contexto.tarefas, COMPROMISSO: [...contexto.tarefas.COMPROMISSO, { id: "406", nome: "SESSÃO DE JULGAMENTO" }] },
    };
    const sessao = (extra: Record<string, unknown>) => ({
      etiqueta: "COMPROMISSO" as const,
      tarefa: "SESSÃO DE JULGAMENTO",
      tarefaId: "406",
      data: "2026-11-19",
      hora: "09:00",
      responsavel: "Advogada Exemplo",
      ...extra,
    });

    it("reconhece o tipo pelo nome do VIOS", () => {
      expect(pedeDataLimite("SESSÃO DE JULGAMENTO")).toBe(true);
      expect(pedeDataLimite("sessao de julgamento")).toBe(true);
      expect(pedeDataLimite("AUDIÊNCIA DE INSTRUÇÃO")).toBe(false);
    });

    it("sem escolha, a data limite é a própria data", () => {
      const resultado = validarAgendamentos([sessao({})], comSessao);
      expect(resultado.ok && resultado.itens[0].dataLimite).toBe("2026-11-19");
    });

    it("a escolhida vale quando é a data ou depois", () => {
      const resultado = validarAgendamentos([sessao({ dataLimite: "2026-11-25" })], comSessao);
      expect(resultado.ok && resultado.itens[0]).toMatchObject({ data: "2026-11-19", dataLimite: "2026-11-25" });
    });

    it("antes da data, não passa", () => {
      const resultado = validarAgendamentos([sessao({ dataLimite: "2026-11-18" })], comSessao);
      expect(resultado).toEqual({ ok: false, erros: ["Tarefa 1: a data limite tem de ser a data para conclusão ou depois."] });
    });

    it("nos outros tipos a data limite não existe, mesmo se vier", () => {
      const resultado = validarAgendamentos([sessao({ tarefa: "AUDIÊNCIA DE INSTRUÇÃO", tarefaId: "54", dataLimite: "2026-11-25" })], comSessao);
      expect(resultado.ok && resultado.itens[0].dataLimite).toBeNull();
    });

    it("dataLimiteDaTarefa: inválida ou antes da data vira a própria data", () => {
      expect(dataLimiteDaTarefa("SESSÃO DE JULGAMENTO", "2026-11-19", "xx")).toBe("2026-11-19");
      expect(dataLimiteDaTarefa("SESSÃO DE JULGAMENTO", "2026-11-19", "2026-11-01")).toBe("2026-11-19");
      expect(dataLimiteDaTarefa("SESSÃO DE JULGAMENTO", "", "2026-11-25")).toBeNull();
      expect(dataLimiteDaTarefa("PERÍCIA", "2026-11-19", "2026-11-25")).toBeNull();
    });
  });

  describe("CIÊNCIA NF: observação obrigatória", () => {
    const comCiencia = {
      ...contexto,
      tarefas: {
        ...contexto.tarefas,
        PROVIDENCIA: [
          ...contexto.tarefas.PROVIDENCIA,
          { id: "796", nome: "CIÊNCIA NF" },
          { id: "316", nome: "CIÊNCIA NF (tipo 316)", nomeVios: "CIÊNCIA NF" },
        ],
      },
    };
    const nf = (extra: Record<string, unknown>) => ({ etiqueta: "PROVIDENCIA" as const, tarefa: "CIÊNCIA NF", data: "2026-11-10", responsavel: "Advogada Exemplo", ...extra });

    it("já vem com o dia útil seguinte ao da vistagem (pedido de 11/11/2026); os outros tipos começam vazios", () => {
      const ehDiaUtil = criarCalendario(["2026-11-20"]);
      expect(dataPadraoDaTarefa("CIÊNCIA NF", "2026-11-11", ehDiaUtil)).toBe("2026-11-12");
      // sexta → segunda
      expect(dataPadraoDaTarefa(" ciencia nf ", "2026-11-13", ehDiaUtil)).toBe("2026-11-16");
      // quinta, com a sexta 20/11 feriado → segunda
      expect(dataPadraoDaTarefa("CIÊNCIA NF", "2026-11-19", ehDiaUtil)).toBe("2026-11-23");
      expect(dataPadraoDaTarefa("1. CIÊNCIA DOS AGENDAMENTOS", "2026-11-11", ehDiaUtil)).toBeNull();
      expect(dataPadraoDaTarefa("SUBSÍDIOS / PROCURAÇÃO", "2026-11-11", ehDiaUtil)).toBeNull();
      expect(dataPadraoDaTarefa(null, "2026-11-11", ehDiaUtil)).toBeNull();
    });

    it("reconhece o tipo pelo nome do VIOS, sem acento e sem diferença de caixa", () => {
      expect(observacaoObrigatoria("CIÊNCIA NF")).toBe(true);
      expect(observacaoObrigatoria(" ciencia nf ")).toBe(true);
      expect(observacaoObrigatoria("1. CIÊNCIA DOS AGENDAMENTOS")).toBe(false);
      expect(observacaoObrigatoria(null)).toBe(false);
    });

    it("sem observação, não passa; só espaços também não", () => {
      for (const observacao of [undefined, "", "   "]) {
        const resultado = validarAgendamentos([nf({ observacao })], comCiencia);
        expect(resultado).toEqual({ ok: false, erros: ["Tarefa 1: na CIÊNCIA NF a observação é obrigatória (vai como justificativa no VIOS)."] });
      }
    });

    it("com observação, passa", () => {
      const resultado = validarAgendamentos([nf({ observacao: " Sem providência: só ciência. " })], comCiencia);
      expect(resultado.ok && resultado.itens[0]).toMatchObject({ tarefa: "CIÊNCIA NF", tarefaId: "796", observacao: "Sem providência: só ciência." });
    });

    it("vale também quando a lista mostra o tipo no fim do nome", () => {
      const resultado = validarAgendamentos([nf({ tarefa: "CIÊNCIA NF (tipo 316)", tarefaId: "316" })], comCiencia);
      expect(resultado.ok).toBe(false);
    });

    it("as outras tarefas continuam com a observação opcional", () => {
      const resultado = validarAgendamentos([nf({ tarefa: "1. CIÊNCIA DOS AGENDAMENTOS" })], comCiencia);
      expect(resultado.ok).toBe(true);
    });

    it("a Conferência não exige: ali só se ajusta data e pessoas", () => {
      const resultado = validarAgendamentos([nf({})], { ...comCiencia, exigirObservacao: false });
      expect(resultado.ok).toBe(true);
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

  it("hora final do compromisso: a escolhida, 1 hora depois por padrão, e nunca antes da inicial", () => {
    const audiencia = { etiqueta: "COMPROMISSO" as const, tarefa: "AUDIÊNCIA DE INSTRUÇÃO", tarefaId: "54", data: "2026-11-10", hora: "09:30", responsavel: "Advogada Exemplo" };
    const padrao = validarAgendamentos([audiencia], contexto);
    expect(padrao.ok && padrao.itens[0].horaFim).toBe("10:30");
    const escolhida = validarAgendamentos([{ ...audiencia, horaFim: "12:00" }], contexto);
    expect(escolhida.ok && escolhida.itens[0].horaFim).toBe("12:00");
    const antes = validarAgendamentos([{ ...audiencia, horaFim: "09:00" }], contexto);
    expect(antes.ok).toBe(false);
    const providencia = validarAgendamentos(
      [{ etiqueta: "PROVIDENCIA", tarefa: "1. CIÊNCIA DOS AGENDAMENTOS", tarefaId: "321", data: "2026-11-10", horaFim: "12:00", responsavel: "Advogada Exemplo" }],
      contexto
    );
    expect(providencia.ok && providencia.itens[0].horaFim).toBeNull();
  });

  it("compromisso usa a data do calendário e não exige revisor", () => {
    const resultado = validarAgendamentos(
      [{ etiqueta: "COMPROMISSO", tarefa: "AUDIÊNCIA DE INSTRUÇÃO", tarefaId: "54", data: "2026-11-10", hora: "14:30", responsavel: "Advogada Exemplo", observacao: "levar testemunhas" }],
      contexto
    );
    expect(resultado.ok && resultado.itens[0]).toMatchObject({ etiqueta: "COMPROMISSO", tarefaId: "54", data: "2026-11-10", hora: "14:30", horaFim: "15:30", revisor: null });
    const naClasseErrada = validarAgendamentos(
      [{ etiqueta: "PROVIDENCIA", tarefa: "AUDIÊNCIA DE INSTRUÇÃO", tarefaId: "54", data: "2026-11-10", responsavel: "Advogada Exemplo" }],
      contexto
    );
    expect(naClasseErrada.ok).toBe(false);
  });

  it("providência grava sem revisor, mesmo que a tela mande um (nem confere o nome)", () => {
    const resultado = validarAgendamentos(
      [{ etiqueta: "PROVIDENCIA", tarefa: "1. CIÊNCIA DOS AGENDAMENTOS", tarefaId: "321", data: "2026-11-10", responsavel: "Advogada Exemplo", revisor: "Fulano Fora da Lista" }],
      contexto
    );
    expect(resultado.ok).toBe(true);
    expect(resultado.ok && resultado.itens[0]).toMatchObject({ etiqueta: "PROVIDENCIA", revisor: null, revisorId: null });
  });

  it("guarda de onde veio o prazo (pedido de 11/11/2026), só no Prazo com fatal e coerente com os dias", () => {
    const prazo = { etiqueta: "PRAZO" as const, tarefa: "CONTESTAÇÃO", data: "", dataFatal: "2026-11-02", responsavel: "Advogada Exemplo", revisor: "Revisor Exemplo", observacao: "ver teor" };
    const origem = (entrada: Record<string, unknown>) => {
      const resultado = validarAgendamentos([{ ...prazo, ...entrada }], contexto);
      return resultado.ok ? resultado.itens[0].origemPrazo : "inválido";
    };
    expect(origem({ diasPrazo: 15, contagemPrazo: "uteis", origemPrazo: "atalho" })).toBe("atalho");
    expect(origem({ origemPrazo: "calendario" })).toBe("calendario");
    // a IA pode dar a fatal sem os dias
    expect(origem({ origemPrazo: "sugestao_ia" })).toBe("sugestao_ia");
    // botões, prazo legal e publicação sem os dias marcados: a fatal mudou depois, não se sabe
    expect(origem({ origemPrazo: "atalho" })).toBeNull();
    expect(origem({ origemPrazo: "qualquer" })).toBeNull();
    expect(origem({})).toBeNull();
    expect(origemDoPrazo("publicacao", 30)).toBe("publicacao");
    expect(origemDoPrazo("tarefa", null)).toBeNull();
    // fora do Prazo, nada
    const providencia = validarAgendamentos(
      [{ etiqueta: "PROVIDENCIA", tarefa: "1. CIÊNCIA DOS AGENDAMENTOS", tarefaId: "321", data: "2026-11-10", responsavel: "Advogada Exemplo", origemPrazo: "calendario" }],
      contexto
    );
    expect(providencia.ok).toBe(true);
    expect(providencia.ok && providencia.itens[0].origemPrazo).toBeNull();
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

  it("passa o prazo marcado (fatal e dias) para a cadeia: a regra da insolvência só antecipa com 10 dias ou mais", () => {
    const pedidos: unknown[] = [];
    const cadeiaDaTarefa = (_tarefaId: string, prazo: { dataFatal: string | null; diasPrazo: number | null }) => {
      pedidos.push(prazo);
      return CADEIA_PADRAO;
    };
    const base = { etiqueta: "PRAZO" as const, tarefa: "CONTESTAÇÃO", data: "", dataFatal: "2026-11-02", responsavel: "Advogada Exemplo", revisor: "Revisor Exemplo" };
    validarAgendamentos([{ ...base, diasPrazo: 5, contagemPrazo: "uteis" }, base], { ...contexto, cadeiaDaTarefa });
    expect(pedidos).toEqual([
      { dataFatal: "2026-11-02", diasPrazo: 5 },
      { dataFatal: "2026-11-02", diasPrazo: null },
    ]);
  });

  it("recusa tarefa fora da lista, data inválida, responsável desconhecido e lista vazia", () => {
    const resultado = validarAgendamentos(
      [{ etiqueta: "PROVIDENCIA", tarefa: "AGRAVO INVENTADO", data: "2026-02-30", responsavel: "Fulano" }],
      contexto
    );
    expect(resultado.ok).toBe(false);
    // tarefa fora da lista, data inválida e responsável desconhecido (a observação é opcional)
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

  it("tarefas do fluxo: aceita data e/ou responsáveis do VIOS (com a grafia de lá) e recusa pessoa fora da lista", () => {
    const entrada = (fluxoDatas: { caminho: string[]; data?: string; responsaveis?: string[] }[]) => [
      { etiqueta: "PRAZO" as const, tarefa: "CONTESTAÇÃO", data: "", dataFatal: "2026-11-02", responsavel: "Advogada Exemplo", revisor: "Revisor Exemplo", fluxoDatas },
    ];
    const certo = validarAgendamentos(
      entrada([
        { caminho: ["2. REVISAR"], responsaveis: ["revisor exemplo", "Advogada Exemplo", "REVISOR EXEMPLO"] },
        { caminho: ["3. PROTOCOLAR"], data: "2026-10-30" },
        { caminho: ["1. CIÊNCIA"], data: "2026-02-30", responsaveis: [] },
      ]),
      contexto
    );
    expect(certo.ok && certo.itens[0].fluxoDatas).toEqual([
      { caminho: ["2. REVISAR"], responsaveis: ["Revisor Exemplo", "Advogada Exemplo"] },
      { caminho: ["3. PROTOCOLAR"], data: "2026-10-30" },
    ]);
    const fora = validarAgendamentos(entrada([{ caminho: ["2. REVISAR"], responsaveis: ["Fulano de Tal"] }]), contexto);
    expect(fora.ok).toBe(false);
    if (!fora.ok) expect(fora.erros.join(" ")).toMatch(/responsáveis das tarefas do fluxo/);
    // Caminho que o tipo não cria: recusa também quando só o responsável mudou.
    const naoCria = validarAgendamentos(entrada([{ caminho: ["INVENTADA"], responsaveis: ["Advogada Exemplo"] }]), {
      ...contexto,
      caminhosDaTarefa: () => new Set(["2. REVISAR"]),
    });
    expect(naoCria.ok).toBe(false);
  });

  it("tarefa de Prazo sem prazo próprio vai com a data dela, sem fatal; o revisor continua obrigatório", () => {
    const semPrazo = { ...contexto, cadeiaDaTarefa: () => null, semPrazoProprio: () => true };
    const base = { etiqueta: "PRAZO" as const, tarefa: "CONTESTAÇÃO", responsavel: "Advogada Exemplo", revisor: "Revisor Exemplo" };
    const certo = validarAgendamentos([{ ...base, data: "2026-11-10", dataFatal: null, diasPrazo: 8 }], semPrazo);
    expect(certo.ok && certo.itens[0]).toMatchObject({ data: "2026-11-10", dataFatal: null, diasPrazo: null, contagemPrazo: null });

    const semData = validarAgendamentos([{ ...base, data: "", dataFatal: null }], semPrazo);
    expect(semData.ok).toBe(false);
    if (!semData.ok) expect(semData.erros.join(" ")).toMatch(/data no calendário/);

    const semRevisor = validarAgendamentos([{ ...base, data: "2026-11-10", dataFatal: null, revisor: "" }], semPrazo);
    expect(semRevisor.ok).toBe(false);

    // Aba aberta antes da mudança: ainda manda a fatal, e a tarefa vai no Enviar dela.
    const abaAntiga = validarAgendamentos([{ ...base, data: "", dataFatal: "2026-11-11" }], semPrazo);
    expect(abaAntiga.ok && abaAntiga.itens[0]).toMatchObject({ data: "2026-11-10", dataFatal: null });

    // As outras tarefas de Prazo continuam pedindo a fatal.
    const comPrazo = validarAgendamentos([{ ...base, data: "2026-11-10", dataFatal: null }], { ...contexto, semPrazoProprio: () => false });
    expect(comPrazo.ok).toBe(false);
    if (!comPrazo.ok) expect(comPrazo.erros.join(" ")).toMatch(/data fatal/);
  });

  it("a observação é opcional", () => {
    const providencia = { etiqueta: "PROVIDENCIA" as const, tarefa: "1. CIÊNCIA DOS AGENDAMENTOS", data: "2026-11-10", responsavel: "Advogada Exemplo" };
    const semObservacao = validarAgendamentos([{ ...providencia, observacao: "  " }], contexto);
    expect(semObservacao.ok && semObservacao.itens[0].observacao).toBeNull();
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

  it("a descrição da tarefa é a data da publicação e a observação, sem o teor", () => {
    expect(montarObservacaoVios("2026-10-14", " Prazo de 8 dias ")).toBe("Publicação de 14/10/2026\nPrazo de 8 dias");
    expect(montarObservacaoVios("2026-10-14", null)).toBe("Publicação de 14/10/2026");
    expect(montarObservacaoVios(null, "ver laudo")).toBe("Publicação\nver laudo");
    expect(referenciaDaPublicacao({ dataPublicacao: "2026-10-14", tribunal: "TRT2", numeroProcesso: "0001234-56.2026.5.02.0001", djenIdComunicacao: 123 })).toBe(
      "Publicação de 14/10/2026 · TRT2 · Processo 0001234-56.2026.5.02.0001 · ID comunicação 123"
    );
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

describe("revisorFicaNaTarefa", () => {
  it("Sessão de Julgamento, em qualquer área", () => {
    expect(revisorFicaNaTarefa("SESSÃO DE JULGAMENTO")).toBe(true);
    expect(revisorFicaNaTarefa("sessao de julgamento", "Recuperação de Crédito")).toBe(true);
  });

  it("audiências do Trabalhista: o advogado auxiliar fica na tarefa (pedido de 12/11/2026)", () => {
    for (const tarefa of ["AUDIÊNCIA UNA/INICIAL", "AUDIÊNCIA DE JULGAMENTO", "AUDIÊNCIA DE INSTRUÇÃO"]) {
      expect(revisorFicaNaTarefa(tarefa, "Trabalhista")).toBe(true);
    }
  });

  it("não vale para as audiências de outras áreas nem para as tarefas que só falam de audiência", () => {
    expect(revisorFicaNaTarefa("AUDIÊNCIA DE INSTRUÇÃO", "Cível")).toBe(false);
    expect(revisorFicaNaTarefa("AUDIÊNCIA UNA/INICIAL")).toBe(false);
    for (const tarefa of ["ALERTA DE AUDIÊNCIA/JULGAMENTO", "LEMBRETE AUDIÊNCIA + REGULARIZAÇÃO PROCESSUAL", "ENVIAR ATA DE AUDIÊNCIA", "CONTESTAÇÃO"]) {
      expect(revisorFicaNaTarefa(tarefa, "Trabalhista")).toBe(false);
    }
  });
});

describe("nomesDasPessoas", () => {
  it("separa por vírgula e pelo ' + ' do Protocolar, sem repetir", () => {
    expect(nomesDasPessoas("Manoela Brisighello Angotti + Daniel Silva, Manoela Brisighello Angotti")).toEqual([
      "Manoela Brisighello Angotti",
      "Daniel Silva",
    ]);
    expect(nomesDasPessoas(null)).toEqual([]);
  });
});

describe("classeDasEtiquetas", () => {
  it("dá a classe pela etiqueta do tipo no VIOS", () => {
    expect(classeDasEtiquetas([204])).toBe("PROVIDENCIA");
    expect(classeDasEtiquetas([1, 2])).toBe("PRAZO");
    expect(classeDasEtiquetas([205])).toBe("COMPROMISSO");
  });

  it("sem nenhuma das três, ou com mais de uma, fica sem classe", () => {
    expect(classeDasEtiquetas([2])).toBeNull();
    expect(classeDasEtiquetas([])).toBeNull();
    expect(classeDasEtiquetas([1, 204])).toBeNull();
  });
});

describe("contagemPadraoDaPublicacao", () => {
  it("Corridos na Insolvência e Úteis nas outras áreas", () => {
    expect(contagemPadraoDaArea("Insolvência")).toBe("corridos");
    expect(contagemPadraoDaPublicacao("Insolvência", [])).toBe("corridos");
    expect(contagemPadraoDaPublicacao("Recuperação de Crédito", ["Carteira GPR"])).toBe("uteis");
    expect(contagemPadraoDaPublicacao("Cível | Insolvência", null)).toBe("uteis");
  });

  it("pasta RC-Insolvência começa em dias corridos em qualquer área", () => {
    expect(contagemPadraoDaPublicacao("Recuperação de Crédito", ["Carteira GPR", "Crédito Ativo", "RC-Insolvência"])).toBe("corridos");
    expect(contagemPadraoDaPublicacao("Cível | Insolvência", ["RC-Insolvência"])).toBe("corridos");
    expect(contagemPadraoDaPublicacao(null, ["RC-Insolvência"])).toBe("corridos");
  });
});
