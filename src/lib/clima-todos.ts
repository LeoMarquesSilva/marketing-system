/**
 * CRUD de to-dos do módulo Clima Organizacional
 * Persistência no Supabase
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase/client";
import type { ClimaTodo } from "./clima-types";

type DbRow = {
  id: string;
  title: string;
  description: string | null;
  responsible: string | null;
  due_date: string | null;
  status: string;
  priority: string;
  action_plan_id: string | null;
  indicator_id: string | null;
  created_at: string;
};

function rowToTodo(row: DbRow): ClimaTodo {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    responsible: row.responsible ?? undefined,
    dueDate: row.due_date ?? undefined,
    status: row.status as ClimaTodo["status"],
    priority: row.priority as ClimaTodo["priority"],
    actionPlanId: row.action_plan_id ?? undefined,
    indicatorId: row.indicator_id ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchClimaTodos(
  client?: SupabaseClient
): Promise<ClimaTodo[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("clima_todos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar clima todos:", error);
    return [];
  }
  return (data ?? []).map(rowToTodo);
}

export async function insertClimaTodo(
  todo: Omit<ClimaTodo, "id" | "createdAt">
): Promise<ClimaTodo | null> {
  const { data, error } = await supabase
    .from("clima_todos")
    .insert({
      title: todo.title,
      description: todo.description ?? null,
      responsible: todo.responsible ?? null,
      due_date: todo.dueDate ?? null,
      status: todo.status,
      priority: todo.priority,
      action_plan_id: todo.actionPlanId ?? null,
      indicator_id: todo.indicatorId ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao inserir clima todo:", error);
    return null;
  }
  return rowToTodo(data as DbRow);
}

export async function updateClimaTodo(
  id: string,
  partial: Partial<Pick<ClimaTodo, "status" | "responsible" | "title" | "description" | "priority">>
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (partial.status != null) payload.status = partial.status;
  if (partial.responsible != null) payload.responsible = partial.responsible;
  if (partial.title != null) payload.title = partial.title;
  if (partial.description != null) payload.description = partial.description;
  if (partial.priority != null) payload.priority = partial.priority;

  const { error } = await supabase
    .from("clima_todos")
    .update(payload)
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar clima todo:", error);
    return false;
  }
  return true;
}

export async function deleteClimaTodo(id: string): Promise<boolean> {
  const { error } = await supabase.from("clima_todos").delete().eq("id", id);

  if (error) {
    console.error("Erro ao deletar clima todo:", error);
    return false;
  }
  return true;
}
