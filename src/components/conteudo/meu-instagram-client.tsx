"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Instagram,
  ExternalLink,
  Heart,
  MessageCircle,
  Bookmark,
  Eye,
  TrendingUp,
  TrendingDown,
  Newspaper,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { InstagramPost } from "@/lib/instagram-posts";
import { computeEngagementActionsFromPost } from "@/lib/instagram-engagement";
import { resolveInstagramThumbnailSrc } from "@/lib/instagram-thumbnail-client";
import { Share2 } from "lucide-react";
import {
  InstagramMediaCard,
  InstagramMediaThumb,
  instagramMediaInfo,
} from "@/components/instagram/instagram-media-card";

export interface OfficeStats {
  posts: number;
  avgReach: number;
  avgActions: number;
  rate: number;
}

interface MeuInstagramClientProps {
  userName: string;
  posts: InstagramPost[];
  office: OfficeStats;
}

function nf(n: number) {
  return Math.round(n).toLocaleString("pt-BR");
}

/** Card de métrica com comparação à média do escritório. */
function StatCard({
  label,
  value,
  officeValue,
  userNum,
  officeNum,
  accent,
}: {
  label: string;
  value: string;
  officeValue?: string;
  userNum?: number;
  officeNum?: number;
  accent?: boolean;
}) {
  const hasCompare = userNum !== undefined && officeNum !== undefined && officeNum > 0;
  const above = hasCompare && (userNum as number) >= (officeNum as number);
  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-3.5",
        accent && "border-primary/20 bg-primary/[0.03]"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {officeValue !== undefined && (
        <p className="mt-1 flex items-center gap-1 text-[11px]">
          {hasCompare &&
            (above ? (
              <TrendingUp className="h-3 w-3 text-emerald-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-amber-600" />
            ))}
          <span className={cn(hasCompare ? (above ? "text-emerald-600" : "text-amber-600") : "text-muted-foreground")}>
            {hasCompare ? (above ? "acima" : "abaixo") + " da média" : "média"}
          </span>
          <span className="text-muted-foreground">· escritório {officeValue}</span>
        </p>
      )}
    </div>
  );
}

function Metric({ icon: Icon, value }: { icon: typeof Heart; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {nf(value)}
    </span>
  );
}

export function MeuInstagramClient({ userName, posts, office }: MeuInstagramClientProps) {
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<InstagramPost | null>(null);

  const sorted = useMemo(
    () =>
      [...posts].sort(
        (a, b) =>
          new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()
      ),
    [posts]
  );

  const my = useMemo(() => {
    const count = posts.length;
    const reach = posts.reduce((s, p) => s + (p.reach ?? 0), 0);
    const actions = posts.reduce((s, p) => s + computeEngagementActionsFromPost(p), 0);
    return {
      count,
      avgReach: count > 0 ? reach / count : 0,
      avgActions: count > 0 ? actions / count : 0,
      rate: reach > 0 ? (actions / reach) * 100 : 0,
    };
  }, [posts]);

  const best = useMemo(() => {
    let top: { post: InstagramPost; rate: number } | null = null;
    for (const p of posts) {
      if (!p.reach) continue;
      const rate = (computeEngagementActionsFromPost(p) / p.reach) * 100;
      if (!top || rate > top.rate) top = { post: p, rate };
    }
    return top;
  }, [posts]);

  const firstName = userName.split(" ")[0];
  const visible = showAll ? sorted : sorted.slice(0, 9);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" data-tour="inicio-header">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Instagram className="h-3.5 w-3.5" />
            Seu desempenho no @bismarchipires
          </p>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Olá, {firstName}</h2>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Acompanhe como os seus posts performaram — comparado à média do escritório.
          </p>
        </div>
        <Link href="/conteudo/roteiros">
          <Button className="gap-2">
            <Newspaper className="h-4 w-4" />
            Criar conteúdo para post
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {posts.length === 0 ? (
        <div
          className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-muted/10 py-20 text-center"
          data-tour="inicio-stats"
        >
          <div className="rounded-full bg-muted/60 p-5">
            <Instagram className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <div className="max-w-sm space-y-1 px-4">
            <p className="font-medium text-foreground">Você ainda não tem posts vinculados</p>
            <p className="text-sm text-muted-foreground">
              Quando seus posts forem publicados e vinculados a você no Instagram, o desempenho
              aparecerá aqui. Que tal começar criando um conteúdo?
            </p>
          </div>
          <Link href="/conteudo/roteiros">
            <Button variant="outline" className="gap-2">
              <Newspaper className="h-4 w-4" />
              Ver notícias e criar post
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Resumo com comparação ao escritório */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-tour="inicio-stats">
            <StatCard
              label="Seus posts"
              value={nf(my.count)}
              officeValue={`${nf(office.posts)} no total`}
            />
            <StatCard
              label="Alcance médio"
              value={nf(my.avgReach)}
              officeValue={nf(office.avgReach)}
              userNum={my.avgReach}
              officeNum={office.avgReach}
              accent
            />
            <StatCard
              label="Interações médias"
              value={nf(my.avgActions)}
              officeValue={nf(office.avgActions)}
              userNum={my.avgActions}
              officeNum={office.avgActions}
            />
            <StatCard
              label="Engajamento médio"
              value={`${my.rate.toFixed(1)}%`}
              officeValue={`${office.rate.toFixed(1)}%`}
              userNum={my.rate}
              officeNum={office.rate}
            />
          </div>

          {/* Destaque */}
          {best && (
            <div
              className="group cursor-pointer overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md"
              onClick={() => setSelected(best.post)}
              onKeyDown={(e) => e.key === "Enter" && setSelected(best.post)}
              role="button"
              tabIndex={0}
            >
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
                <InstagramMediaThumb post={best.post} className="aspect-square w-full sm:h-32 sm:w-32" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    <TrendingUp className="h-3 w-3" />
                    Seu melhor post
                  </span>
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {best.post.caption?.split("\n")[0] || "Post sem legenda"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {best.post.published_at
                      ? format(new Date(best.post.published_at), "dd 'de' MMMM yyyy", { locale: ptBR })
                      : ""}{" "}
                    · {best.rate.toFixed(1)}% de engajamento
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                    <Metric icon={Eye} value={best.post.reach} />
                    <Metric icon={Heart} value={best.post.likes} />
                    <Metric icon={MessageCircle} value={best.post.comments} />
                    <Metric icon={Bookmark} value={best.post.saves} />
                    {best.post.permalink && (
                      <a
                        href={best.post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ver no Instagram <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lista de posts */}
          <div>
            <h2 className="mb-3 text-sm font-semibold">Seus posts</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((p) => (
                <InstagramMediaCard key={p.id} post={p} onOpen={() => setSelected(p)} withBadge />
              ))}
            </div>
            {sorted.length > 9 && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Ver menos" : `Ver todos (${sorted.length})`}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <PostDetailModal post={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function PostDetailModal({ post, onClose }: { post: InstagramPost | null; onClose: () => void }) {
  const rate =
    post && post.reach ? (computeEngagementActionsFromPost(post) / post.reach) * 100 : 0;
  const info = post ? instagramMediaInfo(post) : null;
  const imageSrc = post ? resolveInstagramThumbnailSrc(post.ig_media_id, post) : null;
  return (
    <Dialog open={!!post} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[97vw] max-w-6xl sm:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 sm:flex-row">
        {post && (
          <>
            {/* Imagem — grande, à esquerda no desktop */}
            <div className="relative h-64 w-full shrink-0 overflow-hidden bg-[#1c1c1c] sm:h-auto sm:w-[48%] sm:min-h-[460px]">
              {imageSrc ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc}
                    alt=""
                    className="relative h-full w-full object-contain"
                  />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Instagram className="h-10 w-10 text-white/30" />
                </div>
              )}
              {info && (
                <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                  <info.icon className="h-3.5 w-3.5" />
                  {info.label}
                </span>
              )}
            </div>

            {/* Conteúdo — à direita, rolável */}
            <div className="flex min-h-0 flex-1 flex-col overflow-auto p-5 space-y-4">
              <DialogTitle className="text-sm font-semibold">
                {post.published_at
                  ? format(new Date(post.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : "Post"}
                {(post.areas?.[0] || post.area) && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    · {post.areas?.[0] ?? post.area}
                  </span>
                )}
              </DialogTitle>

              {post.caption ? (
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Legenda
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.caption}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem legenda.</p>
              )}

              <div className="grid grid-cols-3 gap-2">
                <MiniStat icon={Eye} label="Alcance" value={post.reach} />
                <MiniStat icon={Heart} label="Curtidas" value={post.likes} />
                <MiniStat icon={MessageCircle} label="Comentários" value={post.comments} />
                <MiniStat icon={Bookmark} label="Salvos" value={post.saves} />
                <MiniStat icon={Share2} label="Compart." value={post.shares} />
                <MiniStat icon={TrendingUp} label="Engajamento" value={`${rate.toFixed(1)}%`} />
              </div>

              {post.permalink && (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto block pt-1"
                >
                  <Button className="w-full gap-2">
                    <Instagram className="h-4 w-4" />
                    Ver no Instagram
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Heart;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border bg-card px-2.5 py-2 text-center">
      <Icon className="mx-auto h-4 w-4 text-muted-foreground" />
      <p className="mt-1 text-sm font-bold tabular-nums">
        {typeof value === "number" ? nf(value) : value}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

