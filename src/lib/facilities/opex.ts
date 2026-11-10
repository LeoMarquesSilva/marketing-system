/**
 * Ligação do cadastro de fornecedores com o OPEX (financeiro).
 *
 * O OPEX identifica o fornecedor pelo nome do terceiro no SIOE ("Reuniao
 * Construtora e Administradora de Bens L…"), que quase nunca é igual ao nome
 * usado no escritório. Por isso o vínculo é confirmado por uma pessoa
 * (opex_names no cadastro); aqui ficam só as sugestões e o resumo do que foi pago.
 */

export interface OpexPayment {
  fornecedor: string;
  mes: string; // AAAA-MM-01
  departamento: string;
  departamento_tipo: string | null;
  grupo_conta: string;
  plano_contas: string;
  valor_pago: number;
}

export type OpexAllocation = "indireto" | "direto" | "misto" | "outro";

export interface OpexSummary {
  /** Total pago nos últimos 12 meses fechados + mês corrente. */
  total12m: number;
  monthlyAverage: number;
  /** Doze valores, do mais antigo ao mês atual. */
  months: Array<{ mes: string; valor: number }>;
  byDepartment: Array<{ departamento: string; tipo: string | null; valor: number }>;
  allocation: OpexAllocation;
  /** Área quando o custo é direto de uma só. */
  mainArea: string | null;
  mainAccount: string | null;
  lastPaymentMonth: string | null;
}

const LEGAL_WORDS = new Set([
  "ltda",
  "ltd",
  "sa",
  "s",
  "a",
  "me",
  "epp",
  "eireli",
  "mei",
  "cia",
  "companhia",
  "sociedade",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "com",
  "the",
]);

/** "Vivo S.a Telefônica Brasil S.a" → ["vivo", "telefonica", "brasil"]. */
export function companyTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 1 && !LEGAL_WORDS.has(word));
}

export function normalizeCompanyName(name: string): string {
  return companyTokens(name).join(" ");
}

/**
 * A palavra aparece no outro nome. A última palavra também vale pelo começo,
 * porque o SIOE corta nomes longos ("…Administradora de Bens L").
 */
function wordIn(word: string, isLast: boolean, others: string[]): boolean {
  if (others.includes(word)) return true;
  const lastOther = others[others.length - 1];
  if (isLast && word.length >= 3 && others.some((other) => other.startsWith(word))) return true;
  return lastOther.length >= 3 && word.startsWith(lastOther);
}

/**
 * Parecença entre dois nomes (0–1): fração das palavras do nome mais curto que
 * aparecem no mais longo. A primeira palavra do mais curto (a que identifica a
 * empresa) precisa estar no outro, senão "Comércio" e "Tecnologia" casariam tudo.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = companyTokens(a);
  const tb = companyTokens(b);
  if (!ta.length || !tb.length) return 0;
  if (ta.join(" ") === tb.join(" ")) return 1;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length === 1) return long[0] === short[0] ? 0.9 : 0;
  if (!wordIn(short[0], false, long)) return 0;
  const hits = short.filter((word, index) => wordIn(word, index === short.length - 1, long)).length;
  return hits / short.length;
}

export interface OpexNameOption {
  fornecedor: string;
  total: number;
}

/** Até três nomes do OPEX parecidos com o fornecedor (nome do escritório ou razão social). */
export function suggestOpexNames<T extends OpexNameOption>(
  supplier: { name: string; legal_name: string | null },
  options: T[],
  taken: Set<string> = new Set()
): Array<T & { score: number }> {
  // "UTI COMPUTADORES / CLEBER R FELIX": cada lado da barra é um nome possível.
  const names = [supplier.name.replace(/\(.*?\)/g, " "), ...(supplier.legal_name ?? "").split("/")].filter((n) => n.trim());
  return options
    .filter((option) => !taken.has(option.fornecedor))
    .map((option) => ({ ...option, score: Math.max(...names.map((n) => nameSimilarity(n, option.fornecedor))) }))
    .filter((option) => option.score >= 0.6)
    .sort((a, b) => b.score - a.score || b.total - a.total)
    .slice(0, 3);
}

function addMonthsIso(mes: string, months: number): string {
  const [y, m] = mes.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, 1));
  return date.toISOString().slice(0, 10);
}

/** Resumo dos pagamentos de um fornecedor (já filtrados pelos nomes dele). */
export function summarizeOpex(payments: OpexPayment[], today: string): OpexSummary | null {
  if (!payments.length) return null;
  const currentMonth = `${today.slice(0, 7)}-01`;
  const firstMonth = addMonthsIso(currentMonth, -11);
  const window = payments.filter((p) => p.mes >= firstMonth && p.mes <= currentMonth);
  const months = Array.from({ length: 12 }, (_, i) => {
    const mes = addMonthsIso(firstMonth, i);
    return { mes, valor: window.filter((p) => p.mes === mes).reduce((sum, p) => sum + p.valor_pago, 0) };
  });
  const total12m = months.reduce((sum, m) => sum + m.valor, 0);

  const deps = new Map<string, { departamento: string; tipo: string | null; valor: number }>();
  const accounts = new Map<string, number>();
  for (const p of window) {
    const dep = deps.get(p.departamento) ?? { departamento: p.departamento, tipo: p.departamento_tipo, valor: 0 };
    dep.valor += p.valor_pago;
    deps.set(p.departamento, dep);
    const account = `${p.grupo_conta} / ${p.plano_contas}`;
    accounts.set(account, (accounts.get(account) ?? 0) + p.valor_pago);
  }
  const byDepartment = [...deps.values()].sort((a, b) => b.valor - a.valor);

  const share = (predicate: (tipo: string | null) => boolean) =>
    total12m > 0 ? byDepartment.filter((d) => predicate(d.tipo)).reduce((sum, d) => sum + d.valor, 0) / total12m : 0;
  let allocation: OpexAllocation = "outro";
  let mainArea: string | null = null;
  if (total12m > 0) {
    const top = byDepartment[0];
    if (share((t) => t === "indireto") >= 0.9) allocation = "indireto";
    else if (top.tipo === "area_juridica" && top.valor / total12m >= 0.9) {
      allocation = "direto";
      mainArea = top.departamento;
    } else if (share((t) => t === "indireto" || t === "area_juridica") >= 0.9) allocation = "misto";
  }

  const paidMonths = payments.filter((p) => p.valor_pago > 0).map((p) => p.mes).sort();
  return {
    total12m,
    monthlyAverage: total12m / 12,
    months,
    byDepartment,
    allocation,
    mainArea,
    mainAccount: [...accounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    lastPaymentMonth: paidMonths.at(-1) ?? null,
  };
}

export const ALLOCATION_LABEL: Record<OpexAllocation, string> = {
  indireto: "Indireto (rateado)",
  direto: "Direto de uma área",
  misto: "Dividido entre áreas",
  outro: "Fora das áreas",
};
