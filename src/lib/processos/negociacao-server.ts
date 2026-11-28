import "server-only";

import type { CellObject, CellStyle, WorkSheet } from "xlsx-js-style";
import * as XLSX from "xlsx-js-style";
import { enviarEmailMicrosoft, microsoftMailConfigurado, MicrosoftMailError } from "@/lib/microsoft-mail";
import { ProcessosError } from "./errors";
import { cabecalho, dado, estiloLegenda, estiloTitulo } from "./export-excel";
import {
  conferirDestinatarios,
  digitosDoCnj,
  ehStatusNegociacao,
  juntarAdvogados,
  lerPlanilhaDeValores,
  negociacaoNova,
  rotuloDoStatus,
  statusAposEnvio,
  textoParaHtml,
  type EventoNegociacao,
  type LinhaNegociacao,
  type Negociacao,
  type StatusNegociacao,
  type SugestaoDeAdvogado,
} from "./negociacao";
import { carregarParaPlanilha, registrarNoHistorico } from "./processos-server";
import { lerValor, textoOpcional } from "./rec-credito";
import { db, emLotes, falhou, type Ator } from "./server";
import { advogadosDoReclamante, ehTrabalhista, emailsDaParte, formatarReais, poloDoReclamante } from "./trabalhista";

type Linha = Record<string, unknown>;

const COLUNAS_NEGOCIACAO =
  "id, processo_id, status, enviado_em, respondido_em, proposta_valor, proposta_condicoes, contraproposta_valor, contraproposta_condicoes, acordo_valor, acordo_condicoes, valor_maximo_cliente, valor_maximo_em, observacoes, atualizado_por_nome, updated_at";

const texto = (valor: unknown) => (typeof valor === "string" && valor ? valor : null);
const numero = (valor: unknown) => (valor === null || valor === undefined || valor === "" ? null : Number(valor));

function paraNegociacao(linha: Linha): Negociacao {
  return {
    id: linha.id as string,
    status: linha.status as StatusNegociacao,
    enviadoEm: texto(linha.enviado_em),
    respondidoEm: texto(linha.respondido_em),
    propostaValor: numero(linha.proposta_valor),
    propostaCondicoes: texto(linha.proposta_condicoes),
    contrapropostaValor: numero(linha.contraproposta_valor),
    contrapropostaCondicoes: texto(linha.contraproposta_condicoes),
    acordoValor: numero(linha.acordo_valor),
    acordoCondicoes: texto(linha.acordo_condicoes),
    valorMaximoCliente: numero(linha.valor_maximo_cliente),
    valorMaximoEm: texto(linha.valor_maximo_em),
    observacoes: texto(linha.observacoes),
    atualizadoPorNome: texto(linha.atualizado_por_nome),
    atualizadoEm: texto(linha.updated_at),
  };
}

/** Ids dos processos da área Trabalhista (o filtro do banco é largo; ehTrabalhista confere). */
export async function idsTrabalhistas(): Promise<string[]> {
  const ids: string[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await db().from("proc_processos").select("id, area").ilike("area", "%trabalhist%").range(inicio, inicio + 999);
    if (error) falhou("carregar os processos trabalhistas", error);
    for (const linha of data ?? []) if (ehTrabalhista(linha.area)) ids.push(linha.id as string);
    if (!data || data.length < 1000) break;
  }
  return ids;
}

export async function negociacoesPorProcesso(ids: string[]): Promise<Map<string, Negociacao>> {
  const mapa = new Map<string, Negociacao>();
  for (const lote of emLotes(ids, 200)) {
    const { data, error } = await db().from("proc_negociacoes").select(COLUNAS_NEGOCIACAO).in("processo_id", lote);
    if (error) falhou("carregar as negociações", error);
    for (const linha of (data ?? []) as Linha[]) mapa.set(linha.processo_id as string, paraNegociacao(linha));
  }
  return mapa;
}

/**
 * Advogados que a leitura dos autos achou e ainda esperam aprovação (sugestão "parte nova" de papel advogado). Entram
 * no painel marcados como sugeridos, para o e-mail não esperar a revisão das sugestões.
 */
async function advogadosSugeridos(ids: string[]): Promise<Map<string, SugestaoDeAdvogado[]>> {
  const mapa = new Map<string, SugestaoDeAdvogado[]>();
  for (const lote of emLotes(ids, 200)) {
    const { data, error } = await db().from("proc_sugestoes").select("id, processo_id, valor").eq("tipo", "parte_nova").eq("situacao", "pendente").in("processo_id", lote);
    if (error) falhou("carregar os advogados sugeridos pela leitura", error);
    for (const linha of (data ?? []) as Linha[]) {
      const valor = (linha.valor ?? {}) as Record<string, unknown>;
      const nome = texto(valor.nome)?.trim();
      if (valor.papel !== "advogado" || !nome) continue;
      const contatos = Array.isArray(valor.contatos) ? (valor.contatos as Record<string, unknown>[]) : [];
      const emails = [...new Set(contatos.filter((item) => item.tipo === "email" && typeof item.valor === "string").map((item) => (item.valor as string).trim().toLowerCase()).filter(Boolean))];
      const polo = valor.polo === "ativo" || valor.polo === "passivo" ? valor.polo : null;
      const lista = mapa.get(linha.processo_id as string) ?? [];
      lista.push({ sugestaoId: linha.id as string, polo, advogado: { nome, oab: texto(valor.oab), emails, sugestaoIds: [linha.id as string] } });
      mapa.set(linha.processo_id as string, lista);
    }
  }
  return mapa;
}

async function linhasDoPainel(ids: string[]): Promise<LinhaNegociacao[]> {
  if (!ids.length) return [];
  const [processos, negociacoes, sugeridos] = await Promise.all([carregarParaPlanilha(ids), negociacoesPorProcesso(ids), advogadosSugeridos(ids)]);
  return processos.map(({ id, valores, partes }) => {
    const polo = poloDoReclamante(valores.polo_cliente);
    const reclamante = partes.filter((parte) => parte.papel === "parte" && parte.polo === polo).map((parte) => parte.nome).join("; ") || null;
    const doCadastro = advogadosDoReclamante(partes, valores.polo_cliente).map((parte) => ({ nome: parte.nome, oab: parte.oab, emails: emailsDaParte(parte) }));
    return {
      processoId: id,
      ci: texto(valores.ci),
      cnj: texto(valores.cnj),
      cliente: texto(valores.cliente),
      grupoCliente: texto(valores.grupo_cliente),
      reclamante,
      advogadoResponsavel: texto(valores.advogado_responsavel),
      fase: texto(valores.fase),
      advogados: juntarAdvogados(doCadastro, sugeridos.get(id) ?? [], polo),
      riscoValor: numero(valores.risco_valor),
      riscoReflexos: numero(valores.risco_reflexos),
      riscoTotal: numero(valores.risco_total),
      negociacao: negociacoes.get(id) ?? negociacaoNova(),
    };
  });
}

/* ------------------------------------------------------------ configuração do envio */

const CHAVE_CONFIGURACAO = "acordos_trabalhistas";

export interface ConfiguracaoDosAcordos {
  /** Caixa do Microsoft 365 de onde saem os e-mails de acordo; vazia: a de quem está logado. */
  remetente: string | null;
  /** Em cópia em todo e-mail de acordo (ex.: a caixa da equipe trabalhista). */
  cc: string[];
  /** Assinatura no fim do e-mail (texto). O Graph não traz a assinatura do Outlook, então ela é cadastrada aqui. */
  assinatura: string | null;
  /** A tabela de configurações existe (sem a migration, a tela avisa e usa o padrão). */
  disponivel: boolean;
  atualizadoPorNome: string | null;
  atualizadoEm: string | null;
}

/** Erro do PostgREST de tabela ou coluna que ainda não existe (migration não aplicada). */
export function faltaMigration(erro: { code?: string; message?: string } | null): boolean {
  if (!erro) return false;
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(erro.code ?? "") || /does not exist|could not find/i.test(erro.message ?? "");
}

export async function configuracaoDosAcordos(): Promise<ConfiguracaoDosAcordos> {
  const { data, error } = await db().from("proc_configuracoes").select("valor, atualizado_por_nome, updated_at").eq("chave", CHAVE_CONFIGURACAO).maybeSingle();
  if (error) {
    if (faltaMigration(error)) return { remetente: null, cc: [], assinatura: null, disponivel: false, atualizadoPorNome: null, atualizadoEm: null };
    falhou("carregar a configuração do envio", error);
  }
  const valor = ((data?.valor ?? {}) as Record<string, unknown>) ?? {};
  return {
    remetente: texto(valor.remetente)?.trim().toLowerCase() ?? null,
    cc: Array.isArray(valor.cc) ? (valor.cc as unknown[]).filter((item): item is string => typeof item === "string") : [],
    assinatura: texto(valor.assinatura)?.trim() || null,
    disponivel: true,
    atualizadoPorNome: texto(data?.atualizado_por_nome),
    atualizadoEm: texto(data?.updated_at),
  };
}

/** Tamanho máximo da assinatura (texto). */
const ASSINATURA_MAXIMA = 1500;

/** PUT { remetente?, cc?, assinatura? } — a caixa que envia (vazia: quem está logado), a cópia padrão e a assinatura. */
export async function salvarConfiguracaoDosAcordos(entrada: Record<string, unknown>, ator: Ator): Promise<ConfiguracaoDosAcordos> {
  const remetente = conferirDestinatarios(entrada.remetente ?? "", { opcional: true, rotulo: "Caixa que envia" });
  if (remetente.length > 1) throw new ProcessosError("Informe uma caixa só para enviar.", 400);
  const cc = conferirDestinatarios(entrada.cc ?? [], { opcional: true, rotulo: "Cópia" });
  const assinatura = typeof entrada.assinatura === "string" ? entrada.assinatura.replace(/\r\n/g, "\n").trim() : "";
  if (assinatura.length > ASSINATURA_MAXIMA) throw new ProcessosError(`A assinatura passa de ${ASSINATURA_MAXIMA} caracteres.`, 400);
  const { error } = await db()
    .from("proc_configuracoes")
    .upsert({ chave: CHAVE_CONFIGURACAO, valor: { remetente: remetente[0] ?? null, cc, assinatura: assinatura || null }, atualizado_por_nome: ator.nome, updated_at: new Date().toISOString() }, { onConflict: "chave" });
  if (error) {
    if (faltaMigration(error)) throw new ProcessosError("Falta aplicar a migration das conversas dos acordos (20261127210000) para guardar a configuração.", 409);
    falhou("salvar a configuração do envio", error);
  }
  return configuracaoDosAcordos();
}

/** A caixa que envia: a configurada ou, sem ela, a de quem está logado. */
export function caixaQueEnvia(configuracao: ConfiguracaoDosAcordos, ator: Ator): string | null {
  return configuracao.remetente ?? ator.email?.trim().toLowerCase() ?? null;
}

export interface PainelDeNegociacao {
  linhas: LinhaNegociacao[];
  /** O envio pelo Outlook está ligado (credenciais do Graph) e há uma caixa para enviar. */
  envioPeloOutlook: boolean;
  /** A caixa de onde os e-mails saem (a configurada ou a de quem está logado). */
  remetente: string | null;
  configuracao: ConfiguracaoDosAcordos;
  /** Nome de quem está logado, para a assinatura do e-mail. */
  remetenteNome: string | null;
}

/** Todos os processos trabalhistas com a negociação de cada um. */
export async function carregarPainelDeNegociacao(ator: Ator): Promise<PainelDeNegociacao> {
  const [linhas, configuracao] = await Promise.all([idsTrabalhistas().then(linhasDoPainel), configuracaoDosAcordos()]);
  const remetente = caixaQueEnvia(configuracao, ator);
  return { linhas, envioPeloOutlook: microsoftMailConfigurado() && Boolean(remetente), remetente, configuracao, remetenteNome: ator.nome };
}

const COLUNAS_EVENTO = "id, tipo, descricao, valor, para, remetente, assunto, corpo, autor_nome, criado_em";
const COLUNAS_EVENTO_CONVERSA = `${COLUNAS_EVENTO}, cc, caixa, mensagem_id, mensagem_em`;

function paraEvento(linha: Linha): EventoNegociacao {
  return {
    id: linha.id as string,
    tipo: linha.tipo as string,
    descricao: linha.descricao as string,
    valor: numero(linha.valor),
    para: (linha.para as string[] | null) ?? [],
    cc: (linha.cc as string[] | null) ?? [],
    remetente: texto(linha.remetente),
    assunto: texto(linha.assunto),
    corpo: texto(linha.corpo),
    autor: texto(linha.autor_nome),
    quando: linha.criado_em as string,
    caixa: texto(linha.caixa),
    mensagemId: texto(linha.mensagem_id),
    mensagemEm: texto(linha.mensagem_em),
  };
}

export async function eventosDaNegociacao(processoId: string): Promise<EventoNegociacao[]> {
  if (!/^[0-9a-f-]{36}$/i.test(processoId)) throw new ProcessosError("Processo não encontrado.", 404);
  const consulta = (colunas: string) => db().from("proc_negociacao_eventos").select(colunas).eq("processo_id", processoId).order("criado_em", { ascending: false }).limit(300);
  let { data, error } = await consulta(COLUNAS_EVENTO_CONVERSA);
  // Sem a migration das conversas: o histórico de antes, sem cópia nem mensagens.
  if (error && faltaMigration(error)) ({ data, error } = await consulta(COLUNAS_EVENTO));
  if (error) falhou("carregar o histórico da negociação", error);
  return ((data ?? []) as unknown as Linha[]).map(paraEvento);
}

export async function exigirTrabalhistas(processoIds: string[]): Promise<Map<string, { cnj: string | null; cliente: string | null }>> {
  const ids = [...new Set(processoIds)].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!ids.length || ids.length !== new Set(processoIds).size) throw new ProcessosError("Processo não encontrado.", 404);
  const { data, error } = await db().from("proc_processos").select("id, area, cnj, cliente").in("id", ids);
  if (error) falhou("carregar os processos", error);
  if ((data ?? []).length !== ids.length) throw new ProcessosError("Processo não encontrado.", 404);
  const naoTrabalhista = (data ?? []).filter((linha) => !ehTrabalhista(linha.area));
  if (naoTrabalhista.length) throw new ProcessosError("O controle de acordos é dos processos da área Trabalhista.", 400);
  return new Map((data ?? []).map((linha) => [linha.id as string, { cnj: texto(linha.cnj), cliente: texto(linha.cliente) }]));
}

export async function negociacaoDoProcesso(processoId: string): Promise<Negociacao> {
  const { data, error } = await db().from("proc_negociacoes").select(COLUNAS_NEGOCIACAO).eq("processo_id", processoId).maybeSingle();
  if (error) falhou("carregar a negociação", error);
  return data ? paraNegociacao(data as Linha) : negociacaoNova();
}

export async function gravarNegociacao(processoId: string, patch: Record<string, unknown>, ator: Ator): Promise<string> {
  const { data, error } = await db()
    .from("proc_negociacoes")
    .upsert({ processo_id: processoId, ...patch, atualizado_por_nome: ator.nome }, { onConflict: "processo_id" })
    .select("id")
    .single();
  if (error) falhou("salvar a negociação", error);
  return data.id as string;
}

/** Colunas que só existem depois da migration das conversas (20261127210000). */
const COLUNAS_DA_CONVERSA = ["cc", "envio_id", "caixa", "conversa_id", "mensagem_id", "mensagem_em"];

export async function registrarEventos(eventos: Record<string, unknown>[], ator: Ator | null): Promise<void> {
  if (!eventos.length) return;
  const linhas = eventos.map((evento) => ({ ...evento, autor_id: ator?.authUserId ?? null, autor_nome: ator?.nome ?? null }));
  let { error } = await db().from("proc_negociacao_eventos").insert(linhas);
  // Sem a migration: grava o que a tabela antiga tem (o e-mail sai igual; só não dá para acompanhar a conversa).
  if (error && faltaMigration(error)) {
    ({ error } = await db()
      .from("proc_negociacao_eventos")
      .insert(linhas.map((linha) => Object.fromEntries(Object.entries(linha).filter(([chave]) => !COLUNAS_DA_CONVERSA.includes(chave))))));
  }
  if (error) falhou("registrar o histórico da negociação", error);
}

function valorOpcional(bruto: unknown, rotulo: string, positivo = true): number | null {
  const valor = lerValor(bruto);
  if (valor === null) return null;
  if (!Number.isFinite(valor) || valor < 0 || (positivo && valor === 0)) throw new ProcessosError(`Valor inválido em ${rotulo}.`, 400);
  return Math.round(valor * 100) / 100;
}

const CAMPOS_DE_VALOR: Record<string, { coluna: keyof Negociacao; rotulo: string; evento: string; positivo: boolean }> = {
  proposta_valor: { coluna: "propostaValor", rotulo: "a proposta recebida", evento: "proposta", positivo: true },
  contraproposta_valor: { coluna: "contrapropostaValor", rotulo: "a contraproposta", evento: "contraproposta", positivo: true },
  acordo_valor: { coluna: "acordoValor", rotulo: "o valor do acordo", evento: "acordo", positivo: true },
  valor_maximo_cliente: { coluna: "valorMaximoCliente", rotulo: "o valor máximo do cliente", evento: "valor_maximo", positivo: false },
};

const CAMPOS_DE_TEXTO: Record<string, keyof Negociacao> = {
  proposta_condicoes: "propostaCondicoes",
  contraproposta_condicoes: "contrapropostaCondicoes",
  acordo_condicoes: "acordoCondicoes",
  observacoes: "observacoes",
};

const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const diaEmBrasilia = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/**
 * Salva o que a pessoa mudou na negociação de um processo (status, propostas, valor máximo, observações). Cada
 * mudança relevante vira um evento no histórico da negociação; a mudança de status também vai para o histórico
 * do processo.
 */
export async function salvarNegociacao(processoId: string, entrada: Record<string, unknown>, ator: Ator): Promise<Negociacao> {
  await exigirTrabalhistas([processoId]);
  const atual = await negociacaoDoProcesso(processoId);
  const patch: Record<string, unknown> = {};
  const eventos: { tipo: string; descricao: string; valor?: number | null }[] = [];

  if (entrada.status !== undefined) {
    if (!ehStatusNegociacao(entrada.status)) throw new ProcessosError("Status inválido.", 400);
    if (entrada.status !== atual.status) {
      patch.status = entrada.status;
      eventos.push({ tipo: "status", descricao: `${rotuloDoStatus(atual.status)} → ${rotuloDoStatus(entrada.status)}` });
      // A data de cada passo, quando a pessoa não informou.
      if (entrada.status === "enviado" && !atual.enviadoEm && entrada.enviado_em === undefined) patch.enviado_em = new Date().toISOString();
      if (["respondido", "proposta_recebida", "sem_interesse"].includes(entrada.status) && !atual.respondidoEm && entrada.respondido_em === undefined) patch.respondido_em = new Date().toISOString();
    }
  }
  for (const [chave, rotulo] of [
    ["enviado_em", "a data do envio"],
    ["respondido_em", "a data da resposta"],
  ] as const) {
    if (entrada[chave] === undefined) continue;
    const bruto = entrada[chave];
    const atualEm = chave === "enviado_em" ? atual.enviadoEm : atual.respondidoEm;
    if (bruto === null || bruto === "") {
      if (atualEm) patch[chave] = null;
    } else if (typeof bruto === "string" && !Number.isNaN(Date.parse(bruto))) {
      // A tela manda só o dia: o mesmo dia de antes não muda a hora gravada (a do envio pelo Outlook, por exemplo).
      if (bruto.length === 10 && atualEm && diaEmBrasilia(atualEm) === bruto) continue;
      patch[chave] = new Date(bruto.length === 10 ? `${bruto}T12:00:00-03:00` : bruto).toISOString();
    } else throw new ProcessosError(`Data inválida em ${rotulo}.`, 400);
  }
  for (const [chave, campo] of Object.entries(CAMPOS_DE_VALOR)) {
    if (entrada[chave] === undefined) continue;
    const valor = valorOpcional(entrada[chave], campo.rotulo, campo.positivo);
    if (valor === atual[campo.coluna]) continue;
    patch[chave] = valor;
    if (chave === "valor_maximo_cliente") patch.valor_maximo_em = valor === null ? null : hoje();
    const descricao = {
      proposta: "Proposta recebida",
      contraproposta: "Contraproposta",
      acordo: "Acordo fechado",
      valor_maximo: "Valor máximo do cliente",
    }[campo.evento];
    eventos.push({ tipo: campo.evento, descricao: `${descricao}: ${valor === null ? "apagado" : formatarReais(valor)}`, valor });
  }
  for (const [chave, coluna] of Object.entries(CAMPOS_DE_TEXTO)) {
    if (entrada[chave] === undefined) continue;
    const valor = textoOpcional(entrada[chave], 4000);
    if (valor === atual[coluna]) continue;
    patch[chave] = valor;
    if (chave === "observacoes" && valor) eventos.push({ tipo: "observacao", descricao: `Observações: ${valor.slice(0, 300)}` });
  }
  if (!Object.keys(patch).length) return atual;

  const negociacaoId = await gravarNegociacao(processoId, patch, ator);
  await registrarEventos(
    eventos.map((evento) => ({ negociacao_id: negociacaoId, processo_id: processoId, tipo: evento.tipo, descricao: evento.descricao, valor: evento.valor ?? null })),
    ator
  );
  const status = eventos.find((evento) => evento.tipo === "status");
  if (status) await registrarNoHistorico(processoId, "negociacao", null, `Negociação de acordo: ${status.descricao}`, ator);
  return negociacaoDoProcesso(processoId);
}

export interface EnvioDeEmail {
  processoIds: string[];
  para: string[];
  cc: string[];
  assunto: string;
  texto: string;
}

function lerEnvio(entrada: Record<string, unknown>): EnvioDeEmail {
  const processoIds = Array.isArray(entrada.processoIds) ? entrada.processoIds.filter((id): id is string => typeof id === "string") : [];
  if (!processoIds.length || processoIds.length > 50) throw new ProcessosError("Escolha de 1 a 50 processos para o e-mail.", 400);
  const assunto = textoOpcional(entrada.assunto, 300);
  const corpo = textoOpcional(entrada.texto, 20000);
  if (!assunto) throw new ProcessosError("Informe o assunto do e-mail.", 400);
  if (!corpo) throw new ProcessosError("Informe o texto do e-mail.", 400);
  const para = conferirDestinatarios(entrada.para, { rotulo: "Para" });
  const cc = conferirDestinatarios(entrada.cc ?? [], { opcional: true, rotulo: "Cc" }).filter((item) => !para.includes(item));
  return { processoIds, para, cc, assunto, texto: corpo };
}

/** Depois do envio (ou do rascunho marcado como enviado): status, data e o e-mail no histórico de cada processo. */
async function registrarEnvio(envio: EnvioDeEmail, ator: Ator, comoFoi: "outlook" | "rascunho", remetente: string | null): Promise<void> {
  const agora = new Date().toISOString();
  // Um id por e-mail: as linhas dos vários processos dele acham juntas a conversa no Outlook.
  const envioId = crypto.randomUUID();
  for (const processoId of envio.processoIds) {
    const atual = await negociacaoDoProcesso(processoId);
    const negociacaoId = await gravarNegociacao(processoId, { status: statusAposEnvio(atual.status), enviado_em: agora }, ator);
    await registrarEventos(
      [
        {
          negociacao_id: negociacaoId,
          processo_id: processoId,
          tipo: comoFoi === "outlook" ? "email_enviado" : "email_rascunho",
          descricao: comoFoi === "outlook" ? `E-mail enviado pelo Outlook de ${remetente} para ${envio.para.join(", ")}` : `Rascunho (.eml) marcado como enviado, para ${envio.para.join(", ")}`,
          para: envio.para,
          cc: envio.cc,
          remetente,
          assunto: envio.assunto,
          corpo: envio.texto,
          envio_id: envioId,
          caixa: comoFoi === "outlook" ? remetente : null,
          mensagem_em: agora,
        },
      ],
      ator
    );
    await registrarNoHistorico(processoId, "negociacao", null, `E-mail de pretensão para acordo ${comoFoi === "outlook" ? "enviado" : "marcado como enviado"} (${envio.para.join(", ")})`, ator);
  }
}

/**
 * Envia o e-mail de pretensão para acordo pela caixa configurada (ou, sem ela, a de quem está logado), com cópia nos
 * Itens Enviados dela. Só é chamado pelo botão de confirmação da tela, que mostra remetente, destinatários, cópia,
 * assunto e texto.
 */
export async function enviarEmailDeAcordo(entrada: Record<string, unknown>, ator: Ator): Promise<{ enviados: number; remetente: string }> {
  if (entrada.confirmado !== true) throw new ProcessosError("Confirme o envio na tela antes de enviar.", 400);
  const envio = lerEnvio(entrada);
  await exigirTrabalhistas(envio.processoIds);
  if (!microsoftMailConfigurado()) throw new ProcessosError("O envio pelo Outlook não está configurado. Baixe o rascunho (.eml) e marque como enviado.", 503);
  const remetente = caixaQueEnvia(await configuracaoDosAcordos(), ator);
  if (!remetente) throw new ProcessosError("Sem caixa para enviar: configure a caixa que envia ou baixe o rascunho (.eml).", 400);
  try {
    await enviarEmailMicrosoft({ para: envio.para, cc: envio.cc, assunto: envio.assunto, html: textoParaHtml(envio.texto), remetente, salvarEmEnviados: true });
  } catch (erro) {
    if (erro instanceof MicrosoftMailError) {
      console.error("[processos] envio do e-mail de acordo:", erro.message);
      const motivo = erro.status === 403 || erro.code === "ErrorAccessDenied" ? `o ORQESTRAI não tem permissão de enviar pela caixa ${remetente}` : erro.status === 404 ? `a caixa ${remetente} não foi encontrada no Microsoft 365` : "o Microsoft 365 recusou o envio";
      throw new ProcessosError(`Não foi possível enviar: ${motivo}. Baixe o rascunho (.eml) e envie pelo seu Outlook.`, 502);
    }
    throw erro;
  }
  await registrarEnvio(envio, ator, "outlook", remetente);
  return { enviados: envio.processoIds.length, remetente };
}

/** O rascunho (.eml) foi baixado e enviado pela pessoa: registra como enviado, com o texto que saiu. */
export async function marcarRascunhoEnviado(entrada: Record<string, unknown>, ator: Ator): Promise<{ marcados: number }> {
  const envio = lerEnvio(entrada);
  await exigirTrabalhistas(envio.processoIds);
  await registrarEnvio(envio, ator, "rascunho", ator.email ?? null);
  return { marcados: envio.processoIds.length };
}

/* ------------------------------------------------------------ planilha */

type Valor = string | number | null;
interface Coluna {
  rotulo: string;
  largura: number;
  real?: boolean;
  valor: (linha: LinhaNegociacao) => Valor;
}

const COLUNAS: Coluna[] = [
  { rotulo: "Processo", largura: 27, valor: (linha) => linha.cnj },
  { rotulo: "CI", largura: 9, valor: (linha) => linha.ci },
  { rotulo: "Cliente", largura: 30, valor: (linha) => linha.cliente },
  { rotulo: "Reclamante", largura: 30, valor: (linha) => linha.reclamante },
  { rotulo: "Advogado(s) do reclamante", largura: 34, valor: (linha) => linha.advogados.map((item) => `${item.nome}${item.oab ? ` (OAB ${item.oab})` : ""}`).join("\n") },
  { rotulo: "E-mail(s)", largura: 32, valor: (linha) => [...new Set(linha.advogados.flatMap((item) => item.emails))].join("\n") },
  { rotulo: "Status", largura: 16, valor: (linha) => rotuloDoStatus(linha.negociacao.status) },
  { rotulo: "Risco: valor", largura: 15, real: true, valor: (linha) => linha.riscoValor },
  { rotulo: "Risco: reflexos", largura: 15, real: true, valor: (linha) => linha.riscoReflexos },
  { rotulo: "Risco: total", largura: 15, real: true, valor: (linha) => linha.riscoTotal },
  { rotulo: "Proposta recebida", largura: 15, real: true, valor: (linha) => linha.negociacao.propostaValor },
  { rotulo: "Condições da proposta", largura: 30, valor: (linha) => linha.negociacao.propostaCondicoes },
  { rotulo: "Valor máximo para acordo", largura: 17, real: true, valor: (linha) => linha.negociacao.valorMaximoCliente },
  { rotulo: "Observações", largura: 40, valor: (linha) => linha.negociacao.observacoes },
];

/** Planilha do painel: o cliente preenche a coluna "Valor máximo para acordo" e devolve. */
export function montarPlanilhaDeNegociacao(linhas: LinhaNegociacao[], agora: Date = new Date()): Buffer {
  const ws: WorkSheet = {};
  const ultima = COLUNAS.length - 1;
  const geradaEm = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(agora);
  const por = (r: number, c: number, item: CellObject) => {
    ws[XLSX.utils.encode_cell({ r, c })] = item;
  };
  por(0, 0, { t: "s", v: "Acordos trabalhistas — Bismarchi | Pires", s: estiloTitulo });
  por(1, 0, {
    t: "s",
    v: `Gerada em ${geradaEm} · ${linhas.length} processo${linhas.length === 1 ? "" : "s"} · Preencha "Valor máximo para acordo" (e, se quiser, "Observações") e devolva: a planilha volta ao sistema pelo número do processo.`,
    s: estiloLegenda,
  });
  for (let c = 1; c <= ultima; c += 1) {
    por(0, c, { t: "s", v: "", s: estiloTitulo });
    por(1, c, { t: "s", v: "", s: estiloLegenda });
  }
  COLUNAS.forEach((coluna, c) => por(2, c, { t: "s", v: coluna.rotulo, s: cabecalho(false) }));
  linhas.forEach((linha, i) => {
    const estilo = dado(i % 2 === 1);
    COLUNAS.forEach((coluna, c) => {
      const valor = coluna.valor(linha);
      if (typeof valor === "number") {
        const s: CellStyle = { ...estilo, numFmt: coluna.real ? '"R$" #,##0.00' : undefined, alignment: { ...estilo.alignment, horizontal: "right" } };
        por(3 + i, c, { t: "n", v: valor, s });
      } else por(3 + i, c, { t: "s", v: (valor ?? "").slice(0, 32000), s: estilo });
    });
  });
  const ultimaLinha = 3 + Math.max(linhas.length, 1) - 1;
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ultimaLinha, c: ultima } });
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: ultima } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: ultima } },
  ];
  ws["!cols"] = COLUNAS.map((coluna) => ({ wch: coluna.largura }));
  ws["!rows"] = [{ hpt: 26 }, { hpt: 30 }, { hpt: 34 }];
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: ultimaLinha, c: ultima } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Acordos");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function planilhaDeNegociacao(ids: string[] | null): Promise<Buffer> {
  const todos = await idsTrabalhistas();
  const escolhidos = ids ? todos.filter((id) => ids.includes(id)) : todos;
  const linhas = (await linhasDoPainel(escolhidos)).sort((a, b) => (a.cnj ?? "").localeCompare(b.cnj ?? ""));
  return montarPlanilhaDeNegociacao(linhas);
}

export interface ResultadoImportacao {
  lidos: number;
  atualizados: number;
  semProcesso: string[];
  avisos: string[];
}

/** A planilha devolvida pelo cliente: grava o valor máximo (e as observações) de cada processo pelo número. */
export async function importarPlanilhaDeNegociacao(arquivo: Uint8Array, ator: Ator): Promise<ResultadoImportacao> {
  let linhas: unknown[][];
  try {
    const wb = XLSX.read(arquivo, { type: "array" });
    const planilha = wb.Sheets[wb.SheetNames[0]];
    linhas = XLSX.utils.sheet_to_json<unknown[]>(planilha, { header: 1, raw: true, defval: null });
  } catch {
    throw new ProcessosError("O arquivo não pôde ser lido como planilha do Excel.", 422);
  }
  const { itens, avisos } = lerPlanilhaDeValores(linhas);
  const painel = await linhasDoPainel(await idsTrabalhistas());
  const porCnj = new Map(painel.filter((linha) => linha.cnj).map((linha) => [digitosDoCnj(linha.cnj), linha]));
  let atualizados = 0;
  const semProcesso: string[] = [];
  for (const item of itens) {
    const linha = porCnj.get(item.cnj);
    if (!linha) {
      semProcesso.push(item.cnj);
      continue;
    }
    const entrada: Record<string, unknown> = {};
    if (item.valorMaximo !== null && item.valorMaximo !== linha.negociacao.valorMaximoCliente) entrada.valor_maximo_cliente = item.valorMaximo;
    if (item.observacao && item.observacao !== linha.negociacao.observacoes) {
      entrada.observacoes = linha.negociacao.observacoes ? `${linha.negociacao.observacoes}\n${item.observacao}` : item.observacao;
    }
    if (!Object.keys(entrada).length) continue;
    await salvarNegociacao(linha.processoId, entrada, ator);
    atualizados += 1;
  }
  return { lidos: itens.length, atualizados, semProcesso, avisos };
}
