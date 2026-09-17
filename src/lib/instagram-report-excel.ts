import type { CellObject, CellStyle, WorkBook, WorkSheet } from "xlsx-js-style";
import * as XLSX from "xlsx-js-style";
import JSZip from "jszip";
import {
  ENGAGEMENT_ACTIONS_LABEL,
  ENGAGEMENT_RATE_FORMULA,
} from "./instagram-engagement";
import type { InstagramReport } from "./instagram-report";

const FONT = "Calibri";
const NAVY = "04202F";
const TEAL = "47CDD0";
const WHITE = "FFFFFF";
const ZEBRA = "F4F7F8";
const TOTALS = "E6EEF2";
const MUTED = "5B6B73";
const BORDER = "D0D7DE";
const LINK = "0563C1";
const TITLE_ROW_H = 28;
const SUBTITLE_ROW_H = 20;
const HEADER_ROW_H = 34;
const DATA_ROW_H = 18;
const WRAP_ROW_H = 36;

const thin = (color = BORDER) => ({ style: "thin" as const, color: { rgb: color } });
const box = (color = BORDER): CellStyle["border"] => ({
  top: thin(color),
  bottom: thin(color),
  left: thin(color),
  right: thin(color),
});

const titleStyle: CellStyle = {
  font: { name: FONT, sz: 16, bold: true, color: { rgb: WHITE } },
  fill: { patternType: "solid", fgColor: { rgb: NAVY } },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
};

const subtitleStyle: CellStyle = {
  font: { name: FONT, sz: 10, color: { rgb: NAVY } },
  fill: { patternType: "solid", fgColor: { rgb: TEAL } },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
};

const sectionStyle: CellStyle = {
  font: { name: FONT, sz: 11, bold: true, color: { rgb: NAVY } },
  fill: { patternType: "solid", fgColor: { rgb: TEAL } },
  alignment: { horizontal: "left", vertical: "center" },
};

const headerStyle: CellStyle = {
  font: { name: FONT, sz: 10, bold: true, color: { rgb: WHITE } },
  fill: { patternType: "solid", fgColor: { rgb: NAVY } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: box(NAVY),
};

const labelStyle: CellStyle = {
  font: { name: FONT, sz: 11, color: { rgb: NAVY } },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
  border: box(),
};

const footerStyle: CellStyle = {
  font: { name: FONT, sz: 9, italic: true, color: { rgb: MUTED } },
  alignment: { horizontal: "left", vertical: "center" },
};

const totalsStyle: CellStyle = {
  font: { name: FONT, sz: 10, bold: true, color: { rgb: NAVY } },
  fill: { patternType: "solid", fgColor: { rgb: TOTALS } },
  alignment: { vertical: "center" },
  border: box(),
};

type NumberFormat = "int" | "decimal" | "pct";
type ColumnFormat = NumberFormat | "text" | "link";

interface ColumnSpec {
  header: string;
  key: string;
  width: number;
  format?: ColumnFormat;
  wrap?: boolean;
}

interface HyperlinkValue {
  text: string;
  url: string;
}

type CellValue = string | number | null | HyperlinkValue;

interface TableSheetInput {
  title: string;
  subtitle: string;
  columns: ColumnSpec[];
  rows: Record<string, CellValue>[];
  totals?: Record<string, CellValue>;
  freezeCols?: number;
}

function isHyperlink(value: CellValue): value is HyperlinkValue {
  return typeof value === "object" && value !== null && "url" in value;
}

function numFmt(format?: ColumnFormat): string | undefined {
  if (format === "int") return "#,##0";
  if (format === "decimal") return "#,##0.0";
  if (format === "pct") return "0.00";
  return undefined;
}

function dataStyle(args: {
  format?: ColumnFormat;
  wrap?: boolean;
  zebra?: boolean;
}): CellStyle {
  const horizontal =
    args.format === "int" || args.format === "decimal" || args.format === "pct"
      ? "right"
      : args.format === "link"
        ? "center"
        : "left";
  return {
    font: {
      name: FONT,
      sz: 10,
      color: { rgb: args.format === "link" ? LINK : NAVY },
      underline: args.format === "link",
    },
    fill: args.zebra ? { patternType: "solid", fgColor: { rgb: ZEBRA } } : undefined,
    alignment: {
      horizontal,
      vertical: args.wrap ? "top" : "center",
      wrapText: Boolean(args.wrap || args.format === "link"),
    },
    border: box(),
    numFmt: numFmt(args.format),
  };
}

function cellAt(ws: WorkSheet, r: number, c: number): CellObject {
  const addr = XLSX.utils.encode_cell({ r, c });
  const current = ws[addr] as CellObject | undefined;
  if (current) return current;
  const created: CellObject = { t: "s", v: "" };
  ws[addr] = created;
  return created;
}

function applyStyle(cell: CellObject, style: CellStyle, format?: ColumnFormat) {
  cell.s = { ...style };
  const formatCode = numFmt(format) ?? style.numFmt;
  if (formatCode) {
    cell.z = formatCode;
    cell.s = { ...cell.s, numFmt: formatCode };
  }
}

function merge(ws: WorkSheet, r: number, from: number, to: number) {
  ws["!merges"] = ws["!merges"] ?? [];
  ws["!merges"].push({ s: { r, c: from }, e: { r, c: to } });
}

function setRowHeights(ws: WorkSheet, heights: number[]) {
  ws["!rows"] = heights.map((hpt) => ({ hpt }));
}

type FreezeView = {
  state: "frozen";
  xSplit: number;
  ySplit: number;
  topLeftCell: string;
  activeCell: string;
};

type SheetWithFreeze = WorkSheet & { "!freeze"?: FreezeView };

function freezePane(ws: WorkSheet, headerRow: number, xSplit = 0) {
  const ySplit = headerRow + 1;
  const topLeftCell = XLSX.utils.encode_cell({ r: ySplit, c: xSplit });
  (ws as SheetWithFreeze)["!freeze"] = {
    state: "frozen",
    xSplit,
    ySplit,
    topLeftCell,
    activeCell: topLeftCell,
  };
}

function freezeSheetViewXml(freeze: FreezeView): string {
  if (freeze.xSplit > 0) {
    return `<sheetView workbookViewId="0"><pane xSplit="${freeze.xSplit}" ySplit="${freeze.ySplit}" topLeftCell="${freeze.topLeftCell}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="${freeze.topLeftCell}" sqref="${freeze.topLeftCell}"/></sheetView>`;
  }
  return `<sheetView workbookViewId="0"><pane ySplit="${freeze.ySplit}" topLeftCell="${freeze.topLeftCell}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="${freeze.topLeftCell}" sqref="${freeze.topLeftCell}"/></sheetView>`;
}

async function patchFreezePanes(data: ArrayBuffer, wb: WorkBook): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(data);
  await Promise.all(
    wb.SheetNames.map(async (name, index) => {
      const freeze = (wb.Sheets[name] as SheetWithFreeze)["!freeze"];
      if (!freeze) return;
      const path = `xl/worksheets/sheet${index + 1}.xml`;
      const xml = await zip.file(path)?.async("string");
      if (!xml) return;
      zip.file(
        path,
        xml.replace(/<sheetView workbookViewId="0"\s*\/>/, freezeSheetViewXml(freeze))
      );
    })
  );
  return zip.generateAsync({
    type: "arraybuffer",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
}

function autoFilter(ws: WorkSheet, headerRow: number, lastRow: number, lastCol: number) {
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRow, c: 0 },
      e: { r: lastRow, c: lastCol },
    }),
  };
}

function writeBanner(ws: WorkSheet, title: string, subtitle: string, lastCol: number) {
  const titleCell = cellAt(ws, 0, 0);
  titleCell.t = "s";
  titleCell.v = title;
  applyStyle(titleCell, titleStyle);
  const subtitleCell = cellAt(ws, 1, 0);
  subtitleCell.t = "s";
  subtitleCell.v = subtitle;
  applyStyle(subtitleCell, subtitleStyle);
  for (let c = 1; c <= lastCol; c += 1) {
    applyStyle(cellAt(ws, 0, c), titleStyle);
    applyStyle(cellAt(ws, 1, c), subtitleStyle);
  }
  if (lastCol > 0) {
    merge(ws, 0, 0, lastCol);
    merge(ws, 1, 0, lastCol);
  }
}

function writeCell(ws: WorkSheet, r: number, c: number, value: CellValue, style: CellStyle, format?: ColumnFormat) {
  const cell = cellAt(ws, r, c);
  if (isHyperlink(value)) {
    cell.t = "s";
    cell.v = value.text;
    if (value.url) cell.l = { Target: value.url, Tooltip: value.url };
    applyStyle(cell, style, format);
    return;
  }
  if (typeof value === "number") {
    cell.t = "n";
    cell.v = value;
    applyStyle(cell, style, format);
    return;
  }
  cell.t = "s";
  cell.v = value ?? "";
  applyStyle(cell, style, format);
}

function buildTableSheet(input: TableSheetInput): WorkSheet {
  const { columns, rows, totals } = input;
  const lastCol = Math.max(columns.length - 1, 0);
  const headerRow = 3;
  const firstDataRow = 4;
  const lastDataRow = rows.length === 0 ? firstDataRow : firstDataRow + rows.length - 1;
  const totalsRow = totals ? lastDataRow + 2 : undefined;
  const aoa: CellValue[][] = [
    [input.title],
    [input.subtitle],
    [],
    columns.map((col) => col.header),
    ...(rows.length === 0
      ? [columns.map((_, index) => (index === 0 ? "Nenhum registro no filtro atual." : ""))]
      : rows.map((row) =>
          columns.map((col) => {
            const value = row[col.key];
            if (col.format === "link") {
              const url = typeof value === "string" ? value : "";
              return url ? { text: "Abrir post", url } : "—";
            }
            return value ?? "";
          })
        )),
  ];

  if (totals) {
    aoa.push([]);
    aoa.push(
      columns.map((col, index) => {
        if (index === 0) return "Total";
        return totals[col.key] ?? "";
      })
    );
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  writeBanner(ws, input.title, input.subtitle, lastCol);

  for (let c = 0; c < columns.length; c += 1) {
    const col = columns[c];
    applyStyle(cellAt(ws, headerRow, c), headerStyle);
    const dataRowCount = Math.max(rows.length, 1);
    for (let i = 0; i < dataRowCount; i += 1) {
      const r = firstDataRow + i;
      const raw = rows[i]?.[col.key];
      const value: CellValue =
        col.format === "link"
          ? typeof raw === "string" && raw
            ? { text: "Abrir post", url: raw }
            : "—"
          : (raw ?? (rows.length === 0 && c === 0 ? "Nenhum registro no filtro atual." : ""));
      writeCell(
        ws,
        r,
        c,
        value,
        dataStyle({
          format: col.format,
          wrap: col.wrap,
          zebra: i % 2 === 1,
        }),
        col.format
      );
    }
    if (totalsRow != null) {
      const totalValue = c === 0 ? "Total" : (totals[col.key] ?? "");
      writeCell(
        ws,
        totalsRow,
        c,
        totalValue,
        {
          ...totalsStyle,
          alignment: {
            horizontal:
              col.format === "int" || col.format === "decimal" || col.format === "pct"
                ? "right"
                : "left",
            vertical: "center",
          },
          numFmt: numFmt(col.format),
        },
        col.format
      );
    }
  }

  ws["!cols"] = columns.map((col) => ({ wch: col.width }));
  const heights = [TITLE_ROW_H, SUBTITLE_ROW_H, 10, HEADER_ROW_H];
  const dataCount = Math.max(rows.length, 1);
  for (let i = 0; i < dataCount; i += 1) {
    heights.push(columns.some((col) => col.wrap) ? WRAP_ROW_H : DATA_ROW_H);
  }
  if (totalsRow != null) {
    heights.push(10, DATA_ROW_H);
  }
  setRowHeights(ws, heights);
  freezePane(ws, headerRow, input.freezeCols ?? 0);
  autoFilter(ws, headerRow, lastDataRow, lastCol);
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalsRow ?? lastDataRow, c: lastCol },
  });
  return ws;
}

type SummaryItem =
  | { kind: "section"; label: string }
  | { kind: "row"; label: string; value: string | number; format?: ColumnFormat };

function valueStyle(format?: ColumnFormat, zebra = false): CellStyle {
  return {
    ...dataStyle({ format, zebra, wrap: true }),
    font: { name: FONT, sz: 11, bold: format !== "text", color: { rgb: NAVY } },
  };
}

function buildSummarySheet(report: InstagramReport): WorkSheet {
  const items: SummaryItem[] = [
    { kind: "section", label: "Conta" },
    { kind: "row", label: "Usuário", value: `@${report.accountUsername}` },
    { kind: "row", label: "Seguidores", value: report.followers, format: "int" },
    { kind: "section", label: "Período" },
    { kind: "row", label: "De", value: report.periodFrom ?? "—" },
    { kind: "row", label: "Até", value: report.periodTo ?? "—" },
    { kind: "row", label: "Filtros", value: report.filterDescription },
    { kind: "section", label: "Visão geral" },
    { kind: "row", label: "Posts analisados", value: report.totalPosts, format: "int" },
    { kind: "row", label: "Posts vinculados", value: report.linkedPosts, format: "int" },
    { kind: "row", label: "Posts pendentes", value: report.pendingPosts, format: "int" },
    { kind: "row", label: "Alcance total", value: report.totalReach, format: "int" },
    { kind: "row", label: "Visualizações total", value: report.totalViews, format: "int" },
    {
      kind: "row",
      label: `${ENGAGEMENT_ACTIONS_LABEL} total`,
      value: report.totalEngagementActions,
      format: "int",
    },
    {
      kind: "row",
      label: "Média ações de engajamento/post",
      value: report.avgEngagementActions,
      format: "decimal",
    },
    {
      kind: "row",
      label: "Taxa de engajamento (%)",
      value: report.aggregateEngagementRate,
      format: "pct",
    },
    { kind: "row", label: "Fórmula da taxa de engajamento", value: ENGAGEMENT_RATE_FORMULA },
    { kind: "row", label: "Curtidas total", value: report.totalLikes, format: "int" },
    { kind: "row", label: "Comentários total", value: report.totalComments, format: "int" },
    { kind: "row", label: "Salvamentos total", value: report.totalSaves, format: "int" },
    { kind: "section", label: "Destaques" },
    { kind: "row", label: "Área com mais posts", value: report.topAreaByPosts },
    { kind: "row", label: "Área com mais ações de engajamento", value: report.topAreaByEngagement },
    {
      kind: "row",
      label: "Post destaque (ações de engajamento)",
      value: report.topPostEngagementActions,
      format: "int",
    },
    { kind: "row", label: "Legenda do post destaque", value: report.topPostCaption || "—" },
  ];

  const lastCol = 1;
  const aoa: (string | number)[][] = [
    ["Relatório Instagram Insights"],
    [summaryMeta(report)],
    [],
    ["Indicador", "Valor"],
    ...items.map((item) =>
      item.kind === "section" ? [item.label, ""] : [item.label, item.value]
    ),
    [],
    ["Gerado em", new Date(report.generatedAt).toLocaleString("pt-BR")],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  writeBanner(ws, "Relatório Instagram Insights", summaryMeta(report), lastCol);
  applyStyle(cellAt(ws, 3, 0), headerStyle);
  applyStyle(cellAt(ws, 3, 1), headerStyle);

  let zebraIndex = 0;
  items.forEach((item, index) => {
    const r = 4 + index;
    if (item.kind === "section") {
      zebraIndex = 0;
      applyStyle(cellAt(ws, r, 0), sectionStyle);
      applyStyle(cellAt(ws, r, 1), sectionStyle);
      merge(ws, r, 0, 1);
      return;
    }
    const zebra = zebraIndex % 2 === 1;
    zebraIndex += 1;
    writeCell(ws, r, 0, item.label, { ...labelStyle, fill: zebra ? { patternType: "solid", fgColor: { rgb: ZEBRA } } : undefined });
    writeCell(ws, r, 1, item.value, valueStyle(item.format, zebra), item.format);
  });

  const footerRow = 4 + items.length + 1;
  writeCell(ws, footerRow, 0, "Gerado em", footerStyle);
  writeCell(ws, footerRow, 1, new Date(report.generatedAt).toLocaleString("pt-BR"), footerStyle);

  ws["!cols"] = [{ wch: 42 }, { wch: 56 }];
  const heights = [TITLE_ROW_H, SUBTITLE_ROW_H, 10, HEADER_ROW_H];
  for (const item of items) {
    heights.push(item.kind === "section" ? 22 : item.label.includes("Legenda") || item.label.includes("Fórmula") ? 32 : DATA_ROW_H);
  }
  heights.push(10, DATA_ROW_H);
  setRowHeights(ws, heights);
  freezePane(ws, 3);
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: footerRow, c: lastCol } });
  return ws;
}

function summaryMeta(report: InstagramReport): string {
  const period =
    report.periodFrom || report.periodTo
      ? `${report.periodFrom ?? "—"} a ${report.periodTo ?? "—"}`
      : "Período não informado";
  return `@${report.accountUsername}  ·  ${report.followers.toLocaleString("pt-BR")} seguidores  ·  ${period}  ·  ${report.filterDescription}`;
}

function sum(rows: Array<Record<string, CellValue>>, key: string): number {
  return rows.reduce((total, row) => total + (typeof row[key] === "number" ? row[key] : 0), 0);
}

function postLink(row: { permalink: string }): CellValue {
  return row.permalink;
}

export function buildInstagramExcelWorkbook(report: InstagramReport): WorkBook {
  const areaRows = report.areaRows.map((r) => ({ ...r }));
  const collabRows = report.collaboratorRows.map((r) => ({ ...r }));
  const formatRows = report.formatRows.map((r) => ({ ...r }));
  const topRows = report.topPosts.map((r, index) => ({ rank: index + 1, ...r }));
  const postRows = report.postRows.map((r) => ({ ...r }));
  const subtitle = summaryMeta(report);

  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: "Relatório Instagram Insights",
    Subject: subtitle,
    Author: "ORQESTRAI",
    Company: "ORQESTRAI",
    CreatedDate: new Date(report.generatedAt),
  };

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(report), "Resumo");
  XLSX.utils.book_append_sheet(
    wb,
    buildTableSheet({
      title: "Desempenho por área",
      subtitle,
      freezeCols: 1,
      columns: [
        { header: "Área", key: "area", width: 24 },
        { header: "Posts", key: "posts", width: 10, format: "int" },
        { header: "% Posts", key: "postsSharePct", width: 12, format: "pct" },
        { header: "Alcance", key: "reach", width: 13, format: "int" },
        { header: "Visualizações", key: "views", width: 14, format: "int" },
        { header: "Curtidas", key: "likes", width: 12, format: "int" },
        { header: "Comentários", key: "comments", width: 13, format: "int" },
        { header: "Compartilhamentos", key: "shares", width: 16, format: "int" },
        { header: "Salvamentos", key: "saves", width: 13, format: "int" },
        { header: ENGAGEMENT_ACTIONS_LABEL, key: "engagementActions", width: 16, format: "int" },
        { header: `% ${ENGAGEMENT_ACTIONS_LABEL}`, key: "engagementSharePct", width: 16, format: "pct" },
        { header: "Média ações/post", key: "avgEngagementActions", width: 15, format: "decimal" },
        { header: "Média alcance/post", key: "avgReach", width: 16, format: "int" },
        { header: "Média views/post", key: "avgViews", width: 15, format: "int" },
        { header: "Taxa de engajamento (%)", key: "engagementRate", width: 16, format: "pct" },
        { header: "Formato predominante", key: "topFormat", width: 18 },
        { header: "Colaboradores c/ posts", key: "collaboratorsWithPosts", width: 16, format: "int" },
      ],
      rows: areaRows,
      totals: areaRows.length
        ? {
            posts: sum(areaRows, "posts"),
            postsSharePct: 100,
            reach: sum(areaRows, "reach"),
            views: sum(areaRows, "views"),
            likes: sum(areaRows, "likes"),
            comments: sum(areaRows, "comments"),
            shares: sum(areaRows, "shares"),
            saves: sum(areaRows, "saves"),
            engagementActions: sum(areaRows, "engagementActions"),
            engagementSharePct: 100,
          }
        : undefined,
    }),
    "Por Área"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildTableSheet({
      title: "Desempenho por colaborador",
      subtitle,
      freezeCols: 2,
      columns: [
        { header: "Área", key: "area", width: 22 },
        { header: "Colaborador", key: "name", width: 28 },
        { header: "Status", key: "status", width: 16 },
        { header: "Posts", key: "posts", width: 10, format: "int" },
        { header: "Alcance", key: "reach", width: 13, format: "int" },
        { header: "Visualizações", key: "views", width: 14, format: "int" },
        { header: ENGAGEMENT_ACTIONS_LABEL, key: "engagementActions", width: 16, format: "int" },
        { header: "Média ações/post", key: "avgEngagementActions", width: 15, format: "decimal" },
      ],
      rows: collabRows,
    }),
    "Colaboradores"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildTableSheet({
      title: "Desempenho por formato",
      subtitle,
      freezeCols: 1,
      columns: [
        { header: "Formato", key: "format", width: 16 },
        { header: "Posts", key: "posts", width: 10, format: "int" },
        { header: "% do total", key: "sharePct", width: 12, format: "pct" },
        { header: "Alcance", key: "reach", width: 13, format: "int" },
        { header: "Visualizações", key: "views", width: 14, format: "int" },
        { header: ENGAGEMENT_ACTIONS_LABEL, key: "engagementActions", width: 16, format: "int" },
        { header: "Média ações/post", key: "avgEngagementActions", width: 15, format: "decimal" },
      ],
      rows: formatRows,
      totals: formatRows.length
        ? {
            posts: sum(formatRows, "posts"),
            sharePct: 100,
            reach: sum(formatRows, "reach"),
            views: sum(formatRows, "views"),
            engagementActions: sum(formatRows, "engagementActions"),
          }
        : undefined,
    }),
    "Por Formato"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildTableSheet({
      title: "Top posts por ações de engajamento",
      subtitle,
      freezeCols: 1,
      columns: [
        { header: "Rank", key: "rank", width: 8, format: "int" },
        { header: "Data", key: "date", width: 12 },
        { header: "Áreas", key: "areas", width: 28, wrap: true },
        { header: "Autores", key: "authors", width: 28, wrap: true },
        { header: "Formato", key: "format", width: 14 },
        { header: ENGAGEMENT_ACTIONS_LABEL, key: "engagementActions", width: 16, format: "int" },
        { header: "Alcance", key: "reach", width: 13, format: "int" },
        { header: "Visualizações", key: "views", width: 14, format: "int" },
        { header: "Taxa de engajamento (%)", key: "engagementRate", width: 16, format: "pct" },
        { header: "Legenda", key: "caption", width: 48, wrap: true },
        { header: "Link", key: "permalink", width: 14, format: "link" },
      ],
      rows: topRows.map((row) => ({ ...row, permalink: postLink(row) })),
    }),
    "Top Posts"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildTableSheet({
      title: "Todos os posts do recorte",
      subtitle,
      freezeCols: 1,
      columns: [
        { header: "Data", key: "date", width: 12 },
        { header: "Áreas", key: "areas", width: 28, wrap: true },
        { header: "Autores", key: "authors", width: 28, wrap: true },
        { header: "Formato", key: "format", width: 14 },
        { header: "Tags", key: "tags", width: 18, wrap: true },
        { header: "Collab", key: "collab", width: 10 },
        { header: "Vínculo", key: "linkStatus", width: 12 },
        { header: "Alcance", key: "reach", width: 13, format: "int" },
        { header: "Visualizações", key: "views", width: 14, format: "int" },
        { header: "Curtidas", key: "likes", width: 12, format: "int" },
        { header: "Comentários", key: "comments", width: 13, format: "int" },
        { header: "Compartilhamentos", key: "shares", width: 16, format: "int" },
        { header: "Salvamentos", key: "saves", width: 13, format: "int" },
        { header: ENGAGEMENT_ACTIONS_LABEL, key: "engagementActions", width: 16, format: "int" },
        { header: "Taxa de engajamento (%)", key: "engagementRate", width: 16, format: "pct" },
        { header: "Legenda", key: "caption", width: 48, wrap: true },
        { header: "Link", key: "permalink", width: 14, format: "link" },
      ],
      rows: postRows,
      totals: postRows.length
        ? {
            reach: sum(postRows, "reach"),
            views: sum(postRows, "views"),
            likes: sum(postRows, "likes"),
            comments: sum(postRows, "comments"),
            shares: sum(postRows, "shares"),
            saves: sum(postRows, "saves"),
            engagementActions: sum(postRows, "engagementActions"),
          }
        : undefined,
    }),
    "Posts"
  );

  return wb;
}

export async function serializeInstagramExcelWorkbook(report: InstagramReport): Promise<ArrayBuffer> {
  const wb = buildInstagramExcelWorkbook(report);
  const raw = XLSX.write(wb, {
    type: "array",
    bookType: "xlsx",
    cellStyles: true,
    compression: true,
  }) as ArrayBuffer;
  return patchFreezePanes(raw, wb);
}

export async function writeInstagramReportExcel(
  report: InstagramReport,
  options?: { filenameBase?: string }
): Promise<void> {
  const data = await serializeInstagramExcelWorkbook(report);
  const dateLabel = new Date().toISOString().slice(0, 10);
  const base = options?.filenameBase ?? `instagram-insights-${dateLabel}`;
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${base}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
