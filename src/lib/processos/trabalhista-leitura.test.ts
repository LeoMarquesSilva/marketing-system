import { describe, expect, it } from "vitest";
import { instrucoesDaSintese } from "./sugestoes";
import { ESQUEMA_LEITURA_TRABALHISTA, chaveDoPedido, instrucoesDaLeituraTrabalhista, juntarLeiturasTrabalhistas, leituraTrabalhistaVazia, sugestoesTrabalhistas, type LeituraTrabalhista } from "./trabalhista-leitura";
import type { ItensTrabalhistas, PedidoTrabalhista } from "./trabalhista";

const conferidor = { trecho: (pagina: number | null) => ({ pagina, conferido: true }) };
const de = { pagina: 3, trecho: "trecho do texto dos autos", confianca: "alta" as const };
const vazio: ItensTrabalhistas = { afastamentos: [], pedidos: [] };

function lido(dados: Partial<LeituraTrabalhista>): LeituraTrabalhista {
  return { afastamentos: [], pedidos: [], ...dados };
}

function pedidoNaFicha(dados: Partial<PedidoTrabalhista>): PedidoTrabalhista {
  return {
    id: "ped-1",
    origem: "manual",
    documentoId: null,
    pagina: null,
    criadoPorNome: null,
    pedido: "Adicional de insalubridade",
    valorPedido: null,
    resultadoSentenca: null,
    resultadoAcordao: null,
    resultadoRr: null,
    detalhe: null,
    ...dados,
  };
}

describe("esquema e instruções", () => {
  it("o esquema trabalhista não tem a Rec. Crédito", () => {
    expect(Object.keys(ESQUEMA_LEITURA_TRABALHISTA.shape)).not.toContain("rec_credito");
    expect(Object.keys(ESQUEMA_LEITURA_TRABALHISTA.shape)).toEqual(expect.arrayContaining(["campos", "pessoas", "contatos", "fatos", "trabalhista", "acordos"]));
    expect(ESQUEMA_LEITURA_TRABALHISTA.safeParse(leituraTrabalhistaVazia()).success).toBe(true);
  });

  it("as instruções pedem os advogados do reclamante, não os da reclamada, e não falam de Rec. Crédito", () => {
    const texto = instrucoesDaLeituraTrabalhista();
    expect(texto).toContain("advogados DO RECLAMANTE");
    expect(texto).toContain("EMPRESA RECLAMADA");
    expect(texto).not.toMatch(/rec_credito/);
  });

  it("a síntese do trabalhista olha a reclamada", () => {
    expect(instrucoesDaSintese(true)).toContain("empresa reclamada");
    expect(instrucoesDaSintese(true)).not.toContain("representa o credor");
    expect(instrucoesDaSintese()).toContain("representa o credor");
  });

  it("junta os pedaços", () => {
    const a = { ...leituraTrabalhistaVazia(), trabalhista: { afastamentos: [{ inicio: "2024-01-01", fim: null, especie: "auxilio_doenca" as const, ...de }], pedidos: [] } };
    const b = { ...leituraTrabalhistaVazia(), trabalhista: { afastamentos: [], pedidos: [{ pedido: "Horas extras", decisao: "inicial" as const, valor_pedido: 100, resultado: null, detalhe: null, ...de }] } };
    const junto = juntarLeiturasTrabalhistas([a, b]);
    expect(junto.trabalhista.afastamentos).toHaveLength(1);
    expect(junto.trabalhista.pedidos).toHaveLength(1);
  });
});

describe("sugestoesTrabalhistas", () => {
  it("um afastamento por data de início, sem repetir a ficha", () => {
    const sugestoes = sugestoesTrabalhistas(
      lido({
        afastamentos: [
          { inicio: "2023-02-01", fim: null, especie: "auxilio_doenca", ...de, confianca: "media" },
          { inicio: "01/02/2023", fim: "2023-05-30", especie: "auxilio_doenca", ...de },
          { inicio: "2022-01-01", fim: "2022-02-01", especie: "acidentario", ...de },
          { inicio: "2024-01-01", fim: "2023-01-01", especie: "outro", ...de },
        ],
      }),
      { afastamentos: [{ id: "x", origem: "manual", documentoId: null, pagina: null, criadoPorNome: null, inicio: "2022-01-01", fim: null, especie: "outro", observacao: null }], pedidos: [] },
      conferidor
    );
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ tipo: "trabalhista", campo: "afastamento", valor: { item: "afastamento", dados: { inicio: "2023-02-01", fim: "2023-05-30" } } });
  });

  it("junta a inicial e as decisões do mesmo pedido numa proposta", () => {
    const sugestoes = sugestoesTrabalhistas(
      lido({
        pedidos: [
          { pedido: "Adicional de Insalubridade", decisao: "inicial", valor_pedido: 20000, resultado: null, detalhe: null, ...de },
          { pedido: "adicional de insalubridade.", decisao: "sentenca", valor_pedido: null, resultado: "deferido", detalhe: "grau máximo, base salário-mínimo", ...de },
          { pedido: "Adicional de insalubridade", decisao: "acordao", valor_pedido: null, resultado: "em_parte", detalhe: "grau médio", ...de, pagina: 90 },
          { pedido: "Danos morais", decisao: "inicial", valor_pedido: 10000, resultado: null, detalhe: null, ...de },
        ],
      }),
      vazio,
      conferidor
    );
    expect(sugestoes).toHaveLength(2);
    const insalubridade = sugestoes.find((item) => item.resumo.toLowerCase().includes("insalubridade"));
    expect(insalubridade?.valor).toEqual({
      item: "pedido",
      dados: { pedido: "Adicional de Insalubridade", valor_pedido: 20000, resultado_sentenca: "deferido", resultado_acordao: "em_parte", resultado_rr: null, detalhe: "grau médio" },
    });
    // A origem mostrada é a da decisão mais alta lida.
    expect(insalubridade?.pagina).toBe(90);
  });

  it("pedido já na ficha só volta para completar o que falta", () => {
    const naFicha: ItensTrabalhistas = { afastamentos: [], pedidos: [pedidoNaFicha({ valorPedido: 20000, resultadoSentenca: "deferido" })] };
    const igual = sugestoesTrabalhistas(lido({ pedidos: [{ pedido: "Adicional de insalubridade", decisao: "sentenca", valor_pedido: null, resultado: "deferido", detalhe: null, ...de }] }), naFicha, conferidor);
    expect(igual).toHaveLength(0);
    const completa = sugestoesTrabalhistas(lido({ pedidos: [{ pedido: "Adicional de insalubridade", decisao: "acordao", valor_pedido: null, resultado: "indeferido", detalhe: null, ...de }] }), naFicha, conferidor);
    expect(completa).toHaveLength(1);
    expect(completa[0].valor).toMatchObject({ item: "pedido", existenteId: "ped-1", dados: { valor_pedido: 20000, resultado_sentenca: "deferido", resultado_acordao: "indeferido" } });
    expect(completa[0].resumo.startsWith("Completar pedido")).toBe(true);
  });

  it("chave do pedido ignora caixa, acento e artigos", () => {
    expect(chaveDoPedido("Adicional de Insalubridade.")).toBe(chaveDoPedido("adicional insalubridade"));
    expect(chaveDoPedido("Multa do art. 477")).toBe("multa art 477");
  });
});
