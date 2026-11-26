import "server-only";

import { avisarAlertasGraves, avisarPautaDoDia, horaDeBrasilia } from "./avisos-server";
import { conferirComVios, conferirComViosSeDevido, conferirNoDjen, ORIGEM_AUTOMATICA } from "./conferencia-server";
import { lerRespostas, lerRespostasSeDevido, sincronizarConvites, sincronizarConvitesDe } from "./convites-server";

/**
 * A rotina da pauta, na régua do Samuel: às 7h (pauta de hoje) e às 17h (pauta do próximo dia útil) dos dias úteis,
 * pelo pg_cron do SAMA, e às 8h pela Vercel, por segurança. Cada passo é independente: um erro não impede os outros.
 * Avisos repetidos não saem (dedupe_key). O que é "na hora" (troca, mudança no tribunal, alertas, convites) não espera
 * a rotina: ver `reagirAMudanca`.
 */
export async function rodarRotina(agora = new Date(), opcoes: { forcarVios?: boolean } = {}): Promise<Record<string, unknown>> {
  const resultado: Record<string, unknown> = {};
  async function passo(nome: string, acao: () => Promise<unknown>) {
    try {
      resultado[nome] = await acao();
    } catch (erro) {
      resultado[nome] = { erro: erro instanceof Error ? erro.message : String(erro) };
      console.error(`[pauta] rotina/${nome}:`, erro);
    }
  }
  await passo("vios", () => (opcoes.forcarVios ? conferirComVios(ORIGEM_AUTOMATICA, agora) : conferirComViosSeDevido(agora)));
  await passo("djen", () => conferirNoDjen(25));
  await passo("convites", () => sincronizarConvites());
  await passo("respostas", () => lerRespostas());
  const hora = horaDeBrasilia(agora);
  if (hora >= 7 && hora < 9) await passo("pautaDeHoje", () => avisarPautaDoDia("hoje", agora));
  if (hora >= 17 && hora < 19) await passo("pautaDoProximoDia", () => avisarPautaDoDia("proximo", agora));
  await passo("alertas", () => avisarAlertasGraves(agora));
  return resultado;
}

/**
 * "Na hora", como na régua do Samuel: depois do que muda a pauta, acerta os convites do Outlook (só das audiências
 * mexidas, ou da janela toda depois de uma leitura), lê as respostas aos convites (no máximo a cada 10 minutos) e manda
 * à coordenação os alertas novos (sem titular, conflito, deslocamento, convite recusado; só em dia útil, 7h–19h).
 * Para chamar depois de responder (after): cada passo isolado, nunca derruba quem chamou.
 *
 * - leitura do robô (PJe ou Jus.br): { respostas: true }
 * - troca de titular/backup, o que a equipe completa: { ids: [id] }
 * - tela aberta (Pauta, Distribuição): { convites: false, respostas: true, alertas: "se recusou" }
 */
export async function reagirAMudanca(opcoes: { ids?: string[]; convites?: boolean; respostas?: boolean; alertas?: true | "se recusou" } = {}): Promise<void> {
  if (opcoes.convites !== false) await sincronizarConvitesDe(opcoes.ids);
  let recusas = 0;
  if (opcoes.respostas) {
    try {
      recusas = (await lerRespostasSeDevido())?.recusas ?? 0;
    } catch (erro) {
      console.error("[pauta] respostas dos convites:", erro instanceof Error ? erro.message : erro);
    }
  }
  if ((opcoes.alertas ?? true) === "se recusou" && !recusas) return;
  try {
    await avisarAlertasGraves();
  } catch (erro) {
    console.error("[pauta] alertas para a coordenação:", erro instanceof Error ? erro.message : erro);
  }
}
