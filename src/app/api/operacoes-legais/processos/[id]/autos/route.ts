import { carregarAutos } from "@/lib/processos/autos-server";
import { comAcesso } from "@/lib/processos/http";

export const dynamic = "force-dynamic";

/** Pedidos ao robô, PDFs e sugestões da IA do processo. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comAcesso(async () => ({ autos: await carregarAutos(id) }));
}
