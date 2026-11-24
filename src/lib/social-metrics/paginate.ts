/**
 * O Supabase devolve no máximo 1.000 linhas por consulta (mesmo com .limit maior).
 * Séries diárias passam disso com o tempo: lê de página em página.
 */
const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function fetchAllRows<T>(page: (from: number, to: number) => PageResult<T>, maxRows = 50_000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
