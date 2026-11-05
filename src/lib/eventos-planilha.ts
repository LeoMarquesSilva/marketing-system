import {
  BUDGET_PAYMENT_LABEL,
  EVENT_KIND_LABEL,
  EVENT_STATUS_LABEL,
  EVENT_TYPE_OPTIONS,
  FILE_TYPE_LABEL,
  SUPPLIER_CATEGORY_LABEL,
  formatBrl,
  type BudgetPaymentStatus,
  type EventsForecast,
  type ForecastBaseSource,
  type ForecastEdition,
} from "@/lib/eventos";

/**
 * Conteúdo da planilha do planejamento anual de eventos, sem formatação:
 * calendário do ano-alvo, um bloco de detalhes por evento (orçamento,
 * propostas, fornecedores e arquivos), histórico, fornecedores e notas.
 * O desenho (cores, links, painéis) fica em eventos-planilha-excel.ts.
 * Campo vazio no cadastro sai como "Não informado" — nada é estimado aqui.
 */

export const NAO_INFORMADO = "Não informado";

/** Os links "Abrir no ORQESTRAI" apontam para produção, onde a planilha vai ser lida. */
export const APP_BASE_URL = "https://www.orqestrai.com.br";

export const PLANILHA_SHEETS = {
  calendar: (year: number) => `Calendário ${year}`,
  details: "Detalhes por evento",
  history: "Eventos por ano",
  suppliers: "Fornecedores",
  notes: "Como ler",
} as const;

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const BASE_SOURCE_LABEL: Record<ForecastBaseSource, string> = {
  realizado: "Realizado",
  previsto: "Previsto",
  verba: "Verba aprovada",
};

const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  descartada: "Descartada",
};

// ---------------------------------------------------------------------------
// Dados de detalhe (vêm do servidor, ver eventos-planilha-server.ts)
// ---------------------------------------------------------------------------

export interface PlanilhaBudgetItem {
  eventId: string;
  category: string | null;
  description: string | null;
  vendorName: string | null;
  amountQuoted: number | null;
  amountPlanned: number | null;
  amountActual: number | null;
  paymentStatus: string | null;
  paymentPaidDate: string | null;
  invoiceLink: string | null;
  receiptLink: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface PlanilhaQuote {
  eventId: string;
  supplierName: string | null;
  scope: string | null;
  includedItems: string | null;
  quotedValue: number | null;
  finalValue: number | null;
  proposalStatus: string | null;
  fileLink: string | null;
  decisionReason: string | null;
}

export interface PlanilhaSupplier {
  id: string;
  name: string;
  category: string | null;
  websiteLink: string | null;
  instagramLink: string | null;
  whatsappLink: string | null;
  portfolioLink: string | null;
}

export interface PlanilhaSupplierUse {
  eventId: string;
  supplierId: string;
  roleLabel: string | null;
  notes: string | null;
}

export interface PlanilhaAttachment {
  eventId: string;
  title: string | null;
  fileType: string | null;
  url: string | null;
  isPublic: boolean;
}

export interface PlanejamentoDetails {
  budgetItems: PlanilhaBudgetItem[];
  quotes: PlanilhaQuote[];
  suppliers: PlanilhaSupplier[];
  supplierUses: PlanilhaSupplierUse[];
  attachments: PlanilhaAttachment[];
}

export const EMPTY_DETAILS: PlanejamentoDetails = {
  budgetItems: [],
  quotes: [],
  suppliers: [],
  supplierUses: [],
  attachments: [],
};

// ---------------------------------------------------------------------------
// Modelo da planilha
// ---------------------------------------------------------------------------

export type Tone = "realizado" | "previsto" | "verba";

/** Célula com texto e, opcionalmente, link externo, âncora para um bloco de detalhe ou tom. */
export interface RichValue {
  text: string;
  url?: string;
  /** Id do evento cujo bloco em "Detalhes por evento" o link abre. */
  anchor?: string;
  muted?: boolean;
  tone?: Tone;
}

export type CellValue = string | number | null | RichValue;
export type ColumnFormat = "text" | "money" | "date";

export interface ColumnSpec {
  header: string;
  width: number;
  format?: ColumnFormat;
  wrap?: boolean;
  /** Coluna de destaque (a do budget do ano-alvo). */
  emphasis?: boolean;
}

export interface TableSheet {
  kind: "table";
  name: string;
  title: string;
  subtitle: string;
  columns: ColumnSpec[];
  rows: CellValue[][];
  /** Colunas somadas numa linha de total no fim. */
  totalColumns?: number[];
  /** Colunas fixas à esquerda ao rolar para o lado. */
  freezeCols: number;
}

export interface DetailBudgetRow {
  category: string;
  description: string;
  vendor: string;
  quoted: number | null;
  planned: number | null;
  actual: number | null;
  payment: string;
  paidDate: string | null;
  invoice: RichValue | null;
  receipt: RichValue | null;
  notes: string;
}

export interface DetailQuoteRow {
  status: string;
  scope: string;
  /** Lista do que a proposta inclui — vai numa linha própria, na largura toda. */
  included: string;
  supplier: string;
  quoted: number | null;
  final: number | null;
  reason: string;
  file: RichValue | null;
}

export interface DetailSupplierRow {
  category: string;
  name: string;
  role: string;
  notes: string;
  contact: RichValue | null;
}

export interface DetailAttachmentRow {
  type: string;
  title: string;
  link: RichValue;
}

export interface DetailBlock {
  eventId: string;
  heading: string;
  facts: string;
  appUrl: string;
  budget: DetailBudgetRow[];
  quotes: DetailQuoteRow[];
  suppliers: DetailSupplierRow[];
  attachments: DetailAttachmentRow[];
}

export interface DetailSheet {
  kind: "details";
  name: string;
  title: string;
  subtitle: string;
  blocks: DetailBlock[];
}

export interface NotesSheet {
  kind: "notes";
  name: string;
  title: string;
  subtitle: string;
  rows: Array<[string, string]>;
}

export type PlanilhaSheet = TableSheet | DetailSheet | NotesSheet;

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function muted(text: string): RichValue {
  return { text, muted: true };
}

/** "2026-05-08" → 4 (maio). Lido do texto para não sofrer com fuso horário. */
function monthFromIso(iso: string | null): number | null {
  if (!iso) return null;
  const month = Number(iso.slice(5, 7));
  return month >= 1 && month <= 12 ? month - 1 : null;
}

function monthFromLabel(label: string | null): number | null {
  if (!label) return null;
  const index = MONTHS.findIndex((m) => plain(m) === plain(label));
  return index >= 0 ? index : null;
}

/** Mês em que a edição acontece: data do evento, senão o mês cadastrado, senão a data comemorativa. */
function editionMonth(edition: ForecastEdition): number | null {
  return (
    monthFromIso(edition.eventDate) ??
    monthFromLabel(edition.monthLabel) ??
    monthFromIso(edition.commemorativeDate)
  );
}

/** Data ISO só com dia (aaaa-mm-dd) ou null. */
function isoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function formatIsoDate(iso: string | null | undefined): string | null {
  const day = isoDay(iso);
  if (!day) return null;
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** Acerta a grafia pelo cadastro ("interno" → "Interno"); valor fora da lista passa como veio. */
function normalizeType(raw: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return EVENT_TYPE_OPTIONS.find((option) => plain(option) === plain(value)) ?? value;
}

function capitalize(value: string): string {
  const text = value.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function categoryLabel(key: string | null): string {
  if (!key) return NAO_INFORMADO;
  return SUPPLIER_CATEGORY_LABEL[key] ?? capitalize(key);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function positive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? round2(value) : null;
}

function amountOrMissing(value: number | null | undefined): CellValue {
  return positive(value) ?? muted(NAO_INFORMADO);
}

function formatPercent(rate: number): string {
  return `${Number((rate * 100).toFixed(2)).toLocaleString("pt-BR")}%`;
}

/**
 * Link utilizável no Excel: completa o https:// e corrige barras dobradas
 * ("wa.me//5519…"). Texto que não vira URL volta null.
 */
export function normalizeUrl(raw: string | null | undefined): string | null {
  let value = raw?.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    if (/\s/.test(value) || !/^[\w-]+(\.[\w-]+)+/.test(value)) return null;
    value = `https://${value}`;
  }
  value = value.replace(/^(https?:\/\/[^/]+)\/{2,}/i, "$1/");
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function eventAppUrl(eventId: string): string {
  return `${APP_BASE_URL}/eventos/${eventId}`;
}

function supplierContact(supplier: PlanilhaSupplier | undefined): RichValue | null {
  if (!supplier) return null;
  const options: Array<[string | null, string]> = [
    [supplier.websiteLink, "Site"],
    [supplier.instagramLink, "Instagram"],
    [supplier.whatsappLink, "WhatsApp"],
    [supplier.portfolioLink, "Portfólio"],
  ];
  for (const [raw, label] of options) {
    const url = normalizeUrl(raw);
    if (url) return { text: label, url };
  }
  return null;
}

/**
 * O cadastro tem o mesmo fornecedor repetido (13 "Pão de Açúcar Cambuí"):
 * na planilha, mesmo nome vira uma linha só.
 */
interface SupplierGroup {
  name: string;
  categories: string[];
  contact: RichValue | null;
  roles: string[];
  notes: string[];
  events: ForecastEdition[];
}

function groupSupplierUses(
  uses: PlanilhaSupplierUse[],
  suppliersById: Map<string, PlanilhaSupplier>,
  editionsById: Map<string, ForecastEdition>
): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();
  for (const use of uses) {
    const supplier = suppliersById.get(use.supplierId);
    const name = supplier?.name?.trim() || NAO_INFORMADO;
    const key = plain(name);
    const group = groups.get(key) ?? { name, categories: [], contact: null, roles: [], notes: [], events: [] };
    const category = categoryLabel(supplier?.category ?? null);
    if (!group.categories.includes(category)) group.categories.push(category);
    group.contact = group.contact ?? supplierContact(supplier);
    const role = use.roleLabel?.trim();
    if (role && !group.roles.includes(role)) group.roles.push(role);
    const note = use.notes?.trim();
    if (note && !group.notes.includes(note)) group.notes.push(note);
    const edition = editionsById.get(use.eventId);
    if (edition && !group.events.some((e) => e.eventId === edition.eventId)) group.events.push(edition);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** "Dia do Advogado 2026" já traz o ano; os outros ganham "(2026)". */
function editionLabel(edition: ForecastEdition, separator: "paren" | "dot" = "paren"): string {
  if (edition.name.includes(String(edition.year))) return edition.name;
  return separator === "dot" ? `${edition.name} · ${edition.year}` : `${edition.name} (${edition.year})`;
}

function compareEditions(a: ForecastEdition, b: ForecastEdition): number {
  if (a.year !== b.year) return a.year - b.year;
  const monthA = editionMonth(a) ?? 99;
  const monthB = editionMonth(b) ?? 99;
  if (monthA !== monthB) return monthA - monthB;
  const dateA = a.eventDate ?? a.commemorativeDate;
  const dateB = b.eventDate ?? b.commemorativeDate;
  if (dateA && dateB && dateA !== dateB) return dateA.localeCompare(dateB);
  return a.name.localeCompare(b.name, "pt-BR");
}

/** Primeira edição (da mais recente para a mais antiga) que tenha o campo preenchido. */
function latestWith<T>(
  editions: ForecastEdition[],
  pick: (edition: ForecastEdition) => T | null
): T | null {
  for (const edition of editions) {
    const value = pick(edition);
    if (value != null) return value;
  }
  return null;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function formatGeneratedAt(now: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}:${get("minute")}`;
}

// ---------------------------------------------------------------------------
// Blocos de detalhe
// ---------------------------------------------------------------------------

function buildDetailBlock(edition: ForecastEdition, details: PlanejamentoDetails): DetailBlock | null {
  const suppliersById = new Map(details.suppliers.map((s) => [s.id, s]));
  const appUrl = eventAppUrl(edition.eventId);

  const budget = details.budgetItems
    .filter((item) => item.eventId === edition.eventId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item): DetailBudgetRow => {
      const invoice = normalizeUrl(item.invoiceLink);
      const receipt = normalizeUrl(item.receiptLink);
      const status = item.paymentStatus as BudgetPaymentStatus | null;
      return {
        category: categoryLabel(item.category),
        description: item.description?.trim() || NAO_INFORMADO,
        vendor: item.vendorName?.trim() || NAO_INFORMADO,
        quoted: positive(item.amountQuoted),
        planned: positive(item.amountPlanned),
        actual: positive(item.amountActual),
        payment: status ? (BUDGET_PAYMENT_LABEL[status] ?? capitalize(status)) : NAO_INFORMADO,
        paidDate: isoDay(item.paymentPaidDate),
        invoice: invoice ? { text: "Abrir", url: invoice } : null,
        receipt: receipt ? { text: "Abrir", url: receipt } : null,
        notes: item.notes?.trim() ?? "",
      };
    });

  const quotes = details.quotes
    .filter((quote) => quote.eventId === edition.eventId)
    .map((quote): DetailQuoteRow => {
      const file = normalizeUrl(quote.fileLink);
      return {
        status: quote.proposalStatus
          ? (PROPOSAL_STATUS_LABEL[quote.proposalStatus] ?? capitalize(quote.proposalStatus))
          : NAO_INFORMADO,
        scope: quote.scope?.trim() || NAO_INFORMADO,
        included: quote.includedItems?.trim() ?? "",
        supplier: quote.supplierName?.trim() || NAO_INFORMADO,
        quoted: positive(quote.quotedValue),
        final: positive(quote.finalValue),
        reason: quote.decisionReason?.trim() ?? "",
        file: file ? { text: "Abrir proposta", url: file } : null,
      };
    });

  // O mesmo fornecedor ligado mais de uma vez (ou cadastrado em dobro) vira uma linha.
  const suppliers = groupSupplierUses(
    details.supplierUses.filter((use) => use.eventId === edition.eventId),
    suppliersById,
    new Map([[edition.eventId, edition]])
  )
    .map(
      (group): DetailSupplierRow => ({
        category: group.categories.join("; "),
        name: group.name,
        role: group.roles.join("; "),
        notes: group.notes.join("\n"),
        contact: group.contact,
      })
    )
    .sort((a, b) => a.category.localeCompare(b.category, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));

  const attachments = details.attachments
    .filter((attachment) => attachment.eventId === edition.eventId)
    .map((attachment): DetailAttachmentRow => {
      const url = normalizeUrl(attachment.url);
      const type = attachment.fileType as keyof typeof FILE_TYPE_LABEL | null;
      return {
        type: type ? (FILE_TYPE_LABEL[type] ?? capitalize(type)) : NAO_INFORMADO,
        title: attachment.title?.trim() || NAO_INFORMADO,
        // Arquivo marcado como restrito abre pelo sistema, que pede login.
        link:
          attachment.isPublic && url
            ? { text: "Abrir arquivo", url }
            : { text: "Abrir no ORQESTRAI (restrito)", url: appUrl },
      };
    });

  if (budget.length + quotes.length + suppliers.length + attachments.length === 0) return null;

  const date = formatIsoDate(edition.eventDate);
  const end = formatIsoDate(edition.endDate);
  const facts = [
    date ? (end && end !== date ? `${date} a ${end}` : date) : "Data não informada",
    normalizeType(edition.eventType) ?? "Tipo não informado",
    EVENT_STATUS_LABEL[edition.status],
    positive(edition.budgetApproved) != null ? `Verba aprovada ${formatBrl(edition.budgetApproved!)}` : null,
    edition.plannedTotal > 0 ? `Previsto ${formatBrl(edition.plannedTotal)}` : null,
    edition.actualTotal > 0 ? `Realizado ${formatBrl(edition.actualTotal)}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return {
    eventId: edition.eventId,
    heading: editionLabel(edition, "dot"),
    facts,
    appUrl,
    budget,
    quotes,
    suppliers,
    attachments,
  };
}

/** "12 itens · 9 fornecedores · 8 arquivos" — o texto do link que abre o bloco. */
function blockSummary(block: DetailBlock): string {
  const parts = [
    block.budget.length ? plural(block.budget.length, "item", "itens") : null,
    block.quotes.length ? plural(block.quotes.length, "proposta", "propostas") : null,
    block.suppliers.length ? plural(block.suppliers.length, "fornecedor", "fornecedores") : null,
    block.attachments.length ? plural(block.attachments.length, "arquivo", "arquivos") : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------

function buildCalendarSheet(
  forecast: EventsForecast,
  adjustmentRate: number,
  blocks: Map<string, DetailBlock>,
  generatedAt: Date
): TableSheet {
  const { targetYear, historyYears, rows, editions } = forecast;
  const lastYear = historyYears.at(-1) ?? null;

  const budgetHeader =
    adjustmentRate !== 0
      ? `Budget ${targetYear} (reajuste de ${formatPercent(adjustmentRate)})`
      : `Budget ${targetYear}`;

  const columns: ColumnSpec[] = [
    { header: "Mês", width: 11 },
    { header: "Evento", width: 32 },
    { header: "Categoria", width: 11 },
    { header: "Tipo de evento", width: 17 },
    { header: "Data comemorativa (última registrada)", width: 16, format: "date" },
    ...(lastYear != null
      ? ([
          { header: `Verba aprovada ${lastYear}`, width: 15, format: "money" },
          { header: `Previsto ${lastYear}`, width: 15, format: "money" },
          { header: `Realizado ${lastYear}`, width: 15, format: "money" },
        ] satisfies ColumnSpec[])
      : []),
    { header: "Base da projeção", width: 18 },
    { header: budgetHeader, width: 17, format: "money", emphasis: true },
    { header: `Edição ${targetYear}`, width: 17 },
    { header: "Fornecedores, orçamentos e arquivos", width: 46 },
    { header: "No ORQESTRAI", width: 13 },
  ];

  const lines = rows.map((row) => {
    // Edições válidas da série, da mais recente para a mais antiga.
    const pool = editions
      .filter((e) => e.seriesId === row.seriesId && e.status !== "cancelada")
      .sort((a, b) => b.year - a.year);

    const month = latestWith(pool, editionMonth);
    const eventType = latestWith(pool, (e) => normalizeType(e.eventType));
    const commemorative = latestWith(pool, (e) => isoDay(e.commemorativeDate));
    const withBlock = pool.find((e) => blocks.has(e.eventId));
    const block = withBlock ? blocks.get(withBlock.eventId)! : null;
    const reference = withBlock ?? pool[0];

    const lastStats = lastYear != null ? row.byYear[lastYear] : undefined;
    const lastYearCells: CellValue[] =
      lastYear == null
        ? []
        : lastStats
          ? [
              amountOrMissing(lastStats.budgetApproved),
              amountOrMissing(lastStats.plannedTotal),
              amountOrMissing(lastStats.actualTotal),
            ]
          : [1, 2, 3].map(() => muted(`Sem edição em ${lastYear}`));

    const target = row.targetEventId
      ? editions.find((e) => e.eventId === row.targetEventId)
      : undefined;
    const targetDate = formatIsoDate(target?.eventDate ?? null);
    const targetCell: CellValue = target
      ? targetDate
        ? `Aberta, ${targetDate}`
        : "Aberta, sem data"
      : muted("Não aberta");

    const summary = block ? blockSummary(block) : "";
    const line: CellValue[] = [
      month != null ? MONTHS[month]! : muted(NAO_INFORMADO),
      block ? { text: row.seriesName, anchor: block.eventId } : row.seriesName,
      EVENT_KIND_LABEL[row.kind],
      eventType ?? muted(NAO_INFORMADO),
      commemorative ?? muted(NAO_INFORMADO),
      ...lastYearCells,
      row.baseSource && row.baseYear != null
        ? { text: `${BASE_SOURCE_LABEL[row.baseSource]} ${row.baseYear}`, tone: row.baseSource }
        : muted("Sem valor lançado"),
      row.baseValue != null ? round2(row.baseValue * (1 + adjustmentRate)) : muted("Sem base"),
      targetCell,
      block
        ? {
            text: withBlock!.year !== lastYear ? `${summary} (${withBlock!.year})` : summary,
            anchor: block.eventId,
          }
        : muted("Nada lançado"),
      reference ? { text: "Abrir", url: eventAppUrl(reference.eventId) } : "",
    ];
    return { month, name: row.seriesName, line };
  });

  // Calendário lê em ordem de mês; quem não tem mês vai para o fim.
  lines.sort((a, b) => {
    const ma = a.month ?? 99;
    const mb = b.month ?? 99;
    if (ma !== mb) return ma - mb;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const totalColumns = columns
    .map((column, index) => (column.format === "money" ? index : -1))
    .filter((index) => index >= 0);

  const reajuste =
    adjustmentRate !== 0
      ? `Budget ${targetYear} com reajuste de ${formatPercent(adjustmentRate)} sobre a base de cada série`
      : `Budget ${targetYear} sem reajuste sobre a base de cada série`;

  return {
    kind: "table",
    name: PLANILHA_SHEETS.calendar(targetYear),
    title: `Calendário de eventos ${targetYear} — Bismarchi | Pires`,
    subtitle: `Gerado pelo ORQESTRAI em ${formatGeneratedAt(generatedAt)}  ·  ${reajuste}  ·  Clique no nome do evento para ver fornecedores, orçamentos e arquivos`,
    columns,
    rows: lines.map((l) => l.line),
    totalColumns,
    freezeCols: 2,
  };
}

function buildDetailSheet(forecast: EventsForecast, blocks: DetailBlock[]): DetailSheet {
  return {
    kind: "details",
    name: PLANILHA_SHEETS.details,
    title: `Fornecedores, orçamentos e arquivos por evento — até ${forecast.targetYear}`,
    subtitle:
      blocks.length > 0
        ? `${plural(blocks.length, "evento com lançamentos", "eventos com lançamentos")}  ·  Notas fiscais, comprovantes e propostas abrem direto; arquivos restritos abrem no ORQESTRAI, com login`
        : "Nenhum evento tem orçamento, fornecedor ou arquivo lançado ainda",
    blocks,
  };
}

function buildHistorySheet(forecast: EventsForecast, blocks: Map<string, DetailBlock>): TableSheet {
  const columns: ColumnSpec[] = [
    { header: "Ano", width: 7 },
    { header: "Evento", width: 32 },
    { header: "Categoria", width: 11 },
    { header: "Série", width: 26 },
    { header: "Tipo de evento", width: 17 },
    { header: "Mês", width: 11 },
    { header: "Data comemorativa", width: 14, format: "date" },
    { header: "Data do evento", width: 14, format: "date" },
    { header: "Término", width: 12, format: "date" },
    { header: "Situação", width: 13 },
    { header: "Verba aprovada", width: 15, format: "money" },
    { header: "Previsto", width: 15, format: "money" },
    { header: "Realizado", width: 15, format: "money" },
    { header: "Fornecedores, orçamentos e arquivos", width: 46 },
    { header: "No ORQESTRAI", width: 13 },
  ];

  const rows = [...forecast.editions].sort(compareEditions).map((e): CellValue[] => {
    const month = editionMonth(e);
    const block = blocks.get(e.eventId);
    return [
      e.year,
      block ? { text: e.name, anchor: e.eventId } : e.name,
      EVENT_KIND_LABEL[e.kind],
      e.seriesName ?? muted("Avulso (fora da previsão)"),
      normalizeType(e.eventType) ?? muted(NAO_INFORMADO),
      month != null ? MONTHS[month]! : muted(NAO_INFORMADO),
      isoDay(e.commemorativeDate) ?? muted(NAO_INFORMADO),
      isoDay(e.eventDate) ?? muted(NAO_INFORMADO),
      // Evento de um dia só não tem término: vazio aqui não é falta de dado.
      isoDay(e.endDate) ?? "",
      e.status === "cancelada" ? muted(EVENT_STATUS_LABEL[e.status]) : EVENT_STATUS_LABEL[e.status],
      amountOrMissing(e.budgetApproved),
      amountOrMissing(e.plannedTotal),
      amountOrMissing(e.actualTotal),
      block ? { text: blockSummary(block), anchor: e.eventId } : muted("Nada lançado"),
      { text: "Abrir", url: eventAppUrl(e.eventId) },
    ];
  });

  return {
    kind: "table",
    name: PLANILHA_SHEETS.history,
    title: `Eventos por ano — até ${forecast.targetYear}`,
    subtitle: "Todas as edições cadastradas, inclusive avulsas e canceladas  ·  Clique no nome do evento para ver os detalhes",
    columns,
    rows,
    totalColumns: [10, 11, 12],
    freezeCols: 2,
  };
}

function buildSuppliersSheet(forecast: EventsForecast, details: PlanejamentoDetails): TableSheet {
  const editionsById = new Map(forecast.editions.map((e) => [e.eventId, e]));
  const suppliersById = new Map(details.suppliers.map((s) => [s.id, s]));
  const groups = groupSupplierUses(
    details.supplierUses.filter((use) => editionsById.has(use.eventId)),
    suppliersById,
    editionsById
  );

  const columns: ColumnSpec[] = [
    { header: "Fornecedor", width: 38, wrap: true },
    { header: "Categoria", width: 20, wrap: true },
    { header: "Eventos atendidos", width: 10 },
    { header: "Em quais eventos", width: 48, wrap: true },
    { header: "Papel", width: 26, wrap: true },
    { header: "Contato", width: 12 },
  ];

  const rows = groups
    .map((group) => {
      const events = [...group.events].sort(compareEditions);
      return {
        name: group.name,
        count: events.length,
        line: [
          group.name,
          group.categories.join("; "),
          events.length,
          events.map((e) => editionLabel(e)).join("\n"),
          group.roles.join("; "),
          group.contact ?? muted("—"),
        ] satisfies CellValue[],
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"))
    .map((r) => r.line);

  return {
    kind: "table",
    name: PLANILHA_SHEETS.suppliers,
    title: `Fornecedores usados nos eventos — até ${forecast.targetYear}`,
    subtitle: `${plural(rows.length, "fornecedor ligado", "fornecedores ligados")} a algum evento  ·  Os mais recorrentes primeiro  ·  Cadastros repetidos com o mesmo nome aparecem juntos  ·  Contato abre o site, Instagram ou WhatsApp cadastrado`,
    columns,
    rows,
    freezeCols: 1,
  };
}

function buildNotesSheet(
  forecast: EventsForecast,
  adjustmentRate: number,
  generatedAt: Date
): NotesSheet {
  const { targetYear, editions } = forecast;
  const avulsos = editions.filter((e) => !e.seriesId);
  const avulsoNames = avulsos.map((e) => `${e.name} (${e.year})`).join("; ");

  return {
    kind: "notes",
    name: PLANILHA_SHEETS.notes,
    title: `Como ler esta planilha`,
    subtitle: `Planejamento de eventos ${targetYear}  ·  Gerado pelo ORQESTRAI em ${formatGeneratedAt(generatedAt)}`,
    rows: [
      [
        `Budget ${targetYear}`,
        "Base de cada série com o reajuste aplicado. A base é o valor mais recente lançado: o realizado; na falta dele, o previsto; na falta dos dois, a verba aprovada.",
      ],
      ["Reajuste aplicado", formatPercent(adjustmentRate)],
      ["Base da projeção", "Verde: realizado (dinheiro que saiu). Amarelo: previsto. Cinza: verba aprovada."],
      ["Sem base", "Série sem nenhum valor lançado em nenhum ano. Não entra no total."],
      [
        "Tipo e data comemorativa",
        "Vêm da edição mais recente da série que tenha o campo preenchido. A data comemorativa mostra o ano de onde saiu.",
      ],
      [
        "Detalhes por evento",
        "Clique no nome do evento (ou no resumo de itens) para ir ao bloco com o orçamento item a item, propostas, fornecedores e arquivos. Em cada bloco, \"↑ Calendário\" volta ao topo.",
      ],
      [
        "Links",
        "Nota fiscal, comprovante, proposta e contato do fornecedor abrem direto. Arquivo marcado como restrito e \"Abrir\" levam ao evento no ORQESTRAI, que pede login.",
      ],
      ["Não informado", "Campo vazio no cadastro do evento. Nada é estimado."],
      [
        "Eventos avulsos",
        avulsos.length > 0
          ? `${plural(avulsos.length, "evento sem série fica", "eventos sem série ficam")} fora do calendário e aparecem em "Eventos por ano": ${avulsoNames}. Para entrar na previsão, ligue o evento a uma série no cadastro.`
          : "Nenhum: todos os eventos estão ligados a uma série.",
      ],
      ["Canceladas", "Edições canceladas aparecem em \"Eventos por ano\", mas não servem de base."],
      ["Café com Cultura", "Tem módulo próprio e não entra nesta planilha."],
    ],
  };
}

export function buildPlanejamentoSheets(
  forecast: EventsForecast,
  details: PlanejamentoDetails,
  adjustmentRate: number,
  generatedAt: Date = new Date()
): PlanilhaSheet[] {
  const blockList = [...forecast.editions]
    .sort(compareEditions)
    .map((edition) => buildDetailBlock(edition, details))
    .filter((block): block is DetailBlock => block != null);
  const blocks = new Map(blockList.map((block) => [block.eventId, block]));

  return [
    buildCalendarSheet(forecast, adjustmentRate, blocks, generatedAt),
    buildDetailSheet(forecast, blockList),
    buildHistorySheet(forecast, blocks),
    buildSuppliersSheet(forecast, details),
    buildNotesSheet(forecast, adjustmentRate, generatedAt),
  ];
}
