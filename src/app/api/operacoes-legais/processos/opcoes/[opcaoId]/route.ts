import { comAcesso, lerJson } from "@/lib/processos/http";
import { editarOpcao } from "@/lib/processos/opcoes-server";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ opcaoId: string }> };

/** Corpo: { valor?, ativo? }: corrige o nome ou ativa/desativa. */
export async function PATCH(request: Request, { params }: Contexto) {
  const { opcaoId } = await params;
  return comAcesso(async () => ({ opcao: await editarOpcao(opcaoId, await lerJson(request)) }));
}
