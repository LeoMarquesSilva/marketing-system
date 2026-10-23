import type { FieldValues, StudioField } from "./fields";

/** Post único, carrossel (vários slides de feed) ou sequência de stories. */
export type PieceKind = "feed" | "carrossel" | "stories";

export type ArtboardFormat = "feed" | "story";

export const ARTBOARD_SIZE: Record<ArtboardFormat, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

export const PIECE_KIND_LABEL: Record<PieceKind, string> = {
  feed: "Post de feed",
  carrossel: "Carrossel",
  stories: "Stories",
};

/** Formato da prancheta usado por cada tipo de peça. */
export const PIECE_FORMAT: Record<PieceKind, ArtboardFormat> = {
  feed: "feed",
  carrossel: "feed",
  stories: "story",
};

export const PIECE_MAX_SLIDES: Record<PieceKind, number> = { feed: 1, carrossel: 10, stories: 10 };

export interface StudioTemplateDef {
  id: string;
  /** Campanha/coleção do modelo, igual à tag do título no planner ("OAB"). */
  tag: string;
  nome: string;
  /** Para que serve o modelo (aparece na escolha e no prompt da IA). */
  descricao: string;
  formato: ArtboardFormat;
  usoEm: PieceKind[];
  campos: StudioField[];
  /** Conteúdo de exemplo, tirado das pranchetas do Illustrator. */
  exemplo: FieldValues;
}

export interface StudioCollection {
  tag: string;
  nome: string;
  /** Fatos da campanha que a IA pode usar para criar ou completar peças. */
  contexto: string;
  /**
   * Como a peça vai para o planner: "tag" cria "[TAG] F06 Feed — Nome" e lista as
   * tarefas da tag; "posts" usa o título livre e lista as tarefas de post em aberto
   * (as que o Gerador de conteúdo cria ao mandar o post para o Marketing).
   */
  planner: "tag" | "posts";
  /** Peças podem nascer de um post do Gerador de conteúdo. */
  importaPosts?: boolean;
}

export interface StudioSlide {
  id: string;
  modelo: string;
  valores: FieldValues;
}

export interface StudioPiece {
  id: string;
  tag: string;
  titulo: string;
  tipo: PieceKind;
  slides: StudioSlide[];
  legenda: string;
  request_id: string | null;
  roteiro_id: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export type StudioPieceSummary = Pick<StudioPiece, "id" | "tag" | "titulo" | "tipo" | "request_id" | "updated_at"> & {
  slides_count: number;
};
