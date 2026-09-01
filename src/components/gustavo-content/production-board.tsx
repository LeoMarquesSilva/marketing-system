"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/gustavo-content/score-badge";
import { GUSTAVO_CONTENT_STATUS_LABELS } from "@/lib/gustavo-content/constants";
import type { GustavoContentItem } from "@/lib/gustavo-content/types";

export function ProductionBoard() {
  const [items, setItems] = useState<GustavoContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/gustavo-content/items?view=producao")
      .then((response) => (response.ok ? response.json() : []))
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando produção…</p>;

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[#04202f]/15 bg-[#04202f]/[0.02] px-5 py-10">
        <h4 className="text-lg font-semibold text-[#04202f]">Nenhum rascunho em andamento.</h4>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Quando uma pauta for escolhida, o LinkedIn e o roteiro de Reel aparecem aqui.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/conteudo/gustavo/producao/${item.id}`}
          className="block rounded-2xl border border-black/[0.06] bg-white p-4 hover:border-[#47cdd0]/40"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#347796]">
                {GUSTAVO_CONTENT_STATUS_LABELS[item.status]}
              </p>
              <h4 className="mt-1 font-semibold text-[#04202f]">{item.title}</h4>
              {item.business_problem && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {item.business_problem}
                </p>
              )}
            </div>
            <ScoreBadge score={item.editorial_score} />
          </div>
        </Link>
      ))}
    </div>
  );
}
