import { describe, expect, it } from "vitest";
import { calcularPreenchimento } from "./preenchimento";
import { SEM_ATUALIZACAO } from "./rec-credito";
import { linhaDaCarteiraTrabalhista } from "./trabalhista-carteira";
import type { PedidoTrabalhista } from "./trabalhista";
import type { Parte } from "./types";

function parte(dados: Partial<Parte>): Parte {
  return {
    id: dados.id ?? "p",
    polo: dados.polo ?? "ativo",
    papel: dados.papel ?? "parte",
    vinculo: null,
    devedor: false,
    referenteA: dados.referenteA ?? null,
    origem: "manual",
    pessoaId: `pessoa-${dados.id ?? "p"}`,
    nome: dados.nome ?? "Fulana",
    documento: null,
    oab: dados.oab ?? null,
    observacao: null,
    enderecos: [],
    contatos: dados.contatos ?? [],
  };
}

const pedido = (resultado: Partial<PedidoTrabalhista>): PedidoTrabalhista => ({
  id: Math.random().toString(),
  origem: "manual",
  documentoId: null,
  pagina: null,
  criadoPorNome: null,
  pedido: "x",
  valorPedido: null,
  resultadoSentenca: null,
  resultadoAcordao: null,
  resultadoRr: null,
  detalhe: null,
  ...resultado,
});

describe("linhaDaCarteiraTrabalhista", () => {
  it("monta a linha com reclamante, advogado, laudo, pedidos deferidos, risco e saneamento", () => {
    const valores = {
      area: "Trabalhista",
      cnj: "0000001-11.2024.5.15.0001",
      polo_cliente: "Passivo",
      situacao: "Ativo",
      laudo_agente: "insalubridade",
      laudo_grau: "maximo",
      decisao_prevalece: "acordao",
      tipo_termino: "rescisao_indireta",
      risco_total: 1948.56,
    };
    const partes = [
      parte({ id: "r", nome: "Reclamante Exemplo" }),
      parte({ id: "a", papel: "advogado", nome: "Advogada Exemplo", oab: "SP 1", referenteA: "r", contatos: [{ tipo: "email", valor: "adv@exemplo.adv.br", whatsapp: false, observacao: null }] }),
      parte({ id: "e", polo: "passivo", nome: "Empresa Exemplo" }),
    ];
    const itens = {
      afastamentos: [],
      pedidos: [pedido({ resultadoSentenca: "deferido", resultadoAcordao: "indeferido" }), pedido({ resultadoSentenca: "em_parte" }), pedido({ resultadoSentenca: "indeferido" })],
    };
    const linha = linhaDaCarteiraTrabalhista("1", valores, partes, itens, calcularPreenchimento(valores, partes, [], { pedidos: 3 }), SEM_ATUALIZACAO, { status: "enviado", valorMaximoCliente: 1500 });
    expect(linha).toMatchObject({
      reclamante: "Reclamante Exemplo",
      advogadosReclamante: [{ nome: "Advogada Exemplo", oab: "SP 1", emails: ["adv@exemplo.adv.br"] }],
      laudo: "Insalubridade, máximo",
      decisao: "Acórdão (TRT)",
      tipoTermino: "Rescisão indireta",
      pedidos: 3,
      pedidosDeferidos: 1,
      riscoTotal: 1948.56,
      encerrado: false,
      negociacao: "enviado",
      valorMaximoCliente: 1500,
    });
    expect(linha.saneamento.faltando).toContain("Data de admissão");
  });
});
