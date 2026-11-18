/**
 * Quando os avisos de entrada (festa, pesquisa, BP Awards) perguntaram ao servidor se há algo pendente. Fica no
 * `localStorage`, valendo para todas as abas e recargas por `CONFERIR_CONVITE_A_CADA_MS`. Antes ficava no
 * `sessionStorage`: cada aba nova perguntava de novo, e cada pergunta é uma função na Vercel (~350 em 12 h somando os
 * três, em 12/11/2026, no plano Hobby que estourava o CPU).
 */
export const CONFERIR_CONVITE_A_CADA_MS = 2 * 60 * 60 * 1000;

type Armazenamento = Pick<Storage, "getItem" | "setItem">;

function armazenamento(): Armazenamento | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Já perguntou ao servidor há menos de `CONFERIR_CONVITE_A_CADA_MS` (em qualquer aba)? */
export function conviteConferidoHaPouco(chave: string, agora = Date.now(), loja: Armazenamento | null = armazenamento()): boolean {
  try {
    const quando = Number(loja?.getItem(chave));
    return Number.isFinite(quando) && quando > 0 && agora - quando < CONFERIR_CONVITE_A_CADA_MS && quando <= agora;
  } catch {
    return false;
  }
}

/** Guarda que perguntou agora. Sem armazenamento no navegador, o aviso só volta a perguntar na próxima entrada. */
export function marcarConviteConferido(chave: string, agora = Date.now(), loja: Armazenamento | null = armazenamento()): void {
  try {
    loja?.setItem(chave, String(agora));
  } catch {
    // Navegador sem armazenamento: nada a guardar.
  }
}
