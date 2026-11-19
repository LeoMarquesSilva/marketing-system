import { NextResponse } from "next/server";
import { importarRelatorioDoVios } from "@/lib/audiencias/conferencia-server";
import { respostaDeErro } from "@/lib/audiencias/http";
import { registrarLeituraPje } from "@/lib/audiencias/leitura-server";
import { AudienciasError, exigirAcessoPauta, exigirAdmin } from "@/lib/audiencias/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Reserva manual (admin):
 * - multipart com `arquivo` = relatório de tarefas do VIOS (pxe-lista em CSV, windows-1252);
 * - JSON { tribunal, registros } = resposta da Minha Pauta do PJe salva à mão.
 */
export async function POST(request: Request) {
  try {
    const ator = await exigirAcessoPauta();
    exigirAdmin(ator);
    const tipo = request.headers.get("content-type") ?? "";
    if (tipo.includes("multipart/form-data")) {
      const arquivo = (await request.formData()).get("arquivo");
      if (!(arquivo instanceof File)) throw new AudienciasError("Envie o relatório do VIOS no campo arquivo.", 400);
      if (arquivo.size > 30 * 1024 * 1024) throw new AudienciasError("Arquivo grande demais (máximo 30 MB).", 413);
      const texto = new TextDecoder("windows-1252").decode(await arquivo.arrayBuffer());
      return NextResponse.json({ vios: await importarRelatorioDoVios(texto, ator.nome) });
    }
    const corpo = (await request.json()) as Record<string, unknown>;
    return NextResponse.json({ pje: await registrarLeituraPje({ tribunal: corpo.tribunal, registros: corpo.registros, origem: `upload: ${ator.nome ?? "admin"}` }) });
  } catch (error) {
    return respostaDeErro(error);
  }
}
