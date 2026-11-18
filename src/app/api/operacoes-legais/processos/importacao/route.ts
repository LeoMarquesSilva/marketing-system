import { ProcessosError } from "@/lib/processos/errors";
import { comAcesso } from "@/lib/processos/http";
import { sincronizarProcessos, situacaoDaImportacao } from "@/lib/processos/sync-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LIMITE_CSV = 30 * 1024 * 1024;

export async function GET() {
  return comAcesso(async () => situacaoDaImportacao());
}

/** Com arquivo (multipart, campo "arquivo"): importa o CSV do VIOS. Sem arquivo: sincroniza agora pelo SharePoint + SIOE. */
export async function POST(request: Request) {
  return comAcesso(async (ator) => {
    const tipo = request.headers.get("content-type") ?? "";
    if (!tipo.includes("multipart/form-data")) {
      return { resultado: await sincronizarProcessos({ origem: "sharepoint", ator }), situacao: await situacaoDaImportacao() };
    }
    const arquivo = (await request.formData()).get("arquivo");
    if (!(arquivo instanceof File)) throw new ProcessosError("Envie o arquivo CSV exportado do VIOS.", 400);
    if (!/\.csv$/i.test(arquivo.name)) throw new ProcessosError("O arquivo precisa ser o CSV da lista de processos do VIOS.", 400);
    if (arquivo.size > LIMITE_CSV) throw new ProcessosError("Arquivo grande demais (limite de 30 MB).", 413);
    const resultado = await sincronizarProcessos({ origem: "csv", csv: new Uint8Array(await arquivo.arrayBuffer()), arquivo: arquivo.name, ator });
    return { resultado, situacao: await situacaoDaImportacao() };
  });
}
