import { carregarAutos, carregarDocumento } from "@/lib/processos/autos-server";
import { comAcesso } from "@/lib/processos/http";
import { lerDocumento } from "@/lib/processos/leitura-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** A IA lê o PDF e deixa as sugestões pendentes. Nada é gravado no cadastro aqui. */
export async function POST(_request: Request, { params }: { params: Promise<{ documentoId: string }> }) {
  const { documentoId } = await params;
  return comAcesso(async () => {
    const documento = await carregarDocumento(documentoId);
    const leitura = await lerDocumento(documentoId);
    return { leitura, autos: await carregarAutos(documento.processoId) };
  });
}
