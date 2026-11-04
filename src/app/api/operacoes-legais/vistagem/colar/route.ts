import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { MAX_TEXTO_COLADO } from "@/lib/vistagem/importacao-texto";
import { importarPublicacoesColadas } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Publicações coladas de e-mail ou Teams: entram na mesma esteira do arquivo da Kurier. */
export async function POST(request: Request) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const corpo = (await request.json().catch(() => null)) as { texto?: unknown } | null;
    const texto = typeof corpo?.texto === "string" ? corpo.texto : "";
    if (!texto.trim()) return NextResponse.json({ error: "Cole o texto das publicações." }, { status: 400 });
    if (texto.length > MAX_TEXTO_COLADO) {
      return NextResponse.json({ error: "Texto grande demais: cole no máximo 1 milhão de caracteres por vez." }, { status: 413 });
    }
    const resultado = await importarPublicacoesColadas({ texto, enviadoPor: authUserId });
    return NextResponse.json(resultado, { status: resultado.novo ? 201 : 200 });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível importar as publicações coladas.");
  }
}
