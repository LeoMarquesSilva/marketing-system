import { excluirDocumento, urlDoDocumento } from "@/lib/processos/autos-server";
import { comAcesso } from "@/lib/processos/http";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ documentoId: string }> };

/** URL assinada (10 min) para abrir o PDF. */
export async function GET(_request: Request, { params }: Contexto) {
  const { documentoId } = await params;
  return comAcesso(async () => ({ url: await urlDoDocumento(documentoId) }));
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const { documentoId } = await params;
  return comAcesso(async (ator) => ({ autos: await excluirDocumento(documentoId, ator) }));
}
