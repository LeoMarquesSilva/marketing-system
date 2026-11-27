import { comAcesso, lerJson } from "@/lib/processos/http";
import { eventosDaNegociacao, salvarNegociacao } from "@/lib/processos/negociacao-server";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ processoId: string }> };

/** Histórico da negociação do processo (e-mails, status, propostas, valor máximo). */
export async function GET(_request: Request, { params }: Contexto) {
  const { processoId } = await params;
  return comAcesso(async () => ({ eventos: await eventosDaNegociacao(processoId) }));
}

/** PUT { status?, enviado_em?, respondido_em?, proposta_valor?, …, valor_maximo_cliente?, observacoes? } */
export async function PUT(request: Request, { params }: Contexto) {
  const { processoId } = await params;
  return comAcesso(async (ator) => {
    const negociacao = await salvarNegociacao(processoId, await lerJson(request), ator);
    return { negociacao, eventos: await eventosDaNegociacao(processoId) };
  });
}
