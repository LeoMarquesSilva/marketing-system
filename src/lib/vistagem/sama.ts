import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chaveNome, classeDasEtiquetas, type EtapaVios, type OpcaoVios } from "./agendamento";
import { VistagemError } from "./errors";
import { cisDoResultado, tarefasViosDoResultado, type LinhaFilaSama, type ModoAgendamento, type TarefaNoVios } from "./fila-vios";
import type { BaseDaData, ResponsabilidadeDoTipo, TipoNaArvore } from "./fluxo-vios";
import type { MateriaVios, SintesePedida } from "./types";

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
 * "Atualizar Síntese" tem chave própria: o robô só acrescenta no editor do VIOS, sem gravar, até
 * VISTAGEM_SINTESE_MODO=real (e o envio das tarefas também estar em real).
 */
export function sinteseSimulada(): boolean {
  return envioSimulado() || process.env.VISTAGEM_SINTESE_MODO?.trim().toLowerCase() !== "real";
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
/** Etiquetas e responsáveis fixos de cada tipo de tarefa do VIOS. */
interface DadosDoTipo {
  etiquetas: number[];
  responsaveis: string[];
}

let cacheEtiquetas: { carregadoEm: number; etiquetas: Map<string, DadosDoTipo> } | null = null;
const CACHE_MS = 10 * 60 * 1000;

/** Etiquetas (ids) e responsáveis fixos de cada tipo de tarefa do VIOS, por id do tipo. */
async function carregarEtiquetasDosTipos(): Promise<Map<string, DadosDoTipo>> {
  if (cacheEtiquetas && Date.now() - cacheEtiquetas.carregadoEm < CACHE_MS) return cacheEtiquetas.etiquetas;
  type LinhaTipo = { etapa_id: number; etiquetas: number[] | null; responsaveis?: string[] | null };
  let { data, error } = await sama().from("vios_tipos_tarefa").select("etapa_id, etiquetas, responsaveis").limit(5000).returns<LinhaTipo[]>();
  if (error && /responsaveis/.test(error.message)) {
    // SAMA ainda sem a coluna (migração 20261028000010 do sama-rpa): segue sem os responsáveis fixos.
    ({ data, error } = await sama().from("vios_tipos_tarefa").select("etapa_id, etiquetas").limit(5000).returns<LinhaTipo[]>());
  }
  if (error) throw new VistagemError(`Falha ao carregar as etiquetas dos tipos de tarefa do VIOS no SAMA: ${error.message}`, 502);
  if (!data?.length) throw new VistagemError("As etiquetas dos tipos de tarefa do VIOS no SAMA (vios_tipos_tarefa) estão vazias.", 502);
  const etiquetas = new Map(
    data.map((row) => [
      String(row.etapa_id),
      {
        etiquetas: ((row.etiquetas ?? []) as number[]).map(Number),
        responsaveis: (row.responsaveis ?? []).filter(Boolean),
      },
    ])
  );
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
      .map((etapa) => {
        const tipo = etiquetasPorTipo.get(String(etapa.id));
        return { id: String(etapa.id), nome: etapa.nome, etiquetas: tipo?.etiquetas ?? [], responsaveis: tipo?.responsaveis ?? [] };
      }),
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
  const colunas = "etapa_id, nome, prazo, cria_na_criacao, cria_na_conclusao";
  // Regras de data do fluxo (SAMA 0059); sem as colunas ainda, a árvore vem sem elas e as datas usam a conta antiga.
  const comRegras = await sama()
    .from("vios_fluxos_tarefas")
    .select(`${colunas}, prazo_dias, prazo_negativo, prazo_corridos, regras_criacao`)
    .limit(5000);
  const { data, error } = comRegras.error ? await sama().from("vios_fluxos_tarefas").select(colunas).limit(5000) : comRegras;
  if (error) throw new VistagemError(`Falha ao carregar o fluxo de tarefas do VIOS no SAMA: ${error.message}`, 502);
  if (!data?.length) throw new VistagemError("O fluxo de tarefas do VIOS no SAMA está vazio.", 502);
  // A classe de cada tipo (pelas etiquetas) dá a cor no fluxo; sem ela, a tela cai na lista da área.
  const [responsabilidades, etiquetasPorTipo] = await Promise.all([
    responsabilidadesDosTipos(),
    carregarEtiquetasDosTipos().catch((erro: unknown) => {
      console.error("[vistagem] etiquetas dos tipos para o fluxo:", erro instanceof Error ? erro.message : erro);
      return new Map<string, DadosDoTipo>();
    }),
  ]);
  const arvore = new Map<number, TipoNaArvore>(
    (data as Record<string, unknown>[]).map((row) => {
      const regras = Array.isArray(row.regras_criacao) ? (row.regras_criacao as { id?: unknown; base?: unknown }[]) : null;
      return [
        Number(row.etapa_id),
        {
          nome: row.nome as string,
          prazo: (row.prazo as string | null) ?? null,
          criacao: ((row.cria_na_criacao ?? []) as number[]).map(Number),
          conclusao: ((row.cria_na_conclusao ?? []) as number[]).map(Number),
          regraPrazo:
            typeof row.prazo_dias === "number"
              ? { dias: row.prazo_dias, negativo: row.prazo_negativo === true, corridos: row.prazo_corridos === true }
              : null,
          baseDasFilhas: regras
            ? new Map(
                regras
                  .filter((regra) => Number(regra.id) > 0)
                  .map((regra) => [Number(regra.id), (["atual", "pai", "pai_base"].includes(String(regra.base)) ? regra.base : "outro") as BaseDaData])
              )
            : null,
          responsabilidade: responsabilidades.get(Number(row.etapa_id)) ?? null,
          classe: classeDasEtiquetas(etiquetasPorTipo.get(String(row.etapa_id))?.etiquetas ?? []),
        },
      ];
    })
  );
  cacheArvore = { carregadoEm: Date.now(), arvore };
  return arvore;
}

/**
 * Quem o VIOS põe em cada tipo de tarefa (Cadastro do tipo › Responsabilidade), lido pelo catálogo do robô: os fixos
 * (vios_tipos_tarefa.responsaveis) e as marcações (regras_responsabilidade, SAMA 0060). Sem a coluna nova, só os fixos;
 * se a consulta falhar, nenhum (a previsão volta a pôr o responsável da vistagem).
 */
async function responsabilidadesDosTipos(): Promise<Map<number, ResponsabilidadeDoTipo>> {
  const mapa = new Map<number, ResponsabilidadeDoTipo>();
  const comRegras = await sama().from("vios_tipos_tarefa").select("etapa_id, responsaveis, regras_responsabilidade").limit(5000);
  const { data, error } = comRegras.error ? await sama().from("vios_tipos_tarefa").select("etapa_id, responsaveis").limit(5000) : comRegras;
  if (error) {
    console.error("[vistagem] responsáveis dos tipos de tarefa no SAMA:", error.message);
    return mapa;
  }
  const marcado = (valor: Record<string, unknown>, chave: string) => valor[chave] === true;
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    if (!Array.isArray(row.responsaveis)) continue;
    const regras = row.regras_responsabilidade && typeof row.regras_responsabilidade === "object" ? (row.regras_responsabilidade as Record<string, unknown>) : null;
    mapa.set(Number(row.etapa_id), {
      fixos: (row.responsaveis as unknown[]).map(String).filter(Boolean),
      regras: regras
        ? {
            advogado: marcado(regras, "advogado"),
            auxiliar: marcado(regras, "auxiliar"),
            estagiario: marcado(regras, "estagiario"),
            coordenador: marcado(regras, "coordenador"),
            grupo: marcado(regras, "grupo"),
          }
        : null,
    });
  }
  return mapa;
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

/**
 * Pede ao robô para acrescentar um parágrafo à síntese da pasta no VIOS ("dd/mm/aaaa (Nome): texto").
 * É a última prioridade da fila: a reserva do SAMA só manda quando não há outro trabalho para o robô.
 */
export async function enfileirarSintese(pedido: {
  ci: string;
  cnj: string | null;
  texto: string;
  autor: string;
  data: string;
  simular: boolean;
  materias: MateriaVios[];
}): Promise<string> {
  const { data, error } = await sama()
    .from("vios_agendamentos")
    .insert({
      operacao: "sintese",
      status: "pendente",
      tipo: "SÍNTESE",
      tarefa: "Acrescentar à síntese do processo",
      observacao: pedido.texto,
      responsavel: pedido.autor,
      data: pedido.data,
      pasta: pedido.cnj || pedido.ci,
      pasta_tipo: "Processo",
      ci_pasta: pedido.ci,
      simular: pedido.simular,
      ...(pedido.materias.length ? { materias: pedido.materias } : {}),
    })
    .select("id")
    .single();
  if (error || !data) throw new VistagemError(`Falha ao colocar a síntese na fila do robô: ${error?.message ?? "sem retorno"}`, 502);
  return data.id as string;
}

/** Sínteses pedidas para a pasta, da mais nova para a mais antiga. */
export async function sintesesDaPasta(ci: string): Promise<SintesePedida[]> {
  const colunas = "id, observacao, responsavel, data, status, erro, simular, resultado, criado_em";
  const consulta = (selecao: string) =>
    sama()
      .from("vios_agendamentos")
      .select(selecao)
      .eq("operacao", "sintese")
      .eq("ci_pasta", ci.replace(/\D/g, ""))
      .order("criado_em", { ascending: false })
      .limit(10);
  // Coluna da migração 20261109000012 do sama-rpa; sem ela ainda, a lista vem sem as matérias.
  const comMaterias = await consulta(`${colunas}, materias`);
  const { data, error } = comMaterias.error ? await consulta(colunas) : comMaterias;
  if (error) throw new VistagemError(`Falha ao consultar as sínteses pedidas ao robô: ${error.message}`, 502);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    texto: row.observacao as string,
    autor: (row.responsavel as string | null) ?? null,
    data: row.data as string,
    status: row.status as SintesePedida["status"],
    erro: (row.erro as string | null) ?? null,
    simulado: row.simular === true,
    jaEstava: (row.resultado as { ja_estava?: boolean } | null)?.ja_estava === true,
    materias: Array.isArray(row.materias) ? (row.materias as MateriaVios[]) : [],
    criadoEm: row.criado_em as string,
  }));
}

let cacheMaterias: { carregadoEm: number; materias: MateriaVios[] } | null = null;

/** Opções do campo Matéria do VIOS (o mesmo combo do cadastro), na ordem dele. O robô relê a lista a cada catálogo. */
export async function carregarMateriasVios(): Promise<MateriaVios[]> {
  if (cacheMaterias && Date.now() - cacheMaterias.carregadoEm < CACHE_MS) return cacheMaterias.materias;
  const { data, error } = await sama().from("vios_materias").select("id, nome").order("ordem").limit(2000);
  if (error) throw new VistagemError(`Falha ao carregar as matérias do VIOS no SAMA: ${error.message}`, 502);
  const materias = (data ?? []) as MateriaVios[];
  if (materias.length) cacheMaterias = { carregadoEm: Date.now(), materias };
  return materias;
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
