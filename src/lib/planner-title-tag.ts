const TITLE_TAG_PATTERN = /^\s*\[([^\]]{1,24})\]\s*/;

/**
 * Tag de agrupamento no início do título — convenção do planner para campanhas
 * (ex.: "[OAB] F01 Feed — Convite oficial" → tag "OAB", rest "F01 Feed — Convite oficial").
 */
export function getTitleTag(title: string): { tag: string; rest: string } | null {
  const match = title.match(TITLE_TAG_PATTERN);
  const tag = match?.[1].trim().toUpperCase();
  if (!match || !tag) return null;
  return { tag, rest: title.slice(match[0].length) };
}
