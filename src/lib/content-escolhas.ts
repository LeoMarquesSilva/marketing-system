/**
 * Escolhas da equipe no Gerador de conteúdo: quem escolheu cada matéria, quem
 * trouxe por link, quem descartou e onde cada uma parou. Módulo puro (sem
 * servidor), usado pela API, pela tela de Escolhas e pelo histórico do post.
 */
import { isContentManager, LEGAL_AREAS, type ContentAccessProfile } from "@/lib/content-areas";

export const CONTENT_CHOICES_PATH = "/conteudo/escolhas";

/** Escolha parada com o gestor depois de tantos dias vira alerta. */
export const STALLED_REVIEW_DAYS = 7;
/** Gestor aprovou e ninguém enviou ao Marketing depois de tantos dias. */
export const STALLED_SEND_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Quem vê a aba no menu: Marketing, admin e designer (todas as áreas) e líderes
 * de área (a API recorta pelas áreas que a pessoa enxerga).
 */
export function canSeeContentChoices(
  profile: (ContentAccessProfile & { ferias_view_enabled?: boolean | null }) | null | undefined,
): boolean {
  if (!profile) return false;
  return isContentManager(profile) || profile.ferias_view_enabled === true;
}

export interface EscolhaPerson {
  id: string | null;
  name: string;
  avatarUrl: string | null;
  department: string | null;
}

/** Linha de content_roteiros com as colunas de acompanhamento (sem os textos do post). */
export interface EscolhaSourceRow {
  id: string;
  title: string;
  link: string | null;
  area: string;
  status: string;
  image_url?: string | null;
  source?: string | null;
  created_at: string;
  published_at?: string | null;
  approved_by_id?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  created_by_id?: string | null;
  created_by_name?: string | null;
  edited_by_id?: string | null;
  edited_by_name?: string | null;
  edited_at?: string | null;
  has_alterations?: boolean | null;
  reviewer_approved_at?: string | null;
  sent_to_mkt_at?: string | null;
  sent_to_mkt_by_name?: string | null;
  rejected_by_id?: string | null;
  rejected_by_name?: string | null;
  rejected_at?: string | null;
}

export interface EscolhaUserRow {
  id: string;
  name: string | null;
  avatar_url?: string | null;
  department?: string | null;
}

export interface EscolhaItem {
  id: string;
  title: string;
  link: string | null;
  area: string;
  status: string;
  imageUrl: string | null;
  /** "manual" = alguém colou o link; senão veio da busca de notícias. */
  fromLink: boolean;
  createdAt: string;
  publishedAt: string | null;
  createdBy: EscolhaPerson | null;
  chosenBy: EscolhaPerson | null;
  chosenAt: string | null;
  editedBy: EscolhaPerson | null;
  editedAt: string | null;
  hasAlterations: boolean;
  reviewerApprovedAt: string | null;
  sentBy: EscolhaPerson | null;
  sentAt: string | null;
  rejectedBy: EscolhaPerson | null;
  rejectedAt: string | null;
}

export type EscolhaStage = "disponivel" | "escolhida" | "gestor_aprovou" | "enviada" | "descartada";

export const ESCOLHA_STAGE_LABELS: Record<EscolhaStage, string> = {
  disponivel: "Disponível",
  escolhida: "Em revisão com o gestor",
  gestor_aprovou: "Gestor aprovou",
  enviada: "Enviada ao Marketing",
  descartada: "Descartada",
};

export function stageOfStatus(status: string): EscolhaStage {
  if (status === "enviado_mkt") return "enviada";
  if (status === "aprovado_revisor") return "gestor_aprovou";
  if (status === "em_revisao" || status === "aprovado") return "escolhida";
  if (status === "rejeitado") return "descartada";
  return "disponivel";
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("pt-BR");
}

/**
 * Resolve as pessoas pelo id (nome atual, foto e área do cadastro) e, quando só
 * houver o nome gravado (ex.: quem enviou ao Marketing), pelo nome.
 */
export function createPersonResolver(users: EscolhaUserRow[]) {
  const byId = new Map(users.map((user) => [user.id, user]));
  const byName = new Map<string, EscolhaUserRow>();
  for (const user of users) {
    if (user.name) byName.set(normalizeName(user.name), user);
  }
  const toPerson = (user: EscolhaUserRow, fallbackName: string | null): EscolhaPerson => ({
    id: user.id,
    name: user.name?.trim() || fallbackName?.trim() || "Sem nome",
    avatarUrl: user.avatar_url ?? null,
    department: user.department ?? null,
  });
  return (id: string | null | undefined, name: string | null | undefined): EscolhaPerson | null => {
    const user = (id ? byId.get(id) : undefined) ?? (name ? byName.get(normalizeName(name)) : undefined);
    if (user) return toPerson(user, name ?? null);
    if (!name?.trim()) return null;
    return { id: id ?? null, name: name.trim(), avatarUrl: null, department: null };
  };
}

export function buildEscolhaItems(rows: EscolhaSourceRow[], users: EscolhaUserRow[]): EscolhaItem[] {
  const resolve = createPersonResolver(users);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    link: row.link,
    area: row.area,
    status: row.status,
    imageUrl: row.image_url ?? null,
    fromLink: row.source === "manual",
    createdAt: row.created_at,
    publishedAt: row.published_at ?? null,
    createdBy: row.source === "manual" ? resolve(row.created_by_id, row.created_by_name) : null,
    chosenBy: resolve(row.approved_by_id, row.approved_by_name),
    chosenAt: row.approved_at ?? null,
    editedBy: row.has_alterations ? resolve(row.edited_by_id, row.edited_by_name) : null,
    editedAt: row.has_alterations ? row.edited_at ?? null : null,
    hasAlterations: Boolean(row.has_alterations),
    reviewerApprovedAt: row.reviewer_approved_at ?? null,
    sentBy: resolve(null, row.sent_to_mkt_by_name),
    sentAt: row.sent_to_mkt_at ?? null,
    rejectedBy: resolve(row.rejected_by_id, row.rejected_by_name),
    rejectedAt: row.rejected_at ?? null,
  }));
}

/** Ids e nomes de pessoas que a API precisa buscar em `users`. */
export function collectPersonRefs(rows: EscolhaSourceRow[]): { ids: string[]; names: string[] } {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const row of rows) {
    for (const id of [row.approved_by_id, row.created_by_id, row.edited_by_id, row.rejected_by_id]) {
      if (id) ids.add(id);
    }
    if (row.sent_to_mkt_by_name?.trim()) names.add(row.sent_to_mkt_by_name.trim());
  }
  return { ids: [...ids], names: [...names] };
}

/** Data da decisão que coloca a matéria na linha do tempo. */
export function decisionDate(item: EscolhaItem): string {
  return item.chosenAt ?? item.rejectedAt ?? item.createdAt;
}

/** Quem decidiu: escolheu, descartou ou trouxe por link. */
export function decisionActor(item: EscolhaItem): { person: EscolhaPerson | null; verb: string } {
  if (item.chosenBy) return { person: item.chosenBy, verb: "escolheu" };
  if (item.status === "rejeitado") return { person: item.rejectedBy, verb: "descartou" };
  if (item.createdBy) return { person: item.createdBy, verb: "trouxe por link" };
  return { person: null, verb: "" };
}

export type EscolhaPeriod = "30d" | "90d" | "ano" | "tudo";

export const ESCOLHA_PERIOD_LABELS: Record<EscolhaPeriod, string> = {
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  ano: "Este ano",
  tudo: "Desde o início",
};

export function periodStart(period: EscolhaPeriod, now = new Date()): Date | null {
  if (period === "tudo") return null;
  if (period === "ano") return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getTime() - (period === "30d" ? 30 : 90) * DAY_MS);
}

export function filterByPeriod(items: EscolhaItem[], period: EscolhaPeriod, now = new Date()): EscolhaItem[] {
  const start = periodStart(period, now);
  if (!start) return items;
  return items.filter((item) => new Date(decisionDate(item)) >= start);
}

function personKey(person: EscolhaPerson): string {
  return person.id ?? `nome:${normalizeName(person.name)}`;
}

export interface PersonSummary {
  key: string;
  person: EscolhaPerson;
  chosen: number;
  inReview: number;
  managerApproved: number;
  sent: number;
  rejected: number;
  fromLink: number;
  areas: string[];
  lastAt: string;
  items: EscolhaItem[];
}

/** Uma linha por pessoa, com o que ela escolheu, trouxe por link e descartou. */
export function summarizeByPerson(items: EscolhaItem[]): PersonSummary[] {
  const map = new Map<string, PersonSummary>();
  const touch = (person: EscolhaPerson, item: EscolhaItem, at: string) => {
    const key = personKey(person);
    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        person,
        chosen: 0,
        inReview: 0,
        managerApproved: 0,
        sent: 0,
        rejected: 0,
        fromLink: 0,
        areas: [],
        lastAt: at,
        items: [],
      };
      map.set(key, entry);
    }
    if (!entry.items.includes(item)) entry.items.push(item);
    if (!entry.areas.includes(item.area)) entry.areas.push(item.area);
    if (at > entry.lastAt) entry.lastAt = at;
    return entry;
  };

  for (const item of items) {
    if (item.chosenBy && item.chosenAt) {
      const entry = touch(item.chosenBy, item, item.chosenAt);
      entry.chosen += 1;
      const stage = stageOfStatus(item.status);
      if (stage === "escolhida") entry.inReview += 1;
      else if (stage === "gestor_aprovou") entry.managerApproved += 1;
      else if (stage === "enviada") entry.sent += 1;
    }
    if (item.status === "rejeitado" && item.rejectedBy) {
      touch(item.rejectedBy, item, item.rejectedAt ?? item.createdAt).rejected += 1;
    }
    if (item.createdBy) {
      touch(item.createdBy, item, item.createdAt).fromLink += 1;
    }
  }

  return [...map.values()].sort(
    (a, b) => b.chosen - a.chosen || b.fromLink - a.fromLink || b.lastAt.localeCompare(a.lastAt),
  );
}

export interface AreaSummary {
  area: string;
  chosen: number;
  sent: number;
  people: EscolhaPerson[];
}

/** Escolhas por área jurídica (todas as áreas aparecem, mesmo sem escolha). */
export function summarizeByArea(items: EscolhaItem[], areas: readonly string[] = LEGAL_AREAS): AreaSummary[] {
  const map = new Map<string, AreaSummary>(areas.map((area) => [area, { area, chosen: 0, sent: 0, people: [] }]));
  for (const item of items) {
    if (!item.chosenBy) continue;
    let entry = map.get(item.area);
    if (!entry) {
      entry = { area: item.area, chosen: 0, sent: 0, people: [] };
      map.set(item.area, entry);
    }
    entry.chosen += 1;
    if (stageOfStatus(item.status) === "enviada") entry.sent += 1;
    if (!entry.people.some((person) => personKey(person) === personKey(item.chosenBy!))) {
      entry.people.push(item.chosenBy);
    }
  }
  return [...map.values()].sort((a, b) => b.chosen - a.chosen || a.area.localeCompare(b.area, "pt-BR"));
}

export interface StalledItem {
  item: EscolhaItem;
  /** Parada com o gestor (em revisão) ou esperando o envio ao Marketing. */
  reason: "revisao" | "envio";
  days: number;
}

/** Escolhas que pararam no caminho, mais antigas primeiro. */
export function findStalled(items: EscolhaItem[], now = new Date()): StalledItem[] {
  const stalled: StalledItem[] = [];
  for (const item of items) {
    const stage = stageOfStatus(item.status);
    if (stage === "escolhida" && item.chosenAt) {
      const days = Math.floor((now.getTime() - new Date(item.chosenAt).getTime()) / DAY_MS);
      if (days >= STALLED_REVIEW_DAYS) stalled.push({ item, reason: "revisao", days });
    } else if (stage === "gestor_aprovou") {
      const since = item.reviewerApprovedAt ?? item.chosenAt;
      if (!since) continue;
      const days = Math.floor((now.getTime() - new Date(since).getTime()) / DAY_MS);
      if (days >= STALLED_SEND_DAYS) stalled.push({ item, reason: "envio", days });
    }
  }
  return stalled.sort((a, b) => b.days - a.days);
}

export interface EscolhaTotals {
  chosen: number;
  sent: number;
  fromLink: number;
  rejected: number;
  people: number;
}

export function summarizeTotals(items: EscolhaItem[]): EscolhaTotals {
  const people = new Set<string>();
  let chosen = 0;
  let sent = 0;
  let fromLink = 0;
  let rejected = 0;
  for (const item of items) {
    if (item.chosenBy) {
      chosen += 1;
      people.add(personKey(item.chosenBy));
      if (stageOfStatus(item.status) === "enviada") sent += 1;
    }
    if (item.fromLink) fromLink += 1;
    if (item.status === "rejeitado") rejected += 1;
  }
  return { chosen, sent, fromLink, rejected, people: people.size };
}

/** Fallback do histórico quando a matéria ainda não tem decisão (só os nomes gravados). */
export function escolhaFromRoteiro(row: EscolhaSourceRow): EscolhaItem {
  return buildEscolhaItems([row], [])[0];
}
