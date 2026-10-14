import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { MOTIVO_INDICE, montarPublicacoes } from "./captura";
import { lerComunicacaoDjen } from "./djen";
import { extrairIdsDocumento } from "./duplicidade";
import { KurierArquivoInvalidoError, lerPlanilhaKurier } from "./kurier-arquivo";
import type { KurierLinha } from "./types";

const CNJ = "0001234-56.2026.5.15.0001";

function comunicacao(opcoes: { intimado: string; id: number; partes?: [string, string][]; meio?: string }) {
  const partes = (opcoes.partes ?? [["ANA EXEMPLO", "A"], ["EMPRESA FICTICIA LTDA", "P"]])
    .map(([nome, polo]) => `NOME:${nome} POLO:${polo} ID COMUNICAÇÃO:${opcoes.id}`)
    .join(" ");
  return [
    `PROCESSO:${CNJ} ORGÃO:1ª Vara do Trabalho de Exemplo DATA DE DISPONIBILIZAÇÃO:2026-10-13`,
    "TIPO DE COMUNICAÇÃO:Intimação MEIO:Diário de Justiça Eletrônico Nacional TRIBUNAL:TRT15",
    `Notificação TEXTO:AUTOR: ANA EXEMPLO RÉU: EMPRESA FICTICIA LTDA ${opcoes.meio ?? ""}`,
    `Fica V. Sa. intimado para ciência da sentença. Intimado(s) / Citado(s) - ${opcoes.intimado}`,
    `PARTES ${partes} ADVOGADOS NOME:ADVOGADO EXEMPLO Nº OAB:123456 UF:SP`,
  ].join("\n");
}

function linha(numero: number, teor: string, extra: Partial<KurierLinha> = {}): KurierLinha {
  return {
    linha: numero,
    dataDivulgacao: "2026-10-13",
    dataPublicacao: "2026-10-14",
    numeroProcesso: CNJ,
    estado: "SP",
    diario: "TRT 15_DJEN_TRABALHISTA",
    nomeLocalizado: "ADVOGADO EXEMPLO",
    caderno: "",
    comarca: "",
    titulo: "",
    teor,
    ...extra,
  };
}

describe("lerComunicacaoDjen", () => {
  it("lê cabeçalho, partes, advogados e intimado", () => {
    const djen = lerComunicacaoDjen(comunicacao({ intimado: "EMPRESA FICTICIA LTDA", id: 900 }));
    expect(djen).toMatchObject({
      idComunicacao: 900,
      orgao: "1ª Vara do Trabalho de Exemplo",
      dataDisponibilizacao: "2026-10-13",
      tipoComunicacao: "Intimação",
      tribunal: "TRT15",
      intimados: ["EMPRESA FICTICIA LTDA"],
      advogados: [{ nome: "ADVOGADO EXEMPLO", oab: "123456", uf: "SP" }],
    });
    expect(djen?.partes).toHaveLength(2);
    expect(djen?.corpo).not.toMatch(/Intimado\(s\)/);
  });

  it("ignora textos fora do padrão do DJEN", () => {
    expect(lerComunicacaoDjen("Processo 0001234-56.2026.8.26.0100 - Despacho")).toBeNull();
  });
});

describe("montarPublicacoes", () => {
  it("marca como duplicidade o mesmo despacho enviado para cada parte", () => {
    const resultado = montarPublicacoes([
      linha(3, comunicacao({ intimado: "ANA EXEMPLO", id: 901 })),
      linha(4, comunicacao({ intimado: "EMPRESA FICTICIA LTDA", id: 902 })),
    ]);
    expect(resultado.map((p) => p.status)).toEqual(["captada", "duplicidade"]);
    expect(resultado[1].duplicidadeDeLinha).toBe(3);
    expect(resultado[0].chaveDecisao).toBe(resultado[1].chaveDecisao);
  });

  it("agrupa cópias que repetem o destinatário no texto e listam só a própria parte", () => {
    const resultado = montarPublicacoes([
      linha(3, comunicacao({ intimado: "ANA EXEMPLO", id: 901, meio: "DESTINATÁRIO: ANA EXEMPLO", partes: [["ANA EXEMPLO", "A"]] })),
      linha(4, comunicacao({ intimado: "EMPRESA FICTICIA LTDA", id: 902, meio: "DESTINATÁRIO: EMPRESA FICTICIA LTDA", partes: [["EMPRESA FICTICIA LTDA", "P"]] })),
    ]);
    expect(resultado.map((p) => p.status)).toEqual(["captada", "duplicidade"]);
  });

  it("não agrupa documentos diferentes do mesmo processo", () => {
    const outro = comunicacao({ intimado: "EMPRESA FICTICIA LTDA", id: 903 }).replace("ciência da sentença", "apresentar defesa");
    const resultado = montarPublicacoes([
      linha(3, comunicacao({ intimado: "ANA EXEMPLO", id: 901 })),
      linha(4, outro),
    ]);
    expect(resultado.map((p) => p.status)).toEqual(["captada", "captada"]);
  });

  it("ignora a ordem da lista final de advogados em textos fora do DJEN", () => {
    const a = "Processo 0001234-56.2026.8.26.0100 - Vistos. Manifeste-se em 5 dias. - ADV: FULANO (OAB 1/SP), BELTRANO (OAB 2/SP)";
    const b = "Processo 0001234-56.2026.8.26.0100 - Vistos. Manifeste-se em 5 dias. - ADV: BELTRANO (OAB 2/SP), FULANO (OAB 1/SP)";
    const extra = { numeroProcesso: "0001234-56.2026.8.26.0100", diario: "TJSP_DJEN_ESTADUAL" };
    const resultado = montarPublicacoes([linha(3, a, extra), linha(4, b, extra)]);
    expect(resultado.map((p) => p.status)).toEqual(["captada", "duplicidade"]);
  });

  it("descarta o índice de advogados do diário", () => {
    const [indice] = montarPublicacoes([
      linha(3, "ÍNDICE POR ADVOGADOS(AS) 000001SP => 1; 000002SP => 2", { numeroProcesso: "Número fora do Padrão" }),
    ]);
    expect(indice).toMatchObject({ status: "descartada", motivoDescarte: MOTIVO_INDICE, chaveDecisao: null });
  });

  it("não aponta duplicidade quando não há CNJ", () => {
    const resultado = montarPublicacoes([
      linha(3, "Texto sem número", { numeroProcesso: "Número fora do Padrão" }),
      linha(4, "Texto sem número", { numeroProcesso: "Número fora do Padrão" }),
    ]);
    expect(resultado.map((p) => p.status)).toEqual(["captada", "captada"]);
  });
});

function planilha(linhas: unknown[][]): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const aba = XLSX.utils.aoa_to_sheet([[], ...linhas]);
  XLSX.utils.book_append_sheet(workbook, aba, "Publicações");
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
}

const CABECALHO = [
  "DATA DE DIVULGAÇÃO", "DATA DE PUBLICAÇÃO", "NÚMERO DO PROCESSO", "ESTADO", "DIÁRIO - DIVISÃO",
  "NOME LOCALIZADO NA PUBLICAÇÃO", "CADERNO", "COMARCA/CIDADE", "TÍTULO", "PUBLICAÇÃO",
];

describe("lerPlanilhaKurier", () => {
  it("lê as linhas a partir do cabeçalho e junta as colunas de continuação", () => {
    const conteudo = planilha([
      [...CABECALHO, "CONTINUAÇÃO PUBLICAÇÃO 2", "CONTINUAÇÃO PUBLICAÇÃO 1"],
      ["13/10/2026", "14/10/2026", CNJ, "SP", "TRT 15_DJEN_TRABALHISTA", "ADVOGADO EXEMPLO", "", "", "", "parte A ", "parte C", "parte B "],
      [],
    ]);
    const [primeira, ...resto] = lerPlanilhaKurier(conteudo);
    expect(resto).toHaveLength(0);
    expect(primeira).toMatchObject({
      linha: 3,
      dataDivulgacao: "2026-10-13",
      dataPublicacao: "2026-10-14",
      numeroProcesso: CNJ,
      teor: "parte A parte B parte C",
    });
  });

  it("recusa planilhas sem o cabeçalho da Kurier", () => {
    expect(() => lerPlanilhaKurier(planilha([["A", "B"], ["1", "2"]]))).toThrow(KurierArquivoInvalidoError);
  });
});

describe("Id de documento do PJe", () => {
  it("extrai Ids de 7 hexadecimais com dígito, sem repetir", () => {
    expect(extrairIdsDocumento("Fica intimado da Decisão ID ea1b5fa (Id. 1c116a7) e Id. 1C116A7; ID COMUNICAÇÃO:755242200; ID decaded")).toEqual([
      "1c116a7",
      "ea1b5fa",
    ]);
  });

  it("agrupa pelo Id do documento quando o texto muda entre as cópias", () => {
    const a = comunicacao({ intimado: "ANA EXEMPLO", id: 901 }).replace("ciência da sentença", "ciência da sentença (Id. 1c116a7) ao reclamante");
    const b = comunicacao({ intimado: "EMPRESA FICTICIA LTDA", id: 902 }).replace("ciência da sentença", "ciência da sentença (Id. 1c116a7) à reclamada");
    const resultado = montarPublicacoes([linha(3, a), linha(4, b)]);
    expect(resultado.map((p) => p.status)).toEqual(["captada", "duplicidade"]);
    expect(resultado[1]).toMatchObject({ duplicidadeDeLinha: 3, duplicidadeCriterio: "id_documento", documentoIds: ["1c116a7"] });
  });

  it("marca o critério texto quando o despacho é igual", () => {
    const resultado = montarPublicacoes([
      linha(3, comunicacao({ intimado: "ANA EXEMPLO", id: 901 })),
      linha(4, comunicacao({ intimado: "EMPRESA FICTICIA LTDA", id: 902 })),
    ]);
    expect(resultado[1].duplicidadeCriterio).toBe("texto");
  });
});
