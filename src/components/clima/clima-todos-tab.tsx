"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import type { ClimaTodo } from "@/lib/clima-types";
import type { User } from "@/lib/users";
import { useAuth } from "@/contexts/auth-context";

const NONE_VALUE = "__none__";

interface ClimaTodosTabProps {
  todos: ClimaTodo[];
  onAddTodo: (todo: ClimaTodo) => void;
  onRemoveTodo: (id: string) => void;
  onUpdateTodo: (
    id: string,
    partial: Partial<Pick<ClimaTodo, "status" | "responsible">>
  ) => void;
  users?: User[];
}

export function ClimaTodosTab({
  todos,
  onAddTodo,
  onRemoveTodo,
  onUpdateTodo,
  users = [],
}: ClimaTodosTabProps) {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<"lista" | "kanban">("lista");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newResponsible, setNewResponsible] = useState<string>(NONE_VALUE);

  const addTodo = () => {
    if (!newTitle.trim()) return;
    onAddTodo({
      id: `t${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      responsible:
        newResponsible === NONE_VALUE ? undefined : newResponsible,
      status: "pendente",
      priority: "normal",
      createdAt: new Date().toISOString(),
    });
    setNewTitle("");
    setNewDesc("");
    setNewResponsible(NONE_VALUE);
    setDialogOpen(false);
  };

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
                    {users.length > 0 ? (
                      <Select
                        value={t.responsible ?? NONE_VALUE}
                        onValueChange={(v) => updateResponsible(t.id, v)}
                      >
                        <SelectTrigger className="mt-1 h-7 w-auto max-w-[180px] border-dashed text-xs">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="todo-title">Título</Label>
              <Input
                id="todo-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Agendar reunião de feedback"
              />
            </div>
            <div>
              <Label htmlFor="todo-desc">Descrição (opcional)</Label>
              <Input
                id="todo-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Detalhes da tarefa"
              />
            </div>
            {users.length > 0 && (
              <div>
                <Label htmlFor="todo-responsible">Advogado / Responsável</Label>
                <Select
                  value={newResponsible}
                  onValueChange={setNewResponsible}
                >
                  <SelectTrigger id="todo-responsible">
                    <SelectValue placeholder="Selecione um advogado" />
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
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addTodo} disabled={!newTitle.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
