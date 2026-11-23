"use client";

import * as React from "react";
import {
  Bookmark,
  CircleUserRound,
  Clapperboard,
  ExternalLink,
  Eye,
  GalleryHorizontalEnd,
  Heart,
  ImageIcon,
  MessageCircle,
  MousePointerClick,
  Repeat2,
  Send,
  Timer,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InstagramPostLinkEditor, type PostLinkPatch } from "@/components/instagram/instagram-post-link-editor";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { computePostEngagementRate } from "@/lib/instagram-engagement";
import { formatCompact, formatInt, formatPercent, formatSeconds } from "@/lib/social-metrics/format";
import { formatFullDate } from "@/lib/social-metrics/period";
import { POST_FORMAT_LABELS, postDate, postFormat, type PostFormat } from "@/lib/social-metrics/instagram";
import { FORMAT_COLORS } from "@/components/social-metrics/metrics-charts";
import type { InstagramPost } from "@/lib/instagram-posts";
import type { Area } from "@/lib/areas";
import type { User } from "@/lib/users";

export const FORMAT_ICONS: Record<PostFormat | "stories", LucideIcon> = {
  reels: Clapperboard,
  carrossel: GalleryHorizontalEnd,
  imagem: ImageIcon,
  stories: CircleUserRound,
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function PersonDot({ user, className }: { user: Pick<User, "name" | "avatar_url">; className?: string }) {
  return (
    <Avatar className={cn("size-6 ring-2 ring-white", className)} title={user.name}>
      {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
      <AvatarFallback className="bg-[#e8f1f5] text-xs font-semibold text-[#315f73]">{initials(user.name || "?")}</AvatarFallback>
    </Avatar>
  );
}

export function AreaBadge({ area }: { area: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", getAreaIconStyle(area))}>
      <AreaIcon area={area} className="size-3" aria-hidden />
      {area}
    </span>
  );
}

export function PostCover({ post, className }: { post: InstagramPost; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  const format = postFormat(post);
  const Icon = FORMAT_ICONS[format];
  const src = post.thumbnail_url ?? post.media_url;
  return (
    <div className={cn("relative overflow-hidden bg-[#eef3f5]", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#9fb4bd]">
          <Icon className="size-8" aria-hidden />
        </div>
      )}
      <span
        className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-medium text-[#10232d] shadow-sm"
        title={POST_FORMAT_LABELS[format]}
      >
        <Icon className="size-3" style={{ color: FORMAT_COLORS[format] }} aria-hidden />
        {POST_FORMAT_LABELS[format]}
      </span>
    </div>
  );
}

export function PostCard({
  post,
  users,
  metricLabel,
  metricValue,
  onOpen,
  rank,
}: {
  post: InstagramPost;
  users: User[];
  metricLabel: string;
  metricValue: string;
  onOpen: () => void;
  rank?: number;
}) {
  const people = post.solicitantes
    .map((s) => users.find((user) => user.id === s.id) ?? { name: s.name, avatar_url: null })
    .slice(0, 3);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#dce9eb] bg-white text-left transition-shadow hover:shadow-[0_6px_18px_rgba(4,32,47,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
    >
      <div className="relative">
        <PostCover post={post} className="aspect-[4/5] w-full" />
        {rank !== undefined && (
          <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-[#04202f] font-mono text-xs font-semibold text-white">
            {rank}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground">{formatFullDate(postDate(post))}</span>
          <span className="text-right">
            <span className="block font-mono text-base font-semibold leading-none text-[#10232d]">{metricValue}</span>
            <span className="text-xs text-muted-foreground">{metricLabel}</span>
          </span>
        </div>
        <p className="line-clamp-2 text-xs leading-relaxed text-[#36505c]">{post.caption ?? "Sem legenda"}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-wrap gap-1">
            {[...new Set(post.areas)].slice(0, 2).map((area) => (
              <span key={area} className={cn("flex size-6 items-center justify-center rounded-full ring-1 ring-inset", getAreaIconStyle(area))} title={area}>
                <AreaIcon area={area} className="size-3" aria-hidden />
              </span>
            ))}
            {post.areas.length === 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900">Sem área</span>}
          </div>
          <div className="flex -space-x-1.5">
            {people.map((person, index) => (
              <PersonDot key={`${person.name}-${index}`} user={person} />
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

/** Linha de ranking: posição, miniatura, legenda e a métrica em destaque. */
export function PostRankRow({
  post,
  rank,
  metricLabel,
  metricValue,
  secondary,
  onOpen,
}: {
  post: InstagramPost;
  rank: number;
  metricLabel: string;
  metricValue: string;
  secondary?: string;
  onOpen: () => void;
}) {
  const format = postFormat(post);
  const Icon = FORMAT_ICONS[format];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-[#f4fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
    >
      <span className="w-5 shrink-0 text-center font-mono text-sm font-semibold text-[#6b8591]">{rank}</span>
      <PostThumb post={post} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5" style={{ color: FORMAT_COLORS[format] }} aria-hidden />
          {POST_FORMAT_LABELS[format]} · {formatFullDate(postDate(post))}
        </span>
        <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-[#1d3440]">{post.caption ?? "Sem legenda"}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-lg font-semibold leading-none text-[#10232d]">{metricValue}</span>
        <span className="text-xs text-muted-foreground">{metricLabel}</span>
        {secondary && <span className="block text-xs text-[#4a6470]">{secondary}</span>}
      </span>
    </button>
  );
}

function PostThumb({ post }: { post: InstagramPost }) {
  const [failed, setFailed] = React.useState(false);
  const src = post.thumbnail_url ?? post.media_url;
  const Icon = FORMAT_ICONS[postFormat(post)];
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

function MetricCell({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-[#e3eef0] bg-[#fbfdfd] px-3 py-2.5" title={hint}>
      <span className="flex items-center gap-1.5 text-xs text-[#4a6470]">
        <Icon className="size-3.5 text-[#3e84a8]" aria-hidden />
        {label}
      </span>
      <span className="mt-1 block font-mono text-lg font-semibold text-[#10232d]">{value}</span>
    </div>
  );
}

export function PostDetailDialog({
  post,
  open,
  onOpenChange,
  areas,
  users,
  averageRate,
  saving,
  onSave,
}: {
  post: InstagramPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Area[];
  users: User[];
  averageRate: number | null;
  saving: boolean;
  onSave: (post: InstagramPost, patch: PostLinkPatch) => void;
}) {
  const [areaOptions, setAreaOptions] = React.useState(areas);
  React.useEffect(() => setAreaOptions(areas), [areas]);
  if (!post) return null;
  const format = postFormat(post);
  const rate = computePostEngagementRate(post);
  const vsAverage = averageRate && averageRate > 0 ? ((rate - averageRate) / averageRate) * 100 : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-[#dce9eb] px-6 py-4 text-left">
          <DialogTitle className="text-base">
            {POST_FORMAT_LABELS[format]} de {formatFullDate(postDate(post))}
          </DialogTitle>
          <DialogDescription className="line-clamp-1">{post.caption ?? "Sem legenda"}</DialogDescription>
        </DialogHeader>
        <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className="space-y-3">
            <PostCover post={post} className="aspect-[4/5] w-full rounded-lg" />
            {post.permalink && (
              <a
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#347796] hover:text-[#285f7a] hover:underline"
              >
                <ExternalLink className="size-4" aria-hidden />
                Abrir no Instagram
              </a>
            )}
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MetricCell icon={Users} label="Alcance" value={formatInt(post.reach)} />
              <MetricCell icon={Eye} label="Visualizações" value={formatInt(post.views)} />
              <MetricCell icon={Heart} label="Curtidas" value={formatInt(post.likes)} />
              <MetricCell icon={MessageCircle} label="Comentários" value={formatInt(post.comments)} />
              <MetricCell icon={Bookmark} label="Salvamentos" value={formatInt(post.saves)} />
              <MetricCell icon={Send} label="Compartilhamentos" value={formatInt(post.shares)} />
              <MetricCell icon={Repeat2} label="Reposts" value={formatInt(post.reposts)} />
              {format === "reels" ? (
                <MetricCell icon={Timer} label="Tempo médio assistido" value={formatSeconds(post.reels_avg_watch_time)} />
              ) : (
                <>
                  <MetricCell icon={UserPlus} label="Seguidores ganhos" value={formatInt(post.follows)} />
                  <MetricCell icon={CircleUserRound} label="Visitas ao perfil" value={formatInt(post.profile_visits)} />
                  <MetricCell icon={MousePointerClick} label="Cliques no link" value={formatInt(post.link_clicks)} />
                </>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Taxa = (curtidas + comentários + salvamentos) ÷ alcance. Alcance de {formatCompact(post.reach)} contas.
            </p>
            <div className="rounded-lg border border-[#dce9eb] p-4">
              <p className="mb-3 text-sm font-semibold text-[#10232d]">Área e autores</p>
              <InstagramPostLinkEditor
                post={post}
                areas={areaOptions}
                users={users}
                saving={saving}
                onAreasChange={setAreaOptions}
                onSave={(patch) => onSave(post, patch)}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
