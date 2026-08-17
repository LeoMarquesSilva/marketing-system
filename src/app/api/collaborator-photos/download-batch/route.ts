import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  PhotoHttpError,
  getPhotosDownloadZip,
  resolveAppUser,
} from "@/lib/collaborator-photos/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const body = (await request.json().catch(() => ({}))) as { photoIds?: unknown };
    const { filename, bytes } = await getPhotosDownloadZip(actor, body.photoIds);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof PhotoHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao baixar fotos.";
    const status =
      message.includes("Não autenticado")
        ? 401
        : message.includes("Selecione") || message.includes("inválida")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
