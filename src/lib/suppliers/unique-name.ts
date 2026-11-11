/**
 * Um nome, um cadastro. `event_suppliers` é o cadastro único de fornecedores
 * e prestadores (eventos e Facilities): nenhum dos dois módulos pode criar
 * um segundo registro com o nome de um que já existe.
 *
 * "Mesmo nome" não diferencia maiúscula, acento e espaços. No banco, a função
 * `public.supplier_name_key(text)` faz a mesma conta para o índice único
 * (migration 20261110205215_event_suppliers_nome_unico.sql).
 */

/** "  Pão de  Açúcar CAMBUÍ " → "pao de acucar cambui". */
export function normalizeSupplierName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface SupplierNameCandidate {
  id: string;
  name: string;
  document?: string | null;
  created_at?: string | null;
}

/**
 * Cadastro existente com o mesmo nome. Se já houver mais de um (duplicados
 * antigos), fica o que tem CNPJ; empatando, o mais antigo.
 */
export function pickExistingSupplier<T extends SupplierNameCandidate>(candidates: T[], name: string): T | null {
  const key = normalizeSupplierName(name);
  if (!key) return null;
  const same = candidates.filter((candidate) => normalizeSupplierName(candidate.name) === key);
  if (same.length === 0) return null;
  return [...same].sort((a, b) => {
    const docA = a.document?.trim() ? 0 : 1;
    const docB = b.document?.trim() ? 0 : 1;
    if (docA !== docB) return docA - docB;
    const byDate = (a.created_at ?? "").localeCompare(b.created_at ?? "");
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  })[0];
}

/**
 * Cadastro que impede salvar `name`: outro registro (fora `exceptId`, o que
 * está sendo editado) com o mesmo nome. Vale com ou sem CNPJ: filial entra
 * com um nome que diferencia a unidade (ex.: "Pão de Açúcar Cambuí"), porque
 * os eventos escolhem o prestador pelo nome.
 */
export function findSupplierNameConflict<T extends SupplierNameCandidate>(
  candidates: T[],
  name: string,
  exceptId?: string | null
): T | null {
  return pickExistingSupplier(
    exceptId ? candidates.filter((candidate) => candidate.id !== exceptId) : candidates,
    name
  );
}

/** Índices únicos de `event_suppliers` no banco. */
export const SUPPLIER_NAME_INDEX = "event_suppliers_name_unique";
export const SUPPLIER_DOCUMENT_INDEX = "event_suppliers_document_key";

/**
 * Qual trava do banco recusou a gravação (erro 23505 do Postgres), para a API
 * responder em português em vez de "duplicate key value violates…".
 */
export function supplierUniqueViolation(
  error: { code?: string; message?: string; details?: string } | null | undefined
): "name" | "document" | null {
  if (error?.code !== "23505") return null;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  if (text.includes(SUPPLIER_NAME_INDEX)) return "name";
  if (text.includes(SUPPLIER_DOCUMENT_INDEX)) return "document";
  return null;
}

/** Texto do aviso quando o nome já está no cadastro. */
export function duplicateSupplierNameMessage(existing: { name: string }): string {
  return `Já existe um cadastro com este nome: ${existing.name}. Abra o cadastro existente em vez de criar outro.`;
}
