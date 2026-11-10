import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { deleteWelcomeLink, moveWelcomeLink, saveWelcomeLink } from "@/lib/rh/welcome/server";

export const dynamic = "force-dynamic";

/** Links de boas-vindas mantidos pelo RH: `save`, `delete` e `move`. Devolve a lista atualizada. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (body.action === "save" && body.link && typeof body.link === "object") {
      const link = body.link as Record<string, unknown>;
      const links = await saveWelcomeLink({
        id: typeof link.id === "string" ? link.id : undefined,
        title: typeof link.title === "string" ? link.title : "",
        url: typeof link.url === "string" ? link.url : "",
        description: typeof link.description === "string" ? link.description : null,
        internalNote: typeof link.internalNote === "string" ? link.internalNote : null,
        audience: typeof link.audience === "string" ? link.audience : "",
        isActive: link.isActive !== false,
      });
      return NextResponse.json({ links });
    }
    if (body.action === "delete" && typeof body.id === "string") {
      return NextResponse.json({ links: await deleteWelcomeLink(body.id) });
    }
    if (body.action === "move" && typeof body.id === "string" && (body.direction === "up" || body.direction === "down")) {
      return NextResponse.json({ links: await moveWelcomeLink(body.id, body.direction) });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
