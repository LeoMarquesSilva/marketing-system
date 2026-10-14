import type { ProcessoNormalizado } from "./types";

const CNJ_MASCARADO = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;

function mascarar(digitos: string): string {
  return `${digitos.slice(0, 7)}-${digitos.slice(7, 9)}.${digitos.slice(9, 13)}.${digitos.slice(13, 14)}.${digitos.slice(14, 16)}.${digitos.slice(16, 20)}`;
}

function aPartirDe(texto: string): ProcessoNormalizado | null {
  const digitos = texto.replace(/\D/g, "");
  if (digitos.length < 20) return null;
  const sufixo = digitos.slice(20);
  return { cnj: mascarar(digitos.slice(0, 20)), digitos: digitos.slice(0, 20), sufixo: sufixo || null };
}

/**
 * Normaliza o número do processo vindo da Kurier. Aceita CNJ com ou sem
 * máscara e com sufixo de incidente ("/5000"). Quando a Kurier marca
 * "Número fora do Padrão", tenta achar o CNJ no começo do teor.
 */
export function normalizarProcesso(bruto: string, teor = ""): ProcessoNormalizado {
  const direto = aPartirDe(bruto.trim());
  if (direto) return direto;

  const doCabecalho = teor.match(/PROCESSO:\s*([\d.\-/]{20,})/);
  if (doCabecalho) {
    const encontrado = aPartirDe(doCabecalho[1]);
    if (encontrado) return encontrado;
  }
  const mascarado = teor.slice(0, 2000).match(CNJ_MASCARADO);
  if (mascarado) return aPartirDe(mascarado[0]) as ProcessoNormalizado;

  return { cnj: null, digitos: null, sufixo: null };
}
