"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleDot, MessageSquareText } from "lucide-react";
import {
  GUSTAVO_WEEKLY_LINKEDIN_TARGET,
  GUSTAVO_WEEKLY_REEL_TARGET,
} from "@/lib/gustavo-content/constants";
import { overviewMetrics } from "@/lib/gustavo-content/filters";
import type { GustavoContentItem } from "@/lib/gustavo-content/types";
import { ScoreBadge } from "@/components/gustavo-content/score-badge";
import {
  EditorialEmpty,
  EditorialError,
  EditorialLoading,
} from "@/components/gustavo-content/editorial-states";

export function GustavoOverview({ isOwner }: { isOwner: boolean }) {
  const [items, setItems] = useState<GustavoContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/gustavo-content/items");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar o painel.");
      setItems(data as GustavoContentItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o painel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const metrics = overviewMetrics(items);

  if (loading) return <EditorialLoading label="Lendo pautas, aprovações e metas da semana" />;
  if (error) return <EditorialError message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-10">
      <section className="grid overflow-hidden rounded-[1.6rem] bg-[#04202f] text-white lg:grid-cols-[1.25fr_0.75fr]">
        <div className="relative px-6 py-7 sm:px-8 sm:py-9">
          <div className="absolute right-8 top-8 h-28 w-28 rounded-full border border-[#47cdd0]/20" />
          <p className="editorial-kicker font-mono text-[11px] uppercase text-[#7fe1e3]">
            Prioridade de hoje
          </p>
          <div className="mt-5 flex items-end gap-4">
            <span className="editorial-display font-mono text-6xl font-medium leading-none text-white sm:text-7xl">
              {metrics.waitingGustavo}
            </span>
            <p className="max-w-[18rem] pb-1 text-sm leading-5 text-white/60">
              {metrics.waitingGustavo === 1
                ? "conteúdo precisa de opinião ou aprovação"
                : "conteúdos precisam de opinião ou aprovação"}
            </p>
          </div>
          <Link
            href="/conteudo/gustavo/producao"
            className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#7fe1e3] transition-transform hover:translate-x-1"
          >
            Abrir fila editorial <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="grid border-t border-white/10 sm:grid-cols-3 lg:grid-cols-1 lg:border-l lg:border-t-0">
          <MetricLine
            icon={<CircleDot className="h-4 w-4" />}
            label="Sugestões fortes"
            value={metrics.suggestions}
          />
          <MetricLine
            icon={<Check className="h-4 w-4" />}
            label="Aprovados"
            value={metrics.approved}
          />
          <MetricLine
            icon={<MessageSquareText className="h-4 w-4" />}
            label="Pautas criadas em 7 dias"
            value={metrics.weekCount}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="rounded-[1.5rem] bg-white/80 px-5 py-6 shadow-[0_22px_65px_rgba(4,32,47,0.06)] sm:px-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">
                Seleção editorial
              </p>
              <h3 className="editorial-display mt-2 text-2xl font-semibold text-[#04202f]">
                Melhores oportunidades agora
              </h3>
            </div>
            <Link href="/conteudo/gustavo/radar" className="text-sm font-semibold text-[#347796] hover:underline">
              Ver radar
            </Link>
          </div>
          {metrics.opportunities.length === 0 ? (
            <div className="mt-6">
              <EditorialEmpty
                eyebrow="Radar em observação"
                title="Nenhuma oportunidade forte agora"
                description={
                  isOwner
                    ? "Quando surgir uma pauta relevante, ela aparecerá aqui já conectada a uma tese e ao problema empresarial."
                    : "A busca continuará acompanhando os temas. Teses e amostras de voz tornam a próxima geração mais específica."
                }
              />
            </div>
          ) : (
            <div className="mt-5 divide-y divide-[#04202f]/[0.08]">
            {metrics.opportunities.map((item) => (
              <article
                key={item.id}
                className="group grid gap-4 py-5 first:pt-2 sm:grid-cols-[auto_1fr_auto] sm:items-start"
              >
                <ScoreBadge score={item.editorial_score} />
                <div className="min-w-0">
                  <h4 className="font-semibold leading-snug text-[#04202f]">{item.title}</h4>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4f6872]">{item.business_problem}</p>
                  <p className="mt-2 text-xs text-[#6f858d]">
                    {item.thesis_title ?? "Opinião ainda não registrada"}
                    {item.recommended_channels?.linkedin.recommended ? " · LinkedIn" : ""}
                    {item.recommended_channels?.instagramReel.recommended ? " · Reel" : ""}
                  </p>
                </div>
                <Link
                  href={`/conteudo/gustavo/producao/${item.id}`}
                  aria-label={`Analisar ${item.title ?? "pauta"}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#04202f]/5 text-[#347796] transition-all group-hover:bg-[#04202f] group-hover:text-white"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            ))}
            </div>
          )}
        </div>

        <aside className="space-y-3 rounded-[1.5rem] bg-[#e4f5f5] px-5 py-6">
          <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">Cadência</p>
          <Cadence label="LinkedIn" current={metrics.linkedinWeek} target={GUSTAVO_WEEKLY_LINKEDIN_TARGET} />
          <Cadence label="Reels" current={metrics.reelWeek} target={GUSTAVO_WEEKLY_REEL_TARGET} />
          <p className="pt-2 text-xs leading-5 text-[#4f6872]">
            A meta mede conteúdos publicados nos últimos sete dias.
          </p>
        </aside>
      </section>
    </div>
  );
}

function MetricLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-white/10 px-5 py-4 [&:not(:last-child)]:border-b lg:px-6">
      <div className="flex items-center gap-2 text-sm text-white/60">{icon}{label}</div>
      <span className="font-mono text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Cadence({ label, current, target }: { label: string; current: number; target: number }) {
  const percent = Math.min(100, (current / target) * 100);
  return (
    <div className="pt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-[#04202f]">{label}</span>
        <span className="font-mono text-sm tabular-nums text-[#36535f]">{current}/{target}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full bg-[#347796]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
