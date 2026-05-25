import type { InstagramPost } from "./instagram-posts";

/** Áreas em que o solicitante não é obrigatório */
export const OPTIONAL_SOLICITANTE_AREAS = ["Institucional"] as const;

export function isInstitutionalArea(area: string | null | undefined): boolean {
  if (!area) return false;
  const normalized = area.trim().toLowerCase();
  return OPTIONAL_SOLICITANTE_AREAS.some(
    (name) => name.toLowerCase() === normalized
  );
}

export function isPostFullyLinked(post: InstagramPost): boolean {
  if (!post.area) return false;
  if (isInstitutionalArea(post.area)) return true;
  return Boolean(post.solicitante_id);
}

export function isPostPendingLink(post: InstagramPost): boolean {
  return !isPostFullyLinked(post);
}

export function getPendingLinkLabels(post: InstagramPost): string[] {
  const pending: string[] = [];
  if (!post.area) pending.push("área");
  if (isInstitutionalArea(post.area) === false && !post.solicitante_id) {
    pending.push("solicitante");
  }
  return pending;
}
