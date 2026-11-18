"use client";

import { Martini, Star } from "lucide-react";
import { PersonFace } from "@/components/pesquisas/shared";
import {
  columnLabels,
  formatAverage,
  overallRanking,
  scoreTable,
  SCORE_MAX,
  type Score,
  type TastingDrink,
  type TastingVote,
} from "@/lib/eventos-degustacao";
import type { TastingFace } from "@/lib/eventos-degustacao-db";
import type { EventTasting, TastingParticipant } from "@/lib/eventos-programa";
import { cn } from "@/lib/utils";

/** Tom da célula pela nota (escala de 1 a 5, discreta). */
const SCORE_CELL: Record<Score, string> = {
  1: "bg-red-50 text-red-800",
  2: "bg-orange-50 text-orange-800",
  3: "bg-slate-50 text-slate-700",
  4: "bg-emerald-50 text-emerald-800",
  5: "bg-emerald-100 text-emerald-900",
};

export function faceOf(person: Pick<TastingParticipant, "name" | "userId">, faces: Record<string, TastingFace>) {
  return { short_name: person.name, avatar_url: person.userId ? (faces[person.userId]?.avatarUrl ?? null) : null };
}

export function DrinkThumb({ drink, size = "sm" }: { drink: Pick<TastingDrink, "name" | "photoUrl">; size?: "sm" | "md" }) {
  const box = size === "md" ? "size-14" : "size-9";
  return drink.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- foto do Storage, já reduzida no envio
    <img src={drink.photoUrl} alt="" loading="lazy" className={cn(box, "shrink-0 rounded-md object-cover ring-1 ring-black/5")} />
  ) : (
    <span className={cn(box, "grid shrink-0 place-items-center rounded-md bg-[#eaf5f7] text-[#3e84a8]")} aria-hidden>
      <Martini className={size === "md" ? "size-6" : "size-4"} />
    </span>
  );
}

/** Nota de uma pessoa: quadradinho colorido pela escala, ou traço sem nota. */
function ScoreChip({ score, size = "md" }: { score: Score | null; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-6 min-w-6 text-xs" : "size-8 text-sm";
  return score == null ? (
    <span className={cn(box, "inline-grid place-items-center rounded-md text-muted-foreground/60")} aria-label="Sem nota">
      –
    </span>
  ) : (
    <span className={cn(box, "inline-grid place-items-center rounded-md font-semibold tabular-nums", SCORE_CELL[score])}>{score}</span>
  );
}

/**
 * Notas de uma degustação no celular: um bloco por drink (foto, nome, média) com o rosto
 * de cada pessoa e a nota dela embaixo, tudo na largura da tela.
 */
function TastingScoreCards({
  people,
  labels,
  rows,
  faces,
  highlightDrinkId,
}: {
  people: TastingParticipant[];
  labels: string[];
  rows: ReturnType<typeof scoreTable>;
  faces: Record<string, TastingFace>;
  highlightDrinkId?: string | null;
}) {
  const columns = { gridTemplateColumns: `repeat(${Math.min(Math.max(people.length, 1), 6)}, minmax(0, 1fr))` };
  return (
    <ol className="divide-y divide-[#eef3f4] overflow-hidden rounded-lg border border-[#dce9eb] bg-card">
      {rows.map((row) => {
        const bold = row.drink.shortlisted;
        return (
          <li key={row.drink.id} className={cn("px-3 py-3", highlightDrinkId === row.drink.id && "bg-[#f3fafb]")}>
            <div className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-[#285f7a]">{row.rank ?? ""}</span>
              <DrinkThumb drink={row.drink} size="md" />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm leading-5 text-foreground", bold ? "font-bold" : "font-semibold")}>
                  {row.drink.name}
                  {bold && <Star className="ml-1 inline size-3.5 -translate-y-px fill-amber-400 text-amber-500" aria-label="Pré-selecionado" />}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {row.votes > 0 ? `${row.total} de ${people.length * SCORE_MAX} pontos` : "Sem notas ainda"}
                  {row.votes > 0 && row.votes < people.length ? ` · ${row.votes} de ${people.length} notas` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn("text-xl leading-6 tabular-nums text-foreground", bold ? "font-bold" : "font-semibold")}>{formatAverage(row.average)}</p>
                <p className="text-xs text-muted-foreground">média</p>
              </div>
            </div>
            <ul className="mt-2.5 grid gap-y-2 pl-8" style={columns} aria-label={`Notas de cada pessoa para ${row.drink.name}`}>
              {people.map((person, index) => (
                <li key={`${person.name}-${index}`} className="flex flex-col items-center gap-1" aria-label={`${labels[index]}: ${row.scores[index] ?? "sem nota"}`}>
                  <PersonFace size="sm" person={faceOf(person, faces)} />
                  <ScoreChip score={row.scores[index]} size="sm" />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Notas completas de uma degustação, em ordem de média. "cards" (celular): um bloco por drink;
 * "auto": blocos em tela pequena e tabela (uma coluna por pessoa, Total e Média) a partir de sm.
 */
export function TastingScoreTable({
  tasting,
  drinks,
  votes,
  faces,
  highlightDrinkId,
  layout = "auto",
}: {
  tasting: EventTasting;
  drinks: TastingDrink[];
  votes: TastingVote[];
  faces: Record<string, TastingFace>;
  highlightDrinkId?: string | null;
  layout?: "auto" | "cards";
}) {
  const people = tasting.participants;
  const labels = columnLabels(people);
  const rows = scoreTable(drinks, votes, people);
  const anyShortlisted = drinks.some((drink) => drink.shortlisted);

  if (drinks.length === 0) {
    return <p className="rounded-lg border border-dashed border-[#c9d8dc] bg-[#fafcfc] px-4 py-6 text-center text-sm text-muted-foreground">Nenhum drink lançado ainda.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-muted-foreground">
        Escala de 1 a 5 pontos por pessoa. Máximo de {people.length * SCORE_MAX} pontos por drink.
        {anyShortlisted ? " Em negrito, os pré-selecionados." : ""}
      </p>
      <div className={cn("flex flex-wrap gap-x-3 gap-y-1.5", layout === "auto" && "sm:hidden")} aria-label="Quem deu nota">
        {people.map((person, index) => (
          <span key={`${person.name}-${index}`} className="inline-flex items-center gap-1.5 text-xs text-foreground">
            <PersonFace size="sm" person={faceOf(person, faces)} />
            {labels[index]}
          </span>
        ))}
      </div>
      <div className={cn(layout === "auto" && "sm:hidden")}>
        <TastingScoreCards people={people} labels={labels} rows={rows} faces={faces} highlightDrinkId={highlightDrinkId} />
      </div>
      {layout === "auto" && (
      <div className="hidden overflow-x-auto rounded-lg border border-[#dce9eb] bg-card sm:block">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#e6eef0] bg-[#f6fafb] text-xs font-medium text-muted-foreground">
              <th scope="col" className="sticky left-0 z-10 bg-[#f6fafb] px-3 py-2 text-left font-medium">
                Drink
              </th>
              {people.map((person, index) => (
                <th key={`${person.name}-${index}`} scope="col" className="px-1.5 py-2 text-center font-medium">
                  <span className="flex flex-col items-center gap-1">
                    <PersonFace size="sm" person={faceOf(person, faces)} />
                    <span className="max-w-16 truncate text-foreground">{labels[index]}</span>
                  </span>
                </th>
              ))}
              <th scope="col" className="px-2 py-2 text-right font-medium">Total</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Média</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef3f4]">
            {rows.map((row) => {
              const bold = row.drink.shortlisted;
              const highlighted = highlightDrinkId === row.drink.id;
              return (
                <tr key={row.drink.id} className={cn(highlighted && "bg-[#f3fafb]")}>
                  <th scope="row" className={cn("sticky left-0 z-10 px-3 py-2 text-left font-normal", highlighted ? "bg-[#f3fafb]" : "bg-card")}>
                    <span className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{row.rank ?? ""}</span>
                      <DrinkThumb drink={row.drink} />
                      <span className={cn("max-w-36 truncate text-foreground sm:max-w-56", bold && "font-semibold")} title={row.drink.name}>
                        {row.drink.name}
                      </span>
                      {bold && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Pré-selecionado" />}
                    </span>
                  </th>
                  {row.scores.map((score, index) => (
                    <td key={index} className="px-1.5 py-2 text-center">
                      <ScoreChip score={score} />
                    </td>
                  ))}
                  <td className={cn("px-2 py-2 text-right tabular-nums", bold && "font-semibold")}>
                    {row.votes > 0 ? row.total : "–"}
                    {row.votes > 0 && row.votes < people.length && <span className="block text-xs font-normal text-muted-foreground">{row.votes}/{people.length}</span>}
                  </td>
                  <td className={cn("px-3 py-2 text-right text-base tabular-nums", bold ? "font-bold" : "font-semibold")}>{formatAverage(row.average)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Ranking geral dos drinks de todas as degustações (cada um com a média do grupo que provou). */
export function OverallRankingList({
  tastings,
  drinks,
  votes,
  limit,
  onApprove,
  busyDrinkId,
  showTasting = true,
}: {
  tastings: EventTasting[];
  drinks: TastingDrink[];
  votes: TastingVote[];
  limit?: number;
  onApprove?: (drink: TastingDrink, tasting: EventTasting) => void;
  busyDrinkId?: string | null;
  /** Mostra de qual degustação é cada drink (desligado quando a lista é de uma só). */
  showTasting?: boolean;
}) {
  const rows = overallRanking(tastings, drinks, votes);
  const shown = limit ? rows.slice(0, limit) : rows;
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-[#c9d8dc] bg-[#fafcfc] px-4 py-6 text-center text-sm text-muted-foreground">Ainda não há notas lançadas.</p>;
  }
  return (
    <ol className="divide-y divide-[#eef3f4] overflow-hidden rounded-lg border border-[#dce9eb] bg-card">
      {shown.map((row) => (
        <li key={row.drink.id} className="flex items-center gap-3 px-3 py-2.5">
          <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-[#285f7a]">{row.rank}</span>
          <DrinkThumb drink={row.drink} size="md" />
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm leading-5 text-foreground", row.drink.shortlisted ? "font-bold" : "font-semibold")}>{row.drink.name}</p>
            {showTasting && (
              <p className="text-xs leading-5 text-muted-foreground">
                {row.tasting.vendorName}
                {row.tasting.tastingDate ? ` · ${shortDate(row.tasting.tastingDate)}` : ""}
              </p>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              {row.total} de {row.tasting.participants.length * SCORE_MAX} pontos
              {row.votes < row.tasting.participants.length ? ` · ${row.votes} de ${row.tasting.participants.length} notas` : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-semibold leading-6 tabular-nums text-foreground">{formatAverage(row.average)}</p>
            <p className="text-xs text-muted-foreground">média</p>
            {onApprove &&
              (row.drink.menuItemId ? (
                <p className="text-xs font-medium text-emerald-700">No cardápio</p>
              ) : (
                <button
                  type="button"
                  disabled={busyDrinkId === row.drink.id}
                  onClick={() => onApprove(row.drink, row.tasting)}
                  className="text-xs font-medium text-[#347796] hover:underline disabled:opacity-50"
                >
                  Levar ao cardápio
                </button>
              ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
