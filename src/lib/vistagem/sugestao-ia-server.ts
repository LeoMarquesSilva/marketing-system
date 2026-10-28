import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { openAIKey } from "@/lib/openai-keys";
import { OPENAI_DEFAULT_MODEL, isOpenAIReasoningModel } from "@/lib/openai-models";
import type { EtiquetaAgendamento, OpcaoTarefa } from "./agendamento";
import { CLASSIFICACOES_ESOCIAL } from "./esocial";
import { VistagemError } from "./errors";
import {
  COLUNAS_PUBLICACAO_COM_AREA,
  carregarPublicacao,
  catalogoParaPublicacao,
  garantirArea,
  type AreasVistagem,
  type PublicacaoComArea,
} from "./juridico-server";
import { carregarCatalogoProcessos } from "./sama";
import { admin, falhou } from "./server";
import {
  areaComSugestaoIa,
  custoDaChamada,
  entradaDaSugestao,
  esocialDaResposta,
  instrucoesDaSugestao,
  tarefasDaResposta,
  type SugestaoIa,
} from "./sugestao-ia";

const RESPOSTA = z.object({
  resumo: z.string(),
  tarefas: z.array(
    z.object({
      classe: z.enum(["PRAZO", "PROVIDENCIA", "COMPROMISSO"]),
      tarefa_id: z.string(),
      dias: z.number().int().nullable(),
      contagem: z.enum(["uteis", "corridos"]).nullable(),
      data: z.string().nullable(),
      hora: z.string().nullable(),
      motivo: z.string(),
    })
  ),
  esocial: z.enum(CLASSIFICACOES_ESOCIAL),
  confianca: z.enum(["alta", "media", "baixa"]),
});

/** Pede à OpenAI as tarefas da publicação, escolhidas só da lista do VIOS da área. */
async function pedirSugestao(publicacao: PublicacaoComArea, listas: Record<EtiquetaAgendamento, OpcaoTarefa[]>): Promise<SugestaoIa> {
  const apiKey = openAIKey("analisePublicacao");
  if (!apiKey) throw new VistagemError("A chave da OpenAI não está configurada.", 503);
  const modelo = OPENAI_DEFAULT_MODEL;
  // modelos de raciocínio recusam temperature; nos outros, 0 para a resposta variar pouco
  const raciocinio = isOpenAIReasoningModel(modelo);
  const { object, usage } = await generateObject({
    model: createOpenAI({ apiKey })(modelo),
    schema: RESPOSTA,
    schemaName: "vistagem_trabalhista",
    system: instrucoesDaSugestao(listas),
    prompt: entradaDaSugestao({
      dataPublicacao: publicacao.data_publicacao,
      tribunal: publicacao.tribunal,
      orgao: publicacao.djen_orgao,
      tipoComunicacao: publicacao.djen_tipo_comunicacao,
      teor: publicacao.teor,
    }),
    temperature: raciocinio ? undefined : 0,
    providerOptions: {
      // instruções e lista são iguais em todas as chamadas: a chave ajuda a OpenAI a usar o cache
      openai: { ...(raciocinio ? { reasoningEffort: "low" as const } : {}), promptCacheKey: "vistagem-trabalhista", store: false },
    },
  });
  return {
    resumo: object.resumo.trim(),
    tarefas: tarefasDaResposta(object, listas),
    esocial: esocialDaResposta(object.esocial),
    confianca: object.confianca,
    modelo,
    geradaEm: new Date().toISOString(),
    custoUS: custoDaChamada({
      entrada: usage.inputTokens ?? 0,
      cache: usage.inputTokenDetails?.cacheReadTokens ?? 0,
      saida: usage.outputTokens ?? 0,
    }),
  };
}

async function gravarSugestao(id: string, sugestao: SugestaoIa): Promise<void> {
  const { error } = await admin()
    .from("vistagem_publicacoes")
    .update({ sugestao_ia: sugestao, sugestao_ia_em: sugestao.geradaEm })
    .eq("id", id)
    .eq("status", "juridico_vistar");
  if (error) falhou("gravar a sugestão da IA", error);
}

/** Sugestão da publicação para a tela do jurídico: a já gravada ou uma nova. */
export async function sugestaoDaPublicacao(id: string, areas: AreasVistagem = null): Promise<SugestaoIa> {
  const publicacao = await carregarPublicacao(id);
  garantirArea(publicacao, areas);
  if (publicacao.sugestao_ia) return publicacao.sugestao_ia;
  if (publicacao.status !== "juridico_vistar") throw new VistagemError("Esta publicação não está aguardando vistagem.", 409);
  const catalogo = catalogoParaPublicacao(await carregarCatalogoProcessos(), publicacao);
  if (!catalogo || !areaComSugestaoIa(catalogo.area)) throw new VistagemError("A sugestão da IA ainda é só para o Trabalhista.", 422);
  const sugestao = await pedirSugestao(publicacao, catalogo.tarefas);
  await gravarSugestao(id, sugestao);
  return sugestao;
}

/**
 * No cron da Kurier: gera as sugestões das publicações do Trabalhista que ainda não têm,
 * 4 por vez, até o tempo acabar (as que sobrarem a tela gera ao abrir).
 */
export async function gerarSugestoesPendentes(prazoMs: number): Promise<{ pendentes: number; geradas: number; erros: number; custoUS: number }> {
  const fim = Date.now() + prazoMs;
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .select(COLUNAS_PUBLICACAO_COM_AREA)
    .eq("status", "juridico_vistar")
    .is("sugestao_ia", null)
    .order("data_publicacao", { ascending: true })
    .limit(300);
  if (error) falhou("listar as publicações sem sugestão da IA", error);
  const catalogos = await carregarCatalogoProcessos();
  const fila = ((data ?? []) as PublicacaoComArea[])
    .map((publicacao) => ({ publicacao, catalogo: catalogoParaPublicacao(catalogos, publicacao) }))
    .filter((item) => item.catalogo && areaComSugestaoIa(item.catalogo.area));
  let geradas = 0;
  let erros = 0;
  let custoUS = 0;
  for (let i = 0; i < fila.length && Date.now() < fim; i += 4) {
    const lote = await Promise.allSettled(
      fila.slice(i, i + 4).map(async ({ publicacao, catalogo }) => {
        const sugestao = await pedirSugestao(publicacao, catalogo!.tarefas);
        await gravarSugestao(publicacao.id, sugestao);
        return sugestao.custoUS;
      })
    );
    for (const item of lote) {
      if (item.status === "fulfilled") {
        geradas += 1;
        custoUS += item.value;
      } else {
        erros += 1;
        console.error("[vistagem] sugestão da IA:", item.reason instanceof Error ? item.reason.message : item.reason);
      }
    }
  }
  return { pendentes: fila.length, geradas, erros, custoUS };
}
