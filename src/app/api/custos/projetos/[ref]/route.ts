import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { upsertInfraProjectProfile } from "@/lib/infra-project-profiles";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ ref: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { ref } = await context.params;
    if (!ref?.trim()) {
      return NextResponse.json({ error: "Projeto inválido." }, { status: 400 });
    }

    const body = (await request.json()) as {
      display_name?: string | null;
      logo_url?: string | null;
      category?: string | null;
      description?: string | null;
      sort_order?: number;
    };

    const profile = await upsertInfraProjectProfile(
      ref.trim(),
      {
        display_name: body.display_name,
        logo_url: body.logo_url,
        category: body.category,
        description: body.description,
        sort_order: body.sort_order,
      },
      user.id
    );

    return NextResponse.json(profile);
  } catch (err) {
    if (err instanceof Error && err.message === "Não autenticado.") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Erro ao salvar projeto.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
