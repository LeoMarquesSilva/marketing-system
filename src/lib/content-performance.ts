/**
 * Cruza o histórico de performance do Instagram (legendas + métricas) com a
 * geração de conteúdo: para cada área jurídica, descobre quais assuntos mais
 * engajaram e produz (a) um bloco para guiar a IA e (b) uma dica curta para o
 * colaborador. Reaproveita os analytics de instagram-analytics.ts.
 */
import { fetchInstagramPosts, type InstagramPost } from "./instagram-posts";
import {
  computeCaptionThemePerformance,
  computeTopPostsByEngagementRate,
} from "./instagram-analytics";
import { getPostAreas } from "./instagram-link-rules";
import { getDepartmentsForLegalArea } from "./content-areas";

export interface AreaPerformanceContext {
  /** Bloco em texto para injetar no prompt de geração. */
  promptBlock: string;
  /** Frase curta exibida ao colaborador no card do post. */
  collaboratorHint: string;
}

const PERFORMANCE_WINDOW_DAYS = 180;

/** Primeira linha "limpa" de uma legenda, para exemplificar o que funcionou. */
function captionHeadline(caption: string | null | undefined): string {
  if (!caption) return "";
  const firstLine = caption
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return "";
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
}

/** Busca posts do Instagram da janela recente para alimentar o cruzamento. */
export async function fetchPerformancePostsWindow(
  days = PERFORMANCE_WINDOW_DAYS
): Promise<InstagramPost[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  return fetchInstagramPosts({ from: from.toISOString() });
}

/**
 * Monta o contexto de performance para uma área jurídica a partir de uma lista
 * de posts já carregada. Retorna null quando não há amostra suficiente.
 */
export function buildAreaPerformanceContext(
  posts: InstagramPost[],
  legalArea: string
): AreaPerformanceContext | null {
  const departments = getDepartmentsForLegalArea(legalArea);
  if (departments.length === 0) return null;

  const areaPosts = posts.filter((p) =>
    getPostAreas(p).some((a) => departments.includes(a))
  );
  if (areaPosts.length < 3) return null;

  const themes = computeCaptionThemePerformance(areaPosts, 4).filter(
    (t) => t.postsCount >= 2 && t.theme !== "Outros temas"
  );
  const topPosts = computeTopPostsByEngagementRate(areaPosts, 3);

  if (themes.length === 0 && topPosts.length === 0) return null;

  const themeLines = themes.map(
    (t) =>
      `- ${t.theme}: ${t.postsCount} posts, engajamento médio ${t.engagementRate.toFixed(1)}%`
  );
  const exampleLines = topPosts
    .map((tp) => captionHeadline(tp.post.caption))
    .filter(Boolean)
    .slice(0, 3)
    .map((h) => `- "${h}"`);

  const promptBlock = [
    `INTELIGÊNCIA DE PERFORMANCE — área ${legalArea} (Instagram do escritório, últimos ${PERFORMANCE_WINDOW_DAYS} dias):`,
    themeLines.length > 0 ? `Assuntos que mais engajaram:\n${themeLines.join("\n")}` : "",
    exampleLines.length > 0
      ? `Exemplos de posts de melhor desempenho:\n${exampleLines.join("\n")}`
      : "",
    "Use isso para escolher o ângulo: produza algo no MESMO universo temático que costuma engajar, mas com abordagem NOVA — não repita literalmente os exemplos acima.",
  ]
    .filter(Boolean)
    .join("\n");

  const topTheme = themes[0]?.theme;
  const collaboratorHint = topTheme
    ? `Posts sobre ${topTheme} costumam engajar bem na sua área — vale aproveitar o gancho.`
    : "Conteúdos desta área têm bom histórico de engajamento no nosso Instagram.";

  return { promptBlock, collaboratorHint };
}
