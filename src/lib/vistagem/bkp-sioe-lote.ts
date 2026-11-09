import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COLUNAS_DO_BKP,
  diaDaImportacao,
  linhaDoBkp,
  publicacaoParaBkp,
  type InconsistenciaParaBkp,
  type LinhaBkp,
  type LinhaDaVistagem,
} from "./bkp-sioe";

/**
 * Monta e grava as linhas do BKP em lote, com os clientes recebidos: quem usa é o servidor (ganchos e repasse do cron)
 * e o script de preenchimento, que não pode importar módulos server-only.
 */
export type LinhaParaGravar = LinhaBkp & { orquestra_id: string };

const STATUS_QUE_FECHAM = ["checado", "abertura_pasta", "duplicidade", "descartada"];

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  return Array.from({ length: Math.ceil(itens.length / tamanho) }, (_, i) => itens.slice(i * tamanho, (i + 1) * tamanho));
}

function falhou(contexto: string, erro: { message: string }): never {
  throw new Error(`${contexto}: ${erro.message}`);
}

/** Publicações pelos ids, com o select do BKP. */
export async function publicacoesPorIds(orquestra: SupabaseClient, ids: string[]): Promise<LinhaDaVistagem[]> {
  const linhas: LinhaDaVistagem[] = [];
  for (const lote of emLotes(ids, 200)) {
    const { data, error } = await orquestra.from("vistagem_publicacoes").select(COLUNAS_DO_BKP).in("id", lote);
    if (error) falhou("publicações", error);
    linhas.push(...(data as unknown as LinhaDaVistagem[]));
  }
  return linhas;
}

/** Publicações em status final importadas a partir do dia (AAAA-MM-DD); pagina porque o Supabase devolve no máximo 1.000. */
export async function publicacoesFechadasDesde(orquestra: SupabaseClient, dia: string): Promise<LinhaDaVistagem[]> {
  const folga = new Date(Date.parse(`${dia}T00:00:00Z`) - 3 * 86_400_000).toISOString();
  const linhas: LinhaDaVistagem[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await orquestra
      .from("vistagem_publicacoes")
      .select(COLUNAS_DO_BKP)
      .in("status", STATUS_QUE_FECHAM)
      .gte("created_at", folga)
      .order("id")
      .range(de, de + 999);
    if (error) falhou("publicações fechadas", error);
    linhas.push(...(data as unknown as LinhaDaVistagem[]));
    if ((data ?? []).length < 1000) break;
  }
  return linhas.filter((row) => diaDaImportacao(row) >= dia);
}

/** Feriados de sp_feriados (os mesmos que o sync do SIOE usa no vistado D+1). */
export async function feriadosDoSioe(sioe: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await sioe.from("sp_feriados").select("data").limit(5000);
  if (error) falhou("feriados do SIOE", error);
  return new Set((data ?? []).map((row: { data: string }) => String(row.data).slice(0, 10)));
}

/** Linhas do BKP das publicações que fecharam a esteira; as outras ficam de fora. */
export async function montarLinhasDoBkp(orquestra: SupabaseClient, publicacoes: LinhaDaVistagem[], feriados: Set<string>): Promise<LinhaParaGravar[]> {
  // A duplicada não tem pasta: segue a corrente até a publicação que tem (até 5 níveis).
  const porId = new Map(publicacoes.map((row) => [row.id, row]));
  const semPasta = (row: LinhaDaVistagem) => row.status === "duplicidade" && !row.pasta_ci && Boolean(row.duplicidade_de);
  for (let nivel = 0; nivel < 5; nivel++) {
    const faltam = [...new Set([...porId.values()].filter((row) => semPasta(row) && !porId.has(row.duplicidade_de as string)).map((row) => row.duplicidade_de as string))];
    if (!faltam.length) break;
    for (const row of await publicacoesPorIds(orquestra, faltam)) porId.set(row.id, row);
  }
  const originalDe = (row: LinhaDaVistagem): LinhaDaVistagem | null => {
    let atual = row;
    for (let i = 0; i < 5 && semPasta(atual); i++) {
      const proxima = porId.get(atual.duplicidade_de as string);
      if (!proxima) return null;
      atual = proxima;
    }
    return atual === row ? null : atual;
  };

  const ids = publicacoes.map((row) => row.id);
  const agendamentos = new Map<string, { etiqueta: string; tarefa: string }[]>();
  const inconsistencias = new Map<string, InconsistenciaParaBkp[]>();
  for (const lote of emLotes(ids, 200)) {
    const [tarefas, erros] = await Promise.all([
      orquestra.from("vistagem_agendamentos").select("publicacao_id, etiqueta, tarefa").in("publicacao_id", lote),
      orquestra.from("vistagem_inconsistencias").select("publicacao_id, origem, tipo, subtipo, descricao, criado_em").in("publicacao_id", lote).is("excluida_em", null),
    ]);
    if (tarefas.error) falhou("tarefas", tarefas.error);
    if (erros.error) falhou("inconsistências", erros.error);
    for (const row of tarefas.data ?? []) agendamentos.set(row.publicacao_id, [...(agendamentos.get(row.publicacao_id) ?? []), row]);
    for (const row of erros.data ?? []) {
      const item: InconsistenciaParaBkp = {
        origem: row.origem === "juridico" ? "juridico" : "agendamento",
        tipo: row.tipo,
        subtipo: row.subtipo,
        descricao: row.descricao,
        criadoEm: row.criado_em,
      };
      inconsistencias.set(row.publicacao_id, [...(inconsistencias.get(row.publicacao_id) ?? []), item]);
    }
  }

  const idsPessoas = [...new Set(publicacoes.flatMap((row) => [row.vistado_por, row.conferido_por, row.duplicidade_revisada_por]).filter(Boolean) as string[])];
  const nomes = new Map<string, string>();
  for (const lote of emLotes(idsPessoas, 200)) {
    const { data, error } = await orquestra.from("users").select("auth_id, name").in("auth_id", lote);
    if (error) falhou("nomes", error);
    for (const row of (data ?? []) as { auth_id: string; name: string | null }[]) nomes.set(row.auth_id, row.name ?? "");
  }

  const linhas: LinhaParaGravar[] = [];
  for (const row of publicacoes) {
    const publicacao = publicacaoParaBkp(row, (id) => (id ? nomes.get(id) || null : null), originalDe(row));
    if (!publicacao) continue;
    linhas.push({ ...linhaDoBkp(publicacao, agendamentos.get(row.id) ?? [], inconsistencias.get(row.id) ?? [], feriados), orquestra_id: row.id });
  }
  return linhas;
}

/** Quantas destas publicações ainda não estão no BKP do SIOE. */
export async function quantasFaltamNoBkp(sioe: SupabaseClient, linhas: LinhaParaGravar[]): Promise<number> {
  const gravadas = new Set<string>();
  for (const lote of emLotes(linhas.map((linha) => linha.orquestra_id), 200)) {
    const { data, error } = await sioe.from("sp_publicacoes").select("orquestra_id").in("orquestra_id", lote);
    if (error) falhou("conferir o BKP do SIOE", error);
    for (const row of (data ?? []) as { orquestra_id: string }[]) gravadas.add(row.orquestra_id);
  }
  return linhas.filter((linha) => !gravadas.has(linha.orquestra_id)).length;
}

/** Grava ou atualiza pelo id do Orquestra: rodar de novo não duplica, e o sp_id é o que o SIOE gerou na primeira vez. */
export async function gravarNoBkp(sioe: SupabaseClient, linhas: LinhaParaGravar[]): Promise<void> {
  for (const lote of emLotes(linhas, 100)) {
    const { error } = await sioe.from("sp_publicacoes").upsert(lote.map((linha) => ({ ...linha, origem: "orquestra" })), { onConflict: "orquestra_id" });
    if (error) falhou("gravar no BKP do SIOE", error);
  }
}
