import { NextResponse, type NextRequest } from "next/server";
import { listarAcessosVistagem, salvarAcessoVistagem } from "@/lib/vistagem/acessos-server";
import { exigirAdminVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";

/** Quem acessa a Vistagem (só admin): papel, áreas, risco e onde cada pessoa é vistadora. */
export async function GET() {
  try {
    await exigirAdminVistagem();
    return NextResponse.json(await listarAcessosVistagem(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar quem acessa a Vistagem.");
  }
}

/** Muda o acesso de uma pessoa: { userId, papel, areas, risco }. Devolve a lista atualizada. */
export async function PUT(request: NextRequest) {
  try {
    await exigirAdminVistagem();
    const corpo = (await request.json().catch(() => null)) as { userId?: unknown } | null;
    await salvarAcessoVistagem(typeof corpo?.userId === "string" ? corpo.userId : "", corpo);
    return NextResponse.json(await listarAcessosVistagem(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível salvar o acesso à Vistagem.");
  }
}
