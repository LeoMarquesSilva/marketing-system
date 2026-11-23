import "server-only";

import { repassarAoBkp } from "./bkp-sioe-server";
import { repassarPendentesACentral } from "./central-server";
import { atualizarEnvios } from "./juridico-server";
import { sincronizarPastasVios } from "./pastas-vios";
import type { EtapaDaRodada, EtapasDaRodada, RodadaDaKurier } from "./rodada-kurier";
import { sincronizarKurierSharePoint } from "./server";
import { gerarSugestoesPendentes } from "./sugestao-ia-server";
import { gerarSugestoesDeTriagem } from "./sugestao-triagem-server";

async function etapa<T>(nome: string, rodar: () => Promise<T>): Promise<EtapaDaRodada<T>> {
  try {
    return await rodar();
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(`[vistagem/rodada-kurier] ${nome}`, mensagem);
    return { erro: mensagem };
  }
}

/** Vínculo e auxiliar das pastas (Processos Lista do VIOS): roda antes de triar o dia. */
export function atualizarPastasDoVios(): Promise<EtapasDaRodada["pastasVios"]> {
  return etapa("pastas do VIOS", sincronizarPastasVios);
}

/** Tudo o que vem depois de importar e triar. Uma etapa que falha não impede as seguintes. */
export async function completarRodadaDaKurier(): Promise<Omit<EtapasDaRodada, "pastasVios">> {
  // Pedido de abertura de pasta que não chegou à Central do SharePoint: tenta de novo antes de regravar o BKP.
  const central = await etapa("Central", repassarPendentesACentral);
  // Rede de segurança do BKP do SIOE: regrava o que fechou e não entrou na hora.
  const bkp = await etapa("BKP do SIOE", repassarAoBkp);
  // Publicações sem pasta: dados sugeridos (processo citado, parte cliente ou IA) para a controladoria conferir.
  const sugestoesPasta = await etapa("sugestão de pasta", () => gerarSugestoesDeTriagem(60_000));
  // Sugestão da IA já pronta quando o jurídico abrir; o que não couber a tela gera.
  const sugestoesIa = await etapa("sugestão da IA", () => gerarSugestoesPendentes(150_000));
  // Andamento das tarefas enviadas ao robô do SAMA.
  const envios = await etapa("envios ao robô", atualizarEnvios);
  return { central, bkp, sugestoesPasta, sugestoesIa, envios };
}

/**
 * A rodada inteira, a mesma do cron e do botão "Buscar no SharePoint": pastas do VIOS, arquivo do dia
 * no SharePoint (importa e tria) e o resto. Uma falha ao listar o SharePoint interrompe a rodada.
 */
export async function rodarRodadaDaKurier(): Promise<RodadaDaKurier> {
  const pastasVios = await atualizarPastasDoVios();
  const resultado = await sincronizarKurierSharePoint();
  return { ...resultado, pastasVios, ...(await completarRodadaDaKurier()) };
}
