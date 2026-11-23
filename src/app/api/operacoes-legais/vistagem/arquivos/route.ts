import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { atualizarPastasDoVios, completarRodadaDaKurier } from "@/lib/vistagem/rodada-kurier-server";
import { importarArquivoKurier, listarArquivosKurier } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";
// A rodada do cron (sugestões da IA até 150 s, de pasta até 60 s) roda junto com a importação.
export const maxDuration = 300;

const TAMANHO_MAXIMO = 20 * 1024 * 1024;

export async function GET() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json({ arquivos: await listarArquivosKurier() });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar os arquivos da Kurier.");
  }
}

/**
 * Envio manual do xlsx da Kurier (contingência quando o SharePoint falha). Roda a mesma rodada do cron:
 * pastas do VIOS antes de triar e, depois da importação, Central, BKP do SIOE, sugestões e envios.
 */
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
    const conteudo = new Uint8Array(await arquivo.arrayBuffer());
    const pastasVios = await atualizarPastasDoVios();
    const resultado = await importarArquivoKurier({
      nome: arquivo.name,
      conteudo,
      origem: "upload",
      enviadoPor: authUserId,
    });
    const etapas = await completarRodadaDaKurier();
    return NextResponse.json({ ...resultado, pastasVios, ...etapas }, { status: resultado.novo ? 201 : 200 });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível importar o arquivo da Kurier.");
  }
}
