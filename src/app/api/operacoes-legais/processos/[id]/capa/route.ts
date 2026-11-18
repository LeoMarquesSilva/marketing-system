import { carregarAutos } from "@/lib/processos/autos-server";
import { completarCapa } from "@/lib/processos/capa-server";
import { comAcesso } from "@/lib/processos/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Consulta o DataJud e deixa as sugestões de capa pendentes na ficha (nada é gravado sem aprovação). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comAcesso(async () => {
    const capa = await completarCapa(id);
    return { capa, autos: await carregarAutos(id) };
  });
}
