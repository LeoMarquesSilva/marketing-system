import "server-only";

import JSZip from "jszip";
import type { CellObject, CellStyle, WorkBook, WorkSheet } from "xlsx-js-style";
import * as XLSX from "xlsx-js-style";
import type {
  CellValue,
  ColumnSpec,
  DetailBlock,
  DetailSheet,
  NotesSheet,
  PlanilhaSheet,
  RichValue,
  TableSheet,
  Tone,
} from "@/lib/eventos-planilha";

/**
 * Desenho da planilha do planejamento de eventos, no padrão das exportações
 * do sistema (relatório do Instagram, fichas do RH): faixa navy de título,
 * subtítulo teal, cabeçalho navy, zebra, filtro e painéis congelados.
 */

const FONT = "Calibri";
const NAVY = "04202F";
const TEAL = "47CDD0";
const TEAL_SOFT = "D9F3F4";
const WHITE = "FFFFFF";
const ZEBRA = "F4F7F8";
const TOTALS = "E6EEF2";
const MUTED = "5B6B73";
const BORDER = "D0D7DE";
const LINK = "0563C1";
const TONE_COLOR: Record<Tone, string> = {
  realizado: "1E7B4F",
  previsto: "9A6700",
  verba: MUTED,
};

const MONEY = '"R$" #,##0.00';
const DATE = "dd/mm/yyyy";

const TITLE_ROW = 0;
const SUBTITLE_ROW = 1;
const HEADER_ROW = 3;
const FIRST_DATA_ROW = 4;

const thin = (color = BORDER) => ({ style: "thin" as const, color: { rgb: color } });
const box = (color = BORDER): CellStyle["border"] => ({
  top: thin(color),
  bottom: thin(color),
  left: thin(color),
  right: thin(color),
});
const solid = (rgb: string): CellStyle["fill"] => ({ patternType: "solid", fgColor: { rgb } });

const titleStyle: CellStyle = {
  font: { name: FONT, sz: 16, bold: true, color: { rgb: WHITE } },
  fill: solid(NAVY),
  alignment: { horizontal: "left", vertical: "center" },
};

const subtitleStyle: CellStyle = {
  font: { name: FONT, sz: 10, color: { rgb: NAVY } },
  fill: solid(TEAL),
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
};

const headerStyle: CellStyle = {
  font: { name: FONT, sz: 10, bold: true, color: { rgb: WHITE } },
  fill: solid(NAVY),
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: box(NAVY),
};

const totalsStyle: CellStyle = {
  font: { name: FONT, sz: 10, bold: true, color: { rgb: NAVY } },
  fill: solid(TOTALS),
  alignment: { horizontal: "left", vertical: "center" },
  border: box(),
};

// ---------------------------------------------------------------------------
// Células
// ---------------------------------------------------------------------------

type Align = "left" | "center" | "right";

interface StyleArgs {
  zebra?: boolean;
  wrap?: boolean;
  align?: Align;
  fill?: string;
  bold?: boolean;
  color?: string;
  italic?: boolean;
  underline?: boolean;
  size?: number;
  numFmt?: string;
  /** Em linha alta, tudo encosta no topo para a leitura seguir alinhada. */
  top?: boolean;
}

function dataStyle(args: StyleArgs): CellStyle {
  return {
    font: {
      name: FONT,
      sz: args.size ?? 10,
      bold: args.bold,
      italic: args.italic,
      underline: args.underline,
      color: { rgb: args.color ?? NAVY },
    },
    fill: args.fill ? solid(args.fill) : args.zebra ? solid(ZEBRA) : undefined,
    alignment: {
      horizontal: args.align ?? "left",
      vertical: args.top ? "top" : "center",
      wrapText: Boolean(args.wrap),
    },
    border: box(),
    numFmt: args.numFmt,
  };
}

function isRich(value: CellValue): value is RichValue {
  return typeof value === "object" && value !== null;
}

/** "2026-05-08" → número de série do Excel (sem passar por Date local, sem fuso). */
function excelDate(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (Date.UTC(y!, m! - 1, d!) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function put(ws: WorkSheet, r: number, c: number, cell: CellObject) {
  ws[XLSX.utils.encode_cell({ r, c })] = cell;
}

function sheetRef(name: string, row: number, col = 0): string {
  return `#'${name.replace(/'/g, "''")}'!${XLSX.utils.encode_cell({ r: row, c: col })}`;
}

/**
 * Escreve um valor do modelo numa célula. Âncoras viram link interno para o
 * bloco do evento; o resto do estilo vem de `base`.
 */
function writeValue(
  ws: WorkSheet,
  r: number,
  c: number,
  value: CellValue,
  base: StyleArgs,
  format: ColumnSpec["format"],
  anchors: Map<string, string>
) {
  if (typeof value === "number") {
    const money = format === "money";
    put(ws, r, c, {
      t: "n",
      v: value,
      z: money ? MONEY : undefined,
      s: dataStyle({ ...base, align: money ? "right" : "center", numFmt: money ? MONEY : undefined }),
    });
    return;
  }

  if (typeof value === "string" || value == null) {
    const text = value ?? "";
    if (format === "date" && ISO_DAY.test(text)) {
      put(ws, r, c, {
        t: "n",
        v: excelDate(text),
        z: DATE,
        s: dataStyle({ ...base, align: "center", numFmt: DATE }),
      });
      return;
    }
    put(ws, r, c, { t: "s", v: text, s: dataStyle(base) });
    return;
  }

  const rich = value;
  const target = rich.anchor ? anchors.get(rich.anchor) : rich.url;
  const style: StyleArgs = { ...base };
  if (rich.muted) Object.assign(style, { color: MUTED, italic: true });
  if (rich.tone) Object.assign(style, { color: TONE_COLOR[rich.tone], bold: true });
  if (target) Object.assign(style, { color: LINK, underline: true });
  if (format === "money" || format === "date") style.align = rich.muted ? "center" : style.align;

  const cell: CellObject = { t: "s", v: rich.text, s: dataStyle(style) };
  if (target) {
    cell.l = {
      Target: target,
      Tooltip: rich.anchor ? "Ver fornecedores, orçamentos e arquivos" : target,
    };
  }
  put(ws, r, c, cell);
}

function textOf(value: CellValue): string {
  if (isRich(value)) return value.text;
  return value == null ? "" : String(value);
}

/** Altura de linha para texto quebrado numa largura (em caracteres). */
function rowHeight(text: string, widthChars: number, min = 18): number {
  const perLine = Math.max(8, Math.floor(widthChars * 1.15));
  const lines = text
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0);
  return Math.max(min, Math.min(409, lines * 13.5 + 5));
}

function merge(ws: WorkSheet, r: number, from: number, to: number) {
  if (to <= from) return;
  ws["!merges"] = ws["!merges"] ?? [];
  ws["!merges"].push({ s: { r, c: from }, e: { r, c: to } });
}

/** Repete o estilo nas células cobertas por uma mesclagem, para a borda e o fundo fecharem. */
function fillMerged(ws: WorkSheet, r: number, from: number, to: number, style: CellStyle) {
  for (let c = from + 1; c <= to; c += 1) put(ws, r, c, { t: "s", v: "", s: style });
}

function writeBanner(ws: WorkSheet, title: string, subtitle: string, lastCol: number) {
  put(ws, TITLE_ROW, 0, { t: "s", v: title, s: titleStyle });
  put(ws, SUBTITLE_ROW, 0, { t: "s", v: subtitle, s: subtitleStyle });
  fillMerged(ws, TITLE_ROW, 0, lastCol, titleStyle);
  fillMerged(ws, SUBTITLE_ROW, 0, lastCol, subtitleStyle);
  merge(ws, TITLE_ROW, 0, lastCol);
  merge(ws, SUBTITLE_ROW, 0, lastCol);
}

// ---------------------------------------------------------------------------
// Painel congelado (o xlsx-js-style não grava; injeta o <pane> no XML)
// ---------------------------------------------------------------------------

interface FreezeView {
  xSplit: number;
  ySplit: number;
}

function freezeXml({ xSplit, ySplit }: FreezeView): string {
  const topLeft = XLSX.utils.encode_cell({ r: ySplit, c: xSplit });
  const pane = xSplit > 0 ? "bottomRight" : "bottomLeft";
  const x = xSplit > 0 ? ` xSplit="${xSplit}"` : "";
  return `<sheetView workbookViewId="0"><pane${x} ySplit="${ySplit}" topLeftCell="${topLeft}" activePane="${pane}" state="frozen"/><selection pane="${pane}" activeCell="${topLeft}" sqref="${topLeft}"/></sheetView>`;
}

async function patchFreezePanes(data: ArrayBuffer, freezes: Array<FreezeView | null>): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(data);
  await Promise.all(
    freezes.map(async (freeze, index) => {
      if (!freeze) return;
      const path = `xl/worksheets/sheet${index + 1}.xml`;
      const xml = await zip.file(path)?.async("string");
      if (!xml) return;
      zip.file(path, xml.replace(/<sheetView workbookViewId="0"\s*\/>/, freezeXml(freeze)));
    })
  );
  return zip.generateAsync({
    type: "arraybuffer",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
}

// ---------------------------------------------------------------------------
// Aba de tabela (calendário, histórico, fornecedores)
// ---------------------------------------------------------------------------

function renderTable(sheet: TableSheet, anchors: Map<string, string>): { ws: WorkSheet; freeze: FreezeView } {
  const ws: WorkSheet = {};
  const { columns, rows } = sheet;
  const lastCol = columns.length - 1;
  writeBanner(ws, sheet.title, sheet.subtitle, lastCol);

  columns.forEach((column, c) => put(ws, HEADER_ROW, c, { t: "s", v: column.header, s: headerStyle }));

  const heights: Array<{ hpt: number } | undefined> = [];
  heights[TITLE_ROW] = { hpt: 30 };
  heights[SUBTITLE_ROW] = { hpt: 22 };
  heights[2] = { hpt: 8 };
  heights[HEADER_ROW] = { hpt: 36 };

  if (rows.length === 0) {
    put(ws, FIRST_DATA_ROW, 0, { t: "s", v: "Nada cadastrado ainda.", s: dataStyle({ color: MUTED, italic: true }) });
    fillMerged(ws, FIRST_DATA_ROW, 0, lastCol, dataStyle({}));
    merge(ws, FIRST_DATA_ROW, 0, lastCol);
  }

  rows.forEach((row, index) => {
    const r = FIRST_DATA_ROW + index;
    const zebra = index % 2 === 1;
    const height = columns.reduce(
      (max, column, c) => (column.wrap ? Math.max(max, rowHeight(textOf(row[c] ?? ""), column.width)) : max),
      18
    );
    columns.forEach((column, c) => {
      const value = row[c] ?? "";
      const base: StyleArgs = {
        zebra,
        wrap: column.wrap,
        top: height > 18,
        ...(column.emphasis ? { fill: TEAL_SOFT, bold: true } : {}),
        // O nome do evento é a coluna que se lê primeiro.
        ...(c === 1 && sheet.freezeCols >= 2 ? { bold: true } : {}),
        ...(c === 0 && sheet.freezeCols === 1 ? { bold: true } : {}),
      };
      writeValue(ws, r, c, value, base, column.format, anchors);
    });
    heights[r] = { hpt: height };
  });

  const lastDataRow = FIRST_DATA_ROW + Math.max(rows.length, 1) - 1;

  if (sheet.totalColumns && sheet.totalColumns.length > 0 && rows.length > 0) {
    const r = lastDataRow + 1;
    const labelCol = sheet.freezeCols >= 2 ? 1 : 0;
    columns.forEach((column, c) => {
      if (sheet.totalColumns!.includes(c)) {
        const col = XLSX.utils.encode_col(c);
        const cached = rows.reduce((sum, row) => (typeof row[c] === "number" ? sum + (row[c] as number) : sum), 0);
        put(ws, r, c, {
          t: "n",
          v: Math.round(cached * 100) / 100,
          f: `SUM(${col}${FIRST_DATA_ROW + 1}:${col}${lastDataRow + 1})`,
          z: MONEY,
          s: { ...totalsStyle, numFmt: MONEY, alignment: { horizontal: "right", vertical: "center" } },
        });
      } else {
        put(ws, r, c, { t: "s", v: c === labelCol ? "Total" : "", s: totalsStyle });
      }
    });
    heights[r] = { hpt: 22 };
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: lastCol } });
  } else {
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastDataRow, c: lastCol } });
  }

  ws["!cols"] = columns.map((column) => ({ wch: column.width }));
  ws["!rows"] = heights.map((h) => h ?? { hpt: 18 });
  if (rows.length > 0) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({ s: { r: HEADER_ROW, c: 0 }, e: { r: lastDataRow, c: lastCol } }),
    };
  }

  return { ws, freeze: { xSplit: sheet.freezeCols, ySplit: HEADER_ROW + 1 } };
}

// ---------------------------------------------------------------------------
// Aba de detalhes: um bloco por evento
// ---------------------------------------------------------------------------

/** A..K: Categoria | Item | Fornecedor | Orçado | Previsto | Realizado | Pagamento | Pago em | Nota fiscal | Comprovante | Observações */
const DETAIL_WIDTHS = [16, 40, 28, 14, 14, 14, 12, 12, 12, 13, 44];
const DETAIL_LAST = DETAIL_WIDTHS.length - 1;

const blockHeadingStyle: CellStyle = {
  font: { name: FONT, sz: 12, bold: true, color: { rgb: WHITE } },
  fill: solid(NAVY),
  alignment: { horizontal: "left", vertical: "center" },
};

const blockLinkStyle: CellStyle = {
  font: { name: FONT, sz: 10, bold: true, underline: true, color: { rgb: TEAL } },
  fill: solid(NAVY),
  alignment: { horizontal: "center", vertical: "center" },
};

const blockFactsStyle: CellStyle = {
  font: { name: FONT, sz: 10, color: { rgb: NAVY } },
  fill: solid(TEAL_SOFT),
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
};

const sectionStyle: CellStyle = {
  font: { name: FONT, sz: 10, bold: true, color: { rgb: NAVY } },
  alignment: { horizontal: "left", vertical: "bottom" },
};

const subHeaderStyle: CellStyle = {
  font: { name: FONT, sz: 9, bold: true, color: { rgb: NAVY } },
  fill: solid(TOTALS),
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: box(),
};

function spanWidth(from: number, to: number): number {
  let total = 0;
  for (let c = from; c <= to; c += 1) total += DETAIL_WIDTHS[c]!;
  return total;
}

/** Um segmento de linha: valor ocupando as colunas from..to (mescladas se mais de uma). */
interface Segment {
  from: number;
  to: number;
  value: CellValue;
  format?: ColumnSpec["format"];
  wrap?: boolean;
  align?: Align;
}

function writeSegments(
  ws: WorkSheet,
  r: number,
  segments: Segment[],
  zebra: boolean,
  anchors: Map<string, string>
): number {
  const height = segments.reduce(
    (max, seg) => (seg.wrap ? Math.max(max, rowHeight(textOf(seg.value), spanWidth(seg.from, seg.to))) : max),
    18
  );
  for (const seg of segments) {
    const base: StyleArgs = { zebra, wrap: seg.wrap, align: seg.align, top: height > 18 };
    writeValue(ws, r, seg.from, seg.value ?? "", base, seg.format, anchors);
    if (seg.to > seg.from) {
      fillMerged(ws, r, seg.from, seg.to, dataStyle({ zebra }));
      merge(ws, r, seg.from, seg.to);
    }
  }
  return height;
}

function writeSubHeader(ws: WorkSheet, r: number, labels: Array<[number, number, string]>) {
  for (const [from, to, label] of labels) {
    put(ws, r, from, { t: "s", v: label, s: subHeaderStyle });
    fillMerged(ws, r, from, to, subHeaderStyle);
    merge(ws, r, from, to);
  }
}

function writeSection(ws: WorkSheet, r: number, label: string) {
  put(ws, r, 0, { t: "s", v: label, s: sectionStyle });
  merge(ws, r, 0, DETAIL_LAST);
}

const dash = (value: RichValue | null): CellValue => value ?? { text: "—", muted: true };
const missingAmount = (value: number | null): CellValue => value ?? { text: "—", muted: true };

function renderBlock(
  ws: WorkSheet,
  start: number,
  block: DetailBlock,
  heights: Array<{ hpt: number } | undefined>,
  anchors: Map<string, string>,
  calendarName: string
): number {
  let r = start;

  // Cabeçalho do evento: nome, volta ao calendário e link para o sistema.
  put(ws, r, 0, { t: "s", v: block.heading, s: blockHeadingStyle });
  fillMerged(ws, r, 0, 8, blockHeadingStyle);
  merge(ws, r, 0, 8);
  put(ws, r, 9, {
    t: "s",
    v: "↑ Calendário",
    s: blockLinkStyle,
    l: { Target: sheetRef(calendarName, 0), Tooltip: "Voltar ao calendário" },
  });
  put(ws, r, 10, {
    t: "s",
    v: "Abrir no ORQESTRAI",
    s: blockLinkStyle,
    l: { Target: block.appUrl, Tooltip: block.appUrl },
  });
  heights[r] = { hpt: 26 };
  r += 1;

  put(ws, r, 0, { t: "s", v: block.facts, s: blockFactsStyle });
  fillMerged(ws, r, 0, DETAIL_LAST, blockFactsStyle);
  merge(ws, r, 0, DETAIL_LAST);
  heights[r] = { hpt: rowHeight(block.facts, spanWidth(0, DETAIL_LAST), 20) };
  r += 1;

  if (block.budget.length > 0) {
    writeSection(ws, r, `Orçamento  ·  ${block.budget.length} ${block.budget.length === 1 ? "item" : "itens"}`);
    heights[r] = { hpt: 22 };
    r += 1;
    writeSubHeader(ws, r, [
      [0, 0, "Categoria"],
      [1, 1, "Item"],
      [2, 2, "Fornecedor"],
      [3, 3, "Orçado"],
      [4, 4, "Previsto"],
      [5, 5, "Realizado"],
      [6, 6, "Pagamento"],
      [7, 7, "Pago em"],
      [8, 8, "Nota fiscal"],
      [9, 9, "Comprovante"],
      [10, 10, "Observações"],
    ]);
    heights[r] = { hpt: 20 };
    r += 1;
    const first = r;
    block.budget.forEach((item, index) => {
      heights[r] = {
        hpt: writeSegments(
          ws,
          r,
          [
            { from: 0, to: 0, value: item.category },
            { from: 1, to: 1, value: item.description, wrap: true },
            { from: 2, to: 2, value: item.vendor, wrap: true },
            { from: 3, to: 3, value: missingAmount(item.quoted), format: "money" },
            { from: 4, to: 4, value: missingAmount(item.planned), format: "money" },
            { from: 5, to: 5, value: missingAmount(item.actual), format: "money" },
            { from: 6, to: 6, value: item.payment, align: "center" },
            { from: 7, to: 7, value: item.paidDate ?? { text: "—", muted: true }, format: "date", align: "center" },
            { from: 8, to: 8, value: dash(item.invoice), align: "center" },
            { from: 9, to: 9, value: dash(item.receipt), align: "center" },
            { from: 10, to: 10, value: item.notes, wrap: true },
          ],
          index % 2 === 1,
          anchors
        ),
      };
      r += 1;
    });
    // Total do orçamento, por fórmula.
    for (let c = 0; c <= DETAIL_LAST; c += 1) {
      if (c >= 3 && c <= 5) {
        const col = XLSX.utils.encode_col(c);
        const pick = c === 3 ? "quoted" : c === 4 ? "planned" : "actual";
        const cached = block.budget.reduce((sum, item) => sum + (item[pick] ?? 0), 0);
        put(ws, r, c, {
          t: "n",
          v: Math.round(cached * 100) / 100,
          f: `SUM(${col}${first + 1}:${col}${r})`,
          z: MONEY,
          s: { ...totalsStyle, numFmt: MONEY, alignment: { horizontal: "right", vertical: "center" } },
        });
      } else {
        put(ws, r, c, { t: "s", v: c === 1 ? "Total do orçamento" : "", s: totalsStyle });
      }
    }
    heights[r] = { hpt: 20 };
    r += 1;
  }

  if (block.quotes.length > 0) {
    writeSection(ws, r, `Propostas de fornecedores  ·  ${block.quotes.length}`);
    heights[r] = { hpt: 22 };
    r += 1;
    writeSubHeader(ws, r, [
      [0, 0, "Fornecedor"],
      [1, 2, "Escopo"],
      [3, 3, "Cotado"],
      [4, 4, "Final"],
      [5, 5, "Status"],
      [6, 9, "Motivo da decisão"],
      [10, 10, "Proposta"],
    ]);
    heights[r] = { hpt: 20 };
    r += 1;
    block.quotes.forEach((quote, index) => {
      heights[r] = {
        hpt: writeSegments(
          ws,
          r,
          [
            { from: 0, to: 0, value: quote.supplier, wrap: true },
            { from: 1, to: 2, value: quote.scope, wrap: true },
            { from: 3, to: 3, value: missingAmount(quote.quoted), format: "money" },
            { from: 4, to: 4, value: missingAmount(quote.final), format: "money" },
            { from: 5, to: 5, value: quote.status, align: "center" },
            { from: 6, to: 9, value: quote.reason, wrap: true },
            { from: 10, to: 10, value: dash(quote.file), align: "center" },
          ],
          index % 2 === 1,
          anchors
        ),
      };
      r += 1;
      // O que a proposta inclui pode ser uma lista longa: linha própria, na largura toda.
      if (quote.included) {
        heights[r] = {
          hpt: writeSegments(
            ws,
            r,
            [
              { from: 0, to: 0, value: { text: "Itens incluídos", muted: true } },
              { from: 1, to: DETAIL_LAST, value: quote.included, wrap: true },
            ],
            index % 2 === 1,
            anchors
          ),
        };
        r += 1;
      }
    });
  }

  if (block.suppliers.length > 0) {
    writeSection(ws, r, `Fornecedores do evento  ·  ${block.suppliers.length}`);
    heights[r] = { hpt: 22 };
    r += 1;
    writeSubHeader(ws, r, [
      [0, 0, "Categoria"],
      [1, 1, "Fornecedor"],
      [2, 2, "Papel no evento"],
      [3, 9, "Observações"],
      [10, 10, "Contato"],
    ]);
    heights[r] = { hpt: 20 };
    r += 1;
    block.suppliers.forEach((supplier, index) => {
      heights[r] = {
        hpt: writeSegments(
          ws,
          r,
          [
            { from: 0, to: 0, value: supplier.category, wrap: true },
            { from: 1, to: 1, value: supplier.name, wrap: true },
            { from: 2, to: 2, value: supplier.role, wrap: true },
            { from: 3, to: 9, value: supplier.notes, wrap: true },
            { from: 10, to: 10, value: dash(supplier.contact), align: "center" },
          ],
          index % 2 === 1,
          anchors
        ),
      };
      r += 1;
    });
  }

  if (block.attachments.length > 0) {
    writeSection(ws, r, `Arquivos e links  ·  ${block.attachments.length}`);
    heights[r] = { hpt: 22 };
    r += 1;
    writeSubHeader(ws, r, [
      [0, 0, "Tipo"],
      [1, 9, "Título"],
      [10, 10, "Link"],
    ]);
    heights[r] = { hpt: 20 };
    r += 1;
    block.attachments.forEach((attachment, index) => {
      heights[r] = {
        hpt: writeSegments(
          ws,
          r,
          [
            { from: 0, to: 0, value: attachment.type },
            { from: 1, to: 9, value: attachment.title, wrap: true },
            { from: 10, to: 10, value: attachment.link, align: "center" },
          ],
          index % 2 === 1,
          anchors
        ),
      };
      r += 1;
    });
  }

  // Respiro entre um evento e outro.
  heights[r] = { hpt: 14 };
  heights[r + 1] = { hpt: 14 };
  return r + 2;
}

/** Linha onde cada bloco começa — calculada antes, para os links das outras abas. */
function layoutDetailAnchors(sheet: DetailSheet): Map<string, number> {
  const scratch: WorkSheet = {};
  const rows: Array<{ hpt: number } | undefined> = [];
  const positions = new Map<string, number>();
  let r = FIRST_DATA_ROW - 1;
  for (const block of sheet.blocks) {
    positions.set(block.eventId, r);
    r = renderBlock(scratch, r, block, rows, new Map(), "");
  }
  return positions;
}

function renderDetails(
  sheet: DetailSheet,
  anchors: Map<string, string>,
  calendarName: string
): { ws: WorkSheet; freeze: FreezeView } {
  const ws: WorkSheet = {};
  writeBanner(ws, sheet.title, sheet.subtitle, DETAIL_LAST);
  const heights: Array<{ hpt: number } | undefined> = [];
  heights[TITLE_ROW] = { hpt: 30 };
  heights[SUBTITLE_ROW] = { hpt: 22 };
  heights[2] = { hpt: 8 };

  let r = FIRST_DATA_ROW - 1;
  if (sheet.blocks.length === 0) {
    put(ws, r, 0, { t: "s", v: "Nada lançado ainda.", s: dataStyle({ color: MUTED, italic: true }) });
    r += 1;
  }
  for (const block of sheet.blocks) {
    r = renderBlock(ws, r, block, heights, anchors, calendarName);
  }

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(r - 1, SUBTITLE_ROW), c: DETAIL_LAST } });
  ws["!cols"] = DETAIL_WIDTHS.map((wch) => ({ wch }));
  ws["!rows"] = heights.map((h) => h ?? { hpt: 18 });
  // Só o título fica preso: cada bloco tem o seu próprio cabeçalho.
  return { ws, freeze: { xSplit: 0, ySplit: SUBTITLE_ROW + 1 } };
}

// ---------------------------------------------------------------------------
// Aba de notas
// ---------------------------------------------------------------------------

function renderNotes(sheet: NotesSheet): WorkSheet {
  const ws: WorkSheet = {};
  const widths = [26, 110];
  writeBanner(ws, sheet.title, sheet.subtitle, 1);
  const heights: Array<{ hpt: number } | undefined> = [{ hpt: 30 }, { hpt: 22 }, { hpt: 8 }];
  sheet.rows.forEach(([label, text], index) => {
    const r = HEADER_ROW + index;
    const zebra = index % 2 === 1;
    put(ws, r, 0, { t: "s", v: label, s: dataStyle({ zebra, bold: true, wrap: true }) });
    put(ws, r, 1, { t: "s", v: text, s: dataStyle({ zebra, wrap: true }) });
    heights[r] = { hpt: rowHeight(text, widths[1]!, 20) };
  });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: HEADER_ROW + sheet.rows.length - 1, c: 1 } });
  ws["!cols"] = widths.map((wch) => ({ wch }));
  ws["!rows"] = heights.map((h) => h ?? { hpt: 18 });
  return ws;
}

// ---------------------------------------------------------------------------

export async function buildPlanejamentoWorkbook(sheets: PlanilhaSheet[]): Promise<ArrayBuffer> {
  const calendarName = sheets[0]?.name ?? "";
  const details = sheets.find((s): s is DetailSheet => s.kind === "details");

  const anchors = new Map<string, string>();
  if (details) {
    for (const [eventId, row] of layoutDetailAnchors(details)) {
      anchors.set(eventId, sheetRef(details.name, row));
    }
  }

  const wb: WorkBook = XLSX.utils.book_new();
  wb.Props = { Title: sheets[0]?.title ?? "Planejamento de eventos", Author: "ORQESTRAI" };
  const freezes: Array<FreezeView | null> = [];

  for (const sheet of sheets) {
    if (sheet.kind === "table") {
      const { ws, freeze } = renderTable(sheet, anchors);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      freezes.push(freeze);
    } else if (sheet.kind === "details") {
      const { ws, freeze } = renderDetails(sheet, anchors, calendarName);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      freezes.push(freeze);
    } else {
      XLSX.utils.book_append_sheet(wb, renderNotes(sheet), sheet.name);
      freezes.push(null);
    }
  }

  const raw = XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true, compression: true }) as ArrayBuffer;
  return patchFreezePanes(raw, freezes);
}
