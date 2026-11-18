import { after, NextResponse } from "next/server";
import { respostaDeErro } from "@/lib/processos/http";
import { lerDocumento } from "@/lib/processos/leitura-server";
import { atualizarPedidoDoRobo, exigirRobo } from "@/lib/processos/robo-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * O robô informa o andamento do pedido: espera por pessoa, erro, pedido de upload e conclusão.
 * Ao concluir, a leitura do PDF pela IA começa depois da resposta (o robô não espera por ela).
 */
export async function POST(request: Request, { params }: { params: Promise<{ pedidoId: string }> }) {
  try {
    exigirRobo(request);
    const { pedidoId } = await params;
    const resposta = await atualizarPedidoDoRobo(pedidoId, await request.json().catch(() => null));
    if ("documento" in resposta) {
      const documentoId = resposta.documento.id;
      after(async () => {
        try {
          await lerDocumento(documentoId);
        } catch (erro) {
          console.error("[robos/autos] leitura depois do download:", erro instanceof Error ? erro.message : erro);
        }
      });
    }
    return NextResponse.json(resposta);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
