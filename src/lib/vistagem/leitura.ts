import { lerComunicacaoDjen } from "./djen";
import { citaAdvogadoDoEscritorio } from "./triagem";

/**
 * Leitura da publicação para o jurídico: o teor da Kurier chega num bloco só (cabeçalho do DJEN,
 * despacho, partes e advogados colados). Aqui ele vira cabeçalho, parágrafos e listas, e os
 * trechos que pedem ação (prazo, "sob pena de", datas, valores, audiência) são marcados.
 */

export type TipoParagrafo = "titulo" | "secundario" | "texto";

export interface ParagrafoLeitura {
  texto: string;
  /** titulo: DESPACHO, DECISÃO…; secundario: cabeçalho do tribunal e qualificação das partes (em caixa alta). */
  tipo: TipoParagrafo;
}

export interface LeituraPublicacao {
  djen: boolean;
  orgao: string | null;
  tipoComunicacao: string | null;
  meio: string | null;
  /** Classe do processo e tipo do ato, como o DJEN informa (ex.: "DESPACHO/DECISÃO EXECUÇÃO DE TÍTULO EXTRAJUDICIAL"). */
  classe: string | null;
  intimados: string[];
  paragrafos: ParagrafoLeitura[];
  partes: { nome: string; polo: string }[];
  advogados: { nome: string; oab: string; uf: string; doEscritorio: boolean }[];
}

/** O DJEN grava letras acentuadas em minúscula no meio de palavras em caixa alta ("AçãO", "TíTULO"). */
function corrigirCaixa(texto: string): string {
  return texto.replace(/\S+/g, (palavra) =>
    /^[A-ZÀ-Ý]/.test(palavra) && /[A-ZÀ-Ý]$/.test(palavra) && /[à-ÿ]/.test(palavra) ? palavra.toUpperCase() : palavra
  );
}

function trecho(texto: string, regex: RegExp): string | null {
  const achado = texto.match(regex);
  const valor = achado?.[1]?.trim();
  return valor ? valor : null;
}

const TITULOS = [
  "DESPACHO/DECISÃO",
  "DESPACHO",
  "DECISÃO",
  "SENTENÇA",
  "CONCLUSÃO",
  "INTIMAÇÃO",
  "CERTIDÃO",
  "ATO ORDINATÓRIO",
  "ACÓRDÃO",
  "EMENTA",
  "RELATÓRIO",
  "FUNDAMENTAÇÃO",
  "DISPOSITIVO",
];

// Título só quando o texto seguinte começa em caixa normal ("DESPACHO Vistos."), para não partir
// frases em caixa alta como "SERVE A PRESENTE DECISÃO COMO OFÍCIO".
const RE_TITULO = new RegExp(`(?<=^|\\s)(${TITULOS.map((t) => t.replace("/", "\\/")).join("|")})(?=\\s+[A-ZÀ-Ý][a-zà-ÿ])`, "g");

const ROTULOS_PARTE = [
  "AUTOR",
  "AUTORA",
  "RÉU",
  "RÉ",
  "RECLAMANTE",
  "RECLAMADO",
  "RECLAMADA",
  "EXEQUENTE",
  "EXECUTADO",
  "EXECUTADA",
  "AGRAVANTES?",
  "AGRAVADOS?",
  "AGRAVADAS?",
  "REQUERENTE",
  "REQUERIDO",
  "REQUERIDA",
  "IMPETRANTE",
  "IMPETRADO",
  "APELANTE",
  "APELADO",
  "APELADA",
  "RECORRENTE",
  "RECORRIDO",
  "RECORRIDA",
  "INTERESSADO",
  "INTERESSADA",
  "ADVOGADO\\(A\\)",
  "ADVOGADO",
  "ADV",
  "Autor",
  "Autora",
  "Réu",
  "Ré",
  "Requerente",
  "Requerido",
  "Requerida",
  "Exequente",
  "Executado",
  "Executada",
];
const RE_ROTULO_PARTE = new RegExp(`\\s+(?=(?:${ROTULOS_PARTE.join("|")})\\s*:)`, "g");

const INICIOS_DE_PARAGRAFO = [
  "Vistos",
  "Intime-se",
  "Intimem-se",
  "Intima-se",
  "Int\\.",
  "Cumpra-se",
  "Publique-se",
  "Diante",
  "Ante o exposto",
  "Isto posto",
  "Isso posto",
  "Posto isso",
  "Assim,",
  "Fica V",
  "Ficam",
  "Nos termos",
  "Defiro",
  "Indefiro",
  "Dê-se",
  "Após",
  "No mais",
  "Decorrido",
  "Com a juntada",
  "Oportunamente",
  "Determino",
  "Homologo",
  "Julgo",
  "JULGO",
  "Considerando",
  "Tendo em vista",
];
const RE_INICIO = new RegExp(`(?<=[.;:)])\\s+(?=(?:${INICIOS_DE_PARAGRAFO.join("|")}))`, "g");

/** Linha de local e data da assinatura: "SÃO PAULO/SP, 27 de outubro de 2026" ou "SAO PAULO/SP, data abaixo". */
const RE_LOCAL_DATA =
  /(?<=[.;)])\s+(?=[A-ZÀ-Ý][A-Za-zÀ-ÿ' -]{2,40}(?:\/[A-Z]{2})?,\s*(?:\d{1,2}º?\s+de\s+[a-zç]+\s+de\s+\d{4}|data\s+abaixo))/g;

/** Itens numerados: "1. Defiro…", "II - Intime-se…". */
const RE_ITEM = /(?<=[.;:])\s+(?=(?:\d{1,2}[.)]|[IVX]{1,4}\s*[-–.)])\s+[A-ZÀ-Ýa-zà-ÿ])/g;

const QUEBRA = "\u0000";

const ABREVIACOES = new Set(["art", "arts", "fls", "fl", "exmo", "exma", "dra", "sra", "sr", "dr", "proc", "num", "inc", "int", "id"]);

/** Parágrafo muito longo vira blocos de poucas frases (sem partir "V. Sa.", "art. 5º"). */
function partirLongo(texto: string, limite = 700): string[] {
  if (texto.length <= limite) return [texto];
  const frases: string[] = [];
  let inicio = 0;
  for (const achado of texto.matchAll(/[.!?](?=\s+[A-ZÀ-Ý])/g)) {
    const fim = (achado.index ?? 0) + 1;
    if (achado[0] === ".") {
      const palavra = (texto.slice(inicio, fim).match(/(\S+)\.$/)?.[1] ?? "").toLowerCase().replace(/[^\p{L}]/gu, "");
      if (palavra.length < 3 || ABREVIACOES.has(palavra)) continue;
    }
    frases.push(texto.slice(inicio, fim).trim());
    inicio = fim;
  }
  frases.push(texto.slice(inicio).trim());
  const blocos: string[] = [];
  let atual = "";
  for (const frase of frases.filter(Boolean)) {
    if (atual && atual.length + frase.length > limite * 0.6) {
      blocos.push(atual);
      atual = frase;
    } else {
      atual = atual ? `${atual} ${frase}` : frase;
    }
  }
  if (atual) blocos.push(atual);
  return blocos;
}

function emCaixaAlta(texto: string): boolean {
  const letras = texto.replace(/[^\p{L}]/gu, "");
  if (letras.length < 20) return false;
  const maiusculas = letras.replace(/[^\p{Lu}]/gu, "").length;
  return maiusculas / letras.length >= 0.7;
}

/** Quebra o corpo da publicação em parágrafos: títulos, qualificação das partes e marcos do despacho. */
export function paragrafosDoCorpo(corpo: string): ParagrafoLeitura[] {
  const texto = corpo.replace(/\s+/g, " ").trim();
  if (!texto) return [];
  const marcado = texto
    .replace(RE_TITULO, `${QUEBRA}$1${QUEBRA}`)
    .replace(RE_ROTULO_PARTE, QUEBRA)
    .replace(RE_INICIO, QUEBRA)
    .replace(RE_LOCAL_DATA, QUEBRA)
    .replace(RE_ITEM, QUEBRA);
  return marcado
    .split(QUEBRA)
    .map((parte) => parte.trim().replace(/\s+-$/, "").trim())
    .filter(Boolean)
    .flatMap((parte): ParagrafoLeitura[] => {
      if (TITULOS.includes(parte)) return [{ texto: parte, tipo: "titulo" }];
      if (emCaixaAlta(parte)) return [{ texto: parte, tipo: "secundario" }];
      return partirLongo(parte).map((bloco) => ({ texto: bloco, tipo: "texto" }));
    });
}

const ENTIDADES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  sect: "§",
  ordm: "º",
  ordf: "ª",
  deg: "°",
  ndash: "–",
  mdash: "—",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
};

/** Alguns tribunais mandam o texto com entidades HTML ("art. 525, &sect; 1º"). */
export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#\d{2,5}|[a-z]{2,6});/gi, (inteira, nome: string) => {
    if (nome.startsWith("#")) return String.fromCharCode(Number(nome.slice(1)));
    return ENTIDADES[nome.toLowerCase()] ?? inteira;
  });
}

/** Lê o teor da Kurier: com o cabeçalho do DJEN separa órgão, intimados, partes e advogados; sem ele, só os parágrafos. */
export function lerPublicacao(teorOriginal: string): LeituraPublicacao {
  const teor = decodificarEntidades(teorOriginal);
  const djen = lerComunicacaoDjen(teor);
  if (!djen) {
    return {
      djen: false,
      orgao: null,
      tipoComunicacao: null,
      meio: null,
      classe: null,
      intimados: [],
      paragrafos: paragrafosDoCorpo(teor),
      partes: [],
      advogados: [],
    };
  }
  const plano = teor.replace(/\s+/g, " ");
  const meio = trecho(plano, /MEIO:\s*(.*?)\s+TRIBUNAL:/);
  const classe = trecho(plano, /TRIBUNAL:\s*\S+\s+(.*?)\s+TEXTO:/);
  const partes = new Map<string, { nome: string; polo: string }>();
  for (const parte of djen.partes) {
    const nome = corrigirCaixa(parte.nome);
    partes.set(`${nome}|${parte.polo}`, { nome, polo: parte.polo });
  }
  return {
    djen: true,
    orgao: djen.orgao,
    tipoComunicacao: djen.tipoComunicacao,
    // "MEIO:D" é só a sigla: não diz nada a quem lê.
    meio: meio && meio.length > 2 ? meio : null,
    classe: classe ? corrigirCaixa(classe) : null,
    intimados: djen.intimados.map(corrigirCaixa),
    paragrafos: paragrafosDoCorpo(djen.corpo),
    partes: [...partes.values()],
    advogados: djen.advogados.map((advogado) => ({
      ...advogado,
      nome: corrigirCaixa(advogado.nome),
      doEscritorio: citaAdvogadoDoEscritorio(`${advogado.nome} ${advogado.oab}`),
    })),
  };
}

// ---------------------------------------------------------------------------
// Marca-texto
// ---------------------------------------------------------------------------

export type TipoDestaque = "prazo" | "pena" | "valor" | "data" | "hora" | "evento" | "ordem";

export interface Trecho {
  texto: string;
  tipo: TipoDestaque | null;
  /** Posição do trecho no parágrafo (chave estável para rolar até ele). */
  inicio: number;
}

const NUMERO_EXTENSO =
  "(?:uma?|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|sessenta|noventa|cento e oitenta|quarenta e oito|vinte e quatro|setenta e duas)";
const NUMERO = `(?:\\d{1,3}(?:\\s*\\([\\p{L}\\s-]{2,40}\\))?|${NUMERO_EXTENSO})`;
const MESES = "(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)";

/** Ordem importa: em trechos sobrepostos fica o que vem antes nesta lista. */
const PADROES: { tipo: TipoDestaque; regex: RegExp }[] = [
  {
    tipo: "prazo",
    regex: new RegExp(
      `(?<![\\p{L}\\d])(?:(?:no|em|de|o|até|em até)\\s+)?(?:prazo\\s+(?:(?:legal|comum|sucessivo|improrrog[áa]vel|de)\\s+)*)?${NUMERO}\\s+(?:dias|horas)(?:\\s+(?:[úu]teis|corridos))?(?![\\p{L}])`,
      "giu"
    ),
  },
  // "no prazo legal": sem o número, mas é prazo do mesmo jeito.
  { tipo: "prazo", regex: /(?<![\p{L}])(?:no\s+)?prazo\s+(?:legal|de\s+lei)(?![\p{L}])/giu },
  { tipo: "pena", regex: /(?<![\p{L}])sob\s+pena\s+de\s+[^.;:()]{3,100}/giu },
  { tipo: "valor", regex: /R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g },
  { tipo: "data", regex: new RegExp(`(?<!\\d)(?:\\d{1,2}\\/\\d{1,2}\\/\\d{4}|\\d{1,2}º?\\s+de\\s+${MESES}\\s+de\\s+\\d{4})(?!\\d)`, "giu") },
  { tipo: "hora", regex: /(?<![\p{L}\d:])(?:(?:às|as)\s+)?\d{1,2}(?:h\d{2}|h(?![\p{L}])|:\d{2}h?)(?:min)?(?![\p{L}\d])/giu },
  {
    tipo: "evento",
    regex:
      /(?<![\p{L}])(?:audi[êe]ncia(?:\s+(?:de\s+)?(?:concilia[çc][ãa]o|instru[çc][ãa]o|una|inicial|julgamento|telepresencial|virtual|presencial))?|per[íi]cia|sess[ãa]o\s+(?:de\s+julgamento|virtual|telepresencial)|leil[ãa]o|hasta\s+p[úu]blica)(?![\p{L}])/giu,
  },
  {
    tipo: "ordem",
    regex:
      /(?<![\p{L}])(?:intime-se|intimem-se|intima-se|cite-se|citem-se|manifeste-se|manifestem-se|manifestar-se|manifestar|cumpra-se|comprove|comprovem|junte|juntem|apresente|apresentem|recolha|recolham|deposite|depositem|pague|paguem|especifique|especifiquem|providencie|providenciem|regularize|regularizem|emende|emendem|esclare[çc]a|esclare[çc]am|indique|indiquem|requeira|requeiram|impugnar)(?![\p{L}])/giu,
  },
];

/** Separa o parágrafo em trechos, com o tipo de destaque de cada um (null = texto comum). */
export function destacar(texto: string): Trecho[] {
  const achados: { inicio: number; fim: number; tipo: TipoDestaque; prioridade: number }[] = [];
  PADROES.forEach(({ tipo, regex }, prioridade) => {
    for (const achado of texto.matchAll(regex)) {
      const inicio = achado.index ?? 0;
      // "o prazo" sozinho não é prazo: precisa do número de dias/horas, que a regex já exige.
      achados.push({ inicio, fim: inicio + achado[0].length, tipo, prioridade });
    }
  });
  achados.sort((a, b) => a.inicio - b.inicio || a.prioridade - b.prioridade || b.fim - a.fim);
  const trechos: Trecho[] = [];
  let posicao = 0;
  for (const achado of achados) {
    if (achado.inicio < posicao) continue;
    if (achado.inicio > posicao) trechos.push({ texto: texto.slice(posicao, achado.inicio), tipo: null, inicio: posicao });
    trechos.push({ texto: texto.slice(achado.inicio, achado.fim), tipo: achado.tipo, inicio: achado.inicio });
    posicao = achado.fim;
  }
  if (posicao < texto.length) trechos.push({ texto: texto.slice(posicao), tipo: null, inicio: posicao });
  return trechos;
}

// ---------------------------------------------------------------------------
// Pontos de atenção
// ---------------------------------------------------------------------------

export interface PontoDeAtencao {
  tipo: Extract<TipoDestaque, "prazo" | "pena" | "valor" | "data" | "evento">;
  texto: string;
  /** Onde está no texto: índice do parágrafo e início do trecho. */
  paragrafo: number;
  inicio: number;
  /** Prazo em dias citado no trecho (null para horas ou número que não deu para ler). */
  dias?: number | null;
  /** "corridos" quando o texto diz; null quando não diz (o padrão do CPC é úteis). */
  contagem?: "uteis" | "corridos" | null;
}

const EXTENSO: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  quinze: 15,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  sessenta: 60,
  noventa: 90,
  "cento e oitenta": 180,
};

/** Dias do trecho de prazo: "15 (quinze) dias" → 15, "cinco dias úteis" → 5, "48 horas" → null. */
export function diasDoTrecho(texto: string): { dias: number | null; contagem: "uteis" | "corridos" | null } {
  const plano = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const contagem = /corridos/.test(plano) ? "corridos" : /uteis/.test(plano) ? "uteis" : null;
  if (/horas/.test(plano)) return { dias: null, contagem };
  const digitos = plano.match(/\d{1,3}/);
  if (digitos) return { dias: Number(digitos[0]), contagem };
  const extenso = Object.keys(EXTENSO)
    .sort((a, b) => b.length - a.length)
    .find((palavra) => new RegExp(`(^|\\s)${palavra}\\s+dias`).test(plano));
  return { dias: extenso ? EXTENSO[extenso] : null, contagem };
}

/** "27/10/2026" ou "27 de outubro de 2026" → "2026-10-27". */
export function dataDoTrecho(texto: string): string | null {
  const numerica = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (numerica) return `${numerica[3]}-${numerica[2].padStart(2, "0")}-${numerica[1].padStart(2, "0")}`;
  const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const plano = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const extensa = plano.match(/(\d{1,2})º?\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (!extensa) return null;
  const mes = meses.indexOf(extensa[2]) + 1;
  return mes ? `${extensa[3]}-${String(mes).padStart(2, "0")}-${extensa[1].padStart(2, "0")}` : null;
}

/**
 * O que o jurídico precisa ver antes de ler tudo: prazos, "sob pena de", valores, audiências e as
 * datas futuras (depois da publicação), com a hora junto quando vem logo em seguida.
 */
export function pontosDeAtencao(paragrafos: ParagrafoLeitura[], dataPublicacao: string | null, limite = 8): PontoDeAtencao[] {
  const pontos: PontoDeAtencao[] = [];
  const vistos = new Set<string>();
  paragrafos.forEach((paragrafo, indice) => {
    if (paragrafo.tipo === "titulo") return;
    const trechos = destacar(paragrafo.texto);
    trechos.forEach((item, posicao) => {
      if (!item.tipo || item.tipo === "ordem" || item.tipo === "hora") return;
      let texto = item.texto.trim();
      if (item.tipo === "data") {
        const data = dataDoTrecho(texto);
        // Data passada é do processo (decisão, juntada); a que interessa é a que ainda vai acontecer.
        if (!data || (dataPublicacao && data <= dataPublicacao)) return;
        const seguinte = trechos[posicao + 2];
        if (seguinte?.tipo === "hora" && (trechos[posicao + 1]?.texto.length ?? 99) <= 12) texto = `${texto} ${seguinte.texto.trim()}`;
      }
      const ponto: PontoDeAtencao = { tipo: item.tipo, texto, paragrafo: indice, inicio: item.inicio };
      if (item.tipo === "prazo") Object.assign(ponto, diasDoTrecho(texto));
      // O mesmo prazo citado de novo ("quinze dias" mais adiante) não vira outro ponto.
      const chave = item.tipo === "prazo" && ponto.dias ? `prazo|${ponto.dias}` : `${item.tipo}|${texto.toLowerCase()}`;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      pontos.push(ponto);
    });
  });
  const ordem: PontoDeAtencao["tipo"][] = ["prazo", "evento", "data", "pena", "valor"];
  return pontos.sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo)).slice(0, limite);
}
