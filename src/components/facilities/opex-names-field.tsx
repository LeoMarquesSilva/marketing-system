"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Link2, Loader2, Search, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { opexApi, type OpexNameRow } from "@/lib/facilities/client";
import { companyTokens, suggestOpexNames } from "@/lib/facilities/opex";
import { cn } from "@/lib/utils";
import { formatBrl } from "./facilities-visuals";

/* Os nomes do OPEX são os mesmos para a tela inteira: busca uma vez e reaproveita. */
let cache: Promise<{ names: OpexNameRow[]; syncedAt: string | null }> | null = null;

/** Depois de atualizar o OPEX, a próxima tela que abrir busca os nomes de novo. */
export function invalidateOpexNames() {
  cache = null;
}

export function useOpexNames(): { names: OpexNameRow[]; syncedAt: string | null; loading: boolean; error: string | null; reload: () => void } {
  const [state, setState] = useState<{ names: OpexNameRow[]; syncedAt: string | null; loading: boolean; error: string | null }>({
    names: [],
    syncedAt: null,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    cache ??= opexApi.names();
    cache
      .then((data) => alive && setState({ ...data, loading: false, error: null }))
      .catch((error) => {
        cache = null;
        if (alive) setState((s) => ({ ...s, loading: false, error: error instanceof Error ? error.message : "Falha ao carregar o OPEX." }));
      });
    return () => {
      alive = false;
    };
  }, [version]);
  return {
    ...state,
    reload: () => {
      cache = null;
      setVersion((v) => v + 1);
    },
  };
}

function matchesQuery(name: string, query: string): boolean {
  const words = companyTokens(query);
  if (!words.length) return true;
  const tokens = companyTokens(name);
  return words.every((word) => tokens.some((token) => token.startsWith(word)));
}

/** Liga um ou mais nomes do OPEX ao fornecedor: sugestões pelo nome primeiro, depois a busca. */
export function OpexNamesField({
  value,
  supplierName,
  legalName,
  supplierId,
  onChange,
}: {
  value: string[];
  supplierName: string;
  legalName: string;
  /** Para não marcar como "já ligado" os nomes do próprio fornecedor. */
  supplierId?: string;
  onChange: (names: string[]) => void;
}) {
  const { names, loading, error } = useOpexNames();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const byName = useMemo(() => new Map(names.map((n) => [n.fornecedor, n])), [names]);

  const suggestions = useMemo(() => {
    const taken = new Set(names.filter((n) => n.linkedTo && n.linkedTo.id !== supplierId).map((n) => n.fornecedor));
    for (const name of value) taken.add(name);
    return suggestOpexNames({ name: supplierName, legal_name: legalName || null }, names, taken);
  }, [names, supplierName, legalName, supplierId, value]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return names.filter((n) => !value.includes(n.fornecedor) && matchesQuery(n.fornecedor, query)).slice(0, 30);
  }, [names, query, value]);

  const add = (name: string) => {
    onChange([...value, name]);
    setQuery("");
    setOpen(false);
  };

  const option = (row: OpexNameRow, highlight?: number) => {
    const elsewhere = row.linkedTo && row.linkedTo.id !== supplierId ? row.linkedTo : null;
    return (
      <button
        key={row.fornecedor}
        type="button"
        disabled={Boolean(elsewhere)}
        onClick={() => add(row.fornecedor)}
        className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[#f2f8f9] focus-visible:bg-[#f2f8f9] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {highlight !== undefined ? (
          <Sparkles className="mt-0.5 size-4 shrink-0 text-[#48466e]" aria-hidden />
        ) : (
          <Link2 className="mt-0.5 size-4 shrink-0 text-[#3e84a8]" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">{row.fornecedor}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {elsewhere ? `Já ligado a ${elsewhere.name}` : `${row.mainAccount.toLowerCase()} · ${row.departments.join(", ")}`}
          </span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatBrl(row.total, { compact: true })}</span>
      </button>
    );
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((name) => {
            const row = byName.get(name);
            return (
              <li
                key={name}
                title={name}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#e8f8f8] py-1 pl-2.5 pr-1 text-xs text-[#1f4a5e] ring-1 ring-inset ring-[#47cdd0]/30"
              >
                <Check className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{name}</span>
                {row && <span className="shrink-0 tabular-nums text-[#285f7a]/80">{formatBrl(row.total, { compact: true })}/12m</span>}
                <button
                  type="button"
                  aria-label={`Desligar ${name}`}
                  onClick={() => onChange(value.filter((n) => n !== name))}
                  className="grid size-5 place-items-center rounded-full hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-white px-3 text-left text-sm transition-colors",
              "hover:bg-[#f6fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
            )}
          >
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {value.length ? "Ligar outro nome do OPEX" : "Procurar o nome no OPEX"}
            </span>
            {suggestions.length > 0 && !value.length && (
              <span className="shrink-0 rounded-full bg-[#eeedf5] px-2 py-0.5 text-xs text-[#48466e]">
                {suggestions.length} {suggestions.length === 1 ? "sugestão" : "sugestões"}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite parte do nome (ex.: vivo, reuniao)"
            aria-label="Procurar nome no OPEX"
            className="h-9 text-sm"
          />
          <div className="mt-2 max-h-72 overflow-y-auto">
            {loading ? (
              <p className="flex items-center gap-2 px-2.5 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Carregando os nomes do OPEX…
              </p>
            ) : error ? (
              <p className="px-2.5 py-3 text-sm text-red-700">{error}</p>
            ) : query.trim() ? (
              results.length ? (
                results.map((row) => option(row))
              ) : (
                <p className="px-2.5 py-3 text-sm text-muted-foreground">Nenhum nome do OPEX com esse texto nos últimos 12 meses.</p>
              )
            ) : suggestions.length ? (
              <>
                <p className="px-2.5 pb-1 pt-1 text-xs font-medium text-muted-foreground">Parecidos com o nome do cadastro</p>
                {suggestions.map((row) => option(row, row.score))}
              </>
            ) : (
              <p className="px-2.5 py-3 text-sm text-muted-foreground">Sem sugestão pelo nome. Digite para procurar.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
