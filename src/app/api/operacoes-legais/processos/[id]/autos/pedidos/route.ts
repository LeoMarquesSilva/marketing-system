import { pedirAutos } from "@/lib/processos/autos-server";
import { comAcesso, lerJson } from "@/lib/processos/http";

export const dynamic = "force-dynamic";

/** Pede o download dos autos ao robô. Corpo: { liberarSegredo?: boolean }. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comAcesso(async (ator) => ({ autos: await pedirAutos(id, await lerJson(request), ator) }));
}
