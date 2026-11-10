"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpDown, Check, Download, FileImage, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { PE27_CYCLE_STEPS, PE27_NORTE, cycleStepStates, todayInBrasilia, type StepState } from "@/lib/pe27/conteudo";
import { DIMENSION_LABELS, DIMENSIONS, PE27_DINAMICA1_PATH, PE27_INSUMOS_PATH, type Dimension, type Pe27Board } from "@/lib/pe27/types";
import { DIMENSION_TONES, DimensionTile, PersonFace, PersonLine, ProgressBar, countDecisions, findSharedThemes, plural } from "./shared";

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function weekdayOf(date: string): string {
  return WEEKDAYS[new Date(`${date}T12:00:00-03:00`).getDay()];
}

/* ------------------------------------------------------------------ ciclo */

function StepMarker({ state }: { state: StepState }) {
  if (state === "feita") {
    return (
      <span className="relative z-10 flex size-7 items-center justify-center rounded-full bg-[#347796] text-white">
        <Check className="size-4" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "relative z-10 flex size-7 items-center justify-center rounded-full border-2 bg-white",
        state === "proxima" ? "border-[#47cdd0]" : "border-[#cfdfe3]",
      )}
    >
      {state === "proxima" && <span className="size-2.5 rounded-full bg-[#47cdd0]" />}
    </span>
  );
}

function CycleTimeline() {
  const today = todayInBrasilia();
  const states = cycleStepStates(today);
  const nextIndex = states.indexOf("proxima");
  const next = nextIndex >= 0 ? PE27_CYCLE_STEPS[nextIndex] : null;

  return (
    <section aria-labelledby="pe27-ciclo" className="rounded-lg border border-[#dce9eb] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 id="pe27-ciclo" className="text-base font-semibold text-foreground">
          Ciclo do PE27
        </h2>
        {next && (
          <p className="text-sm text-muted-foreground">
            Próxima etapa: <span className="font-semibold text-foreground">{next.title}</span>
            {next.date === today ? " · hoje" : ` · ${weekdayOf(next.date)}, ${next.dateLabel.replace("Até ", "")}`}
          </p>
        )}
      </div>

      <ol className="mt-5 grid gap-0 lg:grid-cols-6 lg:gap-3">
        {PE27_CYCLE_STEPS.map((step, index) => {
          const state = states[index];
          const last = index === PE27_CYCLE_STEPS.length - 1;
          return (
            <li
              key={step.title}
              aria-current={state === "proxima" ? "step" : undefined}
              className="relative flex gap-3 pb-5 last:pb-0 lg:flex-col lg:gap-3 lg:pb-0"
            >
              {/* Linha que liga as etapas: vertical no celular, horizontal no desktop. */}
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-7 bottom-0 left-[13px] w-0.5 lg:top-[13px] lg:right-[-12px] lg:bottom-auto lg:left-7 lg:h-0.5 lg:w-auto",
                    state === "feita" ? "bg-[#347796]" : "bg-[#e1ecee]",
                  )}
                />
              )}
              <StepMarker state={state} />
              <div
                className={cn(
                  "min-w-0 flex-1 rounded-md lg:-mx-2 lg:px-2 lg:py-2",
                  state === "proxima" && "bg-[#47cdd0]/8 px-2 py-2 -mx-0 lg:-mx-2",
                )}
              >
                <p className={cn("text-xs font-semibold tabular-nums", state === "futura" ? "text-muted-foreground" : "text-[#285f7a]")}>
                  {step.dateLabel}
                  {step.duration && <span className="font-normal text-muted-foreground"> · {step.duration}</span>}
                </p>
                <p className={cn("mt-0.5 text-sm font-semibold", state === "futura" ? "text-foreground/80" : "text-foreground")}>
                  {step.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p>
                <p className="mt-1 text-xs leading-5 font-medium text-[#315f73]">{step.who}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ insumos */

function DimensionRow({ dimension, board }: { dimension: Dimension; board: Pe27Board }) {
  const group = board.groups.find((item) => item.dynamic === 2 && item.dimension === dimension);
  const levers = board.levers.filter((lever) => lever.dimension === dimension);
  const counts = countDecisions(levers);
  const items = counts.levers.total + counts.goals.total;
  const decided = counts.levers.decided + counts.goals.decided;
  const members = group?.members ?? [];

  return (
    <li>
      <Link
        href={`${PE27_INSUMOS_PATH}?dimensao=${dimension}`}
        className="group flex flex-col gap-3 px-4 py-4 transition-colors outline-none hover:bg-[#f7fbfb] focus-visible:bg-[#f7fbfb] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30 focus-visible:ring-inset sm:flex-row sm:items-center sm:gap-5 sm:px-5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <DimensionTile dimension={dimension} />
          <div className="min-w-0">
            <p className="font-semibold text-foreground group-hover:text-[#285f7a]">{DIMENSION_LABELS[dimension]}</p>
            <p className="text-xs text-muted-foreground">
              {plural(counts.levers.total, "alavanca", "alavancas")} · {plural(counts.goals.total, "meta sugerida", "metas sugeridas")}
            </p>
          </div>
        </div>

        <div className="flex items-center sm:w-44" aria-label={`${members.length} pessoas no grupo`}>
          {members.slice(0, 6).map((member) => (
            <span key={member.id} className="-ml-2 rounded-full ring-2 ring-white first:ml-0" title={member.short_name}>
              <PersonFace person={member} />
            </span>
          ))}
          {members.length > 6 && (
            <span className="-ml-2 flex size-8 items-center justify-center rounded-full bg-[#e8f8f8] text-xs font-semibold text-[#285f7a] ring-2 ring-white">
              +{members.length - 6}
            </span>
          )}
        </div>

        <div className="w-full space-y-1.5 sm:w-44">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Decididos</span>
            <span className="font-semibold text-foreground tabular-nums">
              {decided} de {items}
            </span>
          </div>
          <ProgressBar value={decided} total={items} />
        </div>

        <ArrowRight
          className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#285f7a] sm:block"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function Dinamica1Row({ board }: { board: Pe27Board }) {
  const groups = board.groups.filter((group) => group.dynamic === 1);
  if (groups.length === 0) return null;
  const close = board.reflections.filter((item) => item.direction === "aproximou").length;
  const away = board.reflections.filter((item) => item.direction === "afastou").length;
  return (
    <li>
      <Link
        href={PE27_DINAMICA1_PATH}
        className="group flex items-center gap-3 px-4 py-4 transition-colors outline-none hover:bg-[#f7fbfb] focus-visible:bg-[#f7fbfb] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30 focus-visible:ring-inset sm:gap-5 sm:px-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#e4f0f6] text-[#2c6a89]" aria-hidden>
          <ArrowUpDown className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground group-hover:text-[#285f7a]">Dinâmica 1 · Missão, Visão, Valores e Propósito</p>
          <p className="text-xs text-muted-foreground">
            {plural(groups.length, "grupo", "grupos")} · <span className="font-medium text-emerald-800">{close} aproximaram</span> ·{" "}
            <span className="font-medium text-rose-800">{away} afastaram</span>
          </p>
        </div>
        <ArrowRight
          className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#285f7a] sm:block"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function InsumosPanel({ board }: { board: Pe27Board }) {
  const counts = countDecisions(board.levers);
  return (
    <section aria-labelledby="pe27-insumos" className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
      <div className="flex flex-col gap-1 border-b border-[#e6eef0] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <h2 id="pe27-insumos" className="text-base font-semibold text-foreground">
            Insumos do workshop
          </h2>
          <p className="text-sm text-muted-foreground">Dinâmicas 1 e 2 de 05/11, transcritas das fotos dos cartazes de cada grupo.</p>
        </div>
        <p className="text-sm text-muted-foreground">
          No plano até agora:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {plural(counts.levers.inPlan, "alavanca", "alavancas")} · {plural(counts.goals.inPlan, "meta", "metas")}
          </span>
        </p>
      </div>
      <ul className="divide-y divide-[#eef3f4]">
        <Dinamica1Row board={board} />
        <li className="bg-[#fbfdfd] px-4 py-2 text-xs font-semibold text-[#285f7a] sm:px-5">Dinâmica 2 · Alavancas e metas por dimensão</li>
        {DIMENSIONS.map((dimension) => (
          <DimensionRow key={dimension} dimension={dimension} board={board} />
        ))}
      </ul>
    </section>
  );
}

function SharedThemesPanel({ board }: { board: Pe27Board }) {
  const themes = findSharedThemes(board.levers);
  return (
    <section aria-labelledby="pe27-temas" className="rounded-lg border border-[#dce9eb] bg-white">
      <div className="border-b border-[#e6eef0] px-4 py-4 sm:px-5">
        <h2 id="pe27-temas" className="text-base font-semibold text-foreground">
          Temas que apareceram em mais de um grupo
        </h2>
        <p className="text-sm text-muted-foreground">
          Bons candidatos a virar uma alavanca só, ou a ter um dono claro, na revisão dos sócios.
        </p>
      </div>
      {themes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">Nenhum tema se repete entre os grupos.</p>
      ) : (
        <ul className="divide-y divide-[#eef3f4]">
          {themes.map((theme) => (
            <li key={theme.label} className="grid gap-3 px-4 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:px-5">
              <div>
                <p className="font-semibold text-foreground">{theme.label}</p>
                <p className="text-xs text-muted-foreground">
                  {theme.dimensions.length === DIMENSIONS.length ? "Nos três grupos" : `Em ${theme.dimensions.length} grupos`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {theme.hits.map((hit, index) => (
                  <span
                    key={`${hit.dimension}-${index}`}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs leading-5",
                      DIMENSION_TONES[hit.dimension].soft,
                    )}
                  >
                    <span className={cn("shrink-0 font-semibold", DIMENSION_TONES[hit.dimension].text)}>
                      {DIMENSION_LABELS[hit.dimension]}
                    </span>
                    <span className="truncate text-foreground">{hit.text}</span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ lateral */

function NorteBlock() {
  const blocks = [
    { label: "Visão", text: PE27_NORTE.visao },
    { label: "Missão (sugerida)", text: PE27_NORTE.missaoSugerida },
    { label: "Propósito", text: PE27_NORTE.proposito },
  ];
  return (
    <div className="space-y-4 px-4 py-4 sm:px-5">
      <h2 className="text-base font-semibold text-foreground">Norte do planejamento</h2>
      <dl className="space-y-3">
        {blocks.map((block) => (
          <div key={block.label}>
            <dt className="text-xs font-semibold text-[#285f7a]">{block.label}</dt>
            <dd className="mt-0.5 text-sm leading-6 text-foreground/90">{block.text}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="text-xs font-semibold text-[#285f7a]">Valores · CIVIL</p>
        <ul className="mt-2 grid grid-cols-5 gap-1.5">
          {PE27_NORTE.civil.map((item, index) => (
            <li
              key={`${item.letter}-${index}`}
              title={item.value}
              className="flex flex-col items-center gap-1 rounded-md bg-[#f2f8f9] px-1 py-2 text-center"
            >
              <span className="font-brand text-xl leading-none font-bold text-[#285f7a]">{item.letter}</span>
              <span className="text-xs leading-4 text-muted-foreground">{item.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StructureBlock({ board }: { board: Pe27Board }) {
  const goals = board.levers.reduce((sum, lever) => sum + lever.goals.length, 0);
  const levels = [
    { label: "Dimensões", detail: "Clientes, Pessoas e Acionistas", value: String(DIMENSIONS.length) },
    { label: "Alavancas de valor", detail: "Sugeridas pelos grupos", value: String(board.levers.length) },
    { label: "Metas estratégicas", detail: "Sugeridas pelos grupos", value: String(goals) },
    { label: "Metas de esforço", detail: "Plano tático, a partir de 23/11", value: "—" },
  ];
  return (
    <div className="space-y-3 px-4 py-4 sm:px-5">
      <h2 className="text-base font-semibold text-foreground">Como o plano se organiza</h2>
      <ol className="space-y-1">
        {levels.map((level, index) => (
          <li key={level.label} className="flex items-center gap-3 rounded-md px-2 py-1.5" style={{ marginLeft: index * 10 }}>
            <span className="w-7 shrink-0 text-right text-sm font-semibold text-[#285f7a] tabular-nums">{level.value}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{level.label}</span>
              <span className="block text-xs text-muted-foreground">{level.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ConductorsBlock({ board }: { board: Pe27Board }) {
  if (board.conductors.length === 0) return null;
  return (
    <div className="space-y-3 px-4 py-4 sm:px-5">
      <h2 className="text-base font-semibold text-foreground">Quem conduz</h2>
      <ul className="grid gap-3">
        {board.conductors.map((person) => (
          <li key={person.name}>
            <PersonLine person={person} detail={person.role} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MaterialBlock({ board }: { board: Pe27Board }) {
  const links = [
    {
      href: board.files.presentation_url,
      icon: Presentation,
      label: "Apresentação do workshop",
      detail: "PowerPoint de 05/11",
      action: Download,
      newTab: false,
    },
    {
      href: board.files.dinamica1_groups_sheet_url,
      icon: FileImage,
      label: "Grupos da Dinâmica 1",
      detail: "Quem ficou com cada tema",
      action: ArrowRight,
      newTab: true,
    },
    {
      href: board.files.groups_sheet_url,
      icon: FileImage,
      label: "Grupos da Dinâmica 2",
      detail: "Quem ficou em cada dimensão",
      action: ArrowRight,
      newTab: true,
    },
  ];
  return (
    <div className="space-y-2 px-4 py-4 sm:px-5">
      <h2 className="text-base font-semibold text-foreground">Material</h2>
      <ul className="-mx-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              target={link.newTab ? "_blank" : undefined}
              rel={link.newTab ? "noreferrer" : undefined}
              className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors outline-none hover:bg-[#f2f8f9] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#e8f8f8] text-[#285f7a]">
                <link.icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground group-hover:text-[#285f7a]">{link.label}</span>
                <span className="block text-xs text-muted-foreground">{link.detail}</span>
              </span>
              <link.action className="size-4 shrink-0 text-muted-foreground group-hover:text-[#285f7a]" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ tela */

export function Pe27VisaoGeral({ initialBoard }: { initialBoard: Pe27Board }) {
  const board = initialBoard;
  return (
    <div className="space-y-6">
      <CycleTimeline />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <InsumosPanel board={board} />
          <SharedThemesPanel board={board} />
        </div>
        <aside className="divide-y divide-[#eef3f4] self-start rounded-lg border border-[#dce9eb] bg-white">
          <NorteBlock />
          <StructureBlock board={board} />
          <ConductorsBlock board={board} />
          <MaterialBlock board={board} />
        </aside>
      </div>
    </div>
  );
}
