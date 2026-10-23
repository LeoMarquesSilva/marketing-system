import { NextResponse } from "next/server";
import { ICONIFY_SETS } from "@/lib/estudio/fields";
import { ICONIFY_API, searchResults } from "@/lib/estudio/iconify";
import { requireStudioUser } from "@/lib/estudio/server";

export const dynamic = "force-dynamic";

// Busca na Iconify, só nos conjuntos de licença livre (a busca da Iconify é em inglês).
export async function GET(request: Request) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;

  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2 || q.length > 40) return NextResponse.json({ error: "Digite de 2 a 40 letras." }, { status: 400 });

  const url = `${ICONIFY_API}/search?query=${encodeURIComponent(q)}&limit=96&prefixes=${ICONIFY_SETS.join(",")}`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(String(res.status));
    return NextResponse.json({ icons: searchResults(await res.json()) }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "A busca de ícones não respondeu. Tente de novo." }, { status: 502 });
  }
}
