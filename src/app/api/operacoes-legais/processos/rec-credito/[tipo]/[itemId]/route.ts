import { ProcessosError } from "@/lib/processos/errors";
import { comAcesso, lerJson } from "@/lib/processos/http";
import { ehTipoItem, type TipoItem } from "@/lib/processos/rec-credito";
import { alterarItem, excluirItem } from "@/lib/processos/rec-credito-server";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ tipo: string; itemId: string }> };

function tipoDaRota(tipo: string): TipoItem {
  if (!ehTipoItem(tipo)) throw new ProcessosError("Tipo de item inválido.", 400);
  return tipo;
}

/** PUT { dados } — substitui os dados do item (o formulário manda o item inteiro). */
export async function PUT(request: Request, { params }: Contexto) {
  const { tipo, itemId } = await params;
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    const dados = corpo.dados && typeof corpo.dados === "object" && !Array.isArray(corpo.dados) ? (corpo.dados as Record<string, unknown>) : {};
    return { recCredito: await alterarItem(tipoDaRota(tipo), itemId, dados, ator) };
  });
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const { tipo, itemId } = await params;
  return comAcesso(async (ator) => ({ recCredito: await excluirItem(tipoDaRota(tipo), itemId, ator) }));
}
