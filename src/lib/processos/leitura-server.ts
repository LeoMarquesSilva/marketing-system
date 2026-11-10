import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { openAIKey } from "@/lib/openai-keys";
import { OPENAI_DEFAULT_MODEL, isOpenAIReasoningModel } from "@/lib/openai-models";
import { custoDaChamada } from "@/lib/vistagem/sugestao-ia";
import { carregarDocumento } from "./autos-server";
import { BUCKET_AUTOS, type SugestaoNova } from "./autos-types";
import { ProcessosError } from "./errors";
import { extrairPaginas, type TextoDoPdf } from "./leitura-pdf";
import { detalharProcesso } from "./processos-server";
import { db, falhou } from "./server";
import {
  ESQUEMA_LEITURA,
  MINIMO_TEXTO_PAGINA,
  dividirEmBlocos,
  entradaDaLeitura,
  instrucoesDaLeitura,
  juntarLeituras,
  montarSugestoes,
  type BlocoDeTexto,
  type ContextoDaLeitura,
  type LeituraDosAutos,
} from "./sugestoes";

/** Autos maiores que isso são lidos só até aqui (o resto fica anotado no documento). */
const MAXIMO_DE_PAGINAS = Number(process.env.PROCESSOS_LEITURA_MAX_PAGINAS) || 800;
/** Blocos lidos ao mesmo tempo. */
const EM_PARALELO = 4;
/** A rota tem 300 s: depois deste tempo não começa bloco novo e fecha com o que já leu. */
const PRAZO_MS = 230_000;
/** Leitura "lendo" há mais que isso é de uma execução que morreu: pode recomeçar. */
const LEITURA_TRAVADA_MS = 6 * 60_000;

export interface ResultadoDaLeitura {
  situacao: "lida" | "sem_texto";
  paginas: number;
  paginasLidas: number;
  sugestoes: number;
  aviso: string | null;
}

async function lerBloco(apiKey: string, modelo: string, contexto: ContextoDaLeitura, bloco: BlocoDeTexto, total: number): Promise<{ leitura: LeituraDosAutos; custoUS: number }> {
  const raciocinio = isOpenAIReasoningModel(modelo);
  const { object, usage } = await generateObject({
    model: createOpenAI({ apiKey })(modelo),
    schema: ESQUEMA_LEITURA,
    schemaName: "leitura_dos_autos",
    system: instrucoesDaLeitura(),
    prompt: entradaDaLeitura(contexto, bloco, total),
    temperature: raciocinio ? undefined : 0,
    providerOptions: {
      // As instruções são iguais em todas as chamadas: a chave ajuda a OpenAI a usar o cache.
      openai: { ...(raciocinio ? { reasoningEffort: "low" as const } : {}), promptCacheKey: "processos-autos", store: false },
    },
  });
  return {
    leitura: object,
    custoUS: custoDaChamada({ entrada: usage.inputTokens ?? 0, cache: usage.inputTokenDetails?.cacheReadTokens ?? 0, saida: usage.outputTokens ?? 0 }),
  };
}

async function encerrar(documentoId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("proc_documentos").update(patch).eq("id", documentoId);
  if (error) console.error("[processos] gravar o resultado da leitura:", error.message);
}

/** Sugestões do documento que ninguém decidiu saem (releitura); as novas entram sem repetir proposta já feita. */
async function gravarSugestoes(processoId: string, documentoId: string, sugestoes: SugestaoNova[]): Promise<number> {
  const banco = db();
  const { error: erroLimpeza } = await banco.from("proc_sugestoes").delete().eq("documento_id", documentoId).eq("situacao", "pendente");
  if (erroLimpeza) falhou("limpar as sugestões anteriores", erroLimpeza);
  if (!sugestoes.length) return 0;
  const { data, error } = await banco
    .from("proc_sugestoes")
    .upsert(
      sugestoes.map((item) => ({
        processo_id: processoId,
        documento_id: documentoId,
        tipo: item.tipo,
        campo: item.campo,
        parte_id: item.parteId,
        item: item.item,
        chave: item.chave,
        resumo: item.resumo.slice(0, 500),
        valor: item.valor,
        pagina: item.pagina,
        trecho: item.trecho,
        trecho_conferido: item.trechoConferido,
        confianca: item.confianca,
      })),
      { onConflict: "processo_id,chave", ignoreDuplicates: true }
    )
    .select("id");
  if (error) falhou("gravar as sugestões", error);
  return data?.length ?? 0;
}

/**
 * Lê um PDF dos autos: extrai o texto, pede a leitura à IA bloco a bloco e grava as sugestões como
 * pendentes. Não altera o cadastro: isso só acontece quando alguém aprova a sugestão.
 */
export async function lerDocumento(documentoId: string): Promise<ResultadoDaLeitura> {
  const documento = await carregarDocumento(documentoId);
  const apiKey = openAIKey("processos");
  if (!apiKey) throw new ProcessosError("A chave da OpenAI não está configurada: o PDF fica guardado e pode ser lido depois.", 503);

  // Só uma leitura por vez em cada documento.
  const agora = new Date();
  const travadaAntesDe = new Date(agora.getTime() - LEITURA_TRAVADA_MS).toISOString();
  const { data: tomado, error: erroTomar } = await db()
    .from("proc_documentos")
    .update({ leitura_status: "lendo", leitura_iniciada_em: agora.toISOString(), leitura_erro: null })
    .eq("id", documentoId)
    .or(`leitura_status.neq.lendo,leitura_iniciada_em.is.null,leitura_iniciada_em.lt.${travadaAntesDe}`)
    .select("id");
  if (erroTomar) falhou("iniciar a leitura", erroTomar);
  if (!tomado?.length) throw new ProcessosError("Este documento já está sendo lido. Aguarde alguns minutos.", 409);

  const inicio = Date.now();
  try {
    const { data: arquivo, error: erroArquivo } = await db().storage.from(BUCKET_AUTOS).download(documento.caminho);
    if (erroArquivo || !arquivo) throw new ProcessosError("Não foi possível abrir o PDF guardado.", 500);
    let texto: TextoDoPdf;
    try {
      texto = await extrairPaginas(new Uint8Array(await arquivo.arrayBuffer()), MAXIMO_DE_PAGINAS);
    } catch (erro) {
      console.error("[processos] extrair o texto do PDF:", erro instanceof Error ? erro.message : erro);
      throw new ProcessosError("O arquivo não pôde ser lido como PDF (corrompido ou protegido por senha).", 422);
    }
    const semTexto = texto.paginas.filter((pagina) => pagina.trim().length < MINIMO_TEXTO_PAGINA).length;
    const blocos = dividirEmBlocos(texto.paginas);
    if (!blocos.length) {
      await encerrar(documentoId, {
        leitura_status: "sem_texto",
        leitura_erro: "O PDF não tem camada de texto (páginas digitalizadas): a IA não consegue ler.",
        paginas: texto.total,
        paginas_lidas: 0,
        paginas_sem_texto: semTexto,
        lido_em: new Date().toISOString(),
      });
      return { situacao: "sem_texto", paginas: texto.total, paginasLidas: 0, sugestoes: 0, aviso: "O PDF não tem camada de texto." };
    }

    const processo = await detalharProcesso(documento.processoId);
    const contexto: ContextoDaLeitura = { valores: processo.valores, partes: processo.partes };
    const modelo = OPENAI_DEFAULT_MODEL;
    const leituras: LeituraDosAutos[] = [];
    let custoUS = 0;
    let falhas = 0;
    let paginasLidas = 0;
    let proximo = 0;

    async function trabalhar(): Promise<void> {
      while (proximo < blocos.length && Date.now() - inicio < PRAZO_MS) {
        const bloco = blocos[proximo];
        proximo += 1;
        try {
          const resultado = await lerBloco(apiKey as string, modelo, contexto, bloco, texto.total);
          leituras.push(resultado.leitura);
          custoUS += resultado.custoUS;
          paginasLidas += bloco.paginas;
        } catch (erro) {
          falhas += 1;
          console.error(`[processos] leitura das páginas ${bloco.inicio}-${bloco.fim}:`, erro instanceof Error ? erro.message : erro);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(EM_PARALELO, blocos.length) }, trabalhar));
    if (!leituras.length) throw new ProcessosError("A IA não respondeu à leitura dos autos. Tente de novo em alguns minutos.", 502);

    const sugestoes = montarSugestoes(juntarLeituras(leituras), contexto, texto.paginas);
    const gravadas = await gravarSugestoes(documento.processoId, documentoId, sugestoes);

    const avisos: string[] = [];
    const naoLidos = blocos.length - leituras.length;
    if (naoLidos > 0) avisos.push(`Leitura parcial: ${naoLidos} de ${blocos.length} trechos ficaram sem ler (${falhas ? "falha da IA" : "tempo esgotado"}). Leia de novo para completar.`);
    if (texto.total > texto.paginas.length) avisos.push(`O arquivo tem ${texto.total} páginas; foram lidas as primeiras ${texto.paginas.length}.`);
    if (semTexto > 0) avisos.push(`${semTexto} página${semTexto === 1 ? "" : "s"} sem camada de texto (digitalizada${semTexto === 1 ? "" : "s"}) não ${semTexto === 1 ? "foi lida" : "foram lidas"}.`);
    const aviso = avisos.join(" ") || null;

    await encerrar(documentoId, {
      leitura_status: "lida",
      leitura_erro: aviso,
      paginas: texto.total,
      paginas_lidas: paginasLidas,
      paginas_sem_texto: semTexto,
      leitura_modelo: modelo,
      leitura_custo_us: Math.round(custoUS * 10000) / 10000,
      lido_em: new Date().toISOString(),
    });
    return { situacao: "lida", paginas: texto.total, paginasLidas, sugestoes: gravadas, aviso };
  } catch (erro) {
    const mensagem = erro instanceof ProcessosError ? erro.message : "A leitura falhou. Tente de novo.";
    if (!(erro instanceof ProcessosError)) console.error("[processos] leitura dos autos:", erro instanceof Error ? erro.message : erro);
    await encerrar(documentoId, { leitura_status: "erro", leitura_erro: mensagem });
    throw erro instanceof ProcessosError ? erro : new ProcessosError(mensagem, 500);
  }
}
