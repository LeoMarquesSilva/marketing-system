"use client";

import { SCORE_LABELS } from "@/lib/clima-types";

/** Cores da legenda Miro - cada cor corresponde a uma categoria (conforme slide) */
const COLORS = [
  "hsl(25 76% 31%)",  // laranja escuro/marrom - Discordo totalmente
  "hsl(0 0% 72%)",    // cinza claro - Discordo
  "hsl(0 0% 58%)",    // cinza médio - Nem discordo, nem concordo
  "hsl(210 65% 56%)", // azul médio - Concordo
  "hsl(215 55% 25%)", // azul escuro - Concordo totalmente
];

export function ScoreLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="text-muted-foreground font-medium">Legenda:</span>
      {SCORE_LABELS.map((label, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: COLORS[i] }}
            aria-hidden
          />
          <span className="text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}
