import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { sugestaoDaPublicacao } from "@/lib/vistagem/sugestao-ia-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/** Sugestão da IA para a vistagem (Trabalhista): devolve a já gerada ou gera agora. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { areas } = await exigirPerfilVistagem();
    const { id } = await context.params;
    return NextResponse.json(await sugestaoDaPublicacao(id, areas));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível gerar a sugestão da IA.");
  }
}
