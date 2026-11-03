import { describe, expect, it } from "vitest";
import { dataDoTrecho, destacar, diasDoTrecho, lerPublicacao, paragrafosDoCorpo, pontosDeAtencao } from "./leitura";

const TRT =
  "PROCESSO:0012003-73.2023.5.15.0022 ORGÃO:EXE2 - Campinas DATA DE DISPONIBILIZAÇÃO:2026-10-28 TIPO DE COMUNICAÇÃO:Intimação " +
  "MEIO:Diário de Justiça Eletrônico Nacional TRIBUNAL:TRT15 Notificação AçãO TRABALHISTA - RITO ORDINáRIO TEXTO:PODER JUDICIÁRIO " +
  "JUSTIÇA DO TRABALHO TRIBUNAL REGIONAL DO TRABALHO DA 15ª REGIÃO EXE2 - CAMPINAS ATOrd 0012003-73.2023.5.15.0022 AUTOR: JOSE LUIZ " +
  "MARIANO PINHEIRO RÉU: SERVICOS TECNICOS AMERICAR EIRELI E OUTROS (3) INTIMAÇÃO Fica V. Sa. intimado para tomar ciência do Despacho " +
  "ID e27ad38 proferido nos autos. DESPACHO Nos termos do art. 18 da Portaria GP-VPJ-CR 4/2013, manifeste-se a reclamada no prazo de " +
  "10 dias, sob pena de preclusão. CAMPINAS/SP, 27 de outubro de 2026. Intimado(s) / Citado(s) - JOSE LUIZ MARIANO PINHEIRO " +
  "PARTES NOME:JOSE LUIZ MARIANO PINHEIRO POLO:A ID COMUNICAÇÃO:768429876 NOME:SERVICOS TECNICOS AMERICAR EIRELI POLO:P " +
  "ID COMUNICAÇÃO:768429877 ADVOGADOS NOME:ALEXANDRE MIRANDA MORAES Nº OAB:263318 UF:SP NOME:GUSTAVO BISMARCHI MOTTA Nº OAB:275477 UF:SP";

describe("lerPublicacao", () => {
  it("separa o cabeçalho do DJEN, os intimados, as partes e os advogados", () => {
    const leitura = lerPublicacao(TRT);
    expect(leitura.djen).toBe(true);
    expect(leitura.orgao).toBe("EXE2 - Campinas");
    expect(leitura.tipoComunicacao).toBe("Intimação");
    expect(leitura.meio).toBe("Diário de Justiça Eletrônico Nacional");
    expect(leitura.classe).toBe("Notificação AÇÃO TRABALHISTA - RITO ORDINÁRIO");
    expect(leitura.intimados).toEqual(["JOSE LUIZ MARIANO PINHEIRO"]);
    expect(leitura.partes).toEqual([
      { nome: "JOSE LUIZ MARIANO PINHEIRO", polo: "A" },
      { nome: "SERVICOS TECNICOS AMERICAR EIRELI", polo: "P" },
    ]);
    expect(leitura.advogados.map((advogado) => [advogado.nome, advogado.doEscritorio])).toEqual([
      ["ALEXANDRE MIRANDA MORAES", false],
      ["GUSTAVO BISMARCHI MOTTA", true],
    ]);
  });

  it("quebra o corpo em títulos, qualificação das partes e texto", () => {
    const { paragrafos } = lerPublicacao(TRT);
    expect(paragrafos.map((p) => p.tipo)).toEqual(["secundario", "secundario", "secundario", "titulo", "texto", "titulo", "texto", "texto"]);
    expect(paragrafos[3].texto).toBe("INTIMAÇÃO");
    expect(paragrafos[4].texto).toBe("Fica V. Sa. intimado para tomar ciência do Despacho ID e27ad38 proferido nos autos.");
    expect(paragrafos[6].texto).toMatch(/^Nos termos do art\. 18/);
    expect(paragrafos[7].texto).toBe("CAMPINAS/SP, 27 de outubro de 2026.");
  });

  it("sem cabeçalho do DJEN, só divide o texto (rótulos de parte em caixa normal também)", () => {
    const leitura = lerPublicacao(
      "Processo 0801300-80.2026.8.12.0021 - Procedimento Comum Cível - Corretagem Autor: Gusmão Empreendimentos Ltda. - Réu: Rcg " +
        "Tecnologia Eletromecânica Ltda. ADV: GUSTAVO BISMARCHI MOTTA (OAB 275477/SP) Intima-se a parte autora para, querendo, no prazo de 15 dias, apresentar impugnação."
    );
    expect(leitura.djen).toBe(false);
    expect(leitura.paragrafos.map((p) => p.texto)).toEqual([
      "Processo 0801300-80.2026.8.12.0021 - Procedimento Comum Cível - Corretagem",
      "Autor: Gusmão Empreendimentos Ltda.",
      "Réu: Rcg Tecnologia Eletromecânica Ltda.",
      "ADV: GUSTAVO BISMARCHI MOTTA (OAB 275477/SP)",
      "Intima-se a parte autora para, querendo, no prazo de 15 dias, apresentar impugnação.",
    ]);
    expect(leitura.paragrafos[3].tipo).toBe("secundario");
  });
});

describe("paragrafosDoCorpo", () => {
  it("não parte frase em caixa alta que só cita DECISÃO", () => {
    const paragrafos = paragrafosDoCorpo("Assim, SERVE A PRESENTE DECISÃO COMO OFÍCIO para deliberação do Juízo recuperacional.");
    expect(paragrafos).toHaveLength(1);
  });

  it("divide parágrafo longo em blocos sem cortar abreviações", () => {
    const frase = "O executado foi intimado nos termos do art. 523 do CPC e não pagou a dívida no prazo assinalado pelo juízo. ";
    const paragrafos = paragrafosDoCorpo(frase.repeat(12));
    expect(paragrafos.length).toBeGreaterThan(1);
    expect(paragrafos.every((p) => !p.texto.endsWith("art."))).toBe(true);
  });
});

describe("destacar", () => {
  it("marca prazo, pena, ordem, data e hora", () => {
    const trechos = destacar("Manifeste-se no prazo de 15 (quinze) dias úteis, sob pena de preclusão. Audiência em 12/11/2026 às 14h30.");
    const marcados = trechos.filter((t) => t.tipo).map((t) => [t.tipo, t.texto]);
    expect(marcados).toEqual([
      ["ordem", "Manifeste-se"],
      ["prazo", "no prazo de 15 (quinze) dias úteis"],
      ["pena", "sob pena de preclusão"],
      ["evento", "Audiência"],
      ["data", "12/11/2026"],
      ["hora", "às 14h30"],
    ]);
    expect(trechos.map((t) => t.texto).join("")).toBe(
      "Manifeste-se no prazo de 15 (quinze) dias úteis, sob pena de preclusão. Audiência em 12/11/2026 às 14h30."
    );
  });

  it("marca valores e prazos por extenso, sem marcar número de lei", () => {
    const marcados = destacar("Pague R$ 1.250,00 em cinco dias, nos termos da Lei 11.101/2005.")
      .filter((t) => t.tipo)
      .map((t) => t.tipo);
    expect(marcados).toEqual(["ordem", "valor", "prazo"]);
  });
});

describe("pontosDeAtencao", () => {
  it("traz prazos com os dias e só as datas depois da publicação", () => {
    const paragrafos = paragrafosDoCorpo(
      "Vistos. Em 10/10/2026 a ré juntou documentos. Manifeste-se no prazo de 5 dias corridos. Designo audiência para 12/11/2026 às 14h30."
    );
    const pontos = pontosDeAtencao(paragrafos, "2026-10-29");
    expect(pontos.map((p) => [p.tipo, p.texto])).toEqual([
      ["prazo", "no prazo de 5 dias corridos"],
      ["evento", "audiência"],
      ["data", "12/11/2026 às 14h30"],
    ]);
    expect(pontos[0]).toMatchObject({ dias: 5, contagem: "corridos" });
  });

  it("junta a hora escrita como 18:03h, aceita prazo legal e não repete o mesmo prazo", () => {
    const paragrafos = paragrafosDoCorpo(
      "Intime-se a parte Recorrida para apresentar Contraminuta no prazo legal. O prazo é de quinze dias úteis. Aguarde-se o prazo de quinze dias. Designe-se audiência para o dia 11/02/2027 às 18:03h."
    );
    expect(pontosDeAtencao(paragrafos, "2026-10-29").map((p) => p.texto)).toEqual([
      "no prazo legal",
      "de quinze dias úteis",
      "audiência",
      "11/02/2027 às 18:03h",
    ]);
  });

  it("acerta a caixa dos nomes das partes e corta a linha de local com 'data abaixo'", () => {
    const leitura = lerPublicacao(
      TRT.replace("NOME:SERVICOS TECNICOS AMERICAR EIRELI", "NOME:7º CARTóRIO DE REGISTRO DE IMóVEIS").replace(
        "CAMPINAS/SP, 27 de outubro de 2026.",
        "CAMPINAS/SP, data abaixo. FULANA DE TAL"
      )
    );
    expect(leitura.partes[1].nome).toBe("7º CARTÓRIO DE REGISTRO DE IMÓVEIS");
    expect(leitura.paragrafos.at(-1)?.texto).toBe("CAMPINAS/SP, data abaixo. FULANA DE TAL");
  });

  it("decodifica entidades HTML do texto", () => {
    expect(lerPublicacao("Art. 525, &sect; 1º, do CPC &amp; outros.").paragrafos[0].texto).toBe("Art. 525, § 1º, do CPC & outros.");
  });
});

describe("diasDoTrecho e dataDoTrecho", () => {
  it("lê dias em número, por extenso e horas", () => {
    expect(diasDoTrecho("no prazo de 15 (quinze) dias")).toEqual({ dias: 15, contagem: null });
    expect(diasDoTrecho("em cinco dias úteis")).toEqual({ dias: 5, contagem: "uteis" });
    expect(diasDoTrecho("em 48 horas")).toEqual({ dias: null, contagem: null });
  });

  it("lê datas numéricas e por extenso", () => {
    expect(dataDoTrecho("12/11/2026")).toBe("2026-11-12");
    expect(dataDoTrecho("3 de março de 2027")).toBe("2027-03-03");
  });
});
