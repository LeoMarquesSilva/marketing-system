import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { openAIKey } from "@/lib/openai-keys";
import { OPENAI_DEFAULT_MODEL, isOpenAIReasoningModel } from "@/lib/openai-models";
import { chaveNome, type EtiquetaAgendamento, type OpcaoTarefa } from "./agendamento";
import type { ContagemPrazo } from "./dias-uteis";
import { CLASSIFICACOES_ESOCIAL, ESOCIAL_PADRAO } from "./esocial";
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
import { lerConfiguracoes } from "./configuracoes-server";
import { registrarSugestaoDaIa } from "./ia-registro-server";
import { admin, falhou } from "./server";
import {
  PRAZO_DE,
  areaComSugestaoIa,
  costumesDaArea,
  custoDaChamada,
  ehAreaTrabalhista,
  ehOperacoesLegais,
  entradaDaSugestao,
  esocialDaResposta,
  instrucoesDaSugestao,
  secaoDoHistorico,
  tarefasDaResposta,
  trechoDecisivo,
  type SugestaoIa,
  type TarefaDoHistorico,
} from "./sugestao-ia";

// A ordem conta: a IA decide de quem é o prazo antes de escolher as tarefas.
const RESPOSTA = z.object({
  resumo: z.string(),
  prazo_de: z.enum(PRAZO_DE),
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

/** Status de publicação já vistada pelo jurídico: de onde vem o costume da área. */
const STATUS_VISTADA = ["controladoria_vistar", "pronto_para_agendar", "agendado", "checado", "revisar", "abertura_pasta"];
/** Janela do costume: as vistagens dos últimos 60 dias. */
const JANELA_HISTORICO_MS = 60 * 24 * 60 * 60 * 1000;
/** O costume muda devagar; 6 h de cache mantém as instruções iguais e a OpenAI aproveita o cache dela. */
const VALIDADE_HISTORICO_MS = 6 * 60 * 60 * 1000;
const cacheHistorico = new Map<string, { em: number; texto: Promise<string | null> }>();

type LinhaDoHistorico = {
  publicacao_id: string;
  tarefa: string | null;
  etiqueta: EtiquetaAgendamento;
  dias_prazo: number | null;
  contagem_prazo: ContagemPrazo | null;
  vistagem_publicacoes:
    | { escritorio_responsavel: string | null; vistado_em: string | null; processo_digitos: string | null }
    | { escritorio_responsavel: string | null; vistado_em: string | null; processo_digitos: string | null }[]
    | null;
};

/**
 * O costume do escritório na área (escritório da publicação): as tarefas que os advogados agendaram nas vistagens dos
 * últimos 60 dias, com trechos das publicações. É assim que a IA aprende com o que o jurídico fez. `ate` e
 * `excluirProcesso` são do teste às cegas: só o que veio antes e sem o próprio processo (sem cache).
 */
export async function historicoDaArea(
  escritorio: string | null,
  { ate, excluirProcesso }: { ate?: string; excluirProcesso?: string | null } = {}
): Promise<string | null> {
  if (!escritorio) return null;
  const teste = Boolean(ate || excluirProcesso);
  const guardado = cacheHistorico.get(escritorio);
  if (!teste && guardado && Date.now() - guardado.em < VALIDADE_HISTORICO_MS) return guardado.texto;
  // O cron pede 4 sugestões da mesma área de uma vez: todas esperam a mesma leitura.
  const texto = montarHistorico(escritorio, { ate, excluirProcesso });
  if (!teste) {
    cacheHistorico.set(escritorio, { em: Date.now(), texto });
    texto.catch(() => cacheHistorico.delete(escritorio));
  }
  return texto;
}

async function montarHistorico(escritorio: string, { ate, excluirProcesso }: { ate?: string; excluirProcesso?: string | null }): Promise<string | null> {
  const db = admin();
  let consulta = db
    .from("vistagem_agendamentos")
    .select(
      "publicacao_id, tarefa, etiqueta, dias_prazo, contagem_prazo, vistagem_publicacoes!inner(escritorio_responsavel, status, vistado_em, data_publicacao, processo_digitos)"
    )
    .eq("vistagem_publicacoes.escritorio_responsavel", escritorio)
    .in("vistagem_publicacoes.status", STATUS_VISTADA)
    .gte("vistagem_publicacoes.vistado_em", new Date(Date.now() - JANELA_HISTORICO_MS).toISOString())
    .limit(5000);
  if (ate) consulta = consulta.lt("vistagem_publicacoes.data_publicacao", ate);
  const { data, error } = await consulta;
  if (error) falhou("carregar o histórico de vistagens da área", error);
  const linhas: TarefaDoHistorico[] = ((data ?? []) as unknown as LinhaDoHistorico[]).flatMap((linha) => {
    const publicacao = Array.isArray(linha.vistagem_publicacoes) ? linha.vistagem_publicacoes[0] : linha.vistagem_publicacoes;
    if (!linha.tarefa || (excluirProcesso && publicacao?.processo_digitos === excluirProcesso)) return [];
    return [
      {
        publicacaoId: linha.publicacao_id,
        tarefa: linha.tarefa,
        classe: linha.etiqueta,
        dias: linha.dias_prazo,
        contagem: linha.contagem_prazo,
        em: publicacao?.vistado_em ?? "",
      },
    ];
  });
  const costumes = costumesDaArea(linhas);
  const ids = [...new Set(costumes.flatMap((costume) => costume.publicacoes))];
  const trechos = new Map<string, string>();
  if (ids.length) {
    const { data: teores, error: erroTeor } = await db.from("vistagem_publicacoes").select("id, teor").in("id", ids);
    if (erroTeor) falhou("carregar os exemplos do histórico", erroTeor);
    for (const item of (teores ?? []) as { id: string; teor: string | null }[]) if (item.teor) trechos.set(item.id, trechoDecisivo(item.teor));
  }
  return secaoDoHistorico(costumes, trechos);
}

/**
 * Pede à OpenAI as tarefas da publicação, escolhidas só da lista do VIOS da área, com as instruções da área (Trabalhista,
 * CPC ou Operações Legais) e o costume do escritório. Fora do Trabalhista não há eSocial.
 */
export async function pedirSugestao(
  publicacao: PublicacaoComArea,
  catalogo: { area: string; tarefas: Record<EtiquetaAgendamento, OpcaoTarefa[]> },
  historico: string | null
): Promise<{ sugestao: SugestaoIa; instrucoes: string }> {
  const apiKey = openAIKey("analisePublicacao");
  if (!apiKey) throw new VistagemError("A chave da OpenAI não está configurada.", 503);
  const modelo = OPENAI_DEFAULT_MODEL;
  const opsLegais = ehOperacoesLegais(publicacao.escritorio_responsavel);
  const trabalhista = ehAreaTrabalhista(catalogo.area, publicacao.escritorio_responsavel);
  const listas = catalogo.tarefas;
  const chaveDaArea = chaveNome(opsLegais ? "Operações Legais" : catalogo.area).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const instrucoes = instrucoesDaSugestao(listas, { area: catalogo.area, escritorio: publicacao.escritorio_responsavel, historico });
  // modelos de raciocínio recusam temperature; nos outros, 0 para a resposta variar pouco
  const raciocinio = isOpenAIReasoningModel(modelo);
  const { object, usage } = await generateObject({
    model: createOpenAI({ apiKey })(modelo),
    schema: RESPOSTA,
    schemaName: trabalhista ? "vistagem_trabalhista" : "vistagem_por_area",
    system: instrucoes,
    prompt: entradaDaSugestao({
      dataPublicacao: publicacao.data_publicacao,
      tribunal: publicacao.tribunal,
      orgao: publicacao.djen_orgao,
      tipoComunicacao: publicacao.djen_tipo_comunicacao,
      cliente: publicacao.cliente,
      partes: publicacao.djen_partes ?? [],
      teor: publicacao.teor,
    }),
    temperature: raciocinio ? undefined : 0,
    providerOptions: {
      // instruções e lista são iguais para todas as publicações da área: a chave ajuda a OpenAI a usar o cache
      openai: {
        ...(raciocinio ? { reasoningEffort: "low" as const } : {}),
        promptCacheKey: trabalhista ? "vistagem-trabalhista" : `vistagem-${chaveDaArea}`,
        store: false,
      },
    },
  });
  const sugestao: SugestaoIa = {
    resumo: object.resumo.trim(),
    tarefas: tarefasDaResposta(object, listas, { trabalhista }),
    esocial: trabalhista ? esocialDaResposta(object.esocial) : ESOCIAL_PADRAO,
    confianca: object.confianca,
    parteContraria: object.prazo_de === "parte_contraria",
    prazoDe: object.prazo_de,
    modelo,
    geradaEm: new Date().toISOString(),
    custoUS: custoDaChamada({
      entrada: usage.inputTokens ?? 0,
      cache: usage.inputTokenDetails?.cacheReadTokens ?? 0,
      saida: usage.outputTokens ?? 0,
    }),
  };
  return { sugestao, instrucoes };
}

/** Grava a sugestão na publicação e, no registro da IA, o que ela leu e sugeriu. */
async function gravarSugestao(publicacao: PublicacaoComArea, area: string, pedido: { sugestao: SugestaoIa; instrucoes: string }): Promise<void> {
  const { error } = await admin()
    .from("vistagem_publicacoes")
    .update({ sugestao_ia: pedido.sugestao, sugestao_ia_em: pedido.sugestao.geradaEm })
    .eq("id", publicacao.id)
    .eq("status", "juridico_vistar");
  if (error) falhou("gravar a sugestão da IA", error);
  await registrarSugestaoDaIa(publicacao, area, pedido.instrucoes, pedido.sugestao);
}

/** Sugestão da publicação para a tela do jurídico: a já gravada ou uma nova. */
export async function sugestaoDaPublicacao(id: string, areas: AreasVistagem = null, veRisco = true): Promise<SugestaoIa> {
  const publicacao = await carregarPublicacao(id);
  garantirArea(publicacao, areas, veRisco);
  if (publicacao.sugestao_ia) return publicacao.sugestao_ia;
  if (publicacao.status !== "juridico_vistar") throw new VistagemError("Esta publicação não está aguardando vistagem.", 409);
  const catalogo = catalogoParaPublicacao(await carregarCatalogoProcessos(), publicacao);
  if (!catalogo || !areaComSugestaoIa(catalogo.area)) {
    throw new VistagemError("A sugestão da IA não está disponível para esta área.", 422);
  }
  if (!(await lerConfiguracoes()).iaSugestaoTarefa) throw new VistagemError("A sugestão da IA está desligada nas configurações da Vistagem.", 422);
  const pedido = await pedirSugestao(publicacao, catalogo, await historicoDaArea(publicacao.escritorio_responsavel));
  await gravarSugestao(publicacao, catalogo.area, pedido);
  return pedido.sugestao;
}

/**
 * No cron da Kurier: gera as sugestões das publicações que ainda não têm (todas as áreas),
 * 4 por vez, até o tempo acabar (as que sobrarem a tela gera ao abrir).
 */
export async function gerarSugestoesPendentes(prazoMs: number): Promise<{ pendentes: number; geradas: number; erros: number; custoUS: number }> {
  // Desligada em Configurações: o cron não gera nada (as já geradas continuam na tela).
  if (!(await lerConfiguracoes()).iaSugestaoTarefa) return { pendentes: 0, geradas: 0, erros: 0, custoUS: 0 };
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
        const pedido = await pedirSugestao(publicacao, catalogo!, await historicoDaArea(publicacao.escritorio_responsavel));
        await gravarSugestao(publicacao, catalogo!.area, pedido);
        return pedido.sugestao.custoUS;
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
