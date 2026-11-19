import { NextResponse } from "next/server";
import { getAuthenticatedContentUser } from "@/lib/content-access";
import { dismissFollowupAlert, listFollowupAlerts } from "@/lib/content-generator/server";

export const dynamic = "force-dynamic";

/** Avisos de desdobramento da pessoa logada (assuntos que ela postou tiveram fato novo). */
export async function GET() {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    return NextResponse.json({ alerts: await listFollowupAlerts(auth.profile.id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao carregar avisos." }, { status: 500 });
  }
}

/** "Agora não": dispensa um aviso da própria pessoa. */
export async function PATCH(request: Request) {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "Aviso não informado." }, { status: 400 });
  try {
    await dismissFollowupAlert(body.id, auth.profile.id);
    return NextResponse.json({ alerts: await listFollowupAlerts(auth.profile.id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao dispensar aviso." }, { status: 500 });
  }
}
