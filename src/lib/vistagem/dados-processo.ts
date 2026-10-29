/**
 * Dados do processo para o cabeçalho do jurídico: a classe no tribunal (tirada da linha do DJEN que junta o
 * tipo do ato e a classe), o valor da causa quando o diário traz e as partes por polo. A fase não é deduzida:
 * vem só da pasta no VIOS.
 */

function plano(texto: string | null | undefined): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Atos que o DJEN põe em caixa alta antes da classe ("DESPACHO/DECISÃO EXECUÇÃO DE TÍTULO…"). */
const RE_ATO =
  /^(?:DESPACHO\s*\/\s*DECIS[ÃA]O|DECIS[ÃA]O MONOCR[ÁA]TICA|EMENTA\s*\/\s*AC[ÓO]RD[ÃA]O|ATA DE DISTRIBUI[ÇC][ÃA]O|PAUTA DE JULGAMENTOS?|EDITAL DE (?:CITA[ÇC][ÃA]O|INTIMA[ÇC][ÃA]O)|EDITAL|VISTA|DESPACHO|DECIS[ÃA]O|SENTEN[ÇC]A|AC[ÓO]RD[ÃA]O|INTIMA[ÇC][ÃA]O|NOTIFICA[ÇC][ÃA]O|CERTID[ÃA]O|ATO ORDINAT[ÓO]RIO|CONCLUS[ÃA]O|DISTRIBUI[ÇC][ÃA]O)(?:\s+|$)/;

const MINUSCULAS = new Set(["a", "à", "o", "e", "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "por", "para", "com"]);

/** "AGRAVO DE INSTRUMENTO EM RECURSO DE REVISTA" → "Agravo de Instrumento em Recurso de Revista". */
function emTitulo(texto: string): string {
  return texto
    .toLowerCase()
    .split(" ")
    .map((palavra, indice) => (indice > 0 && MINUSCULAS.has(palavra) ? palavra : palavra.charAt(0).toUpperCase() + palavra.slice(1)))
    .join(" ");
}

/**
 * Classe do processo na linha do DJEN: a classe vem em caixa alta no fim, depois do tipo do ato
 * ("Despacho AGRAVO DE INSTRUMENTO", "DESPACHO/DECISÃO EXECUÇÃO DE TÍTULO EXTRAJUDICIAL").
 */
export function classeDoProcesso(linhaDjen: string | null): string | null {
  const palavras = (linhaDjen ?? "").trim().split(/\s+/).filter(Boolean);
  let inicio = palavras.length;
  while (inicio > 0 && !/\p{Ll}/u.test(palavras[inicio - 1])) inicio -= 1;
  let classe = palavras.slice(inicio).join(" ");
  for (let i = 0; i < 2 && RE_ATO.test(classe); i += 1) classe = classe.replace(RE_ATO, "");
  classe = classe.replace(/^[\s\-–/]+|[\s\-–/]+$/g, "");
  return classe.replace(/[^\p{L}]/gu, "").length >= 4 ? emTitulo(classe) : null;
}

const VALOR = "R\\$\\s*\\d{1,3}(?:\\.?\\d{3})*(?:,\\d{2})?";
const RE_VALOR_DA_CAUSA = [
  new RegExp(`valor\\s+(?:da|[àa])\\s+(?:causa|a[çc][ãa]o)\\s*(?::|para|em|de|[ée] de|fixado em)?\\s*(${VALOR})`, "i"),
  new RegExp(`(?:atribu\\S*|d[áa]-se)\\s+[àa]\\s+causa\\s+o\\s+valor\\s+de\\s+(${VALOR})`, "i"),
];

/** Valor da causa citado na publicação ("Valor da Causa: R$174.310,71" no cabeçalho do TJPR), como "R$ 174.310,71". */
export function valorDaCausa(teor: string): string | null {
  const texto = teor.replace(/\s+/g, " ");
  for (const regex of RE_VALOR_DA_CAUSA) {
    const achado = texto.match(regex);
    if (achado) return achado[1].replace(/R\$\s*/, "R$ ");
  }
  return null;
}

/** Nome de parte sem acento, pontuação nem letra dobrada: o DJEN escreve "PERILO KUHL" onde o VIOS tem "Perillo Kühl". */
function chaveParte(nome: string): string {
  return plano(nome.replace(/\s*\([^)]*\)\s*$/, "")).replace(/[^a-z0-9]/g, "").replace(/(.)\1+/g, "$1");
}

export interface ParteDoPolo {
  nome: string;
  /** É o cliente da pasta. */
  cliente: boolean;
}

/**
 * Partes do DJEN por polo (A = ativo, P = passivo), com o cliente da pasta marcado e na frente; os outros
 * polos (terceiros) ficam de fora do cabeçalho.
 */
export function partesPorPolo(partes: { nome: string; polo: string }[], cliente: string | null = null): { ativo: ParteDoPolo[]; passivo: ParteDoPolo[] } {
  const chaveCliente = cliente ? chaveParte(cliente) : "";
  const doPolo = (polo: string) =>
    partes
      .filter((parte) => parte.polo === polo)
      // O STJ numera as partes ("1. FULANO (AGRAVANTE)"): o número sai, o papel entre parênteses fica.
      .map((parte) => parte.nome.replace(/^\d{1,2}\.\s+/, ""))
      .map((nome) => ({ nome, cliente: Boolean(chaveCliente) && chaveParte(nome) === chaveCliente }))
      .sort((a, b) => Number(b.cliente) - Number(a.cliente));
  return { ativo: doPolo("A"), passivo: doPolo("P") };
}
