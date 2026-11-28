import { comAcesso, lerJson } from "@/lib/processos/http";
import { configuracaoDosAcordos, salvarConfiguracaoDosAcordos } from "@/lib/processos/negociacao-server";

export const dynamic = "force-dynamic";

/** A caixa que envia os e-mails de acordo e a cópia padrão. */
export async function GET() {
  return comAcesso(async () => ({ configuracao: await configuracaoDosAcordos() }), "carteira");
}

/** PUT { remetente, cc } — remetente vazio: sai da caixa de quem está logado. */
export async function PUT(request: Request) {
  return comAcesso(async (ator) => ({ configuracao: await salvarConfiguracaoDosAcordos(await lerJson(request), ator) }), "carteira");
}
