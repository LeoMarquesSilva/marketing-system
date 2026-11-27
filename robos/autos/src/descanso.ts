/**
 * Descanso de um conector depois de o robô esperar uma pessoa em vão (login, código de verificação, CAPTCHA).
 *
 * O robô atende um pedido por vez. Se o login de um tribunal precisa de alguém e ninguém aparece, pedir o mesmo
 * tribunal logo em seguida só repete a espera e segura os pedidos dos outros sistemas. Então, depois de uma espera
 * esgotada, o robô deixa de pedir aquele conector à fila por um tempo (PAUSA_APOS_PESSOA_MINUTOS) e segue com os
 * outros. Fica só na memória: reiniciar o robô zera os descansos.
 */
export class Descansos {
  private readonly ate = new Map<string, number>();

  /** O conector (`"pje:TJRJ"`) fica fora da fila deste robô até `agoraMs + ms`. */
  descansar(chave: string, agoraMs: number, ms: number): void {
    if (ms <= 0) return;
    this.ate.set(chave, Math.max(this.ate.get(chave) ?? 0, agoraMs + ms));
  }

  /** Minutos que faltam para o conector voltar (0 se não está descansando). */
  minutosRestantes(chave: string, agoraMs: number): number {
    return Math.max(0, Math.ceil(((this.ate.get(chave) ?? 0) - agoraMs) / 60_000));
  }

  /** Os conectores que o robô pede à fila agora, na mesma ordem. Vazio: todos descansando. */
  ativos(chaves: readonly string[], agoraMs: number): string[] {
    for (const [chave, ate] of this.ate) if (ate <= agoraMs) this.ate.delete(chave);
    return chaves.filter((chave) => !this.ate.has(chave));
  }
}
