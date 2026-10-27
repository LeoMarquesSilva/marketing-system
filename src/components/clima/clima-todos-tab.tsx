"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, List, LayoutGrid, Trash2, Check } from "lucide-react";
import type { ThemeSummary } from "@/lib/clima-metrics";
import type { ActionPlan, ClimaTodo } from "@/lib/clima-types";
import type { User } from "@/lib/users";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import { ClimaTodoFields, NONE_VALUE, draftToTodo, emptyDraft } from "./clima-todo-form";

interface ClimaTodosTabProps {
  todos: ClimaTodo[];
  onAddTodo: (todo: ClimaTodo) => void;
  onRemoveTodo: (id: string) => void;
  onUpdateTodo: (
    id: string,
    partial: Partial<Pick<ClimaTodo, "status" | "responsible">>
  ) => void;
  users?: User[];
  planosAcao: ActionPlan[];
  themes: ThemeSummary[];
}

/** Tema e plano ligados à tarefa, para saber de onde ela veio */
function TodoLinks({
  todo,
  planosAcao,
  themes,
}: {
  todo: ClimaTodo;
  planosAcao: ActionPlan[];
  themes: ThemeSummary[];
}) {
  const theme = themes.find((t) => t.theme.id === todo.indicatorId);
  const plan = planosAcao.find((p) => p.id === todo.actionPlanId);
  if (!theme && !plan) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {theme && (
        <span className="rounded-md bg-[#47cdd0]/15 px-2 py-0.5 text-xs text-[#285f7a]">
          {theme.theme.name} · {Math.round(theme.favorability.favorable)}%
        </span>
      )}
      {plan && (
        <span className="max-w-[16rem] truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {plan.title}
        </span>
      )}
    </span>
  );
}

export function ClimaTodosTab({
  todos,
  onAddTodo,
  onRemoveTodo,
  onUpdateTodo,
  users = [],
  planosAcao,
  themes,
}: ClimaTodosTabProps) {
  const [viewMode, setViewMode] = useState<"lista" | "kanban">("lista");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());

  const addTodo = () => {
    if (!draft.title.trim()) return;
    onAddTodo({
      ...draftToTodo(draft),
      id: `t${Date.now()}`,
      createdAt: new Date().toISOString(),
    });
    setDraft(emptyDraft());
    setDialogOpen(false);
  };

  const avatarOf = (name?: string) => users.find((u) => u.name === name)?.avatar_url ?? null;

  const removeTodo = (id: string) => {
    onRemoveTodo(id);
  };

  const toggleStatus = (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const newStatus =
      todo.status === "concluido" ? "pendente" : ("concluido" as const);
    onUpdateTodo(id, { status: newStatus });
  };

  const updateResponsible = (id: string, value: string) => {
    onUpdateTodo(id, {
      responsible: value === NONE_VALUE ? undefined : value,
    });
  };

  const byStatus = {
    pendente: todos.filter((t) => t.status === "pendente"),
    em_andamento: todos.filter((t) => t.status === "em_andamento"),
    concluido: todos.filter((t) => t.status === "concluido"),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">To-Dos e Tarefas</h2>
          <p className="text-sm text-muted-foreground">
            Tarefas vinculadas a indicadores ou planos de ação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-1">
            <button
              type="button"
              onClick={() => setViewMode("lista")}
              className={`rounded-md p-2 ${
                viewMode === "lista"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Lista"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`rounded-md p-2 ${
                viewMode === "kanban"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Kanban"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nova tarefa
          </Button>
        </div>
      </div>

      {viewMode === "lista" ? (
        <Card className="rounded-xl">
          <CardContent className="p-0">
            <ul className="divide-y">
              {todos.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/30"
                >
                  <button
                    type="button"
                    onClick={() => toggleStatus(t.id)}
                    className={`shrink-0 rounded-full border-2 p-1 ${
                      t.status === "concluido"
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted-foreground/30 hover:border-emerald-500"
                    }`}
                  >
                    {t.status === "concluido" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="h-4 w-4 block" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium ${
                        t.status === "concluido"
                          ? "text-muted-foreground line-through"
                          : ""
                      }`}
                    >
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="text-sm text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                    <TodoLinks todo={t} planosAcao={planosAcao} themes={themes} />
                    {users.length > 0 ? (
                      <div className="mt-1 flex items-center gap-2">
                      {t.responsible && (
                        <EmployeeAvatar name={t.responsible} avatarUrl={avatarOf(t.responsible)} className="h-6 w-6" />
                      )}
                      <Select
                        value={t.responsible ?? NONE_VALUE}
                        onValueChange={(v) => updateResponsible(t.id, v)}
                      >
                        <SelectTrigger className="h-7 w-auto max-w-[180px] border-dashed text-xs">
                          <SelectValue placeholder="Selecione o advogado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>Nenhum</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.name}>
                              {u.name}
                              {u.department ? ` (${u.department})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      </div>
                    ) : (
                      t.responsible && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.responsible}
                        </p>
                      )
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTodo(t.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(["pendente", "em_andamento", "concluido"] as const).map((status) => (
            <div
              key={status}
              className="rounded-xl border bg-muted/30 p-4 min-h-[150px]"
            >
              <h3 className="font-semibold text-foreground mb-3 capitalize">
                {status.replace("_", " ")}
              </h3>
              <div className="space-y-2">
                {byStatus[status].map((t) => (
                  <Card key={t.id} className="rounded-lg">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${
                            t.status === "concluido"
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {t.title}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => removeTodo(t.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <TodoLinks todo={t} planosAcao={planosAcao} themes={themes} />
                      {users.length > 0 && (
                        <Select
                          value={t.responsible ?? NONE_VALUE}
                          onValueChange={(v) => updateResponsible(t.id, v)}
                        >
                          <SelectTrigger className="mt-2 h-7 w-full max-w-full border-dashed text-xs">
                            <SelectValue placeholder="Advogado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>Nenhum</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.name}>
                                {u.name}
                                {u.department ? ` (${u.department})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleStatus(t.id)}
                        className="mt-2 block text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t.status === "concluido"
                          ? "Desmarcar"
                          : "Marcar concluído"}
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b p-5 pr-12">
            <DialogTitle>Nova tarefa</DialogTitle>
            <DialogDescription>
              Ligue a tarefa a um tema ou plano para acompanhar o foco de ação.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <ClimaTodoFields
              draft={draft}
              onChange={setDraft}
              users={users}
              planosAcao={planosAcao}
              themes={themes}
            />
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addTodo} disabled={!draft.title.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
