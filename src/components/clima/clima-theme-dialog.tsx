"use client";

import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  favorability,
  HIGH_NEUTRAL,
  personFromUserName,
  plansForTheme,
  resolveResponsibles,
  todosForTheme,
  type ThemeSummary,
} from "@/lib/clima-metrics";
import type { ActionPlan, ClimaTodo } from "@/lib/clima-types";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";
import { ClimaTodoFields, draftToTodo, emptyDraft, type TodoDraft } from "./clima-todo-form";
import {
  DivergingBar,
  FavorabilityBar,
  FavorabilityLegend,
  FavorabilityPill,
  LikertLegend,
  PeopleAvatars,
  PlanStatusBadge,
  ThemeIcon,
  favorableTextClass,
} from "./clima-visuals";

const TODO_STATUS: Record<ClimaTodo["status"], string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluída",
};

export type ThemeDialogMode = "detalhe" | "tarefa";

interface ClimaThemeDialogProps {
  summary: ThemeSummary | null;
  mode: ThemeDialogMode;
  onModeChange: (mode: ThemeDialogMode) => void;
  onClose: () => void;
  themes: ThemeSummary[];
  planosAcao: ActionPlan[];
  todos: ClimaTodo[];
  users: User[];
  onCreateTodo: (todo: Omit<ClimaTodo, "id" | "createdAt">) => Promise<boolean>;
}

/**
 * Detalhe de um tema: afirmações, planos e tarefas ligadas. "Nova tarefa"
 * troca o conteúdo do mesmo modal pelo formulário (sem empilhar modais).
 */
export function ClimaThemeDialog({
  summary,
  mode,
  onModeChange,
  onClose,
  themes,
  planosAcao,
  todos,
  users,
  onCreateTodo,
}: ClimaThemeDialogProps) {
  const [draft, setDraft] = useState<TodoDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastThemeId, setLastThemeId] = useState<string | null>(null);

  const themeId = summary?.theme.id ?? null;
  const plans = themeId ? plansForTheme(themeId, planosAcao) : [];
  if (themeId !== lastThemeId) {
    setLastThemeId(themeId);
    setError("");
    setDraft(
      emptyDraft({
        themeId: themeId ?? undefined,
        actionPlanId: plans.length === 1 ? plans[0].id : undefined,
      })
    );
  }

  if (!summary) return null;
  const { theme, dimension, statements, favorability: fav } = summary;
  const linkedTodos = todosForTheme(theme.id, planosAcao, todos);
  const sorted = [...statements].sort(
    (a, b) => favorability(a.scores).favorable - favorability(b.scores).favorable
  );

  const save = async () => {
    if (!draft.title.trim()) {
      setError("Dê um título para a tarefa.");
      return;
    }
    setSaving(true);
    const ok = await onCreateTodo(draftToTodo(draft));
    setSaving(false);
    if (!ok) {
      setError("Não foi possível criar a tarefa. Tente de novo.");
      return;
    }
    setDraft(emptyDraft({ themeId: theme.id, actionPlanId: draft.actionPlanId }));
    onModeChange("detalhe");
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader className="border-b p-5 pr-12">
          <div className="flex items-start gap-3">
            <ThemeIcon id={theme.id} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <DialogTitle className="leading-snug">
                {mode === "tarefa" ? `Nova tarefa · ${theme.name}` : theme.name}
              </DialogTitle>
              <DialogDescription>
                {dimension.name} · {statements.length}{" "}
                {statements.length === 1 ? "afirmação" : "afirmações"}
              </DialogDescription>
            </div>
            {mode === "detalhe" && <FavorabilityPill value={fav.favorable} className="mt-0.5" />}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {mode === "tarefa" ? (
            <div className="space-y-4">
              {error && (
                <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <ClimaTodoFields
                draft={draft}
                onChange={(d) => {
                  setDraft(d);
                  if (error) setError("");
                }}
                users={users}
                planosAcao={planosAcao}
                themes={themes}
              />
            </div>
          ) : (
            <div className="space-y-6">
              <section className="space-y-2">
                <FavorabilityBar value={fav} className="h-4" />
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span className="tabular-nums">
                    {Math.round(fav.favorable)}% favorável · {Math.round(fav.neutral)}% neutro ·{" "}
                    {Math.round(fav.unfavorable)}% desfavorável
                  </span>
                  <FavorabilityLegend />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Afirmações</h3>
                  <LikertLegend />
                </div>
                <ul className="divide-y rounded-lg border">
                  {sorted.map((s) => {
                    const f = favorability(s.scores);
                    return (
                      <li key={s.id} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_3.25rem] sm:items-center sm:gap-4">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground">{s.text}</p>
                          {f.neutral >= HIGH_NEUTRAL && (
                            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                              {Math.round(f.neutral)}% neutro: falta clareza sobre o tema
                            </p>
                          )}
                        </div>
                        <DivergingBar scores={s.scores} />
                        <span className={cn("text-right text-sm font-semibold tabular-nums", favorableTextClass(f.favorable))}>
                          {Math.round(f.favorable)}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Planos de ação ligados</h3>
                {plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum plano ataca este tema ainda. Crie uma tarefa para começar.
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {plans.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{p.title}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{p.when}</p>
                        </div>
                        <PeopleAvatars people={resolveResponsibles(p.responsible, users)} className="max-w-[12rem]" />
                        <PlanStatusBadge status={p.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Tarefas</h3>
                {linkedTodos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa ligada a este tema.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {linkedTodos.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                            t.status === "concluido"
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-muted-foreground/40"
                          )}
                          aria-hidden
                        >
                          {t.status === "concluido" && <Check className="h-3 w-3" />}
                        </span>
                        <p className={cn("min-w-0 flex-1 text-sm", t.status === "concluido" && "text-muted-foreground line-through")}>
                          {t.title}
                        </p>
                        <PeopleAvatars people={personFromUserName(t.responsible, users)} className="max-w-[10rem]" />
                        <span className="text-xs text-muted-foreground">{TODO_STATUS[t.status]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-5 py-3">
          {mode === "tarefa" ? (
            <>
              <Button variant="outline" onClick={() => onModeChange("detalhe")} disabled={saving}>
                Voltar
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Criar tarefa
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
              <Button onClick={() => onModeChange("tarefa")} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova tarefa
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
