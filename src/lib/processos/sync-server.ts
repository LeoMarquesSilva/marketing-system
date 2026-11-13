import "server-only";

import { randomUUID } from "node:crypto";
import { getSioeClient } from "@/lib/sioe-sync-server";
import { PROCESSOS_LISTA, SITE_CONTROLADORIA } from "@/lib/vistagem/pastas-vios";
import { baixarArquivoPorCaminho } from "@/lib/vistagem/sharepoint";
import { COLUNAS_PROCESSO, type ValorCampo, type Valores } from "./campos";
import { ProcessosError } from "./errors";
import { juntarFontes, lerCsvProcessos, lerEtiquetasSioe, registroDoSioe } from "./import-vios";
import { listarEnvios } from "./processos-server";
import { db, emLotes, falhou, gravacaoSimulada, type Ator } from "./server";
import { chaveDaParte, estaNoRecorte, lerRecorte, mesclarComVios, type Recorte } from "./sincronizacao";
import type { ExecucaoSync, ParteImportada, RegistroImportado, SituacaoImportacao } from "./types";

const ENVIOS_ABERTOS = ["pendente", "enviado", "erro"];
const LISTAS = ["etiquetas", "outros_numeros", "auxiliares"];
// Colunas de proc_processos que a sincronização grava (as do catálogo + o controle).
const GRAVAVEIS = new Set([...COLUNAS_PROCESSO, "vios_editado_em"]);

export interface ResultadoSync {
  lidos: number;
  noRecorte: number;
  criados: number;
  atualizados: number;
  confirmados: number;
  partesIncluidas: number;
  colunasIgnoradas: string[];
  avisos: string[];
}

/** O arquivo enviado pode estar em UTF-8 (salvo de novo) ou no windows-1252 original do VIOS. */
export function decodificarCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

async function carregarDoSioe(recorte: Recorte): Promise<Record<string, unknown>[]> {
  const sioe = getSioeClient();
  const linhas: Record<string, unknown>[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    let consulta = sioe.from("processos_completo").select("*").order("ci").range(inicio, inicio + 999);
    if (recorte.areas) consulta = consulta.in("area", recorte.areas);
    if (recorte.grupos) consulta = consulta.in("grupo_cliente", recorte.grupos);
    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    linhas.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

function soGravaveis(valores: Valores): Valores {
  const saida: Valores = {};
  for (const [chave, valor] of Object.entries(valores)) if (GRAVAVEIS.has(chave)) saida[chave] = valor;
  return saida;
}

/** Devedor de partida: quem está no polo oposto ao do cliente. Com o cliente como terceiro, alguém indica na ficha. */
function poloDoDevedor(poloCliente: ValorCampo | undefined): string | null {
  const texto = String(poloCliente ?? "").toLowerCase();
  if (texto.includes("ativa")) return "passivo";
  if (texto.includes("passiva")) return "ativo";
  return null;
}

async function incluirPartes(porProcesso: Map<string, { partes: ParteImportada[]; poloCliente: ValorCampo | undefined }>): Promise<number> {
  const ids = [...porProcesso.keys()];
  const existentes = new Map<string, Set<string>>();
  for (const lote of emLotes(ids, 100)) {
    const { data, error } = await db().from("proc_partes").select("processo_id, polo, pessoa:proc_pessoas(nome)").in("processo_id", lote).limit(20000);
    if (error) falhou("consultar as partes", error);
    for (const linha of (data ?? []) as unknown as { processo_id: string; polo: string; pessoa: { nome: string } | { nome: string }[] | null }[]) {
      const pessoa = Array.isArray(linha.pessoa) ? linha.pessoa[0] : linha.pessoa;
      if (!pessoa) continue;
      const chaves = existentes.get(linha.processo_id) ?? new Set<string>();
      chaves.add(chaveDaParte(linha.polo, pessoa.nome));
      existentes.set(linha.processo_id, chaves);
    }
  }
  const pessoas: Record<string, unknown>[] = [];
  const partes: Record<string, unknown>[] = [];
  for (const [processoId, { partes: importadas, poloCliente }] of porProcesso) {
    const chaves = existentes.get(processoId) ?? new Set<string>();
    const devedor = poloDoDevedor(poloCliente);
    importadas.forEach((parte, ordem) => {
      const chave = chaveDaParte(parte.polo, parte.nome);
      if (chaves.has(chave)) return;
      chaves.add(chave);
      const pessoaId = randomUUID();
      pessoas.push({ id: pessoaId, nome: parte.nome });
      partes.push({ processo_id: processoId, pessoa_id: pessoaId, polo: parte.polo, papel: "parte", vinculo: parte.tipo, devedor: parte.polo === devedor, origem: "vios", ordem });
    });
  }
  for (const lote of emLotes(pessoas, 500)) {
    const { error } = await db().from("proc_pessoas").insert(lote);
    if (error) falhou("gravar as pessoas das partes", error);
  }
  for (const lote of emLotes(partes, 500)) {
    const { error } = await db().from("proc_partes").insert(lote);
    if (error) falhou("gravar as partes", error);
  }
  return partes.length;
}

async function aplicar(registros: RegistroImportado[]): Promise<Pick<ResultadoSync, "criados" | "atualizados" | "confirmados" | "partesIncluidas">> {
  const banco = db();
  const agora = new Date().toISOString();
  const atuais = new Map<string, Record<string, unknown>>();
  for (const lote of emLotes(registros.map((registro) => registro.ci), 200)) {
    const { data, error } = await banco.from("proc_processos").select(`id, ${COLUNAS_PROCESSO.join(", ")}, vios_editado_em`).in("ci", lote);
    if (error) falhou("consultar os processos já gravados", error);
    for (const linha of (data ?? []) as unknown as Record<string, unknown>[]) atuais.set(String(linha.ci), linha);
  }
  const pendentes = new Map<string, Map<string, string>>();
  for (const lote of emLotes([...atuais.values()].map((linha) => linha.id as string), 200)) {
    const { data, error } = await banco.from("proc_vios_envios").select("processo_id, campo, valor_novo").in("processo_id", lote).in("status", ENVIOS_ABERTOS);
    if (error) falhou("consultar a fila do VIOS", error);
    for (const envio of data ?? []) {
      const doProcesso = pendentes.get(envio.processo_id as string) ?? new Map<string, string>();
      doProcesso.set(envio.campo as string, (envio.valor_novo as string | null) ?? "");
      pendentes.set(envio.processo_id as string, doProcesso);
    }
  }

  const novos: Record<string, unknown>[] = [];
  const historico: Record<string, unknown>[] = [];
  const partesPorProcesso = new Map<string, { partes: ParteImportada[]; poloCliente: ValorCampo | undefined }>();
  let atualizados = 0;
  let confirmados = 0;

  for (const registro of registros) {
    const atual = atuais.get(registro.ci);
    const importado = soGravaveis(registro.valores);
    if (!atual) {
      const id = randomUUID();
      const linha: Record<string, unknown> = { id, origem: "vios", sincronizado_em: agora, ...importado };
      // Lote com as mesmas chaves em todas as linhas; lista ausente é lista vazia (colunas not null).
      for (const lista of LISTAS) linha[lista] ??= [];
      novos.push(linha);
      if (registro.partes.length) partesPorProcesso.set(id, { partes: registro.partes, poloCliente: registro.valores.polo_cliente });
      continue;
    }
    const id = atual.id as string;
    const resultado = mesclarComVios(atual as Valores, importado, pendentes.get(id) ?? new Map());
    for (const lista of LISTAS) if (resultado.patch[lista] === null) resultado.patch[lista] = [];
    if (Object.keys(resultado.patch).length) {
      const { error } = await banco.from("proc_processos").update({ ...resultado.patch, sincronizado_em: agora }).eq("id", id);
      if (error) falhou(`atualizar o processo CI ${registro.ci}`, error);
      if (resultado.mudancas.length) atualizados += 1;
    }
    for (const mudanca of resultado.mudancas) {
      historico.push({ processo_id: id, campo: mudanca.campo, valor_anterior: mudanca.anterior || null, valor_novo: mudanca.novo || null, origem: "vios" });
    }
    if (resultado.confirmados.length) {
      const { error } = await banco
        .from("proc_vios_envios")
        .update({ status: "confirmado", confirmado_em: agora, atualizado_em: agora })
        .eq("processo_id", id)
        .in("campo", resultado.confirmados)
        .in("status", ENVIOS_ABERTOS);
      if (error) falhou("confirmar envios do VIOS", error);
      confirmados += resultado.confirmados.length;
    }
    if (registro.partes.length) partesPorProcesso.set(id, { partes: registro.partes, poloCliente: registro.valores.polo_cliente });
  }

  // Todas as linhas do lote com as mesmas colunas (o PostgREST exige): o que a fonte não trouxe vai nulo.
  const colunasNovos = [...new Set(novos.flatMap((linha) => Object.keys(linha)))];
  const uniformes = novos.map((linha) => Object.fromEntries(colunasNovos.map((coluna) => [coluna, linha[coluna] ?? null])));
  for (const lote of emLotes(uniformes, 200)) {
    const { error } = await banco.from("proc_processos").insert(lote);
    if (error) falhou("gravar os processos novos", error);
  }
  for (const lote of emLotes(historico, 500)) {
    const { error } = await banco.from("proc_alteracoes").insert(lote);
    if (error) falhou("registrar o histórico da sincronização", error);
  }
  // Marca a passagem da sincronização também em quem não mudou.
  for (const lote of emLotes([...atuais.values()].map((linha) => linha.id as string), 200)) {
    const { error } = await banco.from("proc_processos").update({ sincronizado_em: agora }).in("id", lote);
    if (error) falhou("marcar a sincronização", error);
  }
  const partesIncluidas = partesPorProcesso.size ? await incluirPartes(partesPorProcesso) : 0;
  return { criados: novos.length, atualizados, confirmados, partesIncluidas };
}

async function registrarExecucao(dados: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("proc_sync_execucoes").insert({ ...dados, concluido_em: new Date().toISOString() });
  if (error) console.error("[processos] registrar a execução da sincronização:", error.message);
}

/**
 * Importa os processos do recorte (área e grupo). Fontes: o CSV "Processos Lista" (o do SharePoint, na
 * rotina diária, ou o arquivo enviado na tela) e processos_completo do SIOE, que completa fase,
 * departamento, matéria, sistema e etiquetas e traz também os encerrados. Uma fonte fora do ar vira
 * aviso; sem nenhuma, erro.
 */
export async function sincronizarProcessos(opcoes: { origem: "sharepoint" | "csv"; csv?: Uint8Array; arquivo?: string; ator?: Ator }): Promise<ResultadoSync> {
  const recorte = lerRecorte();
  const avisos: string[] = [];
  const iniciadoEm = new Date().toISOString();
  const base = {
    origem: opcoes.origem,
    arquivo: opcoes.arquivo ?? (opcoes.origem === "sharepoint" ? PROCESSOS_LISTA : null),
    executado_por: opcoes.ator?.authUserId ?? null,
    executado_por_nome: opcoes.ator?.nome ?? null,
    iniciado_em: iniciadoEm,
  };
  try {
    let linhasSioe: Record<string, unknown>[] = [];
    let sioeOk = true;
    try {
      linhasSioe = await carregarDoSioe(recorte);
    } catch (erro) {
      sioeOk = false;
      avisos.push(`SIOE fora do ar ou não configurado (${erro instanceof Error ? erro.message : "erro"}): fase, matéria e etiquetas podem ficar incompletas.`);
    }
    const catalogoEtiquetas = [...new Set(linhasSioe.flatMap((linha) => lerEtiquetasSioe(linha.etiquetas)))];

    let bytes = opcoes.csv ?? null;
    if (!bytes && opcoes.origem === "sharepoint") {
      try {
        bytes = await baixarArquivoPorCaminho(SITE_CONTROLADORIA, PROCESSOS_LISTA);
      } catch (erro) {
        avisos.push(`Não foi possível baixar o "Processos Lista" do SharePoint (${erro instanceof Error ? erro.message : "erro"}): a carga usou só o SIOE.`);
      }
    }
    if (!bytes && !sioeOk) throw new ProcessosError("Nenhuma fonte disponível: o SIOE e o SharePoint falharam.", 502);

    let leitura: ReturnType<typeof lerCsvProcessos> = { registros: [], colunasIgnoradas: [], linhasSemCi: 0 };
    if (bytes) {
      try {
        leitura = lerCsvProcessos(decodificarCsv(bytes), catalogoEtiquetas);
      } catch (erro) {
        throw new ProcessosError(erro instanceof Error ? erro.message : "Arquivo inválido.", 400);
      }
    }
    const doCsv = new Map(leitura.registros.map((registro) => [registro.ci, registro]));
    const doSioe = new Map<string, RegistroImportado>();
    for (const linha of linhasSioe) {
      const registro = registroDoSioe(linha);
      if (registro) doSioe.set(registro.ci, registro);
    }
    const registros: RegistroImportado[] = [];
    for (const ci of new Set([...doCsv.keys(), ...doSioe.keys()])) {
      const junto = juntarFontes(doCsv.get(ci), doSioe.get(ci));
      if (junto && estaNoRecorte(junto.valores, recorte)) registros.push(junto);
    }
    const resultado = await aplicar(registros);
    const lidos = leitura.registros.length + linhasSioe.length;
    await registrarExecucao({
      ...base,
      status: "ok",
      lidos,
      no_recorte: registros.length,
      criados: resultado.criados,
      atualizados: resultado.atualizados,
      confirmados: resultado.confirmados,
      colunas_ignoradas: leitura.colunasIgnoradas,
      erro: avisos.length ? avisos.join(" ") : null,
    });
    return { lidos, noRecorte: registros.length, ...resultado, colunasIgnoradas: leitura.colunasIgnoradas, avisos };
  } catch (erro) {
    await registrarExecucao({ ...base, status: "erro", erro: erro instanceof Error ? erro.message : "Erro desconhecido" });
    throw erro;
  }
}

/** Tela de importação: últimas execuções, fila do VIOS e o recorte em vigor. */
export async function situacaoDaImportacao(): Promise<SituacaoImportacao> {
  const [execucoes, total, envios] = await Promise.all([
    db()
      .from("proc_sync_execucoes")
      .select("id, origem, status, arquivo, lidos, no_recorte, criados, atualizados, confirmados, colunas_ignoradas, erro, executado_por_nome, iniciado_em, concluido_em")
      .order("iniciado_em", { ascending: false })
      .limit(15),
    db().from("proc_processos").select("id", { count: "exact", head: true }),
    listarEnvios(200),
  ]);
  if (execucoes.error) falhou("carregar as importações", execucoes.error);
  return {
    execucoes: (execucoes.data ?? []).map(
      (linha): ExecucaoSync => ({
        id: linha.id as string,
        origem: linha.origem as ExecucaoSync["origem"],
        status: linha.status as ExecucaoSync["status"],
        arquivo: (linha.arquivo as string | null) ?? null,
        lidos: linha.lidos as number,
        noRecorte: linha.no_recorte as number,
        criados: linha.criados as number,
        atualizados: linha.atualizados as number,
        confirmados: linha.confirmados as number,
        colunasIgnoradas: (linha.colunas_ignoradas as string[] | null) ?? [],
        erro: (linha.erro as string | null) ?? null,
        autor: (linha.executado_por_nome as string | null) ?? null,
        iniciadoEm: linha.iniciado_em as string,
        concluidoEm: (linha.concluido_em as string | null) ?? null,
      })
    ),
    envios,
    gravacaoSimulada: gravacaoSimulada(),
    recorte: lerRecorte(),
    totalProcessos: total.count ?? 0,
  };
}
