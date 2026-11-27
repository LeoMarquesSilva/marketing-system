import { ProcessosError } from "@/lib/processos/errors";
import { comAcesso, lerJson } from "@/lib/processos/http";
import { enviarEmailDeAcordo, marcarRascunhoEnviado } from "@/lib/processos/negociacao-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { acao: "enviar", confirmado: true, processoIds, para, assunto, texto } — envia pelo Outlook de quem está
 * logado (só pelo botão de confirmação da tela).
 * POST { acao: "marcar_enviado", processoIds, para, assunto, texto } — o rascunho (.eml) foi enviado à mão.
 */
export async function POST(request: Request) {
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    if (corpo.acao === "enviar") return enviarEmailDeAcordo(corpo, ator);
    if (corpo.acao === "marcar_enviado") return marcarRascunhoEnviado(corpo, ator);
    throw new ProcessosError("Ação desconhecida.", 400);
  });
}
