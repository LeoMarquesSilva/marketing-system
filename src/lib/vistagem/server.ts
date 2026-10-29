import "server-only";

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { montarPublicacoes } from "./captura";
import { VistagemError } from "./errors";
import { KurierArquivoInvalidoError, lerNomeArquivoKurier, lerPlanilhaKurier } from "./kurier-arquivo";
import { baixarArquivoSharePoint, listarArquivosKurierSharePoint } from "./sharepoint";
import { buscarPastasVios } from "./pastas-vios";
import { buscarPastaPorCi, buscarPastasPorCnj, carregarAreasDasPessoas } from "./sioe";
import { ESCRITORIOS, citaAdvogadoDoEscritorio, temDemandaDeRisco, triar, type PastaSioe, type Pendencia } from "./triagem";
import type { SugestaoTriagem } from "./sugestao-triagem";
import type {
  ArquivoKurierResumo,
  DuplicidadeCriterio,
  DuplicidadeItem,
  DuplicidadeResultado,
  PendenciasControladoria,
  PublicacaoCapturada,
  PublicacaoResumo,
  ResolucaoPendencia,
  SincronizacaoResultado,
  TriagemResumo,
} from "./types";

const BUCKET = "vistagem-kurier";
const LOTE_INSERCAO = 50;
const TEOR_LISTAGEM = 1500;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function admin(): SupabaseClient {
  if (!supabaseUrl || !serviceKey) throw new VistagemError("Supabase não configurado no servidor.", 500);
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

export function falhou(contexto: string, erro: { message: string } | null): never {
  console.error(`[vistagem] ${contexto}:`, erro?.message);
  throw new VistagemError(`Não foi possível ${contexto}.`, 500);
}

function emLotes<T>(itens: T[], tamanho = LOTE_INSERCAO): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

export function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// ---------------------------------------------------------------------------
// Mapeamento banco → tela
// ---------------------------------------------------------------------------

const COLUNAS_ARQUIVO =
  "id, nome_arquivo, data_arquivo, lote, origem, status, erro, total_linhas, total_captadas, total_duplicidades, total_descartadas, recebido_em, processado_em";

type ArquivoRow = {
  id: string; nome_arquivo: string; data_arquivo: string; lote: number; origem: "sharepoint" | "upload";
  status: "processando" | "processado" | "erro"; erro: string | null; total_linhas: number; total_captadas: number;
  total_duplicidades: number; total_descartadas: number; recebido_em: string; processado_em: string | null;
};

function arquivoResumo(row: ArquivoRow): ArquivoKurierResumo {
  return {
    id: row.id,
    nomeArquivo: row.nome_arquivo,
    dataArquivo: row.data_arquivo,
    lote: row.lote,
    origem: row.origem,
    status: row.status,
    erro: row.erro,
    totalLinhas: row.total_linhas,
    totalCaptadas: row.total_captadas,
    totalDuplicidades: row.total_duplicidades,
    totalDescartadas: row.total_descartadas,
    recebidoEm: row.recebido_em,
    processadoEm: row.processado_em,
  };
}

export const COLUNAS_PUBLICACAO =
  "id, kurier_arquivo_id, linha_arquivo, numero_processo, numero_processo_original, tribunal, justica, data_divulgacao, data_publicacao, nome_localizado, djen_id_comunicacao, djen_orgao, djen_tipo_comunicacao, djen_intimados, status, motivo_descarte, duplicidade_de, duplicidade_resultado, duplicidade_criterio, documento_ids, duplicidade_revisada_por, duplicidade_revisada_em, pasta_ci, pasta_vinculo, cliente, grupo_cliente, advogado_responsavel, situacao_processo, escritorio_responsavel, demanda_risco, pendencia, pastas_candidatas, triada_em, observacao_vistagem, vistado_por, vistado_em, conferido_por, conferido_em, devolucao_motivo, devolvido_em, checado_em, check_nota, transferido_de, transferido_em, transferencia_motivo, publicacao_esocial, sugestao_triagem, teor";

export type PublicacaoRow = {
  id: string; kurier_arquivo_id: string | null; linha_arquivo: number | null; numero_processo: string | null;
  numero_processo_original: string; tribunal: string | null; justica: PublicacaoResumo["justica"];
  data_divulgacao: string | null; data_publicacao: string | null; nome_localizado: string | null;
  djen_id_comunicacao: number | null; djen_orgao: string | null; djen_tipo_comunicacao: string | null;
  djen_intimados: string[] | null; status: PublicacaoResumo["status"]; motivo_descarte: string | null;
  duplicidade_de: string | null; duplicidade_resultado: DuplicidadeResultado | null;
  duplicidade_criterio: DuplicidadeCriterio | null; documento_ids: string[] | null;
  duplicidade_revisada_por: string | null; duplicidade_revisada_em: string | null;
  pasta_ci: string | null; pasta_vinculo: string | null; cliente: string | null; grupo_cliente: string | null; advogado_responsavel: string | null;
  situacao_processo: string | null; escritorio_responsavel: string | null; demanda_risco: boolean | null;
  pendencia: Pendencia | null; pastas_candidatas: PastaSioe[] | null; triada_em: string | null;
  observacao_vistagem: string | null; vistado_por: string | null; vistado_em: string | null; conferido_por: string | null;
  conferido_em: string | null; devolucao_motivo: string | null; devolvido_em: string | null;
  checado_em: string | null; check_nota: string | null;
  transferido_de: string | null; transferido_em: string | null; transferencia_motivo: string | null;
  publicacao_esocial: string | null; sugestao_triagem: SugestaoTriagem | null; teor: string;
};

export function publicacaoResumo(row: PublicacaoRow, limiteTeor: number | null = TEOR_LISTAGEM): PublicacaoResumo {
  const resumir = limiteTeor !== null && row.teor.length > limiteTeor;
  return {
    id: row.id,
    linhaArquivo: row.linha_arquivo,
    numeroProcesso: row.numero_processo,
    numeroProcessoOriginal: row.numero_processo_original,
    tribunal: row.tribunal,
    justica: row.justica,
    dataDivulgacao: row.data_divulgacao,
    dataPublicacao: row.data_publicacao,
    nomeLocalizado: row.nome_localizado,
    djenIdComunicacao: row.djen_id_comunicacao,
    djenOrgao: row.djen_orgao,
    djenTipoComunicacao: row.djen_tipo_comunicacao,
    djenIntimados: row.djen_intimados ?? [],
    status: row.status,
    motivoDescarte: row.motivo_descarte,
    duplicidadeDe: row.duplicidade_de,
    duplicidadeResultado: row.duplicidade_resultado,
    duplicidadeCriterio: row.duplicidade_criterio,
    documentoIds: row.documento_ids ?? [],
    pastaCi: row.pasta_ci,
    pastaVinculo: row.pasta_vinculo,
    cliente: row.cliente,
    grupoCliente: row.grupo_cliente,
    advogadoResponsavel: row.advogado_responsavel,
    situacaoProcesso: row.situacao_processo,
    escritorioResponsavel: row.escritorio_responsavel,
    demandaRisco: row.demanda_risco,
    pendencia: row.pendencia,
    pastasCandidatas: row.pastas_candidatas ?? [],
    triadaEm: row.triada_em,
    observacaoVistagem: row.observacao_vistagem,
    vistadoEm: row.vistado_em,
    conferidoEm: row.conferido_em,
    devolucaoMotivo: row.devolucao_motivo,
    devolvidoEm: row.devolvido_em,
    checadoEm: row.checado_em,
    checkNota: row.check_nota,
    transferidoDe: row.transferido_de,
    transferidoEm: row.transferido_em,
    transferenciaMotivo: row.transferencia_motivo,
    publicacaoEsocial: row.publicacao_esocial,
    sugestaoTriagem: row.sugestao_triagem ?? null,
    teor: resumir ? `${row.teor.slice(0, limiteTeor as number)}…` : row.teor,
    teorResumido: resumir,
  };
}

function publicacaoParaLinha(p: PublicacaoCapturada, arquivoId: string) {
  return {
    origem: "kurier",
    kurier_arquivo_id: arquivoId,
    linha_arquivo: p.linha,
    data_divulgacao: p.dataDivulgacao,
    data_publicacao: p.dataPublicacao,
    numero_processo_original: p.numeroProcessoOriginal,
    numero_processo: p.processo.cnj,
    processo_digitos: p.processo.digitos,
    processo_sufixo: p.processo.sufixo,
    estado: p.estado || null,
    diario: p.diario || null,
    tribunal: p.tribunal.sigla || null,
    justica: p.tribunal.justica,
    nome_localizado: p.nomeLocalizado || null,
    caderno: p.caderno || null,
    comarca: p.comarca || null,
    titulo: p.titulo || null,
    teor: p.teor,
    djen_id_comunicacao: p.djen?.idComunicacao ?? null,
    djen_orgao: p.djen?.orgao ?? null,
    djen_tipo_comunicacao: p.djen?.tipoComunicacao ?? null,
    djen_intimados: p.djen?.intimados ?? [],
    djen_partes: p.djen?.partes ?? [],
    djen_advogados: p.djen?.advogados ?? [],
    chave_decisao: p.chaveDecisao,
    documento_ids: p.documentoIds,
    status: p.status,
    motivo_descarte: p.motivoDescarte,
  };
}

// ---------------------------------------------------------------------------
// Importação de um arquivo
// ---------------------------------------------------------------------------

export interface ImportacaoInput {
  nome: string;
  conteudo: Uint8Array;
  origem: "sharepoint" | "upload";
  sharepointItemId?: string;
  enviadoPor?: string;
  /** Triar logo após importar (a sincronização tria uma vez só, no fim). */
  triar?: boolean;
}

/** Principais já gravadas em arquivos anteriores com as mesmas chaves (mesma publicação reenviada). */
async function principaisAnteriores(db: SupabaseClient, chaves: string[], arquivoId: string): Promise<Map<string, string>> {
  const encontradas = new Map<string, string>();
  for (const lote of emLotes([...new Set(chaves)])) {
    const { data, error } = await db
      .from("vistagem_publicacoes")
      .select("id, chave_decisao")
      .in("chave_decisao", lote)
      .is("duplicidade_de", null)
      .or(`kurier_arquivo_id.is.null,kurier_arquivo_id.neq.${arquivoId}`)
      .order("created_at", { ascending: true });
    if (error) falhou("verificar publicações já capturadas", error);
    for (const row of data ?? []) {
      if (!encontradas.has(row.chave_decisao)) encontradas.set(row.chave_decisao, row.id);
    }
  }
  return encontradas;
}

/**
 * Importa o xlsx da Kurier: guarda o original, grava cada linha como
 * publicação e liga as duplicidades à publicação principal. Reenviar o mesmo
 * arquivo não duplica nada; um arquivo que falhou antes é reprocessado.
 */
export async function importarArquivoKurier(
  input: ImportacaoInput
): Promise<{ arquivo: ArquivoKurierResumo; novo: boolean; triagem?: TriagemResumo }> {
  const meta = lerNomeArquivoKurier(input.nome);
  if (!meta) throw new VistagemError("O nome do arquivo não segue o padrão da Kurier (…_Lote-01_DDMMAAAA.xlsx).");

  const db = admin();
  const sha256 = createHash("sha256").update(input.conteudo).digest("hex");

  const filtroExistente = input.sharepointItemId
    ? `sha256.eq.${sha256},sharepoint_item_id.eq.${input.sharepointItemId}`
    : `sha256.eq.${sha256}`;
  const { data: existente, error: erroExistente } = await db
    .from("vistagem_kurier_arquivos")
    .select(COLUNAS_ARQUIVO)
    .or(filtroExistente)
    .limit(1)
    .maybeSingle<ArquivoRow>();
  if (erroExistente) falhou("verificar se o arquivo já foi importado", erroExistente);
  if (existente && existente.status !== "erro") return { arquivo: arquivoResumo(existente), novo: false };

  // Um arquivo por dia/lote: outro xlsx do mesmo dia (ex.: baixado e salvo de novo) não reimporta tudo.
  const { data: mesmoDia, error: erroMesmoDia } = await db
    .from("vistagem_kurier_arquivos")
    .select("id")
    .eq("data_arquivo", meta.dataArquivo)
    .eq("lote", meta.lote)
    .neq("status", "erro")
    .neq("sha256", sha256)
    .limit(1);
  if (erroMesmoDia) falhou("verificar arquivos do mesmo dia", erroMesmoDia);
  if (mesmoDia?.length) {
    const [ano, mes, dia] = meta.dataArquivo.split("-");
    throw new VistagemError(`Já existe um arquivo da Kurier de ${dia}/${mes}/${ano} (lote ${meta.lote}) importado.`, 409);
  }

  const storagePath = `${meta.dataArquivo.slice(0, 4)}/${input.nome}`;
  const { error: erroStorage } = await db.storage.from(BUCKET).upload(storagePath, input.conteudo, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });
  if (erroStorage) falhou("guardar o arquivo original", erroStorage);

  const registro = {
    nome_arquivo: input.nome,
    data_arquivo: meta.dataArquivo,
    lote: meta.lote,
    sha256,
    sharepoint_item_id: input.sharepointItemId ?? null,
    storage_path: storagePath,
    origem: input.origem,
    status: "processando",
    erro: null,
    enviado_por: input.enviadoPor ?? null,
    recebido_em: new Date().toISOString(),
    processado_em: null,
  };

  let arquivoId: string;
  if (existente) {
    arquivoId = existente.id;
    const { error } = await db.from("vistagem_publicacoes").delete().eq("kurier_arquivo_id", arquivoId);
    if (error) falhou("limpar a importação anterior", error);
    const { error: erroUpdate } = await db.from("vistagem_kurier_arquivos").update(registro).eq("id", arquivoId);
    if (erroUpdate) falhou("registrar o arquivo", erroUpdate);
  } else {
    const { data, error } = await db.from("vistagem_kurier_arquivos").insert(registro).select("id").single();
    if (error || !data) falhou("registrar o arquivo", error);
    arquivoId = data.id;
  }

  try {
    const publicacoes = montarPublicacoes(lerPlanilhaKurier(input.conteudo));
    const anteriores = await principaisAnteriores(
      db,
      publicacoes.filter((p) => p.status === "captada" && p.chaveDecisao).map((p) => p.chaveDecisao as string),
      arquivoId
    );

    // 1) principais e descartadas; 2) duplicidades, já com o id da principal.
    const principais = publicacoes.filter((p) => p.status !== "duplicidade" && !(p.chaveDecisao && anteriores.has(p.chaveDecisao)));
    const idPorLinha = new Map<number, string>();
    for (const lote of emLotes(principais)) {
      const { data, error } = await db
        .from("vistagem_publicacoes")
        .insert(lote.map((p) => publicacaoParaLinha(p, arquivoId)))
        .select("id, linha_arquivo");
      if (error) throw new Error(error.message);
      for (const row of data ?? []) idPorLinha.set(row.linha_arquivo, row.id);
    }

    const duplicidades = publicacoes
      .filter((p) => !principais.includes(p))
      .map((p) => ({
        ...publicacaoParaLinha(p, arquivoId),
        status: "duplicidade",
        duplicidade_criterio: p.duplicidadeCriterio ?? "texto",
        duplicidade_de:
          p.duplicidadeDeLinha !== null ? idPorLinha.get(p.duplicidadeDeLinha) : anteriores.get(p.chaveDecisao as string),
      }));
    for (const lote of emLotes(duplicidades)) {
      const { error } = await db.from("vistagem_publicacoes").insert(lote);
      if (error) throw new Error(error.message);
    }

    const totais = {
      total_linhas: publicacoes.length,
      total_captadas: principais.filter((p) => p.status === "captada").length,
      total_duplicidades: duplicidades.length,
      total_descartadas: publicacoes.filter((p) => p.status === "descartada").length,
    };
    const { data: final, error } = await db
      .from("vistagem_kurier_arquivos")
      .update({ ...totais, status: "processado", processado_em: new Date().toISOString() })
      .eq("id", arquivoId)
      .select(COLUNAS_ARQUIVO)
      .single<ArquivoRow>();
    if (error || !final) throw new Error(error?.message ?? "arquivo sumiu");
    const triagem = input.triar === false ? undefined : await triarSemFalhar({ arquivoId });
    return { arquivo: arquivoResumo(final), novo: true, triagem };
  } catch (erro) {
    const mensagem =
      erro instanceof KurierArquivoInvalidoError ? erro.message : `Falha ao processar: ${erro instanceof Error ? erro.message : erro}`;
    console.error("[vistagem] importação falhou", input.nome, mensagem);
    await db.from("vistagem_kurier_arquivos").update({ status: "erro", erro: mensagem }).eq("id", arquivoId);
    throw new VistagemError(mensagem, erro instanceof KurierArquivoInvalidoError ? 400 : 500);
  }
}

/** Busca na pasta da Kurier o xlsx do dia (ainda não importado). Dias anteriores entram por envio manual. */
export async function sincronizarKurierSharePoint(): Promise<SincronizacaoResultado> {
  const { token, siteId, arquivos } = await listarArquivosKurierSharePoint();
  const hoje = hojeEmSaoPaulo();

  const candidatos = arquivos
    .map((arquivo) => ({ arquivo, meta: lerNomeArquivoKurier(arquivo.nome) }))
    .filter((item) => item.meta?.dataArquivo === hoje)
    .sort((a, b) => (a.meta!.dataArquivo + a.meta!.lote).localeCompare(b.meta!.dataArquivo + b.meta!.lote));

  const db = admin();
  const { data: jaImportados, error } = await db
    .from("vistagem_kurier_arquivos")
    .select("sharepoint_item_id, status")
    .in("sharepoint_item_id", candidatos.map((item) => item.arquivo.id).concat("-"));
  if (error) falhou("consultar arquivos já importados", error);
  const prontos = new Set((jaImportados ?? []).filter((row) => row.status !== "erro").map((row) => row.sharepoint_item_id));

  const resultado: SincronizacaoResultado = { verificados: candidatos.length, importados: 0, resultados: [] };
  for (const { arquivo } of candidatos) {
    if (prontos.has(arquivo.id)) {
      resultado.resultados.push({ nome: arquivo.nome, situacao: "ja_importado" });
      continue;
    }
    try {
      const conteudo = await baixarArquivoSharePoint(siteId, arquivo.id, token);
      const { novo } = await importarArquivoKurier({
        nome: arquivo.nome,
        conteudo,
        origem: "sharepoint",
        sharepointItemId: arquivo.id,
        triar: false,
      });
      if (novo) resultado.importados += 1;
      resultado.resultados.push({ nome: arquivo.nome, situacao: novo ? "importado" : "ja_importado" });
    } catch (erro) {
      resultado.resultados.push({ nome: arquivo.nome, situacao: "erro", mensagem: erro instanceof Error ? erro.message : String(erro) });
    }
  }
  // Tria o que foi importado e tenta de novo as que estavam sem pasta (a pasta pode ter sido aberta no VIOS).
  resultado.triagem = await triarSemFalhar({ incluirSemPasta: true });
  return resultado;
}

// ---------------------------------------------------------------------------
// Consultas e revisão
// ---------------------------------------------------------------------------

export async function listarArquivosKurier(limite = 30): Promise<ArquivoKurierResumo[]> {
  const { data, error } = await admin()
    .from("vistagem_kurier_arquivos")
    .select(COLUNAS_ARQUIVO)
    .order("data_arquivo", { ascending: false })
    .order("lote", { ascending: false })
    .limit(limite);
  if (error) falhou("carregar os arquivos da Kurier", error);
  return ((data ?? []) as ArquivoRow[]).map(arquivoResumo);
}

export async function listarPublicacoesDoArquivo(arquivoId: string): Promise<PublicacaoResumo[]> {
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .select(COLUNAS_PUBLICACAO)
    .eq("kurier_arquivo_id", arquivoId)
    .order("linha_arquivo", { ascending: true });
  if (error) falhou("carregar as publicações do arquivo", error);
  return ((data ?? []) as PublicacaoRow[]).map((row) => publicacaoResumo(row));
}

export async function obterPublicacao(id: string): Promise<PublicacaoResumo> {
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .select(COLUNAS_PUBLICACAO)
    .eq("id", id)
    .maybeSingle<PublicacaoRow>();
  if (error) falhou("carregar a publicação", error);
  if (!data) throw new VistagemError("Publicação não encontrada.", 404);
  return publicacaoResumo(data, null);
}

export async function listarDuplicidades(situacao: "pendentes" | "revisadas", limite = 200): Promise<DuplicidadeItem[]> {
  const db = admin();
  let consulta = db
    .from("vistagem_publicacoes")
    .select(COLUNAS_PUBLICACAO)
    .not("duplicidade_de", "is", null)
    .order("data_publicacao", { ascending: false })
    .order("linha_arquivo", { ascending: true })
    .limit(limite);
  consulta = situacao === "pendentes" ? consulta.is("duplicidade_resultado", null) : consulta.not("duplicidade_resultado", "is", null);
  const { data, error } = await consulta;
  if (error) falhou("carregar as duplicidades", error);
  const linhas = (data ?? []) as PublicacaoRow[];
  if (linhas.length === 0) return [];

  const idsPrincipais = [...new Set(linhas.map((row) => row.duplicidade_de as string))];
  const idsArquivos = [...new Set(linhas.map((row) => row.kurier_arquivo_id).filter(Boolean) as string[])];
  const idsRevisores = [...new Set(linhas.map((row) => row.duplicidade_revisada_por).filter(Boolean) as string[])];

  const [principais, arquivos, revisores] = await Promise.all([
    Promise.all(emLotes(idsPrincipais).map((lote) => db.from("vistagem_publicacoes").select(COLUNAS_PUBLICACAO).in("id", lote))),
    db.from("vistagem_kurier_arquivos").select("id, data_arquivo").in("id", idsArquivos.concat("00000000-0000-0000-0000-000000000000")),
    idsRevisores.length ? db.from("users").select("auth_id, name").in("auth_id", idsRevisores) : Promise.resolve({ data: [], error: null }),
  ]);
  const erro = principais.find((r) => r.error)?.error ?? arquivos.error ?? revisores.error;
  if (erro) falhou("carregar os detalhes das duplicidades", erro);

  const principalPorId = new Map(principais.flatMap((r) => (r.data ?? []) as PublicacaoRow[]).map((row) => [row.id, row]));
  const dataPorArquivo = new Map((arquivos.data ?? []).map((row: { id: string; data_arquivo: string }) => [row.id, row.data_arquivo]));
  const nomePorRevisor = new Map((revisores.data ?? []).map((row: { auth_id: string; name: string | null }) => [row.auth_id, row.name]));

  return linhas.map((row) => {
    const principal = principalPorId.get(row.duplicidade_de as string);
    return {
      duplicidade: publicacaoResumo(row),
      principal: principal ? publicacaoResumo(principal) : null,
      dataArquivo: row.kurier_arquivo_id ? dataPorArquivo.get(row.kurier_arquivo_id) ?? null : null,
      revisadaPor: row.duplicidade_revisada_por ? nomePorRevisor.get(row.duplicidade_revisada_por) ?? null : null,
      revisadaEm: row.duplicidade_revisada_em,
    };
  });
}

/**
 * Conferência da Maria: confirmar mantém a publicação fora da vistagem;
 * "não é duplicidade" devolve a publicação para a fila como captada.
 */
export async function revisarDuplicidade(id: string, resultado: DuplicidadeResultado, authUserId: string): Promise<void> {
  const db = admin();
  const { data: atual, error } = await db
    .from("vistagem_publicacoes")
    .select("id, duplicidade_de, status")
    .eq("id", id)
    .maybeSingle();
  if (error) falhou("carregar a duplicidade", error);
  if (!atual?.duplicidade_de) throw new VistagemError("Esta publicação não está marcada como duplicidade.", 404);
  if (!["captada", "duplicidade"].includes(atual.status)) {
    throw new VistagemError("A publicação já seguiu no fluxo e não pode mais ser revisada aqui.", 409);
  }

  const { error: erroUpdate } = await db
    .from("vistagem_publicacoes")
    .update({
      status: resultado === "confirmada" ? "duplicidade" : "captada",
      duplicidade_resultado: resultado,
      duplicidade_revisada_por: authUserId,
      duplicidade_revisada_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (erroUpdate) falhou("salvar a revisão da duplicidade", erroUpdate);
  if (resultado === "nao_duplicidade") await triarSemFalhar({ ids: [id] });
}

// ---------------------------------------------------------------------------
// Triagem com o SIOE
// ---------------------------------------------------------------------------

function camposDaTriagem(resultado: ReturnType<typeof triar>) {
  const pasta = resultado.pasta;
  return {
    status: resultado.status,
    pendencia: resultado.pendencia,
    motivo_descarte: resultado.motivoDescarte,
    pasta_ci: pasta?.ci ?? null,
    pasta_vinculo: pasta?.vinculo ?? null,
    cliente: pasta?.cliente ?? null,
    grupo_cliente: pasta?.grupoCliente ?? null,
    area_processo: pasta?.area ?? null,
    advogado_responsavel: pasta?.advogadoResponsavel ?? null,
    situacao_processo: pasta?.situacao ?? null,
    etiquetas: pasta?.etiquetas ?? null,
    escritorio_responsavel: resultado.escritorio,
    demanda_risco: resultado.demandaRisco,
    pastas_candidatas: resultado.candidatas,
    triada_em: new Date().toISOString(),
  };
}

/**
 * Cruza as publicações captadas com a base de processos do SIOE: uma pasta só
 * vai para "juridico_vistar" no escritório do advogado responsável; sem pasta
 * ou com mais de uma fica em "triagem_pendente" para a controladoria.
 */
export async function triarPublicacoes(
  filtro: { ids?: string[]; arquivoId?: string; incluirSemPasta?: boolean } = {}
): Promise<TriagemResumo> {
  const db = admin();
  let consulta = db.from("vistagem_publicacoes").select("id, processo_digitos, teor").limit(2000);
  consulta = filtro.incluirSemPasta
    ? consulta.or("status.eq.captada,and(status.eq.triagem_pendente,pendencia.eq.sem_pasta)")
    : consulta.eq("status", "captada");
  if (filtro.ids?.length) consulta = consulta.in("id", filtro.ids);
  if (filtro.arquivoId) consulta = consulta.eq("kurier_arquivo_id", filtro.arquivoId);
  const { data, error } = await consulta;
  if (error) falhou("carregar as publicações para a triagem", error);

  const alvos = (data ?? []) as { id: string; processo_digitos: string | null; teor: string }[];
  const resumo: TriagemResumo = { triadas: 0, juridico: 0, pendentes: 0, descartadas: 0, porEscritorio: {} };
  if (alvos.length === 0) return resumo;

  const [pastasSioe, areaDoAdvogado] = await Promise.all([
    buscarPastasPorCnj(alvos.map((alvo) => alvo.processo_digitos ?? "")),
    carregarAreasDasPessoas(),
  ]);
  // O SIOE não traz o vínculo; ele vem do "Processos Lista" (vistagem_pastas_vios).
  const vinculos = await buscarPastasVios([...pastasSioe.values()].flat().map((pasta) => pasta.ci));
  const pastas = new Map(
    [...pastasSioe.entries()].map(([cnj, lista]) => [cnj, lista.map((pasta) => ({ ...pasta, vinculo: pasta.vinculo ?? vinculos.get(pasta.ci)?.vinculo ?? null }))])
  );

  for (const lote of emLotes(alvos, 10)) {
    await Promise.all(
      lote.map(async (alvo) => {
        const resultado = triar(alvo.processo_digitos ? pastas.get(alvo.processo_digitos) ?? [] : [], areaDoAdvogado, {
          citaEscritorio: citaAdvogadoDoEscritorio(alvo.teor),
        });
        const { error: erroUpdate } = await db
          .from("vistagem_publicacoes")
          .update(camposDaTriagem(resultado))
          .eq("id", alvo.id)
          .in("status", ["captada", "triagem_pendente"]);
        if (erroUpdate) throw new VistagemError(`Falha ao gravar a triagem: ${erroUpdate.message}`, 500);
        resumo.triadas += 1;
        if (resultado.status === "juridico_vistar" && resultado.escritorio) {
          resumo.juridico += 1;
          resumo.porEscritorio[resultado.escritorio] = (resumo.porEscritorio[resultado.escritorio] ?? 0) + 1;
        } else if (resultado.status === "descartada") {
          resumo.descartadas += 1;
        } else {
          resumo.pendentes += 1;
        }
      })
    );
  }
  return resumo;
}

/** A triagem não pode derrubar a importação: se o SIOE falhar, as publicações ficam captadas para a próxima rodada. */
async function triarSemFalhar(filtro: Parameters<typeof triarPublicacoes>[0]): Promise<TriagemResumo> {
  try {
    return await triarPublicacoes(filtro);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error("[vistagem] triagem falhou", mensagem);
    return { triadas: 0, juridico: 0, pendentes: 0, descartadas: 0, porEscritorio: {}, erro: mensagem };
  }
}

export async function listarPendenciasControladoria(limite = 300): Promise<PendenciasControladoria> {
  const db = admin();
  const [pendentes, exClientes] = await Promise.all([
    db
      .from("vistagem_publicacoes")
      .select(COLUNAS_PUBLICACAO)
      .eq("status", "triagem_pendente")
      .order("data_publicacao", { ascending: false })
      .order("linha_arquivo", { ascending: true })
      .limit(limite),
    db
      .from("vistagem_publicacoes")
      .select(COLUNAS_PUBLICACAO)
      .eq("status", "juridico_vistar")
      .eq("pendencia", "ex_cliente")
      .order("data_publicacao", { ascending: false })
      .order("linha_arquivo", { ascending: true })
      .limit(limite),
  ]);
  if (pendentes.error) falhou("carregar as pendências da controladoria", pendentes.error);
  if (exClientes.error) falhou("carregar as publicações de ex-clientes", exClientes.error);
  return {
    pendentes: ((pendentes.data ?? []) as PublicacaoRow[]).map((row) => publicacaoResumo(row)),
    exClientes: ((exClientes.data ?? []) as PublicacaoRow[]).map((row) => publicacaoResumo(row)),
  };
}

/** Prévia de uma pasta do SIOE para a controladoria escolher. */
export async function consultarPastaSioe(ci: string): Promise<{ pasta: PastaSioe; escritorioSugerido: string | null }> {
  const pasta = await buscarPastaPorCi(ci);
  if (!pasta) throw new VistagemError(`CI ${ci} não encontrada no SIOE.`, 404);
  const resultado = triar([pasta], await carregarAreasDasPessoas());
  return { pasta, escritorioSugerido: resultado.escritorio };
}

/**
 * A controladoria resolve a pendência escolhendo a pasta (CI) e/ou informando
 * escritório, grupo e demanda de risco; a publicação vai para "juridico_vistar".
 */
export async function resolverPendencia(id: string, entrada: ResolucaoPendencia, authUserId: string): Promise<PublicacaoResumo> {
  const db = admin();
  const { data: atual, error } = await db
    .from("vistagem_publicacoes")
    .select("id, status, pasta_ci, pastas_candidatas")
    .eq("id", id)
    .maybeSingle();
  if (error) falhou("carregar a publicação", error);
  if (!atual) throw new VistagemError("Publicação não encontrada.", 404);
  if (atual.status !== "triagem_pendente") throw new VistagemError("Esta publicação não está pendente de triagem.", 409);

  const ci = entrada.ci?.replace(/\D/g, "") || atual.pasta_ci || "";
  let pasta: PastaSioe | null = null;
  if (ci) {
    const candidatas = (atual.pastas_candidatas ?? []) as PastaSioe[];
    pasta = candidatas.find((candidata) => candidata.ci === ci) ?? (await buscarPastaPorCi(ci));
    if (!pasta) throw new VistagemError(`CI ${ci} não encontrada no SIOE.`, 404);
  }

  const automatico = pasta ? triar([pasta], await carregarAreasDasPessoas()) : null;
  const escritorio = entrada.escritorio?.trim() || automatico?.escritorio || null;
  const grupo = entrada.grupo?.trim() || pasta?.grupoCliente?.trim() || null;
  if (!escritorio) throw new VistagemError("Informe o escritório responsável.");
  if (entrada.escritorio && !(ESCRITORIOS as readonly string[]).includes(escritorio)) {
    throw new VistagemError("Escritório inválido.");
  }
  if (!grupo) throw new VistagemError("Informe o grupo do cliente.");

  const campos = pasta && automatico ? camposDaTriagem(automatico) : {};
  const { data: final, error: erroUpdate } = await db
    .from("vistagem_publicacoes")
    .update({
      ...campos,
      status: "juridico_vistar",
      motivo_descarte: null,
      escritorio_responsavel: escritorio,
      grupo_cliente: grupo,
      demanda_risco: entrada.demandaRisco ?? (pasta ? temDemandaDeRisco(pasta) : false),
      pastas_candidatas: (atual.pastas_candidatas ?? []) as PastaSioe[],
      triagem_resolvida_por: authUserId,
      triagem_resolvida_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "triagem_pendente")
    .select(COLUNAS_PUBLICACAO)
    .maybeSingle();
  if (erroUpdate) falhou("salvar a resolução da pendência", erroUpdate);
  if (!final) throw new VistagemError("A publicação foi alterada por outra pessoa. Recarregue a página.", 409);
  return publicacaoResumo(final as PublicacaoRow);
}
