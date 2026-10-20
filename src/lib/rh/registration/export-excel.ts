import "server-only";

import JSZip from "jszip";
import type { CellObject, CellStyle, WorkSheet } from "xlsx-js-style";
import * as XLSX from "xlsx-js-style";
import { EXPORT_COLUMNS, exportColumnGroups, exportRows, type ExportRecord } from "./export";

/**
 * Planilha das fichas cadastrais no padrão das exportações do sistema
 * (mesmas cores do relatório do Instagram): faixa de título, linha de grupos,
 * cabeçalho navy, zebra, filtro e cabeçalho + nome congelados.
 */

const FONT = "Calibri";
const NAVY = "04202F";
const TEAL = "47CDD0";
const GROUP_FILL = "D9F3F4";
const WHITE = "FFFFFF";
const ZEBRA = "F4F7F8";
const BORDER = "D0D7DE";

const TITLE_ROW = 0;
const SUBTITLE_ROW = 1;
const GROUP_ROW = 2;
const HEADER_ROW = 3;
const FIRST_DATA_ROW = 4;

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
  alignment: { horizontal: "left", vertical: "center" },
};

const subtitleStyle: CellStyle = {
  font: { name: FONT, sz: 10, color: { rgb: NAVY } },
  fill: { patternType: "solid", fgColor: { rgb: TEAL } },
  alignment: { horizontal: "left", vertical: "center" },
};

const groupStyle: CellStyle = {
  font: { name: FONT, sz: 10, bold: true, color: { rgb: NAVY } },
  fill: { patternType: "solid", fgColor: { rgb: GROUP_FILL } },
  alignment: { horizontal: "center", vertical: "center" },
  border: box(),
};

const headerStyle: CellStyle = {
  font: { name: FONT, sz: 10, bold: true, color: { rgb: WHITE } },
  fill: { patternType: "solid", fgColor: { rgb: NAVY } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: box(NAVY),
};

function dataStyle(zebra: boolean, wrap: boolean): CellStyle {
  return {
    font: { name: FONT, sz: 10, color: { rgb: NAVY } },
    fill: zebra ? { patternType: "solid", fgColor: { rgb: ZEBRA } } : undefined,
    alignment: { horizontal: "left", vertical: wrap ? "top" : "center", wrapText: wrap },
    border: box(),
  };
}

function setCell(ws: WorkSheet, r: number, c: number, value: string, style: CellStyle) {
  const cell: CellObject = { t: "s", v: value, s: style };
  ws[XLSX.utils.encode_cell({ r, c })] = cell;
}

function formatGeneratedAt(now: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(now);
}

/** O xlsx-js-style não grava painel congelado: injeta o <pane> no XML da planilha. */
async function freezeHeaderAndName(data: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(data);
  const path = "xl/worksheets/sheet1.xml";
  const xml = await zip.file(path)?.async("string");
  if (xml) {
    const topLeft = XLSX.utils.encode_cell({ r: FIRST_DATA_ROW, c: 1 });
    const view = `<sheetView workbookViewId="0"><pane xSplit="1" ySplit="${FIRST_DATA_ROW}" topLeftCell="${topLeft}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="${topLeft}" sqref="${topLeft}"/></sheetView>`;
    zip.file(path, xml.replace(/<sheetView workbookViewId="0"\s*\/>/, view));
  }
  return zip.generateAsync({
    type: "arraybuffer",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
}

export async function buildRegistrationsWorkbook(records: ExportRecord[], now: Date = new Date()): Promise<ArrayBuffer> {
  const columns = EXPORT_COLUMNS;
  const lastCol = columns.length - 1;
  const rows = exportRows(records, columns);
  const ws: WorkSheet = {};

  setCell(ws, TITLE_ROW, 0, "Fichas cadastrais — Bismarchi | Pires", titleStyle);
  setCell(
    ws,
    SUBTITLE_ROW,
    0,
    `Gerada em ${formatGeneratedAt(now)} · ${records.length} colaborador${records.length === 1 ? "" : "es"} · Dados pessoais restritos a Pessoas e Cultura (LGPD)`,
    subtitleStyle
  );
  for (let c = 1; c <= lastCol; c += 1) {
    setCell(ws, TITLE_ROW, c, "", titleStyle);
    setCell(ws, SUBTITLE_ROW, c, "", subtitleStyle);
  }

  const merges = [
    { s: { r: TITLE_ROW, c: 0 }, e: { r: TITLE_ROW, c: lastCol } },
    { s: { r: SUBTITLE_ROW, c: 0 }, e: { r: SUBTITLE_ROW, c: lastCol } },
  ];
  for (const group of exportColumnGroups(columns)) {
    for (let c = group.from; c <= group.to; c += 1) {
      setCell(ws, GROUP_ROW, c, c === group.from ? group.group : "", groupStyle);
    }
    if (group.to > group.from) merges.push({ s: { r: GROUP_ROW, c: group.from }, e: { r: GROUP_ROW, c: group.to } });
  }

  columns.forEach((column, c) => setCell(ws, HEADER_ROW, c, column.header, headerStyle));
  rows.forEach((values, index) => {
    const zebra = index % 2 === 1;
    values.forEach((value, c) => setCell(ws, FIRST_DATA_ROW + index, c, value, dataStyle(zebra, !!columns[c].wrap)));
  });

  const lastRow = Math.max(HEADER_ROW, FIRST_DATA_ROW + rows.length - 1);
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } });
  ws["!merges"] = merges;
  ws["!cols"] = columns.map((column) => ({ wch: column.width }));
  ws["!rows"] = [{ hpt: 28 }, { hpt: 20 }, { hpt: 20 }, { hpt: 32 }];
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: HEADER_ROW, c: 0 }, e: { r: lastRow, c: lastCol } }),
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fichas cadastrais");
  const raw = XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true, compression: true }) as ArrayBuffer;
  return freezeHeaderAndName(raw);
}
