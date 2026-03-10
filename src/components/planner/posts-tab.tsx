"use client";

import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Calendar } from "@/components/ui/calendar";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  ExternalLink,
  Share2,
  ImageIcon,
  CalendarCheck,
  CalendarDays,
  LayoutGrid,
} from "lucide-react";
import { getAreaIcon } from "@/lib/area-icons";
import { cn } from "@/lib/utils";

const POST_TYPE = "Post Redes Sociais";

const POSTADO_TAG_CLASS =
  "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface PostCardProps {
  req: MarketingRequest;
  isPostado: boolean;
  onClick?: () => void;
}

function PostCard({ req, isPostado, onClick }: PostCardProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick?.();
      }}
      aria-label={
        isPostado
          ? `Post já postado: ${req.description || req.title}`
          : `Post disponível no banco: ${req.description || req.title}`
      }
      className="group flex flex-col gap-3 rounded-2xl p-4 cursor-pointer
        bg-gradient-to-br from-white/90 via-white/70 to-white/50
        dark:from-white/10 dark:via-white/5 dark:to-white/[0.02]
        backdrop-blur-xl border border-white/60 dark:border-white/10
        shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)]
        hover:shadow-[0_8px_28px_-6px_rgba(16,31,46,0.14),0_0_0_1px_rgba(16,31,46,0.06)]
        hover:-translate-y-0.5 hover:border-white/80
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101f2e]/30 focus-visible:ring-offset-2
        transition-all duration-200 ease-out"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {isPostado && (
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${POSTADO_TAG_CLASS}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500"
              aria-hidden
            />
            Postado
          </span>
        )}
        <ExternalLink
          className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0 ml-auto"
          aria-hidden
        />
      </div>

      <div className="space-y-1 min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground line-clamp-2 leading-snug">
          {req.description || req.title}
        </h3>
        {req.description && req.title && req.title !== req.description && (
          <p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
            {req.title}
          </p>
        )}
      </div>

      {req.art_link && (
        <a
          href={req.art_link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Ver arte
        </a>
      )}

      <div className="space-y-1.5 pt-2 border-t border-black/5 dark:border-white/8 mt-auto">
        {(req.nome_advogado || req.solicitante_user?.name || req.solicitante) && (
          <div className="flex items-center gap-1.5 min-w-0" title="Advogado">
              {req.solicitante_user ? (
                <Avatar className="h-4 w-4 shrink-0 border border-white/50">
                  <AvatarImage src={req.solicitante_user.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px] bg-[#101f2e]/10 text-[#101f2e] dark:bg-white/10 dark:text-white">
                    {getInitials(req.solicitante_user.name)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="h-4 w-4 shrink-0 border border-white/50">
                  <AvatarFallback className="text-[8px] bg-[#101f2e]/10 text-[#101f2e] dark:bg-white/10 dark:text-white">
                    {getInitials(req.nome_advogado || req.solicitante || "")}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className="text-xs font-medium text-foreground/80 truncate">
                {req.nome_advogado || req.solicitante_user?.name || req.solicitante}
              </span>
          </div>
        )}
        <div className="flex items-center gap-2" title="Área">
          {(() => {
            const AreaIcon = getAreaIcon(req.requesting_area);
            return (
              <>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#101f2e]/8 dark:bg-white/10">
                  <AreaIcon className="h-3 w-3 text-[#101f2e]/60 dark:text-white/50" aria-hidden />
                </span>
                <span className="text-[11px] text-muted-foreground truncate">
                  {req.requesting_area}
                </span>
              </>
            );
          })()}
        </div>
        <div className="flex items-center gap-2" title="Data para planejamento">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            <CalendarCheck className="h-3 w-3 text-emerald-600/70" aria-hidden />
          </span>
          <span className="text-[11px] font-medium text-foreground/80">
            {req.delivered_at
              ? format(new Date(req.delivered_at), "dd/MM/yyyy", { locale: ptBR })
              : format(new Date(req.requested_at), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </div>
      </div>
    </article>
  );
}

interface PostsColumnProps {
  title: string;
  requests: MarketingRequest[];
  isPostado: boolean;
  onCardClick?: (request: MarketingRequest) => void;
}

function PostsColumn({
  title,
  requests,
  isPostado,
  onCardClick,
}: PostsColumnProps) {
  return (
    <div className="flex shrink-0 w-72 flex-col rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 p-3 border-b">
        <Share2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {requests.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3 min-h-[120px] overflow-y-auto">
        {requests.map((req) => (
          <PostCard
            key={req.id}
            req={req}
            isPostado={isPostado}
            onClick={() => onCardClick?.(req)}
          />
        ))}
      </div>
    </div>
  );
}

interface PostsTabProps {
  requests: MarketingRequest[];
  onCardClick?: (request: MarketingRequest) => void;
}

export function PostsTab({ requests, onCardClick }: PostsTabProps) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState<"colunas" | "calendario">("colunas");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(undefined);

  const posts = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.request_type === POST_TYPE && r.workflow_stage === "concluido"
      ),
    [requests]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return posts.filter((r) => {
      const reqDate = new Date(r.delivered_at || r.requested_at);
      const matchFrom = !dateFrom || reqDate >= new Date(dateFrom);
      const matchTo = !dateTo || reqDate <= new Date(dateTo + "T23:59:59");
      const matchSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q);
      return matchFrom && matchTo && matchSearch;
    });
  }, [posts, dateFrom, dateTo, search]);

  const disponivel = useMemo(
    () =>
      filtered
        .filter((r) => r.completion_type !== "postagem_feita")
        .sort((a, b) => {
          const da = a.delivered_at ?? a.requested_at;
          const db = b.delivered_at ?? b.requested_at;
          return new Date(db).getTime() - new Date(da).getTime();
        }),
    [filtered]
  );

  const postado = useMemo(
    () =>
      filtered
        .filter((r) => r.completion_type === "postagem_feita")
        .sort((a, b) => {
          const da = a.delivered_at ?? a.requested_at;
          const db = b.delivered_at ?? b.requested_at;
          return new Date(db).getTime() - new Date(da).getTime();
        }),
    [filtered]
  );

  const postsByDate = useMemo(() => {
    const map = new Map<string, MarketingRequest[]>();
    for (const req of filtered) {
      const d = new Date(req.delivered_at || req.requested_at);
      const key = format(startOfDay(d), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(req);
    }
    return map;
  }, [filtered]);

  const postsForSelectedDate = useMemo(() => {
    if (!selectedCalendarDate) return [];
    const key = format(startOfDay(selectedCalendarDate), "yyyy-MM-dd");
    return postsByDate.get(key) ?? [];
  }, [selectedCalendarDate, postsByDate]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50"
            aria-hidden
          />
          <Input
            placeholder="Buscar título ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm"
          />
        </div>
        <DatePickerField
          value={dateFrom}
          onChange={setDateFrom}
          placeholder="De"
          className="w-[130px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm"
        />
        <DatePickerField
          value={dateTo}
          onChange={setDateTo}
          placeholder="Até"
          className="w-[130px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm"
        />
        <div className="flex gap-1 border rounded-lg p-0.5 bg-muted/30 border-border">
          <button
            type="button"
            onClick={() => setViewMode("colunas")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              viewMode === "colunas"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={viewMode === "colunas"}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Colunas
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendario")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              viewMode === "calendario"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={viewMode === "calendario"}
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            Calendário
          </button>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-full px-3 py-1.5">
          <Share2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
          {filtered.length} post{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Share2 className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {posts.length === 0
              ? "Nenhum Post Redes Sociais concluído ainda."
              : "Nenhum post encontrado para os filtros selecionados."}
          </p>
        </div>
      )}

      {filtered.length > 0 && viewMode === "colunas" && (
        <div className="flex flex-wrap gap-4">
          <PostsColumn
            title="Disponível no banco"
            requests={disponivel}
            isPostado={false}
            onCardClick={onCardClick}
          />
          <PostsColumn
            title="Postado"
            requests={postado}
            isPostado={true}
            onCardClick={onCardClick}
          />
        </div>
      )}

      {filtered.length > 0 && viewMode === "calendario" && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <Calendar
              mode="single"
              selected={selectedCalendarDate}
              onSelect={setSelectedCalendarDate}
              locale={ptBR}
              captionLayout="dropdown"
              fromYear={new Date().getFullYear() - 1}
              toYear={new Date().getFullYear() + 1}
            />
          </div>
          {selectedCalendarDate ? (
            <section aria-labelledby="posts-do-dia">
              <h2
                id="posts-do-dia"
                className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"
              >
                <CalendarCheck className="h-4 w-4 text-emerald-600/70" aria-hidden />
                Posts em {format(selectedCalendarDate, "dd/MM/yyyy", { locale: ptBR })}
                <span className="text-muted-foreground font-normal">
                  ({postsForSelectedDate.length} post{postsForSelectedDate.length !== 1 ? "s" : ""})
                </span>
              </h2>
              {postsForSelectedDate.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Nenhum post nesta data.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {postsForSelectedDate.map((req) => (
                    <PostCard
                      key={req.id}
                      req={req}
                      isPostado={req.completion_type === "postagem_feita"}
                      onClick={() => onCardClick?.(req)}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <p className="text-sm text-muted-foreground py-4 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" aria-hidden />
              Selecione um dia no calendário para ver os posts.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
