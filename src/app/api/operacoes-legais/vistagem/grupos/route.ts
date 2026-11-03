import { NextResponse } from "next/server";
import { listarGruposClientes } from "@/lib/vistagem/grupos-server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";

/** Grupos de clientes do VIOS, para o combo "Grupo do cliente" da controladoria. */
export async function GET() {
  try {
    await exigirPerfilVistagem();
    return NextResponse.json({ grupos: await listarGruposClientes() });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar os grupos de clientes.");
  }
}
