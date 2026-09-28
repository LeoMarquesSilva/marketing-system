import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath =
  "C:\\Users\\Leonardo Marques\\Downloads\\Colaboradores-MKT.xlsm";

const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);
const overview = await workbook.inspect({
  kind: "workbook,sheet,table,region",
  maxChars: 12000,
  tableMaxRows: 8,
  tableMaxCols: 20,
  tableMaxCellChars: 120,
});

console.log(overview.ndjson);

const sheet = workbook.worksheets.getItem("Sheet1");
const values = sheet.getUsedRange(true).values;
const headers = values[0].map((value) => String(value ?? "").trim());
const rows = values.slice(1);
const activeIndex = headers.indexOf("Colaborador Ativo?");
const areaIndex = headers.indexOf("ÁREA");
const roleIndex = headers.indexOf("CARGO");

const activeRows = rows.filter(
  (row) => String(row[activeIndex] ?? "").trim().toLocaleUpperCase("pt-BR") === "SIM",
);
const inactiveRows = rows.filter(
  (row) => String(row[activeIndex] ?? "").trim().toLocaleUpperCase("pt-BR") === "NÃO",
);
const completion = headers.map((header, columnIndex) => ({
  header,
  filled: activeRows.filter((row) => {
    const value = row[columnIndex];
    return value !== null && value !== undefined && String(value).trim() !== "";
  }).length,
  total: activeRows.length,
}));

const uniqueCount = (columnIndex) =>
  new Set(
    activeRows
      .map((row) => String(row[columnIndex] ?? "").trim())
      .filter(Boolean),
  ).size;

console.log(
  JSON.stringify(
    {
      headers,
      totalRows: rows.length,
      activeRows: activeRows.length,
      inactiveRows: inactiveRows.length,
      uniqueAreas: uniqueCount(areaIndex),
      uniqueRoles: uniqueCount(roleIndex),
      completion,
    },
    null,
    2,
  ),
);

const contactColumns = await workbook.inspect({
  kind: "table",
  sheetId: "Sheet1",
  range: "U1:V15",
  include: "values",
  tableMaxRows: 15,
  tableMaxCols: 2,
  tableMaxCellChars: 100,
  maxChars: 4000,
});
console.log(contactColumns.ndjson);
