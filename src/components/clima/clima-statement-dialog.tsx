"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SURVEY_BLOCKS } from "@/lib/clima-mock-data";
import {
  favorability,
  plansForTheme,
  resolveResponsibles,
  type ThemeSummary,
} from "@/lib/clima-metrics";
import { SCORE_LABELS, type ActionPlan, type Statement } from "@/lib/clima-types";
import type { User } from "@/lib/users";
import { PracticeBadge } from "./practice-badge";
import {
  DivergingBar,
  FavorabilityPill,
  LIKERT_COLORS,
  PeopleAvatars,
  PlanStatusBadge,
  ThemeIcon,
} from "./clima-visuals";

interface ClimaStatementDialogProps {
  statement: Statement | null;
  theme: ThemeSummary | undefined;
  planosAcao: ActionPlan[];
  users: User[];
  onClose: () => void;
  onOpenTheme?: (themeId: string) => void;
}

export function ClimaStatementDialog({
  statement,
  theme,
  planosAcao,
  users,
  onClose,
  onOpenTheme,
}: ClimaStatementDialogProps) {
  if (!statement) return null;
  const f = favorability(statement.scores);
  const total = statement.scores.reduce((a, b) => a + b, 0) || 1;
  const plans = plansForTheme(statement.themeId, planosAcao);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b p-5 pr-12">
          <div className="flex items-start gap-3">
            <ThemeIcon id={statement.themeId} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <DialogTitle className="leading-snug">{statement.text}</DialogTitle>
              <DialogDescription>
                {theme ? `${theme.dimension.name} · ${theme.theme.name}` : "Afirmação"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <FavorabilityPill value={f.favorable} />
              {statement.practiceType && <PracticeBadge type={statement.practiceType} />}
            </div>
            <DivergingBar scores={statement.scores} className="h-4" />
            <ul className="space-y-1.5">
              {SCORE_LABELS.map((label, i) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: LIKERT_COLORS[i] }} aria-hidden />
                  <span className="flex-1 text-muted-foreground">{label}</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {(((statement.scores[i] ?? 0) / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Pergunta no board: {SURVEY_BLOCKS[statement.origin]}
            </p>
          </section>

          {statement.actions && statement.actions.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Ações sugeridas pela equipe</h3>
              <ul className="flex flex-wrap gap-2">
                {statement.actions.map((a) => (
                  <li key={a} className="rounded-md bg-muted px-2 py-1 text-sm text-foreground">
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Planos de ação do tema</h3>
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum plano ligado a este tema.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {plans.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                    <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{p.title}</p>
                    <PeopleAvatars people={resolveResponsibles(p.responsible, users)} className="max-w-[12rem]" />
                    <PlanStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <DialogFooter className="border-t px-5 py-3">
          {onOpenTheme && (
            <Button variant="outline" onClick={() => onOpenTheme(statement.themeId)}>
              Ver tema
            </Button>
          )}
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
