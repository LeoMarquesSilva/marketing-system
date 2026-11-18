/**
 * O Supabase devolve no máximo 1.000 linhas por consulta, mesmo com .limit()
 * maior, e corta sem avisar. Lê página a página até acabar.
 *
 * `build` recebe o intervalo (inclusivo) e deve aplicar .range(from, to) numa
 * consulta com ordem estável (ex.: created_at + id), senão linhas pulam ou repetem.
 */
export const SUPABASE_PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  options: { pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? SUPABASE_PAGE_SIZE;
  const maxRows = options.maxRows ?? 50_000;
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
