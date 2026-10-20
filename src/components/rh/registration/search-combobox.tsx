"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { filterOptions, searchKey, type ComboOption } from "@/lib/rh/registration/combo-search";
import { cn } from "@/lib/utils";

const TRIGGER_CLASS =
  "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-white px-3 py-2 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] hover:border-[#3e84a8]/40 focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/18 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

/**
 * Campo de escolha com busca (lista longa: cidades, bancos). Abre um painel
 * com campo de busca sem acento, navegação por teclado e, se `allowCustom`,
 * a opção de usar o texto digitado.
 */
export function SearchCombobox({
  id,
  value,
  options,
  initialOptions,
  status = "ready",
  placeholder,
  idlePlaceholder = "Selecione",
  loadingPlaceholder = "Carregando…",
  searchPlaceholder,
  emptyText,
  moreText,
  allowCustom = false,
  match,
  unknownMessage,
  invalid,
  disabled,
  limit = 80,
  onChange,
}: {
  id: string;
  value: string;
  options: readonly ComboOption[];
  /** O que aparece antes de digitar (ex.: bancos mais usados). Padrão: a lista toda. */
  initialOptions?: readonly ComboOption[];
  status?: "idle" | "loading" | "ready";
  placeholder: string;
  idlePlaceholder?: string;
  loadingPlaceholder?: string;
  searchPlaceholder: string;
  emptyText: string;
  /** Dica no fim da lista inicial (ex.: "Digite para ver todos os bancos"). */
  moreText?: string;
  allowCustom?: boolean;
  /** Valor oficial da lista para o que já estava salvo (acento, caixa, formato antigo). */
  match?: (value: string) => string | null;
  /** Aviso quando o valor salvo não está na lista. */
  unknownMessage?: (value: string) => string;
  invalid?: boolean;
  disabled?: boolean;
  limit?: number;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const ready = status === "ready";
  const matched = ready && value ? match?.(value) ?? null : null;
  const known = !value || options.some((option) => option.value === value) || !!matched;
  const unknown = ready && !known && !allowCustom;

  // Valor salvo de outro jeito ("campinas", "Itaú (341)") vira o nome oficial da lista.
  useEffect(() => {
    if (matched && matched !== value) onChange(matched);
  }, [matched, value, onChange]);

  const visible = useMemo(() => {
    const trimmed = query.trim();
    const base = trimmed ? filterOptions(trimmed, options, limit) : (initialOptions ?? options).slice(0, limit);
    if (allowCustom && trimmed && !options.some((option) => searchKey(option.label ?? option.value) === searchKey(trimmed))) {
      return [...base, { value: trimmed, label: `Usar “${trimmed}”` }];
    }
    return base;
  }, [query, options, initialOptions, allowCustom, limit]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const moreHint = query.trim()
    ? visible.length >= limit
      ? "Continue digitando para ver mais."
      : null
    : (moreText ?? (visible.length === limit ? "Continue digitando para ver mais." : null));

  return (
    <div className="min-w-0 flex-1 space-y-1">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setQuery("");
            setActive(0);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-invalid={invalid || unknown || undefined}
            disabled={disabled || !ready}
            className={TRIGGER_CLASS}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {status === "idle" ? idlePlaceholder : status === "loading" ? value || loadingPlaceholder : value || placeholder}
            </span>
            {status === "loading" ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              placeholder={searchPlaceholder}
              className="h-9 pl-8"
              autoComplete="off"
              aria-controls={`${id}-list`}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((current) => Math.min(current + 1, visible.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((current) => Math.max(current - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  if (visible[active]) choose(visible[active].value);
                }
              }}
            />
          </div>
          <div id={`${id}-list`} ref={listRef} role="listbox" className="mt-2 max-h-64 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              visible.map((option, index) => (
                <button
                  key={`${option.value}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    index === active ? "bg-muted" : "hover:bg-muted"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label ?? option.value}</span>
                  {option.hint && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{option.hint}</span>}
                  {option.value === value && <Check className="size-4 shrink-0" aria-hidden />}
                </button>
              ))
            )}
            {moreHint && <p className="px-2 py-2 text-xs text-muted-foreground">{moreHint}</p>}
          </div>
        </PopoverContent>
      </Popover>
      {unknown && unknownMessage && <p className="text-xs font-medium text-destructive">{unknownMessage(value)}</p>}
    </div>
  );
}
