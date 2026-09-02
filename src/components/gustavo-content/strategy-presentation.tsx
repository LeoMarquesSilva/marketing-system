"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Check, Quote } from "lucide-react";
import {
  GUSTAVO_WEEKLY_LINKEDIN_TARGET,
  GUSTAVO_WEEKLY_REEL_TARGET,
} from "@/lib/gustavo-content/constants";
import {
  matchThesesToPillar,
  type StrategyOperatingPulse,
} from "@/lib/gustavo-content/strategy-insights";
import type { GustavoStrategy } from "@/lib/gustavo-content/strategy";
import {
  THESIS_CONVICTION_LABELS,
  THESIS_STATUS_LABELS,
  type GustavoThesis,
} from "@/lib/gustavo-content/theses";
import { cn } from "@/lib/utils";

const FLOW = [
  { step: "Notícia", note: "O fato entra" },
  { step: "Fato", note: "O que mudou" },
  { step: "Problema", note: "A dor empresarial" },
  { step: "Tese", note: "A opinião do Gustavo" },
  { step: "Implicação", note: "O que isso muda" },
  { step: "Conteúdo", note: "LinkedIn e Reel" },
] as const;

const CHAPTERS = [
  { id: "norte", label: "Norte" },
  { id: "porque", label: "Porquê" },
  { id: "icp", label: "ICP" },
  { id: "metodo", label: "Método" },
  { id: "pilares", label: "Pilares" },
  { id: "canais", label: "Canais" },
  { id: "regras", label: "Regras" },
  { id: "sucesso", label: "Sucesso" },
] as const;

export function StrategyPresentation({
  strategy,
  theses,
  pulse,
  missingPillars,
}: {
  strategy: GustavoStrategy;
  theses: GustavoThesis[];
  pulse: StrategyOperatingPulse;
  missingPillars: string[];
}) {
  const [active, setActive] = useState<string>(CHAPTERS[0].id);
  const updatedLabel = formatUpdatedAt(strategy.updated_at);

  const pillars = useMemo(
    () =>
      strategy.content_pillars.map((pillar) => {
        const linked = matchThesesToPillar(pillar, theses);
        return { pillar, theses: linked.slice(0, 3), total: linked.length };
      }),
    [strategy.content_pillars, theses]
  );

  useEffect(() => {
    const nodes = CHAPTERS.map((chapter) => document.getElementById(chapter.id)).filter(
      (node): node is HTMLElement => node != null
    );
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0.15, 0.4, 0.7] }
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-8 xl:grid-cols-[12.5rem_minmax(0,1fr)]">
      <nav
        aria-label="Capítulos da estratégia"
        className="flex gap-2 overflow-x-auto xl:sticky xl:top-6 xl:block xl:self-start xl:overflow-visible"
      >
        {CHAPTERS.map((chapter, index) => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            className={cn(
              "flex shrink-0 items-baseline gap-2 rounded-lg px-3 py-2 text-sm transition-colors xl:w-full",
              active === chapter.id
                ? "bg-[#04202f] text-white"
                : "text-[#56707a] hover:bg-[#04202f]/[0.05] hover:text-[#04202f]"
            )}
          >
            <span className="font-mono text-[10px] opacity-60">0{index + 1}</span>
            {chapter.label}
          </a>
        ))}
      </nav>

      <div className="space-y-8">
        <article
          id="norte"
          className="strategy-memo relative overflow-hidden scroll-mt-8 rounded-[1.75rem] px-6 py-8 sm:px-9 sm:py-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#347796]">
            <span>Carta · Estratégia · Doc main</span>
            <span className="font-mono font-medium normal-case tracking-normal text-[#6f858d]">
              Revisado {updatedLabel}
            </span>
          </div>
          <Quote className="mt-7 size-8 text-[#47cdd0]" aria-hidden />
          <h3 className="editorial-display mt-4 max-w-4xl text-[2rem] font-semibold leading-[1.05] text-[#04202f] sm:text-[2.7rem]">
            {strategy.positioning}
          </h3>
          <div className="mt-8 max-w-2xl border-l-2 border-[#47cdd0] pl-5">
            <p className="editorial-kicker font-mono text-[10px] uppercase text-[#347796]">
              Promessa editorial
            </p>
            <p className="mt-2 text-base leading-7 text-[#294d5a]">{strategy.editorial_promise}</p>
          </div>
        </article>

        <OperatingPulse pulse={pulse} missingCount={missingPillars.length} />

        <section className="grid gap-4 rounded-[1.5rem] bg-[#04202f] px-5 py-6 text-white sm:grid-cols-3 sm:px-7">
          <FeedsChip
            index="01"
            title="Score do radar"
            copy="O ICP e os pilares pesam o que entra na mesa."
          />
          <FeedsChip
            index="02"
            title="Ângulos e tese"
            copy="A IA só escolhe ângulo a partir desta direção."
          />
          <FeedsChip
            index="03"
            title="Rascunho"
            copy="LinkedIn e Reel nascem daqui — teses e voz entram depois."
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <article
            id="porque"
            className="scroll-mt-8 rounded-[1.5rem] bg-[#e2f5f3] p-6 sm:p-8"
          >
            <ChapterKicker number="02" label="O porquê" />
            <h4 className="editorial-display mt-3 text-2xl font-semibold text-[#04202f]">
              A lacuna que queremos ocupar
            </h4>
            <p className="strategy-dropcap mt-5 text-base leading-8 text-[#294d5a]">
              {strategy.strategic_rationale}
            </p>
          </article>

          <article
            id="icp"
            className="scroll-mt-8 rounded-[1.5rem] bg-white/85 p-6 shadow-[0_18px_50px_rgba(4,32,47,0.06)] sm:p-8"
          >
            <ChapterKicker number="03" label="ICP prioritário" />
            <h4 className="editorial-display mt-3 text-2xl font-semibold text-[#04202f]">
              Para quem essa leitura precisa importar
            </h4>
            <div className="mt-5 flex flex-wrap gap-2">
              {strategy.icp.map((audience) => (
                <span
                  key={audience}
                  className="rounded-full border border-[#347796]/15 bg-[#347796]/[0.06] px-3 py-1.5 text-sm font-medium text-[#285f7a]"
                >
                  {audience}
                </span>
              ))}
            </div>
            {strategy.icp_context && (
              <p className="mt-5 border-t border-[#04202f]/8 pt-4 text-sm leading-6 text-[#56707a]">
                {strategy.icp_context}
              </p>
            )}
          </article>
        </section>

        <section
          id="metodo"
          className="scroll-mt-8 rounded-[1.5rem] border border-[#04202f]/8 bg-white/55 px-5 py-7 sm:px-8"
        >
          <ChapterKicker number="04" label="Método editorial" />
          <h4 className="editorial-display mt-3 max-w-xl text-2xl font-semibold text-[#04202f]">
            A notícia inicia o raciocínio. Ela não encerra o conteúdo.
          </h4>
          <ol className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {FLOW.map((item, index) => (
              <li key={item.step} className="relative rounded-xl bg-[#04202f]/[0.045] px-3 py-4">
                <span className="font-mono text-[10px] text-[#347796]">0{index + 1}</span>
                <p className="mt-4 text-sm font-semibold text-[#04202f]">{item.step}</p>
                <p className="mt-1 text-xs leading-5 text-[#6f858d]">{item.note}</p>
                {index < FLOW.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-[#47cdd0] lg:block" />
                )}
              </li>
            ))}
          </ol>
        </section>

        <section id="pilares" className="scroll-mt-8 space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <ChapterKicker number="05" label="Arquitetura editorial" />
              <h4 className="editorial-display mt-3 text-2xl font-semibold text-[#04202f]">
                O que escolhemos sustentar — e as teses que já sustentam
              </h4>
            </div>
            <Link
              href="/conteudo/gustavo/teses"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#347796] hover:underline"
            >
              Abrir teses <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          {missingPillars.length > 0 && (
            <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950">
              <p className="font-semibold">
                {missingPillars.length === 1
                  ? "1 pilar ainda sem tese de apoio"
                  : `${missingPillars.length} pilares ainda sem tese de apoio`}
              </p>
              <p className="mt-1 text-amber-900/75">
                {missingPillars.join(" · ")}. Sem tese, a IA não tem opinião para ancorar o ângulo.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {pillars.map(({ pillar, theses: linked, total }, index) => (
              <article
                key={`${pillar.title}-${index}`}
                className="rounded-[1.35rem] bg-white/85 p-6 shadow-[0_16px_45px_rgba(4,32,47,0.045)] sm:p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="font-mono text-xs text-[#347796]">0{index + 1}</span>
                  <span className="font-mono text-[11px] text-[#6f858d]">
                    {total === 0
                      ? "sem tese"
                      : total === 1
                        ? "1 tese"
                        : `${total} teses`}
                  </span>
                </div>
                <h5 className="mt-4 text-xl font-semibold text-[#04202f]">{pillar.title}</h5>
                <p className="mt-2 text-sm leading-6 text-[#56707a]">{pillar.description}</p>
                <div className="mt-5 border-t border-[#04202f]/8 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#347796]">
                    Por que fazemos assim
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#294d5a]">{pillar.reason}</p>
                </div>
                {linked.length > 0 ? (
                  <ul className="mt-5 space-y-2">
                    {linked.map((thesis) => (
                      <li
                        key={thesis.id}
                        className="rounded-xl bg-[#04202f]/[0.035] px-3.5 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              thesis.status === "validated"
                                ? "bg-[#47cdd0]/20 text-[#285f7a]"
                                : "bg-amber-100 text-amber-900"
                            )}
                          >
                            {THESIS_STATUS_LABELS[thesis.status]}
                          </span>
                          <span className="text-[11px] text-[#6f858d]">
                            {THESIS_CONVICTION_LABELS[thesis.conviction]}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-[#04202f]">{thesis.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#56707a]">
                          {thesis.thesis}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Link
                    href="/conteudo/gustavo/teses"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#347796] hover:underline"
                  >
                    Registrar a primeira tese deste pilar
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>

        <section id="canais" className="scroll-mt-8 grid gap-4 md:grid-cols-2">
          {strategy.channel_roles.map((channel, index) => (
            <article
              key={`${channel.channel}-${index}`}
              className={
                index % 2 === 0
                  ? "rounded-[1.5rem] bg-[#347796] p-7 text-white"
                  : "rounded-[1.5rem] bg-[#dbeeed] p-7 text-[#04202f]"
              }
            >
              <p className={index % 2 === 0 ? "text-xs text-[#bceff0]" : "text-xs text-[#347796]"}>
                O papel do canal
              </p>
              <h5 className="editorial-display mt-2 text-2xl font-semibold">{channel.channel}</h5>
              <p
                className={
                  index % 2 === 0 ? "mt-4 leading-7 text-white/85" : "mt-4 leading-7 text-[#294d5a]"
                }
              >
                {channel.role}
              </p>
              <p
                className={
                  index % 2 === 0
                    ? "mt-6 border-t border-white/15 pt-4 text-sm text-white/65"
                    : "mt-6 border-t border-[#04202f]/10 pt-4 text-sm text-[#56707a]"
                }
              >
                <strong>Por quê:</strong> {channel.reason}
              </p>
            </article>
          ))}
        </section>

        <section
          id="regras"
          className="scroll-mt-8 grid gap-6 rounded-[1.5rem] bg-[#04202f] p-6 text-white sm:p-8 lg:grid-cols-2"
        >
          <StrategyList title="Regras de decisão" items={strategy.editorial_principles} positive />
          <StrategyList title="O que conscientemente evitamos" items={strategy.avoidances} />
        </section>

        <section
          id="sucesso"
          className="scroll-mt-8 rounded-[1.5rem] border border-[#347796]/15 bg-white/70 p-6 sm:p-8"
        >
          <ChapterKicker number="08" label="Definição de sucesso" />
          <h4 className="editorial-display mt-3 text-2xl font-semibold text-[#04202f]">
            O resultado não é apenas publicar mais
          </h4>
          <div className="mt-6 grid gap-x-8 gap-y-4 md:grid-cols-2">
            {strategy.success_signals.map((signal) => (
              <div key={signal} className="flex gap-3 text-sm leading-6 text-[#294d5a]">
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#47cdd0]/20">
                  <Check className="size-3 text-[#285f7a]" aria-hidden />
                </span>
                {signal}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function OperatingPulse({
  pulse,
  missingCount,
}: {
  pulse: StrategyOperatingPulse;
  missingCount: number;
}) {
  return (
    <aside className="rounded-[1.5rem] bg-[#e4f5f5] px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="editorial-kicker font-mono text-[10px] uppercase text-[#347796]">
            Pulso operacional
          </p>
          <h4 className="editorial-display mt-2 text-2xl font-semibold text-[#04202f]">
            Como a estratégia está viva nesta semana
          </h4>
        </div>
        <p className="max-w-sm text-xs leading-5 text-[#4f6872]">
          Cadência 2 LinkedIn + 1 Reel. Teses e voz são o que impedem a IA de inventar opinião.
        </p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Cadence
          label="LinkedIn"
          current={pulse.linkedinThisWeek}
          target={GUSTAVO_WEEKLY_LINKEDIN_TARGET}
        />
        <Cadence
          label="Reels"
          current={pulse.reelsThisWeek}
          target={GUSTAVO_WEEKLY_REEL_TARGET}
        />
        <PulseStat label="Teses validadas" value={pulse.validatedTheses} href="/conteudo/gustavo/teses" />
        <PulseStat label="Teses pendentes" value={pulse.pendingTheses} href="/conteudo/gustavo/teses" />
        <PulseStat label="Amostras de voz" value={pulse.voiceSamples} href="/conteudo/gustavo/voz" />
        <PulseStat
          label="Aguardando o Gustavo"
          value={pulse.waitingGustavo}
          href="/conteudo/gustavo/producao"
        />
      </div>
      {missingCount > 0 && (
        <p className="mt-5 text-sm text-[#4f6872]">
          {missingCount === 1 ? "1 pilar sem tese." : `${missingCount} pilares sem tese.`}{" "}
          <Link href="/conteudo/gustavo/teses" className="font-semibold text-[#347796] hover:underline">
            Completar a base
          </Link>
        </p>
      )}
    </aside>
  );
}

function Cadence({
  label,
  current,
  target,
}: {
  label: string;
  current: number;
  target: number;
}) {
  const percent = Math.min(100, (current / target) * 100);
  return (
    <div className="rounded-xl bg-white/70 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-[#04202f]">{label}</span>
        <span className="font-mono text-sm tabular-nums text-[#36535f]">
          {current}/{target}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#04202f]/10">
        <div className="h-full rounded-full bg-[#347796]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function PulseStat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-white/70 px-4 py-3 transition-colors hover:bg-white"
    >
      <p className="text-xs text-[#56707a]">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#04202f]">{value}</p>
    </Link>
  );
}

function FeedsChip({
  index,
  title,
  copy,
}: {
  index: string;
  title: string;
  copy: string;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] text-[#8ee5e7]">{index}</p>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-white/60">{copy}</p>
    </div>
  );
}

function ChapterKicker({ number, label }: { number: string; label: string }) {
  return (
    <p className="editorial-kicker font-mono text-[10px] uppercase text-[#347796]">
      {number} · {label}
    </p>
  );
}

function StrategyList({
  title,
  items,
  positive = false,
}: {
  title: string;
  items: string[];
  positive?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ee5e7]">
        {title}
      </p>
      <div className="mt-5 space-y-3">
        {items.map((item, index) => (
          <div key={item} className="flex gap-3 text-sm leading-6 text-white/75">
            <span className={positive ? "font-mono text-[#47cdd0]" : "font-mono text-white/30"}>
              {positive ? "✓" : `0${index + 1}`}
            </span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data indisponível";
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}
