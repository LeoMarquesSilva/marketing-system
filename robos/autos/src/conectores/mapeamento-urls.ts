/**
 * Modo "mapear", sem navegador (o que dá para testar sozinho). O mapear abre um sistema de tribunal que o robô
 * ainda não conhece (DCP e PJe do TJRJ), espera a pessoa entrar e percorre a consulta do processo, guardando
 * captura, HTML e controles de cada tela em diagnostico/. Ele não baixa nem envia PDF.
 */

/** Parâmetros que identificam sessão, login ou acesso ao documento: não vão para o mapa (JSON) nem para o log. */
const PARAMETROS_SENSIVEIS = [
  "code",
  "state",
  "session_state",
  "session_code",
  "execution",
  "tab_id",
  "client_data",
  "nonce",
  "hash",
  "ticket",
  "key",
  "token",
  "access_token",
  "id_token",
  // PJe: "ca" é a chave de acesso que acompanha idProcesso nos links dos autos.
  "ca",
  "jsessionid",
  "cid",
];

/** O endereço sem os valores sensíveis (fica o nome do parâmetro, com "…" no lugar do valor). */
export function urlSemSegredos(url: string): string {
  const padrao = new RegExp(`([?&#;](?:${PARAMETROS_SENSIVEIS.join("|")})=)[^&#;?]*`, "gi");
  return url.replace(padrao, "$1…");
}

/**
 * Controle que leva ao download dos autos ou de um documento (ícone, botão ou link). O mapear só descreve esses
 * controles; no máximo abre a janela de opções (com o download do navegador bloqueado).
 */
export function ehControleDeDownload(texto: string): boolean {
  return /\b(baixar|download|salvar\s+(c[óo]pia|processo|documentos?)|exportar|gerar\s+pdf|vers[ãa]o\s+(em\s+)?pdf)\b/i.test(texto);
}

/**
 * Botão que conclui o download (gera ou salva o PDF). O mapear nunca clica nestes, nem com o download bloqueado:
 * em alguns sistemas (PJe), o clique pede ao tribunal que monte o PDF em segundo plano.
 */
export function ehAcaoFinalDeDownload(texto: string): boolean {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return /^(download|baixar|gerar( pdf)?|salvar processo completo|salvar documentos selecionados|salvar c[óo]pia.*|confirmar download)$/i.test(limpo);
}

/** Nome de arquivo para a etapa: "dcp", "pesquisa" → "mapa-dcp-03-pesquisa". */
export function nomeDaEtapa(sistema: string, ordem: number, etapa: string): string {
  const limpo = (texto: string) =>
    texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  return `mapa-${limpo(sistema)}-${String(ordem).padStart(2, "0")}-${limpo(etapa).slice(0, 40)}`;
}

/** Os sistemas que o mapear conhece, como se escreve na linha de comando. */
export type SistemaMapeavel = "dcp" | "pje";

export interface PedidoDeMapa {
  sistema: SistemaMapeavel;
  cnj: string;
  /** PJe: "1g" (padrão) ou "2g". O DCP tem um portal só. */
  grau: "1g" | "2g";
}

/**
 * Lê os argumentos de `npm run mapear -- <dcp|pje> <CNJ> [2g]`. Devolve o pedido, ou a explicação do que falta.
 * O número precisa ter 20 dígitos; o tribunal (8.19) é conferido pelo conector.
 */
export function lerPedidoDeMapa(argumentos: string[]): PedidoDeMapa | string {
  const minusculos = argumentos.map((item) => item.toLowerCase());
  const sistema = minusculos.find((item): item is SistemaMapeavel => item === "dcp" || item === "pje");
  const cnj = argumentos.find((item) => item.replace(/\D/g, "").length === 20);
  const uso = "Uso: npm run mapear -- dcp 0000000-00.0000.8.19.0000 (ou: npm run mapear -- pje 0000000-00.0000.8.19.0000 [2g])";
  if (!sistema) return `Diga qual sistema mapear (dcp ou pje). ${uso}`;
  if (!cnj) return `Informe o número do processo, com 20 dígitos. ${uso}`;
  return { sistema, cnj, grau: minusculos.includes("2g") ? "2g" : "1g" };
}
