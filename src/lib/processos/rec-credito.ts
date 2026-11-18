import { ProcessosError } from "./errors";
import { IndiceAusente, atualizarCredito, atualizarTitulo, duracaoDoProcesso, percentualRecuperado, type CreditoAtualizado, type TabelaTjsp } from "./calculo-tjsp";

/**
 * Saneamento da Recuperação de Crédito: títulos executados, tentativas de citação, pedidos de execução e
 * lançamentos de dinheiro (guias pagas e valores levantados) de cada processo, e o resumo da carteira.
 * Sem banco: o servidor carrega as linhas e chama estas funções.
 */

export type TipoItem = "titulo" | "citacao" | "pedido" | "lancamento";
export type OrigemItem = "manual" | "autos";

interface Comum {
  id: string;
  origem: OrigemItem;
  documentoId: string | null;
  pagina: number | null;
  criadoPorNome: string | null;
}

export interface Titulo extends Comum {
  tipo: string;
  numero: string | null;
  valor: number;
  vencimento: string;
}

export const MEIOS_CITACAO = [
  { valor: "ar", rotulo: "AR (correio)" },
  { valor: "oficial", rotulo: "Oficial de justiça" },
  { valor: "edital", rotulo: "Edital" },
  { valor: "eletronica", rotulo: "Eletrônica" },
  { valor: "outro", rotulo: "Outro" },
] as const;
export type MeioCitacao = (typeof MEIOS_CITACAO)[number]["valor"];

export const RESULTADOS_CITACAO = [
  { valor: "positiva", rotulo: "Positiva" },
  { valor: "negativa", rotulo: "Negativa" },
  { valor: "pendente", rotulo: "Aguardando retorno" },
] as const;
export type ResultadoCitacao = (typeof RESULTADOS_CITACAO)[number]["valor"];

export interface Citacao extends Comum {
  endereco: string | null;
  tentativaEm: string | null;
  meio: MeioCitacao;
  resultado: ResultadoCitacao;
  observacao: string | null;
}

/** Pedidos mais comuns na execução; o campo aceita outro texto. */
export const TIPOS_PEDIDO = ["SISBAJUD", "RENAJUD", "INFOJUD", "CNIB", "SERASAJUD", "Penhora", "Pesquisa de bens", "Protesto", "Desconsideração da personalidade jurídica", "Citação por edital", "Outro"];

export const SITUACOES_PEDIDO = [
  { valor: "requerido", rotulo: "Requerido" },
  { valor: "deferido", rotulo: "Deferido" },
  { valor: "indeferido", rotulo: "Indeferido" },
  { valor: "prejudicado", rotulo: "Prejudicado" },
] as const;
export type SituacaoPedido = (typeof SITUACOES_PEDIDO)[number]["valor"];

export interface PedidoExecucao extends Comum {
  pedidoEm: string | null;
  tipo: string;
  descricao: string | null;
  situacao: SituacaoPedido;
  decididoEm: string | null;
  resultado: string | null;
  valorObtido: number | null;
}

export const TIPOS_LANCAMENTO = [
  { valor: "guia_paga", rotulo: "Guia paga" },
  { valor: "levantamento", rotulo: "Valor levantado" },
] as const;
export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number]["valor"];

export interface Lancamento extends Comum {
  tipo: TipoLancamento;
  data: string;
  valor: number;
  descricao: string | null;
}

export interface ItensRecCredito {
  titulos: Titulo[];
  citacoes: Citacao[];
  pedidos: PedidoExecucao[];
  lancamentos: Lancamento[];
}

/** O cálculo do crédito em duas datas: no ajuizamento (para a inicial) e hoje (ou no encerramento). */
export interface CalculoDoCredito {
  ajuizamento: CreditoAtualizado | null;
  atual: CreditoAtualizado | null;
  /** Por que alguma das contas não saiu (sem data do ajuizamento, índice do mês ainda não publicado…). */
  avisos: string[];
}

/** Ficha da Rec. Crédito de um processo: os itens lançados e o cálculo. */
export interface RecCreditoDoProcesso extends ItensRecCredito {
  calculo: CalculoDoCredito;
  dataAjuizamento: string | null;
  dataFinal: string;
  indicesAte: string | null;
}

/* ------------------------------------------------------------ validação */

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function textoOpcional(bruto: unknown, limite: number): string | null {
  if (bruto === null || bruto === undefined) return null;
  if (typeof bruto !== "string") throw new ProcessosError("Valor de texto inválido.", 400);
  const texto = bruto.trim();
  if (texto.length > limite) throw new ProcessosError(`Texto longo demais (até ${limite} caracteres).`, 400);
  return texto || null;
}

function textoObrigatorio(bruto: unknown, rotulo: string, limite: number): string {
  const texto = textoOpcional(bruto, limite);
  if (!texto) throw new ProcessosError(`Informe ${rotulo}.`, 400);
  return texto;
}

function dataOpcional(bruto: unknown, rotulo: string): string | null {
  if (bruto === null || bruto === undefined || bruto === "") return null;
  if (typeof bruto !== "string" || !DATA.test(bruto) || Number.isNaN(Date.parse(`${bruto}T00:00:00Z`))) throw new ProcessosError(`Data inválida em ${rotulo}.`, 400);
  return bruto;
}

function dataObrigatoria(bruto: unknown, rotulo: string): string {
  const data = dataOpcional(bruto, rotulo);
  if (!data) throw new ProcessosError(`Informe ${rotulo}.`, 400);
  return data;
}

/** Aceita número ou texto no formato brasileiro ("1.234,56") ou com ponto decimal. */
export function lerValor(bruto: unknown): number | null {
  if (bruto === null || bruto === undefined || bruto === "") return null;
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : NaN;
  if (typeof bruto !== "string") return NaN;
  const limpo = bruto.replace(/[R$\s]/g, "");
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN;
}

function valorPositivo(bruto: unknown, rotulo: string, obrigatorio: boolean): number | null {
  const valor = lerValor(bruto);
  if (valor === null) {
    if (obrigatorio) throw new ProcessosError(`Informe ${rotulo}.`, 400);
    return null;
  }
  if (!Number.isFinite(valor) || valor <= 0) throw new ProcessosError(`Valor inválido em ${rotulo}.`, 400);
  return Math.round(valor * 100) / 100;
}

function umaDas<T extends string>(bruto: unknown, lista: readonly { valor: T }[], rotulo: string, padrao?: T): T {
  if ((bruto === undefined || bruto === null || bruto === "") && padrao) return padrao;
  const achado = lista.find((item) => item.valor === bruto);
  if (!achado) throw new ProcessosError(`Escolha uma opção válida em ${rotulo}.`, 400);
  return achado.valor;
}

/** Converte o corpo da tela nas colunas da tabela do tipo; erro de validação vira 400. */
export function colunasDoItem(tipo: TipoItem, dados: Record<string, unknown>): Record<string, unknown> {
  switch (tipo) {
    case "titulo":
      return {
        tipo: textoObrigatorio(dados.tipo, "o tipo do título", 80),
        numero: textoOpcional(dados.numero, 120),
        valor: valorPositivo(dados.valor, "o valor do título", true),
        vencimento: dataObrigatoria(dados.vencimento, "o vencimento"),
      };
    case "citacao":
      return {
        endereco: textoOpcional(dados.endereco, 500),
        tentativa_em: dataOpcional(dados.tentativaEm, "a data da tentativa"),
        meio: umaDas(dados.meio, MEIOS_CITACAO, "meio", "ar"),
        resultado: umaDas(dados.resultado, RESULTADOS_CITACAO, "resultado", "pendente"),
        observacao: textoOpcional(dados.observacao, 1000),
      };
    case "pedido":
      return {
        pedido_em: dataOpcional(dados.pedidoEm, "a data do pedido"),
        tipo: textoObrigatorio(dados.tipo, "o pedido", 120),
        descricao: textoOpcional(dados.descricao, 1000),
        situacao: umaDas(dados.situacao, SITUACOES_PEDIDO, "situação", "requerido"),
        decidido_em: dataOpcional(dados.decididoEm, "a data da decisão"),
        resultado: textoOpcional(dados.resultado, 1000),
        valor_obtido: valorPositivo(dados.valorObtido, "o valor obtido", false),
      };
    case "lancamento":
      return {
        tipo: umaDas(dados.tipo, TIPOS_LANCAMENTO, "tipo"),
        data: dataObrigatoria(dados.data, "a data"),
        valor: valorPositivo(dados.valor, "o valor", true),
        descricao: textoOpcional(dados.descricao, 500),
      };
  }
}

export const TABELA_DO_ITEM: Record<TipoItem, string> = {
  titulo: "proc_titulos",
  citacao: "proc_citacoes",
  pedido: "proc_pedidos_execucao",
  lancamento: "proc_lancamentos",
};

export const ROTULO_DO_ITEM: Record<TipoItem, string> = {
  titulo: "Título",
  citacao: "Citação",
  pedido: "Pedido de execução",
  lancamento: "Lançamento",
};

export function ehTipoItem(valor: unknown): valor is TipoItem {
  return typeof valor === "string" && valor in TABELA_DO_ITEM;
}

/** Texto curto do item para o histórico do processo. */
export function descreverItem(tipo: TipoItem, colunas: Record<string, unknown>): string {
  const real = (valor: unknown) => (typeof valor === "number" ? formatarReal(valor) : "");
  const data = (valor: unknown) => (typeof valor === "string" && valor ? formatarData(valor) : "sem data");
  switch (tipo) {
    case "titulo":
      return `${colunas.tipo}${colunas.numero ? ` nº ${colunas.numero}` : ""}, ${real(colunas.valor)}, vencimento ${data(colunas.vencimento)}`;
    case "citacao":
      return `${MEIOS_CITACAO.find((item) => item.valor === colunas.meio)?.rotulo ?? colunas.meio} em ${data(colunas.tentativa_em)}: ${RESULTADOS_CITACAO.find((item) => item.valor === colunas.resultado)?.rotulo ?? colunas.resultado}`;
    case "pedido":
      return `${colunas.tipo} (${data(colunas.pedido_em)}): ${SITUACOES_PEDIDO.find((item) => item.valor === colunas.situacao)?.rotulo ?? colunas.situacao}`;
    case "lancamento":
      return `${TIPOS_LANCAMENTO.find((item) => item.valor === colunas.tipo)?.rotulo ?? colunas.tipo}: ${real(colunas.valor)} em ${data(colunas.data)}`;
  }
}

/* ------------------------------------------------------------ cálculo e carteira */

export function formatarReal(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function contaSegura(tabela: TabelaTjsp, titulos: Titulo[], dataFinal: string, rotulo: string, avisos: string[]): CreditoAtualizado | null {
  if (!titulos.length) return null;
  try {
    return atualizarCredito(tabela, titulos, dataFinal);
  } catch (erro) {
    if (erro instanceof IndiceAusente) {
      avisos.push(`${rotulo}: o TJSP ainda não publicou o índice de ${erro.mes.slice(5, 7)}/${erro.mes.slice(0, 4)}.`);
      return null;
    }
    throw erro;
  }
}

/** Último dia com índice publicado: a conta "hoje" para nele quando o mês corrente ainda não saiu. */
function limitarAosIndices(data: string, indicesAte: string | null): string {
  if (!indicesAte) return data;
  const fimDoMes = new Date(Date.UTC(Number(indicesAte.slice(0, 4)), Number(indicesAte.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return data > fimDoMes ? fimDoMes : data;
}

/**
 * O crédito atualizado no ajuizamento (títulos trazidos ao dia da distribuição, como a equipe faz ao
 * receber a demanda) e na data final (encerramento, ou hoje para processo ativo).
 */
export function calcularCredito(tabela: TabelaTjsp, titulos: Titulo[], dataAjuizamento: string | null, dataFinal: string, indicesAte: string | null): CalculoDoCredito {
  const avisos: string[] = [];
  if (titulos.length && !dataAjuizamento) avisos.push("Sem a data da distribuição no cadastro: o valor no ajuizamento não foi calculado.");
  const ajuizamento = dataAjuizamento ? contaSegura(tabela, titulos, dataAjuizamento, "No ajuizamento", avisos) : null;
  const atual = contaSegura(tabela, titulos, limitarAosIndices(dataFinal, indicesAte), "Atualizado", avisos);
  return { ajuizamento, atual, avisos };
}

export type SituacaoCitacao = "positiva" | "negativa" | "pendente" | "sem_tentativa";

/** Positiva se alguma tentativa deu certo; negativa se todas voltaram negativas; senão, aguardando. */
export function situacaoDaCitacao(citacoes: Citacao[]): SituacaoCitacao {
  if (!citacoes.length) return "sem_tentativa";
  if (citacoes.some((citacao) => citacao.resultado === "positiva")) return "positiva";
  if (citacoes.every((citacao) => citacao.resultado === "negativa")) return "negativa";
  return "pendente";
}

export const ROTULO_SITUACAO_CITACAO: Record<SituacaoCitacao, string> = {
  positiva: "Positiva",
  negativa: "Negativa",
  pendente: "Aguardando retorno",
  sem_tentativa: "Sem tentativa lançada",
};

export interface DadosDoProcessoNaCarteira {
  id: string;
  ci: string | null;
  cnj: string | null;
  grupoCliente: string | null;
  cliente: string | null;
  devedor: string | null;
  acao: string | null;
  fase: string | null;
  situacao: string | null;
  dataDistribuicao: string | null;
  dataCadastro: string | null;
  dataEncerramento: string | null;
  valorAcao: number | null;
  valorOriginalCadastro: number | null;
  proximosPassos: string | null;
}

export interface LinhaCarteira extends DadosDoProcessoNaCarteira {
  encerrado: boolean;
  tiposCredito: string[];
  quantidadeTitulos: number;
  valorOriginal: number | null;
  valorNoAjuizamento: number | null;
  valorAtualizado: number | null;
  citacao: SituacaoCitacao;
  enderecosTentados: string[];
  tentativasCitacao: number;
  pedidos: { tipo: string; situacao: SituacaoPedido; data: string | null; resultado: string | null }[];
  pedidosDeferidos: number;
  guiasPagas: number;
  valorRecuperado: number;
  saving: number | null;
  duracao: { meses: number; rotulo: string; desde: "distribuicao" | "cadastro" } | null;
  avisos: string[];
}

export function processoEncerrado(dados: Pick<DadosDoProcessoNaCarteira, "situacao" | "dataEncerramento">): boolean {
  if (dados.dataEncerramento) return true;
  return Boolean(dados.situacao) && !/^ativo/i.test(dados.situacao ?? "");
}

/** Uma linha da carteira: o que a equipe pediu ver de cada processo, com o cálculo do TJSP. */
export function linhaDaCarteira(dados: DadosDoProcessoNaCarteira, itens: ItensRecCredito, tabela: TabelaTjsp | null, hoje: string, indicesAte: string | null): LinhaCarteira {
  const encerrado = processoEncerrado(dados);
  const dataFinal = encerrado && dados.dataEncerramento ? dados.dataEncerramento : hoje;
  const avisos: string[] = [];
  let calculo: CalculoDoCredito = { ajuizamento: null, atual: null, avisos: [] };
  if (tabela) calculo = calcularCredito(tabela, itens.titulos, dados.dataDistribuicao, dataFinal, indicesAte);
  else if (itens.titulos.length) avisos.push("Os índices do TJSP ainda não foram importados.");
  avisos.push(...calculo.avisos);

  const somaTitulos = itens.titulos.reduce((soma, titulo) => soma + titulo.valor, 0);
  const guiasPagas = itens.lancamentos.filter((item) => item.tipo === "guia_paga").reduce((soma, item) => soma + item.valor, 0);
  const valorRecuperado = itens.lancamentos.filter((item) => item.tipo === "levantamento").reduce((soma, item) => soma + item.valor, 0);
  const base = calculo.atual?.total ?? null;
  const inicioDuracao = dados.dataDistribuicao ?? dados.dataCadastro;
  const duracao = duracaoDoProcesso(inicioDuracao, dataFinal);
  const enderecos = [...new Set(itens.citacoes.map((citacao) => citacao.endereco?.trim()).filter((valor): valor is string => Boolean(valor)))];
  const pedidos = [...itens.pedidos]
    .sort((a, b) => (a.pedidoEm ?? "").localeCompare(b.pedidoEm ?? ""))
    .map((pedido) => ({ tipo: pedido.tipo, situacao: pedido.situacao, data: pedido.pedidoEm, resultado: pedido.resultado }));

  return {
    ...dados,
    encerrado,
    tiposCredito: [...new Set(itens.titulos.map((titulo) => titulo.tipo))],
    quantidadeTitulos: itens.titulos.length,
    valorOriginal: itens.titulos.length ? Math.round(somaTitulos * 100) / 100 : dados.valorOriginalCadastro,
    valorNoAjuizamento: calculo.ajuizamento?.total ?? null,
    valorAtualizado: base,
    citacao: situacaoDaCitacao(itens.citacoes),
    enderecosTentados: enderecos,
    tentativasCitacao: itens.citacoes.length,
    pedidos,
    pedidosDeferidos: itens.pedidos.filter((pedido) => pedido.situacao === "deferido").length,
    guiasPagas: Math.round(guiasPagas * 100) / 100,
    valorRecuperado: Math.round(valorRecuperado * 100) / 100,
    saving: base === null ? null : percentualRecuperado(valorRecuperado, base),
    duracao: duracao ? { ...duracao, desde: dados.dataDistribuicao ? "distribuicao" : "cadastro" } : null,
    avisos,
  };
}

export interface ValorDaAcaoAtualizado {
  valor: number;
  /** Data da distribuição (início da conta). */
  desde: string;
  /** Até quando a conta foi (hoje, ou o último mês com índice publicado). */
  ate: string;
}

/**
 * O valor da ação atualizado pelo cálculo do TJSP, da distribuição até hoje: Tabela Prática e juros (1% a.m.
 * até 27/08/2024, taxa legal depois), como o crédito. Nulo sem valor da ação, sem distribuição ou sem índices.
 */
export function valorDaAcaoAtualizado(tabela: TabelaTjsp | null, valor: unknown, distribuicao: unknown, hoje: string, indicesAte: string | null): ValorDaAcaoAtualizado | null {
  const base = Number(valor);
  const desde = typeof distribuicao === "string" ? distribuicao.slice(0, 10) : "";
  if (!tabela || !(base > 0) || !DATA.test(desde)) return null;
  const ate = limitarAosIndices(hoje, indicesAte);
  if (ate <= desde) return null;
  try {
    return { valor: atualizarTitulo(tabela, { valor: base, vencimento: desde }, ate).total, desde, ate };
  } catch (erro) {
    if (erro instanceof IndiceAusente) return null;
    throw erro;
  }
}
