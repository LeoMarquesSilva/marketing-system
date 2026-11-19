import { alterarAcordo, excluirAcordo, mudarSituacaoDoAcordo } from "@/lib/processos/acordos-server";
import { comAcesso, lerJson } from "@/lib/processos/http";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ acordoId: string }> };

const dadosDo = (corpo: Record<string, unknown>) => (corpo.dados && typeof corpo.dados === "object" && !Array.isArray(corpo.dados) ? (corpo.dados as Record<string, unknown>) : {});

/** PUT { dados } — dados do acordo (posição, datas, valor total, multa, observação). */
export async function PUT(request: Request, { params }: Contexto) {
  const { acordoId } = await params;
  return comAcesso(async (ator) => ({ acordos: await alterarAcordo(acordoId, dadosDo(await lerJson(request)), ator) }));
}

/** PATCH { dados: { situacao: "vigente" | "descumprido" | "cancelado", data? } } — a situação declarada. */
export async function PATCH(request: Request, { params }: Contexto) {
  const { acordoId } = await params;
  return comAcesso(async (ator) => ({ acordos: await mudarSituacaoDoAcordo(acordoId, dadosDo(await lerJson(request)), ator) }));
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const { acordoId } = await params;
  return comAcesso(async (ator) => ({ acordos: await excluirAcordo(acordoId, ator) }));
}
