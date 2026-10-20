import { searchKey, type ComboOption } from "./combo-search";

/**
 * Bancos para o campo "Banco" da ficha. A lista completa vem da BrasilAPI
 * (código COMPE + nome), mas os nomes de lá são crus ("BCO BRADESCO S.A.",
 * "NU PAGAMENTOS - IP"); os mais usados ganham nome amigável e aparecem primeiro.
 * Valor guardado: "Itaú Unibanco (341)".
 */

export interface Bank {
  code: number;
  name: string;
}

/** Ordem de uso mais comum; nomes como as pessoas conhecem. */
export const POPULAR_BANKS: readonly Bank[] = [
  { code: 341, name: "Itaú Unibanco" },
  { code: 237, name: "Bradesco" },
  { code: 1, name: "Banco do Brasil" },
  { code: 104, name: "Caixa Econômica Federal" },
  { code: 33, name: "Santander" },
  { code: 260, name: "Nubank" },
  { code: 77, name: "Banco Inter" },
  { code: 336, name: "C6 Bank" },
  { code: 208, name: "BTG Pactual" },
  { code: 756, name: "Sicoob" },
  { code: 748, name: "Sicredi" },
  { code: 323, name: "Mercado Pago" },
  { code: 380, name: "PicPay" },
  { code: 290, name: "PagBank (PagSeguro)" },
  { code: 422, name: "Safra" },
  { code: 212, name: "Banco Original" },
  { code: 655, name: "Banco BV" },
  { code: 623, name: "Banco Pan" },
  { code: 41, name: "Banrisul" },
  { code: 70, name: "BRB" },
  { code: 197, name: "Stone" },
  { code: 403, name: "Cora" },
];

const POPULAR_BY_CODE = new Map(POPULAR_BANKS.map((bank) => [bank.code, bank.name]));

export function bankCode(code: number): string {
  return String(code).padStart(3, "0");
}

export function bankValue(bank: Bank): string {
  return `${bank.name} (${bankCode(bank.code)})`;
}

const PARTICLES = new Set(["de", "do", "da", "dos", "das", "e"]);
/** Siglas com vogal que não podem virar palavra ("Ip", "Abc"). */
const KNOWN_ACRONYMS = new Set(["IP", "ABC", "UBS", "ICBC", "CEF", "DTVM", "SCFI", "SCD", "SCM", "BNDES", "BRDE"]);

function isAcronym(word: string): boolean {
  const letters = word.replace(/[^\p{L}\d]/gu, "");
  if (!letters) return false;
  return /\d/.test(letters) || !/[AEIOUÁÉÍÓÚÂÊÔÃÕÀ]/.test(letters) || KNOWN_ACRONYMS.has(letters);
}

/** "BCO BRADESCO S.A." → "Banco Bradesco"; "BCO SANTANDER (BRASIL) S.A." → "Banco Santander (Brasil)". */
export function cleanBankName(raw: string): string {
  const base = raw
    .replace(/\bBCO\b\.?/gi, "BANCO")
    .replace(/\s*\b(?:S\.?\/?A\.?|LTDA\.?)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return base
    .split(" ")
    .map((word, index) => {
      const upper = word.toUpperCase();
      const lower = word.toLowerCase();
      if (index > 0 && PARTICLES.has(lower)) return lower;
      if (isAcronym(upper)) return upper;
      return lower.replace(/\p{L}/u, (letter) => letter.toUpperCase());
    })
    .join(" ");
}

/** Normaliza a lista crua da BrasilAPI; os populares ganham o nome amigável. */
export function normalizeBanks(raw: { code?: number | null; name?: string | null }[]): Bank[] {
  const seen = new Set<number>();
  const banks: Bank[] = [];
  for (const item of raw) {
    if (typeof item.code !== "number" || seen.has(item.code) || !item.name) continue;
    seen.add(item.code);
    banks.push({ code: item.code, name: POPULAR_BY_CODE.get(item.code) ?? cleanBankName(item.name) });
  }
  return banks.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function bankOption(bank: Bank): ComboOption {
  return {
    value: bankValue(bank),
    label: bank.name,
    hint: bankCode(bank.code),
    keywords: `${bank.code} ${bankCode(bank.code)}`,
  };
}

/** Banco da lista para o que já estava salvo: pelo código entre parênteses ou pelo nome. */
export function matchBank(value: string, banks: readonly Bank[]): string | null {
  const text = value.trim();
  if (!text) return null;
  const code = text.match(/\((\d{1,3})\)\s*$/)?.[1];
  if (code) {
    const bank = banks.find((item) => item.code === Number(code));
    if (bank) return bankValue(bank);
  }
  const key = searchKey(text.replace(/\(\d{1,3}\)\s*$/, ""));
  const bank = banks.find((item) => searchKey(item.name) === key);
  return bank ? bankValue(bank) : null;
}

let cache: Promise<Bank[]> | null = null;

/** Lista completa pela rota /api/bancos (uma busca por sessão do navegador). */
export function loadBancos(): Promise<Bank[]> {
  if (cache) return cache;
  cache = fetch("/api/bancos")
    .then(async (response) => {
      if (!response.ok) throw new Error("bancos");
      const data = (await response.json()) as { banks?: Bank[] };
      return data.banks ?? [];
    })
    .catch((error: unknown) => {
      cache = null;
      throw error;
    });
  return cache;
}
