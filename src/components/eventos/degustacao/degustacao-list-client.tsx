"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Martini } from "lucide-react";
import { fetchDrinkTastingList, type DrinkTastingSummary } from "@/lib/eventos-degustacao-db";
import { formatClock } from "@/lib/eventos-programa";
import { cn } from "@/lib/utils";

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function label(item: DrinkTastingSummary, now: string): string {
  if (!item.tastingDate) return "Sem data";
  const date = `${item.tastingDate.slice(8, 10)}/${item.tastingDate.slice(5, 7)}`;
  const prefix = item.tastingDate === now ? "Hoje" : date;
  return item.tastingTime ? `${prefix} às ${formatClock(item.tastingTime)}` : prefix;
}

export function DegustacaoListClient() {
  const [items, setItems] = useState<DrinkTastingSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = today();

  useEffect(() => {
    fetchDrinkTastingList()
      .then((list) => {
        // A de hoje em cima; depois as próximas e as que já passaram, da mais recente para a mais antiga.
        const sorted = [...list].sort((a, b) => {
          const rank = (item: DrinkTastingSummary) => (item.tastingDate === now ? 0 : (item.tastingDate ?? "") > now ? 1 : 2);
          return rank(a) - rank(b) || (b.tastingDate ?? "").localeCompare(a.tastingDate ?? "");
        });
        setItems(sorted);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar."));
  }, [now]);

  return (
    <div className="min-h-dvh bg-[#f2f7f8]">
      <header className="bg-[linear-gradient(160deg,#03070c,#04202f)] px-4 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-[#f9f9f9]">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <span className="grid size-12 place-items-center rounded-lg bg-white/10 text-[#47cdd0]" aria-hidden>
            <Martini className="size-6" />
          </span>
          <div>
            <p className="text-xs font-medium text-[#47cdd0]">ORQESTRAI · Eventos</p>
            <h1 className="text-2xl font-semibold leading-tight">Degustações de drinks</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-4">
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : !items ? (
          <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Carregando…
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#c9d8dc] bg-white px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma degustação de drinks cadastrada.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const isToday = item.tastingDate === now;
              return (
                <li key={item.id}>
                  <Link
                    href={`/degustacao/${item.id}`}
                    className={cn(
                      "flex min-h-16 items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(3,32,47,0.05)] outline-none transition-colors hover:bg-[#f6fafb] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/50",
                      isToday ? "border-[#47cdd0]" : "border-[#dce9eb]"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">{item.vendorName}</p>
                      <p className="truncate text-xs leading-5 text-muted-foreground">
                        <span className={cn(isToday && "font-semibold text-[#285f7a]")}>{label(item, now)}</span>
                        {item.eventName ? ` · ${item.eventName}` : ""} · {item.participants} {item.participants === 1 ? "pessoa" : "pessoas"}
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
