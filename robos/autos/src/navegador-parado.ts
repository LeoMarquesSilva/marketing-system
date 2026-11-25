/**
 * Navegador do robô fechado com a fila parada (25/11/2026): o robô abria o navegador ao subir e só fechava ao trocar o
 * certificado ou ao encerrar. No servidor, o robo-autos-eproc-tjsp chegou a 2,7 GB de 7,8 GB da VPS parado, com o
 * Chromium aberto há dias. Agora, com a fila vazia por NAVEGADOR_FECHAR_PARADO_MINUTOS, ele fecha o navegador e
 * reabre no próximo pedido (o perfil fica no disco; o login por certificado se refaz sozinho).
 */

/** Minutos parado antes de fechar, no modo playwright (o do servidor). */
export const MINUTOS_PARADO_PADRAO = 10;

/**
 * Quanto tempo (ms) a fila fica vazia antes de o robô fechar o navegador; 0 = nunca fecha.
 * - NAVEGADOR_FECHAR_PARADO_MINUTOS com um número: esse tempo (de 1 a 1440 minutos);
 * - "0", "nao", "não" ou "nunca": nunca fecha;
 * - vazio: 10 minutos no modo playwright (servidor, login pelo certificado). No modo chrome (o Chrome da máquina,
 *   em que uma pessoa pode ter entrado no tribunal), nunca fecha, como antes.
 */
export function limiteParadoDoNavegador(valor: string, navegadorModo: string): number {
  const texto = valor.trim();
  if (/^(0+|nao|não|nunca)$/i.test(texto)) return 0;
  const minutos = Number(texto.replace(",", "."));
  if (texto && Number.isFinite(minutos) && minutos > 0) return Math.round(Math.min(minutos, 1440) * 60_000);
  return navegadorModo === "playwright" ? MINUTOS_PARADO_PADRAO * 60_000 : 0;
}

/** O navegador está aberto e a fila está vazia há o limite ou mais: é hora de fechar. */
export function navegadorParadoDemais(estado: { aberto: boolean; paradoDesdeMs: number | null; agoraMs: number; limiteMs: number }): boolean {
  if (!estado.aberto || estado.limiteMs <= 0 || estado.paradoDesdeMs === null) return false;
  return estado.agoraMs - estado.paradoDesdeMs >= estado.limiteMs;
}
