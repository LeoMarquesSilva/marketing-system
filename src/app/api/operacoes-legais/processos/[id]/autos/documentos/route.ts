import { carregarAutos, registrarDocumento } from "@/lib/processos/autos-server";
import { comAcesso, lerJson } from "@/lib/processos/http";

export const dynamic = "force-dynamic";

/** Registra o PDF que acabou de subir. Corpo: { path, nome }. A leitura é pedida em seguida, em /ler. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comAcesso(async (ator) => {
    const documento = await registrarDocumento(id, await lerJson(request), { origem: "manual", ator });
    return { documento, autos: await carregarAutos(id) };
  });
}
