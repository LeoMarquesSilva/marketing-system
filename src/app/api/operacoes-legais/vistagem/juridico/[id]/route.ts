import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { obterVistagem, salvarVistagem } from "@/lib/vistagem/juridico-server";
import { ETIQUETAS_AGENDAMENTO, type AgendamentoEntrada } from "@/lib/vistagem/agendamento";
import { CONTAGENS_PRAZO } from "@/lib/vistagem/dias-uteis";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** A vistagem da publicação; com `escritorio` (e `ci`), a prévia do "Agendar Direto" da controladoria. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { areas } = await exigirPerfilVistagem();
    const { id } = await context.params;
    const busca = new URL(request.url).searchParams;
    const escritorio = busca.get("escritorio")?.trim();
    return NextResponse.json(await obterVistagem(id, areas, escritorio ? { escritorio, ci: busca.get("ci") } : null));
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
    const { authUserId, areas } = await exigirPerfilVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as {
      agendamentos?: unknown;
      observacao?: unknown;
      publicacaoEsocial?: unknown;
      sugestaoUsada?: unknown;
      resolucao?: unknown;
    } | null;
    const resolucao = corpo?.resolucao && typeof corpo.resolucao === "object" ? (corpo.resolucao as Record<string, unknown>) : null;
    const lista = Array.isArray(corpo?.agendamentos) ? corpo.agendamentos.slice(0, 20) : [];
    const agendamentos: AgendamentoEntrada[] = lista.map((item) => {
      const valor = (item ?? {}) as Record<string, unknown>;
      return {
        etiqueta: ETIQUETAS_AGENDAMENTO.find((etiqueta) => etiqueta === valor.etiqueta) ?? "PROVIDENCIA",
        tarefa: texto(valor.tarefa, 200) ?? "",
        tarefaId: texto(valor.tarefaId, 20),
        data: texto(valor.data, 10) ?? "",
        dataFatal: texto(valor.dataFatal, 10),
        diasPrazo: typeof valor.diasPrazo === "number" ? valor.diasPrazo : null,
        contagemPrazo: CONTAGENS_PRAZO.find((contagem) => contagem === valor.contagemPrazo) ?? null,
        hora: texto(valor.hora, 5),
        responsavel: texto(valor.responsavel, 200) ?? "",
        revisor: texto(valor.revisor, 200),
        observacao: texto(valor.observacao, 4000),
      };
    });
    await salvarVistagem(
      id,
      {
        agendamentos,
        observacao: texto(corpo?.observacao),
        publicacaoEsocial: texto(corpo?.publicacaoEsocial, 60),
        sugestaoUsada: corpo?.sugestaoUsada === true,
        resolucao: resolucao
          ? {
              escritorio: texto(resolucao.escritorio, 80) ?? undefined,
              grupo: texto(resolucao.grupo, 200) ?? undefined,
              ci: texto(resolucao.ci, 20) ?? undefined,
              demandaRisco: typeof resolucao.demandaRisco === "boolean" ? resolucao.demandaRisco : undefined,
            }
          : null,
      },
      authUserId,
      areas
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível salvar a vistagem.");
  }
}
