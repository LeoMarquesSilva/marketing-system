/**
 * Autorização das rotas de boletim: o usuário precisa estar autenticado e ter
 * acesso à área jurídica da edição (Marketing/admin veem todas).
 */
import {
  getAuthenticatedContentUser,
  type UserContentAccess,
} from "@/lib/content-access";
import { canAccessContentArea, getAllowedLegalAreas } from "@/lib/content-areas";
import { fetchNewsletter, NewsletterError, type NewsletterWithItems } from "@/lib/content-newsletter";

export interface NewsletterAccess {
  profile: UserContentAccess | null;
  /** null = todas as áreas. */
  allowedAreas: string[] | null;
  actor: { id: string | null; name: string | null };
}

export async function requireNewsletterAccess(): Promise<NewsletterAccess> {
  const auth = await getAuthenticatedContentUser();
  if (!auth) throw new NewsletterError("Não autenticado.", 401);

  const allowed = getAllowedLegalAreas(auth.profile);
  if (allowed !== null && allowed.length === 0) {
    throw new NewsletterError("Sem permissão para o módulo de newsletter.", 403);
  }

  return {
    profile: auth.profile,
    allowedAreas: allowed === null ? null : [...allowed],
    actor: { id: auth.profile?.id ?? null, name: auth.profile?.name ?? null },
  };
}

/** Carrega a edição garantindo que o usuário pode ver a área dela. */
export async function requireNewsletterForUser(
  id: string,
  access: NewsletterAccess
): Promise<NewsletterWithItems> {
  const newsletter = await fetchNewsletter(id);
  if (!newsletter) throw new NewsletterError("Edição não encontrada.", 404);
  if (!canAccessContentArea(access.profile, newsletter.area)) {
    throw new NewsletterError("Sem permissão para esta área.", 403);
  }
  return newsletter;
}

/** Converte qualquer erro em resposta JSON com o status certo. */
export function newsletterErrorResponse(err: unknown): Response {
  const status = err instanceof NewsletterError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Erro na newsletter.";
  return Response.json({ error: message }, { status });
}
