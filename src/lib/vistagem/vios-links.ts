/** Endereço da tarefa no VIOS pelo CI (pxe_id) devolvido pelo robô — o mesmo link do SAMA. */
const VIOS_TAREFA_URL = "https://bp.vios.com.br/index.php?pag=sys/processos/pxe.php&pxe_id=";

/** Endereço da pasta (Processo) no VIOS pelo CI — a mesma tela que o robô abre. */
const VIOS_PASTA_URL = "https://bp.vios.com.br/index.php?pag=sys/processos/processos-vis.php&processos_id=";

/** Endereço da pasta de Atendimento no VIOS pelo CI (outra tela; a de processo não abre o atendimento). */
const VIOS_ATENDIMENTO_URL = "https://bp.vios.com.br/index.php?pag=sys/processos/pastas-vis.php&processos_id=";

export function linkTarefaVios(ci: string): string {
  return `${VIOS_TAREFA_URL}${encodeURIComponent(ci)}`;
}

/** `tipo`: o da pasta informada na Triagem Manual; atendimento (ou desconhecido) abre a tela de atendimento. */
export function linkPastaVios(ci: string, tipo?: "Processo" | "Atendimento" | "Desconhecido" | null): string {
  const base = tipo === "Atendimento" || tipo === "Desconhecido" ? VIOS_ATENDIMENTO_URL : VIOS_PASTA_URL;
  return `${base}${encodeURIComponent(ci)}`;
}
