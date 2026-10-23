/**
 * Junta os trechos de texto de uma prancheta (pdf.js getTextContent) em blocos, que a
 * tela Modelos oferece como campos: trechos na mesma linha base viram uma linha, e
 * linhas seguidas do mesmo tamanho e fonte, alinhadas, viram um parágrafo.
 *
 * Entrada já na régua da prancheta em px (origem em cima, 1080 de largura).
 */

export interface TextRun {
  str: string;
  /** início da linha base */
  x: number;
  y: number;
  width: number;
  size: number;
  /** nome da fonte no PDF, sem o prefixo do subconjunto ("Gotham-Book") */
  font: string;
  ascent: number;
  /** ponto de início no espaço do PDF, para apagar o texto do fundo */
  anchor: [number, number];
}

export interface TextBlock {
  id: string;
  text: string;
  lines: number;
  x0: number;
  x1: number;
  /** linha base da primeira e da última linha */
  firstBaseline: number;
  lastBaseline: number;
  size: number;
  lineHeight: number;
  align: "left" | "center" | "right" | "justify";
  font: string;
  ascent: number;
  upper: boolean;
  runs: TextRun[];
}

interface Line {
  runs: TextRun[];
  x0: number;
  x1: number;
  y: number;
  size: number;
  font: string;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

function lineText(line: Line): string {
  let out = "";
  let lastEnd = -Infinity;
  for (const run of [...line.runs].sort((a, b) => a.x - b.x)) {
    const gap = run.x - lastEnd;
    if (out && gap > run.size * 0.18 && !out.endsWith(" ") && !run.str.startsWith(" ")) out += " ";
    out += run.str;
    lastEnd = run.x + run.width;
  }
  return out.replace(/\s+/g, " ").trim();
}

function spread(values: number[]): number {
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
}

export function groupTextBlocks(runs: TextRun[], pageWidth: number): TextBlock[] {
  const items = runs.filter((r) => r.str.trim() && r.size > 0).sort((a, b) => a.y - b.y || a.x - b.x);

  // linhas: mesma linha base e perto na horizontal
  const lines: Line[] = [];
  for (const run of items) {
    const line = lines.find(
      (l) => Math.abs(l.y - run.y) < Math.max(l.size, run.size) * 0.35 && run.x - l.x1 < Math.max(l.size, run.size) * 1.6 && run.x + run.width > l.x0 - run.size
    );
    if (line) {
      line.runs.push(run);
      line.x0 = Math.min(line.x0, run.x);
      line.x1 = Math.max(line.x1, run.x + run.width);
      if (run.size > line.size) {
        line.size = run.size;
        line.font = run.font;
      }
    } else {
      lines.push({ runs: [run], x0: run.x, x1: run.x + run.width, y: run.y, size: run.size, font: run.font });
    }
  }
  lines.sort((a, b) => a.y - b.y || a.x0 - b.x0);

  // parágrafos: linhas seguidas, mesmo tamanho e fonte, que se sobrepõem na horizontal
  const groups: Line[][] = [];
  for (const line of lines) {
    const group = groups.find((g) => {
      const last = g[g.length - 1];
      const gap = line.y - last.y;
      const sameSize = Math.abs(line.size - last.size) <= last.size * 0.15;
      const overlap = line.x0 < Math.max(...g.map((l) => l.x1)) && line.x1 > Math.min(...g.map((l) => l.x0));
      return sameSize && line.font === last.font && gap > last.size * 0.7 && gap < last.size * 2.1 && overlap;
    });
    if (group) group.push(line);
    else groups.push([line]);
  }

  return groups.map((g, index) => {
    const x0 = Math.min(...g.map((l) => l.x0));
    const x1 = Math.max(...g.map((l) => l.x1));
    const size = median(g.map((l) => l.size));
    const gaps = g.slice(1).map((l, i) => l.y - g[i].y);
    let align: TextBlock["align"] = "left";
    if (g.length > 1) {
      const options: [TextBlock["align"], number][] = [
        ["left", spread(g.map((l) => l.x0))],
        ["center", spread(g.map((l) => (l.x0 + l.x1) / 2))],
        ["right", spread(g.map((l) => l.x1))],
      ];
      align = options.sort((a, b) => a[1] - b[1])[0][0];
      // justificado: todas as linhas menos a última batem nas duas bordas
      const full = g.slice(0, -1);
      if (full.length >= 1 && g.length >= 3 && spread(full.map((l) => l.x0)) < size * 0.15 && spread(full.map((l) => l.x1)) < size * 0.15) align = "justify";
    } else if (Math.abs((x0 + x1) / 2 - pageWidth / 2) < Math.max(6, size * 0.3)) {
      align = "center";
    }
    const text = g.map(lineText).join("\n");
    const runsOf = g.flatMap((l) => l.runs);
    return {
      id: `b${index + 1}`,
      text,
      lines: g.length,
      x0,
      x1,
      firstBaseline: g[0].y,
      lastBaseline: g[g.length - 1].y,
      size,
      lineHeight: gaps.length ? Math.round((median(gaps) / size) * 100) / 100 : 1.2,
      align,
      font: g[0].font,
      ascent: median(runsOf.map((r) => r.ascent)),
      upper: /\p{L}/u.test(text) && text === text.toLocaleUpperCase("pt-BR"),
      runs: runsOf,
    };
  });
}

/**
 * Caixa do campo a partir do bloco: o topo sai da linha base menos a altura acima dela,
 * de modo que o texto novo caia no mesmo lugar do original (com a entrelinha do bloco).
 */
export function blockBox(block: TextBlock, extraLines = 0): { x: number; y: number; w: number; h: number; linhas: number } {
  const lh = block.lineHeight;
  const ascent = block.ascent > 0.3 && block.ascent < 1.3 ? block.ascent : 0.8;
  const top = block.firstBaseline - block.size * (ascent + (lh - 1) / 2);
  const linhas = block.lines + extraLines;
  return {
    x: Math.round(block.x0),
    y: Math.round(top),
    w: Math.round(block.x1 - block.x0 + 2),
    h: Math.round(linhas * lh * block.size + 2),
    linhas,
  };
}

/** Peso pelo nome da fonte ("Gotham-Bold" → 700). */
export function weightFromName(name: string): number {
  const n = name.toLowerCase();
  if (/black|heavy/.test(n)) return 900;
  if (/extra-?bold|ultra-?bold/.test(n)) return 800;
  if (/semi-?bold|demi/.test(n)) return 600;
  if (/bold/.test(n)) return 700;
  if (/medium/.test(n)) return 500;
  if (/extra-?light|ultra-?light/.test(n)) return 200;
  if (/light/.test(n)) return 300;
  if (/thin|hairline/.test(n)) return 100;
  return 400;
}

/** "ABCDEF+Gotham-Book" → "Gotham-Book" */
export function cleanFontName(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, "").trim();
}
