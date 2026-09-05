"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PRODUCTION_ACTIONS, productionAction } from "@/lib/gustavo-content/production";
import { ScoreBadge } from "@/components/gustavo-content/score-badge";
import { GUSTAVO_CONTENT_STATUS_LABELS } from "@/lib/gustavo-content/constants";
import type { GustavoContentItem } from "@/lib/gustavo-content/types";
import {
  EditorialEmpty,
  EditorialError,
  EditorialLoading,
} from "@/components/gustavo-content/editorial-states";

export function ProductionBoard() {
  const [items, setItems] = useState<GustavoContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/gustavo-content/items?view=producao");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar a produção.");
      setItems(data as GustavoContentItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar a produção.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <EditorialLoading label="Organizando a fila de produção" />;
  if (error) return <EditorialError message={error} onRetry={() => void load()} />;

  if (items.length === 0) {
    return (
      <EditorialEmpty
        eyebrow="Fila limpa"
        title="Nenhum conteúdo em produção"
        description="Escolha uma pauta no radar ou crie conteúdo a partir de uma tese para iniciar o próximo ciclo."
      />
    );
  }

  return (
    <div className="space-y-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">Produção</p>
          <h3 className="editorial-display mt-2 text-2xl font-semibold text-[#04202f]">Fila editorial</h3>
        </div>
        <p className="font-mono text-sm text-[#56707a]">{items.length} em andamento</p>
      </header>

      {PRODUCTION_ACTIONS.map((group) => {
        const groupItems = items.filter((item) =>
          productionAction(item) === group.key
        ).sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at));
        if (groupItems.length === 0) return null;
        return (
          <section key={group.key} className="grid gap-4 lg:grid-cols-[15rem_1fr]">
            <div className="pt-2">
              <div className="flex items-center gap-2 text-[#347796]">
                <Clock3 className="h-4 w-4" aria-hidden />
                <h4 className="font-semibold text-[#04202f]">{group.title} · {groupItems.length}</h4>
              </div>
            </div>
            <div className="divide-y border-y border-[#04202f]/10 bg-white">
              {groupItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/conteudo/gustavo/producao/${item.id}`}
                  className="group grid gap-3 border-b border-[#04202f]/[0.07] px-5 py-5 last:border-b-0 sm:grid-cols-[auto_1fr_auto] sm:items-start"
                >
                  <ScoreBadge score={item.editorial_score} />
                  <div className="min-w-0">
                    <p className="editorial-kicker font-mono text-[10px] uppercase text-[#347796]">
                      {GUSTAVO_CONTENT_STATUS_LABELS[item.status]}
                    </p>
                    <h5 className="mt-1 font-semibold leading-snug text-[#04202f]">{item.title}</h5>
                    <p className="mt-2 text-xs text-[#526b75]">Sem atualização há {formatDistanceToNow(new Date(item.updated_at), { locale: ptBR })}</p>
                    {item.source_context?.draftStale && <p className="mt-2 text-sm font-medium text-amber-800">Atualizar texto para a leitura escolhida</p>}
                    {item.rejection_reason && <p className="mt-2 text-sm text-amber-800">Ajuste solicitado: {item.rejection_reason}</p>}
                    {item.business_problem && (
                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#5d747d]">{item.business_problem}</p>
                    )}
                  </div>
                  <span className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-[#347796]">
                    {group.action}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
