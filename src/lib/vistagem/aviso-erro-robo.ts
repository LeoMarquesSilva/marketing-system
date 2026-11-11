/**
 * Aviso no WhatsApp quando o robô do SAMA erra um agendamento da vistagem (pedido de 11/11/2026): vai para o grupo
 * "OPERAÇÕES LEGAIS - GERAL" com o erro resumido e o número do processo da publicação.
 */

export interface ErroDoRobo {
  numeroProcesso: string | null;
  erro: string | null;
}

const LIMITE_RESUMO = 200;
const LIMITE_PROCESSOS = 20;

/** Corta o detalhe técnico (log do navegador, "Detalhe: …") e encurta. */
function partePrincipal(texto: string): string {
  const principal = texto.split(/\r?\n|\s+Detalhe:|\s+Call log:/)[0].replace(/\s+/g, " ").trim();
  return principal.length > LIMITE_RESUMO ? `${principal.slice(0, LIMITE_RESUMO - 1).trimEnd()}…` : principal;
}

/**
 * O erro do robô numa frase curta. Os casos conhecidos perdem o que muda a cada publicação (ID de comunicação, número
 * do tipo), para o mesmo erro em vários processos sair numa linha só.
 */
export function resumoDoErro(erro: string | null | undefined): string {
  const texto = String(erro ?? "").trim();
  if (!texto) return "Erro sem descrição.";
  // O robô pode já ter gravado: o aviso dele vem antes de qualquer detalhe técnico.
  if (/^ATENÇÃO/i.test(texto)) return partePrincipal(texto);
  if (/^Execução interrompida/i.test(texto)) return "Execução interrompida: o robô reiniciou no meio. Confira no VIOS antes de reenviar.";
  if (/ERR_CERT/i.test(texto)) return "O certificado do site do VIOS está inválido: o robô não conseguiu entrar.";
  const rede = texto.match(/net::(ERR_[A-Z_]+)/);
  if (rede) return `O robô não conseguiu abrir o VIOS (${rede[1]}).`;
  if (/não está em Intimações do VIOS/i.test(texto)) return "A publicação não está em Intimações do VIOS. Nada foi agendado.";
  const tipo = texto.match(/o tipo de tarefa \d+ \(([^)]+)\) não está na lista do VIOS para este processo/i);
  if (tipo) return `O tipo de tarefa ${tipo[1]} não está na lista do VIOS para este processo.`;
  const limite = texto.match(/^Tempo limite de (\d+)s excedido/i);
  if (limite) return `O robô passou do tempo limite (${limite[1]} s) e parou.`;
  return partePrincipal(texto);
}

/** Uma mensagem para a rodada: cada erro resumido com os processos em que aconteceu. Sem erro, null. */
export function mensagemErrosDoRobo(erros: ErroDoRobo[]): string | null {
  if (!erros.length) return null;
  const grupos = new Map<string, string[]>();
  for (const { numeroProcesso, erro } of erros) {
    const resumo = resumoDoErro(erro);
    const numero = numeroProcesso?.trim() || "sem número de processo";
    const processos = grupos.get(resumo) ?? [];
    if (!processos.includes(numero)) processos.push(numero);
    grupos.set(resumo, processos);
  }
  const blocos = [...grupos].map(([resumo, processos]) => {
    const linhas = processos.slice(0, LIMITE_PROCESSOS).map((numero) => `• ${numero}`);
    if (processos.length > LIMITE_PROCESSOS) linhas.push(`• … e mais ${processos.length - LIMITE_PROCESSOS}`);
    return [resumo, ...linhas].join("\n");
  });
  return ["⚠️ *Erro no agendamento do robô*", ...blocos].join("\n\n");
}
