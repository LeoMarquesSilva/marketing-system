import { NextResponse } from "next/server";
import { fetchAdCreativeImageUrl } from "@/lib/meta-ads";
import { requireAuthenticatedUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const FACEBOOK_REFERER = "https://www.facebook.com/";

function isMetaCdnUrl(url: string): boolean {
  return /fbcdn\.net|cdninstagram\.com/i.test(url);
}

async function fetchCdnImage(url: string): Promise<Response | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Referer: FACEBOOK_REFERER,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    cache: "no-store",
  });
  return res.ok ? res : null;
}

/**
 * Proxy do criativo de anúncio — thumbnail_url/image_url da Graph API são links
 * assinados do fbcdn que expiram e retornam 403 se carregados direto no browser.
 */
export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();

    const adId = new URL(request.url).searchParams.get("adId");
    if (!adId) {
      return NextResponse.json({ error: "adId obrigatório." }, { status: 400 });
    }

    const url = await fetchAdCreativeImageUrl(adId);
    if (!url) {
      return new Response("Mídia não encontrada.", { status: 404 });
    }

    const res = isMetaCdnUrl(url)
      ? await fetchCdnImage(url)
      : await fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r : null));

    if (!res) {
      return new Response("CDN do Meta recusou o acesso.", { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const body = await res.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Não autenticado.") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Erro ao carregar imagem.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
