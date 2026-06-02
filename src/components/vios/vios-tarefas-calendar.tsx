"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Send, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AreaWithIcon } from "@/components/solicitacoes/area-with-icon";
import { ViosTaskPairInfo } from "@/components/vios/vios-task-pair-info";
import { ViosProrrogacaoBadge } from "@/components/vios/vios-prorrogacao-badge";
import {
  fetchViosTasks,
  canSendToPlanner,
  getViosEntregaSituacao,
  formatViosAtrasoLabel,
  filterLeonardoFromResponsaveis,
  type ViosEntregaSituacao,
  type ViosTask,
} from "@/lib/vios-tasks";
import { cn } from "@/lib/utils";

const ETIQUETA_STYLE: Record<string, string> = {
  PROTOCOLO: "bg-blue-100 text-blue-800 border-blue-200",
  REVISAR: "bg-violet-100 text-violet-800 border-violet-200",
  "PROVIDÊNCIA": "bg-slate-100 text-slate-700 border-slate-200",
};

const ETIQUETA_RING: Record<string, string> = {
  PROTOCOLO: "ring-blue-400",
  REVISAR: "ring-violet-400",
  "PROVIDÊNCIA": "ring-slate-400",
};

const SITUACAO_LABEL: Record<ViosEntregaSituacao, string> = {
  aguardando: "No prazo",
  atrasada: "Atrasada",
  no_prazo: "Entregue no prazo",
  entregue_atrasada: "Entregue com atraso",
  sem_prazo: "Sem prazo",
};

export interface ViosCalendarFilters {
  status?: string;
  etiqueta?: string;
  area?: string;
  dataFrom?: string;
  dataTo?: string;
  assigneeId?: string;
  jaNoPlanner?: boolean;
  situacaoEntrega?: ViosEntregaSituacao;
  ci?: string;
}

interface ViosTarefasCalendarProps {
  filters: ViosCalendarFilters;
  onEnviarPlanner: (task: ViosTask) => void;
}

function taskEtiquetaClass(etiqueta: string | null): string {
  if (!etiqueta) return "bg-muted text-muted-foreground border-border";
  return ETIQUETA_STYLE[etiqueta] ?? "bg-muted text-muted-foreground border-border";
}

function getCollaboratorDisplay(task: ViosTask): { name: string; avatarUrl: string | null } {
  const fromResponsaveis = filterLeonardoFromResponsaveis(task.responsaveis)
    ?.split(/\s*\|\s*/)[0]
    ?.trim();
  return {
    name: task.assignee_name ?? fromResponsaveis ?? "?",
    avatarUrl: task.assignee_avatar_url ?? null,
  };
}

function collaboratorInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function TaskCollaboratorAvatar({
  task,
  size = "sm",
}: {
  task: ViosTask;
  size?: "sm" | "md";
}) {
  const { name, avatarUrl } = getCollaboratorDisplay(task);
  const ring =
    ETIQUETA_RING[task.etiquetas_tarefa ?? ""] ?? "ring-border";
  const atrasada = getViosEntregaSituacao(task) === "atrasada";
  const dim = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const text = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <Avatar
      className={cn(
        dim,
        "ring-2 shrink-0",
        ring,
        atrasada && "ring-red-500"
      )}
      title={`${name} — CI ${task.vios_id} (${task.etiquetas_tarefa ?? "sem etiqueta"})`}
    >
      <AvatarImage src={avatarUrl || undefined} alt={name} />
      <AvatarFallback className={cn(text, "font-medium")}>
        {collaboratorInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function ViosTarefasCalendar({ filters, onEnviarPlanner }: ViosTarefasCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [tasks, setTasks] = useState<ViosTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => new Date());

  const loadCalendarTasks = useCallback(async () => {
    setLoading(true);
    const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

    const dataFrom =
      filters.dataFrom && filters.dataFrom > monthStart ? filters.dataFrom : monthStart;
    const dataTo =
      filters.dataTo && filters.dataTo < monthEnd ? filters.dataTo : monthEnd;

    const { tasks: rows } = await fetchViosTasks({
      limit: 500,
      offset: 0,
      status: filters.status,
      etiqueta: filters.etiqueta,
      area: filters.area,
      dataFrom,
      dataTo,
      assigneeId: filters.assigneeId,
      jaNoPlanner: filters.jaNoPlanner,
      situacaoEntrega: filters.situacaoEntrega,
      ci: filters.ci,
      orderBy: "data_limite_asc",
    });

    setTasks(rows.filter((t) => t.data_limite));
    setLoading(false);
  }, [month, filters]);

  useEffect(() => {
    loadCalendarTasks();
  }, [loadCalendarTasks]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, ViosTask[]>();
    for (const task of tasks) {
      if (!task.data_limite) continue;
      const key = task.data_limite;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedDayKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedTasks = selectedDayKey ? tasksByDay.get(selectedDayKey) ?? [] : [];

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-semibold capitalize min-w-[160px] text-center">
            {format(month, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              const today = new Date();
              setMonth(startOfMonth(today));
              setSelectedDay(today);
            }}
          >
            Hoje
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full ring-2 ring-blue-400 bg-muted" /> PROTOCOLO
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full ring-2 ring-violet-400 bg-muted" /> REVISAR
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full ring-2 ring-slate-400 bg-muted" /> PROVIDÊNCIA
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full ring-2 ring-red-500 bg-muted" /> Atrasada
          </span>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-sm p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-sm shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)] overflow-hidden p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-px mb-1">
              {weekDays.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayTasks = tasksByDay.get(key) ?? [];
                const inMonth = isSameMonth(day, month);
                const selected = selectedDay ? isSameDay(day, selectedDay) : false;
                const hasAtrasada = dayTasks.some(
                  (t) => getViosEntregaSituacao(t) === "atrasada"
                );

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "min-h-[88px] rounded-lg border p-1.5 text-left transition hover:border-primary/40 hover:bg-white/90",
                      inMonth ? "bg-white/50" : "bg-muted/20 opacity-50",
                      selected && "ring-2 ring-primary/50 border-primary/30 bg-white",
                      hasAtrasada && inMonth && "border-red-200 bg-red-50/40"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday(day) && "bg-primary text-primary-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-0.5 items-center">
                      {dayTasks.slice(0, 6).map((task) => (
                        <TaskCollaboratorAvatar key={task.id} task={task} size="sm" />
                      ))}
                      {dayTasks.length > 6 && (
                        <span
                          className="flex h-6 min-w-6 px-1 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground"
                          title={`Mais ${dayTasks.length - 6} tarefa(s)`}
                        >
                          +{dayTasks.length - 6}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-sm shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)] p-4 min-h-[280px]">
            <h4 className="text-sm font-semibold mb-3">
              {selectedDay
                ? format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })
                : "Selecione um dia"}
            </h4>
            {selectedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa com prazo neste dia.</p>
            ) : (
              <ul className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {selectedTasks.map((task) => {
                  const situacao = getViosEntregaSituacao(task);
                  const collaborator = getCollaboratorDisplay(task);
                  const atrasoLabel = formatViosAtrasoLabel(task);
                  return (
                    <li
                      key={task.id}
                      className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <TaskCollaboratorAvatar task={task} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{collaborator.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">CI {task.vios_id}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] shrink-0", taskEtiquetaClass(task.etiquetas_tarefa))}
                        >
                          {task.etiquetas_tarefa ?? "—"}
                        </Badge>
                      </div>
                      <AreaWithIcon area={task.area_processo ?? "—"} />
                      <ViosProrrogacaoBadge task={task} />
                      <ViosTaskPairInfo task={task} compact />
                      {atrasoLabel && (
                        <p
                          className={cn(
                            "flex items-center gap-1.5 text-xs font-medium",
                            situacao === "atrasada" || situacao === "entregue_atrasada"
                              ? "text-red-600"
                              : situacao === "no_prazo"
                                ? "text-emerald-600"
                                : "text-muted-foreground"
                          )}
                        >
                          {situacao === "atrasada" || situacao === "entregue_atrasada" ? (
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                          ) : situacao === "no_prazo" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 shrink-0 opacity-60" />
                          )}
                          {atrasoLabel}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          variant={
                            situacao === "atrasada" || situacao === "entregue_atrasada"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {SITUACAO_LABEL[situacao]}
                        </Badge>
                        {task.status === "concluido" && (
                          <Badge className="text-[10px] bg-emerald-600">Concluída</Badge>
                        )}
                      </div>
                      {canSendToPlanner(task) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs w-full"
                          onClick={() => onEnviarPlanner(task)}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Enviar ao Planner
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
