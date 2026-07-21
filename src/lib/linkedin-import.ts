import * as XLSX from "xlsx";
import type {
  LinkedinWorkbookData,
  ParsedLinkedinDailyMetric,
  ParsedLinkedinPost,
} from "@/lib/linkedin-types";

type CellValue = string | number | boolean | Date | null | undefined;
type Matrix = CellValue[][];

function normalizeHeader(value: CellValue): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numberValue(value: CellValue): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integerValue(value: CellValue): number {
  return Math.max(0, Math.round(numberValue(value)));
}

function excelDateParts(value: CellValue): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
      hour: value.getUTCHours(),
      minute: value.getUTCMinutes(),
      second: value.getUTCSeconds(),
    };
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return {
      year: parsed.y,
      month: parsed.m,
      day: parsed.d,
      hour: parsed.H,
      minute: parsed.M,
      second: Math.floor(parsed.S),
    };
  }

  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (match) {
    return {
      year: Number(match[3]),
      month: Number(match[1]),
      day: Number(match[2]),
      hour: Number(match[4] ?? 0),
      minute: Number(match[5] ?? 0),
      second: Number(match[6] ?? 0),
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
    hour: parsed.getUTCHours(),
    minute: parsed.getUTCMinutes(),
    second: parsed.getUTCSeconds(),
  };
}

function isoDate(value: CellValue): string | null {
  const parts = excelDateParts(value);
  if (!parts) return null;
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  ).toISOString();
}

function dateOnly(value: CellValue): string | null {
  return isoDate(value)?.slice(0, 10) ?? null;
}

function findHeaderRow(rows: Matrix, requiredHeaders: string[]): number {
  const normalizedRequired = requiredHeaders.map(normalizeHeader);
  return rows.findIndex((row) => {
    const headers = new Set(row.map(normalizeHeader));
    return normalizedRequired.every((header) => headers.has(header));
  });
}

function columnMap(row: CellValue[]): Map<string, number> {
  return new Map(row.map((value, index) => [normalizeHeader(value), index]));
}

function cell(row: CellValue[], columns: Map<string, number>, header: string): CellValue {
  const index = columns.get(normalizeHeader(header));
  return index == null ? null : row[index];
}

function textValue(value: CellValue): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function extractLinkedinUrn(permalink: string): string {
  return permalink.match(/urn:li:(?:activity|share):(\d+)/i)?.[1] ?? permalink;
}

function extractByline(caption: string | null): string | null {
  return caption?.match(/^\s*Por:\s*(.+?)\s*$/im)?.[1]?.trim() ?? null;
}

function parseDailySheet(rows: Matrix): ParsedLinkedinDailyMetric[] {
  const headerIndex = findHeaderRow(rows, ["Data", "Impressões (total)", "Cliques (total)"]);
  if (headerIndex < 0) throw new Error("A aba de métricas não contém os cabeçalhos esperados.");
  const columns = columnMap(rows[headerIndex]);

  return rows.slice(headerIndex + 1).flatMap((row) => {
    const metricDate = dateOnly(cell(row, columns, "Data"));
    if (!metricDate) return [];
    return [{
      metric_date: metricDate,
      organic_impressions: integerValue(cell(row, columns, "Impressões (orgânicas)")),
      sponsored_impressions: integerValue(cell(row, columns, "Impressões (patrocinadas)")),
      total_impressions: integerValue(cell(row, columns, "Impressões (total)")),
      unique_organic_impressions: integerValue(cell(row, columns, "Impressões únicas (orgânicas)")),
      organic_clicks: integerValue(cell(row, columns, "Cliques (orgânicos)")),
      sponsored_clicks: integerValue(cell(row, columns, "Cliques (patrocinados)")),
      total_clicks: integerValue(cell(row, columns, "Cliques (total)")),
      organic_reactions: integerValue(cell(row, columns, "Reações (orgânicas)")),
      sponsored_reactions: integerValue(cell(row, columns, "Reações (patrocinadas)")),
      total_reactions: integerValue(cell(row, columns, "Reações (total)")),
      organic_comments: integerValue(cell(row, columns, "Comentários (orgânicos)")),
      sponsored_comments: integerValue(cell(row, columns, "Comentários (patrocinados)")),
      total_comments: integerValue(cell(row, columns, "Comentários (total)")),
      organic_shares: integerValue(cell(row, columns, "Compartilhamentos (orgânicos)")),
      sponsored_shares: integerValue(cell(row, columns, "Compartilhamentos (patrocinados)")),
      total_shares: integerValue(cell(row, columns, "Compartilhamentos (total)")),
      organic_engagement_rate: numberValue(cell(row, columns, "Taxa de engajamento (orgânico)")),
      sponsored_engagement_rate: numberValue(cell(row, columns, "Taxa de engajamento (patrocinado)")),
      total_engagement_rate: numberValue(cell(row, columns, "Taxa de engajamento (total)")),
    }];
  });
}

function parsePostsSheet(rows: Matrix): ParsedLinkedinPost[] {
  const headerIndex = findHeaderRow(rows, [
    "Título da publicação",
    "Link da publicação",
    "Criação",
    "Impressões",
  ]);
  if (headerIndex < 0) throw new Error("A aba de publicações não contém os cabeçalhos esperados.");
  const columns = columnMap(rows[headerIndex]);

  return rows.slice(headerIndex + 1).flatMap((row) => {
    const permalink = textValue(cell(row, columns, "Link da publicação"));
    if (!permalink) return [];
    const caption = textValue(cell(row, columns, "Título da publicação"));
    return [{
      linkedin_urn: extractLinkedinUrn(permalink),
      caption,
      permalink,
      publication_type: textValue(cell(row, columns, "Tipo de publicação")),
      campaign_name: textValue(cell(row, columns, "Nome da campanha")),
      published_by: textValue(cell(row, columns, "Publicada por")),
      published_at: isoDate(cell(row, columns, "Criação")),
      campaign_start_at: isoDate(cell(row, columns, "Data de início da campanha")),
      campaign_end_at: isoDate(cell(row, columns, "Data de término da campanha")),
      audience: textValue(cell(row, columns, "Público")),
      impressions: integerValue(cell(row, columns, "Impressões")),
      views: integerValue(cell(row, columns, "Visualizações")),
      offsite_views: integerValue(cell(row, columns, "Visualizações fora do site")),
      clicks: integerValue(cell(row, columns, "Cliques")),
      ctr: numberValue(cell(row, columns, "Taxa de cliques (CTR)")),
      likes: integerValue(cell(row, columns, "Gostaram")),
      comments: integerValue(cell(row, columns, "Comentários")),
      shares: integerValue(cell(row, columns, "Compartilhamentos")),
      followers: integerValue(cell(row, columns, "Seguidores")),
      engagement_rate: numberValue(cell(row, columns, "Taxa de engajamento")),
      content_type: textValue(cell(row, columns, "Tipo de conteúdo")),
      byline: extractByline(caption),
    }];
  });
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Matrix {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<CellValue[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  }) as Matrix;
}

export function parseLinkedinWorkbook(buffer: Buffer | Uint8Array): LinkedinWorkbookData {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  if (workbook.SheetNames.length < 2) {
    throw new Error("O relatório precisa conter as abas de métricas e publicações.");
  }

  const sheets = workbook.SheetNames.map((name) => ({ name, rows: sheetRows(workbook, name) }));
  const dailySheet = sheets.find(({ rows }) =>
    findHeaderRow(rows, ["Data", "Impressões (total)", "Cliques (total)"]) >= 0
  );
  const postsSheet = sheets.find(({ rows }) =>
    findHeaderRow(rows, ["Título da publicação", "Link da publicação", "Criação"]) >= 0
  );
  if (!dailySheet || !postsSheet) {
    throw new Error("Não foi possível reconhecer as abas do relatório do LinkedIn.");
  }

  const dailyMetrics = parseDailySheet(dailySheet.rows);
  const posts = parsePostsSheet(postsSheet.rows);
  if (dailyMetrics.length === 0 || posts.length === 0) {
    throw new Error("O relatório não contém métricas ou publicações válidas.");
  }

  const warnings: string[] = [];
  if (dailyMetrics.every((row) => row.sponsored_impressions === 0)) {
    warnings.push("O arquivo não contém atividade patrocinada no período.");
  }
  const postsWithoutContentType = posts.filter((post) => !post.content_type).length;
  if (postsWithoutContentType > 0) {
    warnings.push(`${postsWithoutContentType} publicações não informam o tipo de conteúdo.`);
  }

  const dates = [
    ...dailyMetrics.map((row) => row.metric_date),
    ...posts.map((post) => post.published_at?.slice(0, 10)).filter((date): date is string => Boolean(date)),
  ].sort();

  return {
    dailyMetrics,
    posts,
    warnings,
    dateFrom: dates[0] ?? null,
    dateTo: dates.at(-1) ?? null,
  };
}
