import { NextResponse } from "next/server";
import { getAuthenticatedContentUser, isContentManager } from "@/lib/content-access";
import { fetchRssItems, filterItems } from "@/lib/content-roteiros";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * "Testar fonte": lê o feed ou a busca e devolve as primeiras notícias, sem IA
 * e sem gravar nada. Serve para conferir os termos antes de salvar.
 */
export async function POST(request: Request) {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!isContentManager(auth.profile)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { rss_query?: string; months_back?: number };
  const query = body.rss_query?.trim();
  if (!query) return NextResponse.json({ error: "Informe o feed ou os termos." }, { status: 400 });
  if (/^\w+:/i.test(query) && !/^https?:\/\//i.test(query)) {
    return NextResponse.json({ error: "Use um endereço http(s) ou termos de busca." }, { status: 400 });
  }
  const monthsBack = Math.min(6, Math.max(1, Number(body.months_back) || 2));

  try {
    const items = await fetchRssItems(query, monthsBack);
    const usable = filterItems(items, monthsBack);
    return NextResponse.json({
      total: items.length,
      usable: usable.length,
      items: usable.slice(0, 8).map((item) => ({
        title: item.title,
        link: item.link ?? null,
        date: item.isoDate ?? item.pubDate ?? null,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível ler a fonte.";
    return NextResponse.json({ error: `Não foi possível ler a fonte: ${msg}` }, { status: 502 });
  }
}
