import { after } from "next/server";
import { reagirAMudanca } from "@/lib/audiencias/rotina-server";
import { comAcesso, lerJson } from "@/lib/audiencias/http";
import { completarAudiencia, historicoDaAudiencia } from "@/lib/audiencias/pauta-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async () => ({ historico: await historicoDaAudiencia(id) }));
}

/** Corpo: { modalidadeEquipe?, correspondente?, observacao?, linkSala? }. Depois de responder, atualiza o convite. */
export async function PATCH(request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async (ator) => {
    const audiencia = await completarAudiencia(id, await lerJson(request), ator);
    after(() => reagirAMudanca({ ids: [id] }));
    return { audiencia };
  });
}
