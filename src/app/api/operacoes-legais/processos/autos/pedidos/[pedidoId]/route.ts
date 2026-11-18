import { decidirPedido } from "@/lib/processos/autos-server";
import { comAcesso, lerJson } from "@/lib/processos/http";

export const dynamic = "force-dynamic";

/** Corpo: { acao: "cancelar" | "liberar_segredo" }. */
export async function POST(request: Request, { params }: { params: Promise<{ pedidoId: string }> }) {
  const { pedidoId } = await params;
  return comAcesso(async (ator) => ({ autos: await decidirPedido(pedidoId, await lerJson(request), ator) }));
}
