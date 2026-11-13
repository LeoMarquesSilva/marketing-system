"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Columns3, ExternalLink, List, Loader2, Plus, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canManageSpace, isOverdue, wipByPerson, type OpsAccess } from "@/lib/ops-planner/domain";
import {
  OPS_PRIORITIES,
  OPS_PRIORITY_LABEL,
  OPS_SPACES_PATH,
  OPS_TIPO_LABEL,
  OPS_TIPOS,
  type OpsPlannerContext,
  type OpsSpace,
  type OpsTask,
  type OpsTaskStatus,
  type OpsTaskSummary,
} from "@/lib/ops-planner/types";
import { cn } from "@/lib/utils";
import { errorMessage, opsApi } from "./ops-client";
import { firstName, usePlannerMaps } from "./ops-ui";
import { SpaceSettingsDialog } from "./space-settings-dialog";
import { TaskCreateDialog, type TaskCreateDefaults } from "./task-create-dialog";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TaskBoardView, TaskCalendarView, TaskListView } from "./task-views";
import { useTaskDialog } from "./use-task-dialog";

type View = "lista" | "quadro" | "calendario";
const ALL = "__todos";
const NO_LIST = "sem-lista";
const NOBODY = "__ninguem";

const VIEWS: Array<{ id: View; label: string; icon: typeof List }> = [
  { id: "lista", label: "Lista", icon: List },
  { id: "quadro", label: "Quadro", icon: Columns3 },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
];

export function SpaceWorkspace({
  context: initialContext,
  space: initialSpace,
  initialTasks,
}: {
  context: OpsPlannerContext;
  space: OpsSpace;
  initialTasks: OpsTaskSummary[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [context, setContext] = useState(initialContext);
  const [space, setSpace] = useState(initialSpace);
  const [tasks, setTasks] = useState(initialTasks);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "warning"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState(searchParams.get("responsavel") ?? ALL);
  const [priority, setPriority] = useState(ALL);
  const [tipo, setTipo] = useState(ALL);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<TaskCreateDefaults | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingWaiting, setPendingWaiting] = useState<{ task: OpsTaskSummary; value: string } | null>(null);

  const view: View = (["lista", "quadro", "calendario"] as const).find((item) => item === searchParams.get("visao")) ?? "quadro";
  const listFilter = searchParams.get("lista") ?? ALL;
  const access: OpsAccess = { userId: context.me.id, isAdmin: context.is_admin, memberships: context.memberships };
  const canManage = canManageSpace(access, space.id);
  const maps = usePlannerMaps(context);
  const spaceLists = context.lists.filter((list) => list.space_id === space.id);
  const spaceMemberIds = context.members.filter((member) => member.space_id === space.id).map((member) => member.user_id);

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const { tasks: fresh } = await opsApi.get<{ tasks: OpsTaskSummary[] }>(`/tasks?space=${space.id}&done=1`);
      setTasks(fresh);
    } catch (cause) {
      setNotice({ tone: "error", text: errorMessage(cause) });
    } finally {
      setRefreshing(false);
    }
  }, [space.id]);

  const dialog = useTaskDialog(reload);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (listFilter === NO_LIST ? task.list_id !== null : listFilter !== ALL && task.list_id !== listFilter) return false;
      if (assignee === NOBODY ? task.assignee_ids.length > 0 : assignee !== ALL && !task.assignee_ids.includes(assignee)) return false;
      if (priority !== ALL && task.priority !== priority) return false;
      if (tipo !== ALL && task.tipo !== tipo) return false;
      if (overdueOnly && !isOverdue(task, context.today)) return false;
      if (query && !`${task.title} ${task.next_step ?? ""} ${task.waiting_on ?? ""}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [assignee, context.today, listFilter, overdueOnly, priority, search, tasks, tipo]);

  function mergeTask(task: OpsTask) {
    // Subtarefa mudou: a principal recarrega os contadores ao fechar o detalhe.
    dialog.markDirty();
    if (task.space_id !== space.id) {
      setTasks((current) => current.filter((item) => item.id !== task.id));
      return;
    }
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, ...task } : item)));
  }

  async function moveTask(task: OpsTaskSummary, status: OpsTaskStatus, waitingOn?: string) {
    if (status === "aguardando" && !waitingOn) {
      setPendingWaiting({ task, value: task.waiting_on ?? "" });
      return;
    }
    const previous = tasks;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status } : item)));
    setNotice(null);
    try {
      const { task: saved } = await opsApi.patch<{ task: OpsTaskSummary }>(`/tasks/${task.id}`, { status, ...(waitingOn ? { waiting_on: waitingOn } : {}) });
      const next = previous.map((item) => (item.id === saved.id ? saved : item));
      setTasks(next);
      if (status === "em_andamento") {
        const wip = wipByPerson(next);
        const over = saved.assignee_ids.filter((id) => (wip.get(id) ?? 0) > space.wip_limit);
        if (over.length > 0) {
          setNotice({
            tone: "warning",
            text: `${over.map((id) => firstName(maps.people.get(id)?.name)).join(", ")} passou do limite de ${space.wip_limit} tarefas em andamento.`,
          });
        }
      }
    } catch (cause) {
      setTasks(previous);
      setNotice({ tone: "error", text: errorMessage(cause) });
    }
  }

  const listCount = (listId: string | null) => tasks.filter((task) => task.list_id === listId && task.status !== "concluida" && task.status !== "cancelada").length;
  const viewProps = {
    tasks: filtered,
    lists: maps.lists,
    people: maps.people,
    today: context.today,
    onOpen: (task: OpsTaskSummary) => dialog.open(task.id),
  };
  const defaultList = listFilter !== ALL && listFilter !== NO_LIST ? listFilter : null;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* Trilho do ClickUp: espaços e as listas do espaço aberto. */}
      <aside className="shrink-0 lg:w-60">
        <div className="grid gap-2 sm:grid-cols-2 lg:hidden">
          <Select value={space.slug} onValueChange={(slug) => router.push(`${OPS_SPACES_PATH}/${slug}`)}>
            <SelectTrigger aria-label="Espaço" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {context.spaces.map((item) => (
                <SelectItem key={item.id} value={item.slug}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={listFilter} onValueChange={(value) => setParam("lista", value === ALL ? null : value)}>
            <SelectTrigger aria-label="Lista" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as listas</SelectItem>
              {spaceLists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name}
                </SelectItem>
              ))}
              <SelectItem value={NO_LIST}>Sem lista</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <nav aria-label="Espaços do Planner" className="hidden rounded-lg border border-[#dce9eb] bg-white p-2 lg:block">
          <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase text-muted-foreground">Espaços</p>
          <ul className="space-y-0.5">
            {context.spaces.map((item) => {
              const active = item.id === space.id;
              return (
                <li key={item.id}>
                  <Link
                    href={`${OPS_SPACES_PATH}/${item.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      active ? "bg-[#e8f8f8] font-semibold text-[#285f7a]" : "text-foreground hover:bg-slate-50"
                    )}
                  >
                    <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                  {active && (
                    <ul className="mb-1 ml-4 mt-0.5 space-y-0.5 border-l border-[#dce9eb] pl-2">
                      {[{ id: ALL, name: "Todas as listas", count: null as number | null }, ...spaceLists.map((list) => ({ id: list.id, name: list.name, count: listCount(list.id) })), { id: NO_LIST, name: "Sem lista", count: listCount(null) }].map((entry) => (
                        <li key={entry.id}>
                          <button
                            type="button"
                            aria-pressed={listFilter === entry.id}
                            onClick={() => setParam("lista", entry.id === ALL ? null : entry.id)}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm",
                              listFilter === entry.id ? "bg-slate-100 font-medium text-foreground" : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                            )}
                          >
                            <span className="truncate">{entry.name}</span>
                            {entry.count !== null && entry.count > 0 && <span className="text-xs tabular-nums">{entry.count}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <span aria-hidden className="size-3 rounded-sm" style={{ backgroundColor: space.color }} />
              {space.name}
              {refreshing && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Atualizando" />}
            </h2>
            {space.description && <p className="mt-0.5 text-sm text-muted-foreground">{space.description}</p>}
          </div>
          <div className="flex gap-2">
            {canManage && (
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="size-4" />
                Configurar
              </Button>
            )}
            <Button type="button" onClick={() => setCreateDefaults({ spaceId: space.id, listId: defaultList })}>
              <Plus className="size-4" />
              Nova tarefa
            </Button>
          </div>
        </div>

        {space.slug === "marketing" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#f6fafb] px-4 py-3 text-sm ring-1 ring-inset ring-[#dce9eb]">
            <span>As solicitações de peças, posts e reels continuam no Planner de Marketing. Aqui ficam as rotinas e tarefas internas da equipe.</span>
            <Button asChild size="sm" variant="outline">
              <Link href="/planner">
                Abrir o Planner de Marketing
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Visão" className="flex rounded-md border border-[#dce9eb] bg-white p-0.5">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setParam("visao", id === "quadro" ? null : id)}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded px-3 text-sm font-medium",
                  view === id ? "bg-[#e8f8f8] text-[#285f7a]" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div className="relative min-w-48 flex-1 sm:max-w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefa" aria-label="Buscar tarefa" className="pl-9" />
          </div>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger aria-label="Responsável" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
              <SelectItem value={context.me.id}>Minhas</SelectItem>
              <SelectItem value={NOBODY}>Sem responsável</SelectItem>
              {spaceMemberIds
                .filter((id) => id !== context.me.id)
                .map((id) => (
                  <SelectItem key={id} value={id}>
                    {maps.people.get(id)?.name ?? "Pessoa"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger aria-label="Prioridade" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Prioridade</SelectItem>
              {OPS_PRIORITIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {OPS_PRIORITY_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger aria-label="Tipo" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tipo</SelectItem>
              {OPS_TIPOS.map((item) => (
                <SelectItem key={item} value={item}>
                  {OPS_TIPO_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant={overdueOnly ? "secondary" : "ghost"} aria-pressed={overdueOnly} onClick={() => setOverdueOnly((value) => !value)}>
            Só atrasadas
          </Button>
          {view === "lista" && (
            <Button type="button" variant={showDone ? "secondary" : "ghost"} aria-pressed={showDone} onClick={() => setShowDone((value) => !value)}>
              Concluídas
            </Button>
          )}
        </div>

        {notice && (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ring-1 ring-inset",
              notice.tone === "error" ? "bg-red-50 text-red-700 ring-red-200" : "bg-amber-50 text-amber-900 ring-amber-200"
            )}
          >
            {notice.text}
            <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>
              Fechar
            </button>
          </p>
        )}

        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#dce9eb] bg-white px-4 py-12 text-center">
            <p className="font-medium">Nenhuma tarefa em {space.name} ainda.</p>
            <p className="mt-1 text-sm text-muted-foreground">Crie a primeira tarefa ou cadastre as rotinas da equipe em Rotinas.</p>
            <Button type="button" className="mt-4" onClick={() => setCreateDefaults({ spaceId: space.id, listId: defaultList })}>
              <Plus className="size-4" />
              Nova tarefa
            </Button>
          </div>
        ) : view === "quadro" ? (
          <TaskBoardView
            {...viewProps}
            onMove={(task, status) => void moveTask(task, status)}
            onCreate={(status) => setCreateDefaults({ spaceId: space.id, listId: defaultList, status })}
          />
        ) : view === "lista" ? (
          <TaskListView {...viewProps} showDone={showDone} />
        ) : (
          <TaskCalendarView {...viewProps} onCreateOn={(date) => setCreateDefaults({ spaceId: space.id, listId: defaultList, dueDate: date })} />
        )}
      </div>

      {createDefaults && (
        <TaskCreateDialog
          defaults={createDefaults}
          context={context}
          assignable={maps.assignable}
          onClose={() => setCreateDefaults(null)}
          onCreated={(task) => {
            setCreateDefaults(null);
            if (task.space_id === space.id) setTasks((current) => [...current, task]);
            else setNotice({ tone: "warning", text: "Tarefa criada em outro espaço." });
          }}
        />
      )}

      {dialog.openId && (
        <TaskDetailDialog
          key={dialog.openId}
          taskId={dialog.openId}
          context={context}
          people={maps.people}
          assignable={maps.assignable}
          onClose={dialog.close}
          onChanged={mergeTask}
          onArchived={(id) => {
            dialog.markDirty();
            setTasks((current) => current.filter((item) => item.id !== id));
          }}
        />
      )}

      {settingsOpen && (
        <SpaceSettingsDialog
          space={space}
          access={access}
          members={context.members}
          lists={context.lists}
          people={context.people}
          onClose={() => setSettingsOpen(false)}
          onSpaceChange={setSpace}
          onMembersChange={(members) => setContext((current) => ({ ...current, members }))}
          onListsChange={(lists) => setContext((current) => ({ ...current, lists }))}
        />
      )}

      {pendingWaiting && (
        <Dialog open onOpenChange={(open) => !open && setPendingWaiting(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="text-left">
              <DialogTitle>Aguardando quem?</DialogTitle>
              <DialogDescription>
                Registre quem está segurando a tarefa. Parada há mais de 5 dias úteis, a liderança do espaço é avisada.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const value = pendingWaiting.value.trim();
                if (!value) return;
                const task = pendingWaiting.task;
                setPendingWaiting(null);
                void moveTask(task, "aguardando", value);
              }}
            >
              <Input
                autoFocus
                aria-label="Aguardando quem"
                value={pendingWaiting.value}
                maxLength={200}
                placeholder="Pessoa, área ou fornecedor"
                onChange={(event) => setPendingWaiting({ ...pendingWaiting, value: event.target.value })}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPendingWaiting(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!pendingWaiting.value.trim()}>
                  Mover para Aguardando
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
