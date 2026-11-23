import { NextResponse } from "next/server";
import { BirthdayArtHttpError, createArtUpload } from "@/lib/inicio/birthday-arts-server";

export const dynamic = "force-dynamic";

/** Prepara o envio direto da arte ao bucket privado (link assinado). Só Marketing e admin. */
export async function POST(request: Request) {
  try {
    const upload = await createArtUpload(await request.json().catch(() => null));
    return NextResponse.json(upload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BirthdayArtHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[artes-aniversario] upload:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível preparar o envio da arte." }, { status: 500 });
  }
}
