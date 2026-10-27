import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chaveNome, type EtapaVios, type OpcaoVios } from "./agendamento";
import { VistagemError } from "./errors";
import { cisDoResultado, tarefasViosDoResultado, type LinhaFilaSama, type ModoAgendamento, type TarefaNoVios } from "./fila-vios";
import type { TipoNaArvore } from "./fluxo-vios";

/**
 * Integração com o SAMA: catálogo de tarefas/usuários do VIOS por área
 * (vios_catalogo_tarefas) com a etiqueta de cada tipo (vios_tipos_tarefa), ambos
 * relidos do VIOS pelo robô todo domingo à noite, e a fila vios_agendamentos que o
 * sama-rpa consome a cada 2 minutos para criar a tarefa no VIOS.
 */
function sama(): SupabaseClient {
  const url = process.env.SAMA_SUPABASE_URL?.trim();
  const key = process.env.SAMA_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new VistagemError("SAMA não configurado (SAMA_SUPABASE_URL/SAMA_SUPABASE_SERVICE_ROLE_KEY).", 500);
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Enquanto a vistagem roda em paralelo ao processo manual, o robô só preenche a
 * tarefa no VIOS sem gravar. VISTAGEM_RPA_MODO=real libera a gravação.
 */
export function envioSimulado(): boolean {
  return process.env.VISTAGEM_RPA_MODO?.trim().toLowerCase() !== "real";
}

/**
 * VISTAGEM_AGENDAMENTO=intimacao: o robô lança as tarefas na publicação (Intimações do
 * VIOS). Sem ela, cria dentro da pasta, como antes — só ligue depois de implantar o
 * sama-rpa que entende a coluna `lancamento`.
 */
export function modoAgendamento(): ModoAgendamento {
  return process.env.VISTAGEM_AGENDAMENTO?.trim().toLowerCase() === "intimacao" ? "intimacao" : "pasta";
}

export interface CatalogoArea {
  area: string;
  etapas: EtapaVios[];
  usuarios: OpcaoVios[];
  atualizadoEm: string;
}

let cacheCatalogo: { carregadoEm: number; areas: CatalogoArea[] } | null = null;
let cacheEtiquetas: { carregadoEm: number; etiquetas: Map<string, number[]> } | null = null;
const CACHE_MS = 10 * 60 * 1000;

/** Etiquetas de cada tipo de tarefa do VIOS (ids), por id do tipo. */
async function carregarEtiquetasDosTipos(): Promise<Map<string, number[]>> {
  if (cacheEtiquetas && Date.now() - cacheEtiquetas.carregadoEm < CACHE_MS) return cacheEtiquetas.etiquetas;
  const { data, error } = await sama().from("vios_tipos_tarefa").select("etapa_id, etiquetas").limit(5000);
  if (error) throw new VistagemError(`Falha ao carregar as etiquetas dos tipos de tarefa do VIOS no SAMA: ${error.message}`, 502);
  if (!data?.length) throw new VistagemError("As etiquetas dos tipos de tarefa do VIOS no SAMA (vios_tipos_tarefa) estão vazias.", 502);
  const etiquetas = new Map(data.map((row) => [String(row.etapa_id), ((row.etiquetas ?? []) as number[]).map(Number)]));
  cacheEtiquetas = { carregadoEm: Date.now(), etiquetas };
  return etiquetas;
}

/** Catálogo das pastas de Processo, por área (tarefas que o VIOS aceita, com as etiquetas, e usuários). */
export async function carregarCatalogoProcessos(): Promise<CatalogoArea[]> {
  if (cacheCatalogo && Date.now() - cacheCatalogo.carregadoEm < CACHE_MS) return cacheCatalogo.areas;
  const [{ data, error }, etiquetasPorTipo] = await Promise.all([
    sama().from("vios_catalogo_tarefas").select("area, etapas, usuarios, atualizado_em").eq("pasta_tipo", "Processo"),
    carregarEtiquetasDosTipos(),
  ]);
  if (error) throw new VistagemError(`Falha ao carregar o catálogo de tarefas do SAMA: ${error.message}`, 502);
  const areas = (data ?? []).map((row) => ({
    area: row.area as string,
    etapas: ((row.etapas ?? []) as OpcaoVios[])
      .filter((etapa) => etapa?.id && etapa?.nome)
      .map((etapa) => ({ id: String(etapa.id), nome: etapa.nome, etiquetas: etiquetasPorTipo.get(String(etapa.id)) ?? [] })),
    // o usuário do robô não é responsável de tarefa
    usuarios: ((row.usuarios ?? []) as OpcaoVios[])
      .filter((usuario) => usuario?.id && usuario?.nome && !/f[eê]nix agendador/i.test(usuario.nome))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    atualizadoEm: row.atualizado_em as string,
  }));
  // Com a chave pública o RLS do SAMA devolve a lista vazia, sem erro.
  if (!areas.length) {
    throw new VistagemError(
      "O catálogo de tarefas do SAMA veio vazio. Confira se SAMA_SUPABASE_SERVICE_ROLE_KEY é a chave service_role do projeto SAMA (a chave pública não enxerga o catálogo).",
      502
    );
  }
  cacheCatalogo = { carregadoEm: Date.now(), areas };
  return areas;
}

let cacheArvore: { carregadoEm: number; arvore: Map<number, TipoNaArvore> } | null = null;

/** Árvore de tarefas do VIOS (o que cada tipo cria sozinho), por id do tipo de tarefa. */
export async function carregarArvoreVios(): Promise<Map<number, TipoNaArvore>> {
  if (cacheArvore && Date.now() - cacheArvore.carregadoEm < CACHE_MS) return cacheArvore.arvore;
  const { data, error } = await sama()
    .from("vios_fluxos_tarefas")
    .select("etapa_id, nome, prazo, cria_na_criacao, cria_na_conclusao")
    .limit(5000);
  if (error) throw new VistagemError(`Falha ao carregar o fluxo de tarefas do VIOS no SAMA: ${error.message}`, 502);
  if (!data?.length) throw new VistagemError("O fluxo de tarefas do VIOS no SAMA está vazio.", 502);
  const arvore = new Map<number, TipoNaArvore>(
    data.map((row) => [
      Number(row.etapa_id),
      {
        nome: row.nome as string,
        prazo: (row.prazo as string | null) ?? null,
        criacao: ((row.cria_na_criacao ?? []) as number[]).map(Number),
        conclusao: ((row.cria_na_conclusao ?? []) as number[]).map(Number),
      },
    ])
  );
  cacheArvore = { carregadoEm: Date.now(), arvore };
  return arvore;
}

export function catalogoDaArea(areas: CatalogoArea[], area: string | null): CatalogoArea | null {
  if (!area) return null;
  return areas.find((item) => chaveNome(item.area) === chaveNome(area)) ?? null;
}

/** Coloca cada linha na fila do robô; devolve os ids na mesma ordem. */
export async function enfileirarNoSama(linhas: LinhaFilaSama[]): Promise<string[]> {
  const db = sama();
  const ids: string[] = [];
  for (const linha of linhas) {
    const { data, error } = await db
      .from("vios_agendamentos")
      .insert({ ...linha, status: "pendente", operacao: "criar" })
      .select("id")
      .single();
    if (error || !data) throw new VistagemError(`Falha ao colocar a tarefa na fila do robô: ${error?.message ?? "sem retorno"}`, 502);
    ids.push(data.id as string);
  }
  return ids;
}

export interface StatusFilaSama {
  status: "pendente" | "enviado" | "processando" | "concluido" | "erro";
  erro: string | null;
  viosTarefaId: string | null;
  /** Lançamento pela intimação: CI de cada tarefa, por id do agendamento. */
  cisPorAgendamento: Map<string, string>;
  /** Como as tarefas ficaram no VIOS (a pedida e as do fluxo), por id do agendamento. */
  tarefasViosPorAgendamento: Map<string, TarefaNoVios[]>;
}

export async function consultarFilaSama(ids: string[]): Promise<Map<string, StatusFilaSama>> {
  const resultado = new Map<string, StatusFilaSama>();
  if (!ids.length) return resultado;
  const db = sama();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from("vios_agendamentos").select("id, status, erro, resultado").in("id", ids.slice(i, i + 100));
    if (error) throw new VistagemError(`Falha ao consultar a fila do robô: ${error.message}`, 502);
    for (const row of data ?? []) {
      const ciVios = (row.resultado as { ci_vios?: string | number } | null)?.ci_vios;
      resultado.set(row.id as string, {
        status: row.status as StatusFilaSama["status"],
        erro: (row.erro as string | null) ?? null,
        viosTarefaId: ciVios ? String(ciVios) : null,
        cisPorAgendamento: cisDoResultado(row.resultado),
        tarefasViosPorAgendamento: tarefasViosDoResultado(row.resultado),
      });
    }
  }
  return resultado;
}

/** Verificação de conexão (aba Conferência e diagnóstico pós-deploy). */
export async function verificarSama(): Promise<{ ok: boolean; detalhe: string }> {
  try {
    const areas = await carregarCatalogoProcessos();
    const { error } = await sama().from("vios_agendamentos").select("id", { count: "exact", head: true });
    if (error) return { ok: false, detalhe: `Fila do robô inacessível: ${error.message}` };
    const projeto = new URL(process.env.SAMA_SUPABASE_URL ?? "").hostname.split(".")[0];
    return { ok: true, detalhe: `${areas.length} áreas no catálogo do VIOS (projeto ${projeto})` };
  } catch (erro) {
    return { ok: false, detalhe: erro instanceof Error ? erro.message : String(erro) };
  }
}
