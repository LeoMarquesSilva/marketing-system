import "server-only";

import { getSioeClient } from "@/lib/sioe-sync-server";
import { INICIO_DO_BKP } from "./bkp-sioe";
import { feriadosDoSioe, gravarNoBkp, montarLinhasDoBkp, publicacoesFechadasDesde, publicacoesPorIds, quantasFaltamNoBkp } from "./bkp-sioe-lote";
import { admin } from "./server";

/**
 * Grava no BKP do SIOE (sp_publicacoes) a publicação que fechou a esteira, no lugar da lista BKP do SharePoint.
 * Desligado até a troca: só grava com VISTAGEM_BKP_SIOE=on na Vercel (e com a coluna orquestra_id no SIOE).
 * Falhar na hora não derruba o check nem a revisão da duplicidade: fica no log, e o repasse do cron grava de novo.
 */
export function bkpLigado(): boolean {
  return process.env.VISTAGEM_BKP_SIOE?.trim().toLowerCase() === "on";
}

/** Para chamar depois do check, da duplicidade e da triagem: erro no BKP só vai para o log. */
export async function registrarNoBkpSemFalhar(publicacaoIds: string[]): Promise<void> {
  if (!bkpLigado() || !publicacaoIds.length) return;
  try {
    const db = admin();
    const sioe = getSioeClient();
    const linhas = await montarLinhasDoBkp(db, await publicacoesPorIds(db, publicacaoIds), await feriadosDoSioe(sioe));
    await gravarNoBkp(sioe, linhas);
  } catch (erro) {
    console.error("[vistagem] BKP do SIOE", publicacaoIds, erro instanceof Error ? erro.message : erro);
  }
}

/**
 * Rede de segurança do cron: regrava o que fechou nos últimos 15 dias. Pega o que falhou na hora e o que mudou depois
 * de fechar (inconsistência excluída, por exemplo). Vale só para os lotes da troca em diante.
 */
export async function repassarAoBkp(): Promise<{ ligado: boolean; gravadas: number; faltavam: number }> {
  if (!bkpLigado()) return { ligado: false, gravadas: 0, faltavam: 0 };
  const quinzeDias = new Date(Date.now() - 15 * 86_400_000).toISOString().slice(0, 10);
  const db = admin();
  const sioe = getSioeClient();
  const publicacoes = await publicacoesFechadasDesde(db, quinzeDias > INICIO_DO_BKP ? quinzeDias : INICIO_DO_BKP);
  const linhas = await montarLinhasDoBkp(db, publicacoes, await feriadosDoSioe(sioe));
  const faltavam = await quantasFaltamNoBkp(sioe, linhas);
  if (faltavam) console.error(`[vistagem] BKP do SIOE: ${faltavam} publicação(ões) fechadas não tinham sido gravadas na hora.`);
  await gravarNoBkp(sioe, linhas);
  return { ligado: true, gravadas: linhas.length, faltavam };
}
