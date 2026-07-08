/**
 * Status ativo/inativo de clientes — mapeado via SIOE PRO (faturamento previsto + categoria).
 */

import { normalizeCompanyName } from "@/lib/email-marketing-normalize";

export type SioeClienteAtividade = "ativo" | "inativo";

export interface SioeClienteAtividadeIndex {
  byGrupoKey: Record<string, SioeClienteAtividade>;
  byPessoaId: Record<string, SioeClienteAtividade>;
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
  return { byGrupoKey: {}, byPessoaId: {}, grupoNames: {}, mesReferencia };
}

export const SIOE_INATIVO_GROUP_PREFIX = "sioe-inativo:";

/** Grupos inativos no SIOE que ainda não existem na base local (para admin). */
export function listSioeOnlyInactiveGroups(
  index: SioeClienteAtividadeIndex,
  existingGroupKeys: Set<string>
): { key: string; name: string }[] {
  const result: { key: string; name: string }[] = [];
  for (const [grupoKey, status] of Object.entries(index.byGrupoKey)) {
    if (status !== "inativo" || existingGroupKeys.has(grupoKey)) continue;
    result.push({
      key: `${SIOE_INATIVO_GROUP_PREFIX}${grupoKey}`,
      name: index.grupoNames[grupoKey] ?? grupoKey,
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
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
