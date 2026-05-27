import { NextResponse } from "next/server";
import { fetchVideoEmbed } from "@/lib/meta-ads";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    await requireAdminUser(user.id);

    const videoId = new URL(request.url).searchParams.get("videoId");
    if (!videoId) {
      return NextResponse.json({ error: "videoId obrigatório." }, { status: 400 });
    }

    const embed = await fetchVideoEmbed(videoId);
    return NextResponse.json(embed);
  } catch (err) {
    if (err instanceof Error && err.message === "Não autenticado.") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (
      err instanceof Error &&
      err.message === "Apenas administradores podem executar esta ação."
    ) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const msg =
      err instanceof Error ? err.message : "Erro ao carregar vídeo.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
