import { destacar, type TipoDestaque } from "@/lib/vistagem/leitura";

/**
 * Leitura da síntese do processo ("Observações (síntese do processo)") para a tela. O texto é gravado e
 * volta para o VIOS como texto simples; aqui ele só é interpretado para exibir: os blocos que a IA escreve
 * (Resumo, Andamento, Situação atual, Pontos de atenção), as linhas do Andamento com data e página, o
 * cabeçalho "dd/mm/aaaa (IA, leitura dos autos):" que separa a parte da IA do texto da equipe, e valores,
 * datas e prazos no meio das frases. Tudo o que não casa com nada fica como texto livre, com as quebras.
 */

export type RotuloDaSintese = "Resumo" | "Andamento" | "Situação atual" | "Pontos de atenção";

export interface MarcoDoAndamento {
  /** "dd/mm/aaaa" (ou "mm/aaaa") do início da linha; null quando a linha não começa por data. */
  data: string | null;
  /** O fato, sem a data e sem as páginas do fim. */
  texto: string;
  /** Páginas citadas no fim da linha: "(p. 91, p. 97 e p. 98)" → ["91", "97", "98"]. */
  paginas: string[];
}

export type ParteDaSintese =
  /** Cabeçalho da parte escrita pela IA: "17/11/2026 (IA, leitura dos autos):". */
  | { tipo: "ia"; data: string }
  /** Resumo, Situação atual ou texto livre (rótulo null: o texto da equipe ou o que vem sem rótulo). */
  | { tipo: "texto"; rotulo: "Resumo" | "Situação atual" | null; paragrafos: string[] }
  | { tipo: "andamento"; rotulo: "Andamento"; marcos: MarcoDoAndamento[] }
  | { tipo: "atencao"; rotulo: "Pontos de atenção"; itens: string[] };

const ROTULOS: { rotulo: RotuloDaSintese; regex: RegExp }[] = [
  { rotulo: "Resumo", regex: /^resumo$/i },
  { rotulo: "Andamento", regex: /^andamento$/i },
  { rotulo: "Situação atual", regex: /^situa[çc][ãa]o\s+atual$/i },
  { rotulo: "Pontos de atenção", regex: /^pontos?\s+de\s+aten[çc][ãa]o$/i },
];

/** "Resumo", "Resumo:" ou "Resumo: texto na mesma linha". */
function rotuloDaLinha(linha: string): { rotulo: RotuloDaSintese; resto: string } | null {
  const achado = /^([\p{L}\s]{6,24}?)\s*:?\s*$/u.exec(linha) ?? /^([\p{L}\s]{6,24}?)\s*:\s+(.+)$/u.exec(linha);
  if (!achado) return null;
  const nome = achado[1].trim();
  const item = ROTULOS.find(({ regex }) => regex.test(nome));
  return item ? { rotulo: item.rotulo, resto: (achado[2] ?? "").trim() } : null;
}

const RE_CABECALHO_IA = /^(\d{1,2}\/\d{1,2}\/\d{4})\s*\(\s*IA\b[^)]*\)\s*:?$/i;
const RE_MARCADOR = /^[-•–—*]\s+/;
const RE_DATA_INICIAL = /^(\d{1,2}\/(?:\d{1,2}\/)?\d{4})(?:\s*[:\-–—]\s*|\s+)(.*)$/;

/** Uma referência de página: "p. 12", "pp. 3-5", "fls. 40". */
const REF = String.raw`(?:pp?|fls?)\.?\s*\d+(?:\s*[-–]\s*\d+)?`;
/** A lista de páginas entre parênteses: "(p. 63 e p. 66)", "(p. 91, p. 97 e p. 98)", "(pp. 3-5)". */
const LISTA = String.raw`\(\s*${REF}(?:\s*(?:,|\be\b)\s*(?:${REF}|\d+(?:\s*[-–]\s*\d+)?))*\s*\)`;
const RE_PAGINAS_NO_FIM = new RegExp(String.raw`\s*${LISTA}\s*[.;]?\s*$`, "i");
const RE_PAGINAS = new RegExp(LISTA, "gi");

/** "(p. 91, p. 97 e p. 98)" → ["91", "97", "98"]; "(pp. 3-5)" → ["3-5"]. */
export function paginasDaReferencia(referencia: string): string[] {
  return [...referencia.matchAll(/\d+(?:\s*[-–]\s*\d+)?/g)].map((achado) => achado[0].replace(/\s+/g, "").replace("–", "-"));
}

/** Uma linha do Andamento: data no começo, fato e páginas no fim. */
export function lerMarco(linhaOriginal: string): MarcoDoAndamento {
  let linha = linhaOriginal.trim().replace(RE_MARCADOR, "");
  let data: string | null = null;
  const comData = RE_DATA_INICIAL.exec(linha);
  if (comData && comData[2].trim()) {
    data = comData[1];
    linha = comData[2].trim();
  }
  let paginas: string[] = [];
  const noFim = RE_PAGINAS_NO_FIM.exec(linha);
  // Só tira as páginas se sobra fato: "(p. 3)" sozinho fica como texto.
  if (noFim && noFim.index > 0) {
    paginas = paginasDaReferencia(noFim[0]);
    linha = linha.slice(0, noFim.index).trim();
  }
  return { data, texto: linha, paginas };
}

/** Linhas → parágrafos: linhas seguidas ficam juntas (com a quebra), linha em branco separa. */
function paragrafosDe(linhas: string[]): string[] {
  const paragrafos: string[] = [];
  let atual: string[] = [];
  for (const linha of linhas) {
    if (linha.trim()) {
      atual.push(linha);
    } else if (atual.length) {
      paragrafos.push(atual.join("\n"));
      atual = [];
    }
  }
  if (atual.length) paragrafos.push(atual.join("\n"));
  return paragrafos;
}

/** Separa a síntese em partes, na ordem do texto. Nenhuma linha com conteúdo se perde. */
export function lerSintese(texto: string): ParteDaSintese[] {
  const partes: ParteDaSintese[] = [];
  let rotulo: RotuloDaSintese | null = null;
  let linhas: string[] = [];
  let aberto = false;

  const fechar = () => {
    if (aberto || linhas.some((linha) => linha.trim())) {
      if (rotulo === "Andamento") {
        partes.push({ tipo: "andamento", rotulo, marcos: linhas.filter((linha) => linha.trim()).map(lerMarco) });
      } else if (rotulo === "Pontos de atenção") {
        partes.push({ tipo: "atencao", rotulo, itens: linhas.filter((linha) => linha.trim()).map((linha) => linha.trim().replace(RE_MARCADOR, "")) });
      } else {
        partes.push({ tipo: "texto", rotulo, paragrafos: paragrafosDe(linhas) });
      }
    }
    linhas = [];
    aberto = false;
  };

  for (const linhaCrua of texto.replace(/\r\n?/g, "\n").split("\n")) {
    const linha = linhaCrua.trimEnd();
    const limpa = linha.trim();
    const ia = RE_CABECALHO_IA.exec(limpa);
    if (ia) {
      fechar();
      partes.push({ tipo: "ia", data: ia[1] });
      rotulo = null;
      continue;
    }
    const novo = rotuloDaLinha(limpa);
    if (novo) {
      fechar();
      rotulo = novo.rotulo;
      aberto = true;
      if (novo.resto) linhas.push(novo.resto);
      continue;
    }
    linhas.push(linha);
  }
  fechar();
  return partes;
}

/**
 * O último andamento que a síntese da IA descreve: o bloco "Situação atual" (o último, se houver mais de um)
 * e a data do último marco datado do Andamento (AAAA-MM-DD). Nulo sem "Situação atual".
 */
export function ultimoAndamentoDaSintese(texto: string): { texto: string; data: string | null } | null {
  const partes = lerSintese(texto);
  const situacao = [...partes].reverse().find((parte): parte is Extract<ParteDaSintese, { tipo: "texto" }> => parte.tipo === "texto" && parte.rotulo === "Situação atual");
  const corpo = situacao?.paragrafos.join("\n").trim();
  if (!corpo) return null;
  let data: string | null = null;
  for (const parte of partes) {
    if (parte.tipo !== "andamento") continue;
    for (const marco of parte.marcos) {
      const completa = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(marco.data ?? "");
      if (!completa) continue;
      const iso = `${completa[3]}-${completa[2].padStart(2, "0")}-${completa[1].padStart(2, "0")}`;
      if (!data || iso > data) data = iso;
    }
  }
  return { texto: corpo, data };
}

// ---------------------------------------------------------------------------
// Destaques no meio da frase
// ---------------------------------------------------------------------------

/** O marca-texto da Vistagem (sem "ordem": na síntese, "manifestar" e "intime-se" são narrativa) e as páginas. */
export type TipoTrechoDaSintese = Exclude<TipoDestaque, "ordem"> | "pagina";

export interface TrechoDaSintese {
  texto: string;
  tipo: TipoTrechoDaSintese | null;
  inicio: number;
}

/** Trechos de uma frase: páginas citadas "(p. N)" e os destaques da Vistagem (valor, data, prazo, ato, pena). */
export function trechosDaSintese(texto: string): TrechoDaSintese[] {
  const trechos: TrechoDaSintese[] = [];
  const empurrar = (trecho: TrechoDaSintese) => {
    if (!trecho.texto) return;
    const anterior = trechos[trechos.length - 1];
    if (anterior && anterior.tipo === null && trecho.tipo === null) anterior.texto += trecho.texto;
    else trechos.push(trecho);
  };
  const comum = (pedaco: string, base: number) => {
    for (const trecho of destacar(pedaco)) {
      empurrar({ texto: trecho.texto, tipo: trecho.tipo === "ordem" ? null : trecho.tipo, inicio: base + trecho.inicio });
    }
  };
  let posicao = 0;
  for (const achado of texto.matchAll(RE_PAGINAS)) {
    const inicio = achado.index ?? 0;
    comum(texto.slice(posicao, inicio), posicao);
    empurrar({ texto: achado[0], tipo: "pagina", inicio });
    posicao = inicio + achado[0].length;
  }
  comum(texto.slice(posicao), posicao);
  return trechos;
}

/** Rótulo curto das páginas: ["63"] → "p. 63"; ["3-5"] → "pp. 3-5"; ["91", "97", "98"] → "pp. 91, 97 e 98". */
export function rotuloDasPaginas(paginas: string[]): string {
  if (!paginas.length) return "";
  if (paginas.length === 1) return `${paginas[0].includes("-") ? "pp." : "p."} ${paginas[0]}`;
  return `pp. ${paginas.slice(0, -1).join(", ")} e ${paginas[paginas.length - 1]}`;
}
