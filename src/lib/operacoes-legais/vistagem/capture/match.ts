import { POSSIVEL_ABERTURA, type ProcessBaseRow, type PublicationStatus } from "@/lib/operacoes-legais/vistagem/types";
import { normalizeDiario } from "@/lib/operacoes-legais/vistagem/rules/diario-map";

export type KurrierRow = {
  source_filename?: string | null;
  data_recebimento?: string | null;
  data_divulgacao?: string | null;
  data_publicacao?: string | null;
  numero_processo?: string | null;
  diario_divisao?: string | null;
  advogado_localizado?: string | null;
  publicacao?: string | null;
  titulo?: string | null;
};

export type MatchedPublication = {
  origem: string;
  source_filename: string | null;
  data_recebimento: string | null;
  advogado_localizado: string | null;
  data_divulgacao: string | null;
  data_publicacao: string | null;
  diario_divisao: string | null;
  pasta: string | null;
  numero_processo: string | null;
  publicacao: string | null;
  responsavel_principal: string | null;
  escritorio_responsavel: string | null;
  grupo: string | null;
  cliente_principal: string | null;
  natureza: string | null;
  status_processo: string | null;
  acao: string | null;
  fase: string | null;
  processo_encerrado: string | null;
  motivo_encerramento: string | null;
  titulo: string | null;
  demanda_risco: boolean;
  status: PublicationStatus;
  ci: string | null;
};

function normalizeCnj(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, "").trim();
  if (!cleaned || /fora do padr[aã]o/i.test(cleaned)) return null;
  return cleaned;
}

/** Dedup por CNJ: Ativo > Suspenso > demais (1ª linha). */
export function pickProcessForCnj(rows: ProcessBaseRow[]): ProcessBaseRow | null {
  if (!rows.length) return null;
  const ativo = rows.find((r) => (r.situacao || "").toLowerCase() === "ativo");
  if (ativo) return ativo;
  const susp = rows.find((r) => (r.situacao || "").toLowerCase() === "suspenso");
  if (susp) return susp;
  return rows[0];
}

export function matchKurrierRow(
  row: KurrierRow,
  processByCnj: Map<string, ProcessBaseRow[]>,
  diarioMap?: Record<string, string>,
): MatchedPublication {
  const cnj = normalizeCnj(row.numero_processo);
  const candidates = cnj ? processByCnj.get(cnj) ?? [] : [];
  const proc = pickProcessForCnj(candidates);

  const demandaFromTitle = Boolean(
    proc?.titulo && /demanda de risco/i.test(proc.titulo),
  );
  const demandaFromFlag = Boolean(
    proc?.demanda_risco && /^(sim|s|1)$/i.test(proc.demanda_risco.trim()),
  );

  let escritorio = proc?.escritorio_responsavel
    ? proc.escritorio_responsavel.toUpperCase()
    : null;
  let pasta: string | null = null;
  let ci: string | null = proc?.ci ?? null;

  if (proc?.vinculo && proc?.ci) {
    pasta = `${proc.vinculo} - CI ${proc.ci}`;
  } else if (proc?.ci) {
    pasta = `CI ${proc.ci}`;
  }

  let status: PublicationStatus = "JURIDICO_VISTAR";
  if (!escritorio) {
    escritorio = POSSIVEL_ABERTURA;
    status = "MATCH_PENDENTE";
  }
  if (!pasta) {
    pasta = POSSIVEL_ABERTURA;
    if (status === "JURIDICO_VISTAR") status = "MATCH_PENDENTE";
  }

  return {
    origem: "KURRIER",
    source_filename: row.source_filename ?? null,
    data_recebimento: row.data_recebimento ?? null,
    advogado_localizado: row.advogado_localizado ?? null,
    data_divulgacao: row.data_divulgacao ?? null,
    data_publicacao: row.data_publicacao ?? null,
    diario_divisao: normalizeDiario(row.diario_divisao, diarioMap),
    pasta,
    numero_processo: cnj,
    publicacao: row.publicacao ?? null,
    responsavel_principal: proc?.advogado_responsavel ?? null,
    escritorio_responsavel: escritorio,
    grupo: proc?.grupo ?? null,
    cliente_principal: proc?.cliente ?? null,
    natureza: proc?.area ?? null,
    status_processo: proc?.situacao ?? null,
    acao: proc?.acao ?? null,
    fase: proc?.fase ?? null,
    processo_encerrado: proc?.processo_encerrado ?? null,
    motivo_encerramento: null,
    titulo: proc?.titulo
      ? proc.titulo.replace(/demanda de risco/gi, "").trim()
      : row.titulo ?? null,
    demanda_risco: demandaFromTitle || demandaFromFlag,
    status,
    ci,
  };
}

/** Regras tributário do manual ID1. */
export function applyTributarioRules(input: {
  escritorio_responsavel: string | null;
  grupo: string | null;
}): { escritorio_responsavel: string | null; skip: boolean } {
  const esc = (input.escritorio_responsavel || "").toUpperCase();
  const grupo = (input.grupo || "").toLowerCase();
  if (esc !== "TRIBUTÁRIO" && esc !== "TRIBUTARIO") {
    return { escritorio_responsavel: input.escritorio_responsavel, skip: false };
  }
  const allowed = ["felicita", "verdeco", "bilateral", "mazda", "palash"];
  if (!grupo) return { escritorio_responsavel: "TRIBUTÁRIO", skip: false };
  if (grupo.includes("verdeco") || grupo.includes("palash")) {
    return { escritorio_responsavel: "TRIBUTÁRIO", skip: false };
  }
  if (allowed.some((g) => grupo.includes(g))) {
    return { escritorio_responsavel: "TRIBUTÁRIO", skip: false };
  }
  return { escritorio_responsavel: "INSOLVÊNCIA", skip: false };
}
