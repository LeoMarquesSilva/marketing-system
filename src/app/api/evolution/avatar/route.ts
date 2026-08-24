import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { fetchEvolutionProfilePicture } from "@/lib/evolution-whatsapp";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function isWhatsappCdnUrl(url: string): boolean {
  return /\.whatsapp\.net\//i.test(url);
}

async function fetchCdnImage(url: string): Promise<Response | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    cache: "no-store",
  });
  return res.ok ? res : null;
}

/**
 * Proxy da foto de perfil do WhatsApp — a URL que a Evolution devolve
 * (pps.whatsapp.net) é assinada e expira; guardá-la em avatar_url e nunca
 * atualizar é o motivo do 403 no browser. Aqui buscamos uma URL fresca a
 * cada request e servimos os bytes, sem depender da coluna cacheada.
 */
export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();

    const conversationId = new URL(request.url).searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId obrigatório." }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("remote_jid, phone")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return new Response("Conversa não encontrada.", { status: 404 });

    const url = await fetchEvolutionProfilePicture(
      conv.remote_jid as string,
      conv.phone as string | null
    );
    if (!url) return new Response("Sem foto de perfil.", { status: 404 });

    const res = isWhatsappCdnUrl(url)
      ? await fetchCdnImage(url)
      : await fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r : null));

    if (!res) return new Response("CDN do WhatsApp recusou o acesso.", { status: 502 });

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const body = await res.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=1800, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Não autenticado.") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Erro ao carregar avatar.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
