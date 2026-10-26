"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  FAVORABLE_TARGET,
  HIGH_NEUTRAL,
  allStatements,
  favorability,
  type ThemeSummary,
} from "@/lib/clima-metrics";
import type {
  ActionPlan,
  ClimaTodo,
  Indicator,
  PracticeType,
  Statement,
} from "@/lib/clima-types";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";
import { PracticeBadge } from "./practice-badge";
import {
  DimensionIcon,
  DivergingBar,
  FavorabilityPill,
  LikertLegend,
  ThemeIcon,
  favorableTextClass,
} from "./clima-visuals";
import { useClimaDialogs } from "./use-clima-dialogs";

const PRACTICE_FILTERS: { id: PracticeType | "todas"; label: string }[] = [
  { id: "todas", label: "Todas as práticas" },
  { id: "acelerar", label: "Acelerar" },
  { id: "evitar", label: "Evitar" },
  { id: "comecar", label: "Começar" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
        active
          ? "border-[#47cdd0]/50 bg-[#47cdd0]/18 font-medium text-[#285f7a]"
          : "border-[#dce9eb] bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

interface ClimaIndicadoresTabProps {
  indicadores: Indicator[];
  themes: ThemeSummary[];
  planosAcao: ActionPlan[];
  todos: ClimaTodo[];
  users: User[];
  onCreateTodo: (todo: Omit<ClimaTodo, "id" | "createdAt">) => Promise<boolean>;
}

export function ClimaIndicadoresTab({
  indicadores,
  themes,
  planosAcao,
  todos,
  users,
  onCreateTodo,
}: ClimaIndicadoresTabProps) {
  const [dimensionId, setDimensionId] = useState<string>("todas");
  const [practice, setPractice] = useState<PracticeType | "todas">("todas");
  const [sort, setSort] = useState<"tema" | "pior">("tema");
  const { openTheme, openStatement, dialogs } = useClimaDialogs({
    themes,
    planosAcao,
    todos,
    users,
    onCreateTodo,
  });

  const matches = (s: Statement) => practice === "todas" || s.practiceType === practice;
  const visibleDimensions = indicadores.filter((d) => dimensionId === "todas" || d.id === dimensionId);
  const visible = allStatements(visibleDimensions).filter(matches);
  const flat = [...visible].sort(
    (a, b) => favorability(a.scores).favorable - favorability(b.scores).favorable
  );
  const themeName = (id: string) => themes.find((t) => t.theme.id === id)?.theme.name ?? "";

  const statementRow = (s: Statement, showTheme: boolean) => {
    const f = favorability(s.scores);
    return (
      <li key={s.id}>
        <button
          type="button"
          onClick={() => openStatement(s)}
          className="grid w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_3.5rem] sm:gap-4"
        >
          <span className="min-w-0">
            <span className="block text-sm text-foreground">{s.text}</span>
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {showTheme && <span>{themeName(s.themeId)}</span>}
              {s.practiceType && <PracticeBadge type={s.practiceType} />}
              {f.neutral >= HIGH_NEUTRAL && (
                <span className="text-amber-800 dark:text-amber-300">{Math.round(f.neutral)}% neutro</span>
              )}
            </span>
          </span>
          <DivergingBar scores={s.scores} />
          <span className={cn("text-right text-sm font-semibold tabular-nums", favorableTextClass(f.favorable))}>
            {Math.round(f.favorable)}%
          </span>
        </button>
      </li>
    );
  };

  const total = visible.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Afirmações</h2>
        <p className="text-sm text-muted-foreground">
          Cada barra parte do eixo central: discordância à esquerda, concordância à direita e o neutro
          dividido ao meio. O número é o % favorável (referência {FAVORABLE_TARGET}%). Clique para ver o detalhe.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por dimensão">
          <Chip active={dimensionId === "todas"} onClick={() => setDimensionId("todas")}>
            Todas as dimensões
          </Chip>
          {indicadores.map((d) => (
            <Chip key={d.id} active={dimensionId === d.id} onClick={() => setDimensionId(d.id)}>
              <DimensionIcon id={d.id} />
              {d.name}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por prática">
            {PRACTICE_FILTERS.map((p) => (
              <Chip key={p.id} active={practice === p.id} onClick={() => setPractice(p.id)}>
                {p.label}
              </Chip>
            ))}
          </div>
          <div className="flex rounded-lg border p-1" role="group" aria-label="Ordem">
            {(
              [
                ["tema", "Por tema"],
                ["pior", "Menos favoráveis primeiro"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                aria-pressed={sort === key}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  sort === key ? "bg-[#47cdd0]/18 font-medium text-[#285f7a]" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LikertLegend />
          <span className="text-xs text-muted-foreground">
            {total} {total === 1 ? "afirmação" : "afirmações"}
          </span>
        </div>
      </div>

      {total === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma afirmação com esse filtro.
        </p>
      ) : sort === "pior" ? (
        <Card className="rounded-lg py-0">
          <CardContent className="px-0">
            <ul className="divide-y">{flat.map((s) => statementRow(s, true))}</ul>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {visibleDimensions.map((dim) => {
            const dimThemes = themes.filter(
              (t) => t.dimension.id === dim.id && t.statements.some(matches)
            );
            if (dimThemes.length === 0) return null;
            return (
              <Card key={dim.id} className="gap-0 overflow-hidden rounded-lg py-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DimensionIcon id={dim.id} className="h-5 w-5 text-[#347796]" />
                    <div>
                      <h3 className="font-semibold text-foreground">{dim.name}</h3>
                      <p className="text-sm text-muted-foreground">{dim.question}</p>
                    </div>
                  </div>
                </div>
                {dimThemes.map((t) => (
                  <section key={t.theme.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openTheme(t.theme.id)}
                      className="flex w-full items-center gap-3 bg-muted/30 px-4 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                    >
                      <ThemeIcon id={t.theme.id} className="h-7 w-7" />
                      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{t.theme.name}</span>
                      <FavorabilityPill value={t.favorability.favorable} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </button>
                    <ul className="divide-y">
                      {t.statements.filter(matches).map((s) => statementRow(s, false))}
                    </ul>
                  </section>
                ))}
              </Card>
            );
          })}
        </div>
      )}

      {dialogs}
    </div>
  );
}
