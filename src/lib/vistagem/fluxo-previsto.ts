import { somarDiasUteis } from "./dias-uteis";
import { PESSOA_FIXA_PROTOCOLAR, cadeiaDoFluxo, type FluxoDaTarefa } from "./fluxo-vios";
import type { AgendamentoResumo, TarefaPrevista } from "./types";

/**
 * O que o fluxo automático do VIOS vai criar com a tarefa agendada, para a controladoria conferir antes de
 * mandar ao robô: as tarefas criadas junto, com quem o robô coloca em cada uma (2. REVISAR com o revisor,
 * 3. PROTOCOLAR com o responsável e o Samuel, o resto com o responsável), e as criadas ao concluir. Como na
 * vistagem do jurídico, só o Revisar e o Protocolar têm data: o VIOS conta os dias úteis a partir da data
 * da tarefa (no Prazo, o Enviar).
 */
export function fluxoPrevisto(
  agendamento: Pick<AgendamentoResumo, "data" | "responsavel" | "revisor">,
  fluxo: FluxoDaTarefa | null,
  ehDiaUtil: (iso: string) => boolean
): TarefaPrevista[] {
  if (!fluxo) return [];
  const cadeia = cadeiaDoFluxo(fluxo);
  const depois = (dias: number | null | undefined) =>
    agendamento.data && dias !== null && dias !== undefined ? somarDiasUteis(agendamento.data, dias, ehDiaUtil) : null;
  const responsavel = agendamento.responsavel || "responsável";
  return [
    ...fluxo.criacao.map((tarefa): TarefaPrevista => {
      if (tarefa.papel === "revisor") {
        return { nome: tarefa.nome, data: depois(cadeia?.revisar), responsaveis: agendamento.revisor || "padrão do VIOS (sem revisor)", quando: "criacao" };
      }
      if (tarefa.papel === "protocolar") {
        return { nome: tarefa.nome, data: depois(cadeia?.protocolar), responsaveis: `${responsavel} + ${PESSOA_FIXA_PROTOCOLAR}`, quando: "criacao" };
      }
      return { nome: tarefa.nome, data: null, responsaveis: responsavel, quando: "criacao" };
    }),
    ...fluxo.conclusao.map((tarefa): TarefaPrevista => ({ nome: tarefa.nome, data: null, responsaveis: "padrão do VIOS", quando: "conclusao" })),
  ];
}
