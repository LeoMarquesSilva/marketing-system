"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GUSTAVO_WEEKLY_LINKEDIN_TARGET,
  GUSTAVO_WEEKLY_REEL_TARGET,
} from "@/lib/gustavo-content/constants";
import { overviewMetrics } from "@/lib/gustavo-content/filters";
import type { GustavoContentItem } from "@/lib/gustavo-content/types";
import { ScoreBadge } from "@/components/gustavo-content/score-badge";

export function GustavoOverview({ isOwner }: { isOwner: boolean }) {
  const [items, setItems] = useState<GustavoContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/gustavo-content/items")
      .then((response) => (response.ok ? response.json() : []))
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const metrics = overviewMetrics(items);

  const cards = [
    {
      label: "LinkedIn esta semana",
      value: `${metrics.linkedinWeek} / ${GUSTAVO_WEEKLY_LINKEDIN_TARGET}`,
      hint: "Meta editorial semanal",
    },
    {
      label: "Reels esta semana",
      value: `${metrics.reelWeek} / ${GUSTAVO_WEEKLY_REEL_TARGET}`,
      hint: "Um assunto por vídeo",
    },
    {
      label: "Sugestões fortes",
      value: String(metrics.suggestions),
      hint: "Pautas com score 70 ou mais",
    },
    {
      label: "Aguardando Gustavo",
      value: String(metrics.waitingGustavo),
      hint: "Opinião ou aprovação",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4 shadow-[0_1px_0_rgba(4,32,47,0.03)]"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#347796]">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[#04202f]">{metric.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
          </article>
        ))}
      </section>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#347796]">
          Melhores oportunidades agora
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
        ) : metrics.opportunities.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-[#04202f]/15 bg-[#04202f]/[0.02] px-5 py-8">
            <h3 className="text-lg font-semibold text-[#04202f]">
              Nenhuma oportunidade encontrada no momento.
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {isOwner
                ? "Quando o radar encontrar uma pauta forte, ela aparece aqui com o problema empresarial e a tese."
                : "A busca automática continuará acompanhando os temas. Cadastre teses e voz para a geração nascer com a leitura do Gustavo."}
            </p>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {metrics.opportunities.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-black/[0.06] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-[#04202f]">{item.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{item.business_problem}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.thesis_title ?? "Sem tese ainda"}
                      {item.recommended_channels?.linkedin.recommended ? " · LinkedIn" : ""}
                      {item.recommended_channels?.instagramReel.recommended ? " · Reel" : ""}
                    </p>
                  </div>
                  <ScoreBadge score={item.editorial_score} />
                </div>
                <Link
                  href={`/conteudo/gustavo/producao/${item.id}`}
                  className="mt-3 inline-flex text-sm font-medium text-[#347796] hover:underline"
                >
                  Analisar pauta
                </Link>
              </article>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/conteudo/gustavo/radar"
            className="inline-flex h-9 items-center rounded-full bg-[#04202f] px-4 text-sm font-medium text-white hover:bg-[#0a2f42]"
          >
            Abrir radar
          </Link>
          <Link
            href="/conteudo/gustavo/teses"
            className="inline-flex h-9 items-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-[#04202f] hover:bg-black/[0.03]"
          >
            Biblioteca de teses
          </Link>
        </div>
      </section>
    </div>
  );
}
