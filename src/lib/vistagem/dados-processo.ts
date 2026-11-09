/**
 * Dados do processo para o cabeçalho do jurídico: a classe no tribunal (tirada da linha do DJEN que junta o
 * tipo do ato e a classe), o valor da causa quando o diário traz e as partes por polo. A fase não é deduzida:
 * vem só da pasta no VIOS.
 */

import type { MateriaVios, SintesePedida } from "./types";

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

/** Tamanho do trecho que se acrescenta à síntese de uma vez ("Atualizar cadastro no VIOS"). */
export const LIMITE_TRECHO_SINTESE = 4000;

/** Pedido que vale para o cadastro: na fila ou gravado (o que deu erro ou só foi simulado, não). */
function pedidoValido(pedida: Pick<SintesePedida, "status" | "simulado">): boolean {
  return pedida.status !== "erro" && !(pedida.simulado && pedida.status === "concluido");
}

/**
 * Exige a Matéria ao atualizar o cadastro: o VIOS não grava o cadastro do processo sem ela. A base do SIOE só muda
 * na carga seguinte, então um pedido com Matéria que está na fila ou foi gravado já resolve.
 */
export function precisaDeMateria(materiaVazia: boolean, pedidas: Pick<SintesePedida, "materias" | "status" | "simulado">[]): boolean {
  if (!materiaVazia) return false;
  return !pedidas.some((pedida) => pedida.materias.length > 0 && pedidoValido(pedida));
}

/** Exige o Sistema do Tribunal ao atualizar o cadastro, pela mesma regra da Matéria (o VIOS também o exige). */
export function precisaDeSistema(sistemaVazio: boolean, pedidas: Pick<SintesePedida, "sistemaTribunal" | "status" | "simulado">[]): boolean {
  if (!sistemaVazio) return false;
  return !pedidas.some((pedida) => Boolean(pedida.sistemaTribunal) && pedidoValido(pedida));
}

/** Confere o Sistema do Tribunal escolhido na lista do VIOS: o da lista, null sem escolha, ou `fora` se não estiver nela. */
export function sistemaDaLista(id: unknown, lista: MateriaVios[]): { sistema: MateriaVios | null; fora: boolean } {
  const valor = typeof id === "string" ? id.trim() : "";
  if (!valor) return { sistema: null, fora: false };
  const sistema = lista.find((item) => item.id === valor) ?? null;
  return { sistema, fora: !sistema };
}

/** Confere as matérias escolhidas na lista do VIOS. `fora` são os ids que a lista não tem. */
export function materiasDaLista(ids: unknown, lista: MateriaVios[]): { materias: MateriaVios[]; fora: string[] } {
  const pedidos = Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))] : [];
  const porId = new Map(lista.map((materia) => [materia.id, materia]));
  return {
    materias: pedidos.flatMap((id) => {
      const materia = porId.get(id);
      return materia ? [materia] : [];
    }),
    fora: pedidos.filter((id) => !porId.has(id)),
  };
}

/** Entidades HTML que o VIOS deixa na síntese (o CSV troca o ";" final por ":", ex.: "&ndash:"). */
const ENTIDADES: Record<string, string> = {
  ndash: "–",
  mdash: "—",
  bull: "•",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  lowast: "∗",
  euro: "€",
  nbsp: " ",
  amp: "&",
  quot: '"',
  lt: "<",
  gt: ">",
  hellip: "…",
  ordm: "º",
  ordf: "ª",
  sect: "§",
  deg: "°",
};

/**
 * Síntese do processo do VIOS em parágrafos. O CSV do VIOS chega sem as quebras de linha ("despacho08/11/2021"):
 * quebra antes de uma data colada no texto e de um "- " colado ("Transportes.- Julgada"). Também traduz as
 * entidades HTML.
 */
export function paragrafosDaSintese(sintese: string | null): string[] {
  if (!sintese) return [];
  return sintese
    .replace(/&(#\d{2,6}|[a-z]{2,8})[;:]/gi, (entidade, nome: string) => {
      if (nome.startsWith("#")) {
        const codigo = Number(nome.slice(1));
        return codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : entidade;
      }
      return ENTIDADES[nome.toLowerCase()] ?? entidade;
    })
    .replace(/(?<=[^\s\d/])(?=\d{2}\/\d{2}(?:\/\d{2,4})?(?!\d))/g, "\n")
    .replace(/(?<=\S)-\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/g, "\n- ")
    .split(/\r?\n/)
    .map((linha) => linha.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
