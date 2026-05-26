import type { Area } from "./areas";
import type { AreaInsight } from "./instagram-analytics";
import { computeAreaDashboards } from "./instagram-analytics";
import { getInstagramMediaLabel } from "./instagram-media-type";
import {
  getPostAreas,
  getPostSolicitantes,
  isCollabPost,
  isPostFullyLinked,
  isPostPendingLink,
} from "./instagram-link-rules";
import type { InstagramAccountStats, InstagramPost } from "./instagram-posts";
import type { User } from "./users";
import { isUserActive } from "./user-status";
import {
  computeEngagementRate,
  computePostEngagementRate,
  computeAggregateEngagementRate,
  computeEngagementActionsFromPost,
  ENGAGEMENT_RATE_FORMULA,
  ENGAGEMENT_ACTIONS_LABEL,
} from "./instagram-engagement";

export interface InstagramReportInput {
  posts: InstagramPost[];
  areas: Area[];
  users: User[];
  accountStats: InstagramAccountStats | null;
  filterDescription?: string;
  /** Quando definido, o relatório foca em uma única área */
  focusArea?: string;
}

export function filterPostsByArea(posts: InstagramPost[], areaName: string): InstagramPost[] {
  return posts.filter((p) => getPostAreas(p).includes(areaName));
}

/** Filtra posts por data de publicação (YYYY-MM-DD inclusive) */
export function filterPostsByPeriod(
  posts: InstagramPost[],
  from?: string | null,
  to?: string | null
): InstagramPost[] {
  const fromKey = from?.trim() || null;
  const toKey = to?.trim() || null;
  if (!fromKey && !toKey) return posts;

  return posts.filter((p) => {
    if (!p.published_at) return false;
    const day = p.published_at.slice(0, 10);
    if (fromKey && day < fromKey) return false;
    if (toKey && day > toKey) return false;
    return true;
  });
}

export function formatPeriodLabel(from?: string | null, to?: string | null): string | null {
  const fromKey = from?.trim() || null;
  const toKey = to?.trim() || null;
  if (!fromKey && !toKey) return null;

  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  if (fromKey && toKey) return `${fmt(fromKey)} – ${fmt(toKey)}`;
  if (fromKey) return `A partir de ${fmt(fromKey)}`;
  return `Até ${fmt(toKey!)}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface AreaReportRow {
  area: string;
  posts: number;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementActions: number;
  avgEngagementActions: number;
  avgReach: number;
  avgViews: number;
  engagementRate: number;
  postsSharePct: number;
  engagementSharePct: number;
  topFormat: string;
  collaboratorsWithPosts: number;
}

export interface CollaboratorReportRow {
  area: string;
  name: string;
  status: string;
  posts: number;
  reach: number;
  views: number;
  engagementActions: number;
  avgEngagementActions: number;
}

export interface FormatReportRow {
  format: string;
  posts: number;
  reach: number;
  views: number;
  engagementActions: number;
  avgEngagementActions: number;
  sharePct: number;
}

export interface PostReportRow {
  date: string;
  areas: string;
  authors: string;
  format: string;
  tags: string;
  collab: string;
  linkStatus: string;
  caption: string;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementActions: number;
  engagementRate: number;
  permalink: string;
}

export interface InstagramReport {
  generatedAt: string;
  accountUsername: string;
  followers: number;
  periodFrom: string | null;
  periodTo: string | null;
  filterDescription: string;
  totalPosts: number;
  linkedPosts: number;
  pendingPosts: number;
  totalReach: number;
  totalViews: number;
  totalEngagementActions: number;
  avgEngagementActions: number;
  aggregateEngagementRate: number;
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
  topAreaByPosts: string;
  topAreaByEngagement: string;
  topPostCaption: string;
  topPostEngagementActions: number;
  areaRows: AreaReportRow[];
  collaboratorRows: CollaboratorReportRow[];
  formatRows: FormatReportRow[];
  topPosts: PostReportRow[];
  postRows: PostReportRow[];
  narrative: string;
}

function aggregateMetrics(posts: InstagramPost[]) {
  return posts.reduce(
    (acc, p) => ({
      posts: acc.posts + 1,
      reach: acc.reach + p.reach,
      views: acc.views + p.views,
      likes: acc.likes + p.likes,
      comments: acc.comments + p.comments,
      shares: acc.shares + p.shares,
      saves: acc.saves + p.saves,
      engagementActions: acc.engagementActions + computeEngagementActionsFromPost(p),
    }),
    {
      posts: 0,
      reach: 0,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      engagementActions: 0,
    }
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function engagementRateFromPost(post: InstagramPost): number {
  return computePostEngagementRate(post);
}

function engagementRateFromTotals(
  likes: number,
  comments: number,
  saves: number,
  reach: number
): number {
  return computeEngagementRate(likes, comments, saves, reach);
}

function truncate(text: string | null, max = 120): string {
  if (!text) return "";
  const line = text.split("\n")[0];
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function topFormatForPosts(posts: InstagramPost[]): string {
  const map = new Map<string, number>();
  for (const p of posts) {
    const label = getInstagramMediaLabel(p.media_type);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  let best = "—";
  let bestCount = 0;
  for (const [label, count] of map) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

function buildPostRow(post: InstagramPost, users: User[]): PostReportRow {
  const areas = getPostAreas(post);
  const solicitantes = getPostSolicitantes(post);
  const authors = solicitantes
    .map((s) => {
      const user = users.find((u) => u.id === s.id);
      const name = user?.name ?? s.name;
      return user && !isUserActive(user) ? `${name} (Ex-funcionário)` : name;
    })
    .join(", ");

  return {
    date: formatDate(post.published_at),
    areas: areas.join(", ") || "Sem área",
    authors: authors || "—",
    format: getInstagramMediaLabel(post.media_type),
    tags: (post.tags ?? []).join(", ") || "—",
    collab: isCollabPost(post) ? "Sim" : "Não",
    linkStatus: isPostFullyLinked(post) ? "Vinculado" : "Pendente",
    caption: truncate(post.caption, 200),
    reach: post.reach,
    views: post.views,
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    saves: post.saves,
    engagementActions: computeEngagementActionsFromPost(post),
    engagementRate: engagementRateFromPost(post),
    permalink: post.permalink ?? "",
  };
}

function buildAreaRows(
  areaDashboards: AreaInsight[],
  posts: InstagramPost[],
  totals: ReturnType<typeof aggregateMetrics>
): AreaReportRow[] {
  return areaDashboards
    .filter((a) => a.posts > 0)
    .map((area) => {
      const areaPosts = posts.filter((p) => getPostAreas(p).includes(area.area));
      const m = aggregateMetrics(areaPosts);
      const collaboratorsWithPosts = area.collaborators.filter((c) => c.posts > 0).length;

      return {
        area: area.area,
        posts: m.posts,
        reach: m.reach,
        views: m.views,
        likes: m.likes,
        comments: m.comments,
        shares: m.shares,
        saves: m.saves,
        engagementActions: m.engagementActions,
        avgEngagementActions: m.posts > 0 ? Number((m.engagementActions / m.posts).toFixed(1)) : 0,
        avgReach: m.posts > 0 ? Math.round(m.reach / m.posts) : 0,
        avgViews: m.posts > 0 ? Math.round(m.views / m.posts) : 0,
        engagementRate: engagementRateFromTotals(m.likes, m.comments, m.saves, m.reach),
        postsSharePct: pct(m.posts, totals.posts),
        engagementSharePct: pct(m.engagementActions, totals.engagementActions),
        topFormat: topFormatForPosts(areaPosts),
        collaboratorsWithPosts,
      };
    })
    .sort((a, b) => b.engagementActions - a.engagementActions);
}

function buildCollaboratorRows(areaDashboards: AreaInsight[]): CollaboratorReportRow[] {
  const rows: CollaboratorReportRow[] = [];
  for (const area of areaDashboards) {
    for (const c of area.collaborators.filter((x) => x.posts > 0)) {
      rows.push({
        area: area.area,
        name: c.name,
        status: c.is_active ? "Ativo" : "Ex-funcionário",
        posts: c.posts,
        reach: c.reach,
        views: c.views,
        engagementActions: c.engagementActions,
        avgEngagementActions:
          c.posts > 0 ? Number((c.engagementActions / c.posts).toFixed(1)) : 0,
      });
    }
  }
  return rows.sort(
    (a, b) => b.engagementActions - a.engagementActions || b.posts - a.posts
  );
}

function buildFormatRows(posts: InstagramPost[]): FormatReportRow[] {
  const map = new Map<string, InstagramPost[]>();
  for (const post of posts) {
    const label = getInstagramMediaLabel(post.media_type);
    const list = map.get(label) ?? [];
    list.push(post);
    map.set(label, list);
  }

  const totalPosts = posts.length;
  return Array.from(map.entries())
    .map(([format, formatPosts]) => {
      const m = aggregateMetrics(formatPosts);
      return {
        format,
        posts: m.posts,
        reach: m.reach,
        views: m.views,
        engagementActions: m.engagementActions,
        avgEngagementActions:
          m.posts > 0 ? Number((m.engagementActions / m.posts).toFixed(1)) : 0,
        sharePct: pct(m.posts, totalPosts),
      };
    })
    .sort((a, b) => b.engagementActions - a.engagementActions);
}

function buildNarrative(report: Omit<InstagramReport, "narrative">, focusArea?: string): string {
  const title = focusArea
    ? `RELATÓRIO INSTAGRAM — ÁREA ${focusArea.toUpperCase()}`
    : "RELATÓRIO INSTAGRAM — BISMARCHI PIRES";
  const lines: string[] = [
    title,
    "=".repeat(50),
    "",
    `Conta: @${report.accountUsername}`,
    `Seguidores: ${report.followers.toLocaleString("pt-BR")}`,
    `Gerado em: ${formatDateTime(report.generatedAt)}`,
    `Período dos posts: ${report.periodFrom ?? "—"} a ${report.periodTo ?? "—"}`,
    report.filterDescription ? `Filtros aplicados: ${report.filterDescription}` : "",
    "",
    "VISÃO GERAL",
    "-".repeat(30),
    `Total de posts analisados: ${report.totalPosts}`,
    `Posts vinculados: ${report.linkedPosts} · Pendentes: ${report.pendingPosts}`,
    `Alcance total: ${report.totalReach.toLocaleString("pt-BR")}`,
    `Visualizações total: ${report.totalViews.toLocaleString("pt-BR")}`,
    `${ENGAGEMENT_ACTIONS_LABEL} total: ${report.totalEngagementActions.toLocaleString("pt-BR")} (curtidas + comentários + salvamentos)`,
    `Média de ações de engajamento/post: ${report.avgEngagementActions.toLocaleString("pt-BR")}`,
    `Taxa de engajamento: ${report.aggregateEngagementRate}%`,
    `  Fórmula: ${ENGAGEMENT_RATE_FORMULA}`,
    `Curtidas: ${report.totalLikes.toLocaleString("pt-BR")} · Comentários: ${report.totalComments.toLocaleString("pt-BR")} · Salvamentos: ${report.totalSaves.toLocaleString("pt-BR")}`,
    "",
    "DESTAQUES",
    "-".repeat(30),
    `Área com mais posts: ${report.topAreaByPosts}`,
    `Área com mais ações de engajamento: ${report.topAreaByEngagement}`,
    `Post destaque: ${report.topPostEngagementActions.toLocaleString("pt-BR")} ações de engajamento`,
    `  "${report.topPostCaption}"`,
    "",
    "DESEMPENHO POR ÁREA",
    "-".repeat(30),
  ];

  if (report.areaRows.length === 0) {
    lines.push("Nenhuma área com posts vinculados no período/filtro selecionado.");
  } else {
    for (const row of report.areaRows) {
      lines.push(
        "",
        `${row.area}`,
        `  Posts: ${row.posts} (${row.postsSharePct}% do total)`,
        `  ${ENGAGEMENT_ACTIONS_LABEL}: ${row.engagementActions.toLocaleString("pt-BR")} (${row.engagementSharePct}% do total)`,
        `  Alcance: ${row.reach.toLocaleString("pt-BR")} · Views: ${row.views.toLocaleString("pt-BR")}`,
        `  Curtidas: ${row.likes.toLocaleString("pt-BR")} · Comentários: ${row.comments.toLocaleString("pt-BR")}`,
        `  Compartilhamentos: ${row.shares.toLocaleString("pt-BR")} · Salvamentos: ${row.saves.toLocaleString("pt-BR")}`,
        `  Média ações/post: ${row.avgEngagementActions.toLocaleString("pt-BR")}`,
        `  Taxa de engajamento: ${row.engagementRate}% (${ENGAGEMENT_RATE_FORMULA})`,
        `  Formato predominante: ${row.topFormat}`,
        `  Colaboradores com posts: ${row.collaboratorsWithPosts}`,
      );
    }
  }

  if (report.formatRows.length > 0) {
    lines.push("", "POR FORMATO", "-".repeat(30));
    for (const row of report.formatRows) {
      lines.push(
        `${row.format}: ${row.posts} posts (${row.sharePct}%) · ${row.engagementActions.toLocaleString("pt-BR")} ações · média ${row.avgEngagementActions}/post`
      );
    }
  }

  const topCollaborators = report.collaboratorRows.slice(0, 5);
  if (topCollaborators.length > 0) {
    lines.push("", "TOP COLABORADORES", "-".repeat(30));
    for (const row of topCollaborators) {
      lines.push(
        `${row.name} (${row.area}) — ${row.status}: ${row.posts} posts, ${row.engagementActions.toLocaleString("pt-BR")} ações de engajamento`
      );
    }
  }

  if (report.topPosts.length > 0) {
    lines.push("", "TOP 5 POSTS", "-".repeat(30));
    for (const [i, row] of report.topPosts.slice(0, 5).entries()) {
      lines.push(
        `${i + 1}. ${row.date} · ${row.areas} · ${row.engagementActions.toLocaleString("pt-BR")} ações · ${row.engagementRate}% engajamento`,
        `   ${row.caption}`,
        row.permalink ? `   ${row.permalink}` : ""
      );
    }
  }

  lines.push("", "—", "Relatório gerado pelo Marketing System · Instagram Insights");
  return lines.filter(Boolean).join("\n");
}

export function buildInstagramReport(input: InstagramReportInput): InstagramReport {
  const { posts, areas, users, accountStats, filterDescription, focusArea } = input;
  const totals = aggregateMetrics(posts);
  const areaDashboards = computeAreaDashboards(posts, areas, users);
  const areaRows = buildAreaRows(areaDashboards, posts, totals);
  const collaboratorRows = buildCollaboratorRows(areaDashboards);
  const formatRows = buildFormatRows(posts);
  const postRows = posts.map((p) => buildPostRow(p, users));
  const topPosts = [...postRows].sort((a, b) => b.engagementActions - a.engagementActions).slice(0, 20);

  const dates = posts
    .map((p) => p.published_at)
    .filter((d): d is string => Boolean(d))
    .sort();

  const topAreaByPosts = [...areaRows].sort((a, b) => b.posts - a.posts)[0]?.area ?? "—";
  const topAreaByEngagement = areaRows[0]?.area ?? "—";
  const topPost = topPosts[0];

  const base = {
    generatedAt: new Date().toISOString(),
    accountUsername: accountStats?.username ?? "bismarchipires",
    followers: accountStats?.followers_count ?? 0,
    periodFrom: dates[0] ? formatDate(dates[0]) : null,
    periodTo: dates.length ? formatDate(dates[dates.length - 1]) : null,
    filterDescription: filterDescription?.trim() || "Todos os posts desde 2025",
    totalPosts: totals.posts,
    linkedPosts: posts.filter(isPostFullyLinked).length,
    pendingPosts: posts.filter(isPostPendingLink).length,
    totalReach: totals.reach,
    totalViews: totals.views,
    totalEngagementActions: totals.engagementActions,
    avgEngagementActions:
      totals.posts > 0 ? Number((totals.engagementActions / totals.posts).toFixed(1)) : 0,
    aggregateEngagementRate: computeAggregateEngagementRate(posts),
    totalLikes: totals.likes,
    totalComments: totals.comments,
    totalSaves: totals.saves,
    topAreaByPosts,
    topAreaByEngagement,
    topPostCaption: topPost?.caption ?? "—",
    topPostEngagementActions: topPost?.engagementActions ?? 0,
    areaRows,
    collaboratorRows,
    formatRows,
    topPosts,
    postRows,
  };

  return {
    ...base,
    narrative: buildNarrative(base, focusArea),
  };
}

export function reportFilenameBase(report: InstagramReport, focusArea?: string): string {
  const dateLabel = new Date().toISOString().slice(0, 10);
  if (focusArea) {
    return `instagram-${slugify(focusArea)}-${dateLabel}`;
  }
  return `instagram-insights-${dateLabel}`;
}

export async function downloadInstagramReportExcel(
  report: InstagramReport,
  options?: { filenameBase?: string }
): Promise<void> {
  const XLSX = await import("xlsx");

  const summaryRows = [
    { Seção: "Conta", Indicador: "Usuário", Valor: `@${report.accountUsername}` },
    { Seção: "Conta", Indicador: "Seguidores", Valor: report.followers },
    { Seção: "Período", Indicador: "De", Valor: report.periodFrom ?? "—" },
    { Seção: "Período", Indicador: "Até", Valor: report.periodTo ?? "—" },
    { Seção: "Período", Indicador: "Filtros", Valor: report.filterDescription },
    { Seção: "Visão geral", Indicador: "Posts analisados", Valor: report.totalPosts },
    { Seção: "Visão geral", Indicador: "Posts vinculados", Valor: report.linkedPosts },
    { Seção: "Visão geral", Indicador: "Posts pendentes", Valor: report.pendingPosts },
    { Seção: "Visão geral", Indicador: "Alcance total", Valor: report.totalReach },
    { Seção: "Visão geral", Indicador: "Visualizações total", Valor: report.totalViews },
    { Seção: "Visão geral", Indicador: `${ENGAGEMENT_ACTIONS_LABEL} total`, Valor: report.totalEngagementActions },
    { Seção: "Visão geral", Indicador: "Média ações de engajamento/post", Valor: report.avgEngagementActions },
    { Seção: "Visão geral", Indicador: "Taxa de engajamento (%)", Valor: report.aggregateEngagementRate },
    { Seção: "Visão geral", Indicador: "Fórmula taxa de engajamento", Valor: ENGAGEMENT_RATE_FORMULA },
    { Seção: "Visão geral", Indicador: "Curtidas total", Valor: report.totalLikes },
    { Seção: "Visão geral", Indicador: "Comentários total", Valor: report.totalComments },
    { Seção: "Visão geral", Indicador: "Salvamentos total", Valor: report.totalSaves },
    { Seção: "Destaques", Indicador: "Área com mais posts", Valor: report.topAreaByPosts },
    { Seção: "Destaques", Indicador: "Área com mais ações de engajamento", Valor: report.topAreaByEngagement },
    {
      Seção: "Destaques",
      Indicador: "Post destaque (ações de engajamento)",
      Valor: report.topPostEngagementActions,
    },
    { Seção: "Destaques", Indicador: "Legenda do post destaque", Valor: report.topPostCaption },
    { Seção: "", Indicador: "Gerado em", Valor: formatDateTime(report.generatedAt) },
  ];

  const areaSheet = report.areaRows.map((r) => ({
    Área: r.area,
    Posts: r.posts,
    "% Posts": r.postsSharePct,
    Alcance: r.reach,
    Visualizações: r.views,
    Curtidas: r.likes,
    Comentários: r.comments,
    Compartilhamentos: r.shares,
    Salvamentos: r.saves,
    [ENGAGEMENT_ACTIONS_LABEL]: r.engagementActions,
    [`% ${ENGAGEMENT_ACTIONS_LABEL}`]: r.engagementSharePct,
    "Média ações/post": r.avgEngagementActions,
    "Média alcance/post": r.avgReach,
    "Média views/post": r.avgViews,
    "Taxa de engajamento (%)": r.engagementRate,
    "Formato predominante": r.topFormat,
    "Colaboradores c/ posts": r.collaboratorsWithPosts,
  }));

  const collabSheet = report.collaboratorRows.map((r) => ({
    Área: r.area,
    Colaborador: r.name,
    Status: r.status,
    Posts: r.posts,
    Alcance: r.reach,
    Visualizações: r.views,
    [ENGAGEMENT_ACTIONS_LABEL]: r.engagementActions,
    "Média ações/post": r.avgEngagementActions,
  }));

  const formatSheet = report.formatRows.map((r) => ({
    Formato: r.format,
    Posts: r.posts,
    "% do total": r.sharePct,
    Alcance: r.reach,
    Visualizações: r.views,
    [ENGAGEMENT_ACTIONS_LABEL]: r.engagementActions,
    "Média ações/post": r.avgEngagementActions,
  }));

  const topSheet = report.topPosts.map((r, i) => ({
    Rank: i + 1,
    Data: r.date,
    Áreas: r.areas,
    Autores: r.authors,
    Formato: r.format,
    [ENGAGEMENT_ACTIONS_LABEL]: r.engagementActions,
    Alcance: r.reach,
    Visualizações: r.views,
    "Taxa de engajamento (%)": r.engagementRate,
    Legenda: r.caption,
    Link: r.permalink,
  }));

  const postsSheet = report.postRows.map((r) => ({
    Data: r.date,
    Áreas: r.areas,
    Autores: r.authors,
    Formato: r.format,
    Tags: r.tags,
    Collab: r.collab,
    Vínculo: r.linkStatus,
    Alcance: r.reach,
    Visualizações: r.views,
    Curtidas: r.likes,
    Comentários: r.comments,
    Compartilhamentos: r.shares,
    Salvamentos: r.saves,
    [ENGAGEMENT_ACTIONS_LABEL]: r.engagementActions,
    "Taxa de engajamento (%)": r.engagementRate,
    Legenda: r.caption,
    Link: r.permalink,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Resumo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areaSheet), "Por Area");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(collabSheet), "Colaboradores");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formatSheet), "Por Formato");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topSheet), "Top Posts");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(postsSheet), "Posts");

  const dateLabel = new Date().toISOString().slice(0, 10);
  const base = options?.filenameBase ?? `instagram-insights-${dateLabel}`;
  XLSX.writeFile(wb, `${base}.xlsx`);
}

export function downloadInstagramReportText(
  report: InstagramReport,
  options?: { filenameBase?: string }
): void {
  const blob = new Blob(["\uFEFF" + report.narrative], {
    type: "text/plain;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const base = options?.filenameBase ?? `instagram-insights-${new Date().toISOString().slice(0, 10)}`;
  a.download = `${base}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
