import { ProcessosError } from "./errors";
import type { AcordoNaCarteira } from "./acordos";
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
  /** Parcelas pagas dos acordos em que o cliente recebe: entram no recuperado. */
  recebidoEmAcordos: number;
  dataAjuizamento: string | null;
  dataFinal: string;
  indicesAte: string | null;
}

/* ------------------------------------------------------------ validação */

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function textoOpcional(bruto: unknown, limite: number): string | null {
  if (bruto === null || bruto === undefined) return null;
  if (typeof bruto !== "string") throw new ProcessosError("Valor de texto inválido.", 400);
  const texto = bruto.trim();
  if (texto.length > limite) throw new ProcessosError(`Texto longo demais (até ${limite} caracteres).`, 400);
  return texto || null;
}

export function textoObrigatorio(bruto: unknown, rotulo: string, limite: number): string {
  const texto = textoOpcional(bruto, limite);
  if (!texto) throw new ProcessosError(`Informe ${rotulo}.`, 400);
  return texto;
}

export function dataOpcional(bruto: unknown, rotulo: string): string | null {
  if (bruto === null || bruto === undefined || bruto === "") return null;
  if (typeof bruto !== "string" || !DATA.test(bruto) || Number.isNaN(Date.parse(`${bruto}T00:00:00Z`))) throw new ProcessosError(`Data inválida em ${rotulo}.`, 400);
  return bruto;
}

export function dataObrigatoria(bruto: unknown, rotulo: string): string {
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

export function valorPositivo(bruto: unknown, rotulo: string, obrigatorio: boolean): number | null {
  const valor = lerValor(bruto);
  if (valor === null) {
    if (obrigatorio) throw new ProcessosError(`Informe ${rotulo}.`, 400);
    return null;
  }
  if (!Number.isFinite(valor) || valor <= 0) throw new ProcessosError(`Valor inválido em ${rotulo}.`, 400);
  return Math.round(valor * 100) / 100;
}

export function umaDas<T extends string>(bruto: unknown, lista: readonly { valor: T }[], rotulo: string, padrao?: T): T {
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
  advogadoResponsavel: string | null;
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
  autos: AtualizacaoDosAutos;
  acordo: AcordoNaCarteira | null;
}

/** O que o pedido mais recente ao robô está fazendo agora, quando ainda não terminou ou falhou. */
export type RoboAgora = "na_fila" | "baixando" | "aguardando_pessoa" | "erro";

/** Quando o robô conferiu os autos e quando a IA leu, para ver na carteira quem ficou para trás. */
export interface AtualizacaoDosAutos {
  /** Última vez que o robô terminou de conferir o tribunal (com peça nova ou sem novidades). */
  roboEm: string | null;
  roboAgora: RoboAgora | null;
  roboErro: string | null;
  /** Última leitura concluída pela IA. */
  iaEm: string | null;
  iaPendentes: number;
  iaErros: number;
  iaSemTexto: number;
  documentos: number;
}

export const SEM_ATUALIZACAO: AtualizacaoDosAutos = { roboEm: null, roboAgora: null, roboErro: null, iaEm: null, iaPendentes: 0, iaErros: 0, iaSemTexto: 0, documentos: 0 };

const AGORA_DO_PEDIDO: Record<string, RoboAgora> = { pendente: "na_fila", em_andamento: "baixando", aguardando_pessoa: "aguardando_pessoa", erro: "erro" };
const maisRecente = (datas: (string | null)[]) => datas.reduce<string | null>((maior, data) => (data && (!maior || data > maior) ? data : maior), null);

export const ROTULO_ROBO_AGORA: Record<RoboAgora, string> = { na_fila: "Na fila do robô", baixando: "Baixando", aguardando_pessoa: "Esperando login", erro: "Robô falhou" };

/** Dia (AAAA-MM-DD) de um instante no horário de Brasília. */
export function diaEmBrasilia(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(typeof iso === "string" ? new Date(iso) : iso);
}

/** dd/mm/aaaa hh:mm no horário de Brasília. */
export function formatarMomento(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export type SituacaoDaAtualizacao = "hoje" | "em_andamento" | "pendente";

export const SITUACOES_DA_ATUALIZACAO: { valor: SituacaoDaAtualizacao; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Atualizados hoje" },
  { valor: "em_andamento", rotulo: "Robô ou IA trabalhando" },
  { valor: "pendente", rotulo: "Não atualizados hoje" },
];

/**
 * Hoje: o robô conferiu o tribunal hoje e a IA não tem nada por ler. Em andamento: pedido na fila, baixando ou
 * esperando login, ou documento ainda por ler. Pendente: o resto (nunca baixado, conferido antes de hoje, falhou).
 */
export function situacaoDaAtualizacao(autos: AtualizacaoDosAutos, hoje: string): SituacaoDaAtualizacao {
  if ((autos.roboAgora && autos.roboAgora !== "erro") || autos.iaPendentes) return "em_andamento";
  if (autos.roboAgora !== "erro" && autos.roboEm && diaEmBrasilia(autos.roboEm) === hoje) return "hoje";
  return "pendente";
}

export function atualizacaoDosAutos(
  pedidos: { status: string; criadoEm: string; concluidoEm: string | null; erro: string | null }[],
  documentos: { leituraStatus: string; lidoEm: string | null }[]
): AtualizacaoDosAutos {
  const ultimo = [...pedidos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
  const roboAgora = ultimo ? (AGORA_DO_PEDIDO[ultimo.status] ?? null) : null;
  const conta = (...situacoes: string[]) => documentos.filter((documento) => situacoes.includes(documento.leituraStatus)).length;
  return {
    roboEm: maisRecente(pedidos.filter((pedido) => pedido.status === "concluido").map((pedido) => pedido.concluidoEm)),
    roboAgora,
    roboErro: roboAgora === "erro" ? ultimo.erro : null,
    iaEm: maisRecente(documentos.filter((documento) => documento.leituraStatus === "lida").map((documento) => documento.lidoEm)),
    iaPendentes: conta("pendente", "lendo"),
    iaErros: conta("erro"),
    iaSemTexto: conta("sem_texto"),
    documentos: documentos.length,
  };
}

export function processoEncerrado(dados: Pick<DadosDoProcessoNaCarteira, "situacao" | "dataEncerramento">): boolean {
  if (dados.dataEncerramento) return true;
  return Boolean(dados.situacao) && !/^ativo/i.test(dados.situacao ?? "");
}

/** Uma linha da carteira: o que a equipe pediu ver de cada processo, com o cálculo do TJSP. */
export function linhaDaCarteira(
  dados: DadosDoProcessoNaCarteira,
  itens: ItensRecCredito,
  tabela: TabelaTjsp | null,
  hoje: string,
  indicesAte: string | null,
  autos: AtualizacaoDosAutos = SEM_ATUALIZACAO,
  /** O acordo em destaque e o que já foi recebido pelos acordos (parcelas pagas). */
  acordos: { destaque: AcordoNaCarteira | null; recebido: number } = { destaque: null, recebido: 0 }
): LinhaCarteira {
  const encerrado = processoEncerrado(dados);
  const dataFinal = encerrado && dados.dataEncerramento ? dados.dataEncerramento : hoje;
  const avisos: string[] = [];
  let calculo: CalculoDoCredito = { ajuizamento: null, atual: null, avisos: [] };
  if (tabela) calculo = calcularCredito(tabela, itens.titulos, dados.dataDistribuicao, dataFinal, indicesAte);
  else if (itens.titulos.length) avisos.push("Os índices do TJSP ainda não foram importados.");
  avisos.push(...calculo.avisos);

  const somaTitulos = itens.titulos.reduce((soma, titulo) => soma + titulo.valor, 0);
  const guiasPagas = itens.lancamentos.filter((item) => item.tipo === "guia_paga").reduce((soma, item) => soma + item.valor, 0);
  const valorRecuperado = itens.lancamentos.filter((item) => item.tipo === "levantamento").reduce((soma, item) => soma + item.valor, 0) + acordos.recebido;
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
    autos,
    acordo: acordos.destaque,
  };
}

export interface LinhaDaMemoria {
  tipo: "acao" | "guia" | "levantamento" | "multa" | "honorarios";
  descricao: string;
  /** Início da conta desta linha (distribuição, pagamento da guia, levantamento). */
  data: string;
  valor: number;
  fatorCorrecao: number;
  corrigido: number;
  /** Juros em % no período (zero quando a linha só tem correção). */
  jurosPercentual: number;
  juros: number;
  total: number;
  /** +1 soma ao débito; −1 abate (valor levantado). */
  sinal: 1 | -1;
  /** Multa e honorários: o percentual aplicado sobre `valor` (a base). */
  percentual?: number;
}

/** Honorários e multa do cálculo: os do cadastro ou, vazios, os padrões pela ação. */
export interface Encargos {
  honorarios: number;
  multa: number;
  /** De onde vieram: "padrão pela ação (…)" ou "informado na ficha". */
  origem: string;
}

/**
 * Padrões do CPC pela ação: cumprimento de sentença com o devedor intimado que não pagou (art. 523, §1º: multa
 * de 10% e honorários de 10%); execução de título extrajudicial (art. 827: honorários de 10%). Nas demais ações
 * (fase de conhecimento), nada até haver execução. Percentual informado na ficha vale por cima do padrão.
 */
export function encargosDoProcesso(acao: unknown, honorarios: unknown, multa: unknown): Encargos {
  const texto = typeof acao === "string" ? acao : "";
  const padrao = /cumprimento\s+de\s+senten/i.test(texto)
    ? { honorarios: 10, multa: 10, origem: "padrão do cumprimento de sentença (CPC art. 523, §1º): devedor intimado que não pagou" }
    : /execu[cç][aã]o\s+de\s+t[ií]tulo\s+extrajudicial/i.test(texto)
      ? { honorarios: 10, multa: 0, origem: "padrão da execução de título extrajudicial (CPC art. 827)" }
      : { honorarios: 0, multa: 0, origem: "sem honorários nem multa de execução para esta ação" };
  const numero = (valor: unknown) => (valor === null || valor === undefined || valor === "" || !Number.isFinite(Number(valor)) ? null : Number(valor));
  const h = numero(honorarios);
  const m = numero(multa);
  if (h === null && m === null) return padrao;
  return { honorarios: h ?? padrao.honorarios, multa: m ?? padrao.multa, origem: "informados na ficha do processo" };
}

/** Memória do cálculo do valor da ação atualizado, para a ficha e a janela de conferência. */
export interface MemoriaDoCalculo {
  /** Até quando a conta foi (hoje, ou o último dia do mês com índice publicado). */
  ate: string;
  linhas: LinhaDaMemoria[];
  /** Valor da ação − levantamentos + multa + honorários + guias, tudo atualizado até `ate` (nunca negativo). */
  total: number;
  encargos: Encargos;
  avisos: string[];
}

export const CRITERIO_DA_MEMORIA = [
  "Correção monetária pela Tabela Prática do TJSP (Lei 14.905/2024): índice do mês final ÷ índice do mês inicial.",
  "Juros de mora simples sobre o valor corrigido: 1% ao mês até 27/08/2024 e, depois, a taxa legal (Selic menos correção), pro rata pelos dias.",
  "Valor da ação: correção e juros desde a distribuição.",
  "Valores levantados: abatidos pelo mesmo critério da dívida (correção e juros desde o levantamento), o que equivale a descontá-los na data em que foram recebidos.",
  "Multa (CPC art. 523, §1º) e honorários da execução: percentual sobre a dívida atualizada, já abatidos os levantamentos; os honorários não incidem sobre a multa.",
  "Guias pagas (despesas a cobrar do devedor): correção desde o pagamento, sem juros, somadas depois dos honorários.",
];

type Lancamentos = Pick<Lancamento, "tipo" | "data" | "valor" | "descricao">[];

const percentualTexto = (valor: number) => `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/**
 * O valor da ação atualizado pelo cálculo do TJSP até hoje, somando as guias pagas e abatendo os valores
 * levantados, com a memória de cada linha. Nulo sem valor da ação, sem distribuição ou sem índices.
 */
export function memoriaDoValorDaAcao(
  tabela: TabelaTjsp | null,
  valor: unknown,
  distribuicao: unknown,
  lancamentos: Lancamentos,
  hoje: string,
  indicesAte: string | null,
  encargos: Encargos = { honorarios: 0, multa: 0, origem: "" }
): MemoriaDoCalculo | null {
  const base = Number(valor);
  const desde = typeof distribuicao === "string" ? distribuicao.slice(0, 10) : "";
  if (!tabela || !(base > 0) || !DATA.test(desde)) return null;
  const ate = limitarAosIndices(hoje, indicesAte);
  if (ate <= desde) return null;
  const avisos: string[] = [];
  const linhas: LinhaDaMemoria[] = [];
  const linha = (tipo: LinhaDaMemoria["tipo"], descricao: string, data: string, quanto: number, comJuros: boolean): LinhaDaMemoria | null => {
    try {
      const conta = atualizarTitulo(tabela, { valor: quanto, vencimento: data }, ate);
      const juros = comJuros ? conta.juros : 0;
      return {
        tipo,
        descricao,
        data,
        valor: quanto,
        fatorCorrecao: conta.fatorCorrecao,
        corrigido: conta.corrigido,
        jurosPercentual: comJuros ? conta.jurosPercentual : 0,
        juros,
        total: Math.round((conta.corrigido + juros) * 100) / 100,
        sinal: tipo === "levantamento" ? -1 : 1,
      };
    } catch (erro) {
      if (erro instanceof IndiceAusente) {
        avisos.push(`${descricao} (${formatarData(data)}) ficou fora: falta o índice do TJSP de ${erro.mes.slice(5, 7)}/${erro.mes.slice(0, 4)}.`);
        return null;
      }
      throw erro;
    }
  };
  const acao = linha("acao", "Valor da ação", desde, base, true);
  if (!acao) return null;
  linhas.push(acao);
  const validos = [...lancamentos].sort((a, b) => a.data.localeCompare(b.data)).filter((item) => DATA.test(item.data) && item.data <= ate && item.valor > 0);
  const descrever = (item: Lancamentos[number]) =>
    item.tipo === "levantamento" && /do acordo$/.test(item.descricao ?? "")
      ? `Recebido no acordo: ${item.descricao}`
      : `${item.tipo === "guia_paga" ? "Guia paga" : "Valor levantado"}${item.descricao ? `: ${item.descricao}` : ""}`;
  // Dívida: ação atualizada menos os levantamentos; sobre ela, a multa e os honorários.
  for (const item of validos.filter((lancamento) => lancamento.tipo === "levantamento")) {
    const calculada = linha("levantamento", descrever(item), item.data, item.valor, true);
    if (calculada) linhas.push(calculada);
  }
  const divida = Math.round(linhas.reduce((total, item) => total + item.sinal * item.total, 0) * 100) / 100;
  if (divida < 0) avisos.push("Os valores levantados, atualizados, superam o débito: o saldo fica em zero.");
  const baseDosEncargos = Math.max(0, divida);
  const encargo = (tipo: "multa" | "honorarios", descricao: string, percentual: number) => {
    if (!(percentual > 0) || !(baseDosEncargos > 0)) return;
    const total = Math.round(baseDosEncargos * percentual) / 100;
    linhas.push({ tipo, descricao, data: ate, valor: baseDosEncargos, fatorCorrecao: 1, corrigido: baseDosEncargos, jurosPercentual: 0, juros: 0, total, sinal: 1, percentual });
  };
  encargo("multa", `Multa de ${percentualTexto(encargos.multa)} (CPC art. 523, §1º)`, encargos.multa);
  encargo("honorarios", `Honorários da execução de ${percentualTexto(encargos.honorarios)}`, encargos.honorarios);
  for (const item of validos.filter((lancamento) => lancamento.tipo === "guia_paga")) {
    const calculada = linha("guia", descrever(item), item.data, item.valor, false);
    if (calculada) linhas.push(calculada);
  }
  const encargosSomados = linhas.filter((item) => item.tipo === "multa" || item.tipo === "honorarios" || item.tipo === "guia").reduce((total, item) => total + item.total, 0);
  return { ate, linhas, total: Math.round((baseDosEncargos + encargosSomados) * 100) / 100, avisos, encargos };
}
