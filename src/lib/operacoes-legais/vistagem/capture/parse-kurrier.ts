import ExcelJS from "exceljs";
import type { KurrierRow } from "@/lib/operacoes-legais/vistagem/capture/match";

function cellText(value: ExcelJS.CellValue): string | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }
  if (typeof value === "object" && "result" in value) {
    return cellText(value.result as ExcelJS.CellValue);
  }
  return String(value);
}

function toISODate(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return value;
}

function dataRecebimentoFromFilename(name: string): string | null {
  // bismarchi.pires.adv2_Lote-01_20032026.xlsx → BetweenDelimiters("_", ".", 1)
  const m = name.match(/_([^_.]+)\./);
  return m?.[1] ?? null;
}

export async function parseKurrierXlsx(
  buffer: ArrayBuffer | Buffer,
  filename: string,
): Promise<KurrierRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs types accept Buffer
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet =
    workbook.getWorksheet("Publicações") ||
    workbook.getWorksheet("PUBLICAÇÕES") ||
    workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: Record<number, string> = {};
  headerRow.eachCell((cell, col) => {
    headers[col] = (cellText(cell.value) || "").trim().toUpperCase();
  });

  const col = (names: string[]) => {
    const entry = Object.entries(headers).find(([, h]) =>
      names.some((n) => h === n || h.includes(n)),
    );
    return entry ? Number(entry[0]) : null;
  };

  const cDivulg = col(["DATA DE DIVULGAÇÃO", "DATA DE DIVULGACAO"]);
  const cPublic = col(["DATA DE PUBLICAÇÃO", "DATA DE PUBLICACAO"]);
  const cProc = col(["NÚMERO DO PROCESSO", "NUMERO DO PROCESSO", "NÚMERO DO PROCESSO"]);
  const cDiario = col(["DIÁRIO - DIVISÃO", "DIARIO - DIVISAO", "DIÁRIO"]);
  const cAdv = col(["NOME LOCALIZADO NA PUBLICAÇÃO", "NOME LOCALIZADO"]);
  const cPubli = col(["PUBLICAÇÃO", "PUBLICACAO"]);
  const cTitulo = col(["TÍTULO", "TITULO"]);

  const rows: KurrierRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const numero = cProc ? cellText(row.getCell(cProc).value) : null;
    const publicacao = cPubli ? cellText(row.getCell(cPubli).value) : null;
    if (!numero && !publicacao) return;
    rows.push({
      source_filename: filename,
      data_recebimento: dataRecebimentoFromFilename(filename),
      data_divulgacao: toISODate(cDivulg ? cellText(row.getCell(cDivulg).value) : null),
      data_publicacao: toISODate(cPublic ? cellText(row.getCell(cPublic).value) : null),
      numero_processo: numero,
      diario_divisao: cDiario ? cellText(row.getCell(cDiario).value) : null,
      advogado_localizado: cAdv ? cellText(row.getCell(cAdv).value) : null,
      publicacao,
      titulo: cTitulo ? cellText(row.getCell(cTitulo).value) : null,
    });
  });

  return rows;
}
