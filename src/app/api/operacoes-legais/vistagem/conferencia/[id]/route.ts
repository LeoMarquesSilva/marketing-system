import { NextResponse } from "next/server";
import { reenviarParaCentral } from "@/lib/vistagem/central-server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import {
  devolverVistagem,
  editarTarefaNaConferencia,
  marcarConferenciaAberta,
  reenviarGravando,
  rodarNovamente,
  validarVistagem,
} from "@/lib/vistagem/juridico-server";
import type { DataDoFluxo } from "@/lib/vistagem/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

function texto(valor: unknown, limite: number): string | null {
  return typeof valor === "string" ? valor.slice(0, limite) : null;
}

/**
 * acao=validar → fila do robô; acao=devolver (com motivo) → volta para o jurídico;
 * acao=editar → ajusta data e responsáveis de uma tarefa, sem devolver (o robô lê a tarefa ao validar);
 * acao=reenviar → grava no VIOS as tarefas que só passaram em simulação;
 * acao=rodar_novamente (forcar opcional) → roda de novo no robô as tarefas que deram erro;
 * acao=central → cria de novo na Central do SharePoint o pedido de abertura de pasta que não chegou;
 * acao=abrir → a controladoria está com a publicação aberta: por alguns minutos o jurídico não reabre a vistagem.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (corpo?.acao === "abrir") return NextResponse.json(await marcarConferenciaAberta(id, authUserId));
    if (corpo?.acao === "validar") return NextResponse.json(await validarVistagem(id, authUserId));
    if (corpo?.acao === "editar") {
      return NextResponse.json(
        await editarTarefaNaConferencia(
          id,
          {
            agendamentoId: texto(corpo.agendamentoId, 64) ?? "",
            data: texto(corpo.data, 10) ?? "",
            dataFatal: texto(corpo.dataFatal, 10),
            hora: texto(corpo.hora, 5),
            horaFim: texto(corpo.horaFim, 5),
            dataLimite: texto(corpo.dataLimite, 10),
            responsavel: texto(corpo.responsavel, 500) ?? "",
            revisor: texto(corpo.revisor, 200),
            // O servidor confere caminho, data e pessoas (validarAgendamentos).
            fluxoDatas: Array.isArray(corpo.fluxoDatas) ? (corpo.fluxoDatas as DataDoFluxo[]) : [],
          },
          authUserId
        )
      );
    }
    if (corpo?.acao === "reenviar") return NextResponse.json(await reenviarGravando(id));
    if (corpo?.acao === "rodar_novamente") return NextResponse.json(await rodarNovamente(id, corpo.forcar === true));
    if (corpo?.acao === "central") return NextResponse.json(await reenviarParaCentral(id));
    if (corpo?.acao === "devolver") {
      await devolverVistagem(
        id,
        { tipo: typeof corpo.tipo === "string" ? corpo.tipo : "", descricao: typeof corpo.descricao === "string" ? corpo.descricao : "" },
        authUserId
      );
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Informe acao: abrir, validar, devolver, editar, reenviar, rodar_novamente ou central." }, { status: 400 });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível concluir a conferência.");
  }
}
