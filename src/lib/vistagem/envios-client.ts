import { authFetch } from "@/lib/auth-fetch";

const CHAVE = "vistagem.envios-sincronizados-em";
/**
 * Ao abrir a Conferência ou o Check, o andamento do robô só é trazido de novo se a última vez (em qualquer aba deste
 * navegador) foi há mais de 1 minuto: cada vez é uma função na Vercel, e quem alterna entre as duas telas pedia toda
 * hora. O botão Atualizar sempre traz, e o cron também atualiza.
 */
const INTERVALO_MS = 60 * 1000;

/** Guarda a hora da última vez que o andamento do robô foi trazido. */
export function marcarEnviosSincronizados(): void {
  try {
    window.localStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // Sem armazenamento no navegador: a próxima abertura traz de novo.
  }
}

function sincronizadoHaPouco(): boolean {
  try {
    return Date.now() - Number(window.localStorage.getItem(CHAVE) ?? 0) < INTERVALO_MS;
  } catch {
    return false;
  }
}

/** Traz o andamento do robô (tarefas concluídas ou com erro no VIOS). Sem `forcar`, pula se foi feito há menos de 1 minuto. */
export async function sincronizarEnvios(forcar = false): Promise<void> {
  if (!forcar && sincronizadoHaPouco()) return;
  // Marca antes de pedir: duas telas abertas juntas não pedem as duas.
  marcarEnviosSincronizados();
  await authFetch("/api/operacoes-legais/vistagem/envios", { method: "POST" }).catch(() => null);
}
