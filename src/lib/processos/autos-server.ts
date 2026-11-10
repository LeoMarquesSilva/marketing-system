import "server-only";

import { z } from "zod";
import { openAIKey } from "@/lib/openai-keys";
import {
  BUCKET_AUTOS,
  DIAS_DE_GUARDA_PADRAO,
  PEDIDO_ABERTO,
  TAMANHO_MAXIMO_AUTOS,
  type AutosDoProcesso,
  type DocumentoAutos,
  type OrigemDocumento,
  type PedidoAutos,
  type Sugestao,
} from "./autos-types";
import { ProcessosError } from "./errors";
import { registrarNoHistorico } from "./processos-server";
import { db, falhou, type Ator } from "./server";
import { roboDoProcesso } from "./tribunais";

type Linha = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const COLUNAS_PEDIDO =
  "id, processo_id, cnj, sistema, tribunal, status, motivo_espera, erro, segredo_liberado, tentativas, robo, pedido_por_nome, criado_em, atualizado_em, concluido_em";
export const COLUNAS_DOCUMENTO =
  "id, processo_id, nome, storage_path, tamanho_bytes, paginas, origem, pedido_id, leitura_status, leitura_erro, leitura_iniciada_em, lido_em, paginas_lidas, paginas_sem_texto, enviado_por_nome, criado_em, arquivo_removido_em";
export const COLUNAS_SUGESTAO =
  "id, processo_id, documento_id, tipo, campo, parte_id, item, chave, resumo, valor, pagina, trecho, trecho_conferido, confianca, situacao, decidido_por_nome, decidido_em, criado_em";

export function paraPedido(linha: Linha): PedidoAutos {
  return {
    id: linha.id as string,
    processoId: linha.processo_id as string,
    cnj: linha.cnj as string,
    sistema: linha.sistema as string,
    tribunal: linha.tribunal as string,
    status: linha.status as PedidoAutos["status"],
    motivoEspera: (linha.motivo_espera as PedidoAutos["motivoEspera"]) ?? null,
    erro: (linha.erro as string | null) ?? null,
    segredoLiberado: linha.segredo_liberado === true,
    tentativas: Number(linha.tentativas ?? 0),
    robo: (linha.robo as string | null) ?? null,
    autor: (linha.pedido_por_nome as string | null) ?? null,
    criadoEm: linha.criado_em as string,
    atualizadoEm: linha.atualizado_em as string,
    concluidoEm: (linha.concluido_em as string | null) ?? null,
  };
}

function paraDocumento(linha: Linha): DocumentoAutos {
  return {
    id: linha.id as string,
    nome: linha.nome as string,
    tamanhoBytes: linha.tamanho_bytes === null || linha.tamanho_bytes === undefined ? null : Number(linha.tamanho_bytes),
    paginas: (linha.paginas as number | null) ?? null,
    origem: linha.origem as OrigemDocumento,
    leitura: linha.leitura_status as DocumentoAutos["leitura"],
    leituraErro: (linha.leitura_erro as string | null) ?? null,
    leituraIniciadaEm: (linha.leitura_iniciada_em as string | null) ?? null,
    lidoEm: (linha.lido_em as string | null) ?? null,
    paginasLidas: (linha.paginas_lidas as number | null) ?? null,
    paginasSemTexto: (linha.paginas_sem_texto as number | null) ?? null,
    autor: (linha.enviado_por_nome as string | null) ?? null,
    criadoEm: linha.criado_em as string,
    arquivoRemovidoEm: (linha.arquivo_removido_em as string | null) ?? null,
  };
}

export function paraSugestao(linha: Linha): Sugestao {
  return {
    id: linha.id as string,
    documentoId: (linha.documento_id as string | null) ?? null,
    tipo: linha.tipo as Sugestao["tipo"],
    campo: (linha.campo as string | null) ?? null,
    parteId: (linha.parte_id as string | null) ?? null,
    item: linha.item as string,
    chave: linha.chave as string,
    resumo: linha.resumo as string,
    valor: linha.valor as Sugestao["valor"],
    pagina: (linha.pagina as number | null) ?? null,
    trecho: (linha.trecho as string | null) ?? null,
    trechoConferido: linha.trecho_conferido === true,
    confianca: linha.confianca as Sugestao["confianca"],
    situacao: linha.situacao as Sugestao["situacao"],
    decididoPor: (linha.decidido_por_nome as string | null) ?? null,
    decididoEm: (linha.decidido_em as string | null) ?? null,
    criadoEm: linha.criado_em as string,
  };
}

/** Dias de guarda do PDF enquanto houver sugestão a conferir. */
export function diasDeGuarda(): number {
  const dias = Number(process.env.PROCESSOS_AUTOS_DIAS);
  return Number.isFinite(dias) && dias > 0 ? dias : DIAS_DE_GUARDA_PADRAO;
}

/** A leitura pela IA depende de uma chave da OpenAI no servidor. */
export function iaConfigurada(): boolean {
  return Boolean(openAIKey("processos"));
}

async function carregarProcesso(processoId: string): Promise<{ id: string; cnj: string | null; sistema: string | null; segredo: boolean }> {
  if (!UUID.test(processoId)) throw new ProcessosError("Processo não encontrado.", 404);
  const { data, error } = await db().from("proc_processos").select("id, cnj, sistema_tribunal, segredo_justica").eq("id", processoId).maybeSingle();
  if (error) falhou("carregar o processo", error);
  if (!data) throw new ProcessosError("Processo não encontrado.", 404);
  return { id: data.id as string, cnj: (data.cnj as string | null) ?? null, sistema: (data.sistema_tribunal as string | null) ?? null, segredo: data.segredo_justica === true };
}

/** Pedidos ao robô, documentos e sugestões de um processo. */
export async function carregarAutos(processoId: string): Promise<AutosDoProcesso> {
  const processo = await carregarProcesso(processoId);
  const [pedidos, documentos, sugestoes] = await Promise.all([
    db().from("proc_autos_pedidos").select(COLUNAS_PEDIDO).eq("processo_id", processoId).order("criado_em", { ascending: false }).limit(10),
    db().from("proc_documentos").select(COLUNAS_DOCUMENTO).eq("processo_id", processoId).order("criado_em", { ascending: false }).limit(100),
    db().from("proc_sugestoes").select(COLUNAS_SUGESTAO).eq("processo_id", processoId).order("pagina", { ascending: true, nullsFirst: false }).limit(1000),
  ]);
  if (pedidos.error) falhou("carregar os pedidos de autos", pedidos.error);
  if (documentos.error) falhou("carregar os documentos", documentos.error);
  if (sugestoes.error) falhou("carregar as sugestões", sugestoes.error);
  return {
    robo: roboDoProcesso(processo.cnj, processo.sistema),
    segredoJustica: processo.segredo,
    pedidos: ((pedidos.data ?? []) as Linha[]).map(paraPedido),
    documentos: ((documentos.data ?? []) as Linha[]).map(paraDocumento),
    // Ordem estável: página, depois a ordem de criação e o texto (várias sugestões nascem no mesmo instante).
    sugestoes: ((sugestoes.data ?? []) as Linha[])
      .map(paraSugestao)
      .sort((a, b) => (a.pagina ?? Infinity) - (b.pagina ?? Infinity) || a.criadoEm.localeCompare(b.criadoEm) || a.resumo.localeCompare(b.resumo)),
    iaConfigurada: iaConfigurada(),
    diasDeGuarda: diasDeGuarda(),
  };
}

/* ---------------------------------------------------------------- pedidos */

/**
 * Coloca o processo na fila do robô. Processo em segredo de justiça só entra com liberação explícita
 * (`liberarSegredo`), que fica registrada com o nome de quem liberou.
 */
export async function pedirAutos(processoId: string, entrada: Record<string, unknown>, ator: Ator): Promise<AutosDoProcesso> {
  const processo = await carregarProcesso(processoId);
  const robo = roboDoProcesso(processo.cnj, processo.sistema);
  if (!robo.disponivel || !robo.cnj || !robo.sistema || !robo.tribunal) throw new ProcessosError(robo.motivo ?? "Não há robô para este processo.", 422);
  const liberar = entrada.liberarSegredo === true;
  if (processo.segredo && !liberar) {
    throw new ProcessosError("O processo está em segredo de justiça: o download só é pedido com a liberação marcada.", 422);
  }
  const agora = new Date().toISOString();
  const { error } = await db()
    .from("proc_autos_pedidos")
    .insert({
      processo_id: processoId,
      cnj: robo.cnj,
      sistema: robo.sistema,
      tribunal: robo.tribunal,
      segredo_liberado: liberar,
      segredo_liberado_por: liberar ? ator.authUserId : null,
      segredo_liberado_por_nome: liberar ? ator.nome : null,
      segredo_liberado_em: liberar ? agora : null,
      pedido_por: ator.authUserId,
      pedido_por_nome: ator.nome,
    });
  if (error) {
    if ((error as { code?: string }).code === "23505") throw new ProcessosError("Já existe um pedido de autos em aberto para este processo.", 409);
    falhou("pedir os autos ao robô", error);
  }
  await registrarNoHistorico(processoId, "autos", null, `Download pedido ao robô (${robo.tribunal})${liberar ? ", com liberação de segredo de justiça" : ""}`, ator);
  return carregarAutos(processoId);
}

async function carregarPedido(pedidoId: string): Promise<PedidoAutos> {
  if (!UUID.test(pedidoId)) throw new ProcessosError("Pedido não encontrado.", 404);
  const { data, error } = await db().from("proc_autos_pedidos").select(COLUNAS_PEDIDO).eq("id", pedidoId).maybeSingle();
  if (error) falhou("carregar o pedido", error);
  if (!data) throw new ProcessosError("Pedido não encontrado.", 404);
  return paraPedido(data as Linha);
}

/** Cancela um pedido em aberto ou libera o download de um processo que o robô encontrou em segredo de justiça. */
export async function decidirPedido(pedidoId: string, entrada: Record<string, unknown>, ator: Ator): Promise<AutosDoProcesso> {
  const pedido = await carregarPedido(pedidoId);
  const agora = new Date().toISOString();
  if (entrada.acao === "cancelar") {
    if (!PEDIDO_ABERTO.includes(pedido.status)) throw new ProcessosError("Este pedido já foi encerrado.", 409);
    const { error } = await db().from("proc_autos_pedidos").update({ status: "cancelado", motivo_espera: null, atualizado_em: agora, concluido_em: agora }).eq("id", pedidoId).in("status", PEDIDO_ABERTO);
    if (error) falhou("cancelar o pedido", error);
    await registrarNoHistorico(pedido.processoId, "autos", null, "Pedido de download cancelado", ator);
  } else if (entrada.acao === "liberar_segredo") {
    if (pedido.status !== "aguardando_pessoa" || pedido.motivoEspera !== "segredo_justica") throw new ProcessosError("Este pedido não está à espera de liberação.", 409);
    const { error } = await db()
      .from("proc_autos_pedidos")
      .update({
        status: "pendente",
        motivo_espera: null,
        segredo_liberado: true,
        segredo_liberado_por: ator.authUserId,
        segredo_liberado_por_nome: ator.nome,
        segredo_liberado_em: agora,
        atualizado_em: agora,
      })
      .eq("id", pedidoId)
      .eq("status", "aguardando_pessoa");
    if (error) falhou("liberar o download", error);
    await registrarNoHistorico(pedido.processoId, "autos", null, "Download liberado apesar do segredo de justiça", ator);
  } else {
    throw new ProcessosError("Ação desconhecida para o pedido.", 400);
  }
  return carregarAutos(pedido.processoId);
}

/* ------------------------------------------------------------- documentos */

function nomeLimpo(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);
  return `${base || "autos"}.pdf`;
}

const esquemaUpload = z.object({
  nome: z.string().trim().min(1).max(200).refine((nome) => /\.pdf$/i.test(nome), "Envie os autos em PDF."),
  tamanho: z.number().int().positive("O arquivo está vazio.").max(TAMANHO_MAXIMO_AUTOS, "O arquivo passa de 200 MB."),
});

function validar<T>(esquema: z.ZodType<T>, entrada: unknown): T {
  const lido = esquema.safeParse(entrada);
  if (!lido.success) throw new ProcessosError(lido.error.issues[0]?.message ?? "Dados inválidos.", 400);
  return lido.data;
}

/** URL assinada para subir o PDF direto no bucket privado (o arquivo não passa pela Vercel). */
export async function prepararUpload(processoId: string, entrada: unknown): Promise<{ bucket: string; path: string; token: string }> {
  await carregarProcesso(processoId);
  const dados = validar(esquemaUpload, entrada);
  const caminho = `processos/${processoId}/${Date.now()}-${nomeLimpo(dados.nome)}`;
  const { data, error } = await db().storage.from(BUCKET_AUTOS).createSignedUploadUrl(caminho);
  if (error || !data) falhou("preparar o envio do arquivo", error);
  return { bucket: BUCKET_AUTOS, path: data.path, token: data.token };
}

const esquemaRegistro = z.object({
  path: z.string().trim().min(1).max(500),
  nome: z.string().trim().min(1).max(200),
});

/** Confere que o arquivo chegou ao bucket e devolve o tamanho real. */
async function tamanhoNoBucket(caminho: string): Promise<number | null> {
  const corte = caminho.lastIndexOf("/");
  const { data, error } = await db().storage.from(BUCKET_AUTOS).list(caminho.slice(0, corte), { search: caminho.slice(corte + 1), limit: 5 });
  if (error) falhou("conferir o arquivo enviado", error);
  const arquivo = (data ?? []).find((item) => item.name === caminho.slice(corte + 1));
  if (!arquivo) throw new ProcessosError("O arquivo não chegou ao servidor. Envie de novo.", 400);
  const tamanho = Number((arquivo.metadata as { size?: number } | null)?.size);
  return Number.isFinite(tamanho) ? tamanho : null;
}

/** Registra o PDF que já está no bucket. A leitura pela IA é pedida à parte (`lerDocumento`). */
export async function registrarDocumento(
  processoId: string,
  entrada: unknown,
  quem: { origem: "manual"; ator: Ator } | { origem: "robo"; pedidoId: string; robo: string | null }
): Promise<DocumentoAutos> {
  const dados = validar(esquemaRegistro, entrada);
  if (!dados.path.startsWith(`processos/${processoId}/`) || dados.path.includes("..")) throw new ProcessosError("Arquivo inválido para este processo.", 400);
  const tamanho = await tamanhoNoBucket(dados.path);
  const { data, error } = await db()
    .from("proc_documentos")
    .insert({
      processo_id: processoId,
      nome: dados.nome,
      storage_path: dados.path,
      tamanho_bytes: tamanho,
      origem: quem.origem,
      pedido_id: quem.origem === "robo" ? quem.pedidoId : null,
      enviado_por: quem.origem === "manual" ? quem.ator.authUserId : null,
      enviado_por_nome: quem.origem === "manual" ? quem.ator.nome : `Robô${quem.robo ? ` (${quem.robo})` : ""}`,
    })
    .select(COLUNAS_DOCUMENTO)
    .single();
  if (error || !data) {
    if ((error as { code?: string } | null)?.code === "23505") throw new ProcessosError("Este arquivo já foi registrado.", 409);
    falhou("registrar o documento", error);
  }
  if (quem.origem === "manual") await registrarNoHistorico(processoId, "autos", null, `Autos anexados: ${dados.nome}`, quem.ator);
  return paraDocumento(data as Linha);
}

export async function carregarDocumento(
  documentoId: string
): Promise<{ id: string; processoId: string; nome: string; caminho: string; leitura: string; leituraIniciadaEm: string | null; arquivoRemovidoEm: string | null }> {
  if (!UUID.test(documentoId)) throw new ProcessosError("Documento não encontrado.", 404);
  const { data, error } = await db().from("proc_documentos").select(COLUNAS_DOCUMENTO).eq("id", documentoId).maybeSingle();
  if (error) falhou("carregar o documento", error);
  if (!data) throw new ProcessosError("Documento não encontrado.", 404);
  return {
    id: data.id as string,
    processoId: data.processo_id as string,
    nome: data.nome as string,
    caminho: data.storage_path as string,
    leitura: data.leitura_status as string,
    leituraIniciadaEm: (data.leitura_iniciada_em as string | null) ?? null,
    arquivoRemovidoEm: (data.arquivo_removido_em as string | null) ?? null,
  };
}

/* ------------------------------------------------- o PDF é temporário */

/** Exclui o PDF do bucket e marca o documento. O registro e as sugestões (com página e trecho) continuam. */
async function descartarArquivo(documento: { id: string; caminho: string }): Promise<void> {
  const { error: erroArquivo } = await db().storage.from(BUCKET_AUTOS).remove([documento.caminho]);
  if (erroArquivo) falhou("excluir o PDF dos autos", erroArquivo);
  const { error } = await db().from("proc_documentos").update({ arquivo_removido_em: new Date().toISOString() }).eq("id", documento.id).is("arquivo_removido_em", null);
  if (error) falhou("registrar o descarte do PDF", error);
}

/**
 * Descarta o PDF quando não resta nada a conferir nele: leitura concluída e nenhuma sugestão pendente.
 * Chamado depois da leitura e depois de cada decisão. Falha aqui não desfaz a decisão: o descarte por
 * prazo (descartarVencidos) recolhe o que sobrar.
 */
export async function descartarSeConcluido(documentoId: string): Promise<boolean> {
  try {
    const documento = await carregarDocumento(documentoId);
    if (documento.arquivoRemovidoEm || documento.leitura !== "lida") return false;
    const { count, error } = await db().from("proc_sugestoes").select("id", { count: "exact", head: true }).eq("documento_id", documentoId).eq("situacao", "pendente");
    if (error) falhou("contar as sugestões pendentes", error);
    if (count) return false;
    await descartarArquivo(documento);
    return true;
  } catch (erro) {
    console.error("[processos] descarte do PDF:", erro instanceof Error ? erro.message : erro);
    return false;
  }
}

/** Descarta os PDFs com o prazo de guarda vencido (cron diário), tenham ou não sugestões pendentes. */
export async function descartarVencidos(): Promise<{ descartados: number; falhas: number }> {
  const limite = new Date(Date.now() - diasDeGuarda() * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db().from("proc_documentos").select("id, storage_path").is("arquivo_removido_em", null).neq("leitura_status", "lendo").lt("criado_em", limite).limit(500);
  if (error) falhou("listar os PDFs vencidos", error);
  let descartados = 0;
  let falhas = 0;
  for (const linha of data ?? []) {
    try {
      await descartarArquivo({ id: linha.id as string, caminho: linha.storage_path as string });
      descartados += 1;
    } catch {
      falhas += 1;
    }
  }
  return { descartados, falhas };
}

/** URL assinada de 10 minutos para abrir o PDF no navegador (a tela acrescenta #page=N). */
export async function urlDoDocumento(documentoId: string): Promise<string> {
  const documento = await carregarDocumento(documentoId);
  if (documento.arquivoRemovidoEm) throw new ProcessosError("O PDF destes autos já foi descartado. Ficaram as sugestões, com página e trecho; para ver o documento, abra o processo no tribunal.", 410);
  const { data, error } = await db().storage.from(BUCKET_AUTOS).createSignedUrl(documento.caminho, 600);
  if (error || !data) falhou("abrir o documento", error);
  return data.signedUrl;
}

/** Tira o PDF do processo, com as sugestões dele que ninguém decidiu. O que já foi aprovado continua no cadastro. */
export async function excluirDocumento(documentoId: string, ator: Ator): Promise<AutosDoProcesso> {
  const documento = await carregarDocumento(documentoId);
  const banco = db();
  const { error: erroSugestoes } = await banco.from("proc_sugestoes").delete().eq("documento_id", documentoId).eq("situacao", "pendente");
  if (erroSugestoes) falhou("remover as sugestões do documento", erroSugestoes);
  if (!documento.arquivoRemovidoEm) {
    const { error: erroArquivo } = await banco.storage.from(BUCKET_AUTOS).remove([documento.caminho]);
    if (erroArquivo) console.error("[processos] remover o arquivo dos autos:", erroArquivo.message);
  }
  const { error } = await banco.from("proc_documentos").delete().eq("id", documentoId);
  if (error) falhou("excluir o documento", error);
  await registrarNoHistorico(documento.processoId, "autos", documento.nome, "Excluído", ator);
  return carregarAutos(documento.processoId);
}
