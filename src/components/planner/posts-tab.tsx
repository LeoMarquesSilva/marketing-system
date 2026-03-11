"use client";

import { useState, useMemo, useCallback } from "react";
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { updateMarketingRequest } from "@/lib/marketing-requests";
import { format, startOfDay, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScheduleHeader } from "./schedule-header";
import { ScheduleGrid } from "./schedule-grid";
import { ScheduleDisponivelCard, ScheduleDisponivelCardOverlay } from "./schedule-disponivel-card";
import {
  Search,
  ExternalLink,
  Share2,
  ImageIcon,
  CalendarCheck,
  CalendarDays,
  LayoutGrid,
  Inbox,
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

export interface PostCardClickOptions {
  isPostado: boolean;
}

interface PostsColumnProps {
  title: string;
  requests: MarketingRequest[];
  isPostado: boolean;
  onCardClick?: (request: MarketingRequest, options: PostCardClickOptions) => void;
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
            onClick={() => onCardClick?.(req, { isPostado })}
          />
        ))}
      </div>
    </div>
  );
}

interface PostsTabProps {
  requests: MarketingRequest[];
  onCardClick?: (request: MarketingRequest, options: PostCardClickOptions) => void;
  onRefresh?: () => void;
}

export function PostsTab({ requests, onCardClick, onRefresh }: PostsTabProps) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState<"colunas" | "calendario">("colunas");
  const [scheduleRangeStart, setScheduleRangeStart] = useState<Date>(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return startOfDay(start);
  });
  const [activeDragRequest, setActiveDragRequest] = useState<MarketingRequest | null>(null);
  const SCHEDULE_DAYS = 7;
  const scheduleRangeEnd = addDays(scheduleRangeStart, SCHEDULE_DAYS - 1);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleScheduleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data?.current as { type?: string; request?: MarketingRequest } | undefined;
    if (data?.type === "post-disponivel" && data?.request) {
      setActiveDragRequest(data.request);
    }
  }, []);

  const handleScheduleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragRequest(null);
      const { active, over } = event;
      if (!over) return;
      const dayKey = over.data?.current?.dayKey as string | undefined;
      const dragData = active.data?.current as { type?: string; request?: MarketingRequest } | undefined;
      if (dragData?.type !== "post-disponivel" || !dragData?.request?.id || !dayKey) return;
      const { error } = await updateMarketingRequest(dragData.request.id, {
        completion_type: "postagem_feita",
        posted_at: `${dayKey}T12:00:00.000Z`,
      });
      if (!error) onRefresh?.();
    },
    [onRefresh]
  );

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
        <DndContext
          sensors={sensors}
          onDragStart={handleScheduleDragStart}
          onDragEnd={handleScheduleDragEnd}
        >
          <div className="flex gap-4 items-start">
            <aside className="w-72 shrink-0 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden />
                <h3 className="font-semibold text-sm">Disponível no banco</h3>
                <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {disponivel.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-3 mb-4">
                Arraste para o dia da postagem no calendário.
              </p>
              <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto">
                {disponivel.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Nenhum post disponível.
                  </p>
                ) : (
                  disponivel.map((req) => (
                    <ScheduleDisponivelCard
                      key={req.id}
                      request={req}
                      onClick={() => onCardClick?.(req, { isPostado: false })}
                    />
                  ))
                )}
              </div>
            </aside>
            <div className="flex-1 min-w-0 space-y-4">
              <ScheduleHeader
                title="Agenda"
                rangeStart={scheduleRangeStart}
                rangeEnd={scheduleRangeEnd}
                onPrevRange={() => setScheduleRangeStart((d) => addDays(d, -SCHEDULE_DAYS))}
                onNextRange={() => setScheduleRangeStart((d) => addDays(d, SCHEDULE_DAYS))}
                showFilters={false}
                showPublish={true}
              />
              <ScheduleGrid
                posts={postado}
                rangeStart={scheduleRangeStart}
                rangeEnd={scheduleRangeEnd}
                onCardClick={onCardClick}
              />
            </div>
          </div>
          <DragOverlay dropAnimation={null} style={{ zIndex: 9999 }}>
            {activeDragRequest ? (
              <ScheduleDisponivelCardOverlay request={activeDragRequest} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
