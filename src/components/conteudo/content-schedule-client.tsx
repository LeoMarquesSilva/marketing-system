"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  ExternalLink,
  FileText,
  Film,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ContentScheduleResponse } from "@/lib/content-schedule/types";
import { normalizeScheduleArea } from "@/lib/content-schedule/domain";
import { AreaIcon } from "@/lib/area-icons";
import { ContentScheduleCalendar } from "./content-schedule-calendar";
import { ContentScheduleAssigneeReview } from "./content-schedule-assignee-review";
import {
  ContentScheduleSlotDetails,
  type ScheduleAssignmentFeedback,
} from "./content-schedule-slot-details";
import { AreaMark, CollaboratorAvatar, CollaboratorMark } from "./content-schedule-visuals";
import type {
  ScheduleCollaborator,
  ScheduleFormat,
  ScheduleSlotView,
  ScheduleStatus,
} from "./content-schedule-ui-types";

export { AreaMark, CollaboratorAvatar } from "./content-schedule-visuals";

type Format = ScheduleFormat;
type Collaborator = ScheduleCollaborator;
type ScheduleSlot = ScheduleSlotView;
type PendingLink = {
  id: string;
  slotId?: string | null;
  label?: string | null;
  reason?: string | null;
  collaboratorName?: string | null;
  date?: string | null;
  format?: Format | null;
  area?: string | null;
  collaboratorId?: string | null;
};
type SchedulePayload = {
  slots: ScheduleSlot[];
  collaborators: Collaborator[];
  areas: string[];
  access: { canManage: boolean; assignableAreas: string[] | null; userId: string };
  pendingLinks?: PendingLink[];
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const STATUS_LABELS: Record<ScheduleStatus, string> = {
  open: "Sem responsável",
  assigned: "Atribuído",
  linked: "Com conteúdo",
  published: "Publicado",
  cancelled: "Cancelado",
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, amount: number) {
  const [year, index] = month.split("-").map(Number);
  const next = new Date(year, index - 1 + amount, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  return `${MONTHS[index - 1]} de ${year}`;
}

function shortDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", weekday: "short" }).format(date).replaceAll(".", "");
}

function number(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value ?? 0);
}

function deriveStatus(slot: ScheduleSlot): ScheduleStatus {
  if (slot.status === "cancelled") return "cancelled";
  if (slot.publication) return "published";
  if (slot.content) return "linked";
  if (slot.collaboratorId || slot.collaborator) return "assigned";
  return "open";
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  return body?.error || body?.message || "Não foi possível concluir a operação.";
}

export function mapContentScheduleResponse(payload: ContentScheduleResponse): SchedulePayload {
  return {
    areas: payload.areas,
    collaborators: payload.collaborators.map((item) => ({
      id: item.id,
      name: item.name,
      area: normalizeScheduleArea(item.department),
      avatarUrl: item.avatar_url,
    })),
    access: payload.access,
    slots: payload.slots.map((slot) => ({
      id: slot.id,
      area: slot.area,
      date: slot.due_date,
      format: slot.format,
      status: slot.cancelled ? "cancelled" : slot.publication ? "published" : (slot.content_roteiro_id || slot.reel_studio_id) ? "linked" : slot.collaborator_id ? "assigned" : "open",
      collaboratorId: slot.collaborator_id,
      collaborator: slot.collaborator_id ? {
        id: slot.collaborator_id,
        name: slot.collaborator_name ?? "Colaborador",
        avatarUrl: slot.collaborator_avatar_url,
      } : null,
      content: slot.reel_studio_id
        ? { id: slot.reel_studio_id, title: slot.reel_title ?? "Roteiro de Reel vinculado", url: "/conteudo/reels" }
        : slot.content_roteiro_id
          ? { id: slot.content_roteiro_id, title: slot.content_title ?? "Conteúdo vinculado" }
          : null,
      publication: slot.publication ? {
        id: slot.publication.id,
        permalink: slot.publication.permalink,
        publishedAt: slot.publication.published_at,
        likes: slot.publication.likes,
        comments: slot.publication.comments,
        reach: slot.publication.reach,
      } : null,
      imported: Boolean(slot.source_name || slot.source_status),
      sourceName: slot.source_name,
      sourceStatus: slot.source_status,
      unmatchedAssigneeName: !slot.collaborator_id ? slot.source_name : null,
      viosTask: slot.vios_task,
    })),
    pendingLinks: payload.pendingLinks.map((item) => ({
      id: item.id,
      label: item.source_title,
      reason: item.reason,
      collaboratorName: item.collaborator_name,
      collaboratorId: item.collaborator_id,
      date: item.event_date,
      format: item.format,
      area: item.area,
    })),
  };
}

export function reconcileSelectedScheduleSlot(
  selectedSlot: ScheduleSlot | null,
  slots: ScheduleSlot[]
): ScheduleSlot | null {
  if (!selectedSlot) return null;
  return slots.find((slot) => slot.id === selectedSlot.id) ?? null;
}

type ScheduleFocusTarget = {
  isConnected: boolean;
  focus: () => void;
};

export function restoreScheduleDetailsFocus(
  returnTarget: ScheduleFocusTarget | null,
  fallbackTarget: ScheduleFocusTarget | null
): boolean {
  const target = returnTarget?.isConnected ? returnTarget : fallbackTarget?.isConnected ? fallbackTarget : null;
  if (!target) return false;
  target.focus();
  return true;
}

export type ScheduleAssignmentOperation = {
  generation: number;
  slotId: string;
  month: string;
};

export function isCurrentScheduleAssignmentOperation(
  activeOperation: ScheduleAssignmentOperation | null,
  candidateOperation: ScheduleAssignmentOperation,
  visibleMonth: string
): boolean {
  return activeOperation?.generation === candidateOperation.generation
    && activeOperation.slotId === candidateOperation.slotId
    && activeOperation.month === candidateOperation.month
    && candidateOperation.month === visibleMonth;
}

export function shouldRefreshScheduleAfterAssignment(
  operation: ScheduleAssignmentOperation,
  visibleMonth: string
): boolean {
  return operation.month === visibleMonth;
}

export function isCurrentScheduleLoadOperation(
  activeGeneration: number,
  candidateGeneration: number
): boolean {
  return activeGeneration === candidateGeneration;
}

export function ContentScheduleClient() {
  const scheduleRootRef = useRef<HTMLElement | null>(null);
  const detailsReturnFocusRef = useRef<HTMLElement | null>(null);
  const detailsWereOpenRef = useRef(false);
  const assignmentGenerationRef = useRef(0);
  const activeAssignmentOperationRef = useRef<ScheduleAssignmentOperation | null>(null);
  const loadGenerationRef = useRef(0);
  const [month, setMonth] = useState(currentMonth);
  const visibleMonthRef = useRef(month);
  const [view, setView] = useState<"calendar" | "list" | "assignees">("calendar");
  const [data, setData] = useState<SchedulePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [area, setArea] = useState("all");
  const [format, setFormat] = useState("all");
  const [person, setPerson] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleSlot | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [assignmentFeedback, setAssignmentFeedback] = useState<ScheduleAssignmentFeedback | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const invalidateAssignmentOperation = useCallback(() => {
    assignmentGenerationRef.current += 1;
    activeAssignmentOperationRef.current = null;
    setSavingId(null);
  }, []);

  const restoreDetailsFocus = useCallback(() => {
    const returnTarget = detailsReturnFocusRef.current;
    detailsReturnFocusRef.current = null;
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      restoreScheduleDetailsFocus(returnTarget, scheduleRootRef.current);
    });
  }, []);

  useEffect(() => {
    if (detailsWereOpenRef.current && !selectedSlot) {
      setAssignmentFeedback(null);
      invalidateAssignmentOperation();
      restoreDetailsFocus();
    }
    detailsWereOpenRef.current = Boolean(selectedSlot);
  }, [selectedSlot, invalidateAssignmentOperation, restoreDetailsFocus]);

  const load = useCallback(async (shouldApply: () => boolean = () => true) => {
    const loadGeneration = loadGenerationRef.current + 1;
    loadGenerationRef.current = loadGeneration;
    const ownsLoad = () => isCurrentScheduleLoadOperation(loadGenerationRef.current, loadGeneration);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/content-schedule?month=${encodeURIComponent(month)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const payload = await response.json() as ContentScheduleResponse;
      if (!ownsLoad() || !shouldApply()) return;
      const nextData = mapContentScheduleResponse(payload);
      setData(nextData);
      setSelectedSlot((current) => reconcileSelectedScheduleSlot(current, nextData.slots));
    } catch (cause) {
      if (ownsLoad() && shouldApply()) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o cronograma.");
    } finally {
      if (ownsLoad()) setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return (data?.slots ?? []).filter((slot) => {
      const slotStatus = deriveStatus(slot);
      const haystack = `${slot.area} ${slot.collaborator?.name ?? ""} ${slot.unmatchedAssigneeName ?? ""} ${slot.content?.title ?? ""}`.toLocaleLowerCase("pt-BR");
      return (area === "all" || slot.area === area)
        && (format === "all" || slot.format === format)
        && (person === "all" || slot.collaboratorId === person || (person === "unassigned" && !slot.collaboratorId))
        && (status === "all" || slotStatus === status)
        && (!term || haystack.includes(term));
    });
  }, [data, area, format, person, status, query]);

  const groups = useMemo(() => {
    const grouped = new Map<string, ScheduleSlot[]>();
    for (const slot of filtered) grouped.set(slot.area, [...(grouped.get(slot.area) ?? []), slot]);
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [filtered]);
  const totals = useMemo(() => {
    const slots = data?.slots ?? [];
    return {
      planned: slots.filter((slot) => deriveStatus(slot) !== "cancelled").length,
      assigned: slots.filter((slot) => ["assigned", "linked", "published"].includes(deriveStatus(slot))).length,
      linked: slots.filter((slot) => ["linked", "published"].includes(deriveStatus(slot))).length,
      published: slots.filter((slot) => deriveStatus(slot) === "published").length,
    };
  }, [data]);

  async function assign(slot: ScheduleSlot, collaboratorId: string) {
    const operation: ScheduleAssignmentOperation = {
      generation: assignmentGenerationRef.current + 1,
      slotId: slot.id,
      month: visibleMonthRef.current,
    };
    assignmentGenerationRef.current = operation.generation;
    activeAssignmentOperationRef.current = operation;
    const isCurrent = () => isCurrentScheduleAssignmentOperation(activeAssignmentOperationRef.current, operation, visibleMonthRef.current);
    const shouldRefresh = () => shouldRefreshScheduleAfterAssignment(operation, visibleMonthRef.current);
    setSavingId(slot.id);
    setNotice(null);
    setError(null);
    setAssignmentFeedback(null);
    try {
      const response = await fetch(`/api/content-schedule/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collaborator_id: collaboratorId === "unassigned" ? null : collaboratorId }),
      });
      if (!response.ok) throw new Error(await readError(response));
      if (!shouldRefresh()) return;
      if (isCurrent()) {
        setNotice("Responsável atualizado.");
        setAssignmentFeedback({ type: "success", message: "Responsável atualizado." });
      }
      await load(shouldRefresh);
    } catch (cause) {
      if (!isCurrent()) return;
      const message = cause instanceof Error ? cause.message : "Não foi possível atualizar o responsável.";
      setError(message);
      setAssignmentFeedback({ type: "error", message });
    } finally {
      if (isCurrent()) {
        activeAssignmentOperationRef.current = null;
        setSavingId(null);
      }
    }
  }

  function rememberScheduleDetailsTrigger(event: ReactMouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest<HTMLElement>('button[aria-label^="Abrir detalhes"]');
    if (trigger) detailsReturnFocusRef.current = trigger;
  }

  function openScheduleSlot(slot: ScheduleSlot) {
    invalidateAssignmentOperation();
    setNotice(null);
    setError(null);
    setAssignmentFeedback(null);
    setSelectedSlot(slot);
  }

  function handleDetailsOpenChange(open: boolean) {
    if (open) return;
    invalidateAssignmentOperation();
    setNotice(null);
    setError(null);
    setAssignmentFeedback(null);
    setSelectedSlot(null);
  }

  function changeMonth(amount: number) {
    const nextMonth = shiftMonth(visibleMonthRef.current, amount);
    visibleMonthRef.current = nextMonth;
    invalidateAssignmentOperation();
    setNotice(null);
    setError(null);
    setAssignmentFeedback(null);
    setSelectedSlot(null);
    setMonth(nextMonth);
  }

  const assignable = (slot: ScheduleSlot) => Boolean(data?.access.canManage || data?.access.assignableAreas === null || data?.access.assignableAreas.some((item) => normalizeScheduleArea(item) === normalizeScheduleArea(slot.area)));
  const canReviewAssignees = Boolean(data && (data.access.canManage || data.access.assignableAreas === null || data.access.assignableAreas.length > 0));

  return (
    <main ref={scheduleRootRef} tabIndex={-1} className="mx-auto w-full max-w-[1600px] space-y-5 p-4 outline-none sm:p-6">
      <section className="flex flex-col gap-4 border-b border-[#dce9eb] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase text-[#347796]">Escala editorial</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Quem produz, quando entrega</h2>
          <p className="mt-1 text-sm text-slate-600">Distribua as datas definidas pelo Marketing. Os temas aparecem aqui automaticamente quando forem escolhidos no fluxo de conteúdo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => changeMonth(-1)}><ChevronLeft /></Button>
          <div className="min-w-48 text-center font-semibold capitalize text-slate-900">{monthLabel(month)}</div>
          <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => changeMonth(1)}><ChevronRight /></Button>
          {data?.access.canManage && <Button className="ml-auto bg-[#347796] text-white hover:bg-[#285f7a]" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus /> Nova data</Button>}
        </div>
      </section>

      {notice && <div role="status" className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><span className="flex items-center gap-2"><CheckCircle2 className="size-4" />{notice}</span><button onClick={() => setNotice(null)} className="underline">Fechar</button></div>}
      {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span className="flex gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</span><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw /> Tentar novamente</Button></div>}

      <section aria-label="Resumo do mês" className="grid grid-cols-2 border-y border-l border-[#dce9eb] bg-white shadow-sm lg:grid-cols-4">
        <Summary label="Datas previstas" value={totals.planned} icon={CalendarDays} />
        <Summary label="Com responsável" value={totals.assigned} icon={CircleUserRound} />
        <Summary label="Com conteúdo" value={totals.linked} icon={FileText} />
        <Summary label="Publicados" value={totals.published} icon={BarChart3} />
      </section>

      {(data?.access.canManage && (data.pendingLinks?.length ?? 0) > 0) && <PendingLinks items={data.pendingLinks ?? []} slots={data.slots} onResolved={async () => { setNotice("Vínculo corrigido."); await load(); }} />}

      <section className="rounded-lg border border-[#dce9eb] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce9eb] bg-[#f8fbfb] p-3">
          <div className="inline-flex rounded-md border border-[#dce9eb] bg-white p-1 shadow-sm" role="tablist" aria-label="Visão do cronograma">
            <Button role="tab" aria-selected={view === "calendar"} variant="ghost" size="sm" className={cn(view === "calendar" && "bg-[#183f50] text-white hover:bg-[#183f50] hover:text-white")} onClick={() => setView("calendar")}><CalendarDays />Calendário</Button>
            <Button role="tab" aria-selected={view === "list"} variant="ghost" size="sm" className={cn(view === "list" && "bg-[#183f50] text-white hover:bg-[#183f50] hover:text-white")} onClick={() => setView("list")}><List />Lista</Button>
            {canReviewAssignees && <Button role="tab" aria-selected={view === "assignees"} variant="ghost" size="sm" className={cn(view === "assignees" && "bg-[#183f50] text-white hover:bg-[#183f50] hover:text-white")} onClick={() => setView("assignees")}><UsersRound />Responsáveis</Button>}
          </div>
          <p className="text-xs text-slate-500">A entrada padrão é o calendário; use a lista para ajustes pontuais.</p>
        </div>

        {view !== "assignees" && <>
        <div className="grid gap-2 border-b border-[#dce9eb] p-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(140px,180px))]">
          <div className="relative sm:col-span-2 xl:col-span-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pessoa ou conteúdo" className="pl-9" aria-label="Buscar no cronograma" /></div>
          <AreaSelect value={area} onChange={setArea} areas={data?.areas ?? []} allLabel="Todas as áreas" />
          <Filter value={format} onChange={setFormat} label="Todos os formatos" options={[{ value: "post", label: "Post" }, { value: "reel", label: "Reel" }]} />
          <CollaboratorSelect value={person} onChange={setPerson} collaborators={data?.collaborators ?? []} allLabel="Todas as pessoas" allowUnassigned showArea />
          <Filter value={status} onChange={setStatus} label="Todas as situações" options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
        </div>

        {loading ? <LoadingState /> : filtered.length === 0 ? <EmptyState hasFilters={Boolean(query || area !== "all" || format !== "all" || person !== "all" || status !== "all")} /> : view === "calendar" ? (
          <div onClickCapture={rememberScheduleDetailsTrigger}>
            <ContentScheduleCalendar month={month} slots={filtered} onSelectSlot={openScheduleSlot} />
          </div>
        ) : (
          <div className="divide-y divide-[#dce9eb]">
            {groups.map(([groupArea, slots]) => (
              <section key={groupArea} aria-labelledby={`area-${groupArea}`}>
                <div className="flex items-center justify-between border-l-4 border-l-[#47cdd0] bg-[#f5fafb] px-4 py-2.5">
                  <h3 id={`area-${groupArea}`} className="font-semibold text-[#183f50]"><AreaMark area={groupArea} /></h3>
                  <span className="rounded-full border border-[#dce9eb] bg-white px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">{slots.length} {slots.length === 1 ? "data" : "datas"}</span>
                </div>
                <div className="hidden grid-cols-[120px_100px_minmax(210px,0.8fr)_minmax(260px,1.3fr)_160px] border-y border-[#e8f0f2] px-4 py-2 text-xs font-semibold text-slate-500 lg:grid"><span>Data</span><span>Formato</span><span>Responsável</span><span>Conteúdo vinculado</span><span>Situação</span></div>
                <div className="divide-y divide-[#e8f0f2]">{slots.sort((a, b) => a.date.localeCompare(b.date)).map((slot) => <SlotRow key={slot.id} slot={slot} collaborators={(data?.collaborators ?? []).filter((item) => !item.area || normalizeScheduleArea(item.area) === normalizeScheduleArea(slot.area))} canAssign={assignable(slot) && !slot.content} canManage={data?.access.canManage ?? false} saving={savingId === slot.id} onAssign={(id) => void assign(slot, id)} onEdit={() => { setEditing(slot); setDialogOpen(true); }} />)}</div>
              </section>
            ))}
          </div>
        )}
        </>}

        {view === "assignees" && canReviewAssignees && (
          <ContentScheduleAssigneeReview
            year={Number(month.slice(0, 4))}
            onUpdated={async (message) => { setNotice(message); await load(); }}
          />
        )}
      </section>

      {data && <SlotDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} areas={data.areas} collaborators={data.collaborators} onSaved={async (message) => { setNotice(message); setDialogOpen(false); await load(); }} />}
      <ContentScheduleSlotDetails
        slot={selectedSlot}
        open={Boolean(selectedSlot)}
        onOpenChange={handleDetailsOpenChange}
        collaborators={data?.collaborators ?? []}
        canAssign={selectedSlot ? assignable(selectedSlot) : false}
        saving={Boolean(selectedSlot && savingId === selectedSlot.id)}
        onAssign={(collaboratorId) => { if (selectedSlot) void assign(selectedSlot, collaboratorId); }}
        assignmentFeedback={assignmentFeedback}
      />
    </main>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: number; icon: typeof CalendarDays }) {
  return <div className="flex min-h-24 items-center gap-3 border-b border-r border-[#dce9eb] px-4 py-3 lg:border-b-0"><span className="flex size-10 items-center justify-center rounded-md bg-[#e8f8f8] text-[#347796]"><Icon className="size-5" /></span><div><strong className="font-mono text-2xl text-slate-950">{value}</strong><p className="text-xs text-slate-500">{label}</p></div></div>;
}

function Filter({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: { value: string; label: string }[] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger className="w-full"><SelectValue placeholder={label} /></SelectTrigger><SelectContent><SelectItem value="all">{label}</SelectItem>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}

function AreaSelect({ value, onChange, areas, allLabel, disabled }: { value: string; onChange: (value: string) => void; areas: string[]; allLabel?: string; disabled?: boolean }) {
  const selectedArea = value !== "all" ? areas.find((item) => item === value) ?? value : null;
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full" aria-label={allLabel ?? "Área"}>
        {selectedArea ? <AreaMark area={selectedArea} compact /> : <span className="flex items-center gap-2 text-muted-foreground"><span className="flex size-6 items-center justify-center rounded-md bg-slate-100 ring-1 ring-slate-200"><AreaIcon area="Geral" className="size-3.5" /></span>{allLabel}</span>}
      </SelectTrigger>
      <SelectContent align="start">
        {allLabel ? <SelectItem value="all"><AreaMark area={allLabel} compact /></SelectItem> : null}
        {areas.map((item) => <SelectItem key={item} value={item}><AreaMark area={item} compact /></SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function CollaboratorSelect({ value, onChange, collaborators, allLabel, allowUnassigned = false, showArea = false, disabled }: { value: string; onChange: (value: string) => void; collaborators: Collaborator[]; allLabel?: string; allowUnassigned?: boolean; showArea?: boolean; disabled?: boolean }) {
  const selected = collaborators.find((item) => item.id === value);
  const emptyLabel = value === "all" ? allLabel : value === "unassigned" ? "Sem responsável" : "Selecionar responsável";
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full min-w-0" aria-label={allLabel ?? "Responsável"}>
        {selected ? <CollaboratorMark person={selected} showArea={showArea} /> : <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100"><CircleUserRound className="size-4" /></span><span className="truncate">{emptyLabel}</span></span>}
      </SelectTrigger>
      <SelectContent align="start" className="min-w-[260px]">
        {allLabel ? <SelectItem value="all"><span className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-slate-100"><CircleUserRound className="size-4" /></span>{allLabel}</span></SelectItem> : null}
        {allowUnassigned ? <SelectItem value="unassigned"><span className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white"><CircleUserRound className="size-4 text-slate-400" /></span>Sem responsável</span></SelectItem> : null}
        {collaborators.map((item) => <SelectItem value={item.id} key={item.id} className="py-2"><CollaboratorMark person={item} showArea={showArea} /></SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function SlotRow({ slot, collaborators, canAssign, canManage, saving, onAssign, onEdit }: { slot: ScheduleSlot; collaborators: Collaborator[]; canAssign: boolean; canManage: boolean; saving: boolean; onAssign: (id: string) => void; onEdit: () => void }) {
  const state = deriveStatus(slot);
  return <article className={cn("grid gap-3 px-4 py-3 lg:grid-cols-[120px_100px_minmax(210px,0.8fr)_minmax(260px,1.3fr)_160px] lg:items-center", state === "cancelled" && "opacity-55")}>
    <div><span className="text-xs font-medium text-slate-400 lg:hidden">Data · </span><span className="font-mono text-sm font-semibold capitalize text-slate-900">{shortDate(slot.date)}</span></div>
    <div><Badge variant="outline" className={cn("gap-1", slot.format === "reel" ? "border-[#48466e]/25 bg-[#48466e]/8 text-[#48466e]" : "border-[#347796]/25 bg-[#347796]/8 text-[#285f7a]")}>{slot.format === "reel" ? <Film /> : <FileText />}{slot.format === "reel" ? "Reel" : "Post"}</Badge></div>
    <div>{canAssign && state !== "cancelled" ? <CollaboratorSelect value={slot.collaboratorId ?? "unassigned"} onChange={onAssign} collaborators={collaborators} allowUnassigned disabled={saving} /> : slot.collaborator ? <div className="flex min-w-0 items-center gap-2 text-sm"><CollaboratorAvatar person={slot.collaborator} /><span className="truncate font-medium text-slate-700">{slot.collaborator.name}</span></div> : <div className="flex items-center gap-2 text-sm"><span className="flex size-7 items-center justify-center rounded-full border border-dashed border-slate-300"><CircleUserRound className="size-4 text-slate-400" /></span><span>{slot.unmatchedAssigneeName || "A definir"}</span></div>}{slot.unmatchedAssigneeName && !slot.collaboratorId && <p className="mt-1 text-xs text-amber-700">Nome da planilha sem correspondência</p>}</div>
    <div>{slot.content ? <a href={slot.content.url ?? `/conteudo/roteiros?contentId=${slot.content.id}`} className="font-medium text-[#285f7a] hover:underline">{slot.content.title}</a> : !slot.publication && <div className="text-sm text-slate-400">Aguardando escolha no módulo de conteúdo</div>}{slot.publication?.permalink && <a href={slot.publication.permalink} target="_blank" rel="noreferrer" className="mt-1 flex w-fit items-center gap-1 text-xs text-slate-500 hover:text-[#347796]">Ver publicação <ExternalLink className="size-3" /></a>}{slot.publication && <p className="mt-1 font-mono text-xs text-slate-500">{number(slot.publication.reach)} alcance · {number(slot.publication.likes)} curtidas · {number(slot.publication.comments)} comentários</p>}{slot.imported && <p className="mt-1 text-xs text-slate-500">Planilha: {slot.sourceStatus || "histórico"}{slot.sourceName ? ` · nome original: ${slot.sourceName}` : ""}</p>}</div>
    <div className="flex items-center justify-between gap-2"><StatusBadge status={state} />{canManage && <Button variant="ghost" size="sm" onClick={onEdit}>Editar</Button>}</div>
  </article>;
}

function StatusBadge({ status }: { status: ScheduleStatus }) {
  return <Badge variant="outline" className={cn(status === "published" && "border-emerald-200 bg-emerald-50 text-emerald-700", status === "linked" && "border-sky-200 bg-sky-50 text-sky-700", status === "assigned" && "border-[#47cdd0]/40 bg-[#e8f8f8] text-[#285f7a]", status === "open" && "border-amber-200 bg-amber-50 text-amber-800")}>{STATUS_LABELS[status]}</Badge>;
}

function PendingLinks({ items, slots, onResolved }: { items: PendingLink[]; slots: ScheduleSlot[]; onResolved: () => Promise<void> }) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function resolve(item: PendingLink) { const slotId = selection[item.id]; if (!slotId) return; setSaving(item.id); setError(null); try { const response = await fetch(`/api/content-schedule/links/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot_id: slotId }) }); if (!response.ok) throw new Error(await readError(response)); await onResolved(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível corrigir o vínculo."); } finally { setSaving(null); } }
  return <section className="rounded-md border border-amber-200 bg-amber-50/70"><div className="flex items-start gap-3 border-b border-amber-200 px-4 py-3"><AlertCircle className="mt-0.5 size-5 text-amber-700" /><div><h3 className="font-semibold text-amber-950">{items.length} {items.length === 1 ? "vínculo precisa" : "vínculos precisam"} de conferência</h3><p className="text-sm text-amber-800">A automação não conseguiu escolher uma data com segurança. Confira antes de vincular.</p></div></div>{error && <p role="alert" className="border-b border-amber-200 px-4 py-2 text-sm text-red-700">{error}</p>}<div className="divide-y divide-amber-200">{items.slice(0, 5).map((item) => { const candidates = slots.filter((slot) => !slot.content && deriveStatus(slot) !== "cancelled" && slot.format === item.format && (!item.area || normalizeScheduleArea(slot.area) === normalizeScheduleArea(item.area)) && (!item.collaboratorId || slot.collaboratorId === item.collaboratorId)); return <div key={item.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)_auto] sm:items-center"><div><p className="text-sm font-medium text-amber-950">{item.label || item.collaboratorName || "Conteúdo sem vínculo definido"}</p><p className="text-xs text-amber-800">{item.reason === "no_slot" ? "Nenhuma vaga automática foi encontrada" : item.reason === "race_lost" ? "A vaga foi ocupada durante o vínculo" : "Mais de uma data pode receber este conteúdo"}</p></div><Select value={selection[item.id]} onValueChange={(value) => setSelection((current) => ({ ...current, [item.id]: value }))}><SelectTrigger className="w-full bg-white"><SelectValue placeholder={candidates.length ? "Escolher data" : "Sem data compatível"} /></SelectTrigger><SelectContent>{candidates.map((slot) => <SelectItem key={slot.id} value={slot.id}><span className="flex items-center gap-2"><AreaMark area={slot.area} compact /><span className="font-mono text-xs">{shortDate(slot.date)}</span></span></SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={!selection[item.id] || saving === item.id} onClick={() => void resolve(item)}>{saving === item.id ? <Loader2 className="animate-spin" /> : <Send />}Vincular</Button></div>; })}</div></section>;
}

function LoadingState() { return <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-slate-500"><Loader2 className="size-6 animate-spin text-[#347796]" /><span>Carregando cronograma…</span></div>; }
function EmptyState({ hasFilters }: { hasFilters: boolean }) { return <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><CalendarDays className="size-8 text-slate-300" /><h3 className="mt-3 font-semibold text-slate-800">{hasFilters ? "Nenhuma data corresponde aos filtros" : "Nenhuma data planejada neste mês"}</h3><p className="mt-1 max-w-md text-sm text-slate-500">{hasFilters ? "Ajuste os filtros para ampliar a busca." : "Quando o Marketing cadastrar as próximas entregas, elas aparecerão aqui."}</p></div>; }

function SlotDialog({ open, onOpenChange, editing, areas, collaborators, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; editing: ScheduleSlot | null; areas: string[]; collaborators: Collaborator[]; onSaved: (message: string) => Promise<void> }) {
  const locked = Boolean(editing?.content);
  const [date, setDate] = useState(""); const [area, setArea] = useState(""); const [format, setFormat] = useState<Format>("post"); const [collaboratorId, setCollaboratorId] = useState("unassigned"); const [cancelled, setCancelled] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const [publicationId, setPublicationId] = useState("none"); const [posts, setPosts] = useState<{ id: string; caption: string | null; published_at: string | null }[]>([]);
  useEffect(() => { if (!open) return; setDate(editing?.date.slice(0, 10) ?? ""); setArea(editing?.area ?? areas[0] ?? ""); setFormat(editing?.format ?? "post"); setCollaboratorId(editing?.collaboratorId ?? "unassigned"); setCancelled(editing?.status === "cancelled"); setPublicationId("none"); setError(null); }, [open, editing, areas]);
  useEffect(() => { if (!open || !editing || !area) return; const controller = new AbortController(); const base = new Date(`${editing.date.slice(0, 10)}T12:00:00`); const from = new Date(base); from.setDate(from.getDate() - 120); const to = new Date(base); to.setDate(to.getDate() + 120); const params = new URLSearchParams({ area, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }); void fetch(`/api/instagram/posts?${params}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((payload: { posts?: { id: string; caption: string | null; published_at: string | null }[] } | null) => setPosts(payload?.posts ?? [])).catch(() => undefined); return () => controller.abort(); }, [open, editing, area]);
  async function save() { setSaving(true); setError(null); try { const fields = { due_date: date, area, format, collaborator_id: collaboratorId === "unassigned" ? null : collaboratorId }; const response = await fetch(editing ? `/api/content-schedule/${editing.id}` : "/api/content-schedule", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? (locked ? { due_date: date, cancelled } : { ...fields, cancelled }) : { slots: [fields] }) }); if (!response.ok) throw new Error(await readError(response)); if (editing && publicationId !== "none") { const linkResponse = await fetch(`/api/content-schedule/${editing.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instagram_post_id: publicationId }) }); if (!linkResponse.ok) throw new Error(await readError(linkResponse)); } await onSaved(editing ? "Data atualizada." : "Nova data adicionada ao cronograma."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); } finally { setSaving(false); } }
  const areaCollaborators = collaborators.filter((item) => !item.area || normalizeScheduleArea(item.area) === normalizeScheduleArea(area));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Editar data" : "Adicionar data ao cronograma"}</DialogTitle><DialogDescription>{locked ? "O conteúdo já foi vinculado. A data, o cancelamento e a publicação real ainda podem ser atualizados." : "Defina a área, a entrega e o formato. O tema será vinculado automaticamente pelo fluxo de conteúdo."}</DialogDescription></DialogHeader>{error && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}<div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="schedule-date">Data</Label><Input id="schedule-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="space-y-2"><Label>Formato</Label><Select value={format} disabled={locked} onValueChange={(value) => setFormat(value as Format)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="post"><span className="flex items-center gap-2"><FileText className="size-4 text-[#347796]" />Post</span></SelectItem><SelectItem value="reel"><span className="flex items-center gap-2"><Film className="size-4 text-[#48466e]" />Reel</span></SelectItem></SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Área</Label><AreaSelect value={area} disabled={locked} onChange={setArea} areas={areas} /></div><div className="space-y-2 sm:col-span-2"><Label>Responsável (opcional)</Label><CollaboratorSelect value={collaboratorId} disabled={locked} onChange={setCollaboratorId} collaborators={areaCollaborators} allowUnassigned /></div>{editing && <div className="space-y-2 sm:col-span-2"><Label>Publicação real do Instagram (opcional)</Label><Select value={publicationId} onValueChange={setPublicationId}><SelectTrigger className="w-full"><SelectValue placeholder="Manter publicação atual" /></SelectTrigger><SelectContent><SelectItem value="none">Manter publicação atual</SelectItem>{posts.map((post) => <SelectItem key={post.id} value={post.id}>{post.published_at ? new Date(post.published_at).toLocaleDateString("pt-BR") : "Sem data"} · {(post.caption || "Publicação sem legenda").slice(0, 70)}</SelectItem>)}</SelectContent></Select></div>}{editing && <label className="flex min-h-11 items-center gap-3 rounded-md border border-[#dce9eb] px-3 text-sm sm:col-span-2"><input type="checkbox" checked={cancelled} onChange={(event) => setCancelled(event.target.checked)} className="size-4 accent-[#347796]" />Marcar esta data como cancelada</label>}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button><Button onClick={() => void save()} disabled={saving || !date || !area} className="bg-[#347796] text-white hover:bg-[#285f7a]">{saving && <Loader2 className="animate-spin" />}{editing ? "Salvar alterações" : "Adicionar data"}</Button></DialogFooter></DialogContent></Dialog>;
}
