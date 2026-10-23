import { NextResponse } from "next/server";
import { STUDIO_IMAGES_BUCKET, slugifyFileName } from "@/lib/estudio/images";
import { requireStudioUser } from "@/lib/estudio/server";
import { getCollection } from "@/lib/estudio/templates";
import { getServerDb } from "@/lib/users-server";

export const dynamic = "force-dynamic";

/*
 * Fotos de fundo do Pexels (grátis, uso comercial; 200 pedidos/h). A chave fica só no
 * servidor. Na importação a foto já vem recortada em 1080×1350 pelo próprio Pexels.
 */

const API = "https://api.pexels.com/v1";

interface PexelsPhoto {
  id: number;
  url: string;
  alt?: string;
  photographer: string;
  photographer_url: string;
  avg_color?: string;
  src: { original: string; medium: string; large: string };
}

function apiKey(): string | null {
  return process.env.PEXELS_API_KEY?.trim() || null;
}

const noKey = () =>
  NextResponse.json(
    { error: "A busca no Pexels ainda não está ligada: falta a chave grátis (PEXELS_API_KEY). Enquanto isso, envie a imagem do computador." },
    { status: 501 }
  );

function credit(photo: PexelsPhoto): string {
  return `Foto: ${photo.photographer} (Pexels)`.slice(0, 120);
}

/** Busca fotos em pé (retrato), com miniatura e crédito. */
export async function GET(request: Request) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const key = apiKey();
  if (!key) return noKey();

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const page = Math.min(20, Math.max(1, Number(url.searchParams.get("pagina")) || 1));
  if (q.length < 2 || q.length > 60) return NextResponse.json({ error: "Digite de 2 a 60 letras." }, { status: 400 });

  const search = `${API}/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=30&page=${page}&locale=pt-BR`;
  try {
    const res = await fetch(search, { headers: { Authorization: key }, next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { photos?: PexelsPhoto[]; next_page?: string };
    const photos = (body.photos ?? []).map((p) => ({
      id: p.id,
      alt: p.alt ?? "",
      thumb: p.src.medium,
      cor: p.avg_color ?? null,
      credito: credit(p),
      pagina: p.url,
      fotografo: p.photographer_url,
    }));
    return NextResponse.json({ photos, mais: Boolean(body.next_page) });
  } catch {
    return NextResponse.json({ error: "O Pexels não respondeu. Tente de novo em instantes." }, { status: 502 });
  }
}

/** Traz a foto escolhida para a galeria de fundos da coleção. */
export async function POST(request: Request) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const key = apiKey();
  if (!key) return noKey();

  const body = (await request.json().catch(() => null)) as { tag?: unknown; id?: unknown } | null;
  const tag = typeof body?.tag === "string" && getCollection(body.tag) ? body.tag : null;
  const id = Number(body?.id);
  if (!tag || !Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Foto inválida." }, { status: 400 });

  try {
    const res = await fetch(`${API}/photos/${id}`, { headers: { Authorization: key } });
    if (res.status === 404) return NextResponse.json({ error: "Foto não encontrada no Pexels." }, { status: 404 });
    if (!res.ok) throw new Error(String(res.status));
    const photo = (await res.json()) as PexelsPhoto;
    const source = new URL(photo.src.original);
    if (source.hostname !== "images.pexels.com") throw new Error("origem inesperada");
    source.search = "?auto=compress&cs=tinysrgb&fit=crop&w=1080&h=1350";

    const image = await fetch(source);
    if (!image.ok) throw new Error(String(image.status));
    const bytes = new Uint8Array(await image.arrayBuffer());

    const path = `${tag}/fundos/${Date.now()}-pexels-${id}-${slugifyFileName(photo.photographer).slice(0, 40)}.jpg`;
    const db = await getServerDb();
    const { error } = await db.storage.from(STUDIO_IMAGES_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    return NextResponse.json({ path, credito: credit(photo) }, { status: 201 });
  } catch (err) {
    console.error("[estudio/fundos/pexels]", err);
    return NextResponse.json({ error: "Não foi possível trazer a foto do Pexels." }, { status: 502 });
  }
}
