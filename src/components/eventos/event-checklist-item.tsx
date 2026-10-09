"use client";

import { CalendarDays, Check, ChevronDown, Clock3, MoreHorizontal, Pencil, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./event-menu";
import { EventTaskPeople } from "./event-task-people";
import { taskDateLabel } from "@/lib/event-task-list";
import { formatBrl, type EventBudgetItem, type EventTask } from "@/lib/eventos";
import { cn } from "@/lib/utils";

export function EventChecklistItem({ task, expense, nextFollowUp, today, disabled, onToggle, onEdit, onDelete, onOpenBudget }: {
  task: EventTask;
  expense?: EventBudgetItem;
  nextFollowUp?: { date: string; time: string | null; responsibleName: string | null } | null;
  today: string;
  disabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenBudget: (item: EventBudgetItem) => void;
}) {
  const done = task.status === "concluida";
  const late = !done && Boolean(task.dueDate && task.dueDate < today);
  const titleClass = cn("break-words text-left text-sm font-medium leading-6 text-foreground [overflow-wrap:anywhere]", done && "text-muted-foreground line-through");

  return (
    <div className="group/row grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-start gap-2 px-3 py-3.5 transition-colors hover:bg-muted/30 sm:gap-3 sm:px-5 lg:grid-cols-[2rem_minmax(0,1fr)_auto]">
      <label className="grid size-8 cursor-pointer place-items-center rounded-lg" title={done ? "Reabrir item" : "Concluir item"}>
        <input
          type="checkbox"
          className="peer col-start-1 row-start-1 size-5 cursor-pointer appearance-none rounded-md border border-muted-foreground/35 bg-card transition-colors checked:border-emerald-500 checked:bg-emerald-500 hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50"
          aria-label={`${done ? "Reabrir" : "Concluir"} item: ${task.title}`}
          checked={done}
          disabled={disabled}
          onChange={onToggle}
        />
        <Check aria-hidden className="pointer-events-none col-start-1 row-start-1 size-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </label>

      <div className="min-w-0 pt-1">
        <button type="button" aria-label={`Abrir tarefa: ${task.title}`} className={cn(titleClass, "rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary")} disabled={disabled} onClick={onEdit}>{task.title}</button>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            aria-label={`Editar responsáveis de ${task.title}`}
            title="Editar responsáveis"
            disabled={disabled}
            onClick={onEdit}
            className="max-w-full rounded-md py-0.5 text-left transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary [&_[data-slot=avatar]]:size-5 [&_[data-slot=avatar]]:ring-0"
          >
            <EventTaskPeople task={task} />
          </button>
          {task.dueDate && <span className={cn("inline-flex items-center gap-1.5 tabular-nums", late && "font-medium text-amber-700 dark:text-amber-400")}><CalendarDays aria-hidden className="size-3.5" />{taskDateLabel(task.dueDate)}{late && <span>· Atrasado</span>}</span>}
          {nextFollowUp && !done && <button type="button" disabled={disabled} onClick={onEdit} className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 tabular-nums transition-colors hover:bg-primary/10", nextFollowUp.date < today ? "bg-amber-500/10 font-medium text-amber-700" : "bg-primary/7 text-primary")}><Clock3 aria-hidden className="size-3.5" />Follow-up {taskDateLabel(nextFollowUp.date)}{nextFollowUp.time && ` · ${nextFollowUp.time}`}{nextFollowUp.responsibleName && ` · ${nextFollowUp.responsibleName}`}</button>}
          {task.status === "em_andamento" && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full bg-primary" />Em andamento</span>}
          {expense && <button type="button" disabled={disabled} aria-label="Ver no orçamento" onClick={() => onOpenBudget(expense)} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><Wallet aria-hidden className="size-3.5" />{formatBrl(expense.amountPlanned)}</button>}
        </div>
        {task.description && <details className="group/details mt-1.5"><summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"><ChevronDown aria-hidden className="size-3 transition-transform group-open/details:rotate-180" />Descrição</summary><p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-3 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">{task.description}</p></details>}
      </div>

      <div className="hidden items-center gap-1 lg:flex">
        <Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={`Editar item: ${task.title}`} className="text-muted-foreground" onClick={onEdit}><Pencil className="size-4" /></Button>
        <Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={`Excluir item: ${task.title}`} className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={onDelete}><Trash2 className="size-4" /></Button>
      </div>
      <div className="lg:hidden"><DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" disabled={disabled} aria-label={`Ações do item: ${task.title}`}><MoreHorizontal className="size-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}><Pencil />Editar item</DropdownMenuItem>
          {expense && <DropdownMenuItem onSelect={() => onOpenBudget(expense)}><Wallet />Ver no orçamento</DropdownMenuItem>}
          <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950" onSelect={onDelete}><Trash2 />Excluir item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu></div>
    </div>
  );
}
