import { NextResponse } from "next/server";
import { templateInputSchema, type DynamicTemplateRow } from "@/lib/estudio/dynamic";
import { slugifyFileName } from "@/lib/estudio/images";
import { COLLECTION_COLUMNS, TEMPLATE_COLUMNS, invalidateDynamicTemplates, requireStudioUser } from "@/lib/estudio/server";
import { getCollection } from "@/lib/estudio/templates";
import { getServerDb } from "@/lib/users-server";

export const dynamic = "force-dynamic";

/** Coleções e modelos criados na tela (inclusive os desativados), para o navegador registrar. */
export async function GET() {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const db = await getServerDb();
  const [cols, tpls] = await Promise.all([
    db.from("studio_collections").select(COLLECTION_COLUMNS).order("created_at"),
    db.from("studio_templates").select(TEMPLATE_COLUMNS).order("created_at"),
  ]);
  if (cols.error || tpls.error) return NextResponse.json({ error: "Não foi possível carregar os modelos." }, { status: 500 });
  return NextResponse.json({ colecoes: cols.data ?? [], modelos: tpls.data ?? [] });
}

/** Cria (ou atualiza, com id) um modelo a partir da prancheta. */
export async function POST(request: Request) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;

  const parsed = templateInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Modelo incompleto: confira os campos.", detalhes: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const input = parsed.data;
  if (!getCollection(input.tag)) return NextResponse.json({ error: "Coleção desconhecida." }, { status: 400 });
  if (!input.fundo.startsWith(`${input.tag}/modelos/`)) return NextResponse.json({ error: "Fundo fora da pasta da coleção." }, { status: 400 });

  const db = await getServerDb();
  const row = {
    tag: input.tag,
    nome: input.nome,
    descricao: input.descricao,
    formato: input.formato,
    uso: input.uso,
    fundo: input.fundo,
    caixas: input.caixas,
    updated_at: new Date().toISOString(),
  };
  const id = input.id ?? `m-${input.tag.toLowerCase()}-${slugifyFileName(input.nome).slice(0, 40)}-${crypto.randomUUID().slice(0, 4)}`;
  const query = input.id
    ? db.from("studio_templates").update(row).eq("id", input.id).select(TEMPLATE_COLUMNS).maybeSingle()
    : db.from("studio_templates").insert({ ...row, id, created_by_id: auth.profile.id }).select(TEMPLATE_COLUMNS).single();
  const { data, error } = await query;
  if (error || !data) {
    console.error("[estudio/modelos] salvar", error);
    return NextResponse.json({ error: "Não foi possível salvar o modelo." }, { status: input.id && !error ? 404 : 500 });
  }
  invalidateDynamicTemplates();
  return NextResponse.json({ modelo: data as DynamicTemplateRow }, { status: input.id ? 200 : 201 });
}
