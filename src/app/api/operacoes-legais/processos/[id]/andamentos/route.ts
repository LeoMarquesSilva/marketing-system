import { linhaDoTempo } from "@/lib/processos/andamentos-server";
import { comAcesso } from "@/lib/processos/http";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

/** Linha do tempo do processo (andamentos do DataJud e do VIOS; depois prazos e providências). */
export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async () => ({ linha: await linhaDoTempo(id) }));
}
