import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const data = JSON.parse(
  await fs.readFile(".codex-tmp/nfc-report/direct-profile-links.json", "utf8"),
);
const outputDir = "outputs/019febc6-9ec3-7242-af32-d11b291b62cd";
const outputPath = `${outputDir}/relatorio-links-perfis-nfc-2026-08-10.xlsx`;
const previewPath = ".codex-tmp/nfc-report/previews/links-perfis-nfc.png";

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Links NFC");
sheet.showGridLines = false;

sheet.getRange("A1:C1").values = [["Nome", "Link do perfil", "Física feita?"]];
const rows = data.rows.map((row) => [
  row.name,
  row.profileUrl,
  row.physicalDone ? "SIM" : "NÃO",
]);
const endRow = 1 + rows.length;
sheet.getRange(`A2:C${endRow}`).values = rows;

sheet.getRange("A1:C1").format = {
  fill: "#082B3A",
  font: { bold: true, color: "#FFFFFF", size: 11 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange("A1:C1").format.rowHeight = 30;
sheet.getRange(`A2:C${endRow}`).format = {
  font: { name: "Aptos", size: 10, color: "#082B3A" },
  verticalAlignment: "center",
  borders: {
    insideHorizontal: { style: "thin", color: "#D6E2E6" },
    bottom: { style: "thin", color: "#D6E2E6" },
  },
};
sheet.getRange(`A2:C${endRow}`).format.rowHeight = 26;
sheet.getRange(`B2:B${endRow}`).format = {
  font: { color: "#347796", size: 10 },
  wrapText: false,
  verticalAlignment: "center",
};
sheet.getRange(`C2:C${endRow}`).format.horizontalAlignment = "center";
sheet.getRange(`C2:C${endRow}`).conditionalFormats.add("containsText", {
  text: "SIM",
  format: { fill: "#E8F5EE", font: { bold: true, color: "#18794E" } },
});
sheet.getRange(`C2:C${endRow}`).conditionalFormats.add("containsText", {
  text: "NÃO",
  format: { fill: "#FFF4DB", font: { bold: true, color: "#9A6700" } },
});

sheet.tables.add(`A1:C${endRow}`, true, "ProfileLinksNfcTable").style =
  "TableStyleMedium2";
sheet.freezePanes.freezeRows(1);
sheet.getRange("A:A").format.columnWidth = 34;
sheet.getRange("B:B").format.columnWidth = 76;
sheet.getRange("C:C").format.columnWidth = 18;

const inspect = await workbook.inspect({
  kind: "table",
  range: `Links NFC!A1:C${endRow}`,
  include: "values,formulas",
  tableMaxRows: 50,
  tableMaxCols: 3,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Links NFC",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, rows: rows.length }));
