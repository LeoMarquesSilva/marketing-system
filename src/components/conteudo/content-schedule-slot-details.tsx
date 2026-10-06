"use client";

import { useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  ExternalLink,
  FileText,
  Film,
  Link2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { collaboratorMatchesScheduleArea } from "@/lib/content-schedule/domain";
import { CollaboratorAvatar, CollaboratorMark } from "./content-schedule-visuals";
import type {
  ScheduleCollaborator,
  ScheduleSlotView,
  ScheduleStatus,
} from "./content-schedule-ui-types";

const STATUS_LABELS: Record<ScheduleStatus, string> = {
  open: "Sem responsável",
  assigned: "Atribuído",
  linked: "Com conteúdo",
  published: "Publicado",
  cancelled: "Cancelado",
};

export type ScheduleAssignmentFeedback = {
  type: "error" | "success";
  message: string;
};

function fullDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function publicationDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function compactNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value ?? 0);
}

function PersonSelect({
  label,
  emptyLabel,
  value,
  selected,
  people,
  disabled,
  onChange,
}: {
  label: string;
  emptyLabel: string;
  value: string;
  selected: ScheduleCollaborator | null;
  people: ScheduleCollaborator[];
  disabled: boolean;
  onChange: (collaboratorId: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full" aria-label={label}>
        {selected ? (
          <CollaboratorMark person={selected} />
        ) : (
          <span className="flex items-center gap-2 text-slate-500">
            <span className="flex size-7 items-center justify-center rounded-full bg-slate-100"><CircleUserRound className="size-4" aria-hidden /></span>
            {emptyLabel}
          </span>
        )}
      </SelectTrigger>
      <SelectContent align="start" className="min-w-[260px]">
        <SelectItem value="unassigned">
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white"><CircleUserRound className="size-4 text-slate-400" aria-hidden /></span>
            {emptyLabel}
          </span>
        </SelectItem>
        {people.map((person) => (
          <SelectItem value={person.id} key={person.id} className="py-2">
            <CollaboratorMark person={person} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-slate-200 py-5 last:border-b-0">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
        <Icon className="size-4" aria-hidden />
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function ContentScheduleSlotDetails({
  slot,
  open,
  onOpenChange,
  collaborators,
  canAssign,
  saving,
  onAssign,
  onAssignSecond = () => undefined,
  canManageVios = false,
  viosSaving = false,
  onViosChange = () => undefined,
  assignmentFeedback = null,
}: {
  slot: ScheduleSlotView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborators: ScheduleCollaborator[];
  canAssign: boolean;
  saving: boolean;
  onAssign: (collaboratorId: string) => void;
  onAssignSecond?: (collaboratorId: string) => void;
  canManageVios?: boolean;
  viosSaving?: boolean;
  onViosChange?: (viosTaskId: string | null) => void;
  assignmentFeedback?: ScheduleAssignmentFeedback | null;
}) {
  const [viosSelection, setViosSelection] = useState({ slotId: "", taskId: "" });
  const selectedViosId = slot && viosSelection.slotId === slot.id
    ? viosSelection.taskId
    : "";
  const availableCollaborators = slot
    ? collaborators.filter((person) =>
        !person.area || collaboratorMatchesScheduleArea(person.area, slot.area)
      )
    : [];
  const canEditAssignment = canAssign && slot?.status !== "cancelled";

  return (
    <Sheet open={open && Boolean(slot)} onOpenChange={onOpenChange}>
      {slot ? (
        <SheetContent className="w-full border-slate-200 bg-white sm:max-w-lg">
          <SheetHeader className="border-slate-200 bg-slate-50">
            <SheetTitle>Detalhes da entrega</SheetTitle>
            <SheetDescription className="capitalize">
              {fullDate(slot.date)}
            </SheetDescription>
            {slot.plannedDate ? (
              <p className="text-xs text-slate-500">
                Remarcada no VIOS. Data planejada: {publicationDate(`${slot.plannedDate}T12:00:00`)}
              </p>
            ) : null}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6">
            {assignmentFeedback ? (
              <div
                role={assignmentFeedback.type === "error" ? "alert" : "status"}
                className={`mt-5 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${assignmentFeedback.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
              >
                {assignmentFeedback.type === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
                <span>{assignmentFeedback.message}</span>
              </div>
            ) : null}
            <DetailSection title="Planejamento" icon={CalendarDays}>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Área</dt>
                  <dd className="mt-1 font-medium text-slate-900">{slot.area}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Formato</dt>
                  <dd className="mt-1 flex items-center gap-1.5 font-medium text-slate-900">
                    {slot.format === "reel" ? <Film className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
                    {slot.format === "reel" ? "Reel" : "Post"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Situação</dt>
                  <dd className="mt-1"><Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{STATUS_LABELS[slot.status]}</Badge></dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Origem da planilha</dt>
                  <dd className="mt-1 text-slate-700">
                    {slot.sourceStatus || slot.sourceName ? (
                      <>{slot.sourceStatus || "Histórico"}{slot.sourceName ? <span className="block text-xs text-slate-500">Nome original: {slot.sourceName}</span> : null}</>
                    ) : "Sem origem registrada"}
                  </dd>
                </div>
              </dl>
            </DetailSection>

            <DetailSection title={slot.coCollaborator ? "Responsáveis" : "Responsável"} icon={CircleUserRound}>
              {slot.collaborator ? (
                <div className="space-y-3">
                  {[slot.collaborator, slot.coCollaborator].filter((person): person is ScheduleCollaborator => Boolean(person)).map((person) => (
                    <div key={person.id} className="flex items-center gap-3 text-sm">
                      <CollaboratorAvatar person={person} className="size-9" />
                      <div>
                        <p className="font-medium text-slate-900">{person.name}</p>
                        <p className="text-xs text-slate-500">{person.area || slot.area}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">{slot.unmatchedAssigneeName || "A definir"}</p>
              )}

              {canEditAssignment && slot.content ? (
                <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
                  O responsável não pode ser trocado após o vínculo do conteúdo.
                </p>
              ) : canEditAssignment ? (
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Trocar responsável</span>
                  <PersonSelect
                    label="Trocar responsável"
                    emptyLabel="Sem responsável"
                    value={slot.collaboratorId ?? "unassigned"}
                    selected={slot.collaborator ?? null}
                    people={availableCollaborators}
                    disabled={saving}
                    onChange={onAssign}
                  />
                </div>
              ) : null}

              {canEditAssignment && slot.collaboratorId ? (
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Gravou junto (opcional)</span>
                  <PersonSelect
                    label="Segunda pessoa"
                    emptyLabel="Sem segunda pessoa"
                    value={slot.coCollaboratorId ?? "unassigned"}
                    selected={slot.coCollaborator ?? null}
                    people={availableCollaborators.filter((person) => person.id !== slot.collaboratorId)}
                    disabled={saving}
                    onChange={onAssignSecond}
                  />
                </div>
              ) : null}
            </DetailSection>

            <DetailSection title="Conteúdo" icon={FileText}>
              {slot.content ? (
                <a
                  href={slot.content.url ?? `/conteudo/roteiros?contentId=${slot.content.id}`}
                  className="text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-600"
                >
                  {slot.content.title}
                </a>
              ) : <p className="text-sm text-slate-500">Tema ainda não escolhido</p>}
            </DetailSection>

            <DetailSection title="VIOS" icon={Link2}>
              {slot.viosTask ? (
                <div className="space-y-3 text-sm">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono font-semibold text-slate-900">CI {slot.viosTask.ci}</p>
                      {slot.viosLinkOrigin ? (
                        <Badge variant="outline" className="text-[10px]">
                          {slot.viosLinkOrigin === "manual" ? "Revisado manualmente" : "Vinculado automaticamente"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="font-medium text-slate-800">{slot.viosTask.title || "Tarefa sem título"}</p>
                    <p className="text-slate-500">{slot.viosTask.status || "Sem situação informada"}</p>
                    {slot.viosTask.assigneeName ? <p className="text-xs text-slate-500">Responsável: {slot.viosTask.assigneeName}</p> : null}
                  </div>
                  {canManageVios ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={viosSaving}
                      onClick={() => onViosChange(null)}
                    >
                      {viosSaving ? <Loader2 className="animate-spin" /> : <Link2 />}
                      Desvincular
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-amber-700">Vínculo VIOS pendente</p>
                  {canManageVios && (slot.viosCandidates?.length ?? 0) > 0 ? (
                    <>
                      <Select
                        value={selectedViosId}
                        onValueChange={(taskId) => setViosSelection({ slotId: slot.id, taskId })}
                        disabled={viosSaving}
                      >
                        <SelectTrigger className="w-full" aria-label="Selecionar tarefa VIOS">
                          <span className="truncate">
                            {selectedViosId
                              ? `CI ${slot.viosCandidates?.find((task) => task.id === selectedViosId)?.ci ?? ""}`
                              : "Escolher tarefa PROTOCOLO"}
                          </span>
                        </SelectTrigger>
                        <SelectContent align="start" className="min-w-[320px]">
                          {(slot.viosCandidates ?? []).map((task) => (
                            <SelectItem key={task.id} value={task.id}>
                              <span className="flex flex-col">
                                <span className="font-mono text-xs">CI {task.ci} · {task.dueDate ? fullDate(task.dueDate) : "sem data"}</span>
                                <span className="text-xs text-slate-500">{task.assigneeName || "Sem responsável identificado"}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!selectedViosId || viosSaving}
                        onClick={() => onViosChange(selectedViosId)}
                      >
                        {viosSaving ? <Loader2 className="animate-spin" /> : <Link2 />}
                        Vincular tarefa
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {canManageVios
                        ? "Nenhuma tarefa PROTOCOLO compatível foi encontrada na janela de 14 dias."
                        : "A associação será revisada pelo Marketing."}
                    </p>
                  )}
                </div>
              )}
            </DetailSection>

            <DetailSection title="Publicação e métricas" icon={BarChart3}>
              {slot.publication ? (
                <div className="space-y-2 text-sm">
                  {slot.publication.publishedAt ? <p className="text-slate-500">Publicada em {publicationDate(slot.publication.publishedAt)}</p> : null}
                  {slot.publication.permalink ? (
                    <a href={slot.publication.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-slate-800 underline decoration-slate-300 underline-offset-4">
                      Ver publicação <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : null}
                  <p className="font-mono text-xs text-slate-600">
                    {compactNumber(slot.publication.reach)} alcance · {compactNumber(slot.publication.likes)} curtidas · {compactNumber(slot.publication.comments)} comentários
                  </p>
                </div>
              ) : <p className="text-sm text-slate-500">Ainda não publicada</p>}
            </DetailSection>
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
