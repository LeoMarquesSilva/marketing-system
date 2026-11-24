"use client";

import * as React from "react";
import {
  CircleCheck,
  Clapperboard,
  ExternalLink,
  Eye,
  FileText,
  GalleryHorizontalEnd,
  ImageIcon,
  Instagram,
  Link2,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Percent,
  Repeat2,
  ThumbsUp,
  Unlink,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AreaBadge, PersonDot } from "@/components/instagram/metrics/instagram-post-pieces";
import { FORMAT_COLORS } from "@/components/social-metrics/metrics-charts";
import { getAreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { getLinkedinPostTitle, linkedinPostEngagementPercent } from "@/lib/linkedin-analytics";
import { captionSimilarity, linkedinInstagramDateDistance } from "@/lib/linkedin-match";
import { formatCompact, formatInt, formatPercent } from "@/lib/social-metrics/format";
import { dateInSaoPaulo, formatFullDate, isDateInRange } from "@/lib/social-metrics/period";
import type { LinkedinPost } from "@/lib/linkedin-types";
import type { InstagramPost } from "@/lib/instagram-posts";

/* ------------------------------------------------------------ tipos */

export interface LinkedinMetricsUser {
  id: string;
  name: string;
  avatar_url: string | null;
  auth_id: string | null;
}

export type LinkedinPostFormat = "video" | "carrossel" | "imagem";

export const LINKEDIN_FORMAT_LABELS: Record<LinkedinPostFormat, string> = {
  video: "Vídeo",
  carrossel: "Carrossel",
  imagem: "Imagem ou texto",
};

export const LINKEDIN_FORMAT_ICONS: Record<LinkedinPostFormat, LucideIcon> = {
  video: Clapperboard,
  carrossel: GalleryHorizontalEnd,
  imagem: ImageIcon,
};

/** Cor segue o formato (mesma paleta do Instagram: vídeo = reels). */
export const LINKEDIN_FORMAT_COLORS: Record<LinkedinPostFormat, string> = {
  video: FORMAT_COLORS.reels,
  carrossel: FORMAT_COLORS.carrossel,
  imagem: FORMAT_COLORS.imagem,
};

/** Mesmo critério de computeLinkedinPerformanceByFormat. */
export function linkedinPostFormat(post: LinkedinPost): LinkedinPostFormat {
  if (post.content_type === "Vídeo" || post.instagram_post?.media_type === "VIDEO") return "video";
  if (post.instagram_post?.media_type === "CAROUSEL_ALBUM") return "carrossel";
  return "imagem";
}

export function linkedinPostDate(post: LinkedinPost): string {
  return dateInSaoPaulo(post.published_at);
}

/** Publicações entre as datas (dia de São Paulo). */
export function linkedinPostsInRange(posts: LinkedinPost[], from: string, to: string): LinkedinPost[] {
  return posts.filter((post) => post.published_at && isDateInRange(linkedinPostDate(post), from, to));
}

export function linkedinPostAreas(post: LinkedinPost): string[] {
  const areas = post.instagram_post?.areas?.length
    ? post.instagram_post.areas
    : post.instagram_post?.area
      ? [post.instagram_post.area]
      : [];
  return [...new Set(areas)];
}

function normalizeName(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Autores: os do post do Instagram vinculado; sem vínculo, o nome assinado no texto. */
export function linkedinPostPeople(post: LinkedinPost, users: LinkedinMetricsUser[]): { key: string; name: string; avatar_url: string | null }[] {
  const authors = post.instagram_post?.solicitantes ?? [];
  if (authors.length > 0) {
    return authors.map((author) => {
      const user = users.find((item) => item.id === author.id);
      return { key: author.id, name: user?.name ?? author.name, avatar_url: user?.avatar_url ?? null };
    });
  }
  if (post.byline) {
    const user = users.find((item) => normalizeName(item.name) === normalizeName(post.byline as string));
    return [{ key: `byline-${post.byline}`, name: user?.name ?? post.byline, avatar_url: user?.avatar_url ?? null }];
  }
  return [];
}

function coverSrc(post: InstagramPost | null | undefined): string | null {
  if (!post) return null;
  return post.thumbnail_url ?? post.media_url ?? null;
}

/* ------------------------------------------------------------ capa */

export function LinkedinPostCover({ post, className, showFormat = true }: { post: LinkedinPost; className?: string; showFormat?: boolean }) {
  const [failed, setFailed] = React.useState(false);
  const src = coverSrc(post.instagram_post);
  const format = linkedinPostFormat(post);
  const Icon = LINKEDIN_FORMAT_ICONS[format];
  return (
    <div className={cn("relative overflow-hidden bg-[#eef3f5]", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="flex h-full w-full flex-col justify-between gap-3 bg-[linear-gradient(160deg,#f5fafb_0%,#e6f0f3_100%)] p-4 pt-10">
          <FileText className="size-5 text-[#9fb4bd]" aria-hidden />
          <p className="line-clamp-5 text-sm font-medium leading-snug text-[#36505c]">{getLinkedinPostTitle(post.caption, 160)}</p>
          <span className="text-xs text-[#7f97a1]">Sem capa do Instagram</span>
        </div>
      )}
      {showFormat && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-medium text-[#10232d] shadow-sm">
          <Icon className="size-3" style={{ color: LINKEDIN_FORMAT_COLORS[format] }} aria-hidden />
          {LINKEDIN_FORMAT_LABELS[format]}
        </span>
      )}
    </div>
  );
}

function CoverThumb({ post }: { post: LinkedinPost }) {
  const [failed, setFailed] = React.useState(false);
  const src = coverSrc(post.instagram_post);
  const Icon = LINKEDIN_FORMAT_ICONS[linkedinPostFormat(post)];
  return (
    <span className="flex h-[70px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#eef3f5] text-[#9fb4bd]">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <Icon className="size-5" aria-hidden />
      )}
    </span>
  );
}

/* ------------------------------------------------------------ card da grade */

export function LinkedinPostCard({
  post,
  users,
  metricLabel,
  metricValue,
  onOpen,
}: {
  post: LinkedinPost;
  users: LinkedinMetricsUser[];
  metricLabel: string;
  metricValue: string;
  onOpen: () => void;
}) {
  const areas = linkedinPostAreas(post);
  const people = linkedinPostPeople(post, users).slice(0, 3);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#dce9eb] bg-white text-left transition-shadow hover:shadow-[0_6px_18px_rgba(4,32,47,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
    >
      <LinkedinPostCover post={post} className="aspect-[4/5] w-full" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground">{post.published_at ? formatFullDate(linkedinPostDate(post)) : "Sem data"}</span>
          <span className="text-right">
            <span className="block font-mono text-base font-semibold leading-none text-[#10232d]">{metricValue}</span>
            <span className="text-xs text-muted-foreground">{metricLabel}</span>
          </span>
        </div>
        <p className="line-clamp-2 text-xs leading-relaxed text-[#36505c]">{getLinkedinPostTitle(post.caption, 140)}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-wrap gap-1">
            {areas.slice(0, 2).map((area) => {
              const Icon = getAreaIcon(area);
              return (
                <span key={area} className={cn("flex size-6 items-center justify-center rounded-full ring-1 ring-inset", getAreaIconStyle(area))} title={area}>
                  <Icon className="size-3" aria-hidden />
                </span>
              );
            })}
            {!post.instagram_post_id && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900">Sem vínculo</span>}
          </div>
          <div className="flex -space-x-1.5">
            {people.map((person) => (
              <PersonDot key={person.key} user={person} />
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------ linha de ranking */

export function LinkedinPostRankRow({
  post,
  rank,
  metricLabel,
  metricValue,
  secondary,
  onOpen,
}: {
  post: LinkedinPost;
  rank: number;
  metricLabel: string;
  metricValue: string;
  secondary?: string;
  onOpen: () => void;
}) {
  const format = linkedinPostFormat(post);
  const Icon = LINKEDIN_FORMAT_ICONS[format];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-[#f4fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
    >
      <span className="w-5 shrink-0 text-center font-mono text-sm font-semibold text-[#6b8591]">{rank}</span>
      <CoverThumb post={post} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5" style={{ color: LINKEDIN_FORMAT_COLORS[format] }} aria-hidden />
          {LINKEDIN_FORMAT_LABELS[format]} · {post.published_at ? formatFullDate(linkedinPostDate(post)) : "sem data"}
        </span>
        <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-[#1d3440]">{getLinkedinPostTitle(post.caption, 160)}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-lg font-semibold leading-none text-[#10232d]">{metricValue}</span>
        <span className="text-xs text-muted-foreground">{metricLabel}</span>
        {secondary && <span className="block text-xs text-[#4a6470]">{secondary}</span>}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------ detalhe */

function MetricCell({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e3eef0] bg-[#fbfdfd] px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-xs text-[#4a6470]">
        <Icon className="size-3.5 text-[#3e84a8]" aria-hidden />
        {label}
      </span>
      <span className="mt-1 block font-mono text-lg font-semibold text-[#10232d]">{value}</span>
    </div>
  );
}

function matchDescription(post: LinkedinPost): string {
  if (!post.instagram_post_id) {
    return post.match_strategy === "manual_unlinked" ? "Vínculo removido à mão: a importação não refaz sozinha." : "Nenhum post do Instagram vinculado.";
  }
  if (post.match_strategy === "manual") return "Vinculado à mão.";
  if (post.match_confidence !== null && post.match_confidence !== undefined) {
    return `Vinculado na importação (${formatPercent(post.match_confidence * 100, 0)} de confiança).`;
  }
  return "Vinculado na importação.";
}

function CandidateTile({
  candidate,
  selected,
  disabled,
  onSelect,
}: {
  candidate: InstagramPost;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const [failed, setFailed] = React.useState(false);
  const src = coverSrc(candidate);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-md border bg-white text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50 disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "border-[#347796] shadow-[0_0_0_1px_#347796]" : "border-[#dce9eb] hover:border-[#9fcbd6]"
      )}
    >
      <span className="relative block aspect-[4/5] w-full bg-[#eef3f5]">
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[#9fb4bd]">
            <ImageIcon className="size-6" aria-hidden />
          </span>
        )}
        {selected && (
          <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-[#347796] text-white">
            <CircleCheck className="size-4" aria-hidden />
          </span>
        )}
      </span>
      <span className="space-y-0.5 p-2">
        <span className="block text-xs font-medium text-[#10232d]">{candidate.published_at ? formatFullDate(dateInSaoPaulo(candidate.published_at)) : "Sem data"}</span>
        <span className="line-clamp-2 text-xs leading-snug text-[#4a6470]">{candidate.caption ?? "Sem legenda"}</span>
      </span>
    </button>
  );
}

export function LinkedinPostDetailDialog({
  post,
  open,
  onOpenChange,
  candidates,
  users,
  averageRate,
  saving,
  onLink,
}: {
  post: LinkedinPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: InstagramPost[];
  users: LinkedinMetricsUser[];
  averageRate: number | null;
  saving: boolean;
  onLink: (linkedinPostId: string, instagramPostId: string | null) => void;
}) {
  const ranked = React.useMemo(() => {
    if (!post) return [];
    const list = candidates
      .map((candidate) => ({
        candidate,
        dayDistance: linkedinInstagramDateDistance(post.published_at, candidate.published_at),
        textScore: captionSimilarity(post.caption, candidate.caption),
      }))
      .filter((item) => item.dayDistance <= 3 || item.candidate.id === post.instagram_post_id)
      .sort((left, right) => left.dayDistance - right.dayDistance || right.textScore - left.textScore)
      .slice(0, 12)
      .map((item) => item.candidate);
    if (post.instagram_post && !list.some((candidate) => candidate.id === post.instagram_post?.id)) list.unshift(post.instagram_post);
    return list;
  }, [candidates, post]);

  if (!post) return null;
  const format = linkedinPostFormat(post);
  const rate = linkedinPostEngagementPercent(post);
  const vsAverage = averageRate && averageRate > 0 ? ((rate - averageRate) / averageRate) * 100 : null;
  const areas = linkedinPostAreas(post);
  const people = linkedinPostPeople(post, users);
  const kind = [post.publication_type, post.content_type].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-[#dce9eb] px-6 py-4 pr-12 text-left">
          <DialogTitle className="text-base">
            {LINKEDIN_FORMAT_LABELS[format]} de {post.published_at ? formatFullDate(linkedinPostDate(post)) : "data desconhecida"}
          </DialogTitle>
          <DialogDescription className="line-clamp-1">{getLinkedinPostTitle(post.caption, 200)}</DialogDescription>
        </DialogHeader>

        <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="space-y-3">
            <LinkedinPostCover post={post} className="aspect-[4/5] w-full rounded-lg" />
            <div className="flex flex-col gap-1.5">
              <a
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#347796] hover:text-[#285f7a] hover:underline"
              >
                <ExternalLink className="size-4" aria-hidden />
                Abrir no LinkedIn
              </a>
              {post.instagram_post?.permalink && (
                <a
                  href={post.instagram_post.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#347796] hover:text-[#285f7a] hover:underline"
                >
                  <Instagram className="size-4" aria-hidden />
                  Abrir o post do Instagram
                </a>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-2xl font-semibold text-[#10232d]">{formatPercent(rate, 2)}</span>
              <span className="text-xs text-muted-foreground">taxa de engajamento</span>
              {vsAverage !== null && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    vsAverage >= 10 ? "bg-emerald-50 text-emerald-700" : vsAverage <= -10 ? "bg-rose-50 text-rose-700" : "bg-[#f1f5f7] text-[#4a6470]"
                  )}
                >
                  {vsAverage >= 10 ? "acima" : vsAverage <= -10 ? "abaixo" : "na"} da média do período
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricCell icon={Eye} label="Impressões" value={formatInt(post.impressions)} />
              <MetricCell icon={MousePointerClick} label="Cliques" value={formatInt(post.clicks)} />
              <MetricCell icon={Percent} label="CTR" value={formatPercent((post.ctr ?? 0) * 100, 1)} />
              <MetricCell icon={ThumbsUp} label="Reações" value={formatInt(post.likes)} />
              <MetricCell icon={MessageCircle} label="Comentários" value={formatInt(post.comments)} />
              <MetricCell icon={Repeat2} label="Compartilhamentos" value={formatInt(post.shares)} />
              <MetricCell icon={UserPlus} label="Seguidores ganhos" value={formatInt(post.followers)} />
              {post.views > 0 && <MetricCell icon={Clapperboard} label="Visualizações" value={formatCompact(post.views)} />}
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Taxa do LinkedIn = (cliques + reações + comentários + compartilhamentos + seguidores ganhos) ÷ impressões.
              {kind ? ` Tipo: ${kind}.` : ""}
              {post.published_by ? ` Publicado por ${post.published_by}.` : ""}
            </p>

            {(areas.length > 0 || people.length > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                {areas.map((area) => (
                  <AreaBadge key={area} area={area} />
                ))}
                {people.map((person) => (
                  <span key={person.key} className="inline-flex items-center gap-1.5 rounded-full border border-[#dce9eb] bg-white py-0.5 pl-0.5 pr-2 text-xs text-[#36505c]">
                    <PersonDot user={person} className="size-5 ring-0" />
                    {person.name}
                  </span>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-[#dce9eb] p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-[#10232d]">
                    <Link2 className="size-4 text-[#3e84a8]" aria-hidden />
                    Post do Instagram vinculado
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {matchDescription(post)} A capa, a área e os autores vêm desse post.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {saving && <Loader2 className="size-4 animate-spin text-[#347796]" aria-label="Salvando" />}
                  {post.instagram_post_id && (
                    <Button variant="outline" size="sm" disabled={saving} onClick={() => onLink(post.id, null)}>
                      <Unlink className="size-4" aria-hidden />
                      Remover vínculo
                    </Button>
                  )}
                </div>
              </div>
              {ranked.length === 0 ? (
                <p className="rounded-md bg-[#f6fafb] px-3 py-4 text-center text-xs text-muted-foreground">
                  Nenhum post do Instagram publicado até 3 dias antes ou depois desta publicação.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-[#4a6470]">Posts do Instagram de até 3 dias antes ou depois. Clique para vincular.</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {ranked.map((candidate) => (
                      <CandidateTile
                        key={candidate.id}
                        candidate={candidate}
                        selected={candidate.id === post.instagram_post_id}
                        disabled={saving}
                        onSelect={() => {
                          if (candidate.id !== post.instagram_post_id) onLink(post.id, candidate.id);
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
