"use client";

import { useMemo, useState } from "react";
import { BarChart3, ChevronRight, ListChecks, Plus, Smile, Star, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  FAVORABLE_TARGET,
  HIGH_NEUTRAL,
  attentionStatements,
  averageFavorability,
  favorability,
  focusThemes,
  overallSummary,
  plansForTheme,
  resolveResponsibles,
  todosForTheme,
  type ThemeSummary,
} from "@/lib/clima-metrics";
import type { ActionPlan, ClimaTodo, Indicator, QuantitativeIndicator } from "@/lib/clima-types";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";
import { StatementChart } from "./statement-chart";
import {
  DimensionIcon,
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
import { useClimaDialogs } from "./use-clima-dialogs";

function AverageScoreDisplay({
  score,
  max,
  responseCount,
}: {
  score: number;
  max: number;
  responseCount?: number;
}) {
  const filledStars = Math.round((score / max) * 10);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Star
              key={i}
              className={`h-5 w-5 ${
                i < filledStars
                  ? "fill-amber-400 text-amber-500"
                  : "fill-muted text-muted-foreground/40"
              }`}
            />
          ))}
        </div>
        <span className="text-lg font-semibold tabular-nums">
          {score.toFixed(2)}/{max}
        </span>
      </div>
      {responseCount != null && (
        <p className="text-xs text-muted-foreground">{responseCount} respostas</p>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-lg border border-[#dce9eb] bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

interface ClimaDashboardTabProps {
  indicadores: Indicator[];
  themes: ThemeSummary[];
  indicadoresQuantitativos: QuantitativeIndicator[];
  planosAcao: ActionPlan[];
  todos: ClimaTodo[];
  users: User[];
  onCreateTodo: (todo: Omit<ClimaTodo, "id" | "createdAt">) => Promise<boolean>;
}

export function ClimaDashboardTab({
  indicadores,
  themes,
  indicadoresQuantitativos,
  planosAcao,
  todos,
  users,
  onCreateTodo,
}: ClimaDashboardTabProps) {
  const [order, setOrder] = useState<"dimensao" | "pior">("dimensao");
  const { openTheme, openStatement, dialogs } = useClimaDialogs({
    themes,
    planosAcao,
    todos,
    users,
    onCreateTodo,
  });

  const overall = useMemo(() => overallSummary(indicadores), [indicadores]);
  const focos = useMemo(() => focusThemes(themes), [themes]);
  const atencao = useMemo(() => attentionStatements(indicadores), [indicadores]);
  const felicidade = indicadoresQuantitativos.find((q) => q.averageScore != null);
  const themeName = (id: string) => themes.find((t) => t.theme.id === id)?.theme.name ?? "";

  const themeRow = (t: ThemeSummary) => (
    <li key={t.theme.id}>
      <button
        type="button"
        onClick={() => openTheme(t.theme.id)}
        className="grid w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_3.5rem_1rem] sm:gap-4"
      >
        <span className="flex min-w-0 items-center gap-3">
          <ThemeIcon id={t.theme.id} className="h-8 w-8" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{t.theme.name}</span>
            <span className="block text-xs text-muted-foreground">
              {order === "pior" ? `${t.dimension.name} · ` : ""}
              {t.statements.length} {t.statements.length === 1 ? "afirmação" : "afirmações"}
            </span>
          </span>
        </span>
        <FavorabilityBar value={t.favorability} />
        <span className={cn("text-right text-sm font-semibold tabular-nums", favorableTextClass(t.favorability.favorable))}>
          {Math.round(t.favorability.favorable)}%
        </span>
        <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
      </button>
    </li>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Visão geral</h2>
        <p className="text-sm text-muted-foreground">
          Afirmações agrupadas pelo modelo GPTW. O índice é o % favorável (Concordo + Concordo
          totalmente) e a referência é {FAVORABLE_TARGET}%, a nota mínima de certificação do GPTW.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Target className="h-4 w-4" aria-hidden />}
          label="Índice favorável geral"
          value={`${Math.round(overall.favorable)}%`}
          caption={
            overall.favorable >= FAVORABLE_TARGET
              ? `Acima da referência de ${FAVORABLE_TARGET}%`
              : `Abaixo da referência de ${FAVORABLE_TARGET}%`
          }
        />
        <StatTile
          icon={<Users className="h-4 w-4" aria-hidden />}
          label="Respostas"
          value={String(felicidade?.responseCount ?? "—")}
          caption="Adesão depende do total de pessoas na época"
        />
        <StatTile
          icon={<Smile className="h-4 w-4" aria-hidden />}
          label="Felicidade no trabalho"
          value={felicidade?.averageScore != null ? felicidade.averageScore.toLocaleString("pt-BR") : "—"}
          caption={`Média de 0 a ${felicidade?.scaleMax ?? 10}`}
        />
        <StatTile
          icon={<ListChecks className="h-4 w-4" aria-hidden />}
          label={`Afirmações acima de ${FAVORABLE_TARGET}%`}
          value={`${overall.aboveTarget} de ${overall.total}`}
          caption={`${overall.total - overall.aboveTarget} pedem atenção`}
        />
      </div>

      <Card className="rounded-lg">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-base font-semibold text-foreground">Mapa por tema</span>
              <p className="text-sm text-muted-foreground">Clique em um tema para ver afirmações, planos e tarefas.</p>
            </div>
            <div className="flex rounded-lg border p-1" role="group" aria-label="Ordem dos temas">
              {(
                [
                  ["dimensao", "Por dimensão"],
                  ["pior", "Do pior para o melhor"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOrder(key)}
                  aria-pressed={order === key}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    order === key ? "bg-[#47cdd0]/18 font-medium text-[#285f7a]" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <FavorabilityLegend />
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {order === "pior" ? (
            <ul className="divide-y border-t">
              {[...themes]
                .sort((a, b) => a.favorability.favorable - b.favorability.favorable)
                .map(themeRow)}
            </ul>
          ) : (
            <div className="border-t">
              {indicadores.map((dim) => {
                const dimFav = averageFavorability(dim.statements).favorable;
                return (
                  <section key={dim.id} className="border-b last:border-b-0">
                    <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-2">
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <DimensionIcon id={dim.id} className="text-[#347796]" />
                        {dim.name}
                        <span className="hidden font-normal text-muted-foreground md:inline">· {dim.question}</span>
                      </span>
                      <FavorabilityPill value={dimFav} />
                    </div>
                    <ul className="divide-y">
                      {themes.filter((t) => t.dimension.id === dim.id).map(themeRow)}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Focos de ação</h3>
          <p className="text-sm text-muted-foreground">
            Temas abaixo de {FAVORABLE_TARGET}%, do pior para o melhor. Para cada foco, escolha poucas
            ações, dê dono e prazo, e comunique o andamento à equipe.
          </p>
        </div>
        {focos.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Todos os temas estão acima de {FAVORABLE_TARGET}%.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {focos.map((t) => {
              const plans = plansForTheme(t.theme.id, planosAcao);
              const linked = todosForTheme(t.theme.id, planosAcao, todos);
              const done = linked.filter((x) => x.status === "concluido").length;
              return (
                <article key={t.theme.id} className="flex flex-col rounded-lg border border-[#dce9eb] bg-card p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <ThemeIcon id={t.theme.id} />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-foreground">{t.theme.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {t.dimension.name} · {Math.round(t.favorability.neutral)}% neutro ·{" "}
                        {Math.round(t.favorability.unfavorable)}% desfavorável
                      </p>
                    </div>
                    <FavorabilityPill value={t.favorability.favorable} />
                  </div>
                  <FavorabilityBar value={t.favorability} className="mt-3" />

                  <div className="mt-4 flex-1 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Planos ligados</p>
                    {plans.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum plano ainda.</p>
                    ) : (
                      <ul className="space-y-2">
                        {plans.map((p) => (
                          <li key={p.id} className="flex items-center gap-3">
                            <PeopleAvatars people={resolveResponsibles(p.responsible, users)} className="w-0 min-w-0 flex-1" />
                            <PlanStatusBadge status={p.status} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {plans.length > 0 && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {plans.map((p) => p.title).join(" · ")}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <span className="text-sm text-muted-foreground">
                      {linked.length === 0
                        ? "Nenhuma tarefa"
                        : `${linked.length} ${linked.length === 1 ? "tarefa" : "tarefas"} · ${done} ${done === 1 ? "concluída" : "concluídas"}`}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openTheme(t.theme.id)}>
                        Ver tema
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openTheme(t.theme.id, "tarefa")}>
                        <Plus className="h-4 w-4" />
                        Nova tarefa
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Card className="rounded-lg">
        <CardHeader className="gap-3">
          <div>
            <span className="text-base font-semibold text-foreground">Afirmações que pedem atenção</span>
            <p className="text-sm text-muted-foreground">
              Abaixo de {FAVORABLE_TARGET}% favorável. Discordância à esquerda do eixo, concordância à direita.
            </p>
          </div>
          <LikertLegend />
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <ul className="divide-y border-t">
            {atencao.map((s) => {
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
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {themeName(s.themeId)}
                        {f.neutral >= HIGH_NEUTRAL && (
                          <span className="text-amber-800 dark:text-amber-300">· {Math.round(f.neutral)}% neutro</span>
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
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-lg">
        <CardHeader>
          <span className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="h-4 w-4" />
            Indicadores quantitativos
          </span>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {indicadoresQuantitativos.map((q) => (
              <div key={q.id} className="min-w-0 overflow-hidden rounded-lg border p-3">
                <p className="truncate text-sm font-medium">{q.name}</p>
                {q.question && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{q.question}</p>
                )}
                <div className="mt-2 min-h-[100px] overflow-hidden">
                  {q.averageScore != null && q.scaleMax != null ? (
                    <AverageScoreDisplay
                      score={q.averageScore}
                      max={q.scaleMax}
                      responseCount={q.responseCount}
                    />
                  ) : q.scores && q.scores.length > 0 ? (
                    <StatementChart
                      scores={q.scores}
                      labels={q.labels ?? q.scores.map((_, i) => `Opção ${i + 1}`)}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {dialogs}
    </div>
  );
}
