/**
 * Conferência DJEN × Kurier (pedido de 11/11/2026): o que a API pública do DJEN traz para o Gustavo e o Ricardo,
 * comparado com o que a Kurier trouxe no mesmo dia de disponibilização. Só estudo: não muda nada no fluxo.
 *
 * O par é pelo ID de comunicação do DJEN, que a Kurier também traz (djen_id_comunicacao). A publicação da Kurier sem
 * esse ID casa com uma comunicação do DJEN do mesmo processo no mesmo dia.
 *
 * A Kurier só está inteira no Orquestra a partir de 09/11/2026: as limpezas do piloto (03 a 08/11) deixaram só o
 * Trabalhista. Antes disso, a Kurier vem também do BKP de publicações do SIOE (sp_publicacoes, a lista do SharePoint),
 * que não tem o ID de comunicação: ali o par é pelo processo no mesmo dia, e cada processo conta uma vez por dia.
 */

/** O estudo começa em 01/10/2026 (pedido de 11/11/2026): antes disso não se compara. */
export const INICIO_DA_CONFERENCIA = "2026-10-01";

/** Os advogados que a Kurier localiza (os mesmos da triagem): a busca no DJEN é por OAB. */
export const ADVOGADOS_DJEN = [
  { oab: "275477", uf: "SP", nome: "Gustavo Bismarchi Motta", sigla: "GBM" },
  { oab: "353389", uf: "SP", nome: "Ricardo Viscardi Pires", sigla: "RVP" },
] as const;

export const chaveDoAdvogado = (advogado: { oab: string; uf: string }) => `${advogado.oab}/${advogado.uf}`;

/** Uma comunicação do DJEN guardada para a conferência. */
export interface ComunicacaoDjenGuardada {
  id: number;
  /** AAAA-MM-DD */
  data: string;
  processo: string | null;
  tribunal: string | null;
  tipo: string | null;
  orgao: string | null;
  classe: string | null;
  /** "275477/SP", "353389/SP" */
  advogados: string[];
  ativo: boolean | null;
  link: string | null;
}

/** Uma publicação que a Kurier trouxe. */
export interface PublicacaoKurier {
  id: string;
  djenId: number | null;
  /** Data de divulgação (a disponibilização no DJEN), AAAA-MM-DD. */
  data: string;
  processo: string | null;
  tribunal: string | null;
  nomeLocalizado: string | null;
  /** No Orquestra, o status da publicação; no BKP, os tipos de agendamento (ex.: "CIÊNCIA NF", "DUPLICIDADE"). */
  status: string;
  /** "orquestra" (com o ID do DJEN) ou "bkp" (BKP de publicações do SIOE, sem o ID). */
  fonte: "orquestra" | "bkp";
}

export interface DiaDaConferencia {
  /** AAAA-MM-DD */
  data: string;
  /** Houve busca no DJEN para este dia (sem busca, os números do DJEN não valem). */
  buscado: boolean;
  /**
   * Houve publicação da Kurier neste dia. Sem nenhuma, o arquivo do dia não foi importado (antes de 03/11/2026 não
   * há Kurier no Orquestra): o dia não se compara e fica fora dos totais.
   */
  comKurier: boolean;
  /**
   * O dia ainda não fechou na Kurier: cada arquivo traz o dia anterior e o próprio dia, então o resto dele só chega no
   * arquivo seguinte. Mostra os números, mas fica fora dos totais.
   */
  emAberto: boolean;
  djen: number;
  kurier: number;
  /** Quantas publicações da Kurier do dia vieram do BKP do SIOE (uma por processo). */
  doBkp: number;
  nosDois: number;
  soDjen: ComunicacaoDjenGuardada[];
  soKurier: PublicacaoKurier[];
  /** Parte da Kurier que o DJEN também trouxe (0 a 1); null sem Kurier ou sem busca. */
  cobertura: number | null;
}

export interface ConferenciaDjenKurier {
  dias: DiaDaConferencia[];
  totais: { djen: number; kurier: number; nosDois: number; soDjen: number; soKurier: number; cobertura: number | null };
  ultimaBusca: { em: string; origem: string; erro: string | null } | null;
  /** Falha ao ler o BKP do SIOE (a conferência sai só com a Kurier do Orquestra); null quando leu. */
  erroBkp: string | null;
}

const digitos = (processo: string | null | undefined) => String(processo ?? "").replace(/\D/g, "");

/** Os dias de um período, do mais novo ao mais antigo (AAAA-MM-DD). */
export function diasDoPeriodo(ate: string, quantos: number): string[] {
  const [ano, mes, dia] = ate.split("-").map(Number);
  return Array.from({ length: quantos }, (_, indice) => new Date(Date.UTC(ano, mes - 1, dia - indice)).toISOString().slice(0, 10));
}

/** O dia anterior (AAAA-MM-DD). */
export const diaAnterior = (dia: string) => diasDoPeriodo(dia, 2)[1];

/** Quantos dias vão do início do estudo até `hoje`, contando os dois. */
export const diasDesdeOInicio = (hoje: string) =>
  Math.max(1, Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${INICIO_DA_CONFERENCIA}T00:00:00Z`)) / 86_400_000) + 1);

const UF_DOS_TJS = ["AC", "AL", "AP", "AM", "BA", "CE", "DFT", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SE", "SP", "TO"];

/** O tribunal pelo número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO): o BKP do SIOE não guarda o tribunal. */
export function tribunalDoProcesso(processo: string | null | undefined): string | null {
  const numero = digitos(processo);
  if (numero.length !== 20) return null;
  const justica = numero[13];
  const tribunal = Number(numero.slice(14, 16));
  if (justica === "8") return UF_DOS_TJS[tribunal - 1] ? `TJ${UF_DOS_TJS[tribunal - 1]}` : null;
  if (justica === "5") return tribunal === 0 ? "TST" : `TRT${tribunal}`;
  if (justica === "4") return tribunal === 0 ? null : `TRF${tribunal}`;
  if (justica === "3") return "STJ";
  return null;
}

/**
 * Compara, dia a dia, o que o DJEN trouxe com o que a Kurier trouxe. Uma publicação da Kurier vale uma vez por ID de
 * comunicação (a mesma pode vir repetida em arquivos diferentes). O par pelo ID vale em qualquer dia do período; a
 * contagem fica no dia de cada lado.
 *
 * O BKP do SIOE só completa o Orquestra: entra o processo que a Kurier do Orquestra não tem naquele dia, uma vez por
 * processo e dia, e casa com todas as comunicações do DJEN desse processo no mesmo dia.
 *
 * `ultimoArquivoKurier` é a data do último arquivo da Kurier importado: dele em diante, o dia está em aberto.
 */
export function compararDjenKurier(
  djen: ComunicacaoDjenGuardada[],
  kurier: PublicacaoKurier[],
  dias: string[],
  diasBuscados: Set<string>,
  { ultimoArquivoKurier = null }: { ultimoArquivoKurier?: string | null } = {}
): DiaDaConferencia[] {
  const djenPorId = new Map(djen.map((item) => [item.id, item]));
  // Kurier sem repetir: pelo ID de comunicação, quando tem; senão, cada publicação.
  const doOrquestra = kurier.filter((item) => item.fonte !== "bkp");
  const kurierUnicas = [...new Map(doOrquestra.map((item) => [item.djenId ? `id:${item.djenId}` : `pub:${item.id}`, item])).values()];
  // BKP: só o processo que o Orquestra não tem no dia, uma vez por processo e dia.
  const diaEProcesso = (data: string, processo: string | null) => `${data}|${digitos(processo)}`;
  const noOrquestra = new Set(kurierUnicas.map((item) => diaEProcesso(item.data, item.processo)));
  const doBkp = [
    ...new Map(
      kurier
        .filter((item) => item.fonte === "bkp")
        .map((item) => [digitos(item.processo) ? diaEProcesso(item.data, item.processo) : `pub:${item.id}`, item])
    ).values(),
  ].filter((item) => !noOrquestra.has(diaEProcesso(item.data, item.processo)));
  const casadas = new Set<number>();
  const casaKurier = new Map<string, number | null>();
  for (const item of kurierUnicas) {
    if (item.djenId && djenPorId.has(item.djenId)) {
      casadas.add(item.djenId);
      casaKurier.set(item.id, item.djenId);
    }
  }
  // Sem ID (ou com um ID que o DJEN não trouxe): o mesmo processo no mesmo dia, ainda sem par.
  for (const item of kurierUnicas) {
    if (casaKurier.has(item.id)) continue;
    const alvo = digitos(item.processo);
    const par = alvo ? djen.find((comunicacao) => !casadas.has(comunicacao.id) && comunicacao.data === item.data && digitos(comunicacao.processo) === alvo) : undefined;
    if (par) casadas.add(par.id);
    casaKurier.set(item.id, par?.id ?? null);
  }
  // BKP: todas as comunicações do mesmo processo no mesmo dia.
  const djenPorDiaEProcesso = new Map<string, ComunicacaoDjenGuardada[]>();
  for (const comunicacao of djen) {
    if (!digitos(comunicacao.processo)) continue;
    const chave = diaEProcesso(comunicacao.data, comunicacao.processo);
    djenPorDiaEProcesso.set(chave, [...(djenPorDiaEProcesso.get(chave) ?? []), comunicacao]);
  }
  for (const item of doBkp) {
    const pares = digitos(item.processo) ? (djenPorDiaEProcesso.get(diaEProcesso(item.data, item.processo)) ?? []) : [];
    for (const par of pares) casadas.add(par.id);
    casaKurier.set(item.id, pares[0]?.id ?? null);
  }
  const todas = [...kurierUnicas, ...doBkp];

  return dias.map((data) => {
    const buscado = diasBuscados.has(data);
    const doDjen = djen.filter((item) => item.data === data);
    const daKurier = todas.filter((item) => item.data === data);
    const soKurier = buscado ? daKurier.filter((item) => !casaKurier.get(item.id)) : [];
    const nosDois = daKurier.length - (buscado ? soKurier.length : daKurier.length);
    return {
      data,
      buscado,
      comKurier: daKurier.length > 0,
      emAberto: Boolean(ultimoArquivoKurier && data >= ultimoArquivoKurier),
      djen: doDjen.length,
      kurier: daKurier.length,
      doBkp: daKurier.filter((item) => item.fonte === "bkp").length,
      nosDois,
      soDjen: daKurier.length ? doDjen.filter((item) => !casadas.has(item.id)) : [],
      soKurier,
      cobertura: buscado && daKurier.length ? nosDois / daKurier.length : null,
    };
  });
}

/** Soma dos dias que se comparam: com busca no DJEN, com publicação da Kurier e já fechados na Kurier. */
export function totaisDaConferencia(dias: DiaDaConferencia[]): ConferenciaDjenKurier["totais"] {
  const buscados = dias.filter((dia) => dia.buscado && dia.comKurier && !dia.emAberto);
  const soma = (campo: (dia: DiaDaConferencia) => number) => buscados.reduce((total, dia) => total + campo(dia), 0);
  const kurier = soma((dia) => dia.kurier);
  const nosDois = soma((dia) => dia.nosDois);
  return {
    djen: soma((dia) => dia.djen),
    kurier,
    nosDois,
    soDjen: soma((dia) => dia.soDjen.length),
    soKurier: soma((dia) => dia.soKurier.length),
    cobertura: kurier ? nosDois / kurier : null,
  };
}

/** Uma comunicação da API do DJEN (comunicaapi.pje.jus.br/api/v1/comunicacao), só os campos guardados. */
export interface ItemDaApiDjen {
  id?: number | string | null;
  data_disponibilizacao?: string | null;
  numeroprocessocommascara?: string | null;
  numero_processo?: string | null;
  siglaTribunal?: string | null;
  tipoComunicacao?: string | null;
  nomeOrgao?: string | null;
  nomeClasse?: string | null;
  ativo?: boolean | null;
  link?: string | null;
}

/** A comunicação da API como fica guardada; sem ID ou data, não vale. */
export function comunicacaoDaApi(item: ItemDaApiDjen, advogado: string): ComunicacaoDjenGuardada | null {
  const id = Number(item.id);
  const data = String(item.data_disponibilizacao ?? "").slice(0, 10);
  if (!Number.isFinite(id) || id <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const texto = (valor: string | null | undefined) => (valor && String(valor).trim()) || null;
  return {
    id,
    data,
    processo: texto(item.numeroprocessocommascara) ?? texto(item.numero_processo),
    tribunal: texto(item.siglaTribunal),
    tipo: texto(item.tipoComunicacao),
    orgao: texto(item.nomeOrgao),
    classe: texto(item.nomeClasse),
    advogados: [advogado],
    ativo: typeof item.ativo === "boolean" ? item.ativo : null,
    link: texto(item.link),
  };
}
