import { NextResponse } from "next/server";
import { BirthdayArtHttpError, deleteArt, listMonthArts, registerArt } from "@/lib/inicio/birthday-arts-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function failure(error: unknown): NextResponse {
  if (error instanceof BirthdayArtHttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[artes-aniversario]", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: "Não foi possível concluir. Tente de novo." }, { status: 500 });
}

/** Aniversariantes do mês (`?mes=AAAA-MM`) com a arte de cada um. Só Marketing e admin. */
export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get("mes");
    return NextResponse.json(await listMonthArts(month), { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}

/** Registra a arte que o navegador acabou de subir. */
export async function PUT(request: Request) {
  try {
    return NextResponse.json(await registerArt(await request.json().catch(() => null)), { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}

/** Remove a arte de uma pessoa naquele ano. */
export async function DELETE(request: Request) {
  try {
    await deleteArt(await request.json().catch(() => null));
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}
