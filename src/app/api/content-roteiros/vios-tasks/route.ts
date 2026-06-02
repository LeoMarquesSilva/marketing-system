import { NextResponse } from "next/server";
import { getAuthenticatedContentUser } from "@/lib/content-access";
import { fetchUserViosTasks } from "@/lib/content-roteiros";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getAuthenticatedContentUser();
    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (!auth.profile?.id) {
      return NextResponse.json([]);
    }
    const tasks = await fetchUserViosTasks(auth.profile.id);
    return NextResponse.json(tasks);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar tarefas do VIOS.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
