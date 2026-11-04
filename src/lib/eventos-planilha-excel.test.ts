import JSZip from "jszip";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx-js-style";
import type { DetailSheet, NotesSheet, PlanilhaSheet, TableSheet } from "@/lib/eventos-planilha";

vi.mock("server-only", () => ({}));

const { buildPlanejamentoWorkbook } = await import("@/lib/eventos-planilha-excel");

const calendar: TableSheet = {
  kind: "table",
  name: "Calendário 2027",
  title: "Calendário de eventos 2027",
  subtitle: "Gerado em 04/11/2026",
  columns: [
    { header: "Mês", width: 11 },
    { header: "Evento", width: 30 },
    { header: "Data comemorativa", width: 14, format: "date" },
    { header: "Budget 2027", width: 16, format: "money", emphasis: true },
    { header: "No ORQESTRAI", width: 12 },
  ],
  rows: [
    ["Maio", { text: "Dia das Mães", anchor: "m26" }, "2026-05-10", 1662.15, { text: "Abrir", url: "https://www.orqestrai.com.br/eventos/m26" }],
    ["Agosto", "Corrida BP", { text: "Não informado", muted: true }, { text: "Sem base", muted: true }, ""],
  ],
  totalColumns: [3],
  freezeCols: 2,
};

const details: DetailSheet = {
  kind: "details",
  name: "Detalhes por evento",
  title: "Detalhes",
  subtitle: "1 evento",
  blocks: [
    {
      eventId: "m26",
      heading: "Dia das mães · 2026",
      facts: "08/05/2026 · Concluída",
      appUrl: "https://www.orqestrai.com.br/eventos/m26",
      budget: [
        {
          category: "Outros",
          description: "Massagem",
          vendor: "Kalmma Spa",
          quoted: 1425,
          planned: 1425,
          actual: 1425,
          payment: "Pago",
          paidDate: "2026-05-05",
          invoice: { text: "Abrir", url: "https://exemplo.supabase.co/nf.pdf" },
          receipt: null,
          notes: "",
        },
        {
          category: "Outros",
          description: "Cartões",
          vendor: "Gcv",
          quoted: 118,
          planned: null,
          actual: 158,
          payment: "Pago",
          paidDate: null,
          invoice: null,
          receipt: null,
          notes: "",
        },
      ],
      quotes: [],
      suppliers: [
        { category: "Outros", name: "Kalmma Spa", role: "", notes: "", contact: { text: "Site", url: "https://kalmmaspa.com.br/" } },
      ],
      attachments: [],
    },
  ],
};

const notes: NotesSheet = {
  kind: "notes",
  name: "Como ler",
  title: "Como ler",
  subtitle: "",
  rows: [["Budget", "Base com reajuste."]],
};

const sheets: PlanilhaSheet[] = [calendar, details, notes];

describe("buildPlanejamentoWorkbook", () => {
  let book: XLSX.WorkBook;
  let zip: JSZip;

  beforeAll(async () => {
    const data = await buildPlanejamentoWorkbook(sheets);
    book = XLSX.read(new Uint8Array(data), { type: "array", cellStyles: true, cellNF: true });
    zip = await JSZip.loadAsync(data);
  });

  it("gera as abas na ordem do modelo", () => {
    expect(book.SheetNames).toEqual(["Calendário 2027", "Detalhes por evento", "Como ler"]);
  });

  it("liga o nome do evento ao bloco dele na aba de detalhes", () => {
    const cal = book.Sheets["Calendário 2027"]!;
    // Banner em 1-2, cabeçalho na linha 4, dados a partir da 5.
    expect(cal["A4"]?.v).toBe("Mês");
    expect(cal["B5"]?.v).toBe("Dia das Mães");
    expect(cal["B5"]?.l?.Target).toBe("#'Detalhes por evento'!A4");
    expect(cal["E5"]?.l?.Target).toBe("https://www.orqestrai.com.br/eventos/m26");
    // O bloco começa justamente na linha apontada.
    expect(book.Sheets["Detalhes por evento"]!["A4"]?.v).toBe("Dia das mães · 2026");
  });

  it("grava datas e valores como número, com formato brasileiro", () => {
    const cal = book.Sheets["Calendário 2027"]!;
    expect(cal["C5"]?.t).toBe("n");
    expect(cal["C5"]?.w).toBe("10/05/2026");
    expect(cal["D5"]?.v).toBe(1662.15);
    expect(cal["D5"]?.z).toBe('"R$" #,##0.00');
    expect(cal["D6"]?.v).toBe("Sem base");
    // Total por fórmula, logo abaixo dos dados.
    expect(cal["D7"]?.f).toBe("SUM(D5:D6)");
    expect(cal["D7"]?.v).toBe(1662.15);
    expect(cal["B7"]?.v).toBe("Total");
  });

  it("soma o orçamento de cada evento e mantém os links dos arquivos", () => {
    const det = book.Sheets["Detalhes por evento"]!;
    const cells = Object.entries(det).filter(([key]) => !key.startsWith("!"));
    const total = cells.find(([, cell]) => (cell as XLSX.CellObject).v === "Total do orçamento");
    expect(total).toBeDefined();
    const totalRow = Number(total![0].replace(/\D/g, ""));
    expect(det[`F${totalRow}`]?.f).toBe(`SUM(F${totalRow - 2}:F${totalRow - 1})`);
    expect(det[`F${totalRow}`]?.v).toBe(1583);

    const links = cells.map(([, cell]) => (cell as XLSX.CellObject).l?.Target).filter(Boolean);
    expect(links).toContain("https://exemplo.supabase.co/nf.pdf");
    expect(links).toContain("https://kalmmaspa.com.br/");
    expect(links).toContain("#'Calendário 2027'!A1");
  });

  it("congela cabeçalho e nome do evento no calendário", async () => {
    const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(xml).toContain('<pane xSplit="2" ySplit="4" topLeftCell="C5"');
    const notesXml = await zip.file("xl/worksheets/sheet3.xml")!.async("string");
    expect(notesXml).not.toContain("<pane");
  });
});
