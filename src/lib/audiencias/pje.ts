import type { Modalidade, Mudanca, Situacao, TipoAudiencia } from "./tipos";

/**
 * Leitura da "Minha Pauta" do PJe da Justiça do Trabalho (pjekz/pauta-usuarios-externos). O robô chama
 * `GET /pje-comum-api/api/pauta-usuarios-externos?dataInicio&dataFim&codigoSituacao&numeroPagina&tamanhoPagina`
 * com a sessão do advogado e manda os registros como vieram; aqui eles viram audiências.
 *
 * O que se sabe (teste de 18/11/2026, TRT-15): `tipo.isVirtual` vem false em todas, então a modalidade sai
 * da descrição ("Una por videoconferência (rito sumaríssimo)"); a duração muitas vezes é de 1 minuto;
 * redesignar no PJe é cancelar o registro e criar outro (outro id).
 */

/** Registro como a API devolve (só os campos usados). */
export interface RegistroPjeBruto {
  id: number | string;
  nrProcesso?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  status?: string | null;
  statusDescricao?: string | null;
  tipo?: { descricao?: string | null } | null;
  salaAudiencia?: { nome?: string | null } | null;
  urlAudienciaVirtual?: string | null;
  processo?: { numero?: string | null; juizoDigital?: boolean | null; orgaoJulgador?: { descricao?: string | null } | null } | null;
  poloAtivo?: { nome?: string | null } | null;
  poloPassivo?: { nome?: string | null } | null;
}

/** A audiência normalizada, pronta para gravar. */
export interface RegistroTribunal {
  chave: string;
  idOrigem: string;
  tribunal: string;
  cnj: string;
  inicio: string;
  fim: string | null;
  tipo: TipoAudiencia;
  tipoDescricao: string;
  ritoSumarissimo: boolean;
  modalidade: Modalidade;
  orgao: string | null;
  sala: string | null;
  juizoDigital: boolean | null;
  situacao: Situacao;
  link: string | null;
  clienteNoTribunal: string | null;
  reclamanteIniciais: string | null;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function tipoDaDescricao(descricao: string | null | undefined): TipoAudiencia {
  const t = semAcento(descricao ?? "");
  if (/encerramento/.test(t)) return "encerramento";
  if (/\buna\b/.test(t)) return "una";
  if (/inicial/.test(t)) return "inicial";
  if (/instru/.test(t)) return "instrucao";
  if (/concilia|mediac/.test(t)) return "conciliacao";
  if (/sess[aã]o/.test(t)) return "sessao";
  if (/julgamento/.test(t)) return "julgamento";
  if (/peric/.test(t)) return "pericia";
  return "outro";
}

export function modalidadeDaDescricao(descricao: string | null | undefined): Modalidade {
  const t = semAcento(descricao ?? "");
  if (/hibrid|semipresencial|semi-presencial/.test(t)) return "hibrida";
  if (/videoconfer|telepresencial|virtual|telematica/.test(t)) return "video";
  return "presencial";
}

export function situacaoDoPje(status: string | null | undefined, descricao: string | null | undefined): Situacao {
  const t = semAcento(`${descricao ?? ""} ${status ?? ""}`);
  if (/cancel/.test(t) || (status ?? "").toUpperCase() === "C") return "cancelada";
  if (/realiz/.test(t) || (status ?? "").toUpperCase() === "R") return "realizada";
  return "designada";
}

/** "AYLTON DIAS DOS SANTOS" → "A. D. S." (sem preposições): a pauta não guarda o nome do reclamante. */
export function iniciais(nome: string | null | undefined): string | null {
  const partes = (nome ?? "")
    .trim()
    .split(/\s+/)
    .filter((p) => p && !/^(d[aeo]s?|e)$/i.test(p));
  if (!partes.length) return null;
  return partes.map((p) => `${p[0]!.toUpperCase()}.`).join(" ");
}

/** O PJe manda a hora local sem fuso ("2026-11-19T08:40:00"); Brasília não tem horário de verão desde 2019. */
export function horaLocalParaIso(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  const m = texto.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4] ?? "00"}-03:00`).toISOString();
}

export function limparLink(url: string | null | undefined): string | null {
  const texto = (url ?? "").trim();
  if (!/^https?:\/\//i.test(texto)) return null;
  return texto;
}

/** Só o essencial do link para comparar (sem senha nem parâmetros): troca de sala muda isso. */
export function chaveDoLink(url: string | null | undefined): string | null {
  const limpo = limparLink(url);
  if (!limpo) return null;
  try {
    const u = new URL(limpo);
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return limpo.toLowerCase();
  }
}

export function cnjComMascara(valor: string | null | undefined): string | null {
  const d = (valor ?? "").replace(/\D/g, "");
  if (d.length !== 20) return null;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

export function normalizarRegistroPje(bruto: RegistroPjeBruto, tribunal: string): RegistroTribunal | null {
  const cnj = cnjComMascara(bruto.nrProcesso ?? bruto.processo?.numero ?? null);
  const inicio = horaLocalParaIso(bruto.dataInicio);
  if (!cnj || !inicio || bruto.id === undefined || bruto.id === null) return null;
  const descricao = (bruto.tipo?.descricao ?? "").trim() || "Audiência";
  return {
    chave: `pje:${tribunal}:${bruto.id}`,
    idOrigem: String(bruto.id),
    tribunal,
    cnj,
    inicio,
    fim: horaLocalParaIso(bruto.dataFim),
    tipo: tipoDaDescricao(descricao),
    tipoDescricao: descricao,
    ritoSumarissimo: /sumar/i.test(semAcento(descricao)),
    modalidade: modalidadeDaDescricao(descricao),
    orgao: bruto.processo?.orgaoJulgador?.descricao?.trim() || null,
    sala: bruto.salaAudiencia?.nome?.trim() || null,
    juizoDigital: bruto.processo?.juizoDigital ?? null,
    situacao: situacaoDoPje(bruto.status, bruto.statusDescricao),
    link: limparLink(bruto.urlAudienciaVirtual),
    clienteNoTribunal: bruto.poloPassivo?.nome?.trim() || null,
    reclamanteIniciais: iniciais(bruto.poloAtivo?.nome),
  };
}

/** Diferenças relevantes entre dois registros da mesma audiência. Link que só apareceu não conta como mudança. */
export function diferencas(
  antes: Pick<RegistroTribunal, "tipo" | "inicio" | "orgao" | "link">,
  depois: Pick<RegistroTribunal, "tipo" | "inicio" | "orgao" | "link">
): Mudanca[] {
  const mudancas: Mudanca[] = [];
  if (antes.tipo !== depois.tipo) mudancas.push("tipo");
  if (new Date(antes.inicio).getTime() !== new Date(depois.inicio).getTime()) mudancas.push("horario");
  if ((antes.orgao ?? "") && (depois.orgao ?? "") && semAcento(antes.orgao!) !== semAcento(depois.orgao!)) mudancas.push("vara");
  const [la, ld] = [chaveDoLink(antes.link), chaveDoLink(depois.link)];
  if (la && ld && la !== ld) mudancas.push("link");
  return mudancas;
}

/** Janela para ligar um registro cancelado ao novo da mesma audiência. */
const JANELA_REDESIGNACAO_MS = 120 * 24 * 60 * 60 * 1000;

export interface Redesignacao {
  /** Chave do registro designado. */
  chave: string;
  /** Registros cancelados que ele substitui (mais antigos no PJe). */
  substitui: string[];
  mudancas: Mudanca[];
  /** Link do registro cancelado, quando a sala mudou. */
  linkAnterior: string | null;
}

/**
 * Numa leitura, liga cada audiência designada aos registros cancelados do mesmo processo que vieram antes
 * dela (id menor no PJe, data perto) e diz o que mudou. Cancelado sem nenhum designado do processo fica de fora
 * (é cancelamento puro). Ids que não são números caem na ordem de leitura.
 */
export function ligarRedesignacoes(registros: RegistroTribunal[]): Redesignacao[] {
  const porProcesso = new Map<string, RegistroTribunal[]>();
  for (const r of registros) porProcesso.set(r.cnj, [...(porProcesso.get(r.cnj) ?? []), r]);
  const ordem = (r: RegistroTribunal) => {
    const n = Number(r.idOrigem);
    return Number.isFinite(n) ? n : registros.indexOf(r);
  };
  const resultado: Redesignacao[] = [];
  for (const lista of porProcesso.values()) {
    const designadas = lista.filter((r) => r.situacao === "designada");
    const canceladas = lista.filter((r) => r.situacao === "cancelada");
    for (const atual of designadas) {
      const anteriores = canceladas.filter(
        (c) => ordem(c) < ordem(atual) && Math.abs(new Date(c.inicio).getTime() - new Date(atual.inicio).getTime()) <= JANELA_REDESIGNACAO_MS
      );
      if (!anteriores.length) continue;
      const mudancas = new Set<Mudanca>();
      let linkAnterior: string | null = null;
      for (const c of anteriores) {
        for (const m of diferencas(c, atual)) mudancas.add(m);
        if (!linkAnterior && chaveDoLink(c.link) && chaveDoLink(c.link) !== chaveDoLink(atual.link) && atual.link) linkAnterior = c.link;
      }
      resultado.push({ chave: atual.chave, substitui: anteriores.map((c) => c.chave), mudancas: [...mudancas], linkAnterior });
    }
  }
  return resultado;
}

/** Cancelamentos sem nova data: processo com registro cancelado e nenhum designado na leitura. */
export function canceladasSemNovaData(registros: RegistroTribunal[]): RegistroTribunal[] {
  const comDesignada = new Set(registros.filter((r) => r.situacao === "designada").map((r) => r.cnj));
  return registros.filter((r) => r.situacao === "cancelada" && !comDesignada.has(r.cnj));
}
