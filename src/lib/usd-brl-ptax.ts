/** Cotação USD/BRL via PTAX do Banco Central (venda). */

const PTAX_BASE =
  "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)";

const rateCache = new Map<string, number>();

function formatBcbDate(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

async function fetchRateForDate(date: Date): Promise<number | null> {
  const key = formatBcbDate(date);
  const cached = rateCache.get(key);
  if (cached != null) return cached;

  const url =
    `${PTAX_BASE}?@dataCotacao='${key}'` +
    "&$top=1&$orderby=dataHoraCotacao%20desc&$format=json";

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { value?: { cotacaoVenda?: number }[] };
    const rate = data.value?.[0]?.cotacaoVenda;
    if (rate == null || Number.isNaN(rate)) return null;
    rateCache.set(key, rate);
    return rate;
  } catch {
    return null;
  }
}

/** Busca cotação de venda do dólar; em fins de semana/feriados usa dias úteis anteriores. */
export async function getUsdBrlRate(isoDate: string | Date): Promise<number | null> {
  const start =
    typeof isoDate === "string"
      ? new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00Z`)
      : isoDate;

  const probe = new Date(start);
  for (let i = 0; i < 10; i++) {
    const rate = await fetchRateForDate(probe);
    if (rate != null) return rate;
    probe.setUTCDate(probe.getUTCDate() - 1);
  }
  return null;
}

export async function getUsdBrlRatesForDates(
  isoDates: string[]
): Promise<Map<string, number>> {
  const unique = [...new Set(isoDates.map((d) => d.slice(0, 10)))];
  const result = new Map<string, number>();
  await Promise.all(
    unique.map(async (day) => {
      const rate = await getUsdBrlRate(day);
      if (rate != null) result.set(day, rate);
    })
  );
  return result;
}

export function formatBrl(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
