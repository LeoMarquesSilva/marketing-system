import type { DjenAdvogado, DjenDados, DjenParte } from "./types";

const ROTULO_C = "COMUNICA[ÇC][ÃA]O";

function primeiro(texto: string, regex: RegExp): string | null {
  const achado = texto.match(regex);
  return achado ? achado[1].trim() : null;
}

/** Comunicações do DJEN vêm com cabeçalho fixo (PROCESSO, ORGÃO, TIPO DE COMUNICAÇÃO, TEXTO...). */
export function ehComunicacaoDjen(teor: string): boolean {
  return new RegExp(`PROCESSO:[\\s\\S]*TIPO DE ${ROTULO_C}:[\\s\\S]*TEXTO:`).test(teor);
}

/**
 * Lê o cabeçalho estruturado de uma comunicação do DJEN. O mesmo despacho
 * chega uma vez por parte intimada: muda só a linha "Intimado(s) / Citado(s)"
 * e o ID COMUNICAÇÃO. `corpo` exclui exatamente esses trechos, para que as
 * cópias de um mesmo despacho tenham o mesmo corpo.
 */
export function lerComunicacaoDjen(teor: string): DjenDados | null {
  if (!ehComunicacaoDjen(teor)) return null;
  const texto = teor.replace(/\s+/g, " ").trim();

  const inicioTexto = texto.indexOf("TEXTO:");
  const inicioPartes = texto.lastIndexOf("PARTES NOME:");
  const inicioAdvogados = texto.lastIndexOf("ADVOGADOS NOME:");
  const fimCorpo = [inicioPartes, inicioAdvogados].filter((i) => i > inicioTexto).sort((a, b) => a - b)[0] ?? texto.length;

  const corpoComIntimado = texto.slice(inicioTexto + "TEXTO:".length, fimCorpo).trim();
  const intimadoMatch = corpoComIntimado.match(/Intimado\(s\)\s*\/\s*Citado\(s\)\s*-?\s*(.*)$/i);
  const intimados = intimadoMatch
    ? intimadoMatch[1].split(/\s+-\s+/).map((nome) => nome.trim()).filter(Boolean)
    : [];
  const blocoPartes = inicioPartes > inicioTexto
    ? texto.slice(inicioPartes, inicioAdvogados > inicioPartes ? inicioAdvogados : texto.length)
    : "";
  const partes: DjenParte[] = [...blocoPartes.matchAll(new RegExp(`NOME:\\s*(.*?)\\s+POLO:\\s*(\\S+)\\s+ID ${ROTULO_C}:\\s*(\\d+)`, "g"))]
    .map((m) => ({ nome: m[1].trim(), polo: m[2], idComunicacao: Number(m[3]) }));

  const corpo = intimadoMatch ? corpoComIntimado.slice(0, intimadoMatch.index).trim() : corpoComIntimado;

  const blocoAdvogados = inicioAdvogados > inicioTexto ? texto.slice(inicioAdvogados) : "";
  const advogados: DjenAdvogado[] = [...blocoAdvogados.matchAll(/NOME:\s*(.*?)\s+Nº OAB:\s*(\S+)\s+UF:\s*([A-Z]{2})/g)]
    .map((m) => ({ nome: m[1].trim(), oab: m[2], uf: m[3] }));

  const id = primeiro(texto, new RegExp(`ID ${ROTULO_C}:\\s*(\\d+)`));

  return {
    idComunicacao: id ? Number(id) : null,
    orgao: primeiro(texto, /ORG[ÃA]O:\s*(.*?)\s+DATA DE DISPONIBILIZA/),
    dataDisponibilizacao: primeiro(texto, /DATA DE DISPONIBILIZA[ÇC][ÃA]O:\s*(\d{4}-\d{2}-\d{2})/),
    tipoComunicacao: primeiro(texto, new RegExp(`TIPO DE ${ROTULO_C}:\\s*(.*?)\\s+MEIO:`)),
    tribunal: primeiro(texto, /TRIBUNAL:\s*(\S+)/),
    intimados,
    partes,
    advogados,
    corpo,
  };
}
