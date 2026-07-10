/**
 * Status ativo/inativo de clientes — mapeado via SIOE PRO (faturamento previsto + categoria).
 */

import { normalizeCompanyName } from "@/lib/email-marketing-normalize";

export type SioeClienteAtividade = "ativo" | "inativo";

export interface SioeClienteAtividadeIndex {
  byGrupoKey: Record<string, SioeClienteAtividade>;
  byPessoaId: Record<string, SioeClienteAtividade>;
  /** Status indicado pela categoria cadastral no SIOE, por grupo. */
  byGrupoCategoriaAtividade: Record<string, SioeClienteAtividade>;
  /** Status indicado pela categoria cadastral no SIOE, por pessoa. */
  byPessoaCategoriaAtividade: Record<string, SioeClienteAtividade>;
  /** Maior data de vencimento de faturamento previsto encontrada por grupo (YYYY-MM-DD). */
  byGrupoPrevistoDate: Record<string, string>;
  /** Maior data de vencimento de faturamento previsto encontrada por pessoa (YYYY-MM-DD). */
  byPessoaPrevistoDate: Record<string, string>;
  /** Maior data de faturamento localizada no mês anterior, por grupo (YYYY-MM-DD). */
  byGrupoUltimoFaturamentoDate: Record<string, string>;
  /** Maior data de faturamento localizada no mês anterior, por pessoa (YYYY-MM-DD). */
  byPessoaUltimoFaturamentoDate: Record<string, string>;
  /** Próxima data de faturamento previsto localizada após o mês anterior, por grupo (YYYY-MM-DD). */
  byGrupoProximoPrevistoDate: Record<string, string>;
  /** Próxima data de faturamento previsto localizada após o mês anterior, por pessoa (YYYY-MM-DD). */
  byPessoaProximoPrevistoDate: Record<string, string>;
  /** Nome de exibição do grupo_cliente no SIOE (chave normalizada). */
  grupoNames: Record<string, string>;
  /** Mês usado para faturamento previsto (YYYY-MM). */
  mesReferencia: string;
}

function normalizePlanoContas(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/** Espelha public.plano_contas_na_cota no SIOE PRO. */
export function planoContasNaCota(planoContas: string | null | undefined): boolean {
  const t = normalizePlanoContas(planoContas ?? "");
  if (!t) return false;
  return (
    /^HONOR.*MENSAIS/.test(t) ||
    /^HONOR.*SPOT/.test(t) ||
    /^HONOR.*SUCUMB/.test(t) ||
    /^HONOR.*EXITO/.test(t) ||
    /^HONOR.*XITO/.test(t) ||
    /^HONOR.*MANUTEN/.test(t) ||
    /^HONOR.*HORA TRABALHADA/.test(t) ||
    /^HONOR.*ADVOCAT/.test(t)
  );
}

/** Chave para casar grupo_cliente SIOE com clientGroupName local. */
export function grupoClienteKey(name: string | null | undefined): string {
  const normalized = normalizeCompanyName(name);
  if (!normalized) return "";
  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function resolveSioePessoaId(customFields: Record<string, unknown> | null | undefined): string | null {
  const raw = customFields?.sioe_pessoa_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function isSioeCategoriaInativa(categoria: string | null | undefined): boolean {
  return (categoria ?? "").trim() === "Cliente inativo";
}

/** Espelha isActiveClient do sync SIOE. */
export function isSioeCategoriaAtiva(categoria: string | null | undefined): boolean {
  const normalized = (categoria ?? "").trim().toLowerCase();
  if (!normalized.includes("cliente ativo")) return false;
  if (normalized.includes("cliente inativo")) return false;
  return true;
}

export function emptySioeClienteAtividadeIndex(mesReferencia: string): SioeClienteAtividadeIndex {
  return {
    byGrupoKey: {},
    byPessoaId: {},
    byGrupoCategoriaAtividade: {},
    byPessoaCategoriaAtividade: {},
    byGrupoPrevistoDate: {},
    byPessoaPrevistoDate: {},
    byGrupoUltimoFaturamentoDate: {},
    byPessoaUltimoFaturamentoDate: {},
    byGrupoProximoPrevistoDate: {},
    byPessoaProximoPrevistoDate: {},
    grupoNames: {},
    mesReferencia,
  };
}

export const SIOE_INATIVO_GROUP_PREFIX = "sioe-inativo:";

/** Grupos inativos no SIOE que ainda não existem na base local (para admin). */
export function listSioeOnlyInactiveGroups(
  index: SioeClienteAtividadeIndex,
  existingGroupKeys: Set<string>
): { key: string; name: string }[] {
  const result: { key: string; name: string }[] = [];
  const source =
    Object.keys(index.byGrupoCategoriaAtividade).length > 0
      ? index.byGrupoCategoriaAtividade
      : index.byGrupoKey;
  for (const [grupoKey, status] of Object.entries(source)) {
    if (status !== "inativo" || existingGroupKeys.has(grupoKey)) continue;
    result.push({
      key: `${SIOE_INATIVO_GROUP_PREFIX}${grupoKey}`,
      name: index.grupoNames[grupoKey] ?? grupoKey,
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function resolveClienteCategoriaAtividade(
  index: SioeClienteAtividadeIndex,
  options: {
    grupoName?: string | null;
    sioePessoaId?: string | null;
  }
): SioeClienteAtividade | null {
  const pessoaId = options.sioePessoaId?.trim();
  if (pessoaId && index.byPessoaCategoriaAtividade[pessoaId]) {
    return index.byPessoaCategoriaAtividade[pessoaId];
  }
  const grupoKey = grupoClienteKey(options.grupoName);
  if (grupoKey && index.byGrupoCategoriaAtividade[grupoKey]) {
    return index.byGrupoCategoriaAtividade[grupoKey];
  }
  return null;
}

export function resolveClienteAtividade(
  index: SioeClienteAtividadeIndex,
  options: {
    grupoName?: string | null;
    sioePessoaId?: string | null;
  }
): SioeClienteAtividade | null {
  const pessoaId = options.sioePessoaId?.trim();
  if (pessoaId && index.byPessoaId[pessoaId]) {
    return index.byPessoaId[pessoaId];
  }
  const grupoKey = grupoClienteKey(options.grupoName);
  if (grupoKey && index.byGrupoKey[grupoKey]) {
    return index.byGrupoKey[grupoKey];
  }
  return null;
}

export interface SioeClienteFaturamentoIndicios {
  ultimoFaturamentoDate: string | null;
  proximoPrevistoDate: string | null;
  anyDate: string | null;
}

export function resolveClientePrevistoDate(
  index: SioeClienteAtividadeIndex,
  options: {
    grupoName?: string | null;
    sioePessoaId?: string | null;
  }
): string | null {
  const indicios = resolveClienteFaturamentoIndicios(index, options);
  return indicios.anyDate;
}

export function resolveClienteFaturamentoIndicios(
  index: SioeClienteAtividadeIndex,
  options: {
    grupoName?: string | null;
    sioePessoaId?: string | null;
  }
): SioeClienteFaturamentoIndicios {
  const pessoaId = options.sioePessoaId?.trim();
  if (pessoaId) {
    const ultimoFaturamentoDate = index.byPessoaUltimoFaturamentoDate[pessoaId] ?? null;
    const proximoPrevistoDate = index.byPessoaProximoPrevistoDate[pessoaId] ?? null;
    const anyDate =
      ultimoFaturamentoDate ?? proximoPrevistoDate ?? index.byPessoaPrevistoDate[pessoaId] ?? null;
    if (anyDate) return { ultimoFaturamentoDate, proximoPrevistoDate, anyDate };
  }
  const grupoKey = grupoClienteKey(options.grupoName);
  if (grupoKey) {
    const ultimoFaturamentoDate = index.byGrupoUltimoFaturamentoDate[grupoKey] ?? null;
    const proximoPrevistoDate = index.byGrupoProximoPrevistoDate[grupoKey] ?? null;
    const anyDate =
      ultimoFaturamentoDate ?? proximoPrevistoDate ?? index.byGrupoPrevistoDate[grupoKey] ?? null;
    return { ultimoFaturamentoDate, proximoPrevistoDate, anyDate };
  }
  return { ultimoFaturamentoDate: null, proximoPrevistoDate: null, anyDate: null };
}

export function clienteAtividadeTooltip(
  status: SioeClienteAtividade,
  mesReferencia: string
): string {
  const [year, month] = mesReferencia.split("-");
  const mesLabel = month && year ? `${month}/${year}` : mesReferencia;
  if (status === "ativo") {
    return `Cliente ativo${mesLabel ? ` (ref. faturamento ${mesLabel})` : ""}.`;
  }
  return "Cliente inativo.";
}
