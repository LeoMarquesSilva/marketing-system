"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OpsPlannerContext, OpsTaskStatus, OpsTaskSummary } from "@/lib/ops-planner/types";
import type { User } from "@/lib/users";
import { errorMessage, opsApi } from "./ops-client";
import { createPayload, draftProblem, emptyDraft, TaskForm, type TaskDraft } from "./task-form";

export interface TaskCreateDefaults {
  spaceId: string;
  listId?: string | null;
  status?: OpsTaskStatus;
  dueDate?: string;
}

export function TaskCreateDialog({
  defaults,
  context,
  assignable,
  onClose,
  onCreated,
}: {
  defaults: TaskCreateDefaults;
  context: OpsPlannerContext;
  assignable: User[];
  onClose: () => void;
  onCreated: (task: OpsTaskSummary) => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>(() => ({
    ...emptyDraft(defaults.spaceId, { listId: defaults.listId, assigneeId: context.me.id, parentDue: defaults.dueDate }),
    status: defaults.status ?? "a_fazer",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const problem = draftProblem(draft);
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const { task } = await opsApi.post<{ task: OpsTaskSummary }>("/tasks", createPayload(draft));
      onCreated(task);
    } catch (cause) {
      setError(errorMessage(cause));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-lg">Nova tarefa</DialogTitle>
          <DialogDescription>Entra no espaço escolhido e aparece em Minhas tarefas de cada responsável.</DialogDescription>
        </DialogHeader>
        <form
          id="ops-task-create"
          className="relative min-h-0 flex-1 overflow-y-auto"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <TaskForm draft={draft} onChange={setDraft} context={context} assignable={assignable} showStatus />
        </form>
        {error && (
          <p role="alert" className="mx-6 mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-4">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="ops-task-create" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Criar tarefa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
