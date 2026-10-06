"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Utensils } from "lucide-react";
import {
  DIETARY_NONE,
  DIETARY_OPTIONS,
  formatDietary,
  hasDietaryRestriction,
  type DietaryInfo,
} from "@/lib/rh/registration/types";
import { cn } from "@/lib/utils";

export interface DietaryPerson {
  key: string;
  name: string;
  dietary: DietaryInfo | null | undefined;
}

/** Selo curto ao lado do nome. */
export function DietaryBadge({ dietary, className }: { dietary: DietaryInfo | null | undefined; className?: string }) {
  if (!hasDietaryRestriction(dietary)) return null;
  const text = formatDietary(dietary);
  return (
    <span
      title={text}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full bg-[#fbf3e3] px-2 py-0.5 text-[10px] font-medium text-[#76551e]",
        className
      )}
    >
      <Utensils className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{text}</span>
    </span>
  );
}

/**
 * Resumo para o cardápio: quantas pessoas têm cada restrição (da ficha
 * cadastral da RH) e quem são. Quem não tem ficha vinculada aparece como
 * "sem informação" para a equipe saber que precisa perguntar.
 */
export function DietarySummary({
  people,
  title = "Restrições alimentares",
  emptyHint = "Ninguém da lista declarou restrição alimentar.",
}: {
  people: DietaryPerson[];
  title?: string;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);

  const { counts, withRestriction, unknown } = useMemo(() => {
    const map = new Map<string, number>();
    const restricted: DietaryPerson[] = [];
    let missing = 0;
    for (const person of people) {
      if (!person.dietary || person.dietary.restrictions.length === 0) {
        missing += 1;
        continue;
      }
      if (!hasDietaryRestriction(person.dietary)) continue;
      restricted.push(person);
      for (const item of person.dietary.restrictions) {
        if (item !== DIETARY_NONE) map.set(item, (map.get(item) ?? 0) + 1);
      }
    }
    return {
      counts: DIETARY_OPTIONS.filter((option) => map.has(option.value)).map((option) => ({
        label: option.label,
        value: map.get(option.value) ?? 0,
      })),
      withRestriction: restricted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      unknown: missing,
    };
  }, [people]);

  if (people.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-[#fbf3e3] text-[#76551e]">
          <Utensils className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {title}
            <span className="ml-2 font-normal text-muted-foreground">
              {withRestriction.length === 0
                ? "nenhuma declarada"
                : `${withRestriction.length} ${withRestriction.length === 1 ? "pessoa" : "pessoas"}`}
            </span>
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {counts.map((count) => (
              <span key={count.label} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
                {count.label} · {count.value}
              </span>
            ))}
            {unknown > 0 && (
              <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                Sem informação · {unknown}
              </span>
            )}
          </div>
        </div>
        {withRestriction.length > 0 && (
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
        )}
      </button>
      {open && (
        <div className="border-t border-border/60 px-4 py-3">
          {withRestriction.length === 0 ? (
            <p className="text-xs text-muted-foreground">{emptyHint}</p>
          ) : (
            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {withRestriction.map((person) => (
                <li key={person.key} className="min-w-0 text-sm">
                  <span className="font-medium text-foreground">{person.name}</span>
                  <span className="block text-xs text-muted-foreground">{formatDietary(person.dietary)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
