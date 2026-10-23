"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, Shapes } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseIconify, type IconField } from "@/lib/estudio/fields";
import { IconifyIcon } from "./iconify-icon";

const selectClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-white px-2 text-sm shadow-xs outline-none focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/18";

// a busca da Iconify é em inglês; os atalhos levam o termo certo
const SUGESTOES: [string, string][] = [
  ["justiça", "scale"],
  ["martelo", "gavel"],
  ["contrato", "contract"],
  ["documento", "document"],
  ["dinheiro", "money"],
  ["imposto", "tax"],
  ["empresa", "building"],
  ["pessoas", "users"],
  ["casa", "house"],
  ["carro", "car"],
  ["saúde", "health"],
  ["trabalho", "briefcase"],
  ["família", "family"],
  ["escudo", "shield"],
  ["alerta", "alert"],
  ["relógio", "clock"],
];

/** Cache da busca enquanto a página está aberta. */
const searches = new Map<string, Promise<string[]>>();

function searchIcons(q: string): Promise<string[]> {
  let pending = searches.get(q);
  if (!pending) {
    pending = fetch(`/api/estudio/icones?q=${encodeURIComponent(q)}`, { credentials: "include" }).then(async (res) => {
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "A busca de ícones falhou.");
      return body.icons as string[];
    });
    searches.set(q, pending);
    pending.catch(() => searches.delete(q));
  }
  return pending;
}

function IconSearch({ onPick }: { onPick: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setBusy(true);
      searchIcons(q)
        .then((icons) => {
          if (!alive) return;
          setResults(icons);
          setError(icons.length ? null : "Nada com esse termo. Tente outra palavra em inglês.");
        })
        .catch((err) => alive && setError(err instanceof Error ? err.message : "A busca de ícones falhou."))
        .finally(() => alive && setBusy(false));
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-2.5">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar em inglês: scale, money…" className="h-9 bg-white pl-8 text-sm" aria-label="Buscar ícone" />
        {busy && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </label>
      <div className="flex flex-wrap gap-1">
        {SUGESTOES.map(([pt, en]) => (
          <button key={en} type="button" onClick={() => setQuery(en)} className={cn("rounded-full border px-2 py-0.5 text-[11px]", query === en ? "border-[#04202f] bg-[#04202f] text-white" : "border-black/[0.1] hover:border-[#347796]/50")}>
            {pt}
          </button>
        ))}
      </div>
      {error && <p className="text-[11px] text-muted-foreground">{error}</p>}
      {results.length > 0 && query.trim().length >= 2 && (
        <ul className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto pr-1">
          {results.map((id) => (
            <li key={id}>
              <button type="button" title={id} onClick={() => onPick(id)} className="flex h-9 w-9 items-center justify-center rounded text-[#04202f] hover:bg-[#47cdd0]/15">
                <IconifyIcon value={`iconify:${id}`} size={22} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground">Ícones de licença livre (Lucide, Tabler, Material, Phosphor…) pela Iconify.</p>
    </div>
  );
}

/** Ícone do modelo: atalhos da lista ou qualquer ícone livre da Iconify. */
export function IconInput({ field, value, campo, onChange }: { field: IconField; value: string; campo: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const custom = parseIconify(value);

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-foreground">{field.label}</span>
      <div className="flex items-center gap-2">
        {custom && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-black/[0.1] bg-white text-[#04202f]" title={`${custom.prefix}:${custom.name}`}>
            <IconifyIcon value={value} size={22} />
          </span>
        )}
        <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)} data-campo-input={campo} aria-label={field.label}>
          {custom && <option value={value}>Da biblioteca: {custom.name}</option>}
          {field.opcoes.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex h-9 shrink-0 items-center gap-1.5 border border-black/[0.12] bg-white px-2.5 text-xs font-medium hover:border-[#347796]/50" title="Buscar outro ícone">
              <Shapes className="h-3.5 w-3.5" /> Mais
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px] p-3">
            <IconSearch
              onPick={(id) => {
                onChange(`iconify:${id}`);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
