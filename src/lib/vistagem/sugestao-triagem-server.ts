import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { openAIKey } from "@/lib/openai-keys";
import { OPENAI_DEFAULT_MODEL, isOpenAIReasoningModel } from "@/lib/openai-models";
import { admin, falhou } from "./server";
import { buscarPastasPorCnj, carregarAreasDasPessoas, carregarTodasAsPastas } from "./sioe";
import { custoDaChamada } from "./sugestao-ia";
import {
  chaveCliente,
  entradaSugestaoTriagem,
  instrucoesSugestaoTriagem,
  numerosCitados,
  pastaAtiva,
  resumirPastas,
  sugestaoDaIa,
  sugestaoPorNumero,
  sugestaoPorPartes,
  type GrupoAtivo,
  type SugestaoTriagem,
} from "./sugestao-triagem";
import { ESCRITORIOS, type PastaSioe } from "./triagem";
import type { DjenParte } from "./types";

const RESPOSTA = z.object({
  cliente: z.string().nullable(),
  grupo: z.string().nullable(),
  escritorio: z.enum(ESCRITORIOS).nullable(),
  processo_principal: z.string().nullable(),
  demanda_risco: z.boolean(),
  confianca: z.enum(["alta", "media", "baixa"]),
  motivo: z.string(),
});

interface IndiceSioe {
  porCliente: Map<string, PastaSioe[]>;
  porGrupo: Map<string, PastaSioe[]>;
  grupos: GrupoAtivo[];
}

/** Pastas do SIOE por cliente e por grupo, e a lista de grupos com processo ativo (para a IA). */
function montarIndice(pastas: PastaSioe[]): IndiceSioe {
  const porCliente = new Map<string, PastaSioe[]>();
  const porGrupo = new Map<string, PastaSioe[]>();
  for (const pasta of pastas) {
    const cliente = chaveCliente(pasta.cliente);
    if (cliente) porCliente.set(cliente, [...(porCliente.get(cliente) ?? []), pasta]);
    const grupo = pasta.grupoCliente?.trim();
    if (grupo) porGrupo.set(grupo, [...(porGrupo.get(grupo) ?? []), pasta]);
  }
  const grupos = [...porGrupo.entries()]
    .filter(([, lista]) => lista.some(pastaAtiva))
    .map(([grupo, lista]) => {
      const contagem = new Map<string, number>();
      for (const pasta of lista) if (pasta.cliente) contagem.set(pasta.cliente, (contagem.get(pasta.cliente) ?? 0) + 1);
      return { grupo, clientes: [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([nome]) => nome) };
    })
    .sort((a, b) => a.grupo.localeCompare(b.grupo, "pt-BR"));
  return { porCliente, porGrupo, grupos };
}

type PublicacaoSemPasta = {
  id: string;
  numero_processo: string | null;
  tribunal: string | null;
  djen_orgao: string | null;
  djen_partes: DjenParte[] | null;
  djen_intimados: string[] | null;
  teor: string;
};

/** 3) A IA lê a publicação e escolhe cliente, grupo (da lista) e escritório. */
async function pedirSugestaoIa(publicacao: PublicacaoSemPasta, partes: string[], indice: IndiceSioe) {
  const apiKey = openAIKey("analisePublicacao");
  if (!apiKey) return null;
  const modelo = OPENAI_DEFAULT_MODEL;
  const raciocinio = isOpenAIReasoningModel(modelo);
  const { object, usage } = await generateObject({
    model: createOpenAI({ apiKey })(modelo),
    schema: RESPOSTA,
    schemaName: "sugestao_pasta",
    system: instrucoesSugestaoTriagem(indice.grupos),
    prompt: entradaSugestaoTriagem({
      numeroProcesso: publicacao.numero_processo,
      tribunal: publicacao.tribunal,
      orgao: publicacao.djen_orgao,
      partes,
      teor: publicacao.teor,
    }),
    temperature: raciocinio ? undefined : 0,
    providerOptions: {
      openai: { ...(raciocinio ? { reasoningEffort: "low" as const } : {}), promptCacheKey: "vistagem-sugestao-pasta", store: false },
    },
  });
  return {
    resposta: object,
    custoUS: custoDaChamada({ entrada: usage.inputTokens ?? 0, cache: usage.inputTokenDetails?.cacheReadTokens ?? 0, saida: usage.outputTokens ?? 0 }),
  };
}

async function sugerir(
  publicacao: PublicacaoSemPasta,
  indice: IndiceSioe,
  areaDoAdvogado: (nome: string | null) => string | null
): Promise<SugestaoTriagem | null> {
  // 1) Outro processo citado no teor (o principal) que já tem pasta.
  const numeros = numerosCitados(publicacao.teor, publicacao.numero_processo);
  if (numeros.length) {
    const pastas = await buscarPastasPorCnj(numeros);
    const numero = numeros.find((item) => pastas.get(item)?.length);
    if (numero) return sugestaoPorNumero(numero, pastas.get(numero) ?? [], areaDoAdvogado);
  }
  // 2) Uma parte que já é cliente.
  const partes = [...new Set([...(publicacao.djen_partes ?? []).map((parte) => parte.nome), ...(publicacao.djen_intimados ?? [])].filter(Boolean))];
  const porParte = sugestaoPorPartes(partes, indice.porCliente, areaDoAdvogado);
  if (porParte) return porParte;
  // 3) A IA, mesmo sem certeza (a controladoria confere).
  const ia = await pedirSugestaoIa(publicacao, partes, indice);
  if (!ia) return null;
  const principal = ia.resposta.processo_principal?.replace(/\D/g, "") ?? "";
  if (principal.length === 20) {
    const pastas = (await buscarPastasPorCnj([principal])).get(principal) ?? [];
    if (pastas.length) return { ...sugestaoPorNumero(principal, pastas, areaDoAdvogado), custoUS: ia.custoUS };
  }
  const doGrupo = ia.resposta.grupo ? indice.porGrupo.get(ia.resposta.grupo.trim()) ?? [] : [];
  return sugestaoDaIa(ia.resposta, indice.grupos, {
    escritorioDoGrupo: doGrupo.length ? resumirPastas(doGrupo, areaDoAdvogado).escritorio : null,
    custoUS: ia.custoUS,
  });
}

/**
 * Gera a sugestão das publicações sem pasta no VIOS que ainda não têm (cron da Kurier e
 * "Rodar triagem agora"), 4 por vez, até o tempo acabar.
 */
export async function gerarSugestoesDeTriagem(
  prazoMs: number
): Promise<{ pendentes: number; geradas: number; porNumero: number; porParte: number; porIa: number; erros: number; custoUS: number }> {
  const fim = Date.now() + prazoMs;
  const resumo = { pendentes: 0, geradas: 0, porNumero: 0, porParte: 0, porIa: 0, erros: 0, custoUS: 0 };
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .select("id, numero_processo, tribunal, djen_orgao, djen_partes, djen_intimados, teor")
    .eq("status", "triagem_pendente")
    .eq("pendencia", "sem_pasta")
    .is("sugestao_triagem", null)
    .order("data_publicacao", { ascending: true })
    .limit(200);
  if (error) falhou("listar as publicações sem pasta", error);
  const fila = (data ?? []) as PublicacaoSemPasta[];
  resumo.pendentes = fila.length;
  if (!fila.length) return resumo;

  const [pastas, areaDoAdvogado] = await Promise.all([carregarTodasAsPastas(), carregarAreasDasPessoas()]);
  const indice = montarIndice(pastas);
  for (let i = 0; i < fila.length && Date.now() < fim; i += 4) {
    const lote = await Promise.allSettled(
      fila.slice(i, i + 4).map(async (publicacao) => {
        const sugestao = await sugerir(publicacao, indice, areaDoAdvogado);
        if (!sugestao) return null;
        const { error: erroGravar } = await admin()
          .from("vistagem_publicacoes")
          .update({ sugestao_triagem: sugestao })
          .eq("id", publicacao.id)
          .eq("status", "triagem_pendente");
        if (erroGravar) throw new Error(erroGravar.message);
        return sugestao;
      })
    );
    for (const item of lote) {
      if (item.status === "rejected") {
        resumo.erros += 1;
        console.error("[vistagem] sugestão de pasta:", item.reason instanceof Error ? item.reason.message : item.reason);
      } else if (item.value) {
        resumo.geradas += 1;
        resumo.custoUS += item.value.custoUS ?? 0;
        if (item.value.origem === "numero") resumo.porNumero += 1;
        else if (item.value.origem === "parte") resumo.porParte += 1;
        else resumo.porIa += 1;
      }
    }
  }
  return resumo;
}
