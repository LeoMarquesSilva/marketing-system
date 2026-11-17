import { describe, expect, it } from "vitest";
import { lerMarco, lerSintese, paginasDaReferencia, rotuloDasPaginas, trechosDaSintese, type ParteDaSintese } from "./sintese-leitura";

// Dados fictícios: nomes, valores e datas inventados (o repositório é público).
const SINTESE_IA = [
  "Resumo",
  "Empresa Alfa Ltda. move execução contra Comércio Beta Ltda. para cobrar duplicatas de R$ 12.345,67.",
  "",
  "Andamento",
  "05/02/2024: Distribuição da execução (p. 1)",
  "20/03/2024: Citação frustrada, devedor não localizado (p. 63 e p. 66)",
  "- 11/06/2024: Bloqueio via SISBAJUD de R$ 1.000,00 (p. 91, p. 97 e p. 98).",
  "Pedido de pesquisa de bens sem data (p. 120)",
  "",
  "Situação atual",
  "Aguarda manifestação do credor sobre o bloqueio.",
  "",
  "Pontos de atenção",
  "- Devedor não localizado.",
  "Bens não encontrados.",
].join("\n");

describe("lerSintese", () => {
  it("separa os blocos da IA na ordem, com o andamento em marcos", () => {
    const partes = lerSintese(SINTESE_IA);
    expect(partes.map((parte) => parte.tipo)).toEqual(["texto", "andamento", "texto", "atencao"]);
    expect(partes[0]).toEqual({
      tipo: "texto",
      rotulo: "Resumo",
      paragrafos: ["Empresa Alfa Ltda. move execução contra Comércio Beta Ltda. para cobrar duplicatas de R$ 12.345,67."],
    });
    expect(partes[1]).toEqual({
      tipo: "andamento",
      rotulo: "Andamento",
      marcos: [
        { data: "05/02/2024", texto: "Distribuição da execução", paginas: ["1"] },
        { data: "20/03/2024", texto: "Citação frustrada, devedor não localizado", paginas: ["63", "66"] },
        { data: "11/06/2024", texto: "Bloqueio via SISBAJUD de R$ 1.000,00", paginas: ["91", "97", "98"] },
        { data: null, texto: "Pedido de pesquisa de bens sem data", paginas: ["120"] },
      ],
    });
    expect(partes[2]).toEqual({ tipo: "texto", rotulo: "Situação atual", paragrafos: ["Aguarda manifestação do credor sobre o bloqueio."] });
    expect(partes[3]).toEqual({ tipo: "atencao", rotulo: "Pontos de atenção", itens: ["Devedor não localizado.", "Bens não encontrados."] });
  });

  it("funciona sem o bloco Pontos de atenção", () => {
    const partes = lerSintese("Resumo\nUma ação fictícia.\nAndamento\n01/01/2024: Fato (p. 2)\nSituação atual\nAguarda sentença.");
    expect(partes.map((parte) => (parte.tipo === "ia" ? "ia" : parte.rotulo))).toEqual(["Resumo", "Andamento", "Situação atual"]);
  });

  it("aceita rótulo com dois-pontos, sem acento e com texto na mesma linha", () => {
    const partes = lerSintese("Resumo:\nTexto.\nSituacao atual: Aguarda citação.\nPONTOS DE ATENÇÃO\nNada além.");
    expect(partes).toEqual([
      { tipo: "texto", rotulo: "Resumo", paragrafos: ["Texto."] },
      { tipo: "texto", rotulo: "Situação atual", paragrafos: ["Aguarda citação."] },
      { tipo: "atencao", rotulo: "Pontos de atenção", itens: ["Nada além."] },
    ]);
  });

  it("separa o texto da equipe e as partes da IA pelo cabeçalho datado", () => {
    const texto = [
      "Texto livre da equipe, escrito no VIOS.",
      "Segunda linha do mesmo parágrafo.",
      "",
      "Outro parágrafo da equipe.",
      "",
      "10/09/2026 (IA, leitura dos autos):",
      "Resumo",
      "Primeira leitura.",
      "",
      "17/11/2026 (IA, leitura dos autos):",
      "Resumo",
      "Segunda leitura.",
    ].join("\n");
    const partes = lerSintese(texto);
    expect(partes).toEqual<ParteDaSintese[]>([
      { tipo: "texto", rotulo: null, paragrafos: ["Texto livre da equipe, escrito no VIOS.\nSegunda linha do mesmo parágrafo.", "Outro parágrafo da equipe."] },
      { tipo: "ia", data: "10/09/2026" },
      { tipo: "texto", rotulo: "Resumo", paragrafos: ["Primeira leitura."] },
      { tipo: "ia", data: "17/11/2026" },
      { tipo: "texto", rotulo: "Resumo", paragrafos: ["Segunda leitura."] },
    ]);
  });

  it("deixa o texto livre como está, sem perder nenhuma linha", () => {
    const texto = "  Cliente informou acordo verbal.\r\nAguardar retorno do correspondente.\r\n\r\n\r\nObs.: ver e-mail de 03/04/2025 - R$ 500,00\n- item solto";
    const partes = lerSintese(texto);
    expect(partes).toEqual([
      {
        tipo: "texto",
        rotulo: null,
        paragrafos: ["  Cliente informou acordo verbal.\nAguardar retorno do correspondente.", "Obs.: ver e-mail de 03/04/2025 - R$ 500,00\n- item solto"],
      },
    ]);
    const semEspacos = (valor: string) => valor.replace(/\s+/g, "");
    const exibido = partes.flatMap((parte) => (parte.tipo === "texto" ? parte.paragrafos : [])).join("");
    expect(semEspacos(exibido)).toBe(semEspacos(texto));
  });

  it("mantém um rótulo sem conteúdo e ignora texto vazio", () => {
    expect(lerSintese("")).toEqual([]);
    expect(lerSintese("\n\n  \n")).toEqual([]);
    expect(lerSintese("Pontos de atenção")).toEqual([{ tipo: "atencao", rotulo: "Pontos de atenção", itens: [] }]);
  });

  it("não confunde frase comum que começa com a palavra do rótulo", () => {
    expect(lerSintese("Resumo do caso feito pela equipe em reunião.")).toEqual([
      { tipo: "texto", rotulo: null, paragrafos: ["Resumo do caso feito pela equipe em reunião."] },
    ]);
  });
});

describe("lerMarco", () => {
  it("lê data, fato e páginas", () => {
    expect(lerMarco("15/08/2024: Penhora de veículo (p. 140)")).toEqual({ data: "15/08/2024", texto: "Penhora de veículo", paginas: ["140"] });
  });

  it("aceita traço, marcador, mês/ano e fls.", () => {
    expect(lerMarco("• 03/2023 - Juntada de procuração (fls. 12)")).toEqual({ data: "03/2023", texto: "Juntada de procuração", paginas: ["12"] });
    expect(lerMarco("01/02/2024 – Laudo (pp. 30-35)")).toEqual({ data: "01/02/2024", texto: "Laudo", paginas: ["30-35"] });
  });

  it("linha sem data e sem página fica inteira", () => {
    expect(lerMarco("Várias tentativas de citação sem sucesso")).toEqual({ data: null, texto: "Várias tentativas de citação sem sucesso", paginas: [] });
  });

  it("página no meio da frase não sai do texto", () => {
    expect(lerMarco("01/03/2024: Decisão (p. 50) mantida em recurso")).toEqual({ data: "01/03/2024", texto: "Decisão (p. 50) mantida em recurso", paginas: [] });
  });

  it("linha que é só data fica como texto", () => {
    expect(lerMarco("01/03/2024")).toEqual({ data: null, texto: "01/03/2024", paginas: [] });
  });
});

describe("páginas", () => {
  it("extrai os números da referência", () => {
    expect(paginasDaReferencia("(p. 91, p. 97 e p. 98)")).toEqual(["91", "97", "98"]);
    expect(paginasDaReferencia("(p. 63 e 66)")).toEqual(["63", "66"]);
    expect(paginasDaReferencia("(pp. 3 – 5)")).toEqual(["3-5"]);
  });

  it("monta o rótulo curto", () => {
    expect(rotuloDasPaginas([])).toBe("");
    expect(rotuloDasPaginas(["7"])).toBe("p. 7");
    expect(rotuloDasPaginas(["3-5"])).toBe("pp. 3-5");
    expect(rotuloDasPaginas(["63", "66"])).toBe("pp. 63 e 66");
    expect(rotuloDasPaginas(["91", "97", "98"])).toBe("pp. 91, 97 e 98");
  });
});

describe("trechosDaSintese", () => {
  it("marca valores, datas e páginas sem alterar o texto", () => {
    const texto = "Bloqueio de R$ 78.000,10 em 02/05/2024 (p. 63 e p. 66), restante a pagar.";
    const trechos = trechosDaSintese(texto);
    expect(trechos.map((trecho) => trecho.texto).join("")).toBe(texto);
    expect(trechos.filter((trecho) => trecho.tipo).map((trecho) => [trecho.tipo, trecho.texto])).toEqual([
      ["valor", "R$ 78.000,10"],
      ["data", "02/05/2024"],
      ["pagina", "(p. 63 e p. 66)"],
    ]);
    for (const trecho of trechos) expect(texto.slice(trecho.inicio, trecho.inicio + trecho.texto.length)).toBe(trecho.texto);
  });

  it("não destaca verbos de ordem e junta o texto comum", () => {
    expect(trechosDaSintese("Intime-se o credor para manifestar-se.")).toEqual([{ texto: "Intime-se o credor para manifestar-se.", tipo: null, inicio: 0 }]);
  });

  it("mantém prazo e ato como na Vistagem", () => {
    const tipos = trechosDaSintese("Designada audiência de conciliação; prazo de 15 dias úteis.")
      .filter((trecho) => trecho.tipo)
      .map((trecho) => trecho.tipo);
    expect(tipos).toEqual(["evento", "prazo"]);
  });

  it("texto sem nada a destacar sai num trecho só", () => {
    expect(trechosDaSintese("Sem novidades.")).toEqual([{ texto: "Sem novidades.", tipo: null, inicio: 0 }]);
    expect(trechosDaSintese("")).toEqual([]);
  });
});
