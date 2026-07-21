"use client";

import { Button } from "@/components/ui/button";
import { Check, ExternalLink, FileText, Newspaper, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getAreaDotColor, STATUS_LABELS } from "@/lib/content-areas";
import { getRoteiroDate } from "@/lib/content-utils";

export interface RoteiroItem {
  id: string;
  topic_id: string;
  title: string;
  link: string | null;
  content_snippet: string | null;
  area: string;
  post: string;
  status: string;
  published_at: string | null;
  created_at: string;
  performance_hint?: string | null;
  image_url?: string | null;
  has_alterations?: boolean | null;
  edited_by_name?: string | null;
  edited_at?: string | null;
  original_post?: string | null;
  sent_to_mkt_at?: string | null;
  sent_to_mkt_by_name?: string | null;
  marketing_request_id?: string | null;
  vios_task_id?: string | null;
}

interface RoteiroCardProps {
  roteiro: RoteiroItem;
  featured?: boolean;
  compact?: boolean;
  onView: (roteiro: RoteiroItem) => void;
  onApprove?: (roteiro: RoteiroItem) => void;
  onReject?: (id: string) => void;
}

/** Linha discreta com a dica de performance (cruzamento com Instagram). */
export function PerformanceHint({
  hint,
  className,
}: {
  hint: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 rounded-lg bg-primary/[0.06] px-2.5 py-1.5 text-[11px] leading-snug text-primary/90 dark:bg-primary/10 dark:text-primary-foreground/80",
        className
      )}
    >
      <TrendingUp className="h-3.5 w-3.5 shrink-0 mt-px" />
      <span>{hint}</span>
    </p>
  );
}

function StatusPill({ status, className }: { status: string; className?: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const solid =
    status === "aprovado" || status === "enviado_mkt"
      ? "bg-emerald-500/90 text-white"
      : status === "rejeitado"
        ? "bg-red-500/90 text-white"
        : status === "em_revisao"
          ? "bg-blue-500/90 text-white"
          : status === "aprovado_revisor"
            ? "bg-violet-500/90 text-white"
            : "bg-white/90 text-slate-800 dark:bg-slate-900/85 dark:text-slate-100";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm",
        solid,
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "aguardando_aprovacao" ? "bg-amber-500" : "bg-white/90"
        )}
      />
      {label}
    </span>
  );
}

/** Kicker da área: ponto colorido + nome em caixa alta. */
function AreaKicker({ area, onDark }: { area: string; onDark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        onDark ? "text-white/90" : "text-muted-foreground"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", getAreaDotColor(area))} />
      {area}
    </span>
  );
}

/** Capa da notícia: imagem real com scrim, ou fallback editorial em navy. */
function RoteiroCover({
  roteiro,
  className,
  showStatus = true,
  children,
}: {
  roteiro: RoteiroItem;
  className?: string;
  showStatus?: boolean;
  children?: React.ReactNode;
}) {
  const hasImage = Boolean(roteiro.image_url);
  return (
    <div className={cn("relative overflow-hidden bg-primary", className)}>
      {hasImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roteiro.image_url ?? undefined}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a2f44] via-[#04202f] to-[#1c1c1c]">
          <Newspaper
            className="absolute -right-4 -bottom-4 h-32 w-32 text-white/[0.06]"
            strokeWidth={1.25}
          />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "16px 16px",
            }}
          />
        </div>
      )}
      {showStatus && (
        <div className="absolute right-3 top-3 z-10">
          <StatusPill status={roteiro.status} />
        </div>
      )}
      {children}
    </div>
  );
}

export function RoteiroCard({
  roteiro,
  featured = false,
  compact = false,
  onView,
  onApprove,
  onReject,
}: RoteiroCardProps) {
  const date = getRoteiroDate(roteiro);
  const dateLabel = format(date, "dd MMM yyyy", { locale: ptBR });
  const relativeLabel = formatDistanceToNow(date, { addSuffix: true, locale: ptBR });

  if (featured) {
    return (
      <article
        className="group relative cursor-pointer overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-300 hover:shadow-xl"
        onClick={() => onView(roteiro)}
        onKeyDown={(e) => e.key === "Enter" && onView(roteiro)}
        role="button"
        tabIndex={0}
      >
        <RoteiroCover roteiro={roteiro} className="h-60 sm:h-72 md:h-80">
          <div className="absolute inset-x-0 bottom-0 z-10 p-6 md:p-8">
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
                Destaque
              </span>
              <AreaKicker area={roteiro.area} onDark />
            </div>
            <h2 className="max-w-3xl text-2xl font-bold leading-tight text-white drop-shadow-sm md:text-3xl line-clamp-3">
              {roteiro.title}
            </h2>
            <div className="mt-4 flex items-center gap-2 text-xs text-white/80">
              <span className="font-medium">{dateLabel}</span>
              <span className="opacity-50">•</span>
              <span>{relativeLabel}</span>
            </div>
          </div>
        </RoteiroCover>
        <div className="flex flex-wrap items-center gap-2 p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" className="gap-2" onClick={() => onView(roteiro)}>
            <FileText className="h-4 w-4" />
            Ver post completo
          </Button>
          {roteiro.link && (
            <a href={roteiro.link} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Conferir notícia
              </Button>
            </a>
          )}
          {roteiro.performance_hint && (
            <PerformanceHint hint={roteiro.performance_hint} className="ml-auto hidden max-w-sm lg:flex" />
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "group flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30",
        compact && "min-w-[280px] max-w-[320px] shrink-0 snap-start"
      )}
      onClick={() => onView(roteiro)}
      onKeyDown={(e) => e.key === "Enter" && onView(roteiro)}
      role="button"
      tabIndex={0}
    >
      <RoteiroCover roteiro={roteiro} className={compact ? "h-32" : "h-40"}>
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <AreaKicker area={roteiro.area} onDark />
        </div>
      </RoteiroCover>

      <div className={cn("flex flex-1 flex-col gap-2.5", compact ? "p-3.5" : "p-4")}>
        <h3 className="font-semibold leading-snug line-clamp-2 transition-colors group-hover:text-primary text-[15px]">
          {roteiro.title}
        </h3>
        {!compact && roteiro.content_snippet && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {roteiro.content_snippet}
          </p>
        )}
        {!compact && roteiro.performance_hint && (
          <PerformanceHint hint={roteiro.performance_hint} />
        )}
        <div className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">{dateLabel}</span>
          <span className="opacity-40">•</span>
          <span className="truncate">{relativeLabel}</span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 border-t bg-muted/30 p-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        {roteiro.link && (
          <a
            href={roteiro.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Conferir notícia original"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Notícia
          </a>
        )}
        <Button variant="secondary" size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={() => onView(roteiro)}>
          <FileText className="h-3.5 w-3.5" />
          Ver post
        </Button>
        {roteiro.status === "aguardando_aprovacao" && onApprove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            onClick={() => onApprove(roteiro)}
            title="Aprovar"
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        {roteiro.status === "aguardando_aprovacao" && onReject && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            onClick={() => onReject(roteiro.id)}
            title="Rejeitar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </article>
  );
}

export { RoteiroCover };
