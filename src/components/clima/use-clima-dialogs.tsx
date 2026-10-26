"use client";

import { useCallback, useState } from "react";
import type { ThemeSummary } from "@/lib/clima-metrics";
import type { ActionPlan, ClimaTodo, Statement } from "@/lib/clima-types";
import type { User } from "@/lib/users";
import { ClimaStatementDialog } from "./clima-statement-dialog";
import { ClimaThemeDialog, type ThemeDialogMode } from "./clima-theme-dialog";

export interface ClimaDialogsContext {
  themes: ThemeSummary[];
  planosAcao: ActionPlan[];
  todos: ClimaTodo[];
  users: User[];
  onCreateTodo: (todo: Omit<ClimaTodo, "id" | "createdAt">) => Promise<boolean>;
}

/** Um modal por vez: afirmação → "Ver tema" troca para o modal do tema */
export function useClimaDialogs(ctx: ClimaDialogsContext) {
  const [themeId, setThemeId] = useState<string | null>(null);
  const [mode, setMode] = useState<ThemeDialogMode>("detalhe");
  const [statement, setStatement] = useState<Statement | null>(null);

  const openTheme = useCallback((id: string, initialMode: ThemeDialogMode = "detalhe") => {
    setStatement(null);
    setMode(initialMode);
    setThemeId(id);
  }, []);

  const openStatement = useCallback((s: Statement) => {
    setThemeId(null);
    setStatement(s);
  }, []);

  const themeSummary = ctx.themes.find((t) => t.theme.id === themeId) ?? null;

  const dialogs = (
    <>
      <ClimaThemeDialog
        summary={themeSummary}
        mode={mode}
        onModeChange={setMode}
        onClose={() => setThemeId(null)}
        themes={ctx.themes}
        planosAcao={ctx.planosAcao}
        todos={ctx.todos}
        users={ctx.users}
        onCreateTodo={ctx.onCreateTodo}
      />
      <ClimaStatementDialog
        statement={statement}
        theme={statement ? ctx.themes.find((t) => t.theme.id === statement.themeId) : undefined}
        planosAcao={ctx.planosAcao}
        users={ctx.users}
        onClose={() => setStatement(null)}
        onOpenTheme={(id) => openTheme(id)}
      />
    </>
  );

  return { openTheme, openStatement, dialogs };
}
