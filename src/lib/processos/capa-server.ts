import "server-only";

import type { SugestaoNova } from "./autos-types";
import { indiceDoDataJud, lerCnjDaCapa, registroAtual, sugestoesDaCapa, type RegistroDataJud } from "./capa";
import { ProcessosError } from "./errors";
import { detalharProcesso } from "./processos-server";
import { db, falhou } from "./server";

/**
 * Completa a capa do processo com o número CNJ e o DataJud, como sugestões para uma pessoa aprovar.
 * O DataJud é lento e às vezes recusa por excesso (429): falha não trava nada, fica anotada no processo.
 */

/** Chave pública do DataJud, publicada pelo CNJ em datajud-wiki.cnj.jus.br/api-publica/acesso (pode mudar: DATAJUD_API_KEY). */
const CHAVE_PUBLICA_DATAJUD = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
/** O DataJud leva de 20 a 55 s por consulta (medido em 10/11/2026) e às vezes passa de um minuto. */
const PRAZO_DATAJUD_MS = 75_000;

async function consultarDataJud(digitos: string, indice: string): Promise<RegistroDataJud[]> {
  const resposta = await fetch(`https://api-publica.datajud.cnj.jus.br/${indice}/_search`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(PRAZO_DATAJUD_MS),
    headers: { Authorization: `APIKey ${process.env.DATAJUD_API_KEY?.trim() || CHAVE_PUBLICA_DATAJUD}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { match: { numeroProcesso: digitos } }, size: 10 }),
  });
  if (resposta.status === 429) throw new Error("o DataJud recusou por excesso de consultas; tente de novo em alguns minutos");
  if (!resposta.ok) throw new Error(`o DataJud respondeu ${resposta.status}`);
  const corpo = (await resposta.json()) as { hits?: { hits?: { _source: RegistroDataJud }[] } };
  return (corpo.hits?.hits ?? []).map((hit) => hit._source);
}

const municipios = new Map<number, string | null>();

/** Nome do município pelo código do IBGE (API pública de localidades do IBGE), com memória entre chamadas. */
async function municipioDoIbge(codigo: number | null | undefined): Promise<string | null> {
  if (!codigo) return null;
  if (municipios.has(codigo)) return municipios.get(codigo) ?? null;
  try {
    const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${codigo}`, { signal: AbortSignal.timeout(10_000) });
    const corpo = resposta.ok ? ((await resposta.json()) as { nome?: string }) : null;
    const nome = corpo?.nome?.trim() || null;
    municipios.set(codigo, nome);
    return nome;
  } catch {
    return null;
  }
}

/** Troca as sugestões de capa ainda pendentes do processo pelas novas. Proposta já recusada não volta (mesma chave). */
async function gravar(processoId: string, sugestoes: SugestaoNova[]): Promise<number> {
  const banco = db();
  const { error: erroLimpeza } = await banco.from("proc_sugestoes").delete().eq("processo_id", processoId).in("fonte", ["datajud", "cnj"]).eq("situacao", "pendente");
  if (erroLimpeza) falhou("limpar as sugestões de capa anteriores", erroLimpeza);
  if (!sugestoes.length) return 0;
  const { data, error } = await banco
    .from("proc_sugestoes")
    .upsert(
      sugestoes.map((item) => ({
        processo_id: processoId,
        documento_id: null,
        fonte: item.fonte ?? "datajud",
        tipo: item.tipo,
        campo: item.campo,
        parte_id: item.parteId,
        item: item.item,
        chave: item.chave,
        resumo: item.resumo.slice(0, 500),
        valor: item.valor,
        pagina: null,
        trecho: item.trecho,
        trecho_conferido: true,
        confianca: item.confianca,
      })),
      { onConflict: "processo_id,chave", ignoreDuplicates: true }
    )
    .select("id");
  if (error) falhou("gravar as sugestões de capa", error);
  return data?.length ?? 0;
}

export interface ResultadoDaCapa {
  /** O DataJud tinha o processo. */
  achou: boolean;
  sugestoes: number;
  /** Por que não veio nada do DataJud (as regras do número valem mesmo assim). */
  aviso: string | null;
}

/** Consulta o DataJud para um processo e deixa as sugestões de capa pendentes na ficha. */
export async function completarCapa(processoId: string): Promise<ResultadoDaCapa> {
  const processo = await detalharProcesso(processoId);
  const cnj = lerCnjDaCapa(typeof processo.valores.cnj === "string" ? processo.valores.cnj : null);
  if (!cnj) throw new ProcessosError("O processo está sem número CNJ completo: não dá para consultar o DataJud.", 422);
  const indice = indiceDoDataJud(cnj);
  const agora = new Date();
  let registros: RegistroDataJud[] = [];
  let aviso: string | null = null;
  if (!indice) {
    aviso = "O tribunal deste número não tem índice no DataJud.";
  } else {
    try {
      registros = await consultarDataJud(cnj.digitos, indice);
      if (!registros.length) aviso = "O processo ainda não está no DataJud (o tribunal pode não ter enviado).";
    } catch (erro) {
      aviso = `Não foi possível consultar o DataJud: ${erro instanceof Error ? erro.message : String(erro)}.`;
    }
  }
  const municipio = await municipioDoIbge(registroAtual(registros)?.orgaoJulgador?.codigoMunicipioIBGE);
  const sugestoes = sugestoesDaCapa({ valores: processo.valores, datajud: registros, municipio, consultadoEm: agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) });
  const gravadas = await gravar(processoId, sugestoes);
  const { error } = await db()
    .from("proc_processos")
    .update({ datajud_consultado_em: agora.toISOString(), datajud_erro: registros.length ? null : aviso })
    .eq("id", processoId);
  if (error) console.error("[processos] registrar a consulta ao DataJud:", error.message);
  return { achou: registros.length > 0, sugestoes: gravadas, aviso };
}

/** Intervalo entre duas consultas do mesmo processo pelo robô. */
const DIAS_ENTRE_CONSULTAS = 7;

export interface ResultadoDaProxima {
  /** Não há processo esperando consulta: o robô descansa. */
  nada: boolean;
  /** O DataJud recusou por excesso: o robô espera mais antes da próxima. */
  recusado: boolean;
  achou: boolean;
  sugestoes: number;
  restantes: number;
}

/**
 * Consulta o DataJud para o próximo processo da vez: os ativos e os nunca consultados primeiro, depois os
 * consultados há mais de uma semana. Uma por chamada: quem repete é o robô, com pausa (o DataJud é lento
 * e recusa rajadas). Marca o processo antes de consultar, para duas chamadas não pegarem o mesmo.
 */
export async function completarProximaCapa(): Promise<ResultadoDaProxima> {
  const limite = new Date(Date.now() - DIAS_ENTRE_CONSULTAS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db()
    .from("proc_processos")
    .select("id, situacao, datajud_consultado_em")
    .not("cnj", "is", null)
    .or(`datajud_consultado_em.is.null,datajud_consultado_em.lt.${limite}`)
    .limit(2000);
  if (error) falhou("listar os processos para o DataJud", error);
  const fila = ((data ?? []) as { id: string; situacao: string | null; datajud_consultado_em: string | null }[]).sort(
    (a, b) =>
      Number(/^ativo/i.test(b.situacao ?? "")) - Number(/^ativo/i.test(a.situacao ?? "")) ||
      String(a.datajud_consultado_em ?? "").localeCompare(String(b.datajud_consultado_em ?? ""))
  );
  const vez = fila[0];
  if (!vez) return { nada: true, recusado: false, achou: false, sugestoes: 0, restantes: 0 };
  // Reserva: com o carimbo, o processo sai da fila mesmo se esta chamada cair no meio.
  await db().from("proc_processos").update({ datajud_consultado_em: new Date().toISOString() }).eq("id", vez.id);
  const capa = await completarCapa(vez.id);
  return { nada: false, recusado: Boolean(capa.aviso?.includes("excesso")), achou: capa.achou, sugestoes: capa.sugestoes, restantes: fila.length - 1 };
}
