import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { logosDosGrupos } from "@/lib/vistagem/logos-server";

export const dynamic = "force-dynamic";

/** Logos dos grupos de clientes (os do ICP), para listas, filtros e fichas da Vistagem. */
export async function GET() {
  try {
    await exigirPerfilVistagem();
    return NextResponse.json({ logos: await logosDosGrupos() });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar os logos dos grupos.");
  }
}
