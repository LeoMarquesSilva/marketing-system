import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { obterVistagem, salvarVistagem } from "@/lib/vistagem/juridico-server";
import type { AgendamentoEntrada } from "@/lib/vistagem/agendamento";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await exigirAcessoVistagem();
    const { id } = await context.params;
    return NextResponse.json(await obterVistagem(id));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar a publicação.");
  }
}

function texto(valor: unknown, limite = 2000): string | null {
  return typeof valor === "string" ? valor.slice(0, limite) : null;
}

/** Grava as tarefas vinculadas pelo jurídico e manda para a conferência. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as { agendamentos?: unknown; observacao?: unknown } | null;
    const lista = Array.isArray(corpo?.agendamentos) ? corpo.agendamentos.slice(0, 20) : [];
    const agendamentos: AgendamentoEntrada[] = lista.map((item) => {
      const valor = (item ?? {}) as Record<string, unknown>;
      return {
        etiqueta: valor.etiqueta === "PRAZO" ? "PRAZO" : "PROVIDENCIA",
        tarefa: texto(valor.tarefa, 200) ?? "",
        tarefaId: texto(valor.tarefaId, 20),
        data: texto(valor.data, 10) ?? "",
        dataFatal: texto(valor.dataFatal, 10),
        diasPrazo: typeof valor.diasPrazo === "number" ? valor.diasPrazo : null,
        responsavel: texto(valor.responsavel, 200) ?? "",
        revisor: texto(valor.revisor, 200),
        observacao: texto(valor.observacao, 4000),
      };
    });
    await salvarVistagem(id, { agendamentos, observacao: texto(corpo?.observacao) }, authUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível salvar a vistagem.");
  }
}
