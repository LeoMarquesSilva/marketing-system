import { alterarParcela, excluirParcela } from "@/lib/processos/acordos-server";
import { comAcesso, lerJson } from "@/lib/processos/http";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ parcelaId: string }> };

/** PUT { dados } — vencimento, valor, pagamento (data e valor pago) e observação da parcela. */
export async function PUT(request: Request, { params }: Contexto) {
  const { parcelaId } = await params;
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    const dados = corpo.dados && typeof corpo.dados === "object" && !Array.isArray(corpo.dados) ? (corpo.dados as Record<string, unknown>) : {};
    return { acordos: await alterarParcela(parcelaId, dados, ator) };
  });
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const { parcelaId } = await params;
  return comAcesso(async (ator) => ({ acordos: await excluirParcela(parcelaId, ator) }));
}
