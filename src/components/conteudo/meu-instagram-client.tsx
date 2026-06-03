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
  Newspaper,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { InstagramPost } from "@/lib/instagram-posts";
import { computeEngagementActionsFromPost } from "@/lib/instagram-engagement";

interface MeuInstagramClientProps {
  userName: string;
  posts: InstagramPost[];
}

function nf(n: number) {
  return n.toLocaleString("pt-BR");
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card px-4 py-3.5",
        accent && "border-primary/20 bg-primary/[0.03]"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
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

export function MeuInstagramClient({ userName, posts }: MeuInstagramClientProps) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(
    () =>
      [...posts].sort(
        (a, b) =>
          new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()
      ),
    [posts]
  );

  const summary = useMemo(() => {
    const reach = posts.reduce((s, p) => s + (p.reach ?? 0), 0);
    const actions = posts.reduce((s, p) => s + computeEngagementActionsFromPost(p), 0);
    const rate = reach > 0 ? (actions / reach) * 100 : 0;
    return { count: posts.length, reach, actions, rate };
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Instagram className="h-3.5 w-3.5" />
            Seu desempenho no @bismarchipires
          </p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Olá, {firstName}</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Acompanhe como os seus posts performaram no Instagram do escritório.
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
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-muted/10 py-20 text-center">
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
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Posts" value={nf(summary.count)} />
            <StatCard label="Alcance total" value={nf(summary.reach)} accent />
            <StatCard label="Interações" value={nf(summary.actions)} />
            <StatCard label="Engajamento médio" value={`${summary.rate.toFixed(1)}%`} />
          </div>

          {/* Destaque */}
          {best && (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
                <PostThumb post={best.post} className="h-40 w-full sm:h-32 sm:w-32" />
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((p) => {
                const rate = p.reach ? (computeEngagementActionsFromPost(p) / p.reach) * 100 : 0;
                return (
                  <article
                    key={p.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <PostThumb post={p} className="h-44 w-full" />
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <p className="text-[11px] text-muted-foreground">
                        {p.published_at
                          ? format(new Date(p.published_at), "dd MMM yyyy", { locale: ptBR })
                          : "—"}
                        {(p.areas?.[0] || p.area) && (
                          <> · {p.areas?.[0] ?? p.area}</>
                        )}
                      </p>
                      <p className="line-clamp-2 text-sm leading-snug">
                        {p.caption?.split("\n")[0] || "Post sem legenda"}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                        <Metric icon={Eye} value={p.reach} />
                        <Metric icon={Heart} value={p.likes} />
                        <Metric icon={MessageCircle} value={p.comments} />
                        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {rate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
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
    </div>
  );
}

function PostThumb({ post, className }: { post: InstagramPost; className?: string }) {
  const src = post.thumbnail_url ?? post.media_url ?? null;
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl bg-primary", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a2f44] to-[#0a141c]">
          <Instagram className="h-7 w-7 text-white/30" />
        </div>
      )}
    </div>
  );
}
