/** Notas das degustações de drinks: tipos e regras puras (sem banco). Cada participante dá de 1 a 5 em cada drink. */
import type { EventTasting, TastingParticipant } from "@/lib/eventos-programa";

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;
export const SCORES = [1, 2, 3, 4, 5] as const;
export type Score = (typeof SCORES)[number];

/** Rótulo de cada nota, de 1 (ruim) a 5 (muito bom). */
export const SCORE_LABEL: Record<Score, string> = {
  1: "Ruim",
  2: "Fraco",
  3: "Ok",
  4: "Bom",
  5: "Muito bom",
};

export interface TastingDrink {
  id: string;
  tastingId: string;
  eventId: string;
  name: string;
  photoPath: string | null;
  photoUrl: string | null;
  note: string | null;
  /** Pré-selecionado pelo grupo: negrito na tabela. */
  shortlisted: boolean;
  menuItemId: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface TastingVote {
  id: string;
  drinkId: string;
  tastingId: string;
  participantKey: string;
  participantName: string;
  userId: string | null;
  score: Score;
  recordedBy: string | null;
}

export function isScore(value: unknown): value is Score {
  return typeof value === "number" && Number.isInteger(value) && value >= SCORE_MIN && value <= SCORE_MAX;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Chave do participante nos votos: o id do usuário, ou "convidado:<nome>" para quem não tem login. */
export function participantKey(person: Pick<TastingParticipant, "name" | "userId">): string {
  return person.userId ? person.userId : `convidado:${normalize(person.name)}`;
}

/** Cabeçalho da coluna: o primeiro nome; com dois iguais, primeiro nome + inicial do último. */
export function columnLabels(participants: Pick<TastingParticipant, "name">[]): string[] {
  const first = participants.map((person) => person.name.trim().split(/\s+/)[0] ?? person.name);
  return participants.map((person, index) => {
    const name = first[index];
    const repeated = first.filter((other) => normalize(other) === normalize(name)).length > 1;
    if (!repeated) return name;
    const parts = person.name.trim().split(/\s+/);
    return parts.length > 1 ? `${name} ${parts[parts.length - 1].charAt(0)}.` : name;
  });
}

export interface ScoreRow {
  drink: TastingDrink;
  /** Nota de cada participante, na ordem da lista da degustação (null = ainda não votou). */
  scores: (Score | null)[];
  total: number;
  votes: number;
  /** Média das notas lançadas (null sem nenhuma). */
  average: number | null;
  /** Posição por média; empate divide a posição (1, 1, 3). */
  rank: number | null;
}

/** Arredonda a média em duas casas, como na planilha (4,67). */
export function roundAverage(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatAverage(value: number | null): string {
  return value == null ? "—" : value.toFixed(2).replace(".", ",");
}

/**
 * Tabela de notas de uma degustação: uma linha por drink, uma coluna por participante,
 * total e média. Ordena pela média (depois total e nome); drink sem nota vai para o fim, na ordem em que entrou.
 */
export function scoreTable(drinks: TastingDrink[], votes: TastingVote[], participants: TastingParticipant[]): ScoreRow[] {
  const keys = participants.map(participantKey);
  const rows = drinks.map<ScoreRow>((drink) => {
    const own = votes.filter((vote) => vote.drinkId === drink.id);
    const scores = keys.map((key) => own.find((vote) => vote.participantKey === key)?.score ?? null);
    // Notas de quem saiu da lista continuam valendo no total e na média.
    const counted = own.map((vote) => vote.score);
    const total = counted.reduce<number>((sum, score) => sum + score, 0);
    return {
      drink,
      scores,
      total,
      votes: counted.length,
      average: counted.length > 0 ? roundAverage(total / counted.length) : null,
      rank: null,
    };
  });
  rows.sort((a, b) => {
    if (a.average == null || b.average == null) {
      if (a.average == null && b.average == null) return a.drink.sortOrder - b.drink.sortOrder || a.drink.createdAt.localeCompare(b.drink.createdAt);
      return a.average == null ? 1 : -1;
    }
    return b.average - a.average || b.total - a.total || a.drink.name.localeCompare(b.drink.name, "pt-BR");
  });
  let lastAverage: number | null = null;
  let lastRank = 0;
  rows.forEach((row, index) => {
    if (row.average == null) return;
    if (row.average !== lastAverage) {
      lastRank = index + 1;
      lastAverage = row.average;
    }
    row.rank = lastRank;
  });
  return rows;
}

export interface OverallRow extends ScoreRow {
  tasting: EventTasting;
}

/** Ranking geral das degustações de drinks do evento (grupos diferentes: vale a média de cada um). */
export function overallRanking(tastings: EventTasting[], drinks: TastingDrink[], votes: TastingVote[]): OverallRow[] {
  const rows: OverallRow[] = [];
  for (const tasting of tastings) {
    const table = scoreTable(
      drinks.filter((drink) => drink.tastingId === tasting.id),
      votes.filter((vote) => vote.tastingId === tasting.id),
      tasting.participants
    );
    for (const row of table) if (row.average != null) rows.push({ ...row, tasting });
  }
  rows.sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || b.total - a.total || a.drink.name.localeCompare(b.drink.name, "pt-BR"));
  let lastAverage: number | null = null;
  let lastRank = 0;
  rows.forEach((row, index) => {
    if (row.average !== lastAverage) {
      lastRank = index + 1;
      lastAverage = row.average;
    }
    row.rank = lastRank;
  });
  return rows;
}

/** Endereço e link do mapa guardados juntos no campo "local" da degustação. */
export function splitLocation(location: string | null): { address: string | null; mapUrl: string | null } {
  const value = (location ?? "").trim();
  if (!value) return { address: null, mapUrl: null };
  const match = /https:\/\/\S+/i.exec(value);
  const address = value
    .replace(/https:\/\/\S+/gi, "")
    .replace(/^endere[cç]o:\s*/i, "")
    .replace(/[\s·,–-]+$/u, "")
    .trim();
  return { address: address || null, mapUrl: match ? match[0] : null };
}

/** Quem ainda não votou neste drink (na ordem da lista). */
export function missingVoters(drinkId: string, votes: TastingVote[], participants: TastingParticipant[]): TastingParticipant[] {
  const voted = new Set(votes.filter((vote) => vote.drinkId === drinkId).map((vote) => vote.participantKey));
  return participants.filter((person) => !voted.has(participantKey(person)));
}
