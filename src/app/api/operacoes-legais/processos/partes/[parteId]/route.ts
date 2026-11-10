import { comAcesso, lerJson } from "@/lib/processos/http";
import { excluirParte, salvarParte } from "@/lib/processos/partes-server";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ parteId: string }> };

export async function PUT(request: Request, { params }: Contexto) {
  const { parteId } = await params;
  return comAcesso(async (ator) => ({ processo: await salvarParte(parteId, await lerJson(request), ator) }));
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const { parteId } = await params;
  return comAcesso(async (ator) => ({ processo: await excluirParte(parteId, ator) }));
}
