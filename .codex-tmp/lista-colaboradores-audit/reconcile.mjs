import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outputDir = "C:/bkp/doc/marketing-system/.codex-tmp/lista-colaboradores-audit/reconcile-output";
await fs.mkdir(outputDir, { recursive: true });

async function loadWorkbook(path) {
  return SpreadsheetFile.importXlsx(await FileBlob.load(path));
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function excelDateToIso(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const serial = Number(value);
  if (!Number.isFinite(serial)) return null;
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
}

const currentWorkbook = await loadWorkbook(
  "C:/Users/Leonardo Marques/Downloads/Lista de Colaboradores.xlsx",
);
const currentSheet = currentWorkbook.worksheets.getItem("Planilha1");
const currentValues = currentSheet.getUsedRange(true).values;
const currentRows = currentValues.slice(1).filter((row) => clean(row[1])).map((row) => ({
  name: clean(row[1]),
  area: clean(row[2]),
  role: clean(row[3]),
  joinedOn: excelDateToIso(row[6]),
  phone: clean(row[10]) || null,
  email: normalizeEmail(row[13]),
}));

const oldWorkbook = await loadWorkbook(
  "C:/Users/Leonardo Marques/Downloads/Colaboradores-MKT.xlsm",
);
const oldMatches = [];
const missingNames = [
  "cristiana pereira da costa",
  "samuel willian silva",
  "maria heloiza gois ponce",
  "giovanna pereira de souza",
  "vinicius canto hecksher",
  "vanessa lanza sellani",
];
for (const sheet of oldWorkbook.worksheets.items) {
  const used = sheet.getUsedRange(true);
  const values = used.values;
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const normalizedRow = row.map((cell) => clean(cell).toLowerCase()).join(" | ");
    const matchedName = missingNames.find((name) => normalizedRow.includes(name));
    if (matchedName) {
      oldMatches.push({ matchedName, sheet: sheet.name, row: rowIndex + 1 });
    }
  }
  const preview = await oldWorkbook.render({
    sheetName: sheet.name,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  const safeName = sheet.name.replace(/[^a-z0-9_-]+/gi, "-");
  await fs.writeFile(
    `${outputDir}/old-${safeName}.png`,
    new Uint8Array(await preview.arrayBuffer()),
  );
}

await fs.writeFile(
  `${outputDir}/current-directory.json`,
  JSON.stringify(currentRows, null, 2),
  "utf8",
);
console.log(JSON.stringify({ currentCount: currentRows.length, oldMatches }));
