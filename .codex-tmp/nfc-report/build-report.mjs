import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const data = JSON.parse(await fs.readFile(".codex-tmp/nfc-report/data.json", "utf8"));
const outputDir =
  "outputs/019febc6-9ec3-7242-af32-d11b291b62cd";
const outputPath = `${outputDir}/relatorio-gravacao-nfc-2026-08-10.xlsx`;
const previewDir = ".codex-tmp/nfc-report/previews";

const workbook = Workbook.create();
const summarySheet = workbook.worksheets.add("Resumo");
const tagsSheet = workbook.worksheets.add("Tags NFC");
const missingSheet = workbook.worksheets.add("Sem cartão");

const COLORS = {
  navy: "#082B3A",
  teal: "#347796",
  paleTeal: "#EAF4F6",
  paleGreen: "#E8F5EE",
  green: "#18794E",
  paleAmber: "#FFF4DB",
  amber: "#9A6700",
  paleRed: "#FDECEC",
  red: "#B42318",
  paleGray: "#F4F7F8",
  gray: "#5D6B73",
  border: "#D6E2E6",
  white: "#FFFFFF",
};

const parseLocalDateTime = (iso) => {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  ));
};

const formatStatus = (status) =>
  ({
    active: "Ativo",
    pending: "Pendente",
    inactive: "Inativo",
    published: "Publicado",
    draft: "Rascunho",
  })[status] || status;

for (const sheet of [summarySheet, tagsSheet, missingSheet]) {
  sheet.showGridLines = false;
}

// Tags NFC
tagsSheet.getRange("A1:L1").merge();
tagsSheet.getRange("A1").values = [["RELATÓRIO DE GRAVAÇÃO — TAGS NFC"]];
tagsSheet.getRange("A1:L1").format = {
  fill: COLORS.navy,
  font: { bold: true, color: COLORS.white, size: 16 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
};
tagsSheet.getRange("A1:L1").format.rowHeight = 32;

tagsSheet.getRange("A2:L2").merge();
tagsSheet.getRange("A2").values = [[
  "Copie o link permanente da coluna F para gravar na etiqueta. Registros físicos de 09/08/2026 estão destacados em verde.",
]];
tagsSheet.getRange("A2:L2").format = {
  fill: COLORS.paleTeal,
  font: { color: COLORS.navy, size: 10 },
  wrapText: true,
  verticalAlignment: "center",
};
tagsSheet.getRange("A2:L2").format.rowHeight = 34;

tagsSheet.getRange("A3:L3").merge();
tagsSheet.getRange("A3").values = [[
  `Total válido: ${data.summary.validTags}  •  Gravadas ontem: ${data.summary.doneYesterday}  •  Pendentes físicas: ${data.summary.pendingPhysical}`,
]];
tagsSheet.getRange("A3:L3").format = {
  font: { bold: true, color: COLORS.teal, size: 11 },
  verticalAlignment: "center",
};
tagsSheet.getRange("A3:L3").format.rowHeight = 24;

const tagHeaders = [
  "Ordem",
  "Colaborador",
  "Área",
  "Código tag",
  "Código cartão",
  "Link permanente para gravar",
  "Status tag",
  "Status cartão",
  "Física gravada?",
  "Feita ontem?",
  "Data/hora física",
  "Próxima ação",
];
tagsSheet.getRange("A6:L6").values = [tagHeaders];

const tagRows = data.cards.map((row, index) => [
  index + 1,
  row.collaborator,
  row.practiceArea,
  row.tagCode,
  row.cardCode,
  row.nfcUrl,
  formatStatus(row.tagStatus),
  formatStatus(row.cardStatus),
  row.physicallyRecorded ? "SIM" : "NÃO",
  row.doneYesterday ? "SIM" : "NÃO",
  parseLocalDateTime(row.physicallyRecordedAt),
  row.physicallyRecorded ? "Conferir leitura da NFC" : "Gravar etiqueta NFC",
]);
const tagEndRow = 6 + tagRows.length;
if (tagRows.length) {
  tagsSheet.getRange(`A7:L${tagEndRow}`).values = tagRows;
  tagsSheet.getRange(`K7:K${tagEndRow}`).format.numberFormat = "dd/mm/yyyy hh:mm";
}

tagsSheet.getRange(`A6:L${tagEndRow}`).format.font = {
  name: "Aptos",
  size: 10,
  color: COLORS.navy,
};
tagsSheet.getRange("A6:L6").format = {
  fill: COLORS.teal,
  font: { bold: true, color: COLORS.white, size: 10 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "outside", style: "thin", color: COLORS.teal },
};
tagsSheet.getRange("A6:L6").format.rowHeight = 34;
tagsSheet.getRange(`A7:L${tagEndRow}`).format.borders = {
  insideHorizontal: { style: "thin", color: COLORS.border },
  bottom: { style: "thin", color: COLORS.border },
};
tagsSheet.getRange(`A7:L${tagEndRow}`).format.verticalAlignment = "center";
tagsSheet.getRange(`A7:A${tagEndRow}`).format.horizontalAlignment = "center";
tagsSheet.getRange(`D7:E${tagEndRow}`).format.horizontalAlignment = "center";
tagsSheet.getRange(`G7:K${tagEndRow}`).format.horizontalAlignment = "center";
tagsSheet.getRange(`F7:F${tagEndRow}`).format = {
  font: { color: COLORS.teal, size: 9 },
  wrapText: true,
  verticalAlignment: "center",
};
tagsSheet.getRange(`C7:C${tagEndRow}`).format.wrapText = true;
tagsSheet.getRange(`L7:L${tagEndRow}`).format.wrapText = true;
tagsSheet.getRange(`A7:L${tagEndRow}`).format.rowHeight = 38;

tagsSheet.getRange(`I7:I${tagEndRow}`).conditionalFormats.add("containsText", {
  text: "SIM",
  format: { fill: COLORS.paleGreen, font: { bold: true, color: COLORS.green } },
});
tagsSheet.getRange(`I7:I${tagEndRow}`).conditionalFormats.add("containsText", {
  text: "NÃO",
  format: { fill: COLORS.paleAmber, font: { bold: true, color: COLORS.amber } },
});
tagsSheet.getRange(`J7:J${tagEndRow}`).conditionalFormats.add("containsText", {
  text: "SIM",
  format: { fill: COLORS.paleGreen, font: { bold: true, color: COLORS.green } },
});
tagsSheet.getRange(`L7:L${tagEndRow}`).conditionalFormats.add("containsText", {
  text: "Gravar etiqueta NFC",
  format: { fill: COLORS.paleAmber, font: { bold: true, color: COLORS.amber } },
});

tagsSheet.tables.add(`A6:L${tagEndRow}`, true, "TagsNfcTable").style = "TableStyleMedium2";
tagsSheet.freezePanes.freezeRows(6);
tagsSheet.getRange("A:A").format.columnWidth = 8;
tagsSheet.getRange("B:B").format.columnWidth = 29;
tagsSheet.getRange("C:C").format.columnWidth = 25;
tagsSheet.getRange("D:E").format.columnWidth = 14;
tagsSheet.getRange("F:F").format.columnWidth = 52;
tagsSheet.getRange("G:J").format.columnWidth = 15;
tagsSheet.getRange("K:K").format.columnWidth = 20;
tagsSheet.getRange("L:L").format.columnWidth = 24;

// Sem cartão
missingSheet.getRange("A1:F1").merge();
missingSheet.getRange("A1").values = [["PERFIS PUBLICADOS SEM CARTÃO NFC"]];
missingSheet.getRange("A1:F1").format = {
  fill: COLORS.navy,
  font: { bold: true, color: COLORS.white, size: 16 },
  verticalAlignment: "center",
};
missingSheet.getRange("A1:F1").format.rowHeight = 32;
missingSheet.getRange("A2:F2").merge();
missingSheet.getRange("A2").values = [[
  "Estes perfis estão publicados, mas ainda precisam de cartão/tag antes de receber um link NFC permanente.",
]];
missingSheet.getRange("A2:F2").format = {
  fill: COLORS.paleAmber,
  font: { color: COLORS.amber, size: 10 },
  wrapText: true,
  verticalAlignment: "center",
};
missingSheet.getRange("A2:F2").format.rowHeight = 32;

const missingHeaders = [
  "Colaborador",
  "Cargo",
  "Área",
  "Perfil público",
  "Situação",
  "Próximo passo",
];
missingSheet.getRange("A5:F5").values = [missingHeaders];
const missingRows = data.missingCards.map((row) => [
  row.collaborator,
  row.role,
  row.practiceArea,
  row.profileUrl,
  row.situation,
  row.nextStep,
]);
const missingEndRow = 5 + missingRows.length;
if (missingRows.length) {
  missingSheet.getRange(`A6:F${missingEndRow}`).values = missingRows;
}
missingSheet.getRange("A5:F5").format = {
  fill: COLORS.teal,
  font: { bold: true, color: COLORS.white, size: 10 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
};
missingSheet.getRange(`A6:F${missingEndRow}`).format = {
  font: { name: "Aptos", size: 10, color: COLORS.navy },
  verticalAlignment: "center",
  wrapText: true,
  borders: {
    insideHorizontal: { style: "thin", color: COLORS.border },
    bottom: { style: "thin", color: COLORS.border },
  },
};
missingSheet.getRange(`D6:D${missingEndRow}`).format.font = {
  color: COLORS.teal,
  size: 9,
};
missingSheet.getRange(`A6:F${missingEndRow}`).format.rowHeight = 36;
missingSheet.tables.add(`A5:F${missingEndRow}`, true, "MissingCardsTable").style =
  "TableStyleMedium2";
missingSheet.freezePanes.freezeRows(5);
missingSheet.getRange("A:A").format.columnWidth = 30;
missingSheet.getRange("B:B").format.columnWidth = 25;
missingSheet.getRange("C:C").format.columnWidth = 25;
missingSheet.getRange("D:D").format.columnWidth = 48;
missingSheet.getRange("E:E").format.columnWidth = 32;
missingSheet.getRange("F:F").format.columnWidth = 38;

// Resumo
summarySheet.getRange("A1:H2").merge();
summarySheet.getRange("A1").values = [["CONTROLE DE PRODUÇÃO — NFC DIA DO ADVOGADO"]];
summarySheet.getRange("A1:H2").format = {
  fill: COLORS.navy,
  font: { bold: true, color: COLORS.white, size: 18 },
  verticalAlignment: "center",
  horizontalAlignment: "left",
};
summarySheet.getRange("A1:H2").format.rowHeight = 28;
summarySheet.getRange("A3:H3").merge();
summarySheet.getRange("A3").values = [[
  "Base de controle extraída em 10/08/2026 • Horário de referência: America/Sao_Paulo",
]];
summarySheet.getRange("A3:H3").format = {
  fill: COLORS.paleTeal,
  font: { color: COLORS.navy, size: 10 },
  verticalAlignment: "center",
};

const tagFirstRow = 7;
const tagLastRow = tagEndRow;
const missingFirstRow = 6;
const missingLastRow = missingEndRow;

const kpis = [
  { range: "A5:B8", label: "TAGS VÁLIDAS", formula: `=COUNTA('Tags NFC'!$A$${tagFirstRow}:$A$${tagLastRow})`, fill: COLORS.paleTeal, color: COLORS.teal },
  { range: "C5:D8", label: "GRAVADAS ONTEM", formula: `=COUNTIF('Tags NFC'!$J$${tagFirstRow}:$J$${tagLastRow},\"SIM\")`, fill: COLORS.paleGreen, color: COLORS.green },
  { range: "E5:F8", label: "PENDENTES FÍSICAS", formula: `=COUNTIF('Tags NFC'!$I$${tagFirstRow}:$I$${tagLastRow},\"NÃO\")`, fill: COLORS.paleAmber, color: COLORS.amber },
  { range: "G5:H8", label: "SEM CARTÃO", formula: `=COUNTA('Sem cartão'!$A$${missingFirstRow}:$A$${missingLastRow})`, fill: COLORS.paleRed, color: COLORS.red },
];

for (const [index, kpi] of kpis.entries()) {
  const startCol = ["A", "C", "E", "G"][index];
  const endCol = ["B", "D", "F", "H"][index];
  summarySheet.getRange(`${startCol}5:${endCol}6`).merge();
  summarySheet.getRange(`${startCol}5`).values = [[kpi.label]];
  summarySheet.getRange(`${startCol}5:${endCol}6`).format = {
    fill: kpi.fill,
    font: { bold: true, color: kpi.color, size: 10 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    borders: { preset: "outside", style: "thin", color: COLORS.border },
  };
  summarySheet.getRange(`${startCol}7:${endCol}8`).merge();
  summarySheet.getRange(`${startCol}7`).formulas = [[kpi.formula]];
  summarySheet.getRange(`${startCol}7:${endCol}8`).format = {
    fill: COLORS.white,
    font: { bold: true, color: kpi.color, size: 22 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    numberFormat: "0",
    borders: { preset: "outside", style: "thin", color: COLORS.border },
  };
}

summarySheet.getRange("A10:D10").merge();
summarySheet.getRange("A10").values = [["PENDENTES PARA GRAVAR"]];
summarySheet.getRange("A10:D10").format = {
  fill: COLORS.paleAmber,
  font: { bold: true, color: COLORS.amber, size: 11 },
  verticalAlignment: "center",
};
summarySheet.getRange("A11:D11").values = [["Colaborador", "Código tag", "Código cartão", "Ação"]];
const pendingRows = data.cards
  .filter((row) => !row.physicallyRecorded)
  .map((row) => [row.collaborator, row.tagCode, row.cardCode, "Gravar etiqueta NFC"]);
const pendingEndRow = 11 + Math.max(pendingRows.length, 1);
if (pendingRows.length) summarySheet.getRange(`A12:D${pendingEndRow}`).values = pendingRows;

summarySheet.getRange("E10:H10").merge();
summarySheet.getRange("E10").values = [["PERFIS SEM CARTÃO/TAG"]];
summarySheet.getRange("E10:H10").format = {
  fill: COLORS.paleRed,
  font: { bold: true, color: COLORS.red, size: 11 },
  verticalAlignment: "center",
};
summarySheet.getRange("E11:H11").values = [["Colaborador", "Cargo", "Área", "Ação"]];
const noCardRows = data.missingCards.map((row) => [
  row.collaborator,
  row.role,
  row.practiceArea,
  "Criar cartão NFC",
]);
const noCardEndRow = 11 + Math.max(noCardRows.length, 1);
if (noCardRows.length) summarySheet.getRange(`E12:H${noCardEndRow}`).values = noCardRows;

summarySheet.getRange("A11:H11").format = {
  fill: COLORS.teal,
  font: { bold: true, color: COLORS.white, size: 9 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
};
summarySheet.getRange(`A12:H${Math.max(pendingEndRow, noCardEndRow)}`).format = {
  font: { name: "Aptos", size: 9, color: COLORS.navy },
  wrapText: true,
  verticalAlignment: "center",
  borders: { insideHorizontal: { style: "thin", color: COLORS.border } },
};
summarySheet.getRange("A19:H19").merge();
summarySheet.getRange("A19").values = [[
  `Observação: ${data.invalidHistoricalCardsCount} vínculos antigos com tag excluída/inválida foram desconsiderados. Consulte a aba “Tags NFC” para copiar os links completos.`,
]];
summarySheet.getRange("A19:H19").format = {
  fill: COLORS.paleGray,
  font: { color: COLORS.gray, italic: true, size: 9 },
  wrapText: true,
  verticalAlignment: "center",
};
summarySheet.getRange("A19:H19").format.rowHeight = 30;

summarySheet.getRange("A:H").format.columnWidth = 18;
summarySheet.getRange("A:A").format.columnWidth = 28;
summarySheet.getRange("E:E").format.columnWidth = 28;
summarySheet.getRange("B:D").format.columnWidth = 18;
summarySheet.getRange("F:H").format.columnWidth = 20;
summarySheet.freezePanes.freezeRows(3);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const summaryInspect = await workbook.inspect({
  kind: "table",
  range: "Resumo!A1:H19",
  include: "values,formulas",
  tableMaxRows: 25,
  tableMaxCols: 10,
});
console.log(summaryInspect.ndjson);

const tagsInspect = await workbook.inspect({
  kind: "table",
  range: `Tags NFC!A1:L${tagEndRow}`,
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 12,
});
console.log(tagsInspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

for (const sheetName of ["Resumo", "Tags NFC", "Sem cartão"]) {
  const preview = await workbook.render({
    sheetName,
    autoCrop: "all",
    scale: sheetName === "Tags NFC" ? 0.8 : 1,
    format: "png",
  });
  await fs.writeFile(
    `${previewDir}/${sheetName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`,
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, tagEndRow, missingEndRow }));
