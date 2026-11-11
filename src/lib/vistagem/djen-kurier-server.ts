import "server-only";

import {
  ADVOGADOS_DJEN,
  chaveDoAdvogado,
  comunicacaoDaApi,
  compararDjenKurier,
  diaAnterior,
  diasDoPeriodo,
  totaisDaConferencia,
  type ComunicacaoDjenGuardada,
  type ConferenciaDjenKurier,
  type ItemDaApiDjen,
  type PublicacaoKurier,
} from "./djen-kurier";
import { VistagemError } from "./errors";
import { admin, falhou, hojeEmSaoPaulo } from "./server";

const API_DJEN = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";
const POR_PAGINA = 100;
const MAX_PAGINAS = 30;

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Uma página da API do DJEN por OAB e dia; tenta de novo uma vez em 429/5xx. */
async function paginaDoDjen(oab: string, uf: string, dia: string, pagina: number): Promise<{ itens: ItemDaApiDjen[]; total: number }> {
  const url = `${API_DJEN}?numeroOab=${oab}&ufOab=${uf}&dataDisponibilizacaoInicio=${dia}&dataDisponibilizacaoFim=${dia}&itensPorPagina=${POR_PAGINA}&pagina=${pagina}`;
  for (let tentativa = 1; ; tentativa++) {
    const resposta = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (resposta.ok) {
      const corpo = (await resposta.json()) as { items?: ItemDaApiDjen[]; count?: number };
      return { itens: corpo.items ?? [], total: Number(corpo.count ?? 0) };
    }
    if (tentativa < 2 && (resposta.status === 429 || resposta.status >= 500)) {
      await espera(2_000);
      continue;
    }
    throw new Error(`DJEN respondeu ${resposta.status} (OAB ${oab}/${uf}, ${dia})`);
  }
}

/** Todas as comunicações de um advogado num dia (página por página). */
async function comunicacoesDoDia(advogado: { oab: string; uf: string }, dia: string): Promise<ComunicacaoDjenGuardada[]> {
  const chave = chaveDoAdvogado(advogado);
  const achadas: ComunicacaoDjenGuardada[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const { itens, total } = await paginaDoDjen(advogado.oab, advogado.uf, dia, pagina);
    for (const item of itens) {
      const comunicacao = comunicacaoDaApi(item, chave);
      if (comunicacao) achadas.push(comunicacao);
    }
    if (itens.length < POR_PAGINA || pagina * POR_PAGINA >= total) break;
    await espera(300);
  }
  return achadas;
}

/**
 * Busca no DJEN as comunicações do Gustavo e do Ricardo nos dias pedidos (por padrão, ontem e hoje) e guarda, sem
 * repetir: a mesma comunicação que cita os dois fica uma vez, com os dois advogados. Registra a busca.
 */
export async function sincronizarDjen(
  origem: "cron" | "manual",
  dias: string[] = [diaAnterior(hojeEmSaoPaulo()), hojeEmSaoPaulo()]
): Promise<{ dias: string[]; totais: Record<string, Record<string, number>>; gravadas: number; erro: string | null }> {
  const db = admin();
  const totais: Record<string, Record<string, number>> = {};
  const porId = new Map<number, ComunicacaoDjenGuardada>();
  let erro: string | null = null;
  try {
    for (const advogado of ADVOGADOS_DJEN) {
      const chave = chaveDoAdvogado(advogado);
      totais[chave] = {};
      for (const dia of dias) {
        const achadas = await comunicacoesDoDia(advogado, dia);
        totais[chave][dia] = achadas.length;
        for (const comunicacao of achadas) {
          const atual = porId.get(comunicacao.id);
          porId.set(comunicacao.id, atual ? { ...atual, advogados: [...new Set([...atual.advogados, ...comunicacao.advogados])] } : comunicacao);
        }
      }
    }
  } catch (falha) {
    erro = falha instanceof Error ? falha.message : String(falha);
  }

  let gravadas = 0;
  const novas = [...porId.values()];
  if (novas.length) {
    // Quem já estava guardado mantém os advogados de antes (outra busca pode ter achado pelo outro advogado).
    const { data: existentes, error } = await db
      .from("vistagem_djen_comunicacoes")
      .select("id, advogados")
      .in("id", novas.map((item) => item.id));
    if (error) falhou("ler as comunicações do DJEN guardadas", error);
    const antes = new Map(((existentes ?? []) as { id: number; advogados: string[] }[]).map((linha) => [Number(linha.id), linha.advogados ?? []]));
    const agora = new Date().toISOString();
    const linhas = novas.map((item) => ({
      id: item.id,
      data_disponibilizacao: item.data,
      numero_processo: item.processo,
      sigla_tribunal: item.tribunal,
      tipo_comunicacao: item.tipo,
      nome_orgao: item.orgao,
      nome_classe: item.classe,
      advogados: [...new Set([...(antes.get(item.id) ?? []), ...item.advogados])].sort(),
      ativo: item.ativo,
      link: item.link,
      ultima_vez: agora,
    }));
    for (let inicio = 0; inicio < linhas.length; inicio += 500) {
      const { error: erroGravar } = await db.from("vistagem_djen_comunicacoes").upsert(linhas.slice(inicio, inicio + 500), { onConflict: "id" });
      if (erroGravar) falhou("gravar as comunicações do DJEN", erroGravar);
    }
    gravadas = linhas.length;
  }

  // Dia com falha não conta como buscado: só os que todos os advogados terminaram.
  const completos = dias.filter((dia) => ADVOGADOS_DJEN.every((advogado) => totais[chaveDoAdvogado(advogado)]?.[dia] !== undefined));
  const { error: erroRegistro } = await db.from("vistagem_djen_buscas").insert({ origem, dias: completos, totais, erro });
  if (erroRegistro) console.error("[vistagem] registro da busca no DJEN", erroRegistro.message);
  return { dias: completos, totais, gravadas, erro };
}

/** A conferência dos últimos `quantos` dias (até hoje), com as divergências de cada dia. */
export async function conferenciaDjenKurier(quantos: number): Promise<ConferenciaDjenKurier> {
  if (!Number.isInteger(quantos) || quantos < 1 || quantos > 90) throw new VistagemError("Período inválido (1 a 90 dias).", 400);
  const db = admin();
  const dias = diasDoPeriodo(hojeEmSaoPaulo(), quantos);
  // Dois dias de folga antes do período: o par pelo ID pode estar num dia vizinho.
  const de = diasDoPeriodo(dias[dias.length - 1], 3)[2];
  const ate = dias[0];

  /** Lê de mil em mil, até acabar. */
  const lerPaginas = async (
    rotulo: string,
    pagina: (inicio: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
  ): Promise<Record<string, unknown>[]> => {
    const linhas: Record<string, unknown>[] = [];
    for (let inicio = 0; ; inicio += 1000) {
      const { data, error } = await pagina(inicio);
      if (error) falhou(`ler ${rotulo}`, error);
      linhas.push(...((data ?? []) as Record<string, unknown>[]));
      if (!data || data.length < 1000) break;
    }
    return linhas;
  };

  const [djenLinhas, kurierLinhas, buscas] = await Promise.all([
    lerPaginas("as comunicações do DJEN", (inicio) =>
      db
        .from("vistagem_djen_comunicacoes")
        .select("id, data_disponibilizacao, numero_processo, sigla_tribunal, tipo_comunicacao, nome_orgao, nome_classe, advogados, ativo, link")
        .gte("data_disponibilizacao", de)
        .lte("data_disponibilizacao", ate)
        .range(inicio, inicio + 999)
    ),
    lerPaginas("as publicações da Kurier", (inicio) =>
      db
        .from("vistagem_publicacoes")
        .select("id, djen_id_comunicacao, data_divulgacao, numero_processo, numero_processo_original, tribunal, nome_localizado, status")
        .eq("origem", "kurier")
        .gte("data_divulgacao", de)
        .lte("data_divulgacao", ate)
        .range(inicio, inicio + 999)
    ),
    db.from("vistagem_djen_buscas").select("executada_em, origem, dias, erro").order("executada_em", { ascending: false }).limit(200),
  ]);
  if (buscas.error) falhou("ler as buscas no DJEN", buscas.error);

  const djen: ComunicacaoDjenGuardada[] = djenLinhas.map((linha) => ({
    id: Number(linha.id),
    data: String(linha.data_disponibilizacao),
    processo: (linha.numero_processo as string | null) ?? null,
    tribunal: (linha.sigla_tribunal as string | null) ?? null,
    tipo: (linha.tipo_comunicacao as string | null) ?? null,
    orgao: (linha.nome_orgao as string | null) ?? null,
    classe: (linha.nome_classe as string | null) ?? null,
    advogados: (linha.advogados as string[] | null) ?? [],
    ativo: (linha.ativo as boolean | null) ?? null,
    link: (linha.link as string | null) ?? null,
  }));
  const kurier: PublicacaoKurier[] = kurierLinhas.map((linha) => ({
    id: String(linha.id),
    djenId: linha.djen_id_comunicacao ? Number(linha.djen_id_comunicacao) : null,
    data: String(linha.data_divulgacao),
    processo: ((linha.numero_processo ?? linha.numero_processo_original) as string | null) ?? null,
    tribunal: (linha.tribunal as string | null) ?? null,
    nomeLocalizado: (linha.nome_localizado as string | null) ?? null,
    status: String(linha.status),
  }));
  const registros = (buscas.data ?? []) as { executada_em: string; origem: string; dias: string[] | null; erro: string | null }[];
  const diasBuscados = new Set(registros.flatMap((registro) => registro.dias ?? []));

  const porDia = compararDjenKurier(djen, kurier, dias, diasBuscados);
  const [ultima] = registros;
  return {
    dias: porDia,
    totais: totaisDaConferencia(porDia),
    ultimaBusca: ultima ? { em: ultima.executada_em, origem: ultima.origem, erro: ultima.erro } : null,
  };
}
