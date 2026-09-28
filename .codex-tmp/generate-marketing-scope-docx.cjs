const fs = require("fs");
const path = require("path");
const cheerio = require("./docx-tools/node_modules/cheerio");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = require("./docx-tools/node_modules/docx");

const root = path.resolve(__dirname, "..");
const input = path.join(root, "docs", "escopo-sistema-de-marketing-orcamento-2026-09-17.html");
const output = path.join(root, "docs", "Escopo-Sistema-de-Marketing-Orcamento-2026-09-17-ATUALIZADO.docx");
const html = fs.readFileSync(input, "utf8");
const $ = cheerio.load(html);

const COLORS = {
  navy: "102A43",
  blue: "0B6E99",
  lightBlue: "EAF6FB",
  pale: "F5F8FA",
  border: "CFD9E2",
  text: "243B53",
  muted: "627D98",
  white: "FFFFFF",
  amber: "A15C00",
  amberBg: "FFF5D6",
};

const borders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
};

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function plainParagraph(text, options = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? 120, line: 292 },
    alignment: options.alignment,
    indent: options.indent,
    children: [
      new TextRun({
        text: clean(text),
        size: options.size || 20,
        color: options.color || COLORS.text,
        bold: options.bold,
        italics: options.italics,
      }),
    ],
  });
}

function heading(text, level, pageBreakBefore = false) {
  return new Paragraph({
    heading: level === 2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    pageBreakBefore,
    spacing: { before: level === 2 ? 180 : 140, after: level === 2 ? 150 : 90 },
    keepNext: true,
    children: [
      new TextRun({
        text: clean(text),
        bold: true,
        color: level === 2 ? COLORS.navy : COLORS.blue,
        size: level === 2 ? 30 : 23,
      }),
    ],
  });
}

function makeList($list) {
  const ordered = $list.is("ol");
  const reqList = $list.hasClass("req-list");
  const checklist = $list.hasClass("checklist");
  const paragraphs = [];

  $list.children("li").each((_, li) => {
    const $li = $(li);
    const reqId = clean($li.find(".req-id").first().text());
    const priority = clean($li.find(".priority").first().text());
    let text = clean($li.text());
    if (reqId) text = clean(text.replace(reqId, ""));
    if (priority) text = clean(text.replace(priority, ""));

    const children = [];
    if (reqId) {
      children.push(new TextRun({ text: `${reqId}  `, bold: true, color: COLORS.blue, size: 18 }));
    } else if (priority) {
      children.push(new TextRun({ text: `${priority.toUpperCase()}  `, bold: true, color: COLORS.amber, size: 18 }));
    } else if (checklist) {
      children.push(new TextRun({ text: "☐  ", bold: true, color: COLORS.blue, size: 20 }));
    }
    children.push(new TextRun({ text, color: COLORS.text, size: 19 }));

    paragraphs.push(new Paragraph({
      numbering: ordered ? { reference: "ordered-list", level: 0 } : undefined,
      bullet: !ordered && !reqId && !priority && !checklist ? { level: 0 } : undefined,
      indent: reqId || priority || checklist ? { left: 260, hanging: 0 } : undefined,
      spacing: { after: reqList ? 85 : 70, line: 270 },
      keepNext: false,
      children,
    }));
  });

  return paragraphs;
}

function makeHtmlTable($table) {
  const rows = [];
  $table.find("tr").each((rowIndex, tr) => {
    const cells = [];
    $(tr).children("th,td").each((_, cell) => {
      const isHeader = $(cell).is("th");
      cells.push(new TableCell({
        shading: isHeader
          ? { fill: COLORS.navy, type: ShadingType.CLEAR, color: "auto" }
          : rowIndex % 2 === 0
            ? { fill: COLORS.pale, type: ShadingType.CLEAR, color: "auto" }
            : undefined,
        margins: { top: 90, bottom: 90, left: 100, right: 100 },
        children: [
          new Paragraph({
            spacing: { after: 0, line: 250 },
            children: [
              new TextRun({
                text: clean($(cell).text()),
                bold: isHeader,
                color: isHeader ? COLORS.white : COLORS.text,
                size: 17,
              }),
            ],
          }),
        ],
      }));
    });
    if (cells.length) rows.push(new TableRow({ children: cells, tableHeader: rowIndex === 0 }));
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows,
  });
}

function makeCallout($element) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: COLORS.blue },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.blue },
      left: { style: BorderStyle.SINGLE, size: 8, color: COLORS.blue },
      right: { style: BorderStyle.SINGLE, size: 8, color: COLORS.blue },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: COLORS.lightBlue, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 130, bottom: 130, left: 160, right: 160 },
            children: [plainParagraph($element.text(), { after: 0, size: 19 })],
          }),
        ],
      }),
    ],
  });
}

function makeScopeGrid($grid) {
  const cells = [];
  $grid.children(".scope-card").each((_, card) => {
    const $card = $(card);
    cells.push(new TableCell({
      shading: { fill: COLORS.pale, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      children: [
        plainParagraph($card.find("strong").first().text(), { bold: true, color: COLORS.blue, after: 60, size: 19 }),
        plainParagraph($card.find("p").first().text(), { after: 0, size: 18 }),
      ],
    }));
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: [new TableRow({ children: cells })],
  });
}

function makeSignature($signature) {
  const cells = [];
  $signature.children("div").each((_, item) => {
    cells.push(new TableCell({
      borders: {
        top: { style: BorderStyle.SINGLE, size: 7, color: COLORS.muted },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      },
      margins: { top: 80, bottom: 0, left: 0, right: 120 },
      children: [plainParagraph($(item).text(), { color: COLORS.muted, size: 17, after: 0 })],
    }));
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: cells })],
  });
}

function blocksFrom($container, pageBreakOnHeading = false) {
  const blocks = [];
  let firstHeading = true;

  $container.children().each((_, node) => {
    const $node = $(node);
    const tag = node.tagName?.toLowerCase();

    if (tag === "h2" || tag === "h3") {
      blocks.push(heading($node.text(), tag === "h2" ? 2 : 3, tag === "h2" && pageBreakOnHeading && firstHeading));
      firstHeading = false;
    } else if (tag === "p") {
      blocks.push(plainParagraph($node.text(), {
        size: $node.hasClass("lead") ? 22 : $node.hasClass("small") || $node.hasClass("footer-note") ? 17 : 20,
        color: $node.hasClass("small") || $node.hasClass("footer-note") ? COLORS.muted : COLORS.text,
        italics: $node.hasClass("small"),
        after: $node.hasClass("footer-note") ? 0 : 120,
      }));
    } else if (tag === "ul" || tag === "ol") {
      blocks.push(...makeList($node));
    } else if (tag === "table") {
      blocks.push(makeHtmlTable($node));
      blocks.push(new Paragraph({ spacing: { after: 70 } }));
    } else if (tag === "div" && $node.hasClass("callout")) {
      blocks.push(makeCallout($node));
      blocks.push(new Paragraph({ spacing: { after: 70 } }));
    } else if (tag === "div" && $node.hasClass("scope-grid")) {
      blocks.push(makeScopeGrid($node));
      blocks.push(new Paragraph({ spacing: { after: 70 } }));
    } else if (tag === "div" && $node.hasClass("signature")) {
      blocks.push(new Paragraph({ spacing: { before: 420, after: 0 } }));
      blocks.push(makeSignature($node));
    } else if (tag === "div") {
      blocks.push(...blocksFrom($node, false));
    }
  });

  return blocks;
}

const cover = $(".cover");
const coverMetaRows = [];
cover.find(".cover-meta > div").each((_, item) => {
  const $item = $(item);
  const label = clean($item.find("strong").text());
  const value = clean($item.clone().find("strong").remove().end().text());
  coverMetaRows.push(new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { fill: COLORS.navy, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 110, bottom: 110, left: 130, right: 130 },
        children: [plainParagraph(label, { bold: true, color: COLORS.white, after: 0, size: 18 })],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        margins: { top: 110, bottom: 110, left: 130, right: 130 },
        children: [plainParagraph(value, { after: 0, size: 18 })],
      }),
    ],
  }));
});

const children = [
  new Paragraph({
    spacing: { before: 820, after: 90 },
    children: [new TextRun({ text: "SISTEMA DE MARKETING", bold: true, color: COLORS.blue, size: 22, characterSpacing: 70 })],
  }),
  new Paragraph({
    spacing: { after: 360 },
    children: [new TextRun({ text: clean(cover.find(".eyebrow").text()).toUpperCase(), color: COLORS.muted, size: 17, characterSpacing: 55 })],
  }),
  new Paragraph({
    spacing: { after: 190, line: 520 },
    children: [new TextRun({ text: clean(cover.find("h1").text()), bold: true, color: COLORS.navy, size: 48 })],
  }),
  plainParagraph(cover.find(".subtitle").text(), { size: 24, color: COLORS.muted, after: 760 }),
  new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: coverMetaRows }),
  new Paragraph({ children: [new PageBreak()] }),
];

$("main > section").each((sectionIndex, section) => {
  children.push(...blocksFrom($(section), sectionIndex > 0));
});

const doc = new Document({
  creator: "Sistema de Marketing",
  title: "Sistema de Marketing — Escopo inicial para conversa e orçamento",
  subject: "Documento de apoio para reunião de orçamento",
  description: "Escopo funcional inicial dos módulos prioritários do Sistema de Marketing.",
  numbering: {
    config: [{
      reference: "ordered-list",
      levels: [{
        level: 0,
        format: LevelFormat.DECIMAL,
        text: "%1.",
        alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 430, hanging: 250 } } },
      }],
    }],
  },
  styles: {
    default: {
      document: {
        run: { font: "Aptos", size: 20, color: COLORS.text },
        paragraph: { spacing: { line: 280 } },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 5, color: COLORS.border, space: 6 } },
            children: [new TextRun({ text: "SISTEMA DE MARKETING  •  ESCOPO PARA ORÇAMENTO", color: COLORS.muted, size: 15, characterSpacing: 25 })],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "Confidencial  •  17/09/2026  •  ", color: COLORS.muted, size: 15 }),
              new TextRun({ children: [PageNumber.CURRENT], color: COLORS.muted, size: 15 }),
            ],
          }),
        ],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc)
  .then((buffer) => {
    fs.writeFileSync(output, buffer);
    console.log(output);
    console.log(`${buffer.length} bytes`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
