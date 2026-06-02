"use client";

import { Button } from "@/components/ui/button";
import { Check, ChevronRight, ExternalLink, Newspaper, Pencil, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getAreaDotColor, STATUS_LABELS } from "@/lib/content-areas";
import { getRoteiroDate, type DatedItem } from "@/lib/content-utils";
import type { RoteiroItem } from "@/components/conteudo/roteiro-card";

interface RoteiroListRowProps {
  roteiro: RoteiroItem;
  onView: (roteiro: RoteiroItem) => void;
  onApprove?: (roteiro: RoteiroItem) => void;
  onReject?: (id: string) => void;
}

function statusPillClass(status: string) {
  if (status === "aprovado" || status === "enviado_mkt")
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400";
  if (status === "rejeitado")
    return "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400";
  if (status === "em_revisao")
    return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400";
  if (status === "aprovado_revisor")
    return "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400";
  return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400";
}

export function RoteiroListRow({ roteiro, onView, onApprove, onReject }: RoteiroListRowProps) {
  const date = getRoteiroDate(roteiro as DatedItem);
  const dateLabel = format(date, "dd MMM yyyy", { locale: ptBR });
  const relativeLabel = formatDistanceToNow(date, { addSuffix: true, locale: ptBR });

  return (
    <article
      className={cn(
        "group flex cursor-pointer items-stretch gap-3 overflow-hidden rounded-2xl border bg-card p-2.5 transition-all sm:gap-4",
        "hover:border-primary/30 hover:shadow-md"
      )}
      onClick={() => onView(roteiro)}
      onKeyDown={(e) => e.key === "Enter" && onView(roteiro)}
      role="button"
      tabIndex={0}
    >
      {/* Thumbnail */}
      <div className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-xl bg-primary sm:h-20 sm:w-28">
        {roteiro.image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={roteiro.image_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a2f44] to-[#0a141c]">
            <Newspaper className="h-6 w-6 text-white/25" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-0.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", getAreaDotColor(roteiro.area))} />
            {roteiro.area}
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
              statusPillClass(roteiro.status)
            )}
          >
            {STATUS_LABELS[roteiro.status] ?? roteiro.status}
          </span>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-primary sm:text-[15px]">
          {roteiro.title}
        </h3>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/70">{dateLabel}</span>
          <span className="opacity-40">•</span>
          <span>{relativeLabel}</span>
          {roteiro.performance_hint && (
            <span className="ml-1 hidden items-center gap-1 text-primary/70 md:inline-flex">
              <TrendingUp className="h-3 w-3" />
              em alta
            </span>
          )}
          {roteiro.has_alterations && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
              <Pencil className="h-2.5 w-2.5" />
              editado
            </span>
          )}
        </div>
      </div>

      {/* Ações */}
      <div
        className="flex shrink-0 items-center gap-1 self-center pr-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {roteiro.link && (
          <a
            href={roteiro.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            title="Conferir notícia original"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {roteiro.status === "aguardando_aprovacao" && onApprove && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/40"
            onClick={() => onApprove(roteiro)}
          >
            <Check className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Aprovar</span>
          </Button>
        )}
        {roteiro.status === "aguardando_aprovacao" && onReject && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            onClick={() => onReject(roteiro.id)}
            title="Rejeitar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
      </div>
    </article>
  );
}
