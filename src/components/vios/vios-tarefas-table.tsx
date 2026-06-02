"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Loader2, Pencil, Check, X, Send, CalendarX2, CheckCircle2, AlertCircle, Search, List, CalendarDays } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AreaWithIcon } from "@/components/solicitacoes/area-with-icon";
import type { ViosTask } from "@/lib/vios-tasks";
import type { User } from "@/lib/users";
import Link from "next/link";
import {
  fetchViosTasks,
  fetchViosTaskStats,
  updateViosTaskAssignee,
  updateViosTaskResponsaveis,
  canSendToPlanner,
  getViosEntregaSituacao,
  isEntregueNoPrazo,
  filterLeonardoFromResponsaveis,
  type ViosTaskStats,
  type ViosEntregaSituacao,
} from "@/lib/vios-tasks";
import { EnviarViosAoPlannerDialog } from "@/components/vios/enviar-vios-ao-planner-dialog";
import { ViosTarefasCalendar } from "@/components/vios/vios-tarefas-calendar";
import { ViosTaskPairInfo } from "@/components/vios/vios-task-pair-info";
import { ViosProrrogacaoBadge } from "@/components/vios/vios-prorrogacao-badge";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

const ETIQUETA_HINT: Record<string, string> = {
  "PROVIDÊNCIA": "Ciência do agendamento (fluxo antigo — advogado toma ciência da data)",
  PROTOCOLO: "Prazo do colaborador entregar o material para revisão",
  REVISAR: "Revisão do gestor após o envio do material",
};

const SITUACAO_LABEL: Record<ViosEntregaSituacao, string> = {
  aguardando: "No prazo",
  atrasada: "Atrasada",
  no_prazo: "Entregue no prazo",
  entregue_atrasada: "Entregue com atraso",
  sem_prazo: "Sem prazo",
};

function isAtrasada(task: ViosTask): boolean {
  return getViosEntregaSituacao(task) === "atrasada";
}

function needsAssigneeLink(task: ViosTask): boolean {
  return !task.assignee_id;
}

interface ViosTarefasTableProps {
  etiquetas: string[];
  areas: string[];
  users: User[];
  designers: User[];
}

export function ViosTarefasTable({ etiquetas, areas, users, designers }: ViosTarefasTableProps) {
  const [tasks, setTasks] = useState<ViosTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<Record<string, string>>({});
  const [editingResponsaveisId, setEditingResponsaveisId] = useState<string | null>(null);
  const [editResponsaveisValue, setEditResponsaveisValue] = useState("");
  const [savingResponsaveisId, setSavingResponsaveisId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [etiquetaFilter, setEtiquetaFilter] = useState<string>("__all__");
  const [areaFilter, setAreaFilter] = useState<string>("__all__");
  const [dataFrom, setDataFrom] = useState("");
  const [dataTo, setDataTo] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("__all__");
  const [jaNoPlannerFilter, setJaNoPlannerFilter] = useState<string>("__all__");
  const [orderBy, setOrderBy] = useState<string>("data_limite_asc");
  const [situacaoFilter, setSituacaoFilter] = useState<string>("__all__");
  const [ciInput, setCiInput] = useState("");
  const [ciFilter, setCiFilter] = useState("");
  const [stats, setStats] = useState<ViosTaskStats | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [enviarPlannerTask, setEnviarPlannerTask] = useState<ViosTask | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");

  const calendarFilters = {
    status: statusFilter || undefined,
    etiqueta: etiquetaFilter === "__all__" ? undefined : etiquetaFilter,
    area: areaFilter === "__all__" ? undefined : areaFilter,
    dataFrom: dataFrom || undefined,
    dataTo: dataTo || undefined,
    assigneeId: assigneeFilter === "__all__" ? undefined : assigneeFilter,
    jaNoPlanner:
      jaNoPlannerFilter === "__all__"
        ? undefined
        : jaNoPlannerFilter === "sim",
    situacaoEntrega:
      situacaoFilter === "__all__"
        ? undefined
        : (situacaoFilter as ViosEntregaSituacao),
    ci: ciFilter || undefined,
  };

  const loadTasks = useCallback(
    async (offset: number, append: boolean) => {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      const { tasks: nextTasks, total: nextTotal } = await fetchViosTasks({
        limit: PAGE_SIZE,
        offset,
        status: statusFilter || undefined,
        etiqueta: etiquetaFilter === "__all__" ? undefined : etiquetaFilter,
        area: areaFilter === "__all__" ? undefined : areaFilter,
        dataFrom: dataFrom || undefined,
        dataTo: dataTo || undefined,
        assigneeId: assigneeFilter === "__all__" ? undefined : assigneeFilter,
        jaNoPlanner:
          jaNoPlannerFilter === "__all__"
            ? undefined
            : jaNoPlannerFilter === "sim",
        situacaoEntrega:
          situacaoFilter === "__all__"
            ? undefined
            : (situacaoFilter as ViosEntregaSituacao),
        ci: ciFilter || undefined,
        orderBy: orderBy as "data_limite_asc" | "data_limite_desc" | "data_conclusao_desc" | "area",
      });
      setTasks((prev) => (append ? [...prev, ...nextTasks] : nextTasks));
      setTotal(nextTotal);
      setLoading(false);
      setLoadingMore(false);
      fetchViosTaskStats().then(setStats);
    },
    [
      statusFilter,
      etiquetaFilter,
      areaFilter,
      dataFrom,
      dataTo,
      assigneeFilter,
      jaNoPlannerFilter,
      orderBy,
      situacaoFilter,
      ciFilter,
    ]
  );

  function handleCiSearch() {
    setCiFilter(ciInput.trim());
  }

  function handleCiClear() {
    setCiInput("");
    setCiFilter("");
  }

  useEffect(() => {
    if (viewMode === "table") {
      loadTasks(0, false);
    } else {
      fetchViosTaskStats().then(setStats);
    }
  }, [loadTasks, viewMode]);

  const hasMore = tasks.length < total;

  async function handleLink(task: ViosTask) {
    const userId = selectedUser[task.vios_id];
    if (!userId) return;
    setLinkingId(task.vios_id);
    const { error } = await updateViosTaskAssignee(
      task.vios_id,
      userId || null
    );
    setLinkingId(null);
    if (!error) {
      const u = userId ? users.find((u) => u.id === userId) : null;
      setTasks((prev) =>
        prev.map((t) =>
          t.vios_id === task.vios_id
            ? {
                ...t,
                assignee_id: userId || null,
                assignee_name: u?.name ?? null,
                assignee_avatar_url: u?.avatar_url ?? null,
              }
            : t
        )
      );
      setSelectedUser((prev) => {
        const next = { ...prev };
        delete next[task.vios_id];
        return next;
      });
    }
  }

  function startEditResponsaveis(task: ViosTask) {
    setEditingResponsaveisId(task.vios_id);
    setEditResponsaveisValue(filterLeonardoFromResponsaveis(task.responsaveis) ?? "");
  }

  function cancelEditResponsaveis() {
    setEditingResponsaveisId(null);
    setEditResponsaveisValue("");
  }

  async function saveResponsaveis(task: ViosTask) {
    setSavingResponsaveisId(task.vios_id);
    const valorFiltrado = filterLeonardoFromResponsaveis(editResponsaveisValue.trim() || null);
    const { error } = await updateViosTaskResponsaveis(
      task.vios_id,
      valorFiltrado ?? ""
    );
    setSavingResponsaveisId(null);
    if (!error) {
      setTasks((prev) =>
        prev.map((t) =>
          t.vios_id === task.vios_id
            ? { ...t, responsaveis: valorFiltrado ?? null }
            : t
        )
      );
      setEditingResponsaveisId(null);
      setEditResponsaveisValue("");
    }
  }

  function handleOpenEnviarPlanner(task: ViosTask) {
    setPromoteError(null);
    setEnviarPlannerTask(task);
  }

  function handleEnviarPlannerSuccess(requestId: string) {
    if (enviarPlannerTask) {
      const pairedId = enviarPlannerTask.paired_task?.vios_id;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.vios_id === enviarPlannerTask.vios_id) {
            return { ...t, marketing_request_id: requestId };
          }
          if (pairedId && t.vios_id === pairedId) {
            return { ...t, marketing_request_id: requestId };
          }
          if (t.paired_task?.vios_id === enviarPlannerTask.vios_id) {
            return {
              ...t,
              paired_task: t.paired_task
                ? { ...t.paired_task, marketing_request_id: requestId }
                : null,
            };
          }
          return t;
        })
      );
    }
    setEnviarPlannerTask(null);
  }

  return (
    <div className="space-y-4">
      {promoteError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {promoteError}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            {
              label: "Aguardando advogado",
              value: stats.aguardando,
              filter: "aguardando",
              className: "border-slate-200 bg-slate-50/80",
            },
            {
              label: "Atrasadas",
              value: stats.atrasadas,
              filter: "atrasada",
              className: "border-red-200 bg-red-50/80",
            },
            {
              label: "Entregue no prazo",
              value: stats.concluidasNoPrazo,
              filter: "no_prazo",
              className: "border-emerald-200 bg-emerald-50/80",
            },
            {
              label: "Entregue com atraso",
              value: stats.concluidasAtrasadas,
              filter: "entregue_atrasada",
              className: "border-amber-200 bg-amber-50/80",
            },
            {
              label: "Prontas p/ Planner",
              value: stats.prontasPlanner,
              filter: "__planner__",
              className: "border-blue-200 bg-blue-50/80",
            },
            {
              label: "Total",
              value: stats.total,
              filter: "__all__",
              className: "border-white/60 bg-white/70",
            },
          ].map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                if (card.filter === "__planner__") {
                  setSituacaoFilter("__all__");
                  setStatusFilter("");
                  setJaNoPlannerFilter("nao");
                  return;
                }
                setSituacaoFilter(card.filter);
                if (card.filter === "no_prazo" || card.filter === "entregue_atrasada") {
                  setStatusFilter("concluido");
                } else if (card.filter === "atrasada" || card.filter === "aguardando") {
                  setStatusFilter("");
                }
              }}
              className={cn(
                "rounded-xl border p-3 text-left transition hover:shadow-sm",
                card.className,
                situacaoFilter === card.filter && "ring-2 ring-primary/40"
              )}
            >
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold tabular-nums">{card.value}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">CI:</span>
          <Input
            value={ciInput}
            onChange={(e) => setCiInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCiSearch();
            }}
            placeholder="Número do CI"
            className="h-8 w-[140px] font-mono text-sm"
            inputMode="numeric"
          />
          <Button size="sm" variant="secondary" className="h-8" onClick={handleCiSearch}>
            <Search className="h-4 w-4 mr-1" />
            Pesquisar
          </Button>
          {ciFilter ? (
            <Button size="sm" variant="ghost" className="h-8" onClick={handleCiClear}>
              Limpar
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Status:</span>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("")}
            >
              Todos
            </Button>
            {(["pendente", "em_andamento", "concluido"] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Etiqueta:</span>
          <Select value={etiquetaFilter} onValueChange={setEtiquetaFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {etiquetas.map((eq) => (
                <SelectItem key={eq} value={eq}>
                  <span className="truncate block max-w-[180px]" title={eq}>{eq}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Área:</span>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Data limite:</span>
          <DatePickerField value={dataFrom} onChange={setDataFrom} placeholder="De" className="w-[120px] h-8" />
          <DatePickerField value={dataTo} onChange={setDataTo} placeholder="Até" className="w-[120px] h-8" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Advogado:</span>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Situação:</span>
          <Select value={situacaoFilter} onValueChange={setSituacaoFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              <SelectItem value="aguardando">Aguardando (no prazo)</SelectItem>
              <SelectItem value="atrasada">Atrasadas</SelectItem>
              <SelectItem value="no_prazo">Entregue no prazo</SelectItem>
              <SelectItem value="entregue_atrasada">Entregue com atraso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Planner:</span>
          <Select value={jaNoPlannerFilter} onValueChange={setJaNoPlannerFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="sim">Já no Planner</SelectItem>
              <SelectItem value="nao">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/60 p-0.5 bg-muted/30">
          <Button
            type="button"
            variant={viewMode === "table" ? "default" : "ghost"}
            size="sm"
            className="h-8"
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4 mr-1" />
            Lista
          </Button>
          <Button
            type="button"
            variant={viewMode === "calendar" ? "default" : "ghost"}
            size="sm"
            className="h-8"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            Calendário
          </Button>
        </div>
        {viewMode === "table" && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Ordenar:</span>
          <Select value={orderBy} onValueChange={setOrderBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="data_limite_asc">Data limite (urgente)</SelectItem>
              <SelectItem value="data_limite_desc">Data limite (recente)</SelectItem>
              <SelectItem value="data_conclusao_desc">Entregue (recente)</SelectItem>
              <SelectItem value="area">Área</SelectItem>
            </SelectContent>
          </Select>
        </div>
        )}
        {viewMode === "table" && (
        <span className="text-sm text-muted-foreground">
          {tasks.length} de {total} tarefa(s)
        </span>
        )}
      </div>

      {viewMode === "calendar" ? (
        <ViosTarefasCalendar
          filters={calendarFilters}
          onEnviarPlanner={handleOpenEnviarPlanner}
        />
      ) : loading ? (
        <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-sm p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
      <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-sm shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead>CI</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Etiqueta</TableHead>
              <TableHead className="min-w-[140px]">Comentários</TableHead>
              <TableHead className="min-w-[180px]">Responsáveis (advogado)</TableHead>
              <TableHead>Data limite</TableHead>
              <TableHead>Entregue em</TableHead>
              <TableHead>Concluiu</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Status VIOS</TableHead>
              <TableHead className="min-w-[200px]">Colaborador</TableHead>
              <TableHead className="w-[140px]">Planner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const atrasada = isAtrasada(task);
              const situacao = getViosEntregaSituacao(task);
              const etiquetaHint = task.etiquetas_tarefa
                ? ETIQUETA_HINT[task.etiquetas_tarefa] ?? task.etiquetas_tarefa
                : "";
              return (
              <TableRow
                key={task.id}
                className={cn(
                  task.status === "concluido" && "bg-emerald-50/30",
                  atrasada && "bg-red-50/50"
                )}
              >
                <TableCell>
                  <div className="font-mono text-sm">{task.vios_id}</div>
                  {task.ci_processo && (
                    <p className="text-[10px] text-muted-foreground">Proc. {task.ci_processo}</p>
                  )}
                  <ViosTaskPairInfo task={task} compact className="mt-0.5" />
                </TableCell>
                <TableCell>
                  <AreaWithIcon area={task.area_processo ?? "—"} />
                </TableCell>
                <TableCell className="max-w-[160px] truncate" title={etiquetaHint}>
                  {task.etiquetas_tarefa ?? "—"}
                </TableCell>
                <TableCell className="max-w-[140px] truncate" title={task.comentarios ?? ""}>
                  {task.comentarios ?? "—"}
                </TableCell>
                <TableCell>
                  {editingResponsaveisId === task.vios_id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editResponsaveisValue}
                        onChange={(e) => setEditResponsaveisValue(e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Nomes dos responsáveis"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveResponsaveis(task);
                          if (e.key === "Escape") cancelEditResponsaveis();
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => saveResponsaveis(task)}
                        disabled={savingResponsaveisId === task.vios_id}
                      >
                        {savingResponsaveisId === task.vios_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={cancelEditResponsaveis}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <span className="truncate max-w-[200px]" title={filterLeonardoFromResponsaveis(task.responsaveis) ?? ""}>
                        {filterLeonardoFromResponsaveis(task.responsaveis) || "—"}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => startEditResponsaveis(task)}
                        title="Editar nomes"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell className={cn("whitespace-nowrap", atrasada && "text-red-600 font-medium")}>
                  {task.data_limite ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5">
                        {atrasada && <CalendarX2 className="h-4 w-4 shrink-0" />}
                        {format(new Date(task.data_limite + "T12:00:00"), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                      <ViosProrrogacaoBadge task={task} compact />
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {task.data_conclusao ? (
                    <span className="flex items-center gap-1.5">
                      {isEntregueNoPrazo(task) === true && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="No prazo" />
                      )}
                      {isEntregueNoPrazo(task) === false && (
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-label="Atrasado" />
                      )}
                      {format(parseISO(task.data_conclusao), "dd/MM/yyyy", { locale: ptBR })}
                      {task.hora_conclusao && ` ${task.hora_conclusao}`}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="max-w-[160px] truncate" title={task.usuario_concluiu ?? ""}>
                  {task.usuario_concluiu ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      situacao === "atrasada" || situacao === "entregue_atrasada"
                        ? "destructive"
                        : situacao === "no_prazo"
                          ? "default"
                          : "secondary"
                    }
                    className={cn(situacao === "no_prazo" && "bg-emerald-600 hover:bg-emerald-700")}
                  >
                    {SITUACAO_LABEL[situacao]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {atrasada && (
                      <Badge variant="destructive" className="shrink-0">
                        Atrasada
                      </Badge>
                    )}
                    <Badge
                      variant={
                        task.status === "concluido"
                          ? "default"
                          : task.status === "em_andamento"
                            ? "secondary"
                            : "outline"
                      }
                      className={cn(
                        task.status === "concluido" && "bg-emerald-600 hover:bg-emerald-700"
                      )}
                    >
                      {STATUS_LABEL[task.status] ?? task.status}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  {needsAssigneeLink(task) ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-[200px] max-w-[280px] shrink">
                        <UserSelectSearch
                          users={users}
                          value={selectedUser[task.vios_id] ?? ""}
                          onValueChange={(userId) =>
                            setSelectedUser((prev) => ({
                              ...prev,
                              [task.vios_id]: userId,
                            }))
                          }
                          placeholder={
                            filterLeonardoFromResponsaveis(task.responsaveis)
                              ? `Vincular: ${(filterLeonardoFromResponsaveis(task.responsaveis) ?? "").split(/\s*\|\s*/)[0]?.trim()}`
                              : "Colaborador não encontrado — selecione"
                          }
                        />
                      </div>
                      {selectedUser[task.vios_id] ? (
                        <Button
                          size="sm"
                          className="shrink-0"
                          onClick={() => handleLink(task)}
                          disabled={linkingId === task.vios_id}
                        >
                          {linkingId === task.vios_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Salvar"
                          )}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage
                          src={task.assignee_avatar_url || undefined}
                          alt={task.assignee_name ?? ""}
                        />
                        <AvatarFallback className="text-[10px]">
                          {(task.assignee_name ?? "?")
                            .split(" ")
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate" title={task.assignee_name ?? ""}>
                        {task.assignee_name ?? "—"}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {task.marketing_request_id ? (
                    <Link
                      href="/planner"
                      className="text-xs text-emerald-600 font-medium hover:underline"
                    >
                      No Planner
                    </Link>
                  ) : canSendToPlanner(task) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEnviarPlanner(task)}
                      title="Criar solicitação no Planner com os dados do e-mail"
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Enviar
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground" title="Aguardando revisão do gestor (REVISAR concluída)">
                      Aguardando revisão
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
        {tasks.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            Nenhuma tarefa VIOS encontrada.
          </div>
        )}
      </div>
      )}

      {!loading && viewMode === "table" && hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => loadTasks(tasks.length, true)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Carregar mais
          </Button>
        </div>
      )}

      <EnviarViosAoPlannerDialog
        open={!!enviarPlannerTask}
        onOpenChange={(open) => !open && setEnviarPlannerTask(null)}
        task={enviarPlannerTask}
        users={users}
        designers={designers}
        onSuccess={handleEnviarPlannerSuccess}
      />
    </div>
  );
}
