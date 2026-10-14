import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { importarArquivoKurier, listarArquivosKurier } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TAMANHO_MAXIMO = 20 * 1024 * 1024;

export async function GET() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json({ arquivos: await listarArquivosKurier() });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar os arquivos da Kurier.");
  }
}

/** Envio manual do xlsx da Kurier (contingência quando o SharePoint falha). */
export async function POST(request: Request) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const form = await request.formData();
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Envie o arquivo .xlsx da Kurier." }, { status: 400 });
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      return NextResponse.json({ error: "Arquivo maior que 20 MB." }, { status: 413 });
    }
    const resultado = await importarArquivoKurier({
      nome: arquivo.name,
      conteudo: new Uint8Array(await arquivo.arrayBuffer()),
      origem: "upload",
      enviadoPor: authUserId,
    });
    return NextResponse.json(resultado, { status: resultado.novo ? 201 : 200 });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível importar o arquivo da Kurier.");
  }
}
