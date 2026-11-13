"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, ExternalLink, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  dueBucket,
  managedSpaceIds,
  MY_TASK_GROUP_LABEL,
  MY_TASK_GROUPS,
  myTaskGroup,
  type MyTaskGroup,
} from "@/lib/ops-planner/domain";
import type { OpsMarketingItem, OpsNotificationPrefs, OpsPlannerContext, OpsTask, OpsTaskSummary } from "@/lib/ops-planner/types";
import { cn } from "@/lib/utils";
import { errorMessage, opsApi } from "./ops-client";
import { formatDate, usePlannerMaps } from "./ops-ui";
import { TaskCreateDialog } from "./task-create-dialog";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TaskRow } from "./task-items";
import { sortTasks } from "./task-views";
import { useTaskDialog } from "./use-task-dialog";

const ALL = "__todos";
const MARKETING = "__marketing";

const GROUP_TONE: Partial<Record<MyTaskGroup, string>> = {
  atrasada: "text-red-700",
  hoje: "text-amber-700",
  aguardando: "text-amber-800",
};

function PrefsPopover({ prefs, isManager }: { prefs: OpsNotificationPrefs; isManager: boolean }) {
  const [value, setValue] = useState(prefs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: keyof OpsNotificationPrefs, next: boolean) {
    const previous = value;
    setValue({ ...value, [key]: next });
    setSaving(true);
    setError(null);
    try {
      const { prefs: saved } = await opsApi.patch<{ prefs: OpsNotificationPrefs }>("/prefs", { [key]: next });
      setValue(saved);
    } catch (cause) {
      setValue(previous);
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline">
          <BellRing className="size-4" />
          Avisos por e-mail
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-4">
        <p className="text-sm font-semibold">Como você é avisado</p>
        <p className="text-xs text-muted-foreground">
          No sistema, o sino mostra tarefas novas, prazos de hoje e de amanhã, atrasos e comentários. Por e-mail, um resumo às 7h dos dias úteis.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[#347796]" checked={value.email_digest} disabled={saving} onChange={(event) => void toggle("email_digest", event.target.checked)} />
          Resumo diário por e-mail
        </label>
        {isManager && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[#347796]"
              checked={value.manager_digest}
              disabled={saving || !value.email_digest}
              onChange={(event) => void toggle("manager_digest", event.target.checked)}
            />
            Incluir no resumo o que está atrasado ou parado nas minhas equipes
          </label>
        )}
        {saving && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Salvando</p>}
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}

export function MyTasksClient({
  context,
  initialTasks,
  initialMarketing,
  prefs,
}: {
  context: OpsPlannerContext;
  initialTasks: OpsTaskSummary[];
  initialMarketing: OpsMarketingItem[];
  prefs: OpsNotificationPrefs;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [marketing, setMarketing] = useState(initialMarketing);
  const [spaceFilter, setSpaceFilter] = useState(ALL);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maps = usePlannerMaps(context);
  const isManager = managedSpaceIds({ userId: context.me.id, isAdmin: context.is_admin, memberships: context.memberships }, []).length > 0;
  const defaultSpace = context.memberships[0]?.space_id ?? context.spaces[0]?.id;

  const reload = useCallback(async () => {
    try {
      const data = await opsApi.get<{ tasks: OpsTaskSummary[]; marketing: OpsMarketingItem[] }>("/tasks?mine=1");
      setTasks(data.tasks);
      setMarketing(data.marketing);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);
  const dialog = useTaskDialog(reload);

  const query = search.trim().toLowerCase();
  const visibleTasks = tasks.filter(
    (task) => (spaceFilter === ALL || task.space_id === spaceFilter) && (!query || task.title.toLowerCase().includes(query))
  );
  const visibleMarketing = marketing.filter(
    (item) => (spaceFilter === ALL || spaceFilter === MARKETING) && (!query || item.title.toLowerCase().includes(query))
  );

  const groups = useMemo(() => {
    const byGroup = new Map<MyTaskGroup, { tasks: OpsTaskSummary[]; marketing: OpsMarketingItem[] }>(
      MY_TASK_GROUPS.map((group) => [group, { tasks: [], marketing: [] }])
    );
    for (const task of spaceFilter === MARKETING ? [] : visibleTasks) byGroup.get(myTaskGroup(task, context.today))?.tasks.push(task);
    for (const item of visibleMarketing) byGroup.get(dueBucket(item.due_date, context.today))?.marketing.push(item);
    return MY_TASK_GROUPS.map((group) => ({ group, ...byGroup.get(group)!, tasks: sortTasks(byGroup.get(group)!.tasks) })).filter(
      (entry) => entry.tasks.length + entry.marketing.length > 0
    );
  }, [context.today, spaceFilter, visibleMarketing, visibleTasks]);

  const count = (group: MyTaskGroup) => groups.find((entry) => entry.group === group);
  const spacesWithTasks = context.spaces.filter((space) => tasks.some((task) => task.space_id === space.id));

  function mergeTask(task: OpsTask) {
    dialog.markDirty();
    setTasks((current) =>
      task.assignee_ids.includes(context.me.id) ? current.map((item) => (item.id === task.id ? { ...item, ...task } : item)) : current.filter((item) => item.id !== task.id)
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(["atrasada", "hoje", "proximos_7", "aguardando"] as MyTaskGroup[]).map((group) => {
          const entry = count(group);
          const total = (entry?.tasks.length ?? 0) + (entry?.marketing.length ?? 0);
          return (
            <a
              key={group}
              href={`#grupo-${group}`}
              className="rounded-lg border border-[#dce9eb] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(3,32,47,0.05)] hover:border-[#47cdd0]/60"
            >
              <p className="text-xs font-semibold text-[#315f73]">{MY_TASK_GROUP_LABEL[group]}</p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", total > 0 && GROUP_TONE[group])}>{total}</p>
            </a>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nas minhas tarefas" aria-label="Buscar nas minhas tarefas" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por espaço">
          {[{ id: ALL, name: "Todos" }, ...spacesWithTasks.map((space) => ({ id: space.id, name: space.name })), ...(marketing.length ? [{ id: MARKETING, name: "Solicitações de Marketing" }] : [])].map(
            (option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={spaceFilter === option.id ? "secondary" : "ghost"}
                aria-pressed={spaceFilter === option.id}
                onClick={() => setSpaceFilter(option.id)}
              >
                {option.name}
              </Button>
            )
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <PrefsPopover prefs={prefs} isManager={isManager} />
          {defaultSpace && (
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Nova tarefa
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {error}
        </p>
      )}

      {context.spaces.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#dce9eb] bg-white px-4 py-12 text-center">
          <p className="font-medium">Você ainda não faz parte de um espaço.</p>
          <p className="mt-1 text-sm text-muted-foreground">Peça à liderança da sua equipe para incluir você no espaço dela.</p>
        </div>
      )}

      {context.spaces.length > 0 && groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#dce9eb] bg-white px-4 py-12 text-center">
          <p className="font-medium">Nada pendente com você.</p>
          <p className="mt-1 text-sm text-muted-foreground">Quando alguém atribuir uma tarefa ou uma rotina vencer, ela aparece aqui.</p>
        </div>
      )}

      {groups.map((entry) => (
        <section key={entry.group} id={`grupo-${entry.group}`} className="scroll-mt-24 overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
          <h2 className={cn("flex items-center gap-2 border-b border-[#eef3f4] bg-[#f6fafb] px-3 py-2 text-sm font-semibold", GROUP_TONE[entry.group])}>
            {MY_TASK_GROUP_LABEL[entry.group]}
            <span className="text-xs font-normal tabular-nums text-muted-foreground">{entry.tasks.length + entry.marketing.length}</span>
          </h2>
          {entry.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              space={maps.spaces.get(task.space_id)}
              list={task.list_id ? maps.lists.get(task.list_id) : undefined}
              people={maps.people}
              today={context.today}
              onOpen={() => dialog.open(task.id)}
              showSpace
            />
          ))}
          {entry.marketing.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex flex-col gap-1 border-b border-[#eef3f4] px-3 py-2.5 last:border-b-0 hover:bg-[#f6fbfb] sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-sm bg-[#2f9c9f]/12 px-1.5 py-0.5 font-medium text-[#1f6f72]">Planner de Marketing</span>
                  {item.stage}
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {item.due_date ? formatDate(item.due_date, context.today) : "Sem prazo"}
                <ExternalLink className="size-3.5" aria-hidden />
              </span>
            </Link>
          ))}
        </section>
      ))}

      {creating && defaultSpace && (
        <TaskCreateDialog
          defaults={{ spaceId: defaultSpace }}
          context={context}
          assignable={maps.assignable}
          onClose={() => setCreating(false)}
          onCreated={(task) => {
            setCreating(false);
            if (task.assignee_ids.includes(context.me.id)) setTasks((current) => [...current, task]);
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
    </div>
  );
}
