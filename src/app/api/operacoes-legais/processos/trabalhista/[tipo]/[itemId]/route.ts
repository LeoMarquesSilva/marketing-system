import { ProcessosError } from "@/lib/processos/errors";
import { comAcesso, lerJson } from "@/lib/processos/http";
import { ehTipoItemTrabalhista, type TipoItemTrabalhista } from "@/lib/processos/trabalhista";
import { alterarItemTrabalhista, excluirItemTrabalhista } from "@/lib/processos/trabalhista-server";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ tipo: string; itemId: string }> };

function tipoDaRota(tipo: string): TipoItemTrabalhista {
  if (!ehTipoItemTrabalhista(tipo)) throw new ProcessosError("Tipo de item inválido.", 400);
  return tipo;
}

/** PUT { dados } — substitui os dados do afastamento ou do pedido (o formulário manda o item inteiro). */
export async function PUT(request: Request, { params }: Contexto) {
  const { tipo, itemId } = await params;
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    const dados = corpo.dados && typeof corpo.dados === "object" && !Array.isArray(corpo.dados) ? (corpo.dados as Record<string, unknown>) : {};
    return { trabalhista: await alterarItemTrabalhista(tipoDaRota(tipo), itemId, dados, ator) };
  }, { item: tipoDaRota(tipo), id: itemId });
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const { tipo, itemId } = await params;
  return comAcesso(async (ator) => ({ trabalhista: await excluirItemTrabalhista(tipoDaRota(tipo), itemId, ator) }), { item: tipoDaRota(tipo), id: itemId });
}
