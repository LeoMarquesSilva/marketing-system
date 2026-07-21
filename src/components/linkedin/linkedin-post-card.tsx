"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Link2,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Repeat2,
  ThumbsUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InstagramPostThumbnail } from "@/components/instagram/instagram-post-thumbnail";
import { captionSimilarity, linkedinInstagramDateDistance } from "@/lib/linkedin-match";
import { getLinkedinPostTitle } from "@/lib/linkedin-analytics";
import type { LinkedinPost } from "@/lib/linkedin-types";
import type { InstagramPost } from "@/lib/instagram-posts";

interface LinkedinPostCardProps {
  post: LinkedinPost;
  instagramCandidates: InstagramPost[];
  saving: boolean;
  onLink: (linkedinPostId: string, instagramPostId: string | null) => void;
}

function formatNumber(value: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function candidateLabel(candidate: InstagramPost): string {
  const date = candidate.published_at
    ? new Date(candidate.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : "sem data";
  return `${date} · ${getLinkedinPostTitle(candidate.caption, 72)}`;
}

export function LinkedinPostCard({
  post,
  instagramCandidates,
  saving,
  onLink,
}: LinkedinPostCardProps) {
  const candidates = useMemo(() => {
    const ranked = instagramCandidates
      .map((candidate) => ({
        candidate,
        dayDistance: linkedinInstagramDateDistance(post.published_at, candidate.published_at),
        textScore: captionSimilarity(post.caption, candidate.caption),
      }))
      .filter((item) => item.dayDistance <= 3 || item.candidate.id === post.instagram_post_id)
      .sort((left, right) =>
        left.dayDistance - right.dayDistance || right.textScore - left.textScore
      )
      .slice(0, 24)
      .map((item) => item.candidate);
    if (post.instagram_post && !ranked.some((candidate) => candidate.id === post.instagram_post?.id)) {
      ranked.unshift(post.instagram_post);
    }
    return ranked;
  }, [instagramCandidates, post.caption, post.instagram_post, post.instagram_post_id, post.published_at]);

  const matched = Boolean(post.instagram_post_id);
  const areas = post.instagram_post?.areas?.length
    ? post.instagram_post.areas
    : post.instagram_post?.area
      ? [post.instagram_post.area]
      : [];
  const authors = post.instagram_post?.solicitantes ?? [];

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.09)]">
      <div className="grid md:grid-cols-[174px_1fr]">
        <div className="flex min-h-[174px] items-center justify-center border-b border-slate-100 bg-[radial-gradient(circle_at_top,#eaf5ff,transparent_65%)] p-4 md:border-b-0 md:border-r">
          {post.instagram_post ? (
            <InstagramPostThumbnail post={post.instagram_post} size="card" />
          ) : (
            <div className="flex h-[142px] w-[142px] flex-col items-center justify-center rounded-xl border border-dashed border-[#0A66C2]/25 bg-white/70 text-center">
              <ImageIcon className="h-7 w-7 text-[#0A66C2]/35" />
              <span className="mt-2 px-3 text-[10px] font-medium text-slate-500">Preview aguardando vínculo</span>
            </div>
          )}
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className="border-0 bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/10">
                  {post.content_type || post.publication_type || "Orgânico"}
                </Badge>
                {matched ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Instagram vinculado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    Vínculo pendente
                  </Badge>
                )}
                {post.match_confidence != null && matched && (
                  <span className="text-[10px] font-medium text-slate-400">
                    {(post.match_confidence * 100).toFixed(0)}% confiança
                  </span>
                )}
              </div>
              <h3 className="mt-2.5 text-base font-semibold leading-snug text-slate-950">
                {getLinkedinPostTitle(post.caption, 150)}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span>{post.published_at ? new Date(post.published_at).toLocaleDateString("pt-BR") : "Sem data"}</span>
                {post.byline && <span>Por {post.byline}</span>}
                {areas.map((area) => <span key={area} className="font-medium text-[#0A66C2]">{area}</span>)}
                {authors.map((author) => <span key={author.id}>{author.name}</span>)}
              </div>
            </div>
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir publicação no LinkedIn"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-[#0A66C2]/30 hover:bg-[#0A66C2]/5 hover:text-[#0A66C2]"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { icon: MousePointerClick, label: "Impressões", value: post.impressions },
              { icon: Link2, label: "Cliques", value: post.clicks },
              { icon: ThumbsUp, label: "Gostaram", value: post.likes },
              { icon: MessageCircle, label: "Comentários", value: post.comments },
              { icon: Repeat2, label: "Compart.", value: post.shares },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <metric.icon className="h-3 w-3" />
                  {metric.label}
                </div>
                <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-900">{formatNumber(metric.value)}</p>
              </div>
            ))}
            <div className="rounded-xl bg-[#0A66C2]/7 px-3 py-2.5">
              <p className="text-[10px] text-[#0A66C2]">Engajamento</p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#0A66C2]">
                {(post.engagement_rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <label htmlFor={`instagram-link-${post.id}`} className="shrink-0 text-[11px] font-semibold text-slate-600">
              Preview do Instagram
            </label>
            <div className="relative min-w-0 flex-1">
              <select
                id={`instagram-link-${post.id}`}
                value={post.instagram_post_id ?? ""}
                onChange={(event) => onLink(post.id, event.target.value || null)}
                disabled={saving}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 pr-9 text-xs text-slate-700 outline-none transition focus:border-[#0A66C2]/50 focus:ring-2 focus:ring-[#0A66C2]/10 disabled:opacity-60"
              >
                <option value="">Sem vínculo</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidateLabel(candidate)}</option>
                ))}
              </select>
              {saving && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-[#0A66C2]" />}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
