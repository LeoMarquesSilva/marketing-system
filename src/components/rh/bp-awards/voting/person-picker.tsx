"use client";

import { useId, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { AwardAvatar } from "@/components/rh/bp-awards/award-avatar";
import styles from "@/components/rh/bp-awards/awards-theme.module.css";
import type { AwardPerson } from "@/lib/rh/bp-awards/types";
import { cn } from "@/lib/utils";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Escolha do colega pela foto: busca por nome, filtro por área e aviso de
 * quem já foi indicado em outro valor. Depois de escolher, mostra só a pessoa.
 */
export function PersonPicker({
  candidates,
  selected,
  onSelect,
  usedIn,
  missingSelection,
}: {
  candidates: AwardPerson[];
  selected: AwardPerson | null;
  onSelect: (person: AwardPerson) => void;
  /** Letras dos outros valores em que a pessoa já foi indicada. */
  usedIn: Map<string, string[]>;
  /** A indicação salva aponta para alguém que saiu da lista (ex.: sócio). */
  missingSelection: boolean;
}) {
  const searchId = useId();
  const [browsing, setBrowsing] = useState(!selected);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string | null>(null);

  const areas = useMemo(
    () =>
      [...new Set(candidates.map((person) => person.department).filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [candidates]
  );

  const visible = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return candidates.filter((person) => {
      if (area && person.department !== area) return false;
      if (!terms.length) return true;
      const haystack = normalize(`${person.short_name} ${person.full_name}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [candidates, query, area]);

  if (selected && !browsing) {
    const others = usedIn.get(selected.id);
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--aw-line)] bg-[var(--aw-raised)]/70 p-4 sm:flex-nowrap">
        <AwardAvatar person={selected} size="lg" className="ring-2 ring-[var(--aw-gold)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-[var(--aw-ivory)]">{selected.short_name}</p>
          <p className="truncate text-sm text-[var(--aw-mist)]">
            {[selected.department, selected.position].filter(Boolean).join(" · ")}
          </p>
          {others && others.length > 0 && (
            <p className="mt-1 text-xs text-[var(--aw-gold-bright)]">Também indicado por você em {others.join(" · ")}</p>
          )}
        </div>
        <button type="button" className={cn(styles.secondary, "w-full sm:w-auto")} onClick={() => setBrowsing(true)}>
          Trocar pessoa
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {missingSelection && (
        <p className="rounded-lg border border-[var(--aw-danger)]/50 px-3 py-2 text-sm text-[var(--aw-danger)]">
          A pessoa que você tinha escolhido não está mais na lista desta premiação. Escolha outra.
        </p>
      )}
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Buscar colaborador pelo nome
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--aw-dim)]" aria-hidden />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar pelo nome"
          autoComplete="off"
          className={cn(styles.field, "h-12 pl-10 pr-4")}
        />
      </div>

      {areas.length > 1 && (
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrar por área">
        {[null, ...areas].map((option) => {
          const active = area === option;
          return (
            <button
              key={option ?? "todas"}
              type="button"
              aria-pressed={active}
              onClick={() => setArea(option)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150",
                active
                  ? "border-[var(--aw-gold)] bg-[var(--aw-gold)] font-semibold text-[var(--aw-night)]"
                  : "border-[var(--aw-line-soft)] text-[var(--aw-mist)] hover:border-[var(--aw-line)] hover:text-[var(--aw-ivory)]"
              )}
            >
              {option ?? "Todas as áreas"}
            </button>
          );
        })}
      </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--aw-line-soft)] px-4 py-8 text-center text-sm text-[var(--aw-mist)]">
          Ninguém com esse nome{area ? ` em ${area}` : ""}. Confira a grafia ou troque a área.
        </p>
      ) : (
        <ul
          className="grid max-h-[26rem] grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 min-[440px]:grid-cols-2 md:grid-cols-3"
          aria-label="Colaboradores"
        >
          {visible.map((person) => {
            const isSelected = selected?.id === person.id;
            const others = usedIn.get(person.id);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    onSelect(person);
                    setBrowsing(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
                    isSelected
                      ? "border-[var(--aw-gold)] bg-[var(--aw-gold)]/12"
                      : "border-[var(--aw-line-soft)] bg-[var(--aw-raised)]/50 hover:border-[var(--aw-line)] hover:bg-[var(--aw-raised-hover)]"
                  )}
                >
                  <AwardAvatar person={person} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.95rem] font-medium text-[var(--aw-ivory)]">{person.short_name}</span>
                    <span className="block truncate text-xs text-[var(--aw-mist)]">
                      {others && others.length > 0 ? `Já indicado em ${others.join(" · ")}` : (person.department ?? "")}
                    </span>
                  </span>
                  {isSelected && <Check className="size-4 shrink-0 text-[var(--aw-gold)]" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected && (
        <button type="button" className="text-sm text-[var(--aw-mist)] underline-offset-4 hover:text-[var(--aw-ivory)] hover:underline" onClick={() => setBrowsing(false)}>
          Manter {selected.short_name}
        </button>
      )}
    </div>
  );
}
