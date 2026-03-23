"use client";

import { useState, useCallback } from "react";
import {
  insertClimaTodo,
  updateClimaTodo,
  deleteClimaTodo,
} from "@/lib/clima-todos";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BarChart3,
  Kanban,
  CheckSquare,
  Video,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import type { Indicator, ActionPlan, ClimaTodo } from "@/lib/clima-types";
import type { User } from "@/lib/users";
import type { QuantitativeIndicator } from "@/lib/clima-types";
import { ClimaDashboardTab } from "./clima-dashboard-tab";
import { ClimaIndicadoresTab } from "./clima-indicadores-tab";
import { ClimaPlanosTab } from "./clima-planos-tab";
import { ClimaTodosTab } from "./clima-todos-tab";
import { ClimaReuniaoTab } from "./clima-reuniao-tab";
import { ClimaAssistenteTab } from "./clima-assistente-tab";
import { ClimaMiroTab } from "./clima-miro-tab";

export type ClimaTabId =
  | "dashboard"
  | "indicadores"
  | "planos"
  | "todos"
  | "reuniao"
  | "assistente"
  | "miro";

interface ClimaClientProps {
  indicadores: Indicator[];
  planosAcao: ActionPlan[];
  indicadoresQuantitativos: QuantitativeIndicator[];
  initialTodos?: ClimaTodo[];
  users?: User[];
}

const TABS: { id: ClimaTabId; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "indicadores", label: "Indicadores", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "planos", label: "Planos de Ação", icon: <Kanban className="h-4 w-4" /> },
  { id: "todos", label: "To-Dos", icon: <CheckSquare className="h-4 w-4" /> },
  { id: "reuniao", label: "Modo Reunião", icon: <Video className="h-4 w-4" /> },
  { id: "assistente", label: "Assistente IA", icon: <Sparkles className="h-4 w-4" /> },
  { id: "miro", label: "Ver Miro", icon: <ExternalLink className="h-4 w-4" /> },
];

export function ClimaClient({
  indicadores,
  planosAcao,
  indicadoresQuantitativos,
  initialTodos = [],
  users = [],
}: ClimaClientProps) {
  const [activeTab, setActiveTab] = useState<ClimaTabId>("dashboard");
  const [todos, setTodos] = useState<ClimaTodo[]>(initialTodos);

  const handleAddTodo = useCallback(async (todo: ClimaTodo) => {
    const created = await insertClimaTodo({
      title: todo.title,
      description: todo.description,
      responsible: todo.responsible,
      dueDate: todo.dueDate,
      status: todo.status,
      priority: todo.priority,
      actionPlanId: todo.actionPlanId,
      indicatorId: todo.indicatorId,
    });
    if (created) {
      setTodos((prev) => [created, ...prev]);
    }
  }, []);

  const handleRemoveTodo = useCallback(async (id: string) => {
    const ok = await deleteClimaTodo(id);
    if (ok) {
      setTodos((prev) => prev.filter((t) => t.id !== id));
    }
  }, []);

  const handleUpdateTodo = useCallback(
    async (
      id: string,
      partial: Partial<Pick<ClimaTodo, "status" | "responsible">>
    ) => {
      const ok = await updateClimaTodo(id, partial);
      if (ok) {
        setTodos((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, ...partial } : t
          )
        );
      }
    },
    []
  );

  const handleAddTodoFromReuniao = useCallback(
    async (todo: Omit<ClimaTodo, "id" | "createdAt">) => {
      const created = await insertClimaTodo(todo);
      if (created) {
        setTodos((prev) => [created, ...prev]);
      }
    },
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Clima Organizacional
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pesquisa de clima, indicadores, planos de ação e colaboração
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="gap-2"
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Conteúdo das tabs */}
      {activeTab === "dashboard" && (
        <ClimaDashboardTab
          indicadores={indicadores}
          indicadoresQuantitativos={indicadoresQuantitativos}
        />
      )}
      {activeTab === "indicadores" && (
        <ClimaIndicadoresTab indicadores={indicadores} />
      )}
      {activeTab === "planos" && (
        <ClimaPlanosTab planosAcao={planosAcao} />
      )}
      {activeTab === "todos" && (
        <ClimaTodosTab
          todos={todos}
          onAddTodo={handleAddTodo}
          onRemoveTodo={handleRemoveTodo}
          onUpdateTodo={handleUpdateTodo}
          users={users}
        />
      )}
      {activeTab === "reuniao" && (
        <ClimaReuniaoTab
          indicadores={indicadores}
          planosAcao={planosAcao}
          onAddTodo={handleAddTodoFromReuniao}
        />
      )}
      {activeTab === "assistente" && (
        <ClimaAssistenteTab
          indicadores={indicadores}
          planosAcao={planosAcao}
        />
      )}
      {activeTab === "miro" && <ClimaMiroTab />}
    </div>
  );
}
