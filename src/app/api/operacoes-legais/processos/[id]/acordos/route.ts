import { carregarAcordos, criarAcordo } from "@/lib/processos/acordos-server";
import { comAcesso, lerJson } from "@/lib/processos/http";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

/** Acordos do processo, com as parcelas. */
export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async () => ({ acordos: await carregarAcordos(id) }));
}

/** POST { dados } — acordo novo; as parcelas saem do plano (entrada, quantidade, 1º vencimento, periodicidade). */
export async function POST(request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    const dados = corpo.dados && typeof corpo.dados === "object" && !Array.isArray(corpo.dados) ? (corpo.dados as Record<string, unknown>) : {};
    return { acordos: await criarAcordo(id, dados, ator) };
  });
}
