"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  npsInsightProgress,
  type NpsCampaignInsights,
  type NpsThemeRank,
} from "@/lib/nps/insights";

export type NpsInsightThemeFilter = {
  list: "strengths" | "pains";
  themeId: string;
} | null;

function ThemeList({
  title,
  hint,
  ranks,
  list,
  active,
  onSelect,
}: {
  title: string;
  hint: string;
  ranks: NpsThemeRank[];
  list: "strengths" | "pains";
  active: NpsInsightThemeFilter;
  onSelect: (filter: NpsInsightThemeFilter) => void;
}) {
  const isStrength = list === "strengths";

  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {ranks.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          Ainda sem temas nesta coluna.
        </p>
      ) : (
        <ul className="divide-y">
          {ranks.map((rank) => {
            const selected =
              active?.list === list && active.themeId === rank.id;
            const quote = rank.quotes[0];
            return (
              <li key={rank.id}>
                <button
                  type="button"
                  onClick={() =>
                    onSelect(selected ? null : { list, themeId: rank.id })
                  }
                  className={cn(
                    "flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                    selected && "bg-muted/50"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{rank.label}</span>
                    <span
                      className={cn(
                        "text-[11px] tabular-nums text-muted-foreground",
                        isStrength && "text-emerald-700",
                        !isStrength && rank.maxWeight >= 3 && "text-red-700",
                        !isStrength && rank.maxWeight < 3 && "text-amber-700"
                      )}
                    >
                      {rank.groupCount} grupo{rank.groupCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  {quote && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      “{quote.quote}”
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ClassificationStatusBar({
  insights,
  running,
  onRetry,
}: {
  insights: NpsCampaignInsights;
  running: boolean;
  onRetry?: () => void;
}) {
  const { done, total, pct } = npsInsightProgress(insights);
  const complete = total > 0 && insights.pendingCount === 0 && !insights.unavailable;
  const stalled = !running && insights.pendingCount > 0 && !insights.unavailable;

  let statusLabel = "Aguardando";
  if (insights.unavailable) statusLabel = "Bloqueada";
  else if (running) statusLabel = "Em andamento";
  else if (complete) statusLabel = "Concluída";
  else if (stalled) statusLabel = "Parada";

  let barClass = "bg-[#347796]";
  if (insights.unavailable) barClass = "bg-amber-500";
  else if (complete) barClass = "bg-emerald-500";
  else if (stalled) barClass = "bg-amber-400";

  return (
    <div className="border-b px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium">
          {running && <Loader2 className="h-3 w-3 animate-spin text-[#347796]" />}
          Classificação · {statusLabel}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {done} de {total} ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barClass)}
          style={{ width: `${total > 0 ? Math.max(pct, running && pct === 0 ? 4 : pct) : 0}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {insights.unavailable
            ? "Não foi possível gravar os temas. Aplique a migration nps_response_insights no banco."
            : running
              ? "Lendo os campos abertos (Motivo e Melhoria) desta campanha."
              : complete
                ? "Todos os comentários com texto desta campanha foram classificados."
                : "Há comentários ainda sem tema. Retome para continuar."}
        </p>
        {(insights.unavailable || stalled) && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#347796] hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            Tentar de novo
          </button>
        )}
      </div>
    </div>
  );
}

export function NpsCampaignInsightsBoard({
  insights,
  pending,
  filter,
  onFilterChange,
  onRetry,
}: {
  insights: NpsCampaignInsights;
  pending: boolean;
  filter: NpsInsightThemeFilter;
  onFilterChange: (filter: NpsInsightThemeFilter) => void;
  onRetry?: () => void;
}) {
  const hasThemes = insights.strengths.length > 0 || insights.pains.length > 0;
  const hasWork = insights.expectedCount > 0 || insights.pendingCount > 0;
  if (!hasThemes && !pending && !hasWork) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-[#347796]" />
            Temas da campanha
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Forças e pedidos. Comunicação e disponibilidade entram quando a nota foi baixa ou o cliente pediu. Elogio e “melhoria contínua” não são dor.
          </p>
        </div>
      </div>

      <ClassificationStatusBar insights={insights} running={pending} onRetry={onRetry} />

      {hasThemes ? (
        <div className="grid lg:grid-cols-2">
          <div className="border-b lg:border-b-0 lg:border-r">
            <ThemeList
              title="Forças"
              hint="O que sustentou a recomendação"
              ranks={insights.strengths}
              list="strengths"
              active={filter}
              onSelect={onFilterChange}
            />
          </div>
          <ThemeList
            title="Dores e pedidos"
            hint="Pedidos e críticas — comunicação e disponibilidade entram quando a nota foi baixa."
            ranks={insights.pains}
            list="pains"
            active={filter}
            onSelect={onFilterChange}
          />
        </div>
      ) : null}
    </div>
  );
}
