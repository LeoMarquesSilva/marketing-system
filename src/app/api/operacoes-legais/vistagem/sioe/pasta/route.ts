import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { consultarPastaSioe } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";

/** Prévia de uma pasta (CI) do SIOE, com o escritório que a triagem daria. */
export async function GET(request: Request) {
  try {
    await exigirAcessoVistagem();
    const ci = new URL(request.url).searchParams.get("ci")?.replace(/\D/g, "") ?? "";
    if (!ci) return NextResponse.json({ error: "Informe a CI." }, { status: 400 });
    return NextResponse.json(await consultarPastaSioe(ci));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível consultar a pasta no SIOE.");
  }
}
