"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ThemeSummary } from "@/lib/clima-metrics";
import type { ActionPlan, ClimaTodo } from "@/lib/clima-types";
import type { User } from "@/lib/users";

export const NONE_VALUE = "__none__";

export interface TodoDraft {
  title: string;
  description: string;
  responsible: string;
  dueDate: string;
  actionPlanId: string;
  themeId: string;
}

export function emptyDraft(partial: Partial<TodoDraft> = {}): TodoDraft {
  return {
    title: "",
    description: "",
    responsible: NONE_VALUE,
    dueDate: "",
    actionPlanId: NONE_VALUE,
    themeId: NONE_VALUE,
    ...partial,
  };
}

export function draftToTodo(draft: TodoDraft): Omit<ClimaTodo, "id" | "createdAt"> {
  const value = (v: string) => (v === NONE_VALUE || !v.trim() ? undefined : v.trim());
  return {
    title: draft.title.trim(),
    description: value(draft.description),
    responsible: value(draft.responsible),
    dueDate: value(draft.dueDate),
    actionPlanId: value(draft.actionPlanId),
    indicatorId: value(draft.themeId),
    status: "pendente",
    priority: "normal",
  };
}

interface ClimaTodoFieldsProps {
  draft: TodoDraft;
  onChange: (draft: TodoDraft) => void;
  users: User[];
  planosAcao: ActionPlan[];
  themes: ThemeSummary[];
}

export function ClimaTodoFields({ draft, onChange, users, planosAcao, themes }: ClimaTodoFieldsProps) {
  const set = (patch: Partial<TodoDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="clima-todo-title">Título</Label>
        <Input
          id="clima-todo-title"
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Agendar reunião de alinhamento de PLR"
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="clima-todo-desc">Descrição (opcional)</Label>
        <Input
          id="clima-todo-desc"
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Levar a proposta revisada para os sócios"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="clima-todo-theme">Tema</Label>
        <Select value={draft.themeId} onValueChange={(v) => set({ themeId: v })}>
          <SelectTrigger id="clima-todo-theme" className="w-full">
            <SelectValue placeholder="Sem tema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>Sem tema</SelectItem>
            {themes.map((t) => (
              <SelectItem key={t.theme.id} value={t.theme.id}>
                {t.theme.name} · {Math.round(t.favorability.favorable)}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="clima-todo-plan">Plano de ação</Label>
        <Select value={draft.actionPlanId} onValueChange={(v) => set({ actionPlanId: v })}>
          <SelectTrigger id="clima-todo-plan" className="w-full">
            <SelectValue placeholder="Sem plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>Sem plano</SelectItem>
            {planosAcao.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {users.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="clima-todo-responsible">Responsável</Label>
          <Select value={draft.responsible} onValueChange={(v) => set({ responsible: v })}>
            <SelectTrigger id="clima-todo-responsible" className="w-full">
              <SelectValue placeholder="Sem responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Sem responsável</SelectItem>
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
      <div className="space-y-2">
        <Label htmlFor="clima-todo-due">Prazo (opcional)</Label>
        <Input
          id="clima-todo-due"
          type="date"
          value={draft.dueDate}
          onChange={(e) => set({ dueDate: e.target.value })}
        />
      </div>
    </div>
  );
}
