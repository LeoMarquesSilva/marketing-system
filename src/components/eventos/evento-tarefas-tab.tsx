"use client";

import Link from "next/link";
import { Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import {
  EVENT_TASK_STATUS_LABEL,
  isTaskOverdue,
  type EventTask,
  type EventTaskStatus,
} from "@/lib/eventos";
import type { User } from "@/lib/users";

export function EventoTarefasTab({
  tasks,
  users,
  newTaskTitle,
  setNewTaskTitle,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onSendPlanner,
}: {
  tasks: EventTask[];
  users: User[];
  newTaskTitle: string;
  setNewTaskTitle: (value: string) => void;
  onAddTask: () => void;
  onUpdateTask: (taskId: string, partial: Record<string, unknown>) => void;
  onDeleteTask: (taskId: string) => void;
  onSendPlanner: (task: EventTask) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Nova tarefa..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAddTask()}
        />
        <Button onClick={onAddTask}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarefa</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma tarefa ainda.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{task.title}</p>
                    {isTaskOverdue(task) && <span className="text-xs text-red-600">Atrasada</span>}
                    {task.marketingRequestId && (
                      <Link
                        href={`/solicitacoes?id=${task.marketingRequestId}`}
                        className="text-xs text-violet-600 hover:underline block mt-0.5"
                      >
                        No Planner
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    <UserSelectSearch
                      users={users}
                      value={task.assigneeId ?? ""}
                      onValueChange={(v) => onUpdateTask(task.id, { assigneeId: v || null })}
                      placeholder="Responsável"
                    />
                  </TableCell>
                  <TableCell>
                    <DatePickerField
                      value={task.dueDate ?? ""}
                      onChange={(v) => onUpdateTask(task.id, { dueDate: v || null })}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={task.status}
                      onValueChange={(v) => onUpdateTask(task.id, { status: v as EventTaskStatus })}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(EVENT_TASK_STATUS_LABEL) as EventTaskStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {EVENT_TASK_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!task.marketingRequestId && (
                        <Button variant="ghost" size="icon" title="Enviar ao Planner" onClick={() => onSendPlanner(task)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Excluir" onClick={() => onDeleteTask(task.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
