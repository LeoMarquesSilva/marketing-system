"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarPlus,
  Camera,
  Check,
  ChevronRight,
  Images,
  ListChecks,
  Lock,
  MessageSquare,
  Mic,
  Pencil,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  currentStatus,
  daysBefore,
  daysBetween,
  formatDayMonth,
  formatFilmDuration,
  formatHour,
  formatWeekdayDate,
  parseChapters,
  parseEmotionalCurve,
  parseRelativeSchedule,
  parseTimeline,
  todayInSaoPaulo,
  type DocBoard,
  type DocSection,
  type RelativePhase,
  type TimelineBlock,
} from "@/lib/documentario/types";
import { BlockHeader, CARD, FILM, Face, Feedback, Portrait, formatDateTimeShort } from "./shared";
import { SectionDialog } from "./section-dialog";
import { CloseVersionDialog, ProjectDialog } from "./projeto-dialogs";

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* ------------------------------------------------------------------ cartela */

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-[#9fb3c3]">{label}</p>
      <p className="mt-0.5 text-[15px] font-medium leading-6 text-white">{children}</p>
    </div>
  );
}

function TitleCard({ board, onEdit }: { board: DocBoard; onEdit: () => void }) {
  const { project, event, people } = board;
  const today = todayInSaoPaulo();
  const daysLeft = event?.event_date ? daysBetween(today, event.event_date) : null;
  return (
    <section aria-label="Cartela do filme" className="overflow-hidden rounded-lg text-white shadow-[0_12px_32px_-18px_rgba(13,30,46,0.7)]" style={{ backgroundColor: FILM.navy }}>
      <div className="grid gap-8 px-6 pb-6 pt-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-start gap-3">
            <h2 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-[44px]">{project.title}</h2>
            {board.viewer.can_edit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label="Editar título, linha e assinatura"
                className="mt-2 grid size-9 shrink-0 place-items-center rounded-md text-[#9fb3c3] outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
              >
                <Pencil className="size-4" />
              </button>
            )}
          </div>
          {project.tagline && <p className="mt-4 max-w-[44ch] text-lg italic leading-8 text-[#d9e2ea]">{project.tagline}</p>}
          {project.signature && (
            <p className="mt-auto flex items-center gap-3 pt-8 text-lg font-medium" style={{ color: FILM.gold }}>
              <span className="h-px w-10" style={{ backgroundColor: FILM.gold }} aria-hidden />
              {project.signature}
            </p>
          )}
        </div>

        <div className="flex gap-4">
          {people.map((person) => (
            <figure key={person.key} className="w-[132px]">
              <Portrait name={person.name} avatarUrl={person.avatar_url} className="ring-1 ring-white/15" />
              <figcaption className="mt-2 text-sm font-medium leading-5 text-white">{person.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="grid gap-x-8 gap-y-4 border-t border-white/10 px-6 py-4 sm:grid-cols-2 sm:px-8 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <Fact label="Exibição na festa">
          {event?.event_date ? formatWeekdayDate(event.event_date) : "A definir"}
          {event?.slot?.start_time ? `, ${formatHour(event.slot.start_time)}–${formatHour(event.slot.end_time)}` : ""}
        </Fact>
        <Fact label="Até a festa">{daysLeft == null ? "A definir" : daysLeft > 0 ? `${daysLeft} dias` : daysLeft === 0 ? "É hoje" : "Já aconteceu"}</Fact>
        <Fact label="Duração">
          {project.festa_target_seconds ? formatFilmDuration(project.festa_target_seconds) : "A definir"}
          {project.extended_target_seconds ? <span className="text-[#9fb3c3]"> · estendida {formatFilmDuration(project.extended_target_seconds)}</span> : null}
        </Fact>
        <Fact label="Versão do projeto">
          {project.version_label}
          {project.status_label && <span className="block truncate text-[13px] font-normal text-[#9fb3c3]">{project.status_label}</span>}
        </Fact>
        <div className="flex flex-col items-start justify-center gap-1.5 text-sm">
          {event && (
            <Link href={`/eventos/${event.id}?tab=cronograma`} className="inline-flex items-center gap-1 font-medium text-[#8fdfe1] hover:underline">
              Evento da festa
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          )}
          {project.access_note && (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-[#c9b48e]" title={project.access_note}>
              <Lock className="size-3.5" aria-hidden />
              Interno
            </span>
          )}
        </div>
      </div>
      {event?.slot?.note && (
        <p className="border-t border-white/10 px-6 py-2.5 text-[13px] text-[#9fb3c3] sm:px-8">
          No cronograma da festa: {event.slot.title}. {event.slot.note}.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ régua até a festa */

function phaseIndicators(phase: RelativePhase, board: DocBoard): { label: string; done: boolean; href: string }[] {
  const text = phase.text.toLowerCase();
  const items: { label: string; done: boolean; href: string }[] = [];
  const validation = board.approvals.filter((item) => item.stage === "validacao");
  const decided = validation.filter((item) => item.approvers.every((key) => currentStatus(item, key) !== "pendente")).length;
  const shootsOf = (kinds: string[]) => board.shoots.filter((shoot) => kinds.includes(shoot.kind) && shoot.status !== "cancelada");
  if (text.includes("validar conceito")) items.push({ label: `${decided}/${validation.length} pontos aprovados`, done: validation.length > 0 && decided === validation.length, href: "/documentario/aprovacao" });
  if (text.includes("acervo")) items.push({ label: `${board.archiveSummary.total} no acervo`, done: false, href: "/documentario/acervo" });
  if (text.includes("pré-entrevista")) {
    const list = shootsOf(["pre_entrevista"]);
    items.push({ label: `${list.filter((shoot) => shoot.scheduled_date).length}/${list.length} pré-entrevistas marcadas`, done: list.length > 0 && list.every((shoot) => shoot.scheduled_date), href: "/documentario/gravacoes" });
  }
  if (text.includes("gravar entrevistas")) {
    const list = shootsOf(["entrevista", "conversa_conjunta", "broll"]);
    items.push({ label: `${list.filter((shoot) => shoot.scheduled_date).length}/${list.length} gravações marcadas`, done: list.length > 0 && list.every((shoot) => shoot.scheduled_date), href: "/documentario/gravacoes" });
  }
  const checklistPhase = text.includes("montagem") ? "montagem" : text.includes("telão") ? "festa" : null;
  if (checklistPhase) {
    const list = board.checklist.filter((item) => item.phase === checklistPhase);
    items.push({ label: `${list.filter((item) => item.done_at).length}/${list.length} do checklist`, done: list.length > 0 && list.every((item) => item.done_at), href: "/documentario/dia" });
  }
  return items;
}

function CountdownTrack({ board, phases }: { board: DocBoard; phases: RelativePhase[] }) {
  const eventDate = board.event?.event_date ?? null;
  const today = todayInSaoPaulo();
  if (!eventDate || phases.length === 0) return null;
  const first = daysBefore(eventDate, Math.max(...phases.map((phase) => phase.from)));
  const start = today < first ? today : first;
  const total = Math.max(1, daysBetween(start, eventDate) + 1);
  const pct = (iso: string) => Math.min(100, Math.max(0, (daysBetween(start, iso) / total) * 100));
  const todayPct = pct(today);
  const daysLeft = daysBetween(today, eventDate);

  return (
    <section aria-labelledby="ate-a-festa" className={cn(CARD, "px-5 py-5 sm:px-6")}>
      <BlockHeader id="ate-a-festa" title="Até a festa" hint={`Referências da seção 16 contadas a partir de ${formatDayMonth(eventDate)}. As datas reais de gravação você marca em Gravações.`}>
        <span className="text-sm text-muted-foreground">
          Hoje, {formatDayMonth(today)} · <span className="font-semibold text-foreground">{daysLeft} dias</span>
        </span>
      </BlockHeader>

      <div className="relative mt-8 h-9" aria-hidden>
        <div className="absolute inset-y-2 left-0 right-0 rounded-full bg-[#eef3f5]" />
        {phases.map((phase, index) => {
          const from = daysBefore(eventDate, phase.from);
          const to = daysBefore(eventDate, phase.to);
          const state = today > to ? "passou" : today >= from ? "agora" : "depois";
          return (
            <div
              key={phase.from}
              className={cn(
                "absolute inset-y-2 grid place-items-center border-l-2 border-white text-xs font-semibold",
                state === "agora" ? "bg-[#47cdd0] text-[#06323a]" : state === "passou" ? "bg-[#cfdde1] text-[#5c7480]" : index % 2 ? "bg-[#3e84a8] text-white" : "bg-[#347796] text-white",
              )}
              style={{ left: `${pct(from)}%`, width: `${pct(addDays(to, 1)) - pct(from)}%` }}
            >
              {index + 1}
            </div>
          );
        })}
        <div className="absolute inset-y-0 grid place-items-center" style={{ left: `calc(${pct(eventDate)}% - 6px)` }}>
          <span className="size-5 rounded-full ring-4 ring-white" style={{ backgroundColor: FILM.gold }} />
        </div>
        {todayPct < 100 && (
          <div className="absolute -top-6 bottom-0 flex flex-col items-center" style={{ left: `${todayPct}%`, transform: "translateX(-50%)" }}>
            <span className="rounded bg-foreground px-1.5 py-0.5 text-xs font-semibold text-white">hoje</span>
            <span className="w-0.5 flex-1 bg-foreground" />
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{formatDayMonth(start)}</span>
        <span className="font-semibold" style={{ color: FILM.goldText }}>
          Festa · {formatDayMonth(eventDate)}
        </span>
      </div>

      <ol className="mt-5 grid gap-x-5 gap-y-5 sm:grid-cols-2 xl:grid-cols-5">
        {phases.map((phase, index) => {
          const from = daysBefore(eventDate, phase.from);
          const to = daysBefore(eventDate, phase.to);
          const state = today > to ? "passou" : today >= from ? "agora" : "depois";
          return (
            <li key={phase.from} className={cn("min-w-0", state === "passou" && "opacity-60")}>
              <div className="flex items-center gap-2">
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", state === "agora" ? "bg-[#47cdd0] text-[#06323a]" : "bg-[#eaf2f5] text-[#285f7a]")}>{index + 1}</span>
                <p className="text-[15px] font-semibold tabular-nums text-foreground">
                  {formatDayMonth(from)} – {formatDayMonth(to)}
                </p>
              </div>
              <p className="mt-0.5 pl-8 text-xs text-muted-foreground">
                D-{phase.from} a D-{phase.to}
                {state === "agora" ? " · em andamento" : ""}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground/85">{capitalize(phase.text.replace(/\.$/, ""))}.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {phaseIndicators(phase, board).map((indicator) => (
                  <Link
                    key={indicator.label}
                    href={indicator.href}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium hover:underline",
                      indicator.done ? "bg-emerald-50 text-emerald-800" : "bg-[#f1f6f8] text-[#285f7a]",
                    )}
                  >
                    {indicator.done && <Check className="size-3" aria-hidden />}
                    {indicator.label}
                  </Link>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ o que falta */

function NowRow({ icon: Icon, done, title, detail, href, aside }: { icon: LucideIcon; done?: boolean; title: string; detail: string; href: string; aside?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 rounded-md px-2 py-3 outline-none hover:bg-[#f4f8fa] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", done ? "bg-emerald-50 text-emerald-700" : "bg-[#eaf2f5] text-[#285f7a]")}>
          {done ? <Check className="size-5" aria-hidden /> : <Icon className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-5 text-foreground">{title}</span>
          <span className="block text-[13px] leading-5 text-muted-foreground">{detail}</span>
        </span>
        {aside}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function NowList({ board }: { board: DocBoard }) {
  const today = todayInSaoPaulo();
  const approvers = board.people.filter((person) => person.is_approver);
  const validation = board.approvals.filter((item) => item.stage === "validacao");
  const open = validation.filter((item) => item.approvers.some((key) => currentStatus(item, key) === "pendente"));
  const perPerson = approvers.map((person) => ({
    person,
    pending: validation.filter((item) => item.approvers.includes(person.key) && currentStatus(item, person.key) === "pendente").length,
  }));
  const undated = board.shoots.filter((shoot) => !shoot.scheduled_date && shoot.status !== "cancelada");
  const next = board.shoots
    .filter((shoot) => shoot.scheduled_date && shoot.scheduled_date >= today && shoot.status !== "cancelada")
    .sort((a, b) => `${a.scheduled_date}${a.start_time ?? ""}`.localeCompare(`${b.scheduled_date}${b.start_time ?? ""}`))[0];
  const before = board.checklist.filter((item) => item.phase === "antes");
  const beforeDone = before.filter((item) => item.done_at).length;
  const nextTask = before.find((item) => !item.done_at);
  const archive = board.archiveSummary;

  return (
    <section aria-labelledby="o-que-falta" className={cn(CARD, "px-3 py-4")}>
      <h2 id="o-que-falta" className="px-2 text-[17px] font-semibold text-foreground">
        O que falta agora
      </h2>
      <ul className="mt-1 divide-y divide-[#eef3f4]">
        <NowRow
          icon={Stamp}
          done={open.length === 0}
          title={open.length ? `${open.length} pontos esperam o ok dos sócios` : "Pontos antes da gravação decididos"}
          detail={perPerson.map(({ person, pending }) => `${person.short_name}: ${pending}`).join(" · ")}
          href="/documentario/aprovacao"
          aside={
            <span className="flex -space-x-2">
              {approvers.map((person) => (
                <Face key={person.key} name={person.name} avatarUrl={person.avatar_url} size="sm" className="ring-2 ring-white" />
              ))}
            </span>
          }
        />
        <NowRow
          icon={CalendarPlus}
          done={undated.length === 0}
          title={undated.length ? `${undated.length} ${undated.length === 1 ? "gravação sem data" : "gravações sem data"}` : "Todas as gravações têm data"}
          detail={next ? `Próxima: ${next.title}, ${formatWeekdayDate(next.scheduled_date)}${next.start_time ? ` às ${formatHour(next.start_time)}` : ""}` : "Nenhuma data marcada ainda"}
          href="/documentario/gravacoes"
        />
        <NowRow
          icon={Images}
          done={archive.total > 0 && archive.pendente === 0}
          title={archive.total ? `${archive.total} itens no acervo` : "Acervo vazio"}
          detail={archive.total ? `${archive.aprovado} aprovados · ${archive.pendente} para revisar` : "Fotos e vídeos antigos, em pasta privada"}
          href="/documentario/acervo"
        />
        <NowRow
          icon={ListChecks}
          done={before.length > 0 && beforeDone === before.length}
          title={`Antes das entrevistas: ${beforeDone} de ${before.length}`}
          detail={nextTask ? `Próximo: ${nextTask.text.replace(/\.$/, "")}` : "Checklist completo"}
          href="/documentario/dia"
        />
      </ul>
    </section>
  );
}

function VersionsPanel({ board, onClose }: { board: DocBoard; onClose: () => void }) {
  const last = board.versions[0];
  const changed = last ? board.sections.filter((section) => (last.section_versions[section.slug] ?? 0) !== section.version) : [];
  return (
    <section aria-labelledby="versoes" className={cn(CARD, "px-5 py-4")}>
      <BlockHeader id="versoes" title="Versões">
        {board.viewer.can_edit && (
          <Button size="sm" variant="secondary" onClick={onClose} disabled={changed.length === 0} title={changed.length ? undefined : "Nada mudou desde a última versão"}>
            Fechar versão
          </Button>
        )}
      </BlockHeader>
      {changed.length > 0 && (
        <p className="mt-3 rounded-md bg-[#47cdd0]/10 px-3 py-2 text-[13px] leading-5 text-[#1f5d63]">
          Mudou desde a {last?.version_label}: {changed.map((section) => section.title).join("; ")}.
        </p>
      )}
      <ol className="mt-3 space-y-3">
        {board.versions.map((version, index) => (
          <li key={version.id} className="flex gap-3">
            <span className={cn("mt-0.5 grid h-6 min-w-9 place-items-center rounded-md px-1.5 text-xs font-semibold tabular-nums", index === 0 ? "bg-[#347796] text-white" : "bg-[#eaf2f5] text-[#285f7a]")}>
              {version.version_label}
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-5 text-foreground">{version.note}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {version.created_by_name ? `${version.created_by_name} · ` : ""}
                {formatDateTimeShort(version.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ o filme */

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function EditTimeline({ blocks, total }: { blocks: TimelineBlock[]; total: number }) {
  const [active, setActive] = useState(0);
  const selected = blocks[active] ?? blocks[0];
  const ticks: number[] = [];
  for (let second = 0; second <= total; second += 30) ticks.push(second);
  return (
    <div>
      <div className="relative h-6" aria-hidden>
        {ticks.map((second) => (
          <span key={second} className="absolute bottom-0 flex flex-col items-center" style={{ left: `${(second / total) * 100}%`, transform: "translateX(-50%)" }}>
            {second % 60 === 0 && <span className="mb-0.5 font-mono text-xs text-muted-foreground">{clock(second)}</span>}
            <span className={cn("w-px bg-[#c4d4da]", second % 60 === 0 ? "h-2" : "h-1")} />
          </span>
        ))}
      </div>
      <div role="tablist" aria-label="Blocos do roteiro" className="flex h-16 gap-0.5 overflow-hidden rounded-md">
        {blocks.map((block, index) => {
          const on = index === active;
          return (
            <button
              key={`${block.start}-${block.title}`}
              type="button"
              role="tab"
              aria-selected={on}
              title={`${block.title} · ${clock(block.start)}–${clock(block.end)}`}
              onClick={() => setActive(index)}
              style={{ width: `${((block.end - block.start) / total) * 100}%`, backgroundColor: on ? "#347796" : index % 2 ? FILM.navySoft : FILM.navy }}
              className={cn(
                "relative flex min-w-0 flex-col justify-between px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]",
                !on && "hover:brightness-125",
              )}
            >
              <span className="truncate text-[13px] font-semibold leading-4 text-white">{block.title}</span>
              <span className="truncate font-mono text-xs text-white/60">{clock(block.start)}</span>
              {on && <span className="absolute inset-x-0 top-0 h-1 bg-[#47cdd0]" aria-hidden />}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="mt-4 grid gap-x-6 gap-y-3 rounded-md bg-[#f6f9fa] px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-base font-semibold leading-6 text-foreground">{selected.title}</p>
            <p className="font-mono text-sm text-muted-foreground">
              {clock(selected.start)} – {clock(selected.end)}
            </p>
            <p className="text-xs text-muted-foreground">{selected.end - selected.start} segundos</p>
          </div>
          {selected.audio || selected.image ? (
            <>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#285f7a]">
                  <Mic className="size-3.5" aria-hidden />
                  Áudio e intenção
                </p>
                <p className="mt-1 text-sm leading-6 text-foreground/85">{selected.audio}</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#285f7a]">
                  <Camera className="size-3.5" aria-hidden />
                  Imagem e edição
                </p>
                <p className="mt-1 text-sm leading-6 text-foreground/85">{selected.image}</p>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FilmSection({ board, onOpen }: { board: DocBoard; onOpen: (slug: string) => void }) {
  const bySlug = (slug: string) => board.sections.find((section) => section.slug === slug);
  const curve = parseEmotionalCurve(bySlug("conceito")?.body ?? "");
  const chapters = parseChapters(bySlug("estrutura")?.body ?? "");
  const festa = parseTimeline(bySlug("roteiro-festa")?.body ?? "");
  const extended = parseTimeline(bySlug("versao-estendida")?.body ?? "");
  const [cut, setCut] = useState<"festa" | "estendida">("festa");
  const blocks = cut === "festa" ? festa : extended;
  const total = blocks.length ? blocks[blocks.length - 1].end : 0;
  const openLink = (slug: string, label: string) => (
    <button type="button" onClick={() => onOpen(slug)} className="inline-flex items-center gap-1 text-sm font-medium text-[#285f7a] hover:underline">
      {label}
      <ArrowRight className="size-3.5" aria-hidden />
    </button>
  );

  return (
    <section aria-labelledby="o-filme" className={cn(CARD, "divide-y divide-[#eef3f4]")}>
      {total > 0 && (
        <div className="px-5 py-5 sm:px-6">
          <BlockHeader id="o-filme" title="Roteiro de montagem" hint="Roteiro de intenção, não de falas: os trechos dependem das entrevistas reais e do acervo.">
            <div role="radiogroup" aria-label="Versão do filme" className="inline-flex rounded-md bg-[#eef4f6] p-0.5 text-sm font-medium">
              {(
                [
                  ["festa", `Festa · ${formatFilmDuration(festa.at(-1)?.end ?? 0)}`],
                  ["estendida", `Estendida · ${formatFilmDuration(extended.at(-1)?.end ?? 0)}`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={cut === id}
                  onClick={() => setCut(id)}
                  className={cn("min-h-9 rounded px-3", cut === id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {label}
                </button>
              ))}
            </div>
          </BlockHeader>
          <div className="mt-5">
            <EditTimeline key={cut} blocks={blocks} total={total} />
          </div>
          <div className="mt-3 text-right">{openLink(cut === "festa" ? "roteiro-festa" : "versao-estendida", "Ler a seção completa")}</div>
        </div>
      )}

      {chapters.length > 0 && (
        <div className="px-5 py-5 sm:px-6">
          <BlockHeader title="Estrutura em capítulos" hint="Das origens dos sócios ao convite para os próximos capítulos.">
            {openLink("estrutura", "Seção 6")}
          </BlockHeader>
          <ol className="-mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin] xl:grid xl:grid-cols-7 xl:overflow-visible">
            {chapters.map((chapter) => (
              <li key={chapter.key} className="w-48 shrink-0 snap-start overflow-hidden rounded-md border border-[#e3ecef] bg-white xl:w-auto">
                <p className="px-3 py-2 text-[13px] font-semibold" style={{ backgroundColor: FILM.navy, color: FILM.gold }}>
                  {chapter.label}
                </p>
                <div className="px-3 py-3">
                  <p className="text-sm font-semibold leading-5 text-foreground">{chapter.title}</p>
                  <p className="mt-1.5 line-clamp-5 text-[13px] leading-5 text-muted-foreground">{chapter.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {curve.length > 0 && (
        <div className="px-5 py-5 sm:px-6">
          <BlockHeader title="Curva emocional" hint="O que o público sente, na ordem do filme.">
            {openLink("conceito", "Seção 3")}
          </BlockHeader>
          <ol className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {curve.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold" style={{ backgroundColor: FILM.navy, color: FILM.gold }}>
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-6 text-foreground">{step.title}</p>
                  <p className="text-[13px] leading-5 text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ documento */

const GROUPS: { title: string; slugs: string[] }[] = [
  { title: "Ideia", slugs: ["resumo-executivo", "contexto", "conceito", "proposito", "historias-pessoais"] },
  { title: "Roteiro e entrevistas", slugs: ["estrutura", "roteiro-festa", "versao-estendida", "entrevistas", "abertura-final"] },
  { title: "Produção", slugs: ["fotografia", "broll", "acervo", "indicadores", "identidade", "etapas", "entregaveis"] },
  { title: "Aprovação e apoio", slugs: ["criterios", "validar", "briefing-filmmaker", "referencias", "checklist", "nota-editorial"] },
];

function DocumentToc({ board, onOpen }: { board: DocBoard; onOpen: (slug: string) => void }) {
  const known = new Set(GROUPS.flatMap((group) => group.slugs));
  const extra = board.sections.filter((section) => !known.has(section.slug)).map((section) => section.slug);
  const groups = extra.length ? [...GROUPS, { title: "Outras", slugs: extra }] : GROUPS;
  const openComments = board.comments.filter((comment) => !comment.resolved_at).length;
  return (
    <section aria-labelledby="documento" className={cn(CARD, "px-5 py-5 sm:px-6")}>
      <BlockHeader
        id="documento"
        title="Documento do projeto"
        hint={`${board.sections.length} seções. Cada edição vira uma versão, e os sócios podem comentar em cada parte.${openComments ? ` ${openComments} comentários abertos.` : ""}`}
      />
      <div className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="border-b border-[#e6eef0] pb-2 text-[13px] font-semibold text-foreground">{group.title}</h3>
            <ul className="mt-1">
              {group.slugs.map((slug) => {
                const section = board.sections.find((item) => item.slug === slug);
                if (!section) return null;
                const comments = board.comments.filter((comment) => comment.section_id === section.id && !comment.resolved_at).length;
                return (
                  <li key={slug}>
                    <button
                      type="button"
                      onClick={() => onOpen(slug)}
                      className="group flex min-h-10 w-full items-start gap-2.5 rounded-md px-1.5 py-2 text-left outline-none hover:bg-[#f4f8fa] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40"
                    >
                      <span className="w-5 shrink-0 text-right text-[13px] font-semibold tabular-nums" style={{ color: FILM.goldText }}>
                        {section.number ?? "·"}
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-5 text-foreground group-hover:text-[#285f7a]">{section.title}</span>
                      {comments > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[#285f7a]" title={`${comments} comentário(s) aberto(s)`}>
                          <MessageSquare className="size-3.5" aria-hidden />
                          {comments}
                        </span>
                      )}
                      {section.version > 1 && <span className="shrink-0 rounded-full bg-[#eaf2f5] px-1.5 text-xs font-medium text-[#285f7a]">v{section.version}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ página */

export function DocProjetoClient({ initialBoard }: { initialBoard: DocBoard }) {
  const [board, setBoard] = useState(initialBoard);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [closingVersion, setClosingVersion] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "erro"; text: string } | null>(null);
  const phases = useMemo(() => parseRelativeSchedule(board.sections.find((section) => section.slug === "etapas")?.body ?? ""), [board.sections]);
  const openSection = board.sections.find((section) => section.slug === openSlug) ?? null;
  const setSections = (sections: DocSection[]) => setBoard((current) => ({ ...current, sections }));

  return (
    <div className="space-y-6">
      <TitleCard board={board} onEdit={() => setEditingProject(true)} />
      <Feedback message={message} onClose={() => setMessage(null)} />
      {!board.viewer.can_edit && board.viewer.person_key && (
        <p className="rounded-md bg-[#f3f8fa] px-4 py-3 text-sm text-foreground/80">
          Leia as seções, comente o que quiser mudar e registre suas decisões na aba Aprovação dos sócios.
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <NowList board={board} />
        <div className="space-y-6">
          <VersionsPanel board={board} onClose={() => setClosingVersion(true)} />
          {board.event?.task && (
            <Link href={`/eventos/${board.event.id}?tab=checklist`} className={cn(CARD, "flex items-center gap-3 px-5 py-4 text-sm hover:border-[#47cdd0]/70")}>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">No checklist da festa</span>
                <span className="font-medium text-foreground">{board.event.task.title}</span>
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          )}
        </div>
      </div>
      <CountdownTrack board={board} phases={phases} />
      <FilmSection board={board} onOpen={setOpenSlug} />
      <DocumentToc board={board} onOpen={setOpenSlug} />

      {openSection && (
        <SectionDialog
          key={openSection.id}
          section={openSection}
          board={board}
          onClose={() => setOpenSlug(null)}
          onSections={(sections) => {
            setSections(sections);
            setMessage({ type: "ok", text: "Seção salva. A versão anterior continua no histórico." });
          }}
          onComments={(comments) => setBoard((current) => ({ ...current, comments }))}
        />
      )}
      {editingProject && (
        <ProjectDialog
          project={board.project}
          onClose={() => setEditingProject(false)}
          onSaved={(project) => {
            setBoard((current) => ({ ...current, project }));
            setEditingProject(false);
            setMessage({ type: "ok", text: "Cartela atualizada." });
          }}
        />
      )}
      {closingVersion && (
        <CloseVersionDialog
          board={board}
          onClose={() => setClosingVersion(false)}
          onSaved={(versions, label) => {
            setBoard((current) => ({ ...current, versions, project: { ...current.project, version_label: label } }));
            setClosingVersion(false);
            setMessage({ type: "ok", text: `Versão ${label} fechada.` });
          }}
        />
      )}
    </div>
  );
}
