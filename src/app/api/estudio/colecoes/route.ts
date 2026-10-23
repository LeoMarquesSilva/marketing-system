import { NextResponse } from "next/server";
import { collectionInputSchema } from "@/lib/estudio/dynamic";
import { COLLECTION_COLUMNS, invalidateDynamicTemplates, requireStudioUser } from "@/lib/estudio/server";
import { getCollection } from "@/lib/estudio/templates";
import { getServerDb } from "@/lib/users-server";

export const dynamic = "force-dynamic";

/** Coleção nova (campanha): tag do planner, nome e o contexto que a IA usa. */
export async function POST(request: Request) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const parsed = collectionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tag de 2 a 12 letras maiúsculas ou números, e um nome." }, { status: 400 });
  if (getCollection(parsed.data.tag)) return NextResponse.json({ error: `Já existe a coleção [${parsed.data.tag}].` }, { status: 409 });
  const db = await getServerDb();
  const { data, error } = await db
    .from("studio_collections")
    .insert({ ...parsed.data, created_by_id: auth.profile.id })
    .select(COLLECTION_COLUMNS)
    .single();
  if (error || !data) {
    console.error("[estudio/colecoes]", error);
    return NextResponse.json({ error: "Não foi possível criar a coleção." }, { status: 500 });
  }
  invalidateDynamicTemplates();
  return NextResponse.json({ colecao: data }, { status: 201 });
}
