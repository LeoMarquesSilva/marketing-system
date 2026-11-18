import { comAcesso, lerJson } from "@/lib/audiencias/http";
import { completarAudiencia, historicoDaAudiencia } from "@/lib/audiencias/pauta-server";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async () => ({ historico: await historicoDaAudiencia(id) }));
}

/** Corpo: { modalidadeEquipe?, correspondente?, observacao?, linkSala? }. */
export async function PATCH(request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async (ator) => ({ audiencia: await completarAudiencia(id, await lerJson(request), ator) }));
}
