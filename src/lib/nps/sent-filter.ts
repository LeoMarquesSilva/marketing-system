export type NpsSentFilter = "all" | "sent" | "not_sent";

export function parseNpsSentFilterParam(value: string | null | undefined): NpsSentFilter {
  if (value === "sent" || value === "not_sent") return value;
  return "all";
}

export function groupHasNpsSent(
  clientGroupId: string | null | undefined,
  npsSentByGroupId: Record<string, unknown>
): boolean {
  if (!clientGroupId) return false;
  return Boolean(npsSentByGroupId[clientGroupId]);
}

export function groupMatchesNpsSentFilter(
  sent: boolean,
  filter: NpsSentFilter
): boolean {
  if (filter === "all") return true;
  return filter === "sent" ? sent : !sent;
}
