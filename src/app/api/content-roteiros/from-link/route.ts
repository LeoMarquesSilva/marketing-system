import { NextResponse } from "next/server";
import { getAuthenticatedContentUser, isContentManager } from "@/lib/content-access";
import {
  ManualLinkError,
  createRoteiroFromLink,
  manualLinkSchema,
} from "@/lib/content-manual-link";

export const dynamic = "force-dynamic";
// Busca a página + duas chamadas de IA (classificar área e gerar carrossel).
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const contentUser = await getAuthenticatedContentUser();
    if (!contentUser) {
      return NextResponse.json(
        { error: "Não autenticado.", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }
    if (!isContentManager(contentUser.profile)) {
      return NextResponse.json(
        {
          error: "Apenas a equipe de marketing pode gerar post a partir de link.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = manualLinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Link inválido.",
          code: "INVALID_LINK",
        },
        { status: 400 }
      );
    }

    const result = await createRoteiroFromLink(parsed.data, {
      id: contentUser.profile?.id ?? "",
      name: contentUser.profile?.name ?? "",
    });

    return NextResponse.json({ roteiro: result }, { status: 201 });
  } catch (error) {
    if (error instanceof ManualLinkError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    // Erro inesperado nunca vaza detalhe interno para a interface.
    console.error("[content-roteiros/from-link]", error);
    return NextResponse.json(
      { error: "Não foi possível gerar o post agora.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
