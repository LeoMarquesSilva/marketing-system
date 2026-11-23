import "server-only";

import { acordoNaCarteira, recebidoEmAcordos } from "./acordos";
import { acordosPorProcesso, carregarAcordos } from "./acordos-dados";
import { ProcessosError } from "./errors";
import { carregarTabelaTjsp, situacaoDosIndices } from "./indices-server";
import { registrarNoHistorico } from "./processos-server";
import {
  SEM_ATUALIZACAO,
  TABELA_DO_ITEM,
  atualizacaoDosAutos,
  calcularCredito,
  colunasDoItem,
  descreverItem,
  linhaDaCarteira,
  processoEncerrado,
  type Citacao,
  type AtualizacaoDosAutos,
  type DadosDoProcessoNaCarteira,
  type ItensRecCredito,
  type Lancamento,
  type LinhaCarteira,
  type PedidoExecucao,
  type RecCreditoDoProcesso,
  type TipoItem,
  type Titulo,
} from "./rec-credito";
import { db, emLotes, falhou, type Ator } from "./server";

type Linha = Record<string, unknown>;

const COMUNS = "id, processo_id, origem, documento_id, pagina, criado_por_nome, created_at";
const SELECAO: Record<TipoItem, string> = {
  titulo: `${COMUNS}, tipo, numero, valor, vencimento`,
  citacao: `${COMUNS}, endereco, tentativa_em, meio, resultado, observacao`,
  pedido: `${COMUNS}, pedido_em, tipo, descricao, situacao, decidido_em, resultado, valor_obtido`,
  lancamento: `${COMUNS}, tipo, data, valor, descricao`,
};

const texto = (valor: unknown) => (typeof valor === "string" && valor ? valor : null);
const numero = (valor: unknown) => (valor === null || valor === undefined || valor === "" ? null : Number(valor));

function comuns(linha: Linha) {
  return {
    id: linha.id as string,
    origem: linha.origem as "manual" | "autos",
    documentoId: texto(linha.documento_id),
    pagina: numero(linha.pagina),
    criadoPorNome: texto(linha.criado_por_nome),
  };
}

const paraTitulo = (linha: Linha): Titulo => ({ ...comuns(linha), tipo: linha.tipo as string, numero: texto(linha.numero), valor: Number(linha.valor), vencimento: linha.vencimento as string });
const paraCitacao = (linha: Linha): Citacao => ({
  ...comuns(linha),
  endereco: texto(linha.endereco),
  tentativaEm: texto(linha.tentativa_em),
  meio: linha.meio as Citacao["meio"],
  resultado: linha.resultado as Citacao["resultado"],
  observacao: texto(linha.observacao),
});
const paraPedido = (linha: Linha): PedidoExecucao => ({
  ...comuns(linha),
  pedidoEm: texto(linha.pedido_em),
  tipo: linha.tipo as string,
  descricao: texto(linha.descricao),
  situacao: linha.situacao as PedidoExecucao["situacao"],
  decididoEm: texto(linha.decidido_em),
  resultado: texto(linha.resultado),
  valorObtido: numero(linha.valor_obtido),
});
const paraLancamento = (linha: Linha): Lancamento => ({ ...comuns(linha), tipo: linha.tipo as Lancamento["tipo"], data: linha.data as string, valor: Number(linha.valor), descricao: texto(linha.descricao) });

/** Linhas de uma tabela de itens para vários processos (ou todos, com `processos` nulo). */
async function lerTabela(tipo: TipoItem, processos: string[] | null): Promise<Linha[]> {
  const linhas: Linha[] = [];
  const lotes = processos ? emLotes(processos, 200) : [null];
  for (const lote of lotes) {
    for (let inicio = 0; ; inicio += 1000) {
      let consulta = db().from(TABELA_DO_ITEM[tipo]).select(SELECAO[tipo]).order("created_at").range(inicio, inicio + 999);
      if (lote) consulta = consulta.in("processo_id", lote);
      const { data, error } = await consulta;
      if (error) falhou("carregar o saneamento da Rec. Crédito", error);
      linhas.push(...((data ?? []) as unknown as Linha[]));
      if (!data || data.length < 1000) break;
    }
  }
  return linhas;
}

async function itensPorProcesso(processos: string[] | null): Promise<Map<string, ItensRecCredito>> {
  const [titulos, citacoes, pedidos, lancamentos] = await Promise.all([lerTabela("titulo", processos), lerTabela("citacao", processos), lerTabela("pedido", processos), lerTabela("lancamento", processos)]);
  const mapa = new Map<string, ItensRecCredito>();
  const de = (id: string) => {
    let itens = mapa.get(id);
    if (!itens) {
      itens = { titulos: [], citacoes: [], pedidos: [], lancamentos: [] };
      mapa.set(id, itens);
    }
    return itens;
  };
  for (const linha of titulos) de(linha.processo_id as string).titulos.push(paraTitulo(linha));
  for (const linha of citacoes) de(linha.processo_id as string).citacoes.push(paraCitacao(linha));
  for (const linha of pedidos) de(linha.processo_id as string).pedidos.push(paraPedido(linha));
  for (const linha of lancamentos) de(linha.processo_id as string).lancamentos.push(paraLancamento(linha));
  for (const itens of mapa.values()) {
    itens.titulos.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    itens.citacoes.sort((a, b) => (a.tentativaEm ?? "9").localeCompare(b.tentativaEm ?? "9"));
    itens.pedidos.sort((a, b) => (a.pedidoEm ?? "9").localeCompare(b.pedidoEm ?? "9"));
    itens.lancamentos.sort((a, b) => a.data.localeCompare(b.data));
  }
  return mapa;
}

/** Itens já lançados num processo (a leitura dos autos não propõe de novo o que já está na ficha). */
export async function itensDoProcesso(processoId: string): Promise<ItensRecCredito> {
  return (await itensPorProcesso([processoId])).get(processoId) ?? { titulos: [], citacoes: [], pedidos: [], lancamentos: [] };
}

function hoje(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const SELECAO_PROCESSO =
  "id, ci, cnj, grupo_cliente, cliente, acao, fase, situacao, area, data_distribuicao, data_cadastro, data_encerramento, valor_acao, credito:proc_credito(valor_original, proximos_passos), partes:proc_partes(polo, papel, devedor, pessoa:proc_pessoas(nome))";

function dadosDoProcesso(linha: Linha): DadosDoProcessoNaCarteira {
  const credito = (Array.isArray(linha.credito) ? linha.credito[0] : linha.credito) as Linha | null;
  const partes = ((linha.partes as Linha[] | null) ?? []).map((parte) => ({
    polo: parte.polo as string,
    papel: parte.papel as string,
    devedor: parte.devedor === true,
    nome: ((Array.isArray(parte.pessoa) ? parte.pessoa[0] : parte.pessoa) as Linha | null)?.nome as string | undefined,
  }));
  // Devedor: quem está marcado como tal; sem marca, as partes do polo passivo (menos "O Juízo", que o VIOS
  // põe como parte em carta precatória).
  const devedores = partes.filter((parte) => parte.devedor && parte.nome);
  const lista = devedores.length ? devedores : partes.filter((parte) => parte.papel === "parte" && parte.polo === "passivo" && parte.nome && !/^o ju[ií]zo\b/i.test(parte.nome));
  return {
    id: linha.id as string,
    ci: texto(linha.ci),
    cnj: texto(linha.cnj),
    grupoCliente: texto(linha.grupo_cliente),
    cliente: texto(linha.cliente),
    devedor: lista.map((parte) => parte.nome).join("; ") || null,
    acao: texto(linha.acao),
    fase: texto(linha.fase),
    situacao: texto(linha.situacao),
    dataDistribuicao: texto(linha.data_distribuicao),
    dataCadastro: texto(linha.data_cadastro),
    dataEncerramento: texto(linha.data_encerramento),
    valorAcao: numero(linha.valor_acao),
    valorOriginalCadastro: numero(credito?.valor_original),
    proximosPassos: texto(credito?.proximos_passos),
  };
}

async function tabelaEIndices() {
  const [tabela, situacao] = await Promise.all([carregarTabelaTjsp(), situacaoDosIndices()]);
  return { tabela: situacao.meses ? tabela : null, indicesAte: situacao.ultimoMes };
}

/** A carteira de Recuperação de Crédito: uma linha por processo do cadastro, com o cálculo do TJSP. */
export async function carregarCarteira(ids: string[] | null = null): Promise<{ linhas: LinhaCarteira[]; indicesAte: string | null }> {
  const processos: Linha[] = [];
  const lotes = ids ? emLotes(ids, 200) : [null];
  for (const lote of lotes) {
    for (let inicio = 0; ; inicio += 500) {
      let consulta = db().from("proc_processos").select(SELECAO_PROCESSO).order("ci", { ascending: false }).range(inicio, inicio + 499);
      if (lote) consulta = consulta.in("id", lote);
      const { data, error } = await consulta;
      if (error) falhou("carregar a carteira", error);
      processos.push(...((data ?? []) as unknown as Linha[]));
      if (!data || data.length < 500) break;
    }
  }
  const doCredito = processos.filter((linha) => /recupera[cç][aã]o de cr[eé]dito/i.test(String(linha.area ?? "")));
  const idsDoCredito = doCredito.map((linha) => linha.id as string);
  const [itens, { tabela, indicesAte }, autos, acordos] = await Promise.all([
    itensPorProcesso(ids ? idsDoCredito : null),
    tabelaEIndices(),
    autosPorProcesso(idsDoCredito),
    acordosPorProcesso(idsDoCredito),
  ]);
  const dia = hoje();
  const vazio: ItensRecCredito = { titulos: [], citacoes: [], pedidos: [], lancamentos: [] };
  return {
    linhas: doCredito.map((linha) => {
      const id = linha.id as string;
      const doProcesso = acordos.get(id) ?? [];
      return linhaDaCarteira(dadosDoProcesso(linha), itens.get(id) ?? vazio, tabela, dia, indicesAte, autos.get(id) ?? SEM_ATUALIZACAO, {
        destaque: acordoNaCarteira(doProcesso, dia),
        recebido: recebidoEmAcordos(doProcesso),
      });
    }),
    indicesAte,
  };
}

/** Pedidos ao robô e leituras da IA de cada processo, para a carteira mostrar quem foi atualizado e quando. */
async function autosPorProcesso(processos: string[]): Promise<Map<string, AtualizacaoDosAutos>> {
  const ler = async (tabela: string, colunas: string) => {
    const linhas: Linha[] = [];
    for (const lote of emLotes(processos, 200)) {
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await db().from(tabela).select(colunas).in("processo_id", lote).range(inicio, inicio + 999);
        if (error) falhou("carregar a atualização dos autos", error);
        linhas.push(...((data ?? []) as unknown as Linha[]));
        if (!data || data.length < 1000) break;
      }
    }
    return linhas;
  };
  const [pedidos, documentos] = await Promise.all([
    ler("proc_autos_pedidos", "processo_id, status, criado_em, concluido_em, erro"),
    ler("proc_documentos", "processo_id, leitura_status, lido_em"),
  ]);
  const agrupar = (linhas: Linha[]) => {
    const mapa = new Map<string, Linha[]>();
    for (const linha of linhas) mapa.set(linha.processo_id as string, [...(mapa.get(linha.processo_id as string) ?? []), linha]);
    return mapa;
  };
  const pedidosDe = agrupar(pedidos);
  const documentosDe = agrupar(documentos);
  const resultado = new Map<string, AtualizacaoDosAutos>();
  for (const id of new Set([...pedidosDe.keys(), ...documentosDe.keys()])) {
    resultado.set(
      id,
      atualizacaoDosAutos(
        (pedidosDe.get(id) ?? []).map((linha) => ({ status: linha.status as string, criadoEm: linha.criado_em as string, concluidoEm: texto(linha.concluido_em), erro: texto(linha.erro) })),
        (documentosDe.get(id) ?? []).map((linha) => ({ leituraStatus: linha.leitura_status as string, lidoEm: texto(linha.lido_em) }))
      )
    );
  }
  return resultado;
}

/** Saneamento da Rec. Crédito de um processo, com o cálculo no ajuizamento e na data final. */
export async function carregarRecCredito(processoId: string): Promise<RecCreditoDoProcesso> {
  const { data, error } = await db().from("proc_processos").select(SELECAO_PROCESSO).eq("id", processoId).maybeSingle();
  if (error) falhou("carregar o processo", error);
  if (!data) throw new ProcessosError("Processo não encontrado.", 404);
  const dados = dadosDoProcesso(data as unknown as Linha);
  const [itens, { tabela, indicesAte }, acordos] = await Promise.all([itensPorProcesso([processoId]), tabelaEIndices(), carregarAcordos(processoId)]);
  const doProcesso = itens.get(processoId) ?? { titulos: [], citacoes: [], pedidos: [], lancamentos: [] };
  const dataFinal = processoEncerrado(dados) && dados.dataEncerramento ? dados.dataEncerramento : hoje();
  const calculo = tabela
    ? calcularCredito(tabela, doProcesso.titulos, dados.dataDistribuicao, dataFinal, indicesAte)
    : { ajuizamento: null, atual: null, avisos: doProcesso.titulos.length ? ["Os índices do TJSP ainda não foram importados."] : [] };
  return { ...doProcesso, calculo, recebidoEmAcordos: recebidoEmAcordos(acordos), dataAjuizamento: dados.dataDistribuicao, dataFinal, indicesAte };
}

const ROTULO_HISTORICO = "Rec. Crédito";

/**
 * Inclui um título, citação, pedido ou lançamento: lançado à mão na ficha ou vindo de uma sugestão da leitura
 * dos autos aprovada (`dosAutos`, com o documento e a página de onde saiu).
 */
export async function incluirItem(
  processoId: string,
  tipo: TipoItem,
  dados: Record<string, unknown>,
  ator: Ator,
  dosAutos?: { documentoId: string | null; pagina: number | null }
): Promise<RecCreditoDoProcesso> {
  const colunas = colunasDoItem(tipo, dados);
  if (tipo === "titulo") await conferirTipoDeTitulo(colunas.tipo as string);
  const { data: processo, error: erroProcesso } = await db().from("proc_processos").select("id").eq("id", processoId).maybeSingle();
  if (erroProcesso) falhou("carregar o processo", erroProcesso);
  if (!processo) throw new ProcessosError("Processo não encontrado.", 404);
  const { error } = await db()
    .from(TABELA_DO_ITEM[tipo])
    .insert({
      processo_id: processoId,
      ...colunas,
      origem: dosAutos ? "autos" : "manual",
      documento_id: dosAutos?.documentoId ?? null,
      pagina: dosAutos?.pagina ?? null,
      criado_por: ator.authUserId,
      criado_por_nome: ator.nome,
    });
  if (error) falhou("incluir o item", error);
  await registrarNoHistorico(processoId, ROTULO_HISTORICO, null, `Incluído: ${descreverItem(tipo, colunas)}`, ator, dosAutos ? "ia" : "manual");
  return carregarRecCredito(processoId);
}

async function itemExistente(tipo: TipoItem, itemId: string): Promise<Linha> {
  const { data, error } = await db().from(TABELA_DO_ITEM[tipo]).select(SELECAO[tipo]).eq("id", itemId).maybeSingle();
  if (error) falhou("carregar o item", error);
  if (!data) throw new ProcessosError("Item não encontrado.", 404);
  return data as unknown as Linha;
}

export async function alterarItem(tipo: TipoItem, itemId: string, dados: Record<string, unknown>, ator: Ator): Promise<RecCreditoDoProcesso> {
  const atual = await itemExistente(tipo, itemId);
  const colunas = colunasDoItem(tipo, dados);
  if (tipo === "titulo" && colunas.tipo !== atual.tipo) await conferirTipoDeTitulo(colunas.tipo as string);
  const { error } = await db().from(TABELA_DO_ITEM[tipo]).update(colunas).eq("id", itemId);
  if (error) falhou("salvar o item", error);
  await registrarNoHistorico(atual.processo_id as string, ROTULO_HISTORICO, descreverItem(tipo, atual), `Alterado: ${descreverItem(tipo, colunas)}`, ator);
  return carregarRecCredito(atual.processo_id as string);
}

export async function excluirItem(tipo: TipoItem, itemId: string, ator: Ator): Promise<RecCreditoDoProcesso> {
  const atual = await itemExistente(tipo, itemId);
  const { error } = await db().from(TABELA_DO_ITEM[tipo]).delete().eq("id", itemId);
  if (error) falhou("excluir o item", error);
  await registrarNoHistorico(atual.processo_id as string, ROTULO_HISTORICO, descreverItem(tipo, atual), "Excluído", ator);
  return carregarRecCredito(atual.processo_id as string);
}

/** O tipo do título vem da lista "Tipo de título" de Cadastros (só opção ativa). */
async function conferirTipoDeTitulo(tipo: string): Promise<void> {
  const { data, error } = await db().from("proc_opcoes").select("valor").eq("lista", "tipo_titulo").eq("ativo", true);
  if (error) falhou("carregar os tipos de título", error);
  if (!(data ?? []).some((opcao) => opcao.valor === tipo)) throw new ProcessosError(`"${tipo}" não está na lista de tipos de título (Cadastros).`, 400);
}

/** Opções ativas da lista "Tipo de título", para o formulário. */
export async function tiposDeTitulo(): Promise<string[]> {
  const { data, error } = await db().from("proc_opcoes").select("valor, ordem").eq("lista", "tipo_titulo").eq("ativo", true).order("ordem").order("valor");
  if (error) falhou("carregar os tipos de título", error);
  return (data ?? []).map((opcao) => opcao.valor as string);
}
