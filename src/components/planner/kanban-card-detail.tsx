"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAreaIcon } from "@/lib/area-icons";
import { WORKFLOW_STAGES, COMPLETION_TYPES } from "@/lib/constants";
import type { CompletionTypeConfig } from "@/lib/app-settings";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { updateMarketingRequest, deleteMarketingRequest } from "@/lib/marketing-requests";
import {
  fetchTimeEntriesForRequest,
  formatDuration,
  totalDurationForEntries,
  deleteTimeEntry,
  type TimeEntry,
} from "@/lib/time-entries";
import { useAuth } from "@/contexts/auth-context";
import { useTimer } from "@/contexts/timer-context";
import { useStopwatch } from "@/hooks/use-stopwatch";
import { fetchActivityLog, type ActivityLogEntry } from "@/lib/activity-log";
import type { User } from "@/lib/users";
import {
  fetchCommentsForRequest,
  createComment,
  resolveAlteration,
  deleteComment,
  type RequestComment,
} from "@/lib/request-comments";
import { Play, Pause, Square, MessageSquare, Edit3, AlertCircle, CheckCircle2, Flag, CalendarX2, Clock, Calendar, Layers, Circle, ChevronDown, ChevronUp, Link2, Trash2, FileText } from "lucide-react";
import { fetchViosTaskByMarketingRequestId, filterLeonardoFromResponsaveis, type ViosTask } from "@/lib/vios-tasks";
import { DatePickerField } from "@/components/ui/date-picker-field";
import type { RequestPriority } from "@/lib/marketing-requests";

const PRIORITY_OPTIONS: { value: RequestPriority; label: string; className: string }[] = [
  { value: "urgente", label: "Urgente", className: "text-red-600 dark:text-red-400" },
  { value: "alta",    label: "Alta",    className: "text-orange-600 dark:text-orange-400" },
  { value: "normal",  label: "Normal",  className: "text-muted-foreground" },
  { value: "baixa",   label: "Baixa",   className: "text-[#101f2e]/60 dark:text-white/40" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface KanbanCardDetailProps {
  request: MarketingRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
  designers?: User[];
  completionTypes?: CompletionTypeConfig[];
}

export function KanbanCardDetail({
  request,
  open,
  onOpenChange,
  onRefresh,
  designers = [],
  completionTypes,
}: KanbanCardDetailProps) {
  const completionOptions = completionTypes?.length
    ? completionTypes
    : COMPLETION_TYPES.map((c) => ({ value: c.value, label: c.label }));
  const { profile } = useAuth();
  const timer = useTimer();
  const [completionType, setCompletionType] = useState<string>("");
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const isAdmin = profile?.role === "admin";
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [comments, setComments] = useState<RequestComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [isAlteration, setIsAlteration] = useState(false);
  const [submitCommentLoading, setSubmitCommentLoading] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [viosTask, setViosTask] = useState<ViosTask | null>(null);
  const [isSavingPriority, setIsSavingPriority] = useState(false);
  const [isSavingDeadline, setIsSavingDeadline] = useState(false);
  const [isSavingDeadlineTime, setIsSavingDeadlineTime] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [deleteRequestConfirmOpen, setDeleteRequestConfirmOpen] = useState(false);
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);
  const [deleteRequestError, setDeleteRequestError] = useState<string | null>(null);
  const [artLinkDraft, setArtLinkDraft] = useState("");
  const [isSavingArtLink, setIsSavingArtLink] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const canUseTimesheet = profile && request && (isAdmin || profile.id === request.assignee_id);
  const canStartTimer = profile && request && (isAdmin || profile.id === request.assignee_id);

  // activeEntry is now managed globally by TimerContext
  const activeEntry =
    timer.activeEntry?.request_id === request?.id ? timer.activeEntry : null;

  // Live stopwatch for the modal's timesheet section
  const liveElapsed = useStopwatch(activeEntry?.started_at ?? null);

  useEffect(() => {
    if (!open || !request) {
      setDescriptionExpanded(false);
      return;
    }
    setArtLinkDraft(request.art_link ?? "");
    const load = async () => {
      const [entries, commentsList, log, linkedVios] = await Promise.all([
        fetchTimeEntriesForRequest(request.id),
        fetchCommentsForRequest(request.id),
        fetchActivityLog(request.id),
        fetchViosTaskByMarketingRequestId(request.id),
      ]);
      setTimeEntries(entries);
      setComments(commentsList);
      setActivityLog(log);
      setViosTask(linkedVios);
    };
    load();
  }, [open, request?.id, request?.art_link]);

  const handleStart = async () => {
    if (!request) return;
    const { data } = await timer.start(request.id, request.title);
    if (data) {
      setTimeEntries((prev) => [data, ...prev]);
    }
  };

  const handlePause = async () => {
    if (!activeEntry) return;
    const entryId = activeEntry.id;
    await timer.pause(liveElapsed);
    setTimeEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, ended_at: new Date().toISOString() } : e
      )
    );
  };

  const handleEnd = async () => {
    if (!activeEntry) return;
    const entryId = activeEntry.id;
    await timer.stop();
    setTimeEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, ended_at: new Date().toISOString() } : e
      )
    );
  };

  const handleSaveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === request?.title) { setIsEditingTitle(false); return; }
    setIsSavingTitle(true);
    await updateMarketingRequest(request!.id, { title: trimmed });
    setIsSavingTitle(false);
    setIsEditingTitle(false);
    onRefresh?.();
  };

  if (!request) return null;

  const AreaIcon = getAreaIcon(request.requesting_area);
  const workflowLabel =
    WORKFLOW_STAGES.find((s) => s.value === request.workflow_stage)?.label ??
    request.workflow_stage;
  const isConcluido = request.workflow_stage === "concluido";

  const handleMarkComplete = async () => {
    const type = completionType || "design_concluido";
    setIsMarkingComplete(true);
    const { error } = await updateMarketingRequest(request.id, {
      workflow_stage: "concluido",
      completion_type: type as "design_concluido" | "postagem_feita" | "conteudo_entregue",
    });
    setIsMarkingComplete(false);
    if (!error) {
      onRefresh?.();
      onOpenChange(false);
    }
  };

  const handleAddComment = async () => {
    if (!request || !profile || !commentBody.trim()) return;
    setSubmitCommentLoading(true);
    const { data, error } = await createComment(
      request.id,
      profile.id,
      commentBody.trim(),
      isAlteration
    );
    setSubmitCommentLoading(false);
    if (!error && data) {
      setComments((prev) => [{ ...data, user_name: profile.name, user_avatar_url: null }, ...prev]);
      setCommentBody("");
      setIsAlteration(false);
      onRefresh?.();
    }
  };

  const handleAssignDesigner = async (assigneeId: string) => {
    if (!request) return;
    setIsAssigning(true);
    const isNone = assigneeId === "__none__";
    const designer = isNone ? null : designers.find((d) => d.id === assigneeId);
    const { error } = await updateMarketingRequest(request.id, {
      assignee_id: isNone ? null : assigneeId,
      assignee: designer?.name ?? null,
    });
    setIsAssigning(false);
    if (!error) {
      onRefresh?.();
    }
  };

  const handlePriorityChange = async (value: string) => {
    if (!request) return;
    setIsSavingPriority(true);
    await updateMarketingRequest(request.id, { priority: value as RequestPriority });
    setIsSavingPriority(false);
    onRefresh?.();
  };

  const handleDeadlineChange = async (value: string) => {
    if (!request) return;
    setIsSavingDeadline(true);
    await updateMarketingRequest(request.id, { deadline: value || null });
    setIsSavingDeadline(false);
    onRefresh?.();
  };

  const handleDeadlineTimeChange = async (value: string) => {
    if (!request) return;
    setIsSavingDeadlineTime(true);
    await updateMarketingRequest(request.id, { deadline_time: value || null });
    setIsSavingDeadlineTime(false);
    onRefresh?.();
  };

  const handleResolveAlteration = async (commentId: string) => {
    if (!profile) return;
    const { error } = await resolveAlteration(commentId, profile.id);
    if (!error) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                resolved_at: new Date().toISOString(),
                resolved_by_user_id: profile.id,
                resolved_by_user_name: profile.name,
              }
            : c
        )
      );
      onRefresh?.();
    }
  };

  const handleDeleteRequest = async () => {
    if (!request) return;
    setDeleteRequestError(null);
    setIsDeletingRequest(true);
    const { error } = await deleteMarketingRequest(request.id);
    setIsDeletingRequest(false);
    if (!error) {
      setDeleteRequestConfirmOpen(false);
      onOpenChange(false);
      onRefresh?.();
    } else {
      setDeleteRequestError(error);
    }
  };

  const handleSaveArtLink = async () => {
    if (!request) return;
    const value = artLinkDraft.trim() || null;
    if (value === (request.art_link ?? "")) return;
    setIsSavingArtLink(true);
    await updateMarketingRequest(request.id, { art_link: value });
    setIsSavingArtLink(false);
    onRefresh?.();
  };

  const handleDeleteComment = async (commentId: string) => {
    setDeletingCommentId(commentId);
    const { error } = await deleteComment(commentId);
    setDeletingCommentId(null);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onRefresh?.();
    }
  };

  const handleDeleteTimeEntry = async (entryId: string) => {
    setDeletingEntryId(entryId);
    const { error } = await deleteTimeEntry(entryId);
    setDeletingEntryId(null);
    if (!error) {
      setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
      onRefresh?.();
    }
  };

  const modalDescription = `Detalhes da solicitação: ${request.requesting_area}, solicitado em ${format(new Date(request.requested_at), "dd/MM/yyyy", { locale: ptBR })}`;

  const sectionClass =
    "rounded-2xl border border-white/40 dark:border-border/50 bg-white/70 dark:bg-card/80 backdrop-blur-sm p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] space-y-3";
  const sectionTitleClass =
    "text-xs font-semibold text-muted-foreground uppercase tracking-wider";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0 rounded-2xl border border-white/50 dark:border-white/10 bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-background dark:via-background dark:to-background/95 backdrop-blur-xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05)]"
        aria-describedby="kanban-detail-description"
      >
        {/* Header fixo — compacto */}
        <div className="shrink-0 border-b border-white/30 dark:border-border/50 px-6 py-4 pr-12 bg-white/80 dark:bg-[linear-gradient(135deg,var(--primary-dark-from)_0%,var(--primary-dark-to)_100%)] backdrop-blur-sm">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-base font-bold tracking-tight text-foreground leading-snug">
                {isAdmin && isEditingTitle ? (
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setIsEditingTitle(false); }}
                    disabled={isSavingTitle}
                    className="w-full bg-white/30 dark:bg-white/10 border border-white/50 dark:border-white/20 rounded-lg px-2 py-0.5 text-base font-bold focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                ) : (
                  <span
                    className={isAdmin ? "cursor-text hover:bg-white/20 dark:hover:bg-white/10 rounded-lg px-1 -mx-1 transition-colors" : ""}
                    title={isAdmin ? "Clique para editar o título" : undefined}
                    onClick={() => { if (isAdmin) { setTitleDraft(request.title); setIsEditingTitle(true); } }}
                  >
                    {request.title}
                  </span>
                )}
              </DialogTitle>
            {request.description && (
              <p className={cn(
                "mt-1.5 text-sm text-muted-foreground/90 leading-relaxed",
                !descriptionExpanded && "line-clamp-2"
              )}>
                {request.description}
              </p>
            )}
            {request.description && request.description.length > 120 && (
              <button
                type="button"
                onClick={() => setDescriptionExpanded((v) => !v)}
                className="mt-0.5 text-xs font-medium text-primary hover:underline inline-flex items-center gap-0.5"
              >
                {descriptionExpanded ? <>Ver menos <ChevronUp className="h-3 w-3" /></> : <>Ver mais <ChevronDown className="h-3 w-3" /></>}
              </button>
            )}
            {(request.created_by_user?.name || request.created_by || request.assignee_user || request.assignee) && (
              <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/15 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground/90">
                {(request.created_by_user?.name || request.created_by) && (
                  <span className="flex items-center gap-1.5">
                    {request.created_by_user ? (
                      <Avatar className="h-4 w-4 shrink-0 border border-white/50 dark:border-white/20">
                        <AvatarImage src={request.created_by_user.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px] bg-[#101f2e]/10 text-[#101f2e] dark:bg-white/10 dark:text-white">
                          {getInitials(request.created_by_user.name)}
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                    Criado por {request.created_by_user?.name ?? request.created_by}
                  </span>
                )}
                {(request.assignee_user || request.assignee) && (
                  <>
                    {(request.created_by_user?.name || request.created_by) && (
                      <span className="text-muted-foreground/40 select-none">·</span>
                    )}
                    <span className="flex items-center gap-1.5">
                      {request.assignee_user ? (
                        <Avatar className="h-4 w-4 shrink-0 border border-white/50 dark:border-white/20">
                          <AvatarImage src={request.assignee_user.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px] bg-[#101f2e]/10 text-[#101f2e] dark:bg-white/10 dark:text-white">
                            {getInitials(request.assignee_user.name)}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                      Atribuído a {request.assignee_user?.name ?? request.assignee}
                    </span>
                  </>
                )}
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/15 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground/90">
              {(request.solicitante_user || request.solicitante) && (
                <span className="flex items-center gap-1.5">
                  {request.solicitante_user ? (
                    <Avatar className="h-4 w-4 shrink-0 border border-white/50 dark:border-white/20">
                      <AvatarImage src={request.solicitante_user.avatar_url || undefined} />
                      <AvatarFallback className="text-[8px] bg-[#101f2e]/10 text-[#101f2e] dark:bg-white/10 dark:text-white">
                        {getInitials(request.solicitante_user.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                  {request.solicitante_user?.name || request.solicitante}
                </span>
              )}
              {request.requesting_area && (
                <>
                  <span className="text-muted-foreground/40 select-none">·</span>
                  <span className="flex items-center gap-1">
                    <AreaIcon className="h-3 w-3 shrink-0" aria-hidden />
                    {request.requesting_area}
                  </span>
                </>
              )}
              <span className="text-muted-foreground/40 select-none">·</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                {format(new Date(request.requested_at), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>

            <DialogDescription id="kanban-detail-description" className="sr-only">
              {modalDescription}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Área rolável */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 space-y-5">
          {/* Link da arte — designer/revisor preenche ao enviar para revisão */}
          {(request.workflow_stage === "revisao" || request.workflow_stage === "revisado" || request.workflow_stage === "revisao_autor" || request.workflow_stage === "concluido" || request.art_link || canUseTimesheet || isAdmin) && (
            <section aria-labelledby="art-link-heading" className={sectionClass}>
              <h4 id="art-link-heading" className={sectionTitleClass}>
                <Link2 className="h-4 w-4 shrink-0" aria-hidden /> Link da arte
              </h4>
              {(canUseTimesheet || isAdmin) ? (
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={artLinkDraft}
                    onChange={(e) => setArtLinkDraft(e.target.value)}
                    onBlur={handleSaveArtLink}
                    disabled={isSavingArtLink}
                    className="flex h-9 w-full rounded-xl border border-input bg-white/80 dark:bg-background/50 px-3 py-1 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                  />
                  {request.art_link && (
                    <a
                      href={request.art_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 dark:bg-primary/20 text-sm font-medium text-primary hover:bg-primary/20 dark:hover:bg-primary/30 border border-primary/20"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Abrir arte
                    </a>
                  )}
                </div>
              ) : request.art_link ? (
                <a
                  href={request.art_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 dark:bg-primary/20 text-sm font-medium text-primary hover:bg-primary/20 dark:hover:bg-primary/30 border border-primary/20"
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Abrir arte
                </a>
              ) : (
                <p className="text-sm text-muted-foreground italic">Ainda não informado.</p>
              )}
            </section>
          )}

          {/* Link e referências — primeiro na área rolável */}
          {(request.link || request.referencias) && (
            <section aria-labelledby="links-heading" className={sectionClass}>
              <h4 id="links-heading" className={sectionTitleClass}>
                <Link2 className="h-4 w-4 shrink-0" aria-hidden /> Link e referências
              </h4>
              <div className="space-y-3">
                {request.link && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Link</p>
                    <a
                      href={request.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 dark:bg-primary/20 text-sm font-medium text-primary hover:bg-primary/20 dark:hover:bg-primary/30 border border-primary/20"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Abrir link
                    </a>
                  </div>
                )}
                {request.referencias && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Referências</p>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {request.referencias}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Informações — estado atual da tarefa */}
          <section aria-labelledby="metadata-heading" className={sectionClass}>
            <h4 id="metadata-heading" className={sectionTitleClass}>
              Informações
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                  request.status === "completed"
                    ? "bg-emerald-100/80 dark:bg-emerald-950/40"
                    : request.status === "in_progress"
                    ? "bg-amber-100/80 dark:bg-amber-950/40"
                    : "bg-slate-100/80 dark:bg-white/8"
                }`}>
                  {request.status === "completed" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  ) : request.status === "in_progress" ? (
                    <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-slate-500 dark:text-white/40" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Status</p>
                  <span className={`text-sm font-semibold ${
                    request.status === "completed"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : request.status === "in_progress"
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-slate-600 dark:text-white/60"
                  }`}>
                    {request.status === "completed" ? "Concluído"
                     : request.status === "in_progress" ? "Em andamento"
                     : "Pendente"}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#101f2e]/8 dark:bg-white/8">
                  <Layers className="h-3.5 w-3.5 text-[#101f2e]/60 dark:text-white/40" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Etapa</p>
                  <span className="text-sm font-medium text-foreground">{workflowLabel}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#101f2e]/8 dark:bg-white/8">
                  <Calendar className="h-3.5 w-3.5 text-[#101f2e]/60 dark:text-white/40" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Solicitado em</p>
                  <span className="text-sm font-medium text-foreground">
                    {format(new Date(request.requested_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                  request.delivered_at ? "bg-emerald-100/80 dark:bg-emerald-950/40" : "bg-muted/50"
                }`}>
                  <CalendarX2 className={`h-3.5 w-3.5 ${request.delivered_at ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/40"}`} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none mb-0.5">Entregue em</p>
                  <span className={`text-sm font-medium ${request.delivered_at ? "text-foreground" : "text-muted-foreground/50 italic"}`}>
                    {request.delivered_at
                      ? format(new Date(request.delivered_at), "dd/MM/yyyy", { locale: ptBR })
                      : "Não entregue"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Prioridade */}
          <section aria-labelledby="priority-heading" className={sectionClass}>
            <h4 id="priority-heading" className={sectionTitleClass}>
              Prioridade
            </h4>
            <div className="space-y-1.5">
              {isAdmin ? (
                <Select value={request.priority ?? "normal"} onValueChange={handlePriorityChange} disabled={isSavingPriority}>
                  <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className={`flex items-center gap-2 font-medium ${opt.className}`}>
                          <Flag className="h-3.5 w-3.5" aria-hidden />{opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Flag className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  {PRIORITY_OPTIONS.find((o) => o.value === (request.priority ?? "normal"))?.label ?? "Normal"}
                </p>
              )}
            </div>
          </section>

          {/* 3. Prazo de entrega (data + horário em linha própria) */}
          <section aria-labelledby="deadline-heading" className={sectionClass}>
            <h4 id="deadline-heading" className={sectionTitleClass}>
              Prazo de entrega
            </h4>
            <div className="space-y-2">
              {isAdmin ? (
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1.5 min-w-[140px]">
                    <p className="text-xs text-muted-foreground">Data</p>
                    <DatePickerField
                      value={request.deadline ?? ""}
                      onChange={handleDeadlineChange}
                      placeholder="DD/MM/AAAA"
                      disabled={isSavingDeadline}
                    />
                  </div>
                  <div className="space-y-1.5 min-w-[100px]">
                    <p className="text-xs text-muted-foreground">Horário</p>
                    <input
                      type="time"
                      defaultValue={request.deadline_time ?? ""}
                      onBlur={(e) => handleDeadlineTimeChange(e.target.value)}
                      disabled={isSavingDeadlineTime}
                      className="flex h-9 w-full rounded-xl border border-input bg-white/80 dark:bg-background/50 px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                    />
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <CalendarX2 className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  {request.deadline
                    ? request.deadline_time
                      ? `${format(new Date(request.deadline), "dd/MM/yyyy", { locale: ptBR })} às ${request.deadline_time}`
                      : format(new Date(request.deadline), "dd/MM/yyyy", { locale: ptBR })
                    : <span className="text-muted-foreground italic">Sem prazo</span>}
                </p>
              )}
            </div>
          </section>

          {/* 3. Atribuído a */}
          <section aria-labelledby="assignee-heading" className={sectionClass}>
            <h4 id="assignee-heading" className={sectionTitleClass}>
              Atribuído a
            </h4>
            <div className="flex items-center gap-3 min-w-0">
              {isAdmin && designers.length > 0 ? (
                <Select
                  value={request.assignee_id || "__none__"}
                  onValueChange={handleAssignDesigner}
                  disabled={isAssigning}
                >
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Selecione o designer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground italic">Não atribuído</span>
                    </SelectItem>
                    {designers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="flex items-center gap-2">
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={d.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(d.name)}
                            </AvatarFallback>
                          </Avatar>
                          {d.name} — {d.department}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : request.assignee_user ? (
                <>
                  <Avatar className="h-10 w-10 shrink-0 border-2 border-white/50 dark:border-[#101f2e]/50">
                    <AvatarImage src={request.assignee_user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-[#101f2e]/10 text-[#101f2e] dark:bg-white/10 dark:text-primary-foreground">
                      {getInitials(request.assignee_user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-medium text-sm truncate">{request.assignee_user.name}</p>
                </>
              ) : (
                <p className="font-medium text-sm text-muted-foreground italic">Não atribuído</p>
              )}
            </div>
          </section>

          {request.nome_advogado && (
            <section aria-labelledby="advogado-heading" className={sectionClass}>
              <h4 id="advogado-heading" className={sectionTitleClass}>Advogado</h4>
              <p className="text-sm">{request.nome_advogado}</p>
            </section>
          )}

          <section aria-labelledby="comments-heading" className={sectionClass}>
            <h4 id="comments-heading" className={`${sectionTitleClass} flex items-center gap-2`}>
              <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
              Comentários e alterações
            </h4>
            <p className="text-sm text-muted-foreground/90">
              Registre comentários ou alterações realizadas. Contabilizado como meta dos designers.
            </p>

            {profile && (
              <div className="space-y-3">
                <textarea
                  placeholder="Escreva um comentário ou descreva uma alteração..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  className="flex min-h-[80px] w-full resize-none rounded-xl border border-white/50 dark:border-border/50 bg-white/80 dark:bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                  disabled={submitCommentLoading}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAlteration}
                      onChange={(e) => setIsAlteration(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Edit3 className="h-4 w-4 opacity-70" />
                    Registrar como alteração
                  </label>
                  <Button
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!commentBody.trim() || submitCommentLoading}
                    className="rounded-full"
                  >
                    {submitCommentLoading ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </div>
            )}

            <div className="border-t border-border/20 pt-3 space-y-2">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground/80 italic">Nenhum comentário ainda.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {comments.map((c) => {
                    const isPendingAlteration = c.is_alteration && !c.resolved_at;
                    const isResolvedAlteration = c.is_alteration && !!c.resolved_at;
                    const canResolve = isPendingAlteration && profile && (isAdmin || profile.id === request?.assignee_id);
                    return (
                      <li
                        key={c.id}
                        className={`flex gap-3 rounded-xl p-3 border transition-colors ${
                          isPendingAlteration
                            ? "bg-amber-50/80 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30"
                            : isResolvedAlteration
                            ? "bg-emerald-50/60 dark:bg-emerald-950/15 border-emerald-200/40 dark:border-emerald-800/20"
                            : "bg-white/50 dark:bg-background/40 border-white/30 dark:border-border/30"
                        }`}
                      >
                        <Avatar className="h-8 w-8 shrink-0 border-2 border-white dark:border-background">
                          <AvatarImage src={c.user_avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-[#101f2e]/10 text-[#101f2e] dark:bg-white/10">
                            {c.user_name ? getInitials(c.user_name) : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium">{c.user_name ?? "Usuário"}</span>
                              {c.is_alteration && (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                                  isResolvedAlteration
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                                }`}>
                                  {isResolvedAlteration
                                    ? <><CheckCircle2 className="h-3 w-3" aria-hidden /> Resolvida</>
                                    : <><AlertCircle className="h-3 w-3" aria-hidden /> Alteração pendente</>
                                  }
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {canResolve && (
                                <button
                                  type="button"
                                  onClick={() => handleResolveAlteration(c.id)}
                                  className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/30 hover:bg-emerald-200/80 dark:hover:bg-emerald-900/40 rounded-full px-2.5 py-1 transition-colors"
                                  aria-label="Marcar alteração como resolvida"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                  Resolver
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(c.id)}
                                  disabled={deletingCommentId === c.id}
                                  className="p-1.5 rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-100/80 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                                  aria-label="Excluir comentário"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground/90 mt-1 whitespace-pre-wrap break-words">
                            {c.body}
                          </p>
                          {isResolvedAlteration && (
                            <p className="text-[10px] text-emerald-600/80 dark:text-emerald-500/70 mt-1 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                              Resolvida por{" "}
                              <span className="font-medium">{c.resolved_by_user_name ?? "usuário"}</span>
                              {" "}em {format(new Date(c.resolved_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Timesheet — full width, always visible for admin or assignee */}
          {canUseTimesheet && (
            <section aria-labelledby="timesheet-heading" className={sectionClass}>
              <h4 id="timesheet-heading" className={sectionTitleClass}>Timesheet</h4>
              <div className="space-y-4">
                {/* Live stopwatch block */}
                {activeEntry ? (
                  <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 px-4 py-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                      </span>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400 leading-none mb-0.5">
                          Registrando
                        </p>
                        <p className="font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300 leading-none">
                          {liveElapsed}
                        </p>
                      </div>
                    </div>
                    {/* Controls — own dedicated row */}
                    {canStartTimer && (
                      <div className="flex gap-2 pt-1 border-t border-emerald-200/50 dark:border-emerald-800/30">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePause}
                          disabled={timer.isLoading}
                          className="flex-1 h-8 rounded-lg text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40"
                        >
                          <Pause className="h-3.5 w-3.5 mr-1.5 fill-current" />
                          Pausar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleEnd}
                          disabled={timer.isLoading}
                          className="flex-1 h-8 rounded-lg text-red-700 hover:bg-red-100 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
                          Finalizar
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  canStartTimer && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStart}
                      disabled={timer.isLoading}
                      className="w-full rounded-xl border-[#101f2e]/20 hover:bg-[#101f2e]/5 text-[#101f2e] dark:border-white/20 dark:hover:bg-white/5 dark:text-primary-foreground"
                    >
                      <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                      Iniciar cronômetro
                    </Button>
                  )
                )}

                {/* History */}
                {timeEntries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Total acumulado: {totalDurationForEntries(timeEntries)}
                    </p>
                    <ul className="space-y-1.5">
                      {timeEntries.map((e) => (
                        <li key={e.id} className="flex items-center gap-2.5 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                          {/* User avatar */}
                          <Avatar className="h-5 w-5 shrink-0 border border-white/50">
                            <AvatarImage src={e.user_avatar_url || undefined} />
                            <AvatarFallback className="text-[9px] bg-[#101f2e]/10 text-[#101f2e] dark:bg-white/10">
                              {e.user_name ? getInitials(e.user_name) : "?"}
                            </AvatarFallback>
                          </Avatar>
                          {/* Name */}
                          <span className="font-medium text-foreground/80 truncate flex-1">
                            {e.user_name ?? "Usuário"}
                          </span>
                          {/* Date */}
                          <span className="shrink-0">
                            {format(new Date(e.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          {/* Duration */}
                          <span className={`font-mono font-semibold tabular-nums shrink-0 ${!e.ended_at ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                            {!e.ended_at ? liveElapsed : formatDuration(e.started_at, e.ended_at)}
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTimeEntry(e.id)}
                              disabled={deletingEntryId === e.id}
                              className="p-1 rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-100/80 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50 shrink-0"
                              aria-label="Excluir registro de tempo"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {timeEntries.length === 0 && !canStartTimer && (
                  <p className="text-xs text-muted-foreground italic">Nenhum registro de tempo ainda.</p>
                )}
              </div>
            </section>
          )}

          {/* Marcar como concluído — full width, below timesheet */}
          {!isConcluido && (
            <section aria-labelledby="complete-heading" className={sectionClass}>
              <h4 id="complete-heading" className={sectionTitleClass}>Marcar como concluído</h4>
              <div className="flex gap-2">
                <Select value={completionType} onValueChange={setCompletionType}>
                  <SelectTrigger className="flex-1 min-w-0">
                    <SelectValue placeholder="Tipo de conclusão" />
                  </SelectTrigger>
                  <SelectContent>
                    {completionOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleMarkComplete}
                  disabled={isMarkingComplete}
                  size="sm"
                  className="shrink-0"
                >
                  Concluir
                </Button>
              </div>
            </section>
          )}

          {/* Excluir solicitação (admin) */}
          {isAdmin && (
            <section className={sectionClass}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteRequestConfirmOpen(true)}
                disabled={isDeletingRequest}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4 mr-2" aria-hidden />
                Excluir solicitação
              </Button>
            </section>
          )}

          {/* Origem VIOS — quando a solicitação veio de uma tarefa VIOS */}
          {viosTask && (
            <section aria-labelledby="vios-origin-heading" className={sectionClass}>
              <h4 id="vios-origin-heading" className={sectionTitleClass}>Origem VIOS</h4>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground/80">CI</span>
                    <span className="ml-1.5 font-mono">{viosTask.vios_id}</span>
                  </div>
                  {viosTask.etiquetas_tarefa && (
                    <div>
                      <span className="font-medium text-foreground/80">Etiqueta</span>
                      <span className="ml-1.5">{viosTask.etiquetas_tarefa}</span>
                    </div>
                  )}
                  {viosTask.area_processo && (
                    <div>
                      <span className="font-medium text-foreground/80">Área</span>
                      <span className="ml-1.5">{viosTask.area_processo}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-foreground/80">Responsáveis</span>
                    <span className="ml-1.5">{filterLeonardoFromResponsaveis(viosTask.responsaveis) || "—"}</span>
                  </div>
                  {viosTask.data_limite && (
                    <div>
                      <span className="font-medium text-foreground/80">Data limite</span>
                      <span className="ml-1.5">{format(new Date(viosTask.data_limite + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                  )}
                  {viosTask.data_conclusao && (
                    <div>
                      <span className="font-medium text-foreground/80">Data conclusão</span>
                      <span className="ml-1.5">{format(new Date(viosTask.data_conclusao), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                  )}
                </div>
                {viosTask.tarefa && (
                  <div>
                    <span className="font-medium text-foreground/80 block mb-1">Link do texto (Word)</span>
                    {/^https?:\/\//i.test(viosTask.tarefa.trim()) ? (
                      <a
                        href={viosTask.tarefa.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary hover:underline break-all"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        {viosTask.tarefa.trim()}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 break-all">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {viosTask.tarefa}
                      </span>
                    )}
                  </div>
                )}
                {viosTask.descricao && (
                  <div>
                    <span className="font-medium text-foreground/80 block mb-1">Descrição</span>
                    <p className="text-muted-foreground whitespace-pre-wrap">{viosTask.descricao}</p>
                  </div>
                )}
                {viosTask.historico && (
                  <div>
                    <span className="font-medium text-foreground/80 block mb-1">Histórico</span>
                    <p className="text-muted-foreground whitespace-pre-wrap">{viosTask.historico}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Activity log */}
          {activityLog.length > 0 && (
            <section aria-labelledby="activity-heading" className={sectionClass}>
              <h4 id="activity-heading" className={sectionTitleClass}>Histórico de Movimentações</h4>
              <ol className="space-y-2">
                {activityLog.map((entry) => {
                  const stageLabels: Record<string, string> = {
                    tarefas: "Tarefas", revisao: "Revisão", revisado: "Revisado",
                    revisao_autor: "Revisão Autor", concluido: "Concluído",
                  };
                  const from = stageLabels[entry.from_value ?? ""] ?? entry.from_value ?? "—";
                  const to = stageLabels[entry.to_value ?? ""] ?? entry.to_value ?? "—";
                  return (
                    <li key={entry.id} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#101f2e]/30 dark:bg-white/30 mt-1" />
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">{entry.user_name ?? "Sistema"}</span>
                        {" moveu de "}
                        <span className="font-medium text-[#101f2e] dark:text-white/80">{from}</span>
                        {" → "}
                        <span className="font-medium text-[#101f2e] dark:text-white/80">{to}</span>
                        <span className="text-muted-foreground ml-1.5">
                          · {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>
      </DialogContent>

      {/* Confirmação de exclusão da solicitação */}
      <Dialog open={deleteRequestConfirmOpen} onOpenChange={(open) => { if (!open) setDeleteRequestError(null); setDeleteRequestConfirmOpen(open); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Excluir solicitação</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. A solicitação e todos os comentários e registros de tempo serão removidos.
            </DialogDescription>
          </DialogHeader>
          {deleteRequestError && (
            <p className="text-sm text-destructive" role="alert">{deleteRequestError}</p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteRequestConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRequest}
              disabled={isDeletingRequest}
            >
              {isDeletingRequest ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
