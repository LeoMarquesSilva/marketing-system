"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format, parseISO, startOfDay } from "date-fns";
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
import { Loader2, Pencil, Check, X, Send, CalendarX2, CheckCircle2, AlertCircle } from "lucide-react";
import { AreaWithIcon } from "@/components/solicitacoes/area-with-icon";
import type { ViosTask } from "@/lib/vios-tasks";
import type { User } from "@/lib/users";
import {
  fetchViosTasks,
  updateViosTaskAssignee,
  updateViosTaskResponsaveis,
  isProtocolar,
  filterLeonardoFromResponsaveis,
} from "@/lib/vios-tasks";
import { EnviarViosAoPlannerDialog } from "@/components/vios/enviar-vios-ao-planner-dialog";
import { cn } from "@/lib/utils";
import { isPast } from "date-fns";

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

function isAtrasada(task: ViosTask): boolean {
  if (task.status === "concluido" || !task.data_limite) return false;
  const limit = startOfDay(new Date(task.data_limite + "T12:00:00"));
  return isPast(limit);
}

/** Retorna se a entrega foi no prazo (data_conclusao <= data_limite). */
function entregueNoPrazo(task: ViosTask): boolean | null {
  if (!task.data_conclusao || !task.data_limite) return null;
  const conclusao = startOfDay(parseISO(task.data_conclusao));
  const limite = startOfDay(new Date(task.data_limite + "T12:00:00"));
  return conclusao <= limite;
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
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [enviarPlannerTask, setEnviarPlannerTask] = useState<ViosTask | null>(null);

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
        orderBy: orderBy as "data_limite_asc" | "data_limite_desc" | "data_conclusao_desc" | "area",
      });
      setTasks((prev) => (append ? [...prev, ...nextTasks] : nextTasks));
      setTotal(nextTotal);
      setLoading(false);
      setLoadingMore(false);
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
    ]
  );

  useEffect(() => {
    loadTasks(0, false);
  }, [loadTasks]);

  const hasMore = tasks.length < total;

  async function handleLink(task: ViosTask) {
    const userId = selectedUser[task.vios_id];
    if (userId === undefined) return;
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
      setTasks((prev) =>
        prev.map((t) =>
          t.vios_id === enviarPlannerTask.vios_id
            ? { ...t, marketing_request_id: requestId }
            : t
        )
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

      <div className="flex flex-wrap items-center gap-4">
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
              {users.filter((u) => u.is_active !== false).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
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
        <span className="text-sm text-muted-foreground">
          {tasks.length} de {total} tarefa(s)
        </span>
      </div>

      {loading ? (
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
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[220px]">Vincular a usuário</TableHead>
              <TableHead className="w-[140px]">Planner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const atrasada = isAtrasada(task);
              return (
              <TableRow
                key={task.id}
                className={cn(
                  task.status === "concluido" && "bg-emerald-50/30",
                  atrasada && "bg-red-50/50"
                )}
              >
                <TableCell className="font-mono text-sm">{task.vios_id}</TableCell>
                <TableCell>
                  <AreaWithIcon area={task.area_processo ?? "—"} />
                </TableCell>
                <TableCell className="max-w-[160px] truncate" title={task.etiquetas_tarefa ?? ""}>
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
                    <span className="flex items-center gap-1.5">
                      {atrasada && <CalendarX2 className="h-4 w-4 shrink-0" />}
                      {format(new Date(task.data_limite + "T12:00:00"), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {task.data_conclusao ? (
                    <span className="flex items-center gap-1.5">
                      {entregueNoPrazo(task) === true && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="No prazo" />
                      )}
                      {entregueNoPrazo(task) === false && (
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-label="Atrasado" />
                      )}
                      {format(parseISO(task.data_conclusao), "dd/MM/yyyy", { locale: ptBR })}
                      {task.hora_conclusao && ` ${task.hora_conclusao}`}
                    </span>
                  ) : (
                    "—"
                  )}
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
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-[200px] max-w-[280px] shrink">
                      <UserSelectSearch
                        users={users}
                        value={selectedUser[task.vios_id] ?? task.assignee_id ?? ""}
                        onValueChange={(userId) =>
                          setSelectedUser((prev) => ({
                            ...prev,
                            [task.vios_id]: userId,
                          }))
                        }
                        placeholder="Pesquisar ou selecionar advogado..."
                      />
                    </div>
                    {(selectedUser[task.vios_id] !== undefined ||
                      task.assignee_id) && (
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
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {task.marketing_request_id ? (
                    <span className="text-xs text-emerald-600 font-medium">
                      No Planner
                    </span>
                  ) : isProtocolar(task) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEnviarPlanner(task)}
                      title="Enviar esta tarefa para o Planner do marketing"
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Enviar
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Etiqueta deve ser PROTOCOLAR
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

      {!loading && hasMore && (
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
