"use client";

import { ChevronRight, ExternalLink, History, Link2, Newspaper, Pencil, Repeat, Sparkles, TrendingUp, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { AreaTag, PersonAvatar, StageBadge } from "@/components/conteudo/escolhas-visuals";
import { getRoteiroDate, type DatedItem } from "@/lib/content-utils";
import type { EscolhaPerson } from "@/lib/content-escolhas";
import type { RoteiroItem } from "@/components/conteudo/roteiro-card";
import { cn } from "@/lib/utils";

/** Nota a partir da qual a matéria ganha o selo "Potencial" na lista. */
export const HIGH_POTENTIAL = 7;

function shortDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "antes";
}

/**
 * Google Notícias põe o veículo no fim do título ("… - Migalhas"). Separa para
 * mostrar a manchete limpa e o veículo à parte; sem esse padrão, nada muda.
 */
export function splitNewsTitle(title: string): { headline: string; source: string | null } {
  const index = title.lastIndexOf(" - ");
  if (index <= 0) return { headline: title.trim(), source: null };
  const source = title.slice(index + 3).trim();
  const headline = title.slice(0, index).trim();
  if (!source || source.length > 40 || source.split(/\s+/).length > 5 || headline.length < 20) {
    return { headline: title.trim(), source: null };
  }
  return { headline, source };
}

interface RoteiroListRowProps {
  roteiro: RoteiroItem;
  /** Quem escolheu, descartou ou trouxe por link (com foto). */
  decision?: { person: EscolhaPerson; verb: string; at: string | null } | null;
  onView: (roteiro: RoteiroItem) => void;
  onReject?: (roteiro: RoteiroItem) => void;
}

export function RoteiroListRow({ roteiro, decision, onView, onReject }: RoteiroListRowProps) {
  const date = getRoteiroDate(roteiro as DatedItem);
  const relativeLabel = formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  const { headline, source } = splitNewsTitle(roteiro.title);
  const available = roteiro.status === "aguardando_aprovacao";

  return (
    <article
      className="group flex cursor-pointer items-stretch gap-3 px-3 py-3 transition-colors hover:bg-[#f4fafb] sm:gap-4 sm:px-4"
      onClick={() => onView(roteiro)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onView(roteiro);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir: ${headline}`}
    >
      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-[#1a2f44] to-[#04202f] sm:h-[76px] sm:w-28">
        {roteiro.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={roteiro.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Newspaper className="size-6 text-white/25" strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <AreaTag area={roteiro.area} />
          {source ? <span className="truncate">· {source}</span> : null}
          <span className="whitespace-nowrap">· {relativeLabel}</span>
        </div>
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-[#285f7a]">
          {headline}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {!available ? <StageBadge status={roteiro.status} /> : null}
          {decision ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
              <PersonAvatar person={decision.person} className="size-5" />
              <span className="truncate">
                <span className="capitalize">{decision.verb}</span> por{" "}
                <span className="font-medium text-slate-800">{decision.person.name}</span>
              </span>
            </span>
          ) : available && roteiro.content_snippet ? (
            <span className="line-clamp-1 text-xs text-slate-500">{roteiro.content_snippet}</span>
          ) : null}
          {roteiro.related_kind === "desdobramento" && roteiro.related_ref ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[#48466e]/10 px-2 py-0.5 text-xs font-semibold text-[#48466e]"
              title={roteiro.related_note ?? undefined}
            >
              <History className="size-3.5" aria-hidden />
              Desdobramento de post de {shortDate(roteiro.related_ref.date)}
            </span>
          ) : roteiro.related_kind === "repetido" && roteiro.related_ref ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500" title={roteiro.related_ref.title}>
              <Repeat className="size-3.5" aria-hidden />
              Já falamos disso em {shortDate(roteiro.related_ref.date)}
            </span>
          ) : null}
          {typeof roteiro.relevance_score === "number" && roteiro.relevance_score >= HIGH_POTENTIAL ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[#e8f8f8] px-2 py-0.5 text-xs font-semibold text-[#285f7a]"
              title={roteiro.relevance_reason ?? undefined}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Potencial {roteiro.relevance_score}/10
            </span>
          ) : roteiro.performance_hint ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#285f7a]">
              <TrendingUp className="size-3.5" aria-hidden />
              tema em alta
            </span>
          ) : null}
          {roteiro.has_alterations ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Pencil className="size-3" aria-hidden />
              texto ajustado
            </span>
          ) : null}
          {roteiro.source === "manual" && decision?.verb !== "trazida por link" ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Link2 className="size-3" aria-hidden />
              por link
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-1 self-center"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {roteiro.link ? (
          <a
            href={roteiro.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden size-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-[#47cdd0]/10 hover:text-slate-900 sm:inline-flex"
            title="Conferir a notícia original"
            aria-label="Conferir a notícia original"
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
        ) : null}
        {available && onReject ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("text-slate-500 hover:bg-red-50 hover:text-red-700")}
            onClick={() => onReject(roteiro)}
            title="Descartar esta matéria"
            aria-label="Descartar esta matéria"
          >
            <X className="size-4" />
          </Button>
        ) : null}
        <ChevronRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
    </article>
  );
}
