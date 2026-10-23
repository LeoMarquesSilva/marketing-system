"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { ADJUST_LIMITS, type AdjustKey, type SlideAdjust } from "@/lib/estudio/types";

function format(key: AdjustKey, value: number): string {
  if (key === "y" || key === "fotoX" || key === "fotoY") return `${value > 0 ? "+" : ""}${Math.round(value)} px`;
  return `${Math.round(value * 100)}%`;
}

/** Ajustes finos do slide: deslizadores com o valor e um botão para voltar ao padrão. */
export function AdjustPanel({ keys, value, onChange }: { keys: AdjustKey[]; value: SlideAdjust | undefined; onChange: (next: SlideAdjust | undefined) => void }) {
  const current = value ?? {};
  const changed = keys.some((k) => current[k] !== undefined);

  function set(key: AdjustKey, v: number) {
    const next: SlideAdjust = { ...current };
    if (Math.abs(v - ADJUST_LIMITS[key].neutral) < 1e-6) delete next[key];
    else next[key] = v;
    onChange(Object.keys(next).length ? next : undefined);
  }

  return (
    <details className="group border border-black/[0.1] bg-white" open={changed || undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#347796]" aria-hidden /> Ajustes finos
        </span>
        {changed && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onChange(undefined);
            }}
            className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Voltar ao padrão
          </button>
        )}
      </summary>
      <div className="space-y-3 px-4 pb-4">
        {keys.map((key) => {
          const limits = ADJUST_LIMITS[key];
          const v = current[key] ?? limits.neutral;
          return (
            <label key={key} className="block space-y-1">
              <span className="flex items-baseline justify-between text-xs font-medium">
                {limits.label}
                <span className="tabular-nums text-muted-foreground">{format(key, v)}</span>
              </span>
              <input
                type="range"
                min={limits.min}
                max={limits.max}
                step={limits.step}
                value={v}
                onChange={(e) => set(key, Number(e.target.value))}
                onDoubleClick={() => set(key, limits.neutral)}
                className="w-full accent-[#04202f]"
              />
            </label>
          );
        })}
        <p className="text-[11px] text-muted-foreground">Duplo clique num controle volta ao padrão. A IA não mexe nesses ajustes.</p>
      </div>
    </details>
  );
}
