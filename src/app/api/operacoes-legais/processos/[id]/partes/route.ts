import { comAcesso, lerJson } from "@/lib/processos/http";
import { criarParte } from "@/lib/processos/partes-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comAcesso(async (ator) => ({ processo: await criarParte(id, await lerJson(request), ator) }));
}
