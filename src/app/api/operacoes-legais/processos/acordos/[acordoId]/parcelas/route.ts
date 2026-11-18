import { incluirParcela } from "@/lib/processos/acordos-server";
import { comAcesso, lerJson } from "@/lib/processos/http";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ acordoId: string }> };

/** POST { dados } — parcela nova no fim do acordo. */
export async function POST(request: Request, { params }: Contexto) {
  const { acordoId } = await params;
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    const dados = corpo.dados && typeof corpo.dados === "object" && !Array.isArray(corpo.dados) ? (corpo.dados as Record<string, unknown>) : {};
    return { acordos: await incluirParcela(acordoId, dados, ator) };
  });
}
