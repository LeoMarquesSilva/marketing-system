/**
 * Rodada da Kurier: o que o cron da manhã faz em volta do arquivo do dia. "Buscar no SharePoint" e
 * "Enviar xlsx" rodam a mesma rodada, para que um dia em que o cron falhou fique igual a um dia normal.
 * Aqui ficam os tipos e o texto do resumo (sem servidor); a execução está em rodada-kurier-server.ts.
 */
import type { SincronizacaoResultado } from "./types";

/** Cada etapa devolve o próprio resumo ou o erro, sem derrubar as seguintes. */
export type EtapaDaRodada<T> = T | { erro: string };

export interface EtapasDaRodada {
  pastasVios: EtapaDaRodada<{ pastas: number }>;
  central: EtapaDaRodada<{ pendentes: number; enviadas: number; erros: number }>;
  bkp: EtapaDaRodada<{ ligado: boolean; gravadas: number; faltavam: number }>;
  sugestoesPasta: EtapaDaRodada<{
    pendentes: number;
    geradas: number;
    porNumero: number;
    porParte: number;
    porIa: number;
    erros: number;
    custoUS: number;
  }>;
  sugestoesIa: EtapaDaRodada<{ pendentes: number; geradas: number; erros: number; custoUS: number }>;
  envios: EtapaDaRodada<{
    consultadas: number;
    concluidas: number;
    erros: number;
    checadasSozinhas: number;
    avisoErros?: { enviado: boolean; motivo?: string };
  }>;
}

/** Resposta do cron e do botão "Buscar no SharePoint". */
export type RodadaDaKurier = SincronizacaoResultado & EtapasDaRodada;

const NOMES_DAS_ETAPAS: Record<keyof EtapasDaRodada, string> = {
  pastasVios: "pastas do VIOS",
  central: "Central do SharePoint",
  bkp: "BKP do SIOE",
  sugestoesPasta: "sugestão de pasta",
  sugestoesIa: "sugestão da IA",
  envios: "envios ao robô",
};

export function etapaFalhou(etapa: EtapaDaRodada<object> | undefined): etapa is { erro: string } {
  return Boolean(etapa && "erro" in etapa);
}

/** "pastas do VIOS (motivo)" para cada etapa que falhou, na ordem da rodada. */
export function etapasComErro(etapas: Partial<EtapasDaRodada>): string[] {
  return (Object.keys(NOMES_DAS_ETAPAS) as (keyof EtapasDaRodada)[]).flatMap((chave) => {
    const etapa = etapas[chave];
    return etapaFalhou(etapa) ? [`${NOMES_DAS_ETAPAS[chave]} (${etapa.erro})`] : [];
  });
}

function juntar(partes: string[]): string {
  return partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}` : (partes[0] ?? "");
}

function ok<T extends object>(etapa: EtapaDaRodada<T> | undefined): T | null {
  return etapa && !etapaFalhou(etapa) ? (etapa as T) : null;
}

/**
 * O que a rodada fez além de importar e triar, numa frase que segue o resumo da importação
 * (começa com espaço). Vazia quando a resposta não traz nenhuma etapa.
 */
export function resumoDaRodada(etapas: Partial<EtapasDaRodada>): string {
  const feito: string[] = [];
  const pastasVios = ok(etapas.pastasVios);
  if (pastasVios) feito.push(`${pastasVios.pastas.toLocaleString("pt-BR")} pastas do VIOS atualizadas`);
  const sugestoesIa = ok(etapas.sugestoesIa);
  if (sugestoesIa?.geradas) feito.push(`${sugestoesIa.geradas} sugestão(ões) da IA`);
  if (sugestoesIa?.erros) feito.push(`${sugestoesIa.erros} sugestão(ões) da IA com erro (a tela gera ao abrir)`);
  const sugestoesPasta = ok(etapas.sugestoesPasta);
  if (sugestoesPasta?.geradas) feito.push(`${sugestoesPasta.geradas} sugestão(ões) de pasta`);
  const bkp = ok(etapas.bkp);
  if (bkp?.ligado) feito.push("BKP do SIOE conferido");
  const central = ok(etapas.central);
  if (central?.enviadas) feito.push(`${central.enviadas} abertura(s) de pasta reenviada(s) à Central`);
  if (central?.erros) feito.push(`${central.erros} abertura(s) de pasta ainda sem a Central`);
  const envios = ok(etapas.envios);
  if (envios?.concluidas) feito.push(`${envios.concluidas} envio(s) ao robô concluído(s)`);

  const partes: string[] = [];
  if (feito.length) partes.push(`Rodada do cron: ${juntar(feito)}.`);
  const erros = etapasComErro(etapas);
  if (erros.length) partes.push(`Falhou: ${erros.join("; ")}.`);
  return partes.length ? ` ${partes.join(" ")}` : "";
}
