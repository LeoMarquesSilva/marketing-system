/**
 * Um nome, um cadastro. `event_suppliers` é o cadastro único de fornecedores
 * e prestadores (eventos e Facilities), então o módulo de eventos não pode
 * criar um segundo registro com o nome de um que já existe.
 *
 * Em 27/10/2026, 13 envios do "Novo prestador" chegaram juntos ao banco e
 * viraram 13 cadastros "Pão de Açúcar Cambuí". Daqui saem as travas:
 * - procurar o nome (sem diferenciar maiúscula, acento e espaços) antes de inserir;
 * - juntar numa só gravação os envios simultâneos do mesmo nome.
 *
 * A regra do nome (normalizar e achar o cadastro existente) é a mesma de
 * Facilities e mora em `@/lib/suppliers/unique-name`.
 */

export {
  normalizeSupplierName,
  pickExistingSupplier,
  type SupplierNameCandidate,
} from "@/lib/suppliers/unique-name";

/** Contatos que o "Novo prestador" pode completar num cadastro que já existe. */
export const SUPPLIER_CONTACT_COLUMNS = [
  "contact_name",
  "phone",
  "email",
  "website_link",
  "instagram_link",
  "portfolio_link",
  "whatsapp_link",
] as const;

export type SupplierContactColumn = (typeof SUPPLIER_CONTACT_COLUMNS)[number];

/**
 * O que foi digitado só entra onde o cadastro existente está vazio: nada do
 * que já está lá (inclusive o que Facilities preencheu) é trocado.
 */
export function fillEmptyContactPatch(
  existing: Partial<Record<SupplierContactColumn, string | null>>,
  typed: Partial<Record<SupplierContactColumn, string | null | undefined>>
): Partial<Record<SupplierContactColumn, string>> {
  const patch: Partial<Record<SupplierContactColumn, string>> = {};
  for (const column of SUPPLIER_CONTACT_COLUMNS) {
    const current = existing[column]?.trim();
    const incoming = typed[column]?.trim();
    if (!current && incoming) patch[column] = incoming;
  }
  return patch;
}

/**
 * Enquanto uma gravação de uma chave está em andamento, quem pedir a mesma
 * chave recebe a mesma promessa em vez de gravar de novo.
 */
export function createKeyedSingleFlight<T>() {
  const pending = new Map<string, Promise<T>>();
  return function run(key: string, task: () => Promise<T>): Promise<T> {
    const current = pending.get(key);
    if (current) return current;
    const promise = (async () => task())().finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}

export interface FindOrCreateDeps<T> {
  findExisting: (name: string) => Promise<T | null>;
  create: () => Promise<T | null>;
  /** Completa o cadastro encontrado (ex.: contatos vazios). */
  complete?: (existing: T) => Promise<T>;
}

export interface FindOrCreateResult<T> {
  supplier: T;
  /** true quando o nome já existia e nada novo foi criado. */
  reused: boolean;
}

/**
 * O banco recusou a gravação pelo índice único de nome
 * (`event_suppliers_name_unique`): o nome entrou entre a busca e a gravação,
 * vindo de outro servidor, outra aba ou Facilities.
 */
export class SupplierNameTakenError extends Error {
  constructor(name: string) {
    super(`Já existe um cadastro com o nome "${name}".`);
    this.name = "SupplierNameTakenError";
  }
}

export async function findOrCreateSupplier<T>(
  name: string,
  deps: FindOrCreateDeps<T>
): Promise<FindOrCreateResult<T> | null> {
  const reuse = async (existing: T): Promise<FindOrCreateResult<T>> => ({
    supplier: deps.complete ? await deps.complete(existing) : existing,
    reused: true,
  });

  const existing = await deps.findExisting(name);
  if (existing) return reuse(existing);

  try {
    const created = await deps.create();
    return created ? { supplier: created, reused: false } : null;
  } catch (error) {
    if (!(error instanceof SupplierNameTakenError)) throw error;
    // Outro envio gravou o mesmo nome no meio do caminho: usa o que ele criou.
    const winner = await deps.findExisting(name);
    if (!winner) throw error;
    return reuse(winner);
  }
}

/** Aviso ao renomear um prestador para o nome de outro cadastro. */
export function supplierRenameConflictMessage(existing: { name: string }): string {
  return `Já existe outro cadastro com este nome: ${existing.name}. Use um nome que diferencie, como a unidade.`;
}
