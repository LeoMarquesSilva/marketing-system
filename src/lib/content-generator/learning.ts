/**
 * Aprendizado do Gerador de conteúdo: o que engaja no Instagram do escritório,
 * o que a equipe escolhe ou descarta e como ela corrige o texto da IA. Este
 * módulo só calcula os números (puro, testável); a síntese em linguagem é feita
 * pela IA em learning-server.ts e guardada em content_learning_snapshots.
 */
import type { InstagramPost } from "@/lib/instagram-posts";
import { computePostEngagementRate } from "@/lib/instagram-engagement";
import { getPostAreas } from "@/lib/instagram-link-rules";
import { getLegalAreasForDepartment, LEGAL_AREAS } from "@/lib/content-areas";

/** Aprendizado mais velho que isso é refeito antes da busca automática. */
export const LEARNING_MAX_AGE_DAYS = 7;
export const LEARNING_WINDOW_DAYS = 365;

export type PostFormat = "Carrossel" | "Reels" | "Imagem";

export interface PostRef {
  headline: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  format: PostFormat;
  publishedAt: string | null;
  engagementRate: number;
  reach: number;
  saves: number;
  shares: number;
}

export interface FormatStats {
  format: PostFormat;
  posts: number;
  engagementRate: number;
  avgReach: number;
  avgShares: number;
}

export interface AreaStats {
  area: string;
  posts: number;
  engagementRate: number;
  avgReach: number;
  top: PostRef[];
  bottom: PostRef[];
  generated: number;
  chosen: number;
  rejected: number;
}

export interface SourceStats {
  topicId: string;
  name: string;
  area: string;
  active: boolean;
  generated: number;
  chosen: number;
  rejected: number;
  /** % das geradas que alguém escolheu. */
  chooseRate: number;
}

export interface LearningStats {
  windowDays: number;
  totals: { posts: number; engagementRate: number; choices: number; rejections: number; edits: number };
  formats: FormatStats[];
  areas: AreaStats[];
  sources: SourceStats[];
}

/** Linha de content_roteiros usada no aprendizado (sem o texto completo). */
export interface LearningRoteiroRow {
  id: string;
  topic_id: string | null;
  title: string;
  area: string;
  status: string;
  created_at: string;
  approved_by_id?: string | null;
}

export interface LearningTopicRow {
  id: string;
  name: string;
  legal_area: string;
  is_active: boolean;
}

export function postFormat(post: Pick<InstagramPost, "media_type" | "media_product_type">): PostFormat {
  if (post.media_product_type === "REELS" || post.media_type === "VIDEO") return "Reels";
  if (post.media_type === "CAROUSEL_ALBUM") return "Carrossel";
  return "Imagem";
}

/** Linha padrão das legendas de carrossel ("🕑 Tempo de leitura: 2 minutos"): não é o gancho. */
const BOILERPLATE_LINE = /^\W*tempo de leitura\b/i;

/** Primeira linha útil da legenda (o gancho do post). */
export function captionHeadline(caption: string | null | undefined, max = 140): string {
  const line = (caption ?? "")
    .split("\n")
    .map((part) => part.trim())
    .find((part) => /\p{L}{3,}/u.test(part) && !BOILERPLATE_LINE.test(part));
  if (!line) return "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Áreas jurídicas de um post do Instagram (pelo vínculo de área do post). */
export function legalAreasOfPost(post: InstagramPost): string[] {
  const areas = new Set<string>();
  for (const department of getPostAreas(post)) {
    const legal = getLegalAreasForDepartment(department);
    // Sócio/Institucional/Marketing caem em "todas": não servem para separar por área.
    if (legal.length === 1) areas.add(legal[0]);
  }
  return [...areas];
}

function toRef(post: InstagramPost): PostRef {
  return {
    headline: captionHeadline(post.caption),
    permalink: post.permalink,
    thumbnailUrl: post.thumbnail_url ?? post.media_url,
    format: postFormat(post),
    publishedAt: post.published_at,
    engagementRate: computePostEngagementRate(post),
    reach: post.reach,
    saves: post.saves,
    shares: post.shares,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function computeLearningStats(input: {
  posts: InstagramPost[];
  roteiros: LearningRoteiroRow[];
  topics: LearningTopicRow[];
  edits: number;
}): LearningStats {
  const measured = input.posts.filter((post) => post.reach > 0);
  const rates = new Map(measured.map((post) => [post.id, computePostEngagementRate(post)]));

  const formats = (["Carrossel", "Reels", "Imagem"] as PostFormat[])
    .map((format) => {
      const group = measured.filter((post) => postFormat(post) === format);
      return {
        format,
        posts: group.length,
        engagementRate: round1(average(group.map((post) => rates.get(post.id) ?? 0))),
        avgReach: Math.round(average(group.map((post) => post.reach))),
        avgShares: round1(average(group.map((post) => post.shares))),
      };
    })
    .filter((entry) => entry.posts > 0);

  const chosen = (row: LearningRoteiroRow) => Boolean(row.approved_by_id);
  const rejected = (row: LearningRoteiroRow) => row.status === "rejeitado";

  const areas: AreaStats[] = LEGAL_AREAS.map((area) => {
    const group = measured
      .filter((post) => legalAreasOfPost(post).includes(area))
      .sort((a, b) => (rates.get(b.id) ?? 0) - (rates.get(a.id) ?? 0));
    const generated = input.roteiros.filter((row) => row.area === area);
    return {
      area,
      posts: group.length,
      engagementRate: round1(average(group.map((post) => rates.get(post.id) ?? 0))),
      avgReach: Math.round(average(group.map((post) => post.reach))),
      top: group.slice(0, 5).map(toRef),
      bottom: group.length >= 6 ? group.slice(-3).reverse().map(toRef) : [],
      generated: generated.length,
      chosen: generated.filter(chosen).length,
      rejected: generated.filter(rejected).length,
    };
  });

  const sources: SourceStats[] = input.topics
    .map((topic) => {
      const generated = input.roteiros.filter((row) => row.topic_id === topic.id);
      const chosenCount = generated.filter(chosen).length;
      return {
        topicId: topic.id,
        name: topic.name,
        area: topic.legal_area,
        active: topic.is_active,
        generated: generated.length,
        chosen: chosenCount,
        rejected: generated.filter(rejected).length,
        chooseRate: generated.length ? round1((chosenCount / generated.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.chooseRate - a.chooseRate || b.chosen - a.chosen || b.generated - a.generated);

  return {
    windowDays: LEARNING_WINDOW_DAYS,
    totals: {
      posts: measured.length,
      engagementRate: round1(average([...rates.values()])),
      choices: input.roteiros.filter(chosen).length,
      rejections: input.roteiros.filter(rejected).length,
      edits: input.edits,
    },
    formats,
    areas,
    sources,
  };
}

/** Fonte que gera muito e ninguém escolhe: candidata a pausar. */
export function isWeakSource(source: SourceStats): boolean {
  return source.active && source.generated >= 30 && source.chosen === 0;
}

/** Texto que a IA recebe e o que a tela mostra: o "manual do que funciona". */
export interface LearningPlaybookArea {
  area: string;
  oQueEngaja: string[];
  temasPromissores: string[];
  ganchos: string[];
  evitar: string[];
}

export interface LearningPlaybookReferences {
  resumo: string;
  /** O que os escritórios de referência e concorrentes postam (temas, formatos, frequência). */
  oQueFazem: string[];
  /** Como mostram domínio do assunto (o "subir a prateleira"). */
  comoMostramDominio: string[];
  /** Pautas no nível deles adaptadas ao nosso escritório. */
  ideiasDePauta: string[];
  /** O que não vale copiar (ex.: post só institucional). */
  naoCopiar: string[];
}

export interface LearningPlaybook {
  resumo: string;
  geral: { oQueEngaja: string[]; ganchos: string[]; evitar: string[]; formato: string };
  areas: LearningPlaybookArea[];
  preferenciasDaEquipe: string[];
  edicoesDaEquipe: string[];
  fontes: string[];
  /** Ausente nos estudos de antes de 18/11/2026 (quando as referências entraram). */
  referencias?: LearningPlaybookReferences;
}

export interface LearningSnapshot {
  id: string;
  createdAt: string;
  trigger: string;
  createdByName: string | null;
  postsAnalyzed: number;
  choicesAnalyzed: number;
  editsAnalyzed: number;
  stats: LearningStats;
  playbook: LearningPlaybook;
}

export function isLearningStale(snapshot: Pick<LearningSnapshot, "createdAt"> | null, now = new Date()): boolean {
  if (!snapshot) return true;
  const age = now.getTime() - new Date(snapshot.createdAt).getTime();
  return age > LEARNING_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function bulletList(items: string[] | undefined): string {
  return (items ?? []).filter(Boolean).map((item) => `- ${item}`).join("\n");
}

/**
 * Bloco do aprendizado para uma área, para entrar no prompt da nota e do
 * carrossel. Sem aprendizado (ou desligado), devolve string vazia.
 */
export function learningBlockForArea(snapshot: LearningSnapshot | null, area: string): string {
  if (!snapshot) return "";
  const { playbook, stats } = snapshot;
  const areaPlaybook = playbook.areas?.find((entry) => entry.area === area);
  const areaStats = stats.areas?.find((entry) => entry.area === area);
  const topHeadlines = (areaStats?.top ?? [])
    .slice(0, 3)
    .filter((post) => post.headline)
    .map((post) => `"${post.headline}" (${post.engagementRate.toFixed(1)}% de engajamento)`);

  const parts = [
    `APRENDIZADO DO NOSSO INSTAGRAM E DA EQUIPE (atualizado em ${new Date(snapshot.createdAt).toLocaleDateString("pt-BR")}):`,
    playbook.geral?.oQueEngaja?.length ? `O que engaja no perfil:\n${bulletList(playbook.geral.oQueEngaja)}` : "",
    playbook.geral?.ganchos?.length ? `Ganchos que funcionam:\n${bulletList(playbook.geral.ganchos)}` : "",
    areaPlaybook?.oQueEngaja?.length ? `Na área ${area}, o que engaja:\n${bulletList(areaPlaybook.oQueEngaja)}` : "",
    areaPlaybook?.temasPromissores?.length ? `Temas promissores em ${area}:\n${bulletList(areaPlaybook.temasPromissores)}` : "",
    areaPlaybook?.ganchos?.length ? `Ganchos para ${area}:\n${bulletList(areaPlaybook.ganchos)}` : "",
    topHeadlines.length ? `Posts de ${area} que mais engajaram:\n${bulletList(topHeadlines)}` : "",
    playbook.preferenciasDaEquipe?.length ? `O que a equipe costuma escolher:\n${bulletList(playbook.preferenciasDaEquipe)}` : "",
    playbook.edicoesDaEquipe?.length ? `Correções que a equipe costuma fazer no texto da IA (já escreva assim):\n${bulletList(playbook.edicoesDaEquipe)}` : "",
    playbook.referencias?.comoMostramDominio?.length
      ? `Como os escritórios de referência mostram domínio do assunto (é esse o nível):\n${bulletList(playbook.referencias.comoMostramDominio)}`
      : "",
    [...(playbook.geral?.evitar ?? []), ...(areaPlaybook?.evitar ?? [])].length
      ? `Evitar:\n${bulletList([...(playbook.geral?.evitar ?? []), ...(areaPlaybook?.evitar ?? [])])}`
      : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** Frase curta para o colaborador, no lugar da antiga dica de performance. */
export function collaboratorHintForArea(snapshot: LearningSnapshot | null, area: string): string | null {
  const areaPlaybook = snapshot?.playbook.areas?.find((entry) => entry.area === area);
  const first = areaPlaybook?.oQueEngaja?.[0] ?? areaPlaybook?.temasPromissores?.[0];
  return first ? `No nosso Instagram, em ${area}: ${first}` : null;
}
