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

/** Rótulos do cabeçalho (antes do TEXTO:) e do bloco final de partes e advogados. */
const ROTULOS_DO_CABECALHO = new RegExp(`(?<!\\s)(ORG[ÃA]O:|DATA DE DISPONIBILIZA[ÇC][ÃA]O:|TIPO DE ${ROTULO_C}:|MEIO:|TRIBUNAL:|TEXTO:)`, "g");
const ROTULOS_DO_RODAPE = new RegExp(`(?<!\\s)(PARTES(?=\\s*NOME:)|ADVOGADOS(?=\\s*NOME:)|NOME:|POLO:|ID ${ROTULO_C}:|Nº OAB:|UF:)`, "g");

/**
 * Desde 10/11/2026 a Kurier manda os campos do DJEN sem espaço entre eles ("…0058ORGÃO:1ª Câmara
 * CívelDATA DE DISPONIBILIZAÇÃO:09/11/2026TIPO DE COMUNICAÇÃO:…" e "…PARTESNOME:FULANOPOLO:AID
 * COMUNICAÇÃO:779919503NOME:…"). Põe o espaço antes de cada rótulo no cabeçalho e no bloco final de partes
 * e advogados, sem mexer no texto da decisão; no formato antigo, com espaço, nada muda.
 */
function separarRotulos(texto: string): string {
  const inicioTexto = texto.indexOf("TEXTO:");
  if (inicioTexto < 0) return texto;
  const fimTexto = inicioTexto + "TEXTO:".length;
  const cabecalho = texto.slice(0, fimTexto).replace(ROTULOS_DO_CABECALHO, " $1");
  const resto = texto.slice(fimTexto);
  // O bloco que fecha a comunicação: o último PARTES NOME: ou, sem partes, o último ADVOGADOS NOME:.
  const ultimo = (rotulo: RegExp) => [...resto.matchAll(rotulo)].pop()?.index;
  const inicio = ultimo(/PARTES\s*NOME:/g) ?? ultimo(/ADVOGADOS\s*NOME:/g);
  if (inicio === undefined) return cabecalho + resto;
  return cabecalho + resto.slice(0, inicio) + resto.slice(inicio).replace(ROTULOS_DO_RODAPE, " $1");
}

/** "09/11/2026", "17-11-2026" (formato da Kurier desde 10/11/2026) ou "2026-11-06" → "2026-11-06". */
function dataIso(valor: string | null): string | null {
  if (!valor) return null;
  const br = valor.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : valor;
}

/**
 * Lê o cabeçalho estruturado de uma comunicação do DJEN. O mesmo despacho
 * chega uma vez por parte intimada: muda só a linha "Intimado(s) / Citado(s)"
 * e o ID COMUNICAÇÃO. `corpo` exclui exatamente esses trechos, para que as
 * cópias de um mesmo despacho tenham o mesmo corpo.
 */
export function lerComunicacaoDjen(teor: string): DjenDados | null {
  if (!ehComunicacaoDjen(teor)) return null;
  const texto = separarRotulos(teor.replace(/\s+/g, " ").trim()).replace(/\s+/g, " ").trim();

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
    dataDisponibilizacao: dataIso(primeiro(texto, /DATA DE DISPONIBILIZA[ÇC][ÃA]O:\s*(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/)),
    tipoComunicacao: primeiro(texto, new RegExp(`TIPO DE ${ROTULO_C}:\\s*(.*?)\\s+MEIO:`)),
    tribunal: primeiro(texto, /TRIBUNAL:\s*(\S+)/),
    intimados,
    partes,
    advogados,
    corpo,
  };
}
