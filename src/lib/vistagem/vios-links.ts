/** Endereço da tarefa no VIOS pelo CI (pxe_id) devolvido pelo robô — o mesmo link do SAMA. */
const VIOS_TAREFA_URL = "https://bp.vios.com.br/index.php?pag=sys/processos/pxe.php&pxe_id=";

export function linkTarefaVios(ci: string): string {
  return `${VIOS_TAREFA_URL}${encodeURIComponent(ci)}`;
}
