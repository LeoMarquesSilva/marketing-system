import { ProcessosError } from "@/lib/processos/errors";
import { comAcesso, lerJson } from "@/lib/processos/http";
import { ehTipoItem } from "@/lib/processos/rec-credito";
import { carregarRecCredito, incluirItem, tiposDeTitulo } from "@/lib/processos/rec-credito-server";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

/** Títulos, citações, pedidos e lançamentos do processo, com o cálculo do TJSP. */
export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async () => {
    const [recCredito, tipos] = await Promise.all([carregarRecCredito(id), tiposDeTitulo()]);
    return { recCredito, tiposTitulo: tipos };
  });
}

/** POST { tipo: "titulo" | "citacao" | "pedido" | "lancamento", dados } — inclui um item lançado à mão. */
export async function POST(request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    if (!ehTipoItem(corpo.tipo)) throw new ProcessosError("Tipo de item inválido.", 400);
    const dados = corpo.dados && typeof corpo.dados === "object" && !Array.isArray(corpo.dados) ? (corpo.dados as Record<string, unknown>) : {};
    return { recCredito: await incluirItem(id, corpo.tipo, dados, ator) };
  });
}
