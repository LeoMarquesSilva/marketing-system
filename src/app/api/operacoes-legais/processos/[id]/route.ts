import { comAcesso, lerJson } from "@/lib/processos/http";
import { atualizarProcesso, detalharProcesso } from "@/lib/processos/processos-server";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async () => ({ processo: await detalharProcesso(id) }));
}

/** Corpo: { valores: { campo: valor, … } } só com os campos alterados. */
export async function PATCH(request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    const valores = corpo.valores && typeof corpo.valores === "object" && !Array.isArray(corpo.valores) ? (corpo.valores as Record<string, unknown>) : {};
    return { processo: await atualizarProcesso(id, valores, ator) };
  });
}
