import { comAcesso } from "@/lib/processos/http";
import { conferirRespostas } from "@/lib/processos/negociacao-conversa-server";
import { conferirAlvoTrabalhista } from "@/lib/processos/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { processoIds? } — traz para o histórico o que entrou nas conversas dos e-mails de acordo (respostas dos
 * advogados e o que a equipe mandou pelo Outlook). Sem processoIds, de todos os processos trabalhistas.
 */
export async function POST(request: Request) {
  return comAcesso(async (ator) => {
    const corpo = (await request.json().catch(() => ({}))) as { processoIds?: unknown };
    const ids = Array.isArray(corpo.processoIds) ? corpo.processoIds.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500) : null;
    if (ids) await conferirAlvoTrabalhista(ator, { processos: ids });
    return conferirRespostas(ator, ids?.length ? ids : null);
  }, "carteira");
}
