import { NextResponse } from "next/server";
import { exigirAdminVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { proporVistadoresDaLista } from "@/lib/vistagem/usuarios-sharepoint";

export const dynamic = "force-dynamic";

/** Lê a lista USUARIOS do SharePoint e devolve a proposta de vistadores (só admin). Não grava: a tela confirma. */
export async function POST() {
  try {
    await exigirAdminVistagem();
    return NextResponse.json(await proporVistadoresDaLista(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível ler a lista USUARIOS do SharePoint.");
  }
}
