import "server-only";

import { avisarAlertasGraves, avisarPautaDoDia, horaDeBrasilia } from "./avisos-server";
import { conferirComViosSeDevido, conferirNoDjen } from "./conferencia-server";
import { lerRespostas, sincronizarConvites } from "./convites-server";

/**
 * A rotina da pauta, chamada a cada 10 minutos (pg_cron) e uma vez por dia pela Vercel, por segurança.
 * Cada passo é independente: um erro não impede os outros. Avisos repetidos não saem (dedupe_key).
 */
export async function rodarRotina(agora = new Date()): Promise<Record<string, unknown>> {
  const resultado: Record<string, unknown> = {};
  async function passo(nome: string, acao: () => Promise<unknown>) {
    try {
      resultado[nome] = await acao();
    } catch (erro) {
      resultado[nome] = { erro: erro instanceof Error ? erro.message : String(erro) };
      console.error(`[pauta] rotina/${nome}:`, erro);
    }
  }
  await passo("vios", () => conferirComViosSeDevido(agora));
  await passo("djen", () => conferirNoDjen(25));
  await passo("convites", () => sincronizarConvites());
  await passo("respostas", () => lerRespostas());
  const hora = horaDeBrasilia(agora);
  if (hora >= 7 && hora < 9) await passo("pautaDeHoje", () => avisarPautaDoDia("hoje", agora));
  if (hora >= 17 && hora < 19) await passo("pautaDoProximoDia", () => avisarPautaDoDia("proximo", agora));
  if (hora >= 7 && hora < 19) await passo("alertas", () => avisarAlertasGraves(agora));
  return resultado;
}
