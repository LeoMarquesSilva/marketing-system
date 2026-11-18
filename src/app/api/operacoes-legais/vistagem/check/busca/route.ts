import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { buscarChecadas } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

/** Busca em todas as checadas, de qualquer dia de importação (`?q=`). */
export async function GET(request: Request) {
  try {
    await exigirAcessoVistagem();
    const busca = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 200);
    return NextResponse.json(await buscarChecadas(busca));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível buscar nas checadas.");
  }
}
