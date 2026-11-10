import { comAcesso, lerJson } from "@/lib/processos/http";
import { decidirSugestao } from "@/lib/processos/sugestoes-server";

export const dynamic = "force-dynamic";

/**
 * A decisão da pessoa sobre uma sugestão da IA. Corpo: { acao: "aprovar" | "recusar", valor?, parte? }
 * (`valor` ou `parte` só quando a pessoa editou antes de aprovar).
 */
export async function POST(request: Request, { params }: { params: Promise<{ sugestaoId: string }> }) {
  const { sugestaoId } = await params;
  return comAcesso(async (ator) => decidirSugestao(sugestaoId, await lerJson(request), ator));
}
