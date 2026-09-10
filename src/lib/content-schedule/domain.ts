import { resolveFeriasAccess, type FeriasAccessMode } from "@/lib/ferias/access";

export type ContentFormat = "post" | "reel";

export interface ContentScheduleSlot {
  id: string;
  /** Data civil ISO, `YYYY-MM-DD`. */
  date: string;
  area: string;
  format: ContentFormat;
  collaboratorId: string;
  contentId: string | null;
  cancelled: boolean;
}

export interface SchedulableContentEvent {
  id: string;
  /** Data civil ISO usada como centro da janela de associação. */
  date: string;
  area: string;
  format: ContentFormat;
  collaboratorId: string;
  sourceUrl?: string | null;
  title?: string | null;
  text?: string | null;
}

export type SlotMatchResult =
  | { status: "already_linked"; slotId: string }
  | { status: "matched"; slotId: string; distanceDays: number }
  | { status: "ambiguous"; candidateSlotIds: string[]; distanceDays: number }
  | { status: "not_found" };

const DAY_MS = 86_400_000;

function civilDay(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const value = Date.UTC(year, month - 1, day);
  const parsed = new Date(value);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;
  return Math.floor(value / DAY_MS);
}

function scheduleAreaKey(value: string): string {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[().]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Vocabulário de conteúdo; não aplica o agrupamento administrativo de Férias. */
export function normalizeScheduleArea(value: string | null | undefined): string | null {
  const key = scheduleAreaKey(value ?? "");
  if (!key) return null;
  if (["insolvencia", "reestruturacao", "reestruturacao insolvencia"].includes(key)) {
    return "reestruturacao";
  }
  if (["contratos", "societario e contrato", "societario e contratos"].includes(key)) {
    return "societario e contratos";
  }
  if (["operacoes legais", "operacoes legais legal ops", "legal ops"].includes(key)) {
    return "operacoes legais";
  }
  if (["distressed deals", "distressed deals - special situations", "special situations"].includes(key)) {
    return "special situations";
  }
  return key;
}

/**
 * Propõe uma associação sem alterar estado. Um vínculo existente ganha sempre,
 * inclusive em retry após o slot mudar ou ser cancelado.
 */
export function findAutomaticSlotMatch(
  event: SchedulableContentEvent,
  slots: readonly ContentScheduleSlot[]
): SlotMatchResult {
  const linked = slots
    .filter((candidate) =>
      candidate.contentId === event.id &&
      candidate.collaboratorId === event.collaboratorId &&
      candidate.format === event.format
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (linked) return { status: "already_linked", slotId: linked.id };

  const eventDay = civilDay(event.date);
  if (eventDay === null) return { status: "not_found" };

  const eligible = slots
    .flatMap((candidate) => {
      const candidateDay = civilDay(candidate.date);
      if (candidateDay === null) return [];
      const distanceDays = Math.abs(candidateDay - eventDay);
      if (
        candidate.cancelled ||
        candidate.contentId !== null ||
        candidate.collaboratorId !== event.collaboratorId ||
        candidate.format !== event.format ||
        normalizeScheduleArea(candidate.area) !== normalizeScheduleArea(event.area) ||
        distanceDays > 14
      ) return [];
      return [{ slot: candidate, distanceDays }];
    })
    .sort((a, b) => a.distanceDays - b.distanceDays || a.slot.id.localeCompare(b.slot.id));

  if (!eligible.length) return { status: "not_found" };
  const nearest = eligible[0].distanceDays;
  const tied = eligible.filter((candidate) => candidate.distanceDays === nearest);
  if (tied.length > 1) {
    return {
      status: "ambiguous",
      candidateSlotIds: tied.map((candidate) => candidate.slot.id),
      distanceDays: nearest,
    };
  }
  return { status: "matched", slotId: tied[0].slot.id, distanceDays: nearest };
}

export type ContentProductionStatus = "published" | "in_production";

export interface ContentSimilarityCandidate {
  id: string;
  status: ContentProductionStatus;
  sourceUrl?: string | null;
  title?: string | null;
  text?: string | null;
}

export interface ContentSimilarityWarning {
  candidateId: string;
  candidateStatus: ContentProductionStatus;
  kind: "exact_source" | "similar_topic";
  evidence: Array<"source_url" | "shared_terms">;
  /** 0..1, útil para ordenar/exibir; não representa bloqueio editorial. */
  score: number;
  blocking: false;
}

function canonicalSourceUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      const normalized = key.toLowerCase();
      if (normalized.startsWith("utm_") || ["fbclid", "gclid"].includes(normalized)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.searchParams.sort();
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.hostname}${parsed.pathname}${parsed.search}`;
  } catch {
    return raw.toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

const TOPIC_STOP_WORDS = new Set([
  "a", "ao", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas",
  "no", "nos", "o", "os", "para", "por", "que", "sobre", "um", "uma",
]);

function topicTerms(...values: Array<string | null | undefined>): Set<string> {
  const normalized = values.join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return new Set(
    normalized.split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3 && !TOPIC_STOP_WORDS.has(term))
  );
}

function topicSimilarity(left: Set<string>, right: Set<string>): { score: number; shared: number } {
  if (!left.size || !right.size) return { score: 0, shared: 0 };
  let shared = 0;
  for (const term of left) if (right.has(term)) shared += 1;
  return { score: shared / new Set([...left, ...right]).size, shared };
}

/** Retorna alertas consultivos; fonte idêntica tem precedência sobre semelhança temática. */
export function findContentSimilarityWarnings(
  input: Pick<SchedulableContentEvent, "sourceUrl" | "title" | "text">,
  candidates: readonly ContentSimilarityCandidate[]
): ContentSimilarityWarning[] {
  const source = canonicalSourceUrl(input.sourceUrl);
  const terms = topicTerms(input.title, input.text);

  return candidates.flatMap<ContentSimilarityWarning>((candidate) => {
    if (source && source === canonicalSourceUrl(candidate.sourceUrl)) {
      return [{
        candidateId: candidate.id,
        candidateStatus: candidate.status,
        kind: "exact_source" as const,
        evidence: ["source_url" as const],
        score: 1,
        blocking: false as const,
      }];
    }
    const similarity = topicSimilarity(terms, topicTerms(candidate.title, candidate.text));
    if (similarity.shared < 2 || similarity.score < 0.25) return [];
    return [{
      candidateId: candidate.id,
      candidateStatus: candidate.status,
      kind: "similar_topic" as const,
      evidence: ["shared_terms" as const],
      score: Number(similarity.score.toFixed(4)),
      blocking: false as const,
    }];
  });
}

export interface ContentScheduleAccessInput {
  userId: string;
  isActive: boolean;
  role: string | null | undefined;
  permissions: string[] | null | undefined;
  accessMode: FeriasAccessMode | null | undefined;
  areaScope: string[] | null | undefined;
  position: string | null | undefined;
  department: string | null | undefined;
}

export interface ContentScheduleAccess {
  manageAll: boolean;
  /** `null` significa todas as áreas; `[]`, nenhuma área gerenciável. */
  manageableAreas: string[] | null;
  canReadOwn: boolean;
  ownCollaboratorId: string | null;
}

export function resolveContentScheduleAccess(input: ContentScheduleAccessInput): ContentScheduleAccess {
  if (!input.isActive) {
    return { manageAll: false, manageableAreas: [], canReadOwn: false, ownCollaboratorId: null };
  }
  // Mantém o contrato de gestão de conteúdo existente: designer representa a
  // equipe de Marketing mesmo quando o cadastro departamental é Operações.
  const role = (input.role ?? "").trim().toLowerCase();
  const globalManager = role === "admin" || role === "designer" ||
    input.department?.trim().toLowerCase() === "marketing";

  if (globalManager) {
    return { manageAll: true, manageableAreas: null, canReadOwn: input.isActive, ownCollaboratorId: input.isActive ? input.userId : null };
  }

  // Reutiliza apenas a lógica de liderança/escopo. Permissões de RH são
  // intencionalmente removidas para nunca virarem administração de Marketing.
  const leadership = resolveFeriasAccess({
    role: null,
    permissions: [],
    accessMode: input.accessMode,
    areaScope: input.areaScope,
    position: input.position,
    department: input.department,
  });
  return {
    manageAll: false,
    manageableAreas: leadership.level === "viewer" ? leadership.areas : [],
    canReadOwn: input.isActive,
    ownCollaboratorId: input.isActive ? input.userId : null,
  };
}

export function canAssignContentScheduleArea(access: ContentScheduleAccess, area: string): boolean {
  if (access.manageAll || access.manageableAreas === null) return true;
  return access.manageableAreas.some(
    (allowed) => normalizeScheduleArea(area) === normalizeScheduleArea(allowed)
  );
}

export function canReadContentScheduleSlot(
  access: ContentScheduleAccess,
  slot: Pick<ContentScheduleSlot, "area" | "collaboratorId">
): boolean {
  return canAssignContentScheduleArea(access, slot.area) ||
    (access.canReadOwn && access.ownCollaboratorId === slot.collaboratorId);
}
