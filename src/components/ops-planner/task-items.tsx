"use client";

import { CheckSquare, GitBranch, Hourglass, MessageSquare } from "lucide-react";
import { OPS_STATUS_LABEL, type OpsList, type OpsPerson, type OpsSpace, type OpsTaskSummary } from "@/lib/ops-planner/types";
import { cn } from "@/lib/utils";
import { AvatarStack, DueLabel, PriorityLabel, RoutineMark, SpaceChip } from "./ops-ui";

/** Contadores do cartão: checklist, subtarefas e comentários. */
export function TaskCounters({ task }: { task: OpsTaskSummary }) {
  return (
    <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
      {task.checklist_count > 0 && (
        <span className="inline-flex items-center gap-1" title="Checklist">
          <CheckSquare className="size-3.5" aria-hidden />
          <span className="tabular-nums">
            {task.checklist_done_count}/{task.checklist_count}
          </span>
        </span>
      )}
      {task.subtask_count > 0 && (
        <span className="inline-flex items-center gap-1" title="Subtarefas">
          <GitBranch className="size-3.5" aria-hidden />
          <span className="tabular-nums">
            {task.subtask_done_count}/{task.subtask_count}
          </span>
        </span>
      )}
      {task.comment_count > 0 && (
        <span className="inline-flex items-center gap-1" title="Comentários">
          <MessageSquare className="size-3.5" aria-hidden />
          <span className="tabular-nums">{task.comment_count}</span>
        </span>
      )}
    </span>
  );
}

export function TaskCard({
  task,
  list,
  people,
  today,
  onOpen,
  dragging = false,
}: {
  task: OpsTaskSummary;
  list: OpsList | undefined;
  people: Map<string, OpsPerson>;
  today: string;
  onOpen: () => void;
  dragging?: boolean;
}) {
  const overdue = task.due_date && task.due_date < today && task.status !== "concluida" && task.status !== "cancelada";
  return (
    <div
      className={cn(
        "rounded-md border border-[#dce9eb] bg-white p-3 shadow-[0_1px_2px_rgba(3,32,47,0.06)] transition-shadow",
        overdue && "border-l-[3px] border-l-red-500",
        dragging && "shadow-lg ring-2 ring-[#47cdd0]/50"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left text-sm font-medium leading-snug text-foreground hover:text-[#285f7a] focus-visible:outline-2 focus-visible:outline-[#47cdd0]"
      >
        {task.title}
      </button>
      {(list || task.routine_id) && (
        <div className="mt-1.5 flex items-center gap-2">
          {task.routine_id && <RoutineMark />}
          {list && <span className="truncate text-xs text-muted-foreground">{list.name}</span>}
        </div>
      )}
      {task.status === "aguardando" && task.waiting_on && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-800">
          <Hourglass className="size-3.5" aria-hidden />
          <span className="truncate">{task.waiting_on}</span>
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <PriorityLabel priority={task.priority} compact />
          <DueLabel due={task.due_date} time={task.due_time} status={task.status} today={today} />
        </span>
        <AvatarStack ids={task.assignee_ids} people={people} emptyLabel="" />
      </div>
      {(task.checklist_count > 0 || task.subtask_count > 0 || task.comment_count > 0) && (
        <div className="mt-2">
          <TaskCounters task={task} />
        </div>
      )}
    </div>
  );
}

/** Linha usada em Minhas tarefas e na visão de lista. */
export function TaskRow({
  task,
  space,
  list,
  people,
  today,
  onOpen,
  showSpace = false,
  showStatus = true,
}: {
  task: OpsTaskSummary;
  space?: OpsSpace;
  list?: OpsList;
  people: Map<string, OpsPerson>;
  today: string;
  onOpen: () => void;
  showSpace?: boolean;
  showStatus?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-1.5 border-b border-[#eef3f4] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#f6fbfb] focus-visible:bg-[#f6fbfb] focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {task.routine_id && <RoutineMark />}
          <span className={cn("truncate text-sm font-medium", task.status === "concluida" && "text-muted-foreground line-through")}>{task.title}</span>
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {showSpace && <SpaceChip space={space} />}
          {list && <span className="text-xs text-muted-foreground">{list.name}</span>}
          {task.status === "aguardando" && task.waiting_on && <span className="text-xs text-amber-800">Aguardando {task.waiting_on}</span>}
          <TaskCounters task={task} />
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3 sm:w-auto">
        {showStatus && <span className="w-28 text-xs text-muted-foreground">{OPS_STATUS_LABEL[task.status]}</span>}
        <PriorityLabel priority={task.priority} compact />
        <DueLabel due={task.due_date} time={task.due_time} status={task.status} today={today} className="sm:w-32" />
        <AvatarStack ids={task.assignee_ids} people={people} emptyLabel="—" />
      </span>
    </button>
  );
}
