import { ProcessosError } from "./errors";
import { dataObrigatoria, dataOpcional, formatarData, formatarReal, lerValor, textoOpcional, umaDas, valorPositivo } from "./rec-credito";

/**
 * Acordos do processo e o cumprimento das parcelas. Vale em qualquer área: `posicao` diz se o cliente recebe
 * (Rec. Crédito: a parcela paga é valor recuperado) ou paga (trabalhista, cível). Sem banco: o servidor carrega
 * as linhas e chama estas funções.
 */

export type PosicaoAcordo = "recebe" | "paga";
/** O que uma pessoa (ou a leitura dos autos aprovada) declara. */
export type SituacaoDeclarada = "vigente" | "descumprido" | "cancelado";
/** O que a tela mostra: a declarada, ou a calculada pelas parcelas (em dia, em atraso, cumprido). */
export type SituacaoDoAcordo = "em_dia" | "em_atraso" | "cumprido" | "descumprido" | "cancelado";
export type OrigemAcordo = "manual" | "autos";
export type Periodicidade = "mensal" | "quinzenal" | "semanal";

export const POSICOES: { valor: PosicaoAcordo; rotulo: string }[] = [
  { valor: "recebe", rotulo: "O cliente recebe" },
  { valor: "paga", rotulo: "O cliente paga" },
];

export const SITUACOES_DECLARADAS: { valor: SituacaoDeclarada; rotulo: string }[] = [
  { valor: "vigente", rotulo: "Vigente" },
  { valor: "descumprido", rotulo: "Descumprido" },
  { valor: "cancelado", rotulo: "Cancelado" },
];

export const PERIODICIDADES: { valor: Periodicidade; rotulo: string }[] = [
  { valor: "mensal", rotulo: "Mensal" },
  { valor: "quinzenal", rotulo: "Quinzenal" },
  { valor: "semanal", rotulo: "Semanal" },
];

export const ROTULO_SITUACAO_ACORDO: Record<SituacaoDoAcordo, string> = {
  em_dia: "Em dia",
  em_atraso: "Em atraso",
  cumprido: "Cumprido",
  descumprido: "Descumprido",
  cancelado: "Cancelado",
};

export interface Parcela {
  id: string;
  numero: number;
  vencimento: string;
  valor: number;
  pagoEm: string | null;
  valorPago: number | null;
  observacao: string | null;
  origem: OrigemAcordo;
  documentoId: string | null;
  pagina: number | null;
}

export interface Acordo {
  id: string;
  processoId: string;
  posicao: PosicaoAcordo;
  celebradoEm: string | null;
  homologadoEm: string | null;
  valorTotal: number;
  multaPercentual: number | null;
  situacao: SituacaoDeclarada;
  descumpridoEm: string | null;
  observacao: string | null;
  origem: OrigemAcordo;
  documentoId: string | null;
  pagina: number | null;
  criadoPorNome: string | null;
  parcelas: Parcela[];
}

export interface ResumoDoAcordo {
  situacao: SituacaoDoAcordo;
  parcelas: number;
  pagas: number;
  /** Parcelas vencidas antes de hoje e sem pagamento. */
  vencidas: number;
  /** Dias desde o vencimento da parcela em atraso mais antiga (zero sem atraso). */
  diasDeAtraso: number;
  valorPago: number;
  /** Soma das parcelas ainda não pagas. */
  saldo: number;
  proxima: { numero: number; vencimento: string; valor: number } | null;
}

const DIA = 86_400_000;
const centavos = (valor: number) => Math.round(valor * 100);
const reais = (valorEmCentavos: number) => valorEmCentavos / 100;

export function rotuloDaParcela(numero: number, total?: number): string {
  if (numero === 0) return "Entrada";
  return total ? `Parcela ${numero} de ${total}` : `Parcela ${numero}`;
}

/** Situação para a tela: cancelado e descumprido valem como declarados; senão, pelas parcelas e pela data de hoje. */
export function resumoDoAcordo(acordo: Pick<Acordo, "situacao" | "parcelas">, hoje: string): ResumoDoAcordo {
  const parcelas = [...acordo.parcelas].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero);
  const abertas = parcelas.filter((parcela) => !parcela.pagoEm);
  const vencidas = abertas.filter((parcela) => parcela.vencimento < hoje);
  const pagas = parcelas.length - abertas.length;
  const maisAntiga = vencidas[0]?.vencimento;
  let situacao: SituacaoDoAcordo;
  if (acordo.situacao === "cancelado") situacao = "cancelado";
  else if (acordo.situacao === "descumprido") situacao = "descumprido";
  else if (parcelas.length && !abertas.length) situacao = "cumprido";
  else situacao = vencidas.length ? "em_atraso" : "em_dia";
  const proxima = abertas[0];
  return {
    situacao,
    parcelas: parcelas.length,
    pagas,
    vencidas: vencidas.length,
    diasDeAtraso: maisAntiga ? Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${maisAntiga}T00:00:00Z`)) / DIA) : 0,
    valorPago: reais(parcelas.reduce((soma, parcela) => soma + centavos(parcela.valorPago ?? 0), 0)),
    saldo: reais(abertas.reduce((soma, parcela) => soma + centavos(parcela.valor), 0)),
    proxima: proxima ? { numero: proxima.numero, vencimento: proxima.vencimento, valor: proxima.valor } : null,
  };
}

/** Soma `meses` a uma data AAAA-MM-DD mantendo o dia (31/01 + 1 mês = 28 ou 29/02). */
export function somarMeses(data: string, meses: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

function somarDias(data: string, dias: number): string {
  return new Date(Date.parse(`${data}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
}

export interface PlanoDoAcordo {
  valorTotal: number;
  entrada: { valor: number; vencimento: string } | null;
  quantidade: number;
  primeiroVencimento: string;
  periodicidade: Periodicidade;
  /** Valor de cada parcela, quando o acordo diz. Sem ele, o saldo (total − entrada) é dividido igual. */
  valorParcela: number | null;
}

/**
 * As parcelas do acordo (0 = entrada). Dividindo o saldo, os centavos que sobram vão na última parcela, para
 * a soma bater com o total.
 */
export function gerarParcelas(plano: PlanoDoAcordo): { numero: number; vencimento: string; valor: number }[] {
  if (!Number.isInteger(plano.quantidade) || plano.quantidade < 0 || plano.quantidade > 360) throw new ProcessosError("Número de parcelas inválido (de 0 a 360).", 400);
  const parcelas: { numero: number; vencimento: string; valor: number }[] = [];
  const entrada = plano.entrada ? centavos(plano.entrada.valor) : 0;
  if (plano.entrada) parcelas.push({ numero: 0, vencimento: plano.entrada.vencimento, valor: reais(entrada) });
  if (!plano.quantidade) return parcelas;
  const saldo = centavos(plano.valorTotal) - entrada;
  const cada = plano.valorParcela ? centavos(plano.valorParcela) : Math.floor(saldo / plano.quantidade);
  if (!(cada > 0)) throw new ProcessosError("A entrada é maior que o valor total do acordo.", 400);
  for (let numero = 1; numero <= plano.quantidade; numero += 1) {
    const indice = numero - 1;
    const vencimento =
      plano.periodicidade === "mensal" ? somarMeses(plano.primeiroVencimento, indice) : somarDias(plano.primeiroVencimento, indice * (plano.periodicidade === "quinzenal" ? 15 : 7));
    const ultima = numero === plano.quantidade && !plano.valorParcela;
    parcelas.push({ numero, vencimento, valor: reais(ultima ? saldo - cada * indice : cada) });
  }
  return parcelas;
}

/* ------------------------------------------------------------- validação */

/** Corpo da tela → colunas de proc_acordos; erro de validação vira 400. */
export function colunasDoAcordo(dados: Record<string, unknown>): Record<string, unknown> {
  const multa = lerValor(dados.multaPercentual);
  if (multa !== null && (!Number.isFinite(multa) || multa < 0 || multa > 100)) throw new ProcessosError("Multa do acordo inválida (de 0 a 100%).", 400);
  return {
    posicao: umaDas(dados.posicao, POSICOES, "quem paga", "recebe"),
    celebrado_em: dataOpcional(dados.celebradoEm, "a data do acordo"),
    homologado_em: dataOpcional(dados.homologadoEm, "a data da homologação"),
    valor_total: valorPositivo(dados.valorTotal, "o valor total do acordo", true),
    multa_percentual: multa,
    observacao: textoOpcional(dados.observacao, 2000),
  };
}

/** Plano de parcelas do formulário de acordo novo (entrada, quantidade, primeiro vencimento, periodicidade). */
export function planoDoFormulario(dados: Record<string, unknown>, valorTotal: number): PlanoDoAcordo {
  const entradaValor = valorPositivo(dados.entradaValor, "o valor da entrada", false);
  const entradaVencimento = dataOpcional(dados.entradaVencimento, "o vencimento da entrada");
  if (entradaValor && !entradaVencimento) throw new ProcessosError("Informe o vencimento da entrada.", 400);
  const quantidade = lerValor(dados.quantidade) ?? 0;
  if (!Number.isInteger(quantidade)) throw new ProcessosError("Número de parcelas inválido.", 400);
  if (!quantidade && !entradaValor) throw new ProcessosError("Informe as parcelas ou a entrada (pagamento único).", 400);
  return {
    valorTotal,
    entrada: entradaValor && entradaVencimento ? { valor: entradaValor, vencimento: entradaVencimento } : null,
    quantidade,
    primeiroVencimento: quantidade ? dataObrigatoria(dados.primeiroVencimento, "o vencimento da 1ª parcela") : "",
    periodicidade: umaDas(dados.periodicidade, PERIODICIDADES, "a periodicidade", "mensal"),
    valorParcela: valorPositivo(dados.valorParcela, "o valor da parcela", false),
  };
}

/** Corpo da tela → colunas de proc_acordo_parcelas (vencimento, valor, pagamento e observação). */
export function colunasDaParcela(dados: Record<string, unknown>): Record<string, unknown> {
  const pagoEm = dataOpcional(dados.pagoEm, "a data do pagamento");
  const valor = valorPositivo(dados.valor, "o valor da parcela", true) as number;
  const valorPago = pagoEm ? (valorPositivo(dados.valorPago, "o valor pago", false) ?? valor) : null;
  return {
    vencimento: dataObrigatoria(dados.vencimento, "o vencimento"),
    valor,
    pago_em: pagoEm,
    valor_pago: valorPago,
    observacao: textoOpcional(dados.observacao, 1000),
  };
}

export function descreverAcordo(acordo: { valorTotal: number; celebradoEm: string | null; homologadoEm: string | null; posicao: PosicaoAcordo }, parcelas: number): string {
  const quando = acordo.homologadoEm ? `homologado em ${formatarData(acordo.homologadoEm)}` : acordo.celebradoEm ? `de ${formatarData(acordo.celebradoEm)}` : "sem data";
  return `Acordo ${quando}: ${formatarReal(acordo.valorTotal)} em ${parcelas} parcela${parcelas === 1 ? "" : "s"} (${acordo.posicao === "recebe" ? "o cliente recebe" : "o cliente paga"})`;
}

/* --------------------------------------------- dinheiro na Rec. Crédito */

/**
 * Parcelas pagas dos acordos em que o cliente recebe, como valores levantados: entram no recuperado e são
 * abatidas no valor atualizado. Acordo cancelado não conta.
 */
export function levantamentosDosAcordos(acordos: Pick<Acordo, "posicao" | "situacao" | "parcelas">[]): { tipo: "levantamento"; data: string; valor: number; descricao: string }[] {
  const lista: { tipo: "levantamento"; data: string; valor: number; descricao: string }[] = [];
  for (const acordo of acordos) {
    if (acordo.posicao !== "recebe" || acordo.situacao === "cancelado") continue;
    const total = acordo.parcelas.filter((parcela) => parcela.numero > 0).length;
    for (const parcela of acordo.parcelas) {
      if (!parcela.pagoEm || !parcela.valorPago) continue;
      lista.push({ tipo: "levantamento", data: parcela.pagoEm, valor: parcela.valorPago, descricao: `${rotuloDaParcela(parcela.numero, total).toLowerCase()} do acordo` });
    }
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/** Resumo de todos os acordos do processo para a carteira: o mais recente que não foi cancelado, ou o último. */
export function acordoEmDestaque(acordos: Acordo[]): Acordo | null {
  const ordem = [...acordos].sort((a, b) => (b.homologadoEm ?? b.celebradoEm ?? "").localeCompare(a.homologadoEm ?? a.celebradoEm ?? ""));
  return ordem.find((acordo) => acordo.situacao !== "cancelado") ?? ordem[0] ?? null;
}

/** O acordo do processo como a carteira mostra: o em destaque, a situação pelas parcelas e quantos acordos há. */
export interface AcordoNaCarteira {
  posicao: PosicaoAcordo;
  valorTotal: number;
  resumo: ResumoDoAcordo;
  quantidade: number;
}

export function acordoNaCarteira(acordos: Acordo[], hoje: string): AcordoNaCarteira | null {
  const destaque = acordoEmDestaque(acordos);
  if (!destaque) return null;
  return { posicao: destaque.posicao, valorTotal: destaque.valorTotal, resumo: resumoDoAcordo(destaque, hoje), quantidade: acordos.length };
}

/** Soma do que o cliente já recebeu pelos acordos (parcelas pagas; acordo cancelado não conta). */
export function recebidoEmAcordos(acordos: Acordo[]): number {
  return Math.round(levantamentosDosAcordos(acordos).reduce((soma, item) => soma + item.valor * 100, 0)) / 100;
}
