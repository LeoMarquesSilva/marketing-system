import { getAuthenticatedContentUser } from "@/lib/content-access";
import { fetchRoteiroById } from "@/lib/content-roteiros";
import { buildRoteiroWordHtml, roteiroWordSlug } from "@/lib/content-word";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getAuthenticatedContentUser();
  if (!auth) {
    return new Response("Não autenticado.", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return new Response("id é obrigatório.", { status: 400 });
  }

  const roteiro = await fetchRoteiroById(id);
  if (!roteiro) {
    return new Response("Conteúdo de post não encontrado.", { status: 404 });
  }

  const html = buildRoteiroWordHtml({
    title: roteiro.title,
    area: roteiro.area,
    link: roteiro.link,
    contentSnippet: roteiro.content_snippet,
    post: roteiro.post,
    hasAlterations: roteiro.has_alterations,
    editedByName: roteiro.edited_by_name,
    editedAt: roteiro.edited_at,
    originalPost: roteiro.original_post,
    authorName:
      roteiro.sent_to_mkt_by_name ??
      roteiro.edited_by_name ??
      roteiro.approved_by_name ??
      null,
  });

  return new Response("﻿" + html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="post-${roteiroWordSlug(roteiro.title)}.doc"`,
    },
  });
}
