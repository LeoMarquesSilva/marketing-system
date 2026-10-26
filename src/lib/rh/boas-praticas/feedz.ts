/**
 * Importação do relatório de feedbacks do Feedz.
 *
 * No Feedz o feedback vai para o GESTOR (coluna "Para"); o colaborador só
 * aparece no texto. Cada linha é ligada a um registro do módulo pela data de
 * envio + gestor e, quando há mais de um no mesmo dia, pelo colaborador
 * citado e pelas palavras da ocorrência. Ligada uma vez, a linha guarda a
 * chave (feedz_key) e as próximas importações a acham direto.
 */

import { suggestAreaFromDepartment } from "./metrics";
import type { FeedbackInput, FeedbackPerson, GoodPracticeFeedback } from "./types";

export interface FeedzRow {
  /** Linha na planilha (1 = cabeçalho), para o RH achar no arquivo. */
  line: number;
  /** Destinatário + data/hora de envio: identifica a linha entre importações. */
  key: string;
  from: string;
  to: string;
  toDepartment: string | null;
  sentAt: string;
  sentOn: string;
  viewedAt: string | null;
  message: string;
}

export type FeedzMatchStatus = "ligado" | "encontrado" | "confira" | "sem_registro";

export interface FeedzChange {
  viewed: boolean;
  viewedOn: string | null;
}

export interface FeedzMatch {
  row: FeedzRow;
  status: FeedzMatchStatus;
  feedbackId: string | null;
  /** Outros registros possíveis, do mais para o menos provável. */
  alternatives: string[];
  /** O que muda na visualização; null = já está igual. */
  change: FeedzChange | null;
  /** Feedz diz "não visto" mas o registro já está como visto: mantém. */
  keptViewed: boolean;
}

/* ------------------------------------------------------------- texto */

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NAME_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e", "dr", "dra"]);

function nameTokens(name: string): string[] {
  return normalize(name)
    .split(" ")
    .filter((token) => token.length > 1 && !NAME_PARTICLES.has(token));
}

/** "Ricardo Pires" = "Ricardo Viscardi Pires": os nomes do menor estão todos no maior. */
export function sameName(a: string, b: string): boolean {
  const left = nameTokens(a);
  const right = nameTokens(b);
  if (!left.length || !right.length) return false;
  const [small, large] = left.length <= right.length ? [left, new Set(right)] : [right, new Set(left)];
  return small.every((token) => large.has(token));
}

const STOPWORDS = new Set(
  (
    "a o as os um uma de da do das dos e em no na nos nas para por com sem sobre ao aos que se sua seu suas seus " +
    "foi ser esta este essa esse isso apos ate mais muito pela pelo pelas pelos como quando onde tambem entre " +
    "colaborador colaboradora colaboradores deixou deixaram uso utilizou utilizacao incorreto incorreta inadequado " +
    "registro ocorrencia ocorrido boas praticas escritorio manual item prezado prezada bom dia boa tarde data hoje ontem"
  ).split(" ")
);

function words(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word))
  );
}

/** Parte das palavras da ocorrência registrada que aparece no texto do Feedz (0 a 1). */
function overlap(description: string, message: Set<string>): number {
  const own = words(description);
  if (!own.size) return 0;
  let hits = 0;
  for (const word of own) if (message.has(word)) hits += 1;
  return hits / own.size;
}

/** Quantos nomes da pessoa aparecem como palavra inteira no texto. */
function mentionCount(name: string, message: Set<string>): number {
  return nameTokens(name)
    .filter((token) => token !== "equipe" && token.length >= 3)
    .filter((token) => message.has(token)).length;
}

/* ----------------------------------------------------------- planilha */

function headerKey(value: unknown): string {
  return normalize(String(value ?? ""));
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Data/hora do Feedz (texto "2026-09-29 12:14:23", "29/09/2026 12:14", Date ou serial do Excel) → ISO -03:00. */
export function feedzDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}-03:00`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Serial do Excel: dias desde 30/12/1899, no horário local da planilha.
    const totalSeconds = Math.round((value - 25569) * 86400);
    const date = new Date(totalSeconds * 1000);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}-03:00`;
  }
  const text = String(value).trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [, y, mo, d, h = "00", mi = "00", s = "00"] = match;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}-03:00`;
  }
  match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [, d, mo, y, h = "00", mi = "00", s = "00"] = match;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}-03:00`;
  }
  return null;
}

/**
 * Lê as linhas da planilha exportada do Feedz (matriz de células, primeira
 * aba). Acha as colunas pelo nome, não pela posição.
 */
export function parseFeedzSheet(matrix: unknown[][]): { rows: FeedzRow[]; error: string | null } {
  const headerIndex = matrix.slice(0, 10).findIndex((row) => {
    const keys = row.map(headerKey);
    return keys.includes("para") && keys.includes("feedback") && keys.includes("data");
  });
  if (headerIndex < 0) {
    return { rows: [], error: "Não achei as colunas do relatório do Feedz (De, Para, Feedback, Data). Confira se é o arquivo exportado de lá." };
  }
  const header = matrix[headerIndex].map(headerKey);
  const col = (name: string) => header.indexOf(name);
  const fromCol = col("de");
  const toCol = col("para");
  const departmentCol = col("para departamento");
  const messageCol = col("feedback");
  const sentCol = col("data");
  const viewedCol = header.findIndex((key) => key.startsWith("data de visualizacao"));

  const rows: FeedzRow[] = [];
  matrix.slice(headerIndex + 1).forEach((cells, offset) => {
    const to = String(cells[toCol] ?? "").trim();
    const sentAt = feedzDateTime(cells[sentCol]);
    if (!to || !sentAt) return;
    rows.push({
      line: headerIndex + offset + 2,
      key: `${normalize(to)}|${sentAt.slice(0, 19)}`,
      from: fromCol >= 0 ? String(cells[fromCol] ?? "").trim() : "",
      to,
      toDepartment: departmentCol >= 0 ? String(cells[departmentCol] ?? "").trim() || null : null,
      sentAt,
      sentOn: sentAt.slice(0, 10),
      viewedAt: viewedCol >= 0 ? feedzDateTime(cells[viewedCol]) : null,
      message: String(cells[messageCol] ?? "").replace(/\r\n/g, "\n").trim(),
    });
  });
  if (!rows.length) return { rows, error: "O arquivo não tem feedbacks com destinatário e data de envio." };
  return { rows, error: null };
}

/* ----------------------------------------------------------- cruzamento */

function dayDistance(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;
}

/** O que a linha do Feedz muda na visualização do registro (nunca rebaixa "visto" para "não visto"). */
export function feedzChange(row: FeedzRow, feedback: Pick<GoodPracticeFeedback, "viewed" | "viewed_on">): { change: FeedzChange | null; keptViewed: boolean } {
  if (row.viewedAt) {
    const viewedOn = row.viewedAt.slice(0, 10);
    if (feedback.viewed === true && feedback.viewed_on === viewedOn) return { change: null, keptViewed: false };
    return { change: { viewed: true, viewedOn }, keptViewed: false };
  }
  if (feedback.viewed === true) return { change: null, keptViewed: true };
  if (feedback.viewed === false) return { change: null, keptViewed: false };
  return { change: { viewed: false, viewedOn: null }, keptViewed: false };
}

interface Candidate {
  line: number;
  feedbackId: string;
  score: number;
  strong: boolean;
}

export function matchFeedzRows(
  rows: FeedzRow[],
  feedbacks: GoodPracticeFeedback[],
  people: FeedbackPerson[]
): FeedzMatch[] {
  const byId = new Map(feedbacks.map((feedback) => [feedback.id, feedback]));
  const byKey = new Map(feedbacks.filter((feedback) => feedback.feedz_key).map((feedback) => [feedback.feedz_key as string, feedback]));
  const personById = new Map(people.map((person) => [person.id, person]));
  const managerNames = (feedback: GoodPracticeFeedback) => {
    const person = feedback.manager_employee_id ? personById.get(feedback.manager_employee_id) : undefined;
    return [feedback.manager_name, person?.full_name, person?.short_name].filter(Boolean) as string[];
  };

  const linkedIds = new Set<string>();
  const result = new Map<number, FeedzMatch>();
  const candidates: Candidate[] = [];

  for (const row of rows) {
    const linked = byKey.get(row.key);
    if (linked) {
      linkedIds.add(linked.id);
      result.set(row.line, { row, status: "ligado", feedbackId: linked.id, alternatives: [], ...feedzChange(row, linked) });
    }
  }

  for (const row of rows) {
    if (result.has(row.line)) continue;
    const message = words(`${row.message}`);
    const messageNames = new Set(normalize(row.message).split(" "));
    for (const feedback of feedbacks) {
      if (linkedIds.has(feedback.id) || (feedback.feedz_key && feedback.feedz_key !== row.key)) continue;
      const distance = dayDistance(feedback.sent_on, row.sentOn);
      if (distance > 1) continue;
      const manager = managerNames(feedback).some((name) => sameName(name, row.to));
      const mentions = mentionCount(feedback.employee_name, messageNames);
      if (!manager && !(mentions >= 2 && distance === 0)) continue;
      const score =
        (manager ? 50 : 0) +
        (distance === 0 ? 20 : 8) +
        (mentions >= 2 ? 25 : mentions === 1 ? 12 : 0) +
        overlap(feedback.description, message) * 40;
      candidates.push({ line: row.line, feedbackId: feedback.id, score, strong: manager && distance === 0 });
    }
  }

  // Um para um: os pares mais fortes primeiro.
  candidates.sort((a, b) => b.score - a.score);
  const takenFeedbacks = new Set<string>();
  const chosen = new Map<number, Candidate>();
  for (const candidate of candidates) {
    if (chosen.has(candidate.line) || takenFeedbacks.has(candidate.feedbackId)) continue;
    chosen.set(candidate.line, candidate);
    takenFeedbacks.add(candidate.feedbackId);
  }

  for (const row of rows) {
    if (result.has(row.line)) continue;
    const pick = chosen.get(row.line);
    const own = candidates.filter((candidate) => candidate.line === row.line);
    if (!pick) {
      result.set(row.line, { row, status: "sem_registro", feedbackId: null, alternatives: own.map((c) => c.feedbackId), change: null, keptViewed: false });
      continue;
    }
    const runnerUp = own.find((candidate) => candidate.feedbackId !== pick.feedbackId);
    const clear = pick.strong && (!runnerUp || pick.score - runnerUp.score >= 10);
    const feedback = byId.get(pick.feedbackId) as GoodPracticeFeedback;
    result.set(row.line, {
      row,
      status: clear ? "encontrado" : "confira",
      feedbackId: pick.feedbackId,
      alternatives: own.filter((candidate) => candidate.feedbackId !== pick.feedbackId).map((candidate) => candidate.feedbackId),
      ...feedzChange(row, feedback),
    });
  }

  return rows.map((row) => result.get(row.line) as FeedzMatch);
}

/* -------------------------------------------- registrar a partir do Feedz */

/** Tira o cabeçalho, a saudação e o texto padrão do fim: sobra a ocorrência. */
export function feedzOccurrenceText(message: string): string {
  let text = message.replace(/\s+/g, " ").trim();
  text = text.replace(/^registro de ocorr[eê]ncia\s*\|\s*boas pr[aá]ticas no escrit[oó]rio\s*/i, "");
  text = text.replace(/^prezad[oa](\(a\))?\s+[^,]{1,60},\s*(bom dia|boa tarde|boa noite)[.!]?\s*/i, "");
  const cut = text.search(/diante do ocorrido|solicitamos,? na qualidade|ressaltamos que/i);
  if (cut > 40) text = text.slice(0, cut).trim();
  return text.length > 1200 ? `${text.slice(0, 1197)}…` : text;
}

/**
 * Colaborador citado no texto, sem ser o gestor: quem tiver dois ou mais
 * nomes no texto; senão, um primeiro nome que só um colaborador ativo tem
 * ("GIANCARLO").
 */
export function feedzMentionedPerson(message: string, people: FeedbackPerson[], managerName: string): FeedbackPerson | null {
  const tokens = new Set(normalize(message).split(" "));
  const others = people.filter((person) => !sameName(person.full_name, managerName));
  let best: { person: FeedbackPerson; hits: number } | null = null;
  for (const person of others) {
    const hits = mentionCount(person.full_name, tokens);
    if (hits >= 2 && (!best || hits > best.hits || (hits === best.hits && person.is_active && !best.person.is_active))) {
      best = { person, hits };
    }
  }
  if (best) return best.person;
  const byFirstName = others.filter((person) => person.is_active && tokens.has(nameTokens(person.full_name)[0] ?? ""));
  return byFirstName.length === 1 ? byFirstName[0] : null;
}

/** Gestor do cadastro com o nome que veio no "Para" (ativo primeiro). */
export function feedzManager(to: string, people: FeedbackPerson[]): FeedbackPerson | null {
  const found = people.filter((person) => sameName(person.full_name, to));
  return found.find((person) => person.is_active) ?? found[0] ?? null;
}

/** Formulário já preenchido com o que a linha do Feedz traz; o RH completa a categoria e confere. */
export function feedzPrefill(row: FeedzRow, people: FeedbackPerson[]): FeedbackInput {
  const manager = feedzManager(row.to, people);
  const employee = feedzMentionedPerson(row.message, people, row.to);
  return {
    occurred_on: row.sentOn,
    sent_on: row.sentOn,
    employee_name: employee?.full_name ?? "",
    is_team: false,
    manager_name: manager?.full_name ?? row.to,
    area: suggestAreaFromDepartment(employee?.department) ?? "",
    category: "",
    description: feedzOccurrenceText(row.message),
    manager_action: "",
    responded_on: "",
    viewed: row.viewedAt ? true : false,
    viewed_on: row.viewedAt ? row.viewedAt.slice(0, 10) : "",
    feedz: { key: row.key, sent_at: row.sentAt, viewed_at: row.viewedAt, message: row.message },
  };
}
