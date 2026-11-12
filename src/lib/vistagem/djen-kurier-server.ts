import "server-only";

import { getSioeClient } from "@/lib/sioe-sync-server";
import {
  ADVOGADOS_DJEN,
  INICIO_DA_CONFERENCIA,
  chaveDoAdvogado,
  comunicacaoDaApi,
  compararDjenKurier,
  detalheDoDia,
  diaAnterior,
  diasDesdeOInicio,
  diasDoPeriodo,
  resumoDoDia,
  totaisDaConferencia,
  tribunalDoProcesso,
  type ComunicacaoDjenGuardada,
  type ConferenciaDjenKurier,
  type DetalheDoDia,
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

/** Lê de mil em mil, até acabar. */
async function lerPaginas(
  rotulo: string,
  pagina: (inicio: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<Record<string, unknown>[]> {
  const linhas: Record<string, unknown>[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await pagina(inicio);
    if (error) falhou(`ler ${rotulo}`, error);
    linhas.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

/** Os tipos de agendamento do BKP ('["CIÊNCIA NF"]') como texto. */
function tiposDoBkp(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  if (!texto) return "sem tipo";
  try {
    const lista = JSON.parse(texto) as unknown;
    if (Array.isArray(lista)) return lista.map(String).join(", ") || "sem tipo";
  } catch {
    // Não é JSON: fica o texto.
  }
  return texto;
}

/**
 * A Kurier do BKP de publicações do SIOE (só as linhas da lista do SharePoint; as gravadas pelo Orquestra já estão no
 * Orquestra). Falhar aqui não derruba a conferência: ela sai só com o Orquestra, com o aviso.
 */
async function kurierDoBkp(de: string, ate: string): Promise<{ itens: PublicacaoKurier[]; erro: string | null }> {
  try {
    const sioe = getSioeClient();
    const linhas = await lerPaginas("o BKP de publicações do SIOE", (inicio) =>
      sioe
        .from("sp_publicacoes")
        .select("sp_id, data_divulgacao, numero_processo, tipo_agendamento, data_recebimento_kurier")
        .eq("origem", "sharepoint")
        .gte("data_divulgacao", de)
        .lte("data_divulgacao", ate)
        .order("sp_id")
        .range(inicio, inicio + 999)
    );
    const itens = linhas
      .filter((linha) => /^\d{4}-\d{2}-\d{2}/.test(String(linha.data_divulgacao ?? "")))
      .map((linha) => {
        const processo = (linha.numero_processo as string | null) ?? null;
        return {
          id: `bkp:${linha.sp_id}`,
          djenId: null,
          data: String(linha.data_divulgacao).slice(0, 10),
          processo,
          tribunal: tribunalDoProcesso(processo),
          nomeLocalizado: null,
          status: tiposDoBkp(linha.tipo_agendamento),
          fonte: "bkp" as const,
          arquivo: linha.data_recebimento_kurier ? String(linha.data_recebimento_kurier).slice(0, 10) : null,
        };
      });
    return { itens, erro: null };
  } catch (falha) {
    const erro = falha instanceof Error ? falha.message : String(falha);
    console.error("[vistagem] conferência DJEN × Kurier: BKP do SIOE", erro);
    return { itens: [], erro };
  }
}

/** O que a conferência precisa, de `de` até `ate`: o DJEN, a Kurier (Orquestra e BKP), as buscas e os arquivos. */
async function carregar(de: string, ate: string) {
  const db = admin();
  const [djenLinhas, kurierLinhas, bkp, buscas, arquivos] = await Promise.all([
    lerPaginas("as comunicações do DJEN", (inicio) =>
      db
        .from("vistagem_djen_comunicacoes")
        .select("id, data_disponibilizacao, numero_processo, sigla_tribunal, tipo_comunicacao, nome_orgao, nome_classe, advogados, ativo, link")
        .gte("data_disponibilizacao", de)
        .lte("data_disponibilizacao", ate)
        .order("id")
        .range(inicio, inicio + 999)
    ),
    lerPaginas("as publicações da Kurier", (inicio) =>
      db
        .from("vistagem_publicacoes")
        .select("id, djen_id_comunicacao, data_divulgacao, numero_processo, numero_processo_original, tribunal, nome_localizado, status, kurier_arquivo_id")
        .eq("origem", "kurier")
        .gte("data_divulgacao", de)
        .lte("data_divulgacao", ate)
        .order("id")
        .range(inicio, inicio + 999)
    ),
    kurierDoBkp(de, ate),
    db.from("vistagem_djen_buscas").select("executada_em, origem, dias, erro").order("executada_em", { ascending: false }).limit(1000),
    db.from("vistagem_kurier_arquivos").select("id, data_arquivo, origem"),
  ]);
  if (buscas.error) falhou("ler as buscas no DJEN", buscas.error);
  if (arquivos.error) falhou("ler os arquivos da Kurier", arquivos.error);
  const arquivosLidos = (arquivos.data ?? []) as { id: string; data_arquivo: string | null; origem: string }[];
  const dataDoArquivo = new Map(arquivosLidos.map((arquivo) => [arquivo.id, arquivo.data_arquivo?.slice(0, 10) ?? null]));
  // O último arquivo da Kurier (do SharePoint; o colado à mão não fecha o dia).
  const ultimoArquivoKurier =
    arquivosLidos
      .filter((arquivo) => arquivo.origem === "sharepoint" && arquivo.data_arquivo)
      .map((arquivo) => String(arquivo.data_arquivo).slice(0, 10))
      .sort()
      .at(-1) ?? null;

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
    fonte: "orquestra",
    arquivo: linha.kurier_arquivo_id ? (dataDoArquivo.get(String(linha.kurier_arquivo_id)) ?? null) : null,
  }));
  const registros = (buscas.data ?? []) as { executada_em: string; origem: string; dias: string[] | null; erro: string | null }[];
  const [ultima] = registros;
  return {
    djen,
    kurier: [...kurier, ...bkp.itens],
    diasBuscados: new Set(registros.flatMap((registro) => registro.dias ?? [])),
    ultimoArquivoKurier,
    ultimaBusca: ultima ? { em: ultima.executada_em, origem: ultima.origem, erro: ultima.erro } : null,
    erroBkp: bkp.erro,
  };
}

/**
 * A conferência dos últimos `periodo` dias (até hoje), ou de todo o estudo ("tudo", desde INICIO_DA_CONFERENCIA): os
 * números de cada dia. As listas de um dia vêm em detalheDaConferencia. Nenhum dia antes do início do estudo entra.
 */
export async function conferenciaDjenKurier(periodo: number | "tudo"): Promise<ConferenciaDjenKurier> {
  if (periodo !== "tudo" && (!Number.isInteger(periodo) || periodo < 1 || periodo > 90)) {
    throw new VistagemError("Período inválido (1 a 90 dias, ou todo o estudo).", 400);
  }
  const hoje = hojeEmSaoPaulo();
  const dias = diasDoPeriodo(hoje, periodo === "tudo" ? diasDesdeOInicio(hoje) : periodo).filter((dia) => dia >= INICIO_DA_CONFERENCIA);
  if (!dias.length) dias.push(hoje);
  // Dois dias de folga antes do período: o par pelo ID pode estar num dia vizinho.
  const dados = await carregar(diasDoPeriodo(dias[dias.length - 1], 3)[2], dias[0]);
  const porDia = compararDjenKurier(dados.djen, dados.kurier, dias, dados.diasBuscados, { ultimoArquivoKurier: dados.ultimoArquivoKurier }).map(resumoDoDia);
  return { dias: porDia, totais: totaisDaConferencia(porDia), ultimaBusca: dados.ultimaBusca, erroBkp: dados.erroBkp };
}

/**
 * O que é o quê num dia: o que está nos dois, só na Kurier e só no DJEN. Lê cinco dias para cada lado, para mostrar
 * quando o outro lado trouxe o mesmo processo em outro dia.
 */
export async function detalheDaConferencia(dia: string): Promise<DetalheDoDia> {
  const hoje = hojeEmSaoPaulo();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || dia < INICIO_DA_CONFERENCIA || dia > hoje) {
    throw new VistagemError(`Dia inválido (de ${INICIO_DA_CONFERENCIA} até hoje).`, 400);
  }
  const dados = await carregar(somarDias(dia, -5), [hoje, somarDias(dia, 5)].sort()[0]);
  return detalheDoDia(dados.djen, dados.kurier, dia, dados.diasBuscados, { ultimoArquivoKurier: dados.ultimoArquivoKurier, erroBkp: dados.erroBkp });
}

/** `dia` mais `quantos` dias (negativo volta). */
function somarDias(dia: string, quantos: number): string {
  const [ano, mes, numero] = dia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, numero + quantos)).toISOString().slice(0, 10);
}
