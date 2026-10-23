import { NextResponse } from "next/server";
import { parseIconify } from "@/lib/estudio/fields";
import { ICONIFY_API, iconFromJson } from "@/lib/estudio/iconify";
import { requireStudioUser } from "@/lib/estudio/server";

export const dynamic = "force-dynamic";

// Desenho de um ícone da Iconify, já limpo para entrar na arte.
export async function GET(_request: Request, { params }: { params: Promise<{ prefixo: string; nome: string }> }) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;

  const { prefixo, nome } = await params;
  const icon = parseIconify(`iconify:${prefixo}:${nome}`);
  if (!icon) return NextResponse.json({ error: "Ícone fora dos conjuntos liberados." }, { status: 400 });

  try {
    const res = await fetch(`${ICONIFY_API}/${icon.prefix}.json?icons=${icon.name}`, { next: { revalidate: 604800 } });
    if (!res.ok) throw new Error(String(res.status));
    const data = iconFromJson(await res.json(), icon.prefix, icon.name);
    if (!data) return NextResponse.json({ error: "Ícone não encontrado." }, { status: 404 });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=604800" } });
  } catch {
    return NextResponse.json({ error: "A Iconify não respondeu. Tente de novo." }, { status: 502 });
  }
}
