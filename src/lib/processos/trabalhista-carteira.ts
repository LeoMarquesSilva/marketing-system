import type { Valores } from "./campos";
import type { StatusNegociacao } from "./negociacao";
import { processoEncerrado, type AtualizacaoDosAutos } from "./rec-credito";
import { AGENTES_LAUDO, DECISOES, GRAUS, SITUACOES_PRESCRICAO, TIPOS_TERMINO } from "./trabalhista-opcoes";
import { advogadosDoReclamante, emailsDaParte, poloDoReclamante, resultadoFinal, type ItensTrabalhistas } from "./trabalhista";
import type { Parte, Preenchimento } from "./types";

/**
 * Carteira Trabalhista: uma linha por processo da área, com o que a equipe acompanha (reclamante e advogado, contrato,
 * laudo, decisões, pedidos, risco, saneamento, atualização dos autos e a negociação de acordo). Sem banco.
 */

export interface LinhaCarteiraTrabalhista {
  id: string;
  ci: string | null;
  cnj: string | null;
  grupoCliente: string | null;
  cliente: string | null;
  reclamante: string | null;
  advogadoResponsavel: string | null;
  fase: string | null;
  situacao: string | null;
  encerrado: boolean;
  advogadosReclamante: { nome: string; oab: string | null; emails: string[] }[];
  admissao: string | null;
  termino: string | null;
  tipoTermino: string | null;
  cargo: string | null;
  laudo: string | null;
  decisao: string | null;
  transito: string | null;
  /** Resumo da prescrição: quinquenal (com o marco) e bienal/intercorrente acolhidas. */
  prescricao: string | null;
  afastamentos: number;
  pedidos: number;
  /** Pedidos com condenação na última decisão que os julgou (deferido ou em parte). */
  pedidosDeferidos: number;
  riscoValor: number | null;
  riscoReflexos: number | null;
  riscoTotal: number | null;
  saneamento: { feitos: number; total: number; percentual: number; faltando: string[] };
  autos: AtualizacaoDosAutos;
  negociacao: StatusNegociacao;
  valorMaximoCliente: number | null;
}

const texto = (valor: unknown) => (typeof valor === "string" && valor ? valor : null);
const numero = (valor: unknown) => (typeof valor === "number" && Number.isFinite(valor) ? valor : null);
const rotulo = (lista: readonly { valor: string; rotulo: string }[], valor: unknown) => (typeof valor === "string" && valor ? (lista.find((item) => item.valor === valor)?.rotulo ?? valor) : null);

const brData = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** "Quinquenal acolhida (antes de 09/11/2021) · bienal acolhida": o que a ficha diz da prescrição. */
export function resumoDaPrescricao(valores: Valores): string | null {
  const partes: string[] = [];
  const quinquenal = rotulo(SITUACOES_PRESCRICAO, valores.prescricao_quinquenal);
  const marco = texto(valores.prescricao_quinquenal_marco);
  if (quinquenal || marco) partes.push(`Quinquenal${quinquenal ? ` ${quinquenal.toLowerCase()}` : ""}${marco ? ` (antes de ${brData(marco)})` : ""}`);
  const bienal = rotulo(SITUACOES_PRESCRICAO, valores.prescricao_bienal);
  if (bienal && valores.prescricao_bienal !== "nao_alegada") partes.push(`bienal ${bienal.toLowerCase()}`);
  const intercorrente = rotulo(SITUACOES_PRESCRICAO, valores.prescricao_intercorrente);
  if (intercorrente && valores.prescricao_intercorrente !== "nao_alegada") partes.push(`intercorrente ${intercorrente.toLowerCase()}`);
  return partes.length ? partes.join(" · ") : null;
}

export function linhaDaCarteiraTrabalhista(
  id: string,
  valores: Valores,
  partes: Parte[],
  itens: ItensTrabalhistas,
  preenchimento: Preenchimento,
  autos: AtualizacaoDosAutos,
  negociacao: { status: StatusNegociacao; valorMaximoCliente: number | null }
): LinhaCarteiraTrabalhista {
  const polo = poloDoReclamante(valores.polo_cliente);
  const reclamante = partes.filter((parte) => parte.papel === "parte" && parte.polo === polo).map((parte) => parte.nome).join("; ") || null;
  const agente = rotulo(AGENTES_LAUDO, valores.laudo_agente);
  const grau = rotulo(GRAUS, valores.laudo_grau);
  return {
    id,
    ci: texto(valores.ci),
    cnj: texto(valores.cnj),
    grupoCliente: texto(valores.grupo_cliente),
    cliente: texto(valores.cliente),
    reclamante,
    advogadoResponsavel: texto(valores.advogado_responsavel),
    fase: texto(valores.fase),
    situacao: texto(valores.situacao),
    encerrado: processoEncerrado({ situacao: texto(valores.situacao), dataEncerramento: texto(valores.data_encerramento) }),
    advogadosReclamante: advogadosDoReclamante(partes, valores.polo_cliente).map((parte) => ({ nome: parte.nome, oab: parte.oab, emails: emailsDaParte(parte) })),
    admissao: texto(valores.data_admissao),
    termino: texto(valores.data_termino),
    tipoTermino: rotulo(TIPOS_TERMINO, valores.tipo_termino),
    cargo: texto(valores.cargo),
    laudo: agente ? (grau && valores.laudo_agente !== "periculosidade" && valores.laudo_agente !== "nenhum" ? `${agente}, ${grau.replace(/ \(.*\)$/, "").toLowerCase()}` : agente) : null,
    decisao: rotulo(DECISOES, valores.decisao_prevalece),
    transito: texto(valores.data_transito),
    prescricao: resumoDaPrescricao(valores),
    afastamentos: itens.afastamentos.length,
    pedidos: itens.pedidos.length,
    pedidosDeferidos: itens.pedidos.filter((pedido) => ["deferido", "em_parte"].includes(resultadoFinal(pedido) ?? "")).length,
    riscoValor: numero(valores.risco_valor),
    riscoReflexos: numero(valores.risco_reflexos),
    riscoTotal: numero(valores.risco_total),
    saneamento: {
      feitos: preenchimento.feitos,
      total: preenchimento.total,
      percentual: preenchimento.percentual,
      faltando: preenchimento.itens.filter((item) => item.estado === "falta").map((item) => item.rotulo),
    },
    autos,
    negociacao: negociacao.status,
    valorMaximoCliente: negociacao.valorMaximoCliente,
  };
}
