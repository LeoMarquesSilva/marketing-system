/**
 * Felicitações da tela inicial: a equipe curte e comenta o aniversário (da
 * pessoa ou de empresa) de um colega, e pode marcar outras pessoas no
 * comentário. A comemoração é pessoa + tipo + ano, igual às artes.
 */
import type { BirthdayArtKind } from "./birthday-arts";

export interface CelebrationTarget {
  employeeId: string;
  kind: BirthdayArtKind;
  year: number;
}

/** Dá para parabenizar no dia e nos N dias seguintes; antes do dia, só ver. */
export const CELEBRATION_WINDOW_DAYS = 7;
export const CELEBRATION_COMMENT_MAX = 500;
export const CELEBRATION_MENTIONS_MAX = 10;

/**
 * Elogio com um clique: os cinco valores CIVIL do escritório (as mesmas chaves
 * das categorias do BP Awards). É só um gesto de carinho na comemoração; não
 * entra na apuração da premiação.
 */
export const CELEBRATION_PRAISES = [
  { key: "cliente", label: "Cliente no Centro" },
  { key: "inovacao", label: "Inovação Constante" },
  { key: "valorizacao", label: "Valorização das Pessoas" },
  { key: "inteligencia", label: "Inteligência em Resultados" },
  { key: "liberdade", label: "Liberdade para Criar" },
] as const;
export type CelebrationPraiseKey = (typeof CELEBRATION_PRAISES)[number]["key"];
export const CELEBRATION_PRAISE_KEYS = CELEBRATION_PRAISES.map((praise) => praise.key) as [CelebrationPraiseKey, ...CelebrationPraiseKey[]];

export interface CelebrationPerson {
  id: string;
  name: string;
  department: string | null;
  avatarUrl: string | null;
}

export interface CelebrationComment {
  id: string;
  author: { name: string; department: string | null; avatarUrl: string | null };
  body: string;
  /** Colegas marcados no comentário. */
  mentions: Array<{ id: string; name: string }>;
  createdAt: string;
  likes: number;
  /** Quem está logado curtiu esta mensagem. */
  liked: boolean;
  /** Quem está logado pode apagar (autor ou admin). */
  canDelete: boolean;
}

export interface CelebrationDetail {
  likes: number;
  liked: boolean;
  /** Primeiros nomes de quem curtiu, para a linha "Fulano, Beltrano e mais 3". */
  likedBy: string[];
  /** Quantas pessoas deram cada elogio, e se quem está logado deu. */
  praises: Array<{
    key: CelebrationPraiseKey;
    count: number;
    mine: boolean;
    /** Quem reconheceu este valor (os primeiros, para as fotos empilhadas). */
    people: Array<{ name: string; avatarUrl: string | null }>;
  }>;
  /** Mensagens, da mais recente para a mais antiga. */
  comments: CelebrationComment[];
  /** Fora da janela (antes do dia ou depois de uma semana), a tela só mostra. */
  canInteract: boolean;
  /** A comemoração é de quem está logado. */
  isOwn: boolean;
  /** Pode montar o post para as redes: a própria pessoa (e admin, para conferir). */
  canShare: boolean;
  /** Equipe ativa, para marcar no comentário. */
  people: CelebrationPerson[];
}

export const celebrationKey = (target: CelebrationTarget) => `${target.employeeId}:${target.kind}:${target.year}`;

/** "Ana, Bruno e mais 3 curtiram". */
export function likedByLabel(names: string[], total: number): string {
  if (total === 0) return "Seja a primeira pessoa a parabenizar";
  const shown = names.slice(0, 2);
  const rest = total - shown.length;
  if (rest <= 0) return `${shown.join(" e ")} ${total === 1 ? "parabenizou" : "parabenizaram"}`;
  return `${shown.join(", ")} e mais ${rest} parabenizaram`;
}
