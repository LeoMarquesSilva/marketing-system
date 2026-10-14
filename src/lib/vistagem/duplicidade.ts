import { createHash } from "node:crypto";
import type { DjenDados } from "./types";

export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Texto usado para comparar cópias de uma mesma publicação: troca o nome das
 * partes por "<parte>" (alguns tribunais repetem o destinatário no meio do
 * texto) e ignora a lista final "- ADV: ...", que muda de ordem entre cópias.
 */
export function textoComparavel(texto: string, nomesDasPartes: string[]): string {
  const semNomes = [...new Set(nomesDasPartes)]
    .filter((nome) => nome.length >= 3)
    .sort((a, b) => b.length - a.length)
    .reduce((atual, nome) => atual.split(nome).join("<parte>"), texto.replace(/\s+/g, " "));
  return normalizarTexto(semNomes.replace(/\s-\s*ADV:.*$/i, ""));
}

/**
 * Identifica o despacho/decisão por trás de cada linha. Duas linhas com a
 * mesma chave são a mesma publicação enviada mais de uma vez (uma por parte
 * intimada). Sem CNJ não há como afirmar duplicidade: devolve null.
 */
export function chaveDecisao(input: {
  cnjDigitos: string | null;
  dataDivulgacao: string | null;
  teor: string;
  djen: DjenDados | null;
  nomesDasPartes: string[];
}): string | null {
  if (!input.cnjDigitos) return null;
  const partes = input.djen
    ? [
        input.cnjDigitos,
        normalizarTexto(input.djen.orgao ?? ""),
        input.djen.dataDisponibilizacao ?? input.dataDivulgacao ?? "",
        textoComparavel(input.djen.corpo, input.nomesDasPartes),
      ]
    : [input.cnjDigitos, input.dataDivulgacao ?? "", textoComparavel(input.teor, input.nomesDasPartes)];
  return createHash("sha256").update(partes.join("|")).digest("hex");
}

/**
 * Para cada item, devolve o índice da primeira ocorrência da mesma chave
 * (a publicação principal) ou -1 quando o item é ele mesmo o principal.
 */
export function indicesDePrincipal(chaves: (string | null)[]): number[] {
  const primeiraOcorrencia = new Map<string, number>();
  return chaves.map((chave, indice) => {
    if (!chave) return -1;
    const principal = primeiraOcorrencia.get(chave);
    if (principal === undefined) {
      primeiraOcorrencia.set(chave, indice);
      return -1;
    }
    return principal;
  });
}
