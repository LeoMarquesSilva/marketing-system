import { describe, expect, it } from "vitest";
import type { EventsForecast, ForecastEdition, SeriesForecastRow, SeriesYearStats } from "@/lib/eventos";
import {
  APP_BASE_URL,
  buildPlanejamentoSheets,
  NAO_INFORMADO,
  normalizeUrl,
  type DetailSheet,
  type NotesSheet,
  type PlanejamentoDetails,
  type TableSheet,
} from "@/lib/eventos-planilha";

function edition(partial: Partial<ForecastEdition> & Pick<ForecastEdition, "eventId" | "year" | "name">): ForecastEdition {
  return {
    kind: "evento",
    seriesId: null,
    seriesName: null,
    eventType: null,
    monthLabel: null,
    commemorativeDate: null,
    eventDate: null,
    endDate: null,
    status: "concluida",
    budgetApproved: null,
    plannedTotal: 0,
    actualTotal: 0,
    ...partial,
  };
}

function stats(e: ForecastEdition): SeriesYearStats {
  return {
    year: e.year,
    eventId: e.eventId,
    eventName: e.name,
    status: e.status,
    budgetApproved: e.budgetApproved,
    plannedTotal: e.plannedTotal,
    actualTotal: e.actualTotal,
    participantsActual: null,
    participantsExpected: null,
  };
}

function seriesRow(partial: Partial<SeriesForecastRow> & Pick<SeriesForecastRow, "seriesId" | "seriesName">): SeriesForecastRow {
  return {
    kind: "evento",
    byYear: {},
    baseYear: null,
    baseValue: null,
    baseSource: null,
    costPerParticipant: null,
    targetEventId: null,
    ...partial,
  };
}

const maes25 = edition({
  eventId: "m25",
  year: 2025,
  name: "Dia das mães",
  seriesId: "maes",
  seriesName: "Dia das Mães",
  eventType: "comemorativo",
  commemorativeDate: "2025-05-11",
});
const maes26 = edition({
  eventId: "m26",
  year: 2026,
  name: "Dia das mães",
  seriesId: "maes",
  seriesName: "Dia das Mães",
  commemorativeDate: "2026-05-10",
  eventDate: "2026-05-08",
  budgetApproved: 842,
  plannedTotal: 1543,
  actualTotal: 1583,
});
const festa26 = edition({
  eventId: "f26",
  year: 2026,
  name: "Aniversário Escritório 10 anos",
  seriesId: "aniv",
  seriesName: "Aniversário do Escritório",
  eventType: "Confraternização",
  commemorativeDate: "2026-03-15",
  eventDate: "2026-12-17",
  endDate: "2026-12-18",
  status: "em_andamento",
  plannedTotal: 238968.65,
});
const corrida26 = edition({
  eventId: "c26",
  year: 2026,
  name: "Corrida BP",
  seriesId: "corrida",
  seriesName: "Corrida BP",
  status: "nao_iniciada",
});
const corrida27 = edition({
  eventId: "c27",
  year: 2027,
  name: "Corrida BP",
  seriesId: "corrida",
  seriesName: "Corrida BP",
  status: "nao_iniciada",
  eventDate: "2027-08-22",
});
const tma = edition({
  eventId: "t26",
  year: 2026,
  name: "XVII Congresso TMA Brasil 2026",
  eventType: "Externo",
  eventDate: "2026-11-03",
  actualTotal: 21021.73,
});
const innovation25 = edition({
  eventId: "i25",
  year: 2025,
  name: "Innovation Day 2° Edição",
  seriesId: "innovation",
  seriesName: "Innovation Day",
  status: "cancelada",
  monthLabel: "Setembro",
});

const forecast: EventsForecast = {
  targetYear: 2027,
  historyYears: [2025, 2026],
  unlinkedCount: 1,
  editions: [maes25, maes26, festa26, corrida26, corrida27, tma, innovation25],
  rows: [
    seriesRow({
      seriesId: "aniv",
      seriesName: "Aniversário do Escritório",
      byYear: { 2026: stats(festa26) },
      baseYear: 2026,
      baseValue: 238968.65,
      baseSource: "previsto",
    }),
    seriesRow({
      seriesId: "maes",
      seriesName: "Dia das Mães",
      byYear: { 2025: stats(maes25), 2026: stats(maes26) },
      baseYear: 2026,
      baseValue: 1583,
      baseSource: "realizado",
    }),
    seriesRow({
      seriesId: "corrida",
      seriesName: "Corrida BP",
      byYear: { 2026: stats(corrida26) },
      targetEventId: "c27",
    }),
  ],
};

const details: PlanejamentoDetails = {
  budgetItems: [
    {
      eventId: "m26",
      category: "outros",
      description: "Impressão dos cartões",
      vendorName: "Gcv Papelaria",
      amountQuoted: 118,
      amountPlanned: null,
      amountActual: 158,
      paymentStatus: "pago",
      paymentPaidDate: "2026-05-05",
      invoiceLink: "https://exemplo.supabase.co/storage/v1/object/public/nf.pdf",
      receiptLink: null,
      notes: null,
      sortOrder: 2,
    },
    {
      eventId: "m26",
      category: "outros",
      description: "Massagem 90 min",
      vendorName: "Kalmma Spa",
      amountQuoted: 1425,
      amountPlanned: 1425,
      amountActual: 1425,
      paymentStatus: "pago",
      paymentPaidDate: null,
      invoiceLink: "texto que não é link",
      receiptLink: "kalmmaspa.com.br/recibo",
      notes: "Day-off junto",
      sortOrder: 1,
    },
    {
      eventId: "t26",
      category: "brindes",
      description: "Brindes do estande",
      vendorName: null,
      amountQuoted: null,
      amountPlanned: null,
      amountActual: 21021.73,
      paymentStatus: null,
      paymentPaidDate: null,
      invoiceLink: null,
      receiptLink: null,
      notes: null,
      sortOrder: 1,
    },
  ],
  quotes: [
    {
      eventId: "f26",
      supplierName: "M. Tetti Eventos",
      scope: "Produção — Plano B",
      includedItems: "Fazenda, buffet e som",
      quotedValue: 224940.65,
      finalValue: 224940.65,
      proposalStatus: "aprovada",
      fileLink: "https://exemplo.supabase.co/proposta.pdf",
      decisionReason: "Aceita pelo organizador",
    },
  ],
  suppliers: [
    {
      id: "s-kalmma",
      name: "Kalmma Spa",
      category: "outros",
      websiteLink: null,
      instagramLink: null,
      whatsappLink: "wa.me//5519983541053",
      portfolioLink: null,
    },
    {
      id: "s-kalmma-2",
      name: "KALMMA SPA ",
      category: "brindes",
      websiteLink: null,
      instagramLink: null,
      whatsappLink: null,
      portfolioLink: null,
    },
    {
      id: "s-tetti",
      name: "M. Tetti Eventos",
      category: "catering",
      websiteLink: "https://mtetti.com.br",
      instagramLink: null,
      whatsappLink: null,
      portfolioLink: null,
    },
  ],
  supplierUses: [
    { eventId: "m26", supplierId: "s-kalmma", roleLabel: "Massagem", notes: null },
    { eventId: "m26", supplierId: "s-kalmma", roleLabel: "Massagem", notes: "Reservar com antecedência" },
    { eventId: "f26", supplierId: "s-tetti", roleLabel: "Produção", notes: null },
    { eventId: "m25", supplierId: "s-kalmma", roleLabel: null, notes: null },
    // Mesmo fornecedor cadastrado de novo, com outra grafia e categoria.
    { eventId: "m26", supplierId: "s-kalmma-2", roleLabel: null, notes: null },
  ],
  attachments: [
    { eventId: "m26", title: "Orçamento Dia das Mães", fileType: "arquivo_geral", url: "https://exemplo.supabase.co/orc.pdf", isPublic: true },
    { eventId: "f26", title: "Contrato M. Tetti", fileType: "contrato", url: "https://exemplo.supabase.co/contrato.docx", isPublic: false },
  ],
};

const sheets = buildPlanejamentoSheets(forecast, details, 0.05, new Date("2026-11-04T17:30:00Z"));
const calendar = sheets[0] as TableSheet;
const detail = sheets[1] as DetailSheet;
const history = sheets[2] as TableSheet;
const suppliers = sheets[3] as TableSheet;
const notes = sheets[4] as NotesSheet;

describe("buildPlanejamentoSheets", () => {
  it("monta as cinco abas na ordem de leitura", () => {
    expect(sheets.map((s) => s.name)).toEqual([
      "Calendário 2027",
      "Detalhes por evento",
      "Eventos por ano",
      "Fornecedores",
      "Como ler",
    ]);
    expect(calendar.subtitle).toContain("04/11/2026 às 14:30");
    expect(calendar.subtitle).toContain("reajuste de 5%");
  });

  it("põe o calendário em ordem de mês, com o evento levando ao bloco de detalhes", () => {
    expect(calendar.columns.map((c) => c.header)).toEqual([
      "Mês",
      "Evento",
      "Categoria",
      "Tipo de evento",
      "Data comemorativa (última registrada)",
      "Verba aprovada 2026",
      "Previsto 2026",
      "Realizado 2026",
      "Base da projeção",
      "Budget 2027 (reajuste de 5%)",
      "Edição 2027",
      "Fornecedores, orçamentos e arquivos",
      "No ORQESTRAI",
    ]);

    const [maes, corrida, aniversario] = calendar.rows;
    expect(maes).toEqual([
      "Maio",
      { text: "Dia das Mães", anchor: "m26" },
      "Evento",
      // 2026 não tem tipo: vale o de 2025, com a grafia do cadastro.
      "Comemorativo",
      "2026-05-10",
      842,
      1543,
      1583,
      { text: "Realizado 2026", tone: "realizado" },
      1662.15,
      { text: "Não aberta", muted: true },
      { text: "2 itens · 1 fornecedor · 1 arquivo", anchor: "m26" },
      { text: "Abrir", url: `${APP_BASE_URL}/eventos/m26` },
    ]);

    // Sem nada lançado: nome sem link, campos vazios marcados e a edição de 2027 já aberta.
    expect(corrida![1]).toBe("Corrida BP");
    expect(corrida![3]).toEqual({ text: NAO_INFORMADO, muted: true });
    expect(corrida![9]).toEqual({ text: "Sem base", muted: true });
    expect(corrida![10]).toBe("Aberta, 22/08/2027");
    expect(corrida![11]).toEqual({ text: "Nada lançado", muted: true });
    expect(corrida![12]).toEqual({ text: "Abrir", url: `${APP_BASE_URL}/eventos/c27` });

    // Mês é o da data do evento (dezembro), não o da data comemorativa.
    expect(aniversario![0]).toBe("Dezembro");
    expect(aniversario![9]).toBe(250917.08);
    expect(aniversario![11]).toEqual({ text: "1 proposta · 1 fornecedor · 1 arquivo", anchor: "f26" });

    expect(calendar.totalColumns).toEqual([5, 6, 7, 9]);
  });

  it("monta um bloco por evento com lançamento, com os links prontos para clicar", () => {
    // 2025 só tem o fornecedor ligado, e isso já basta para ter bloco.
    expect(detail.blocks.map((b) => b.eventId)).toEqual(["m25", "m26", "t26", "f26"]);
    expect(detail.blocks[0]!.budget).toEqual([]);
    expect(detail.blocks[0]!.facts).toContain("Data não informada");

    const maes = detail.blocks[1]!;
    expect(maes.heading).toBe("Dia das mães · 2026");
    expect(maes.facts).toContain("08/05/2026");
    expect(maes.facts).toContain("Realizado R$");

    // Itens na ordem do cadastro; link inválido some, domínio sem https é completado.
    expect(maes.budget.map((b) => b.description)).toEqual(["Massagem 90 min", "Impressão dos cartões"]);
    expect(maes.budget[0]!.invoice).toBeNull();
    expect(maes.budget[0]!.receipt).toEqual({ text: "Abrir", url: "https://kalmmaspa.com.br/recibo" });
    expect(maes.budget[1]!.invoice).toEqual({
      text: "Abrir",
      url: "https://exemplo.supabase.co/storage/v1/object/public/nf.pdf",
    });
    expect(maes.budget[1]!.planned).toBeNull();
    expect(maes.budget[1]!.paidDate).toBe("2026-05-05");
    expect(maes.budget[1]!.payment).toBe("Pago");

    // O mesmo fornecedor ligado duas vezes, ou cadastrado em dobro, vira uma linha só.
    expect(maes.suppliers).toEqual([
      {
        category: "Outros; Brindes",
        name: "Kalmma Spa",
        role: "Massagem",
        notes: "Reservar com antecedência",
        contact: { text: "WhatsApp", url: "https://wa.me/5519983541053" },
      },
    ]);

    const festa = detail.blocks[3]!;
    expect(festa.facts).toContain("17/12/2026 a 18/12/2026");
    expect(festa.quotes[0]).toMatchObject({
      status: "Aprovada",
      scope: "Produção — Plano B",
      included: "Fazenda, buffet e som",
      supplier: "M. Tetti Eventos",
      final: 224940.65,
      file: { text: "Abrir proposta", url: "https://exemplo.supabase.co/proposta.pdf" },
    });
    // Arquivo restrito abre pelo sistema, não pelo link direto do storage.
    expect(festa.attachments[0]!.link).toEqual({
      text: "Abrir no ORQESTRAI (restrito)",
      url: `${APP_BASE_URL}/eventos/f26`,
    });
  });

  it("lista todas as edições no histórico, inclusive avulsas e canceladas", () => {
    const names = history.rows.map((r) => `${r[0]} ${typeof r[1] === "string" ? r[1] : (r[1] as { text: string }).text}`);
    expect(names).toEqual([
      "2025 Dia das mães",
      "2025 Innovation Day 2° Edição",
      "2026 Dia das mães",
      "2026 XVII Congresso TMA Brasil 2026",
      "2026 Aniversário Escritório 10 anos",
      // Sem data nem mês: fim do ano.
      "2026 Corrida BP",
      "2027 Corrida BP",
    ]);

    const tmaRow = history.rows[3]!;
    expect(tmaRow[1]).toEqual({ text: tma.name, anchor: "t26" });
    expect(tmaRow[3]).toEqual({ text: "Avulso (fora da previsão)", muted: true });
    expect(tmaRow[8]).toBe("");
    expect(tmaRow[12]).toBe(21021.73);

    const innovationRow = history.rows[1]!;
    expect(innovationRow[9]).toEqual({ text: "Cancelada", muted: true });
    expect(innovationRow[10]).toEqual({ text: NAO_INFORMADO, muted: true });
  });

  it("junta os fornecedores, dos mais recorrentes para os menos", () => {
    expect(suppliers.rows).toEqual([
      [
        "Kalmma Spa",
        "Outros; Brindes",
        2,
        "Dia das mães (2025)\nDia das mães (2026)",
        "Massagem",
        { text: "WhatsApp", url: "https://wa.me/5519983541053" },
      ],
      ["M. Tetti Eventos", "Catering", 1, "Aniversário Escritório 10 anos (2026)", "Produção", { text: "Site", url: "https://mtetti.com.br/" }],
    ]);
  });

  it("explica os avulsos e o reajuste na aba de leitura", () => {
    const text = notes.rows.map((r) => r.join(" ")).join("\n");
    expect(text).toContain("Reajuste aplicado 5%");
    expect(text).toContain("XVII Congresso TMA Brasil 2026 (2026)");
  });

  it("não repete o ano quando o nome do evento já traz", () => {
    const advogado = edition({
      eventId: "a26",
      year: 2026,
      name: "Dia do Advogado 2026",
      seriesId: "adv",
      seriesName: "Dia do Advogado",
    });
    const [, det, , sup] = buildPlanejamentoSheets(
      { ...forecast, editions: [advogado], rows: [] },
      { ...details, supplierUses: [{ eventId: "a26", supplierId: "s-tetti", roleLabel: null, notes: null }] },
      0
    ) as [TableSheet, DetailSheet, TableSheet, TableSheet];
    expect(det.blocks[0]!.heading).toBe("Dia do Advogado 2026");
    expect(sup.rows[0]![3]).toBe("Dia do Advogado 2026");
  });

  it("sem reajuste o cabeçalho do budget fica limpo", () => {
    const [plain] = buildPlanejamentoSheets(forecast, details, 0) as TableSheet[];
    expect(plain!.columns.map((c) => c.header)).toContain("Budget 2027");
  });
});

describe("normalizeUrl", () => {
  it.each([
    ["https://site.com.br", "https://site.com.br/"],
    ["site.com.br/contato", "https://site.com.br/contato"],
    ["wa.me//5519997189568", "https://wa.me/5519997189568"],
    ["https://wa.me//5519997189568", "https://wa.me/5519997189568"],
    ["  ", null],
    ["ver com a Letícia", null],
    [null, null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });
});
