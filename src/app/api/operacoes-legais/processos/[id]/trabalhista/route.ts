import { ProcessosError } from "@/lib/processos/errors";
import { comAcesso, lerJson } from "@/lib/processos/http";
import { ehTipoItemTrabalhista } from "@/lib/processos/trabalhista";
import { aplicarRiscoCalculado, carregarTrabalhista, incluirItemTrabalhista } from "@/lib/processos/trabalhista-server";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

/** Afastamentos, pedidos e o cálculo do adicional do processo trabalhista. */
export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async () => ({ trabalhista: await carregarTrabalhista(id) }));
}

/**
 * POST { tipo: "afastamento" | "pedido", dados } — inclui um item lançado à mão.
 * POST { acao: "aplicar_calculo" } — grava na ficha o risco calculado (valor, reflexos e total).
 */
export async function POST(request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    if (corpo.acao === "aplicar_calculo") return aplicarRiscoCalculado(id, ator);
    if (!ehTipoItemTrabalhista(corpo.tipo)) throw new ProcessosError("Tipo de item inválido.", 400);
    const dados = corpo.dados && typeof corpo.dados === "object" && !Array.isArray(corpo.dados) ? (corpo.dados as Record<string, unknown>) : {};
    return { trabalhista: await incluirItemTrabalhista(id, corpo.tipo, dados, ator) };
  });
}
