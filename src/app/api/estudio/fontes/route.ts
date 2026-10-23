import { NextResponse } from "next/server";
import { FONT_FAMILY_RE, FONT_MAX_BYTES, FONT_MIME, STUDIO_FONT_SLOTS, fontFaceRule, sniffFontFormat, type StudioFontRow } from "@/lib/estudio/fonts";
import { STUDIO_IMAGES_BUCKET } from "@/lib/estudio/images";
import { diskFontSlots, listStudioFonts, requireStudioUser } from "@/lib/estudio/server";
import { getServerDb } from "@/lib/users-server";

export const dynamic = "force-dynamic";

/** Fontes enviadas e quais lugares dos modelos já têm arquivo (pasta ou envio). */
export async function GET() {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;
  const [fonts, disk] = await Promise.all([listStudioFonts(), diskFontSlots()]);
  const slots = STUDIO_FONT_SLOTS.map((slot) => {
    const sent = fonts.find((f) => f.familia === slot.family && f.peso === slot.weight && f.estilo === "normal");
    return { key: slot.key, family: slot.family, weight: slot.weight, label: slot.label, origem: sent ? "envio" : disk.has(slot.key) ? "pasta" : null, fontId: sent?.id ?? null };
  });
  return NextResponse.json({ fonts, slots });
}

/** Envia uma fonte (substitui a que já existir com a mesma família, peso e estilo). */
export async function POST(request: Request) {
  const auth = await requireStudioUser();
  if ("error" in auth) return auth.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("arquivo");
  const familia = String(form?.get("familia") ?? "").trim();
  const peso = Number(form?.get("peso"));
  const estilo = form?.get("estilo") === "italic" ? "italic" : "normal";
  const postscript = String(form?.get("postscript") ?? "").trim().slice(0, 120) || null;
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie o arquivo da fonte." }, { status: 400 });
  if (!FONT_FAMILY_RE.test(familia)) return NextResponse.json({ error: "Nome da família inválido (letras, números, espaço, ponto ou hífen)." }, { status: 400 });
  if (!Number.isInteger(peso) || peso < 100 || peso > 900 || peso % 100 !== 0) return NextResponse.json({ error: "Peso inválido (100 a 900)." }, { status: 400 });
  if (file.size > FONT_MAX_BYTES) return NextResponse.json({ error: "A fonte passa de 5 MB." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const formato = sniffFontFormat(bytes);
  if (!formato) return NextResponse.json({ error: "Use um arquivo de fonte OTF, TTF, WOFF ou WOFF2." }, { status: 400 });

  const db = await getServerDb();
  const arquivo = `fontes/${crypto.randomUUID()}.${formato}`;
  const { error: upError } = await db.storage.from(STUDIO_IMAGES_BUCKET).upload(arquivo, bytes, { contentType: FONT_MIME[formato], upsert: false });
  if (upError) {
    console.error("[estudio/fontes] envio", upError);
    return NextResponse.json({ error: "Não foi possível guardar a fonte." }, { status: 500 });
  }

  const { data: old } = await db.from("studio_fonts").select("id, arquivo").eq("familia", familia).eq("peso", peso).eq("estilo", estilo).maybeSingle();
  if (old) {
    await db.from("studio_fonts").delete().eq("id", old.id);
    await db.storage.from(STUDIO_IMAGES_BUCKET).remove([old.arquivo]);
  }
  const { data, error } = await db
    .from("studio_fonts")
    .insert({ familia, peso, estilo, arquivo, formato, nome_original: file.name.slice(0, 160), postscript, created_by_id: auth.profile.id })
    .select("id, familia, peso, estilo, formato, nome_original, postscript, created_at")
    .single();
  if (error || !data) {
    console.error("[estudio/fontes] registro", error);
    await db.storage.from(STUDIO_IMAGES_BUCKET).remove([arquivo]);
    return NextResponse.json({ error: "Não foi possível registrar a fonte." }, { status: 500 });
  }
  const font = data as StudioFontRow;
  // a página aplica na hora, sem recarregar
  const css = fontFaceRule({ family: font.familia, weight: font.peso, style: font.estilo, url: `/api/estudio/fontes/db/${font.id}`, format: font.formato });
  return NextResponse.json({ font, css }, { status: 201 });
}
