import { describe, expect, it } from "vitest";
import type { ItensRecCredito } from "./rec-credito";
import { leituraRecCreditoVazia, sugestoesDaRecCredito, tipoDaLista, type ItemSugerido, type LeituraRecCredito } from "./rec-credito-leitura";

const TIPOS = ["Nota promissória", "Duplicata", "CCB (Cédula de Crédito Bancário)"];
const nada: ItensRecCredito = { titulos: [], citacoes: [], pedidos: [], lancamentos: [] };
/** Conferidor de mentira: acha o trecho quando ele começa com "ok". */
const conferidor = { trecho: (pagina: number | null, trecho: string | null) => ({ pagina, conferido: Boolean(trecho?.startsWith("ok")) }) };
const de = (pagina: number, confianca: "alta" | "media" | "baixa" = "alta", trecho = "ok trecho") => ({ pagina, trecho, confianca });

function leitura(parcial: Partial<LeituraRecCredito>): LeituraRecCredito {
  return { ...leituraRecCreditoVazia(), ...parcial };
}

describe("tipo do título", () => {
  it("casa com a lista de Cadastros pelo texto", () => {
    expect(tipoDaLista("nota_promissoria", "Nota promissória", TIPOS)).toBe("Nota promissória");
    expect(tipoDaLista("ccb", "Cédula de Crédito Bancário", TIPOS)).toBe("CCB (Cédula de Crédito Bancário)");
    expect(tipoDaLista("cheque", "Cheque pré-datado", TIPOS)).toBe("Cheque pré-datado");
  });
});

describe("sugestões da Rec. Crédito", () => {
  it("um título por proposta, com o tipo da lista e os dados do formulário", () => {
    const sugestoes = sugestoesDaRecCredito(
      leitura({
        titulos: [
          { tipo: "duplicata", descricao: "Duplicata mercantil", numero: "101", valor: 1500.5, vencimento: "2024-01-10", ...de(3) },
          { tipo: "duplicata", descricao: "Duplicata", numero: "101", valor: 1500.5, vencimento: "10/01/2024", ...de(9, "media") },
          { tipo: "duplicata", descricao: "Duplicata", numero: null, valor: 0, vencimento: "2024-01-10", ...de(4) },
          { tipo: "duplicata", descricao: "Duplicata", numero: null, valor: 10, vencimento: "sem data", ...de(4) },
        ],
      }),
      nada,
      TIPOS,
      conferidor
    );
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ tipo: "rec_credito", campo: "titulo", item: "rec_credito_titulo", pagina: 3, confianca: "alta", trechoConferido: true });
    expect(sugestoes[0].valor as ItemSugerido).toEqual({ item: "titulo", dados: { tipo: "Duplicata", numero: "101", valor: 1500.5, vencimento: "2024-01-10" }, tipos: TIPOS });
    expect(sugestoes[0].resumo).toMatch(/^Título: Duplicata nº 101, R\$\s?1\.500,50, vencimento 10\/01\/2024$/);
  });

  it("não repete o que a ficha já tem", () => {
    const existentes: ItensRecCredito = {
      ...nada,
      lancamentos: [{ id: "x", origem: "manual", documentoId: null, pagina: null, criadoPorNome: null, tipo: "levantamento", data: "2024-05-02", valor: 800, descricao: null }],
    };
    const sugestoes = sugestoesDaRecCredito(
      leitura({
        lancamentos: [
          { tipo: "levantamento", data: "2024-05-02", valor: 800, descricao: "alvará", ...de(20) },
          { tipo: "guia_paga", data: "2024-02-01", valor: 35.9, descricao: "diligência", ...de(12) },
        ],
      }),
      existentes,
      TIPOS,
      conferidor
    );
    expect(sugestoes.map((item) => (item.valor as ItemSugerido).dados.tipo)).toEqual(["guia_paga"]);
  });

  it("pedido e decisão do mesmo pedido: fica a situação decidida", () => {
    const sugestoes = sugestoesDaRecCredito(
      leitura({
        pedidos: [
          { tipo: "SISBAJUD", data_pedido: "2024-03-01", situacao: "requerido", data_decisao: null, resultado: null, valor_obtido: null, ...de(30) },
          { tipo: "Sisbajud", data_pedido: "2024-03-01", situacao: "deferido", data_decisao: "2024-03-20", resultado: "Bloqueio parcial", valor_obtido: 1200, ...de(35, "media") },
        ],
      }),
      nada,
      TIPOS,
      conferidor
    );
    expect(sugestoes).toHaveLength(1);
    expect((sugestoes[0].valor as ItemSugerido).dados).toMatchObject({ situacao: "deferido", decididoEm: "2024-03-20", valorObtido: 1200 });
  });

  it("trecho não localizado no PDF baixa a confiança", () => {
    const [sugestao] = sugestoesDaRecCredito(
      leitura({ citacoes: [{ data: "2024-02-10", meio: "ar", resultado: "negativa", endereco: "Rua A, 10", motivo: "Mudou-se", ...de(7, "alta", "texto inventado") }] }),
      nada,
      TIPOS,
      conferidor
    );
    expect(sugestao).toMatchObject({ confianca: "baixa", trechoConferido: false });
    expect((sugestao.valor as ItemSugerido).dados).toEqual({ tentativaEm: "2024-02-10", meio: "ar", resultado: "negativa", endereco: "Rua A, 10", observacao: "Mudou-se" });
  });
});
