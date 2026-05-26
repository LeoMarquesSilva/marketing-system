import type { InstagramPost, PostSolicitante } from "./instagram-posts";

/** Áreas em que o solicitante não é obrigatório */
export const OPTIONAL_SOLICITANTE_AREAS = ["Institucional"] as const;

export function isInstitutionalArea(area: string | null | undefined): boolean {
  if (!area) return false;
  const normalized = area.trim().toLowerCase();
  return OPTIONAL_SOLICITANTE_AREAS.some(
    (name) => name.toLowerCase() === normalized
  );
}

export function getPostAreas(post: InstagramPost): string[] {
  if (post.areas?.length) return post.areas;
  if (post.area) return [post.area];
  return [];
}

export function getPostSolicitantes(post: InstagramPost): PostSolicitante[] {
  if (post.solicitantes?.length) return post.solicitantes;
  if (post.solicitante_id) {
    return [
      {
        id: post.solicitante_id,
        name: post.solicitante ?? "",
      },
    ];
  }
  return [];
}

export function isInstitutionalOnlyPost(post: InstagramPost): boolean {
  const areas = getPostAreas(post);
  return areas.length > 0 && areas.every((a) => isInstitutionalArea(a));
}

export function isCollabPost(post: InstagramPost): boolean {
  return getPostAreas(post).length > 1 || getPostSolicitantes(post).length > 1;
}

/** Post com vínculo mínimo concluído (área + autores quando exigido) */
export function isPostFullyLinked(post: InstagramPost): boolean {
  const areas = getPostAreas(post);
  if (areas.length === 0) return false;

  const solicitantes = getPostSolicitantes(post);
  if (solicitantes.length > 0) return true;

  if (isInstitutionalOnlyPost(post) && post.skip_participants) return true;

  return false;
}

/** Aparece na fila de pendentes para completar vínculo */
export function isPostPendingLink(post: InstagramPost): boolean {
  return !isPostFullyLinked(post);
}

export function getPendingLinkLabels(post: InstagramPost): string[] {
  const pending: string[] = [];
  const areas = getPostAreas(post);
  const solicitantes = getPostSolicitantes(post);

  if (areas.length === 0) {
    pending.push("área");
    return pending;
  }

  if (solicitantes.length === 0) {
    if (isInstitutionalOnlyPost(post)) {
      pending.push("participante (opcional)");
    } else {
      pending.push("autor");
    }
  }

  return pending;
}

/** Sincroniza colunas legadas a partir dos arrays */
export function normalizePostAssignments(input: {
  areas?: string[] | null;
  solicitantes?: PostSolicitante[] | null;
  skip_participants?: boolean;
}): {
  areas: string[];
  solicitantes: PostSolicitante[];
  area: string | null;
  solicitante_id: string | null;
  solicitante: string | null;
  skip_participants?: boolean;
} {
  const areas = (input.areas ?? []).map((a) => a.trim()).filter(Boolean);
  const solicitantes = (input.solicitantes ?? []).filter((s) => s.id && s.name);
  const primary = solicitantes[0];

  const result: {
    areas: string[];
    solicitantes: PostSolicitante[];
    area: string | null;
    solicitante_id: string | null;
    solicitante: string | null;
    skip_participants?: boolean;
  } = {
    areas,
    solicitantes,
    area: areas[0] ?? null,
    solicitante_id: primary?.id ?? null,
    solicitante: primary?.name ?? null,
  };

  if (input.skip_participants !== undefined) {
    result.skip_participants = input.skip_participants;
  } else if (solicitantes.length > 0) {
    result.skip_participants = false;
  }

  return result;
}
