import { prepararUpload } from "@/lib/processos/autos-server";
import { comAcesso, lerJson } from "@/lib/processos/http";

export const dynamic = "force-dynamic";

/** URL assinada para o navegador subir o PDF direto no bucket privado. Corpo: { nome, tamanho }. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comAcesso(async () => prepararUpload(id, await lerJson(request)));
}
