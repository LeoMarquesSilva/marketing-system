import { comAcesso, lerJson } from "@/lib/processos/http";
import { marcarNaoAplicavel } from "@/lib/processos/processos-server";

export const dynamic = "force-dynamic";

/** Corpo: { chave, naoSeAplica } — tira o item da conta do saneamento deste processo (ou devolve). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    return { processo: await marcarNaoAplicavel(id, String(corpo.chave ?? ""), corpo.naoSeAplica === true, ator) };
  });
}
