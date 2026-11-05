import { NextResponse, type NextRequest } from "next/server";
import { CHAVES_CONFIGURACAO, type ChaveConfiguracao } from "@/lib/vistagem/configuracoes";
import { salvarConfiguracao } from "@/lib/vistagem/configuracoes-server";
import { VistagemError } from "@/lib/vistagem/errors";
import { exigirAdminVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { painelDeRegras } from "@/lib/vistagem/regras-server";

export const dynamic = "force-dynamic";

/** Configurações da Vistagem (só admin): regras em vigor, o que é editável, números dos últimos 30 dias e histórico. */
export async function GET() {
  try {
    await exigirAdminVistagem();
    return NextResponse.json(await painelDeRegras(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar as configurações.");
  }
}

/** Altera uma regra: { chave, valor }. Fica no histórico quem mudou, de quê para quê. */
export async function PUT(request: NextRequest) {
  try {
    const authUserId = await exigirAdminVistagem();
    const corpo = (await request.json().catch(() => null)) as { chave?: string; valor?: unknown } | null;
    const chave = corpo?.chave as ChaveConfiguracao | undefined;
    if (!chave || !CHAVES_CONFIGURACAO.includes(chave)) throw new VistagemError("Configuração desconhecida.");
    try {
      await salvarConfiguracao(chave, corpo?.valor, authUserId);
    } catch (erro) {
      if (erro instanceof VistagemError) throw erro;
      // Erro de validação (zod): o valor não está no formato da regra.
      if (erro && typeof erro === "object" && "issues" in erro) throw new VistagemError("Valor inválido para esta configuração.");
      throw erro;
    }
    return NextResponse.json(await painelDeRegras(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível salvar a configuração.");
  }
}
