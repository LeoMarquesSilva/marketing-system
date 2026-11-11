/**
 * Projeto do minidocumentário (e futuros vídeos): tipos, rótulos e regras puras
 * usadas no servidor e nas telas. O conteúdo vem do banco (documentary_*).
 */

export const DOC_DEFAULT_SLUG = "bp-10-anos";
export const DOC_BUCKET = "MARKETING-SYSTEM-DOCUMENTARIO";
export const DOC_BASE_PATH = "/documentario";

export type DecisionStatus = "pendente" | "aprovado" | "ajustar" | "recusado";
export type ApprovalStage = "validacao" | "editorial" | "producao";
export type ShootKind = "pre_entrevista" | "entrevista" | "conversa_conjunta" | "broll" | "outro";
export type ShootStatus = "a_marcar" | "marcada" | "realizada" | "cancelada";
export type QuestionAudience = "ricardo" | "gustavo" | "comum" | "aprofundamento";
export type ChecklistPhase = "antes" | "dia" | "montagem" | "festa";
export type ArchiveKind = "foto" | "video" | "audio" | "documento";
export type ArchiveStatus = "pendente" | "aprovado" | "nao_utilizavel";
export type AuthorizationStatus = "pendente" | "autorizado" | "nao_autorizado" | "nao_precisa";

export interface DocPerson {
  key: string;
  name: string;
  short_name: string;
  user_id: string | null;
  avatar_url: string | null;
  is_approver: boolean;
}

export interface DocProject {
  id: string;
  slug: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  tagline: string | null;
  signature: string | null;
  version_label: string;
  status_label: string | null;
  usage_note: string | null;
  access_note: string | null;
  event_id: string | null;
  festa_target_seconds: number | null;
  extended_target_seconds: number | null;
  updated_at: string;
}

export interface DocEventInfo {
  id: string;
  name: string;
  event_date: string | null;
  location: string | null;
  /** Bloco do cronograma oficial da festa em que o vídeo entra. */
  slot: { start_time: string | null; end_time: string | null; title: string; note: string | null; schedule_name: string } | null;
  /** Tarefa do checklist da festa ligada ao vídeo. */
  task: { id: string; title: string; status: string } | null;
}

export interface DocSection {
  id: string;
  slug: string;
  number: string | null;
  title: string;
  body: string;
  sort: number;
  version: number;
  updated_at: string;
  updated_by_name: string | null;
}

export interface DocSectionVersion {
  id: string;
  version: number;
  title: string;
  body: string;
  note: string | null;
  project_version: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface DocProjectVersion {
  id: string;
  version_label: string;
  note: string | null;
  section_versions: Record<string, number>;
  created_at: string;
  created_by_name: string | null;
}

export interface DocComment {
  id: string;
  section_id: string | null;
  body: string;
  author_user_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface DocDecision {
  id: string;
  item_id: string;
  person_key: string;
  status: DecisionStatus;
  note: string | null;
  decided_on: string | null;
  project_version: string | null;
  recorded_by_name: string | null;
  created_at: string;
}

export interface DocApprovalItem {
  id: string;
  stage: ApprovalStage;
  sort: number;
  title: string;
  context: string | null;
  sensitive: boolean;
  approvers: string[];
  source: string | null;
  /** Todas as decisões, da mais recente para a mais antiga. */
  decisions: DocDecision[];
}

export interface DocParticipant {
  name: string;
  user_id: string | null;
  role: string | null;
}

export interface DocShoot {
  id: string;
  kind: ShootKind;
  title: string;
  person_keys: string[];
  estimate: string | null;
  optional: boolean;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  participants: DocParticipant[];
  status: ShootStatus;
  notes: string | null;
  timer_started_at: string | null;
  timer_elapsed_seconds: number;
  sort: number;
}

export interface DocQuestion {
  id: string;
  audience: QuestionAudience;
  sort: number;
  text: string;
  note: string | null;
  sensitive: boolean;
  approval_item_id: string | null;
  priority: boolean;
  added_on_day: boolean;
}

export interface DocTake {
  question_id: string;
  shoot_id: string;
  asked: boolean;
  asked_at: string | null;
  time_mark: string | null;
  strong: boolean;
  note: string | null;
}

export interface DocChecklistItem {
  id: string;
  phase: ChecklistPhase;
  sort: number;
  text: string;
  done_at: string | null;
  done_by_name: string | null;
}

export interface DocShootCheck {
  shoot_id: string;
  item_id: string;
  done_at: string;
}

export interface DocArchivePerson {
  name: string;
  user_id: string | null;
}

export interface DocArchiveItem {
  id: string;
  seq: number;
  code: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: ArchiveKind;
  width: number | null;
  height: number | null;
  year: number | null;
  year_approx: boolean;
  date_note: string | null;
  description: string | null;
  people: DocArchivePerson[];
  category: string | null;
  source: string | null;
  authorization_status: AuthorizationStatus;
  allowed_uses: string[];
  chapters: string[];
  status: ArchiveStatus;
  status_note: string | null;
  created_at: string;
  created_by_name: string | null;
  /** Links assinados (privados, expiram). */
  thumb_url: string | null;
  file_url: string | null;
}

export interface DocTeamMember {
  user_id: string;
  name: string;
  short_name: string;
  avatar_url: string | null;
}

export interface DocViewer {
  user_id: string;
  name: string;
  is_admin: boolean;
  can_edit: boolean;
  /** Se quem está vendo é um dos sócios (ricardo, gustavo): registra as próprias decisões. */
  person_key: string | null;
}

export interface DocArchiveSummary {
  total: number;
  aprovado: number;
  pendente: number;
  nao_utilizavel: number;
}

export interface DocBoard {
  project: DocProject;
  event: DocEventInfo | null;
  people: DocPerson[];
  sections: DocSection[];
  versions: DocProjectVersion[];
  comments: DocComment[];
  approvals: DocApprovalItem[];
  shoots: DocShoot[];
  questions: DocQuestion[];
  takes: DocTake[];
  checklist: DocChecklistItem[];
  shootChecks: DocShootCheck[];
  archiveSummary: DocArchiveSummary;
  team: DocTeamMember[];
  viewer: DocViewer;
}

/* ------------------------------------------------------------------ rótulos */

export const DECISION_LABELS: Record<DecisionStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  ajustar: "Aprovado com ajuste",
  recusado: "Recusado",
};

export const STAGE_LABELS: Record<ApprovalStage, { title: string; hint: string }> = {
  validacao: { title: "Antes da gravação", hint: "O que precisa de ok dos sócios para gravar (seção 19)." },
  editorial: { title: "Aprovação do filme · editorial", hint: "Critérios para aprovar a montagem (seção 18)." },
  producao: { title: "Aprovação do filme · produção e direitos", hint: "Autorizações e testes antes da exibição (seção 18)." },
};

export const SHOOT_KIND_LABELS: Record<ShootKind, string> = {
  pre_entrevista: "Pré-entrevista",
  entrevista: "Entrevista",
  conversa_conjunta: "Conversa conjunta",
  broll: "B-roll",
  outro: "Outra captação",
};

export const SHOOT_STATUS_LABELS: Record<ShootStatus, string> = {
  a_marcar: "A marcar",
  marcada: "Marcada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

export const AUDIENCE_LABELS: Record<QuestionAudience, string> = {
  ricardo: "Ricardo",
  gustavo: "Gustavo",
  comum: "Comuns",
  aprofundamento: "Aprofundamento",
};

export const PHASE_LABELS: Record<ChecklistPhase, string> = {
  antes: "Antes das entrevistas",
  dia: "No dia da captação",
  montagem: "Na montagem",
  festa: "Antes da festa",
};

export const ARCHIVE_STATUS_LABELS: Record<ArchiveStatus, string> = {
  aprovado: "Aprovado",
  pendente: "Pendente",
  nao_utilizavel: "Não utilizável",
};

export const AUTHORIZATION_LABELS: Record<AuthorizationStatus, string> = {
  pendente: "Autorização pendente",
  autorizado: "Autorizado",
  nao_autorizado: "Não autorizado",
  nao_precisa: "Não precisa",
};

/** Usos, um a um: a autorização para a festa não vale para os outros (seção 17). */
export const ARCHIVE_USES: { key: string; label: string }[] = [
  { key: "festa", label: "Exibição na festa" },
  { key: "versao_estendida", label: "Versão estendida" },
  { key: "redes", label: "Redes sociais" },
  { key: "site", label: "Site" },
  { key: "propostas", label: "Propostas comerciais" },
  { key: "arquivo_interno", label: "Arquivo interno" },
];

/** Categorias da tabela de acervo (seção 13). */
export const ARCHIVE_CATEGORIES = [
  "Origens pessoais",
  "Fundação",
  "Primeira operação",
  "Mudanças",
  "Pessoas",
  "Clientes e parceiros",
  "Reconhecimento",
  "Presente",
] as const;

/** Anos do filtro do acervo: antes da fundação, 2016 a 2026 e sem ano. */
export const ARCHIVE_FIRST_YEAR = 2016;
export const ARCHIVE_LAST_YEAR = 2026;

/* ------------------------------------------------------------------ regras */

export function archiveCode(seq: number): string {
  return `AC-${String(seq).padStart(4, "0")}`;
}

export function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function slugify(text: string): string {
  return normalizeForSearch(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Decisão vigente de uma pessoa (a mais recente); sem decisão = pendente. */
export function currentDecision(item: DocApprovalItem, personKey: string): DocDecision | null {
  return item.decisions.find((decision) => decision.person_key === personKey) ?? null;
}

export function currentStatus(item: DocApprovalItem, personKey: string): DecisionStatus {
  return currentDecision(item, personKey)?.status ?? "pendente";
}

/** Situação do item: pendente enquanto alguém não decidiu; senão a pior decisão. */
export function itemStatus(item: DocApprovalItem): DecisionStatus {
  const statuses = item.approvers.map((key) => currentStatus(item, key));
  if (statuses.length === 0 || statuses.includes("pendente")) return "pendente";
  if (statuses.includes("recusado")) return "recusado";
  if (statuses.includes("ajustar")) return "ajustar";
  return "aprovado";
}

/** Alguém já decidiu, mas falta outra pessoa. */
export function isPartiallyDecided(item: DocApprovalItem): boolean {
  const statuses = item.approvers.map((key) => currentStatus(item, key));
  return statuses.includes("pendente") && statuses.some((status) => status !== "pendente");
}

/** Data (AAAA-MM-DD) N dias antes da festa. */
export function daysBefore(eventDate: string, days: number): string {
  const date = new Date(`${eventDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Quantos dias faltam de `from` até `to` (datas AAAA-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000);
}

export function todayInSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export interface RelativePhase {
  from: number;
  to: number;
  text: string;
}

/** "- **D-21 a D-15:** validar conceito…" → fases do cronograma relativo (seção 16). */
export function parseRelativeSchedule(body: string): RelativePhase[] {
  const phases: RelativePhase[] = [];
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*-\s*\*\*D-(\d+)\s*a\s*D-(\d+):\*\*\s*(.+)$/);
    if (match) phases.push({ from: Number(match[1]), to: Number(match[2]), text: match[3].trim() });
  }
  return phases;
}

/** Janela de referência de cada tipo de gravação no cronograma relativo. */
export function shootWindow(kind: ShootKind, phases: RelativePhase[]): RelativePhase | null {
  const find = (pattern: RegExp) => phases.find((phase) => pattern.test(normalizeForSearch(phase.text))) ?? null;
  if (kind === "pre_entrevista") return find(/pre-entrevista/);
  if (kind === "entrevista" || kind === "conversa_conjunta" || kind === "broll") return find(/gravar entrevistas|b-roll/);
  return null;
}

/** Linhas de uma tabela markdown (sem cabeçalho e separador). */
export function parseMarkdownTable(body: string): string[][] {
  const rows = body
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) =>
      line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
  return rows.filter((cells, index) => index > 0 && !cells.every((cell) => /^:?-{2,}:?$/.test(cell)));
}

export function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").trim();
}

/** "00:35–01:20" → [35, 80] segundos. */
export function parseTimeRange(text: string): [number, number] | null {
  const match = stripMarkdown(text).match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  return end > start ? [start, end] : null;
}

export interface TimelineBlock {
  start: number;
  end: number;
  title: string;
  audio: string | null;
  image: string | null;
}

/** Tabela "Tempo | Bloco | Áudio | Imagem" (seção 7) ou "Tempo | Conteúdo" (seção 8). */
export function parseTimeline(body: string): TimelineBlock[] {
  return parseMarkdownTable(body).flatMap((cells) => {
    const range = parseTimeRange(cells[0] ?? "");
    if (!range) return [];
    if (cells.length >= 4) {
      return [{ start: range[0], end: range[1], title: stripMarkdown(cells[1]), audio: stripMarkdown(cells[2]) || null, image: stripMarkdown(cells[3]) || null }];
    }
    return [{ start: range[0], end: range[1], title: stripMarkdown(cells[1] ?? ""), audio: null, image: null }];
  });
}

export interface DocChapter {
  key: string;
  label: string;
  title: string;
  summary: string;
}

/** "### Capítulo 1 — Quando os caminhos se encontraram" (seção 6) → capítulos do filme. */
export function parseChapters(body: string): DocChapter[] {
  const chapters: DocChapter[] = [];
  let current: DocChapter | null = null;
  for (const line of body.split("\n")) {
    const heading = line.match(/^###\s+(.+?)\s+—\s+(.+)$/);
    if (heading) {
      current = { key: slugify(heading[1]), label: heading[1].trim(), title: heading[2].trim(), summary: "" };
      chapters.push(current);
      continue;
    }
    if (current && line.trim()) current.summary = `${current.summary} ${stripMarkdown(line)}`.trim();
  }
  return chapters;
}

export interface EmotionalStep {
  title: string;
  text: string;
}

/** "1. **Curiosidade:** quem eram…" dentro de "### 3.6 Curva emocional" (seção 3). */
export function parseEmotionalCurve(body: string): EmotionalStep[] {
  const start = body.search(/###\s+[\d.]*\s*Curva emocional/i);
  if (start < 0) return [];
  const steps: EmotionalStep[] = [];
  for (const line of body.slice(start).split("\n").slice(1)) {
    if (line.startsWith("###")) break;
    const match = line.match(/^\s*\d+\.\s*\*\*(.+?):\*\*\s*(.+)$/);
    if (match) steps.push({ title: match[1].trim(), text: match[2].trim() });
  }
  return steps;
}

/** 350 → "5min50s". */
export function formatFilmDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}min${String(rest).padStart(2, "0")}s` : `${minutes}min`;
}

/** 95 → "01:35"; 3725 → "1:02:05". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(rest).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Tempo corrido do cronômetro da gravação. */
export function timerSeconds(shoot: Pick<DocShoot, "timer_started_at" | "timer_elapsed_seconds">, now = Date.now()): number {
  const running = shoot.timer_started_at ? Math.max(0, (now - new Date(shoot.timer_started_at).getTime()) / 1000) : 0;
  return shoot.timer_elapsed_seconds + running;
}

/** "AAAA-MM-DD" → "17/12". */
export function formatDayMonth(iso: string | null): string {
  if (!iso) return "";
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-12-03" → "qui, 03/12". */
export function formatWeekdayDate(iso: string | null): string {
  if (!iso) return "";
  const weekday = WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return `${weekday}, ${formatDayMonth(iso)}`;
}

/** "19:00:00" → "19h"; "19:30" → "19h30". */
export function formatHour(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  return minutes && minutes !== "00" ? `${Number(hours)}h${minutes}` : `${Number(hours)}h`;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2).replace(".", ",")} GB`;
}

export function archiveKindFromMime(mime: string | null, fileName: string): ArchiveKind {
  const type = (mime ?? "").toLowerCase();
  if (type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif|tiff?|bmp)$/i.test(fileName)) return "foto";
  if (type.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv|mts)$/i.test(fileName)) return "video";
  if (type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(fileName)) return "audio";
  return "documento";
}
