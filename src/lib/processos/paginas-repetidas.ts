import { createHash } from "node:crypto";

/**
 * Páginas que a IA já leu não vão de novo para a leitura. O robô baixa os autos inteiros a cada pedido (e o
 * mesmo processo chega pelo e-SAJ, pelo eproc e pelo Jus.br): o PDF novo repete quase todo o anterior, e o
 * do Jus.br ainda repete páginas dentro do próprio arquivo.
 *
 * Só conta como repetida a página de texto idêntico (letras e números, sem acento, espaço nem pontuação),
 * de duas formas:
 * - inteira: o mesmo arquivo baixado de novo;
 * - sem o carimbo: as linhas que se repetem em muitas páginas do PDF (cabeçalho, rodapé, "assinado
 *   digitalmente por…", com os números trocados por #) saem, e o resto tem de ser idêntico. É o que acha a
 *   mesma peça vinda de outro sistema, com outro carimbo.
 * Semelhança aproximada fica de fora de propósito: duas decisões do mesmo modelo que só mudam a condenação
 * são páginas diferentes.
 */

/** Uma linha que aparece em pelo menos esta fração das páginas é carimbo (e em pelo menos 3 páginas). */
const FRACAO_DO_CARIMBO = 0.2;
const MINIMO_DE_PAGINAS_DO_CARIMBO = 3;
/** Sem o carimbo, a página precisa ter este tanto de texto para ser comparada: folha em branco não conta. */
const MINIMO_DO_CORPO = 200;
/** A página inteira, com o carimbo, precisa disto. */
const MINIMO_DA_PAGINA = 40;

export interface ImpressaoDaPagina {
  /** Marca da página inteira (null: pouco texto). */
  inteira: string | null;
  /** Marca da página sem as linhas de carimbo (null: pouco texto). */
  corpo: string | null;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function modeloDaLinha(linha: string): string {
  return normalizar(linha).replace(/[0-9]+/g, "#");
}

function marca(prefixo: string, texto: string): string {
  return `${prefixo}${createHash("sha256").update(texto).digest("hex").slice(0, 20)}`;
}

/** As marcas de cada página do PDF (o carimbo é medido no próprio arquivo). */
export function impressoesDasPaginas(paginas: string[]): ImpressaoDaPagina[] {
  const linhas = paginas.map((pagina) => pagina.split("\n"));
  const frequencia = new Map<string, number>();
  for (const pagina of linhas) {
    for (const modelo of new Set(pagina.map(modeloDaLinha).filter(Boolean))) frequencia.set(modelo, (frequencia.get(modelo) ?? 0) + 1);
  }
  const corte = Math.max(MINIMO_DE_PAGINAS_DO_CARIMBO, paginas.length * FRACAO_DO_CARIMBO);
  return linhas.map((pagina) => {
    const inteira = normalizar(pagina.join("\n"));
    const corpo = pagina
      .filter((linha) => (frequencia.get(modeloDaLinha(linha)) ?? 0) < corte)
      .map(normalizar)
      .join("");
    return {
      inteira: inteira.length >= MINIMO_DA_PAGINA ? marca("p", inteira) : null,
      corpo: corpo.length >= MINIMO_DO_CORPO ? marca("c", corpo) : null,
    };
  });
}

export interface PaginasParaLer {
  /** As páginas do PDF, com as repetidas vazias (a numeração não muda; página vazia fica fora dos blocos). */
  paginas: string[];
  /** Páginas já lidas em outro PDF do mesmo processo. */
  deOutroPdf: number;
  /** Páginas repetidas dentro deste PDF (a primeira vez é lida). */
  noMesmoPdf: number;
}

/** Tira da leitura as páginas já lidas em outro PDF do processo e as repetidas neste. */
export function paginasParaLer(paginas: string[], impressoes: ImpressaoDaPagina[], jaLidas: ReadonlySet<string>): PaginasParaLer {
  const vistas = new Set<string>();
  let deOutroPdf = 0;
  let noMesmoPdf = 0;
  const resultado = paginas.map((pagina, indice) => {
    const marcas = [impressoes[indice]?.inteira, impressoes[indice]?.corpo].filter((m): m is string => Boolean(m));
    if (marcas.some((m) => jaLidas.has(m))) {
      deOutroPdf += 1;
      return "";
    }
    if (marcas.some((m) => vistas.has(m))) {
      noMesmoPdf += 1;
      return "";
    }
    for (const m of marcas) vistas.add(m);
    return pagina;
  });
  return { paginas: resultado, deOutroPdf, noMesmoPdf };
}

/** As marcas das páginas lidas (índices de 1 em diante, de `inicio` a `fim`), para a próxima leitura do processo. */
export function marcasLidas(impressoes: ImpressaoDaPagina[], trechos: { inicio: number; fim: number }[]): string[] {
  const marcas = new Set<string>();
  for (const { inicio, fim } of trechos) {
    for (let numero = inicio; numero <= fim; numero += 1) {
      const impressao = impressoes[numero - 1];
      if (impressao?.inteira) marcas.add(impressao.inteira);
      if (impressao?.corpo) marcas.add(impressao.corpo);
    }
  }
  return [...marcas];
}

/** Aviso da leitura com as páginas que ficaram de fora por já terem sido lidas. */
export function avisoDasRepetidas({ deOutroPdf, noMesmoPdf }: Pick<PaginasParaLer, "deOutroPdf" | "noMesmoPdf">): string | null {
  const partes: string[] = [];
  if (deOutroPdf) partes.push(`${deOutroPdf} já lida${deOutroPdf === 1 ? "" : "s"} em outro PDF deste processo`);
  if (noMesmoPdf) partes.push(`${noMesmoPdf} repetida${noMesmoPdf === 1 ? "" : "s"} dentro deste PDF`);
  if (!partes.length) return null;
  const total = deOutroPdf + noMesmoPdf;
  return `${total} página${total === 1 ? "" : "s"} não ${total === 1 ? "foi" : "foram"} para a IA: ${partes.join(" e ")}.`;
}
