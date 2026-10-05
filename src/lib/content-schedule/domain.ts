import { resolveFeriasAccess, type FeriasAccessMode } from "@/lib/ferias/access";
import {
  departmentMatchesAreaFilter,
  resolveCanonicalAreaLabel,
  resolveAreaFilterLabel,
} from "@/lib/ferias/filters";

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
/** Distância máxima para ligar a mesma pessoa a uma data remarcada sem histórico. */
export const VIOS_NEARBY_DAYS = 14;

export interface SchedulableViosTask {
  id: string;
  date: string | null;
  area: string | null;
  assigneeId: string | null;
  label: string | null;
  cancelled: boolean;
  linkedSlotId?: string | null;
  ci?: string;
  /** Data antes da última remarcação no VIOS. */
  previousDate?: string | null;
}

export interface ViosScheduleSlot {
  id: string;
  date: string;
  area: string;
  collaboratorId: string | null;
  cancelled: boolean;
  viosTaskId: string | null;
}

export interface ViosScheduleMatch {
  taskId: string;
  slotId: string;
  strategy: "identity" | "rescheduled" | "group" | "pair" | "nearby";
  /** O VIOS manda: data para onde o slot deve ir junto com o vínculo. */
  moveSlotTo?: string;
}

export interface ViosScheduleReconciliation {
  matches: ViosScheduleMatch[];
  ambiguousTaskIds: string[];
  unmatchedTaskIds: string[];
}

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

/** Rótulo oficial para exibição e agrupamento na interface. */
export function resolveContentScheduleAreaLabel(
  value: string | null | undefined
): string | null {
  return resolveCanonicalAreaLabel(value);
}

/** Rótulo oficial disponível no filtro; `null` representa uma área oculta. */
export function resolveContentScheduleAreaFilterLabel(
  value: string | null | undefined
): string | null {
  return resolveAreaFilterLabel(value);
}

/** Correspondência oficial entre departamento de colaborador e filtro de área. */
export function collaboratorMatchesScheduleArea(
  department: string | null | undefined,
  area: string
): boolean {
  return departmentMatchesAreaFilter(department, area);
}

export function isProtocolViosTask(label: string | null | undefined): boolean {
  return (label ?? "").trim().toLocaleUpperCase("pt-BR") === "PROTOCOLO";
}

export function viosAreaMatchesScheduleArea(
  viosArea: string | null | undefined,
  scheduleArea: string
): boolean {
  return departmentMatchesAreaFilter(viosArea, scheduleArea);
}

function isEligibleViosTask(task: SchedulableViosTask): boolean {
  return Boolean(
    !task.cancelled &&
    isProtocolViosTask(task.label) &&
    task.date &&
    civilDay(task.date) !== null &&
    task.area?.trim()
  );
}

function baseViosSlotCandidates(
  task: SchedulableViosTask,
  slots: readonly ViosScheduleSlot[]
): ViosScheduleSlot[] {
  if (!isEligibleViosTask(task) || !task.date) return [];
  return slots.filter((slot) =>
    !slot.cancelled &&
    slot.viosTaskId === null &&
    slot.date === task.date &&
    viosAreaMatchesScheduleArea(task.area, slot.area) &&
    !(task.assigneeId && slot.collaboratorId && task.assigneeId !== slot.collaboratorId)
  );
}

/**
 * Planeja vínculos anuais sem efeitos colaterais. O VIOS manda na data: quando
 * o par vem de uma remarcação ou de uma data próxima, o slot deve ir para a
 * data da tarefa (`moveSlotTo`). Ordem, da mais segura para a menos:
 * mesma pessoa no dia; remarcação (data anterior); grupo 1:1 no dia; pares de
 * tarefas sem responsável no mesmo dia e área; mesma pessoa em até 14 dias.
 */
export function reconcileAutomaticViosLinks(
  tasks: readonly SchedulableViosTask[],
  slots: readonly ViosScheduleSlot[]
): ViosScheduleReconciliation {
  const eligibleTasks = tasks.filter((task) => isEligibleViosTask(task) && !task.linkedSlotId);
  const availableSlots = slots.filter((slot) => !slot.cancelled && slot.viosTaskId === null);
  const matches: ViosScheduleMatch[] = [];
  const matchedTasks = new Set<string>();
  const matchedSlots = new Set<string>();
  const remainingTasks = () => eligibleTasks.filter((task) => !matchedTasks.has(task.id));
  const remainingSlots = () => availableSlots.filter((slot) => !matchedSlots.has(slot.id));

  const accept = (task: SchedulableViosTask, slot: ViosScheduleSlot, strategy: ViosScheduleMatch["strategy"]) => {
    matchedTasks.add(task.id);
    matchedSlots.add(slot.id);
    matches.push({
      taskId: task.id,
      slotId: slot.id,
      strategy,
      ...(task.date && task.date !== slot.date ? { moveSlotTo: task.date } : {}),
    });
  };

  const matchUnique = (
    strategy: ViosScheduleMatch["strategy"],
    candidatesFor: (task: SchedulableViosTask, pool: ViosScheduleSlot[]) => ViosScheduleSlot[] | null
  ) => {
    const pool = remainingSlots();
    const candidatesByTask = new Map<string, ViosScheduleSlot[]>();
    for (const task of remainingTasks()) {
      const candidates = candidatesFor(task, pool);
      if (candidates) candidatesByTask.set(task.id, candidates);
    }
    const taskIdsBySlot = new Map<string, string[]>();
    for (const [taskId, candidates] of candidatesByTask) {
      for (const candidate of candidates) {
        taskIdsBySlot.set(candidate.id, [...(taskIdsBySlot.get(candidate.id) ?? []), taskId]);
      }
    }
    for (const task of remainingTasks()) {
      const candidates = candidatesByTask.get(task.id) ?? [];
      if (candidates.length !== 1) continue;
      const [candidate] = candidates;
      if ((taskIdsBySlot.get(candidate.id) ?? []).length !== 1) continue;
      accept(task, candidate, strategy);
    }
  };

  const sameAreaOpen = (task: SchedulableViosTask, slot: ViosScheduleSlot) =>
    !slot.cancelled &&
    slot.viosTaskId === null &&
    viosAreaMatchesScheduleArea(task.area, slot.area) &&
    !(task.assigneeId && slot.collaboratorId && task.assigneeId !== slot.collaboratorId);

  matchUnique("identity", (task, pool) =>
    task.assigneeId ? baseViosSlotCandidates(task, pool).filter((slot) => slot.collaboratorId === task.assigneeId) : null
  );

  matchUnique("rescheduled", (task, pool) => {
    if (!task.previousDate || task.previousDate === task.date) return null;
    const candidates = pool.filter((slot) => slot.date === task.previousDate && sameAreaOpen(task, slot));
    const samePerson = task.assigneeId ? candidates.filter((slot) => slot.collaboratorId === task.assigneeId) : [];
    return samePerson.length > 0 ? samePerson : candidates;
  });

  matchUnique("group", (task, pool) => baseViosSlotCandidates(task, pool));

  // Várias tarefas sem responsável no mesmo dia e área são equivalentes entre si:
  // quando a quantidade bate com as vagas abertas, liga em pares estáveis.
  {
    const pool = remainingSlots();
    const groups = new Map<string, { tasks: SchedulableViosTask[]; slots: ViosScheduleSlot[] }>();
    const slotOwners = new Map<string, Set<string>>();
    const withIdentity = new Set<string>();
    for (const task of remainingTasks()) {
      const candidates = baseViosSlotCandidates(task, pool);
      if (candidates.length === 0) continue;
      const key = candidates.map((slot) => slot.id).sort().join("|");
      for (const slot of candidates) slotOwners.set(slot.id, (slotOwners.get(slot.id) ?? new Set()).add(key));
      // Uma tarefa com responsável que não achou par exato torna o grupo incerto.
      if (task.assigneeId) {
        withIdentity.add(key);
        continue;
      }
      const group = groups.get(key) ?? { tasks: [], slots: candidates };
      group.tasks.push(task);
      groups.set(key, group);
    }
    for (const [key, group] of groups) {
      if (withIdentity.has(key)) continue;
      if (group.tasks.length < 2 || group.tasks.length !== group.slots.length) continue;
      if (group.slots.some((slot) => (slotOwners.get(slot.id)?.size ?? 0) !== 1 || !slotOwners.get(slot.id)?.has(key))) continue;
      const orderedTasks = [...group.tasks].sort((a, b) => (a.ci ?? a.id).localeCompare(b.ci ?? b.id, "pt-BR", { numeric: true }));
      const orderedSlots = [...group.slots].sort((a, b) => a.id.localeCompare(b.id));
      orderedTasks.forEach((task, index) => accept(task, orderedSlots[index], "pair"));
    }
  }

  matchUnique("nearby", (task, pool) => {
    const taskDay = task.date ? civilDay(task.date) : null;
    if (!task.assigneeId || taskDay === null) return null;
    return pool.filter((slot) => {
      const slotDay = civilDay(slot.date);
      return slot.collaboratorId === task.assigneeId &&
        slotDay !== null &&
        Math.abs(slotDay - taskDay) <= VIOS_NEARBY_DAYS &&
        sameAreaOpen(task, slot);
    });
  });

  const unmatched = remainingTasks();
  const finalSlots = remainingSlots();
  const ambiguousTaskIds: string[] = [];
  const unmatchedTaskIds: string[] = [];
  for (const task of unmatched) {
    const candidates = baseViosSlotCandidates(task, finalSlots);
    if (candidates.length > 1 || candidates.some((slot) =>
      unmatched.some((other) =>
        other.id !== task.id && baseViosSlotCandidates(other, finalSlots).some((item) => item.id === slot.id)
      )
    )) ambiguousTaskIds.push(task.id);
    else unmatchedTaskIds.push(task.id);
  }
  return { matches, ambiguousTaskIds, unmatchedTaskIds };
}

/** Candidatos para decisão humana: mesma área e até 14 dias. */
export function findViosCandidatesForSlot(
  slot: ViosScheduleSlot,
  tasks: readonly SchedulableViosTask[]
): SchedulableViosTask[] {
  const slotDay = civilDay(slot.date);
  if (slotDay === null || slot.cancelled) return [];
  return tasks
    .filter((task) => {
      const taskDay = task.date ? civilDay(task.date) : null;
      return isEligibleViosTask(task) &&
        taskDay !== null &&
        Math.abs(taskDay - slotDay) <= 14 &&
        viosAreaMatchesScheduleArea(task.area, slot.area) &&
        (!task.linkedSlotId || task.linkedSlotId === slot.id);
    })
    .sort((left, right) => {
      const leftDay = civilDay(left.date!)!;
      const rightDay = civilDay(right.date!)!;
      const leftExact = leftDay === slotDay ? 0 : 1;
      const rightExact = rightDay === slotDay ? 0 : 1;
      const leftPerson = left.assigneeId && left.assigneeId === slot.collaboratorId ? 0 : 1;
      const rightPerson = right.assigneeId && right.assigneeId === slot.collaboratorId ? 0 : 1;
      return leftExact - rightExact ||
        leftPerson - rightPerson ||
        Math.abs(leftDay - slotDay) - Math.abs(rightDay - slotDay) ||
        (left.ci ?? left.id).localeCompare(right.ci ?? right.id);
    });
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
  return access.manageableAreas.some((allowed) => departmentMatchesAreaFilter(area, allowed));
}

export function canManageContentScheduleAssignments(access: ContentScheduleAccess): boolean {
  return access.manageAll ||
    access.manageableAreas === null ||
    access.manageableAreas.length > 0;
}

export function canReadContentScheduleSlot(
  access: ContentScheduleAccess,
  slot: Pick<ContentScheduleSlot, "area" | "collaboratorId">
): boolean {
  if (canManageContentScheduleAssignments(access)) {
    return canAssignContentScheduleArea(access, slot.area);
  }
  return access.canReadOwn && access.ownCollaboratorId === slot.collaboratorId;
}
