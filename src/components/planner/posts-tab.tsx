"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Input } from "@/components/ui/input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import type { MarketingRequest } from "@/lib/marketing-requests";
import type { PlannerReel } from "@/lib/reel-deliveries/types";
import { format, startOfDay, addDays, startOfWeek, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScheduleHeader } from "./schedule-header";
import { CALENDAR_DRAG_TYPE, ScheduleGrid } from "./schedule-grid";
import { ScheduleDisponivelCard, ScheduleItemOverlay, type DisponivelAgeTier } from "./schedule-disponivel-card";
import { AreaRotationPanel } from "./area-rotation-panel";
import { ContentTypeTag, PeopleAvatars, RotationHintTag, type RotationHint } from "./calendar-item-parts";
import {
  Search,
  ExternalLink,
  Share2,
  ImageIcon,
  CalendarCheck,
  CalendarDays,
  LayoutGrid,
  Inbox,
  Download,
  Video,
  X,
} from "lucide-react";
import { AreaIcon } from "@/lib/area-icons";
import { cn } from "@/lib/utils";
import { isContentBankRequestType } from "@/lib/planner-posts";
import {
  buildAreaRotation,
  calendarItemArea,
  calendarItemBankSince,
  calendarItemDayKey,
  calendarItemFilterDate,
  calendarItemFromReel,
  calendarItemFromRequest,
  calendarItemMatchesSearch,
  calendarItemPeople,
  calendarItemPostedAt,
  calendarItemTitle,
  findAreaRepeats,
  isCalendarItemInBank,
  isCalendarItemPosted,
  isReelItem,
  rotationAreaOf,
  sortBankByRotation,
  withCalendarDay,
  type AreaRotation,
  type CalendarItem,
} from "@/lib/planner-calendar";
import { publishCalendarItemOn } from "@/lib/planner-calendar-client";
import { ImportInstagramPostsDialog } from "./import-instagram-posts-dialog";
import { Button } from "@/components/ui/button";

type ContentFilter = "all" | "posts" | "reels";

/** Reels que ainda não chegaram ao banco: só contam no rodízio. */
const REEL_IN_PRODUCTION = new Set(["awaiting_approval", "changes_requested", "approved"]);

/** Idade para cor do card: novo (até 14 dias), médio (15–45 dias, amarelo), antigo (>45 dias). */
function getDisponivelAgeTier(item: CalendarItem): DisponivelAgeTier {
  const days = differenceInDays(new Date(), new Date(calendarItemBankSince(item)));
  if (days <= 14) return "new";
  if (days <= 45) return "medium";
  return "old";
}

function bankHint(item: CalendarItem, rotation: AreaRotation, rotationAreas: readonly string[]): RotationHint | null {
  const area = rotationAreaOf(calendarItemArea(item), rotationAreas);
  if (!area) return null;
  if (area === rotation.recommendedArea) return "recommended";
  if (area === rotation.lastPostedArea) return "last-area";
  return null;
}

function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

const POSTADO_TAG_CLASS =
  "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";

interface PostCardProps {
  item: CalendarItem;
  isPostado: boolean;
  hint?: RotationHint | null;
  onClick?: () => void;
}

function PostCard({ item, isPostado, hint, onClick }: PostCardProps) {
  const reel = isReelItem(item);
  const displayTitle = calendarItemTitle(item);
  const area = calendarItemArea(item);
  const request = item.kind === "request" ? item.request : null;
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
          ? `${reel ? "Reel" : "Post"} já postado: ${displayTitle}`
          : `${reel ? "Reel" : "Post"} disponível no banco: ${displayTitle}`
      }
      className="group flex flex-col gap-3 rounded-lg p-4 cursor-pointer
        bg-gradient-to-br from-white/90 via-white/70 to-white/50
        dark:from-white/10 dark:via-white/5 dark:to-white/[0.02]
        backdrop-blur-xl border border-white/60 dark:border-white/10
        shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)]
        hover:shadow-[0_8px_28px_-6px_rgba(16,31,46,0.14),0_0_0_1px_rgba(16,31,46,0.06)]
        hover:-translate-y-0.5 hover:border-white/80
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#04202f]/30 focus-visible:ring-offset-2
        transition-all duration-200 ease-out"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ContentTypeTag reel={reel} />
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
        {hint && <RotationHintTag hint={hint} />}
        <ExternalLink
          className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0 ml-auto"
          aria-hidden
        />
      </div>

      <div className="space-y-1 min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground line-clamp-2 leading-snug">
          {displayTitle}
        </h3>
        {request && !reel && request.description && request.title && request.title !== request.description && (
          <p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
            {request.title}
          </p>
        )}
        {item.kind === "reel" && item.reel.coverSubtitle && (
          <p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
            {item.reel.coverSubtitle}
          </p>
        )}
      </div>

      {request?.art_link && (
        <a
          href={request.art_link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          {reel ? (
            <>
              <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Ver vídeo
            </>
          ) : (
            <>
              <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Ver arte
            </>
          )}
        </a>
      )}

      <div className="space-y-1.5 pt-2 border-t border-black/5 dark:border-white/8 mt-auto">
        <PeopleAvatars people={calendarItemPeople(item)} size="xs" />
        <div className="flex items-center gap-2" title="Área">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#04202f]/8 dark:bg-white/10">
            <AreaIcon area={area} className="h-3 w-3 text-[#04202f]/60 dark:text-white/50" aria-hidden />
          </span>
          <span className="truncate text-[11px] text-muted-foreground">{area}</span>
        </div>
        {item.kind === "request" ? (
          <div className="flex flex-col gap-0.5" title="Solicitado e concluído">
            <span className="text-[11px] text-muted-foreground/90">
              Solicitado em {formatDay(item.request.requested_at)}
            </span>
            <span className="text-[11px] font-medium text-foreground/80 flex items-center gap-1">
              <CalendarCheck className="h-3 w-3 text-emerald-600/70 shrink-0" aria-hidden />
              Concluído em {formatDay(calendarItemBankSince(item))}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5" title="Cronograma e publicação">
            {item.reel.dueDate && (
              <span className="text-[11px] text-muted-foreground/90">Cronograma: {formatDay(item.reel.dueDate)}</span>
            )}
            <span className="text-[11px] font-medium text-foreground/80 flex items-center gap-1">
              <CalendarCheck className="h-3 w-3 text-emerald-600/70 shrink-0" aria-hidden />
              {isPostado
                ? `Publicado em ${formatDay(item.reel.publishedAt)}`
                : `Pronto em ${formatDay(item.reel.readyAt)}`}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

interface PostsColumnProps {
  title: string;
  items: CalendarItem[];
  isPostado: boolean;
  hintFor?: (item: CalendarItem) => RotationHint | null;
  onItemClick?: (item: CalendarItem) => void;
}

function PostsColumn({ title, items, isPostado, hintFor, onItemClick }: PostsColumnProps) {
  return (
    <div className="flex shrink-0 w-72 flex-col rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 p-3 border-b">
        <Share2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3 min-h-[120px] overflow-y-auto">
        {items.map((item) => (
          <PostCard
            key={item.id}
            item={item}
            isPostado={isPostado}
            hint={hintFor?.(item)}
            onClick={() => onItemClick?.(item)}
          />
        ))}
      </div>
    </div>
  );
}

/** Movimento já mostrado no calendário enquanto o servidor confirma. */
interface PendingMove {
  fromDay: string | null;
  toDay: string;
}

interface PostsTabProps {
  requests: MarketingRequest[];
  reels: PlannerReel[];
  /** Áreas do cronograma editorial, que entram no rodízio. */
  rotationAreas: string[];
  onItemClick?: (item: CalendarItem) => void;
  onRefresh?: () => void;
}

export function PostsTab({ requests, reels, rotationAreas, onItemClick, onRefresh }: PostsTabProps) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState<"colunas" | "calendario">("colunas");
  const [scheduleRangeStart, setScheduleRangeStart] = useState<Date>(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return startOfDay(start);
  });
  const [activeDragItem, setActiveDragItem] = useState<CalendarItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [pendingMoves, setPendingMoves] = useState<Record<string, PendingMove>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const SCHEDULE_DAYS = 7;
  const scheduleRangeEnd = addDays(scheduleRangeStart, SCHEDULE_DAYS - 1);

  const serverItems = useMemo(
    () => [
      ...requests
        .filter((r) => isContentBankRequestType(r.request_type) && r.workflow_stage === "concluido")
        .map(calendarItemFromRequest),
      ...reels
        .filter((r) => r.status === "ready" || r.status === "published")
        .map(calendarItemFromReel),
    ],
    [requests, reels]
  );

  // Quando o servidor devolve o item em outro dia, o movimento otimista já cumpriu o papel.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Poda movimentos já refletidos pelo servidor.
    setPendingMoves((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      const next = { ...prev };
      for (const id of ids) {
        const item = serverItems.find((candidate) => candidate.id === id);
        if (!item || calendarItemDayKey(item) !== prev[id].fromDay) delete next[id];
      }
      return Object.keys(next).length === ids.length ? prev : next;
    });
  }, [serverItems]);

  const contentItems = useMemo(
    () =>
      serverItems.map((item) => {
        const move = pendingMoves[item.id];
        return move && calendarItemDayKey(item) === move.fromDay ? withCalendarDay(item, move.toDay) : item;
      }),
    [serverItems, pendingMoves]
  );

  const filtered = useMemo(() => {
    return contentItems.filter((item) => {
      const reel = isReelItem(item);
      const matchType =
        contentFilter === "all" ||
        (contentFilter === "posts" && !reel) ||
        (contentFilter === "reels" && reel);
      const itemDate = new Date(calendarItemFilterDate(item));
      const matchFrom = !dateFrom || itemDate >= new Date(dateFrom);
      const matchTo = !dateTo || itemDate <= new Date(dateTo + "T23:59:59");
      return matchType && matchFrom && matchTo && calendarItemMatchesSearch(item, search);
    });
  }, [contentItems, dateFrom, dateTo, search, contentFilter]);

  // O rodízio olha o calendário inteiro, não só o que os filtros mostram.
  const allPosted = useMemo(() => contentItems.filter(isCalendarItemPosted), [contentItems]);
  const rotation = useMemo(
    () =>
      buildAreaRotation({
        rotationAreas,
        posted: allPosted,
        bank: contentItems.filter(isCalendarItemInBank),
        inProductionAreas: reels.filter((r) => REEL_IN_PRODUCTION.has(r.status)).map((r) => r.area),
        today: format(new Date(), "yyyy-MM-dd"),
      }),
    [rotationAreas, allPosted, contentItems, reels]
  );
  const repeatedIds = useMemo(() => findAreaRepeats(allPosted, rotationAreas), [allPosted, rotationAreas]);
  const hintFor = useCallback(
    (item: CalendarItem) => bankHint(item, rotation, rotationAreas),
    [rotation, rotationAreas]
  );

  const disponivel = useMemo(() => {
    const byRecency = filtered
      .filter(isCalendarItemInBank)
      .sort((a, b) => new Date(calendarItemBankSince(b)).getTime() - new Date(calendarItemBankSince(a)).getTime());
    return sortBankByRotation(byRecency, rotation, rotationAreas);
  }, [filtered, rotation, rotationAreas]);

  const postado = useMemo(
    () =>
      filtered
        .filter(isCalendarItemPosted)
        .sort((a, b) => new Date(calendarItemPostedAt(b)!).getTime() - new Date(calendarItemPostedAt(a)!).getTime()),
    [filtered]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleScheduleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data?.current as { type?: string; item?: CalendarItem } | undefined;
    if (data?.type === CALENDAR_DRAG_TYPE && data.item) setActiveDragItem(data.item);
  }, []);

  const handleScheduleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragItem(null);
      const dayKey = event.over?.data?.current?.dayKey as string | undefined;
      const data = event.active.data?.current as { type?: string; item?: CalendarItem } | undefined;
      if (data?.type !== CALENDAR_DRAG_TYPE || !data.item || !dayKey) return;
      const item = data.item;
      if (calendarItemDayKey(item) === dayKey) return;

      const original = serverItems.find((candidate) => candidate.id === item.id) ?? item;
      setActionError(null);
      setPendingMoves((prev) => ({ ...prev, [item.id]: { fromDay: calendarItemDayKey(original), toDay: dayKey } }));
      const error = await publishCalendarItemOn(item, dayKey);
      if (error) {
        setPendingMoves((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        setActionError(error);
        return;
      }
      onRefresh?.();
    },
    [onRefresh, serverItems]
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
            placeholder="Buscar título, legenda ou pessoa..."
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
          {(
            [
              { id: "all" as ContentFilter, label: "Todos" },
              { id: "posts" as ContentFilter, label: "Posts" },
              { id: "reels" as ContentFilter, label: "Reels" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setContentFilter(id)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                contentFilter === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={contentFilter === id}
            >
              {label}
            </button>
          ))}
        </div>
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-1.5 h-9"
        >
          <Download className="h-4 w-4" aria-hidden />
          Importar do Instagram
        </Button>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-full px-3 py-1.5">
          <Share2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {actionError && (
        <div role="alert" className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label="Fechar aviso" className="rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <AreaRotationPanel rotation={rotation} />

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Share2 className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {contentItems.length === 0
              ? "Nenhum post ou reel concluído ainda."
              : "Nenhum item encontrado para os filtros selecionados."}
          </p>
        </div>
      )}

      {filtered.length > 0 && viewMode === "colunas" && (
        <div className="flex flex-wrap gap-4">
          <PostsColumn
            title="Disponível no banco"
            items={disponivel}
            isPostado={false}
            hintFor={hintFor}
            onItemClick={onItemClick}
          />
          <PostsColumn
            title="Postado"
            items={postado}
            isPostado={true}
            onItemClick={onItemClick}
          />
        </div>
      )}

      {filtered.length > 0 && viewMode === "calendario" && (
        <DndContext
          sensors={sensors}
          onDragStart={handleScheduleDragStart}
          onDragEnd={handleScheduleDragEnd}
          onDragCancel={() => setActiveDragItem(null)}
        >
          <div className="flex flex-col gap-4 w-full">
            <div className="w-full space-y-4">
              <ScheduleHeader
                title="Agenda"
                rangeStart={scheduleRangeStart}
                rangeEnd={scheduleRangeEnd}
                onPrevRange={() => setScheduleRangeStart((d) => addDays(d, -SCHEDULE_DAYS))}
                onNextRange={() => setScheduleRangeStart((d) => addDays(d, SCHEDULE_DAYS))}
                showFilters={false}
                showPublish={false}
              />
              <ScheduleGrid
                items={postado}
                rangeStart={scheduleRangeStart}
                rangeEnd={scheduleRangeEnd}
                repeatedIds={repeatedIds}
                onItemClick={onItemClick}
              />
            </div>

            {/* Disponível no banco — faixa horizontal abaixo da agenda, na ordem do rodízio */}
            <aside className="w-full rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border">
                <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden />
                <h3 className="font-semibold text-sm">Disponível no banco</h3>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {disponivel.length}
                </span>
                <p className="text-xs text-muted-foreground ml-2">
                  Na ordem do rodízio. Arraste para o dia da postagem no calendário acima.
                </p>
              </div>
              <div className="flex gap-3 mt-3 overflow-x-auto pb-2 min-h-[100px]">
                {disponivel.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center w-full">
                    Nada pronto no banco.
                  </p>
                ) : (
                  disponivel.map((item) => (
                    <div key={item.id} className="flex shrink-0 w-[300px]">
                      <ScheduleDisponivelCard
                        item={item}
                        ageTier={getDisponivelAgeTier(item)}
                        hint={hintFor(item)}
                        onClick={() => onItemClick?.(item)}
                      />
                    </div>
                  ))
                )}
              </div>
            </aside>
          </div>
          <DragOverlay dropAnimation={null} style={{ zIndex: 9999 }}>
            {activeDragItem ? <ScheduleItemOverlay item={activeDragItem} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <ImportInstagramPostsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={onRefresh}
      />
    </div>
  );
}
