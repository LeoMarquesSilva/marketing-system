import { describe, expect, it } from "vitest";
import {
  agruparPorAdvogado,
  chaveDoAdvogado,
  conferirDestinatarios,
  gerarEml,
  lerPlanilhaDeValores,
  listaPorExtenso,
  montarEmailDeAcordo,
  negociacaoNova,
  nomeDaEmpresa,
  saudacaoPelaHora,
  statusAposEnvio,
  textoParaHtml,
  valorDaCelula,
  type Advogado,
  type LinhaNegociacao,
} from "./negociacao";

const CNJ_A = "0000001-11.2024.5.15.0001";
const CNJ_B = "0000002-22.2024.5.15.0002";
const CNJ_C = "0000003-33.2024.5.15.0003";

function linha(id: string, cnj: string, advogados: Advogado[], cliente = "Empresa Exemplo Comércio Ltda"): LinhaNegociacao {
  return {
    processoId: id,
    ci: null,
    cnj,
    cliente,
    grupoCliente: null,
    reclamante: null,
    advogadoResponsavel: null,
    fase: null,
    advogados,
    riscoValor: null,
    riscoReflexos: null,
    riscoTotal: null,
    negociacao: negociacaoNova(),
  };
}

const ANA: Advogado = { nome: "Ana Exemplo", oab: "SP 100.001", emails: ["ana@exemplo.adv.br"] };
const BIA: Advogado = { nome: "Bia Exemplo", oab: "SP 100.002", emails: ["bia@exemplo.adv.br"] };
const CAIO: Advogado = { nome: "Caio Exemplo", oab: null, emails: [] };

describe("e-mail padrão", () => {
  it("o nome da empresa vem do cliente, em maiúsculas e com o ponto do tipo societário", () => {
    expect(nomeDaEmpresa("Empresa Exemplo Comércio Ltda")).toBe("EMPRESA EXEMPLO COMÉRCIO LTDA.");
    expect(nomeDaEmpresa("EMPRESA EXEMPLO S/A")).toBe("EMPRESA EXEMPLO S/A.");
    expect(nomeDaEmpresa("Empresa Exemplo LTDA.")).toBe("EMPRESA EXEMPLO LTDA.");
    expect(nomeDaEmpresa(null)).toBe("");
  });

  it("um processo: título e texto da equipe", () => {
    const email = montarEmailDeAcordo({ empresa: "Empresa Exemplo Comércio Ltda", processos: [CNJ_A], saudacao: "boa tarde" });
    expect(email.assunto).toBe(`Pretensão para acordo - Proc. nº ${CNJ_A} - EMPRESA EXEMPLO COMÉRCIO LTDA.`);
    expect(email.texto).toBe(
      [
        "Prezados, boa tarde.",
        "",
        `Na qualidade de advogada da empresa EMPRESA EXEMPLO COMÉRCIO LTDA., entro em contato para verificar eventual interesse na composição amigável no processo nº ${CNJ_A}.`,
        "",
        "Em caso positivo, solicito, por gentileza, o encaminhamento da pretensão de acordo, indicando o valor e as condições de pagamento pretendidas, para que possamos submetê-la à análise da empresa.",
        "",
        "Aguardo retorno.",
        "",
        "Atenciosamente,",
      ].join("\n")
    );
  });

  it("vários processos do mesmo advogado: um e-mail com a lista", () => {
    const email = montarEmailDeAcordo({ empresa: "Empresa Exemplo Ltda", processos: [CNJ_A, CNJ_B, CNJ_C, CNJ_A], assinatura: "Fulana Exemplo" });
    expect(email.assunto).toBe(`Pretensão para acordo - Procs. nº ${CNJ_A}, ${CNJ_B} e ${CNJ_C} - EMPRESA EXEMPLO LTDA.`);
    expect(email.texto).toContain(`nos processos nº ${CNJ_A}, ${CNJ_B} e ${CNJ_C}.`);
    expect(email.texto).toContain("pretensão de acordo de cada processo");
    expect(email.texto.endsWith("Atenciosamente,\nFulana Exemplo")).toBe(true);
  });

  it("sem cliente ou sem processo não monta", () => {
    expect(() => montarEmailDeAcordo({ empresa: "", processos: [CNJ_A] })).toThrow(/cliente/);
    expect(() => montarEmailDeAcordo({ empresa: "X", processos: [] })).toThrow(/processo/);
  });

  it("lista por extenso e saudação pela hora de Brasília", () => {
    expect(listaPorExtenso(["a"])).toBe("a");
    expect(listaPorExtenso(["a", "b", "c"])).toBe("a, b e c");
    expect(saudacaoPelaHora(new Date("2026-11-27T12:00:00Z"))).toBe("bom dia");
    expect(saudacaoPelaHora(new Date("2026-11-27T17:00:00Z"))).toBe("boa tarde");
    expect(saudacaoPelaHora(new Date("2026-11-27T23:00:00Z"))).toBe("boa noite");
  });

  it("HTML escapa o texto e mantém parágrafos", () => {
    expect(textoParaHtml("Prezados, <b>oi</b>.\n\nLinha 1\nLinha 2")).toBe(
      '<div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt;"><p>Prezados, &lt;b&gt;oi&lt;/b&gt;.</p><p>Linha 1<br>Linha 2</p></div>'
    );
  });

  it("confere destinatários", () => {
    expect(conferirDestinatarios(["Ana@Exemplo.adv.br", "ana@exemplo.adv.br", "bia@exemplo.adv.br"])).toEqual(["ana@exemplo.adv.br", "bia@exemplo.adv.br"]);
    expect(conferirDestinatarios("ana@exemplo.adv.br; bia@exemplo.adv.br")).toHaveLength(2);
    expect(() => conferirDestinatarios(["sem-arroba"])).toThrow(/inválido/);
    expect(() => conferirDestinatarios([])).toThrow(/destinatário/);
  });

  it("o .eml abre como rascunho, com o título codificado", () => {
    const eml = gerarEml({ para: ["ana@exemplo.adv.br"], assunto: "Pretensão para acordo", texto: "Olá" });
    expect(eml).toContain("To: ana@exemplo.adv.br\r\n");
    expect(eml).toContain("X-Unsent: 1\r\n");
    expect(eml).toContain(`Subject: =?UTF-8?B?${Buffer.from("Pretensão para acordo").toString("base64")}?=`);
    expect(eml).toContain(Buffer.from("Olá").toString("base64"));
  });
});

describe("agrupamento por advogado", () => {
  it("a OAB identifica o advogado, com qualquer grafia", () => {
    expect(chaveDoAdvogado({ nome: "x", oab: "OAB/SP 100.001" })).toBe(chaveDoAdvogado({ nome: "y", oab: "SP100001" }));
    expect(chaveDoAdvogado({ nome: "Caio  Exemplo", oab: null })).toBe("nome:caio exemplo");
  });

  it("junta os processos que compartilham advogado, também por tabela", () => {
    const grupos = agruparPorAdvogado([linha("1", CNJ_A, [ANA]), linha("2", CNJ_B, [ANA, BIA]), linha("3", CNJ_C, [CAIO]), linha("4", "0000004-44.2024.5.15.0004", [])]);
    expect(grupos.map((grupo) => grupo.linhas.map((item) => item.processoId))).toEqual([["1", "2"], ["3"], ["4"]]);
    expect(grupos[0].emails).toEqual(["ana@exemplo.adv.br", "bia@exemplo.adv.br"]);
    expect(grupos[0].advogados.map((item) => item.nome)).toEqual(["Ana Exemplo", "Bia Exemplo"]);
    expect(grupos[2].advogados).toEqual([]);
  });

  it("o mesmo advogado com empresas diferentes sai em e-mails separados", () => {
    const grupos = agruparPorAdvogado([linha("1", CNJ_A, [ANA], "Empresa Um Ltda"), linha("2", CNJ_B, [ANA], "Empresa Dois Ltda")]);
    expect(grupos).toHaveLength(2);
  });
});

describe("status", () => {
  it("o envio só tira do \"a enviar\"", () => {
    expect(statusAposEnvio("a_enviar")).toBe("enviado");
    expect(statusAposEnvio("proposta_recebida")).toBe("proposta_recebida");
  });
});

describe("planilha devolvida", () => {
  it("acha as colunas pelo cabeçalho e lê o valor máximo", () => {
    const { itens, avisos } = lerPlanilhaDeValores([
      ["Acordos trabalhistas"],
      [],
      ["Processo", "CI", "Valor máximo para acordo", "Observações"],
      [CNJ_A, "1", 15000, "pagamento em 3x"],
      [CNJ_B, "2", "R$ 8.500,50", null],
      [CNJ_C, "3", null, null],
      ["123", "4", 10, null],
      ["0000005-55.2024.5.15.0005", "5", "abc", null],
    ]);
    expect(itens).toEqual([
      { cnj: "00000011120245150001", valorMaximo: 15000, observacao: "pagamento em 3x" },
      { cnj: "00000022220245150002", valorMaximo: 8500.5, observacao: null },
    ]);
    expect(avisos).toHaveLength(2);
  });

  it("sem as colunas, explica o que precisa", () => {
    expect(() => lerPlanilhaDeValores([["A", "B"]])).toThrow(/Valor máximo/);
  });

  it("valor de célula", () => {
    expect(valorDaCelula(1234.567)).toBe(1234.57);
    expect(valorDaCelula("1.234,56")).toBe(1234.56);
    expect(valorDaCelula("")).toBeNull();
    expect(valorDaCelula("x")).toBeNaN();
  });
});
