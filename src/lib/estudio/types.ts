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
  /** Ajustes finos que o desenho do modelo respeita. */
  ajustes?: AdjustKey[];
  /** O fundo pode ser trocado: variações do Illustrator (1..n) ou uma imagem com camada por cima. */
  fundos?: { variacoes: number; previa: (n: number, valores: FieldValues) => string };
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
  /** Perfil do Instagram usado na prévia ("como vai aparecer"). */
  perfil?: { nome: string; foto?: string };
}

/** Ajustes finos feitos à mão no slide (a IA não mexe). */
export interface SlideAdjust {
  /** Escala do texto da coluna (corpo, caixas, pílulas). */
  texto?: number;
  /** Escala do título, além da do texto. */
  titulo?: number;
  /** Desloca o bloco de texto na vertical (px da prancheta). */
  y?: number;
  fotoZoom?: number;
  fotoX?: number;
  fotoY?: number;
}

export type AdjustKey = keyof SlideAdjust;

export const ADJUST_LIMITS: Record<AdjustKey, { min: number; max: number; step: number; neutral: number; label: string }> = {
  texto: { min: 0.8, max: 1.25, step: 0.01, neutral: 1, label: "Tamanho do texto" },
  titulo: { min: 0.75, max: 1.35, step: 0.01, neutral: 1, label: "Tamanho do título" },
  y: { min: -250, max: 250, step: 2, neutral: 0, label: "Subir/descer o bloco" },
  fotoZoom: { min: 0.6, max: 1.8, step: 0.01, neutral: 1, label: "Zoom da foto" },
  fotoX: { min: -350, max: 350, step: 2, neutral: 0, label: "Foto para os lados" },
  fotoY: { min: -350, max: 350, step: 2, neutral: 0, label: "Foto para cima/baixo" },
};

/**
 * Fundo escolhido à mão. Sem ele o modelo decide (a variação muda com a posição do slide).
 * Na imagem, `camada` é a opacidade do navy/papel por cima, para o texto continuar legível.
 */
export type SlideBackground = { tipo: "variacao"; n: number } | { tipo: "imagem"; path: string; camada: number; credito?: string };

export const BACKGROUND_LAYER = { min: 0, max: 0.95, padrao: 0.82 };

export interface StudioSlide {
  id: string;
  modelo: string;
  valores: FieldValues;
  ajustes?: SlideAdjust;
  fundo?: SlideBackground;
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
  /** 1º slide, para a miniatura da lista. */
  capa: StudioSlide | null;
};
