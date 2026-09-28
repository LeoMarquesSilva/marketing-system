import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/Leonardo Marques/Downloads/Lista de Colaboradores.xlsx";
const outputDir = "C:/bkp/doc/marketing-system/.codex-tmp/lista-colaboradores-audit/output";

await fs.mkdir(outputDir, { recursive: true });
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
});
console.log("SHEETS");
console.log(summary.ndjson);

for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange(true);
  const address = used?.address ?? "A1:A1";
  const inspected = await workbook.inspect({
    kind: "table",
    range: `${sheet.name}!${address.split("!").at(-1)}`,
    include: "values,formulas",
    tableMaxRows: 120,
    tableMaxCols: 30,
  });
  console.log(`SHEET ${sheet.name} RANGE ${address}`);
  console.log(inspected.ndjson);

  const preview = await workbook.render({
    sheetName: sheet.name,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  const safeName = sheet.name.replace(/[^a-z0-9_-]+/gi, "-");
  await fs.writeFile(
    `${outputDir}/${safeName}.png`,
    new Uint8Array(await preview.arrayBuffer()),
  );
}
