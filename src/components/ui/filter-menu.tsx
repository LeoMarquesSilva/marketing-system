"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchKey } from "@/lib/rh/registration/combo-search";
import { cn } from "@/lib/utils";

export interface FilterMenuOption {
  value: string;
  label: string;
  /** Quantos registros a opção traz com os outros filtros aplicados. */
  count: number;
  /** Ícone, foto ou selo antes do nome. */
  leading?: ReactNode;
}

/**
 * Botão de filtro com menu de múltipla escolha e contagem por opção (mesmo
 * desenho do filtro de Fichas cadastrais). Com uma opção marcada, o botão já
 * mostra qual é; com mais de uma, quantas.
 */
export function FilterMenu({
  label,
  options,
  selected,
  onToggle,
  onClear,
  width = "w-72",
}: {
  label: string;
  options: FilterMenuOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  width?: string;
}) {
  const [query, setQuery] = useState("");
  const searchable = options.length > 8;
  const term = searchKey(query);
  const visible = term ? options.filter((option) => searchKey(option.label).includes(term)) : options;
  const single = selected.length === 1 ? options.find((option) => option.value === selected[0]) : undefined;

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 max-w-full gap-1.5 px-3 text-sm font-medium",
            selected.length > 0 && "border-[#47cdd0] bg-[#e8f8f8] text-[#285f7a] hover:bg-[#dcf4f4] hover:text-[#285f7a]"
          )}
        >
          <span className={cn(selected.length > 0 && "text-[#285f7a]/75")}>{label}</span>
          {single ? (
            <span className="min-w-0 max-w-44 truncate font-semibold">{single.label}</span>
          ) : (
            selected.length > 1 && (
              <span className="rounded-full bg-[#347796] px-1.5 text-xs font-semibold leading-5 tabular-nums text-white">
                {selected.length}
              </span>
            )
          )}
          <ChevronDown className="size-4 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("p-1.5", width)}>
        {searchable && (
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Buscar ${label.toLowerCase()}`}
              aria-label={`Buscar ${label.toLowerCase()}`}
              className="h-9 pl-8 text-sm"
            />
          </div>
        )}
        <div className="max-h-80 overflow-y-auto" role="group" aria-label={label}>
          {visible.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Nada encontrado.</p>}
          {visible.map((option) => {
            const active = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={active}
                onClick={() => onToggle(option.value)}
                className={cn(
                  "flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150",
                  "hover:bg-[#f2f8f9] focus-visible:bg-[#f2f8f9] focus-visible:outline-none",
                  active && "bg-[#f2f8f9]"
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    active ? "border-[#347796] bg-[#347796] text-white" : "border-input bg-white"
                  )}
                  aria-hidden
                >
                  {active && <Check className="size-3" />}
                </span>
                {option.leading}
                <span className={cn("min-w-0 flex-1 truncate", option.count === 0 && !active && "text-muted-foreground")}>
                  {option.label}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{option.count}</span>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="mt-1 border-t border-[#e6eef0] pt-1">
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-[#285f7a] hover:bg-[#f2f8f9] focus-visible:bg-[#f2f8f9] focus-visible:outline-none"
            >
              Limpar {label.toLowerCase()}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
