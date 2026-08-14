export interface LoadPhotoCountsOptions {
  pageSize?: number;
  userIds?: string[];
}

export async function loadPhotoCountsByUserId(
  fetchPage: (from: number, to: number) => Promise<Array<{ user_id: string }>>,
  options: LoadPhotoCountsOptions = {}
): Promise<Record<string, number>> {
  const pageSize = options.pageSize ?? 1_000;
  const counts = Object.fromEntries((options.userIds ?? []).map((id) => [id, 0]));

  for (let from = 0; ; from += pageSize) {
    const rows = await fetchPage(from, from + pageSize - 1);
    for (const row of rows) {
      counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
    }
    if (rows.length < pageSize) break;
  }

  return counts;
}
