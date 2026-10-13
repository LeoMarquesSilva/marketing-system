"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Repeat2, Sparkles } from "lucide-react";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import type { AreaRotation, AreaRotationEntry } from "@/lib/planner-calendar";
import { cn } from "@/lib/utils";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function lastPostLabel(entry: AreaRotationEntry): string {
  if (!entry.lastPostedOn || entry.daysSince === null) return "Nunca postou";
  if (entry.daysSince < 0) {
    return `Agendado para ${format(parseISO(entry.lastPostedOn), "dd/MM", { locale: ptBR })}`;
  }
  if (entry.daysSince === 0) return "Postou hoje";
  if (entry.daysSince === 1) return "Postou ontem";
  return `Há ${entry.daysSince} dias sem post`;
}

function bankLabel(entry: AreaRotationEntry): string {
  const parts = [
    entry.bankReels > 0 ? plural(entry.bankReels, "reel", "reels") : null,
    entry.bankPosts > 0 ? plural(entry.bankPosts, "post", "posts") : null,
  ].filter(Boolean);
  return parts.length ? `${parts.join(" e ")} no banco` : "Nada pronto no banco";
}

function AreaBadge({ area, size = "sm" }: { area: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full ring-1",
        size === "lg" ? "h-10 w-10" : "h-7 w-7",
        getAreaIconStyle(area)
      )}
    >
      <AreaIcon area={area} className={size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5"} aria-hidden />
    </span>
  );
}

export function AreaRotationPanel({ rotation }: { rotation: AreaRotation }) {
  if (rotation.entries.length === 0) return null;
  const recommended = rotation.entries.find((entry) => entry.recommended) ?? null;
  // Área que estaria na vez antes da recomendada, mas foi pulada por não ter nada pronto.
  const skipped = recommended ? rotation.entries.slice(0, rotation.entries.indexOf(recommended)) : rotation.entries;
  const waiting = skipped.find((entry) => entry.bankPosts + entry.bankReels === 0 && !entry.isLastPosted);
  const repeatingLast = recommended?.isLastPosted ?? false;

  return (
    <section aria-labelledby="area-rotation-title" className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id="area-rotation-title" className="flex items-center gap-2 text-sm font-semibold">
          <Repeat2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          Rodízio de áreas
        </h3>
        <p className="text-xs text-muted-foreground">
          Quem está há mais tempo sem post vem primeiro. Posts institucionais não contam.
        </p>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="flex flex-col justify-between gap-4 rounded-lg bg-[#04202f] p-4 text-white">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">Próximo post</p>
            {recommended ? (
              <>
                <div className="mt-2 flex items-center gap-3">
                  <AreaBadge area={recommended.area} size="lg" />
                  <p className="text-lg font-semibold leading-tight">{recommended.area}</p>
                </div>
                <p className="mt-3 text-sm text-white/80">
                  {lastPostLabel(recommended)} · {bankLabel(recommended)}.
                </p>
                {repeatingLast && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    É a área do último post, mas é a única com conteúdo pronto.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-white/80">
                Nenhuma área do rodízio tem post ou reel pronto no banco.
              </p>
            )}
          </div>
          {waiting && (
            <p className="text-xs text-white/60">
              {waiting.area} está na frente da fila, mas sem nada pronto
              {waiting.inProduction > 0
                ? ` (${plural(waiting.inProduction, "reel em aprovação", "reels em aprovação")}).`
                : ". Vale pedir conteúdo."}
            </p>
          )}
        </div>

        <ol className="divide-y divide-border/60" aria-label="Ordem do rodízio">
          {rotation.entries.map((entry, index) => {
            const empty = entry.bankPosts + entry.bankReels === 0;
            return (
              <li
                key={entry.area}
                className={cn(
                  "grid grid-cols-[1rem_1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-md px-2 py-2",
                  "md:grid-cols-[1rem_1.75rem_minmax(8rem,1fr)_10rem_11rem_8rem]",
                  entry.recommended && "bg-emerald-50 dark:bg-emerald-950/30"
                )}
              >
                <span className="text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                <AreaBadge area={entry.area} />
                <span className="min-w-0 text-sm font-medium text-foreground">{entry.area}</span>
                <span className="col-span-2 col-start-3 text-xs text-muted-foreground md:col-span-1 md:col-start-4 md:row-start-1">
                  {lastPostLabel(entry)}
                </span>
                <span
                  className={cn(
                    "col-span-2 col-start-3 text-xs md:col-span-1 md:col-start-5 md:row-start-1",
                    empty ? "text-muted-foreground/70" : "text-foreground"
                  )}
                >
                  {bankLabel(entry)}
                  {entry.inProduction > 0 && (
                    <span className="block text-[11px] text-muted-foreground">
                      {plural(entry.inProduction, "reel em aprovação", "reels em aprovação")}
                    </span>
                  )}
                </span>
                <span className="col-start-4 row-start-1 flex justify-end md:col-start-6">
                  {entry.recommended ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Recomendada
                    </span>
                  ) : entry.isLastPosted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      Último post
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
