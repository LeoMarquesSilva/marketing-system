/**
 * Conferência DJEN × Kurier (pedido de 11/11/2026): o que a API pública do DJEN traz para o Gustavo e o Ricardo,
 * comparado com o que a Kurier trouxe no mesmo dia de disponibilização. Só estudo: não muda nada no fluxo.
 *
 * O par é pelo ID de comunicação do DJEN, que a Kurier também traz (djen_id_comunicacao). A publicação da Kurier sem
 * esse ID casa com uma comunicação do DJEN do mesmo processo no mesmo dia.
 */

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
  status: string;
}

export interface DiaDaConferencia {
  /** AAAA-MM-DD */
  data: string;
  /** Houve busca no DJEN para este dia (sem busca, os números do DJEN não valem). */
  buscado: boolean;
  djen: number;
  kurier: number;
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
}

const digitos = (processo: string | null | undefined) => String(processo ?? "").replace(/\D/g, "");

/** Os dias de um período, do mais novo ao mais antigo (AAAA-MM-DD). */
export function diasDoPeriodo(ate: string, quantos: number): string[] {
  const [ano, mes, dia] = ate.split("-").map(Number);
  return Array.from({ length: quantos }, (_, indice) => new Date(Date.UTC(ano, mes - 1, dia - indice)).toISOString().slice(0, 10));
}

/** O dia anterior (AAAA-MM-DD). */
export const diaAnterior = (dia: string) => diasDoPeriodo(dia, 2)[1];

/**
 * Compara, dia a dia, o que o DJEN trouxe com o que a Kurier trouxe. Uma publicação da Kurier vale uma vez por ID de
 * comunicação (a mesma pode vir repetida em arquivos diferentes). O par pelo ID vale em qualquer dia do período; a
 * contagem fica no dia de cada lado.
 */
export function compararDjenKurier(
  djen: ComunicacaoDjenGuardada[],
  kurier: PublicacaoKurier[],
  dias: string[],
  diasBuscados: Set<string>
): DiaDaConferencia[] {
  const djenPorId = new Map(djen.map((item) => [item.id, item]));
  // Kurier sem repetir: pelo ID de comunicação, quando tem; senão, cada publicação.
  const kurierUnicas = [...new Map(kurier.map((item) => [item.djenId ? `id:${item.djenId}` : `pub:${item.id}`, item])).values()];
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

  return dias.map((data) => {
    const buscado = diasBuscados.has(data);
    const doDjen = djen.filter((item) => item.data === data);
    const daKurier = kurierUnicas.filter((item) => item.data === data);
    const soKurier = buscado ? daKurier.filter((item) => !casaKurier.get(item.id)) : [];
    const nosDois = daKurier.length - (buscado ? soKurier.length : daKurier.length);
    return {
      data,
      buscado,
      djen: doDjen.length,
      kurier: daKurier.length,
      nosDois,
      soDjen: doDjen.filter((item) => !casadas.has(item.id)),
      soKurier,
      cobertura: buscado && daKurier.length ? nosDois / daKurier.length : null,
    };
  });
}

/** Soma dos dias buscados (os sem busca não entram). */
export function totaisDaConferencia(dias: DiaDaConferencia[]): ConferenciaDjenKurier["totais"] {
  const buscados = dias.filter((dia) => dia.buscado);
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
