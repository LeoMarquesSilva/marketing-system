import type { AgendamentoResumo } from "./types";

/**
 * Situação da publicação no robô, para o filtro de "Enviadas ao robô" da Conferência (pedido de 09/11/2026). Vale a
 * da tarefa mais urgente: uma com erro põe a publicação em "Com erro", mesmo que as outras já estejam agendadas.
 */
export type SituacaoNoRobo = "erro" | "aguardando_vios" | "com_robo" | "na_fila" | "simulada" | "agendada";

/** Na ordem do filtro: primeiro o que pede ação. */
export const SITUACOES_NO_ROBO: { valor: SituacaoNoRobo; rotulo: string; descricao: string }[] = [
  { valor: "erro", rotulo: "Com erro", descricao: "Alguma tarefa deu erro no robô" },
  { valor: "aguardando_vios", rotulo: "Aguardando o VIOS", descricao: "A publicação ainda não chegou a Intimações; às 17h vai para a pasta" },
  { valor: "com_robo", rotulo: "Com o robô", descricao: "Agendando no VIOS agora" },
  { valor: "na_fila", rotulo: "Na fila do robô", descricao: "Esperando a vez" },
  { valor: "simulada", rotulo: "Só simulada", descricao: "O robô conferiu, mas não gravou no VIOS" },
  { valor: "agendada", rotulo: "Agendada no VIOS", descricao: "Todas as tarefas gravadas no VIOS" },
];

type TarefaNoRobo = Pick<AgendamentoResumo, "envioStatus" | "envioErro" | "envioSimulado">;

/** A fila deixa a tarefa pendente com o motivo no texto do envio enquanto espera o VIOS (ou vai para a pasta às 17h). */
function esperandoOVios(tarefa: TarefaNoRobo): boolean {
  return tarefa.envioStatus === "pendente" && /^Aguardando a disponibilidade da publicação no VIOS|agendar direto na pasta/.test(tarefa.envioErro ?? "");
}

export function situacaoNoRobo(tarefas: TarefaNoRobo[]): SituacaoNoRobo {
  if (tarefas.some((tarefa) => tarefa.envioStatus === "erro")) return "erro";
  if (tarefas.some(esperandoOVios)) return "aguardando_vios";
  if (tarefas.some((tarefa) => tarefa.envioStatus === "enviado" || tarefa.envioStatus === "processando")) return "com_robo";
  if (!tarefas.length || tarefas.some((tarefa) => tarefa.envioStatus !== "concluido")) return "na_fila";
  return tarefas.some((tarefa) => tarefa.envioSimulado) ? "simulada" : "agendada";
}
