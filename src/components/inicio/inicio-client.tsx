"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Cake,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  Flag,
  Handshake,
  IdCard,
  ImagePlus,
  KanbanSquare,
  Layers,
  LayoutGrid,
  Link2,
  Megaphone,
  Palmtree,
  PartyPopper,
  Scale,
  Settings,
  Shirt,
  SlidersHorizontal,
  Star,
  Target,
  Trophy,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import { BirthdayArtViewer, BirthdayArtsDialog } from "@/components/inicio/birthday-arts-dialog";
import { NavBadgePill, sumBadges, useNavBadges } from "@/components/layout/nav-badges";
import { ToolLogo } from "@/components/rh/registration/welcome-ui";
import { useAuth } from "@/contexts/auth-context";
import { daysBetween, greeting, shortDate, tenureLabel, todayInBrasilia } from "@/lib/inicio/dates";
import {
  MAX_FAVORITES,
  linkFavoriteKey,
  moduleFavoriteKey,
  systemFavoriteKey,
  takeLegacyFavorites,
} from "@/lib/inicio/favorites";
import { OFFICE_SYSTEMS, type OfficeSystem } from "@/lib/inicio/systems";
import type {
  HomeBirthday,
  HomeData,
  HomeNewcomer,
  HomePending,
  HomePendingKind,
  HomeWorkAnniversary,
} from "@/lib/inicio/types";
import { buildNav, type VisibleNavFeature, type VisibleNavFront } from "@/lib/navigation";
import { awardPhotoUrl } from "@/lib/rh/bp-awards/format";
import { cn } from "@/lib/utils";

const PENDING_ICON: Record<HomePendingKind, LucideIcon> = {
  "bp-awards": Trophy,
  pesquisa: ClipboardList,
  festa: PartyPopper,
  ficha: IdCard,
  reels: Clapperboard,
  vistagem: CalendarClock,
};

/** Ícone e tom de cada frente (os tons derivam do ciano, azul e índigo da marca). */
const FRONT_LOOK: Record<string, { icon: LucideIcon; tile: string; chip: string }> = {
  estrategia: { icon: Target, tile: "bg-[#eef1f8]", chip: "bg-[#dfe3f1] text-[#48466e]" },
  marketing: { icon: Megaphone, tile: "bg-[#e8f8f8]", chip: "bg-[#cdeff0] text-[#1f6f72]" },
  relacionamento: { icon: Handshake, tile: "bg-[#eaf2f7]", chip: "bg-[#d4e6ef] text-[#285f7a]" },
  pessoas: { icon: Users, tile: "bg-[#e8f8f8]", chip: "bg-[#cdeff0] text-[#1f6f72]" },
  "operacoes-legais": { icon: Scale, tile: "bg-[#eef1f8]", chip: "bg-[#dfe3f1] text-[#48466e]" },
  facilities: { icon: Building2, tile: "bg-[#eaf2f7]", chip: "bg-[#d4e6ef] text-[#285f7a]" },
  administracao: { icon: Settings, tile: "bg-[#f1f4f6]", chip: "bg-[#e1e7ea] text-[#3b4d57]" },
};
const DEFAULT_FRONT_LOOK = { icon: Layers, tile: "bg-[#eaf2f7]", chip: "bg-[#d4e6ef] text-[#285f7a]" };

const LEAVE_LABEL: Record<string, string> = { ferias: "Férias", recesso: "Recesso", abono: "Abono" };
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Quantos aniversariantes cabem na tela antes do "Ver todos". */
const BIRTHDAYS_ON_SCREEN = 4;
/** Quantos aniversários de empresa cabem na tela. */
const WORK_ANNIVERSARIES_ON_SCREEN = 3;
/** Prazo a até N dias vira "Prioridade". */
const PRIORITY_DAYS = 3;

/** Dourado e marinho da Bismarchi | Pires: só na saudação e no destaque da festa. */
const GOLD = "#E1B16D";

const SURFACE = "rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.05)]";
const TEXT_LINK = "inline-flex items-center gap-1 text-xs font-semibold text-[#347796] outline-none hover:text-[#285f7a] hover:underline focus-visible:underline";

function longToday(): string {
  const text = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Prazo em dia de calendário de Brasília: "Até 13 nov · faltam 3 dias". */
function deadlineInfo(deadline: string, today: string): { label: string; chip: string; priority: boolean } | null {
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  const day = todayInBrasilia(date);
  const left = daysBetween(today, day);
  if (left < 0) return null;
  const when = left === 0 ? "encerra hoje" : left === 1 ? "encerra amanhã" : `faltam ${left} dias`;
  const chip = left === 0 ? "Hoje" : left === 1 ? "Amanhã" : shortDate(day, today);
  return { label: `Até ${shortDate(day, today)} · ${when}`, chip, priority: left <= PRIORITY_DAYS };
}

function countdown(target: string, today: string): string {
  const left = daysBetween(today, target);
  if (left === 0) return "É hoje";
  if (left === 1) return "É amanhã";
  return `Faltam ${left} dias`;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/* ------------------------------------------------------------------ topo */

function Hero({ data, loading }: { data: HomeData | null; loading: boolean }) {
  const { profile } = useAuth();
  const name = data?.me.name || profile?.name || "";
  const firstName = data?.me.firstName || name.trim().split(/\s+/)[0] || "";
  const tenure = data?.me.admissionDate ? tenureLabel(data.me.admissionDate, data.today) : null;
  const role = [data?.me.position, data?.me.department ?? profile?.department].filter(Boolean).join(" · ");
  const salutation = data?.me.birthdayToday ? "Feliz aniversário" : greeting();

  const shortcuts: Array<{ href: string; label: string; icon: LucideIcon }> = [
    { href: "/perfil", label: "Meu perfil", icon: User },
    { href: "/minha-ficha", label: "Minha ficha", icon: IdCard },
    { href: "/meus-links", label: "Meus links", icon: Link2 },
  ];
  const chip = "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-white/85";

  return (
    <section className="relative overflow-hidden rounded-xl bg-[#03070c] text-[#f9f9f9]">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_140%_at_85%_0%,#0b3a52_0%,#04202f_42%,#03070c_100%)]"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/inicio/fachada-fenix.webp"
        alt=""
        aria-hidden
        // Faixa estreita ao lado dos botões: a fênix cabe inteira e as bordas somem no fundo escuro.
        className="pointer-events-none absolute inset-y-0 right-[196px] hidden h-full w-[380px] select-none object-cover object-[50%_52%] opacity-90 [mask-image:linear-gradient(90deg,transparent_0%,black_32%,black_70%,transparent_100%)] lg:block"
      />
      <div className="relative flex flex-col gap-6 px-5 py-7 sm:px-8 sm:py-8 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
          <EmployeeAvatar
            name={name || "?"}
            avatarUrl={data?.me.avatarUrl ?? awardPhotoUrl(profile?.avatar_url ?? null, 192)}
            className="h-24 w-24 ring-2 ring-[#E1B16D] ring-offset-4 ring-offset-[#04202f] sm:h-28 sm:w-28"
            fallbackClassName="bg-[#0b3347] text-2xl text-[#f9f9f9]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/80">{longToday()}</p>
            <p className="mt-1 text-3xl font-semibold leading-tight sm:text-[34px]">
              {salutation}
              {firstName && (
                <>
                  , <span style={{ color: GOLD }}>{firstName}</span>
                </>
              )}
              {data?.me.birthdayToday ? "!" : ""}
            </p>
            <p className="mt-2 min-h-5 text-[15px] text-white/85">
              {loading && !data ? <span className="inline-block h-4 w-64 animate-pulse rounded bg-white/10" /> : role || "ORQESTRAI"}
            </p>
            {(tenure || data?.teamSize) && (
              <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
                {tenure && (
                  <span className={chip}>
                    <CalendarDays className="size-4" style={{ color: GOLD }} aria-hidden />
                    {tenure} no time
                  </span>
                )}
                {data?.teamSize ? (
                  <span className={chip}>
                    <Users className="size-4" style={{ color: GOLD }} aria-hidden />
                    {data.teamSize} pessoas no escritório
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <nav aria-label="Atalhos da sua conta" className="flex flex-wrap gap-2.5 lg:w-[168px] lg:flex-col">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="inline-flex min-h-11 flex-1 items-center gap-2.5 rounded-lg border border-white/15 bg-white/[0.07] px-4 text-sm font-semibold text-white outline-none backdrop-blur-sm transition-colors hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-[#47cdd0] lg:flex-none"
            >
              <shortcut.icon className="size-[18px]" aria-hidden />
              {shortcut.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  tone,
  href,
  onClick,
  tall,
}: {
  icon: LucideIcon;
  value: number | null;
  label: string;
  tone: string;
  href?: string;
  onClick?: () => void;
  /** Em pé (ícone em cima, número embaixo): acompanha a altura de um painel vizinho. */
  tall?: boolean;
}) {
  const className = cn(
    SURFACE,
    "group flex w-full gap-4 px-4 text-left outline-none transition-shadow hover:shadow-[0_6px_18px_rgba(4,32,47,0.08)] focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
    tall ? "h-full min-h-[112px] flex-col justify-between py-4" : "min-h-[76px] items-center py-3.5"
  );
  const body = (
    <>
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-semibold leading-none text-[#0d2a38]">
          {value === null ? <span className="inline-block h-6 w-8 animate-pulse rounded bg-[#eaf2f5]" /> : value}
        </span>
        <span className={cn("mt-1.5 block text-sm text-[#3b5560]", !tall && "truncate")}>{label}</span>
      </span>
      {!tall && <ChevronRight className="size-4 shrink-0 text-[#7b929c] transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </>
  );
  if (href?.startsWith("#")) return <a href={href} className={className}>{body}</a>;
  if (href) return <Link href={href} className={className}>{body}</Link>;
  return <button type="button" onClick={onClick} className={className}>{body}</button>;
}

/** Cores dos segmentos do painel (azul de ação, ciano, índigo e neutro da marca). */
const SEGMENT_COLORS = ["#347796", "#47cdd0", "#48466e", "#9fb2ba"];

/** Total com barra dividida e uma linha por parte (ex.: publicações em cada fila da Vistagem). */
function BreakdownMeter({ item, className }: { item: HomePending; className?: string }) {
  const parts = item.breakdown ?? [];
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const percent = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
  return (
    <section className={cn(SURFACE, "flex flex-col px-5 py-4", className)}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Bell className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#0d2a38]">Publicações na Vistagem</h2>
            <p className="text-xs text-[#5a717b]">Quanto falta em cada fila</p>
          </div>
        </div>
        <Link href={item.href} className={TEXT_LINK}>
          Abrir a Vistagem
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </header>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold leading-none text-[#0d2a38]">{total}</span>
        <span className="text-sm text-[#5a717b]">{plural(total, "publicação nas filas", "publicações nas filas")}</span>
      </p>
      <div
        role="img"
        aria-label={parts.map((part) => `${part.label}: ${part.value}`).join(", ")}
        className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[#eaf2f5]"
      >
        {parts.map((part, index) =>
          part.value > 0 ? (
            <span
              key={part.label}
              className="min-w-1.5"
              style={{ flexGrow: part.value, backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
            />
          ) : null
        )}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
        {parts.map((part, index) => (
          <li key={part.label} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[#3b5560]">{part.label}</span>
            <span className="font-semibold tabular-nums text-[#0d2a38]">{part.value}</span>
            <span className="w-9 text-right text-xs tabular-nums text-[#5a717b]">{percent(part.value)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------ pendências */

function PendingList({ pending, today }: { pending: HomePending[]; today: string }) {
  if (pending.length === 0) {
    return (
      <div className="flex flex-1 items-center gap-3 px-5 py-8">
        <CheckCircle2 className="size-9 shrink-0 text-emerald-600" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-[#0d2a38]">Tudo em dia</p>
          <p className="text-sm text-muted-foreground">Nada esperando por você agora.</p>
        </div>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-[#e6eff1] px-5">
      {pending.map((item) => {
        const Icon = PENDING_ICON[item.kind];
        const deadline = item.deadline ? deadlineInfo(item.deadline, today) : null;
        return (
          <li key={item.id}>
            <Link href={item.href} className="group -mx-2 flex min-h-[52px] items-center gap-3 rounded-md px-2 py-2 outline-none transition-colors hover:bg-[#f4fafb] focus-visible:bg-[#f4fafb]">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#f1f5f6] text-[#3b5560]">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[#0d2a38]">{item.title}</span>
                {item.detail && <span className="block truncate text-xs text-[#5a717b]">{item.detail}</span>}
              </span>
              {deadline && (
                <span
                  title={deadline.label}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
                    deadline.priority ? "bg-amber-100 text-amber-800" : "bg-[#eaf2f5] text-[#285f7a]"
                  )}
                >
                  <CalendarDays className="size-3.5" aria-hidden />
                  {deadline.chip}
                </span>
              )}
              {deadline?.priority && <Flag className="size-4 shrink-0 fill-amber-500 text-amber-600" aria-label="Prioridade" />}
              <ChevronRight className="size-4 shrink-0 text-[#7b929c] transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Destaque da festa de 10 anos, com as cores e o selo da Bismarchi | Pires. */
function PartyBanner({ data }: { data: HomeData }) {
  const party = data.party;
  if (!party) return null;
  const toConfirm = data.pending.some((item) => item.kind === "festa");
  return (
    <section className="relative flex min-h-[236px] overflow-hidden rounded-lg bg-[#0D1E2E] text-white">
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center px-6 py-6">
        <p className="text-xs font-semibold uppercase" style={{ color: GOLD }}>
          {countdown(party.date, data.today)}
        </p>
        <p className="mt-1.5 text-[26px] font-light lowercase leading-tight">
          aniversário do escritório
          <span className="block text-[44px] font-semibold leading-none" style={{ color: GOLD }}>
            10 anos
          </span>
        </p>
        <p className="mt-3 text-sm text-white/80">
          {shortDate(party.date, data.today)}
          {party.location ? ` · ${party.location}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {toConfirm ? (
            <Link
              href="/festa-10-anos"
              className="inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold text-[#0D1E2E] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white"
              style={{ backgroundColor: GOLD }}
            >
              Confirmar presença
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
          <Link href="/dress-code" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-white/90 outline-none hover:underline focus-visible:underline">
            Ver o dress code
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
      <div className="relative hidden w-[42%] shrink-0 items-center justify-center bg-[#f7f1e6] sm:flex" aria-hidden>
        <div className="absolute inset-y-0 -left-6 w-12 -skew-x-6 bg-[#f7f1e6]" />
        <Image
          src="/dress-code/10-anos/logo-10-anos.png"
          alt=""
          width={640}
          height={527}
          unoptimized
          className="relative h-auto w-[82%] max-w-[220px] object-contain"
        />
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- agenda */

function DateBlock({ iso }: { iso: string }) {
  return (
    <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border border-[#dce9eb] bg-[#f6fafb] leading-none">
      <span className="text-lg font-semibold text-[#0d2a38]">{iso.slice(8, 10)}</span>
      <span className="mt-0.5 text-xs font-medium text-[#5a717b]">{MONTHS[Number(iso.slice(5, 7)) - 1]}</span>
    </span>
  );
}

function Agenda({ data }: { data: HomeData }) {
  const { nextLeave, nextRecess, party, today } = data;
  const range = (start: string, end: string) => `${shortDate(start, today)} a ${shortDate(end, today)}`;
  const rows: Array<{ id: string; date: string; title: string; detail: string }> = [];
  if (nextLeave) {
    const kind = LEAVE_LABEL[nextLeave.kind] ?? "Férias";
    rows.push({
      id: "folga",
      date: nextLeave.start,
      title: nextLeave.start <= today ? `Você está de ${kind.toLowerCase()}` : `Suas ${kind.toLowerCase()}`,
      detail: `${range(nextLeave.start, nextLeave.end)} · ${nextLeave.days} ${plural(nextLeave.days, "dia", "dias")}`,
    });
  }
  if (party) {
    rows.push({ id: "festa", date: party.date, title: party.name, detail: party.location ?? countdown(party.date, today) });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex flex-1 flex-col">
      {rows.length === 0 && !nextRecess ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">Nenhuma data marcada por enquanto.</p>
      ) : (
        <ul className="divide-y divide-[#e6eff1] px-5">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3.5 py-3">
              <DateBlock iso={row.date} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0d2a38]">{row.title}</p>
                <p className="truncate text-xs text-[#5a717b]">{row.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {nextRecess && (
        <div className="mt-auto flex items-center gap-3.5 rounded-b-lg border-t border-[#dfe3f1] bg-[#eef1f8] px-5 py-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white text-[#48466e]">
            <Palmtree className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0d2a38]">Recesso do escritório</p>
            <p className="text-sm text-[#2f3f55]">{range(nextRecess.start, nextRecess.end)}</p>
            <p className="text-xs text-[#5a5878]">{nextRecess.start > today ? countdown(nextRecess.start, today) : "Em andamento"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ áreas */

function FeatureLink({ feature, onNavigate }: { feature: VisibleNavFeature; onNavigate?: () => void }) {
  const badgeFor = useNavBadges();
  const badge = sumBadges(feature.pages.map((page) => badgeFor(page.href)));
  return (
    <Link
      href={feature.href}
      onClick={onNavigate}
      className="group flex min-h-12 items-center gap-3 rounded-md border border-transparent px-2.5 py-2 outline-none transition-colors hover:border-[#dce9eb] hover:bg-[#f4fafb] focus-visible:border-[#47cdd0] focus-visible:bg-[#f4fafb]"
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-md bg-[#e8f8f8] text-[#285f7a] transition-colors group-hover:bg-[#347796] group-hover:text-white">
        <feature.icon className="size-[18px]" aria-hidden />
        <NavBadgePill badge={badge} variant="dot" active={false} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#0d2a38]">{feature.label}</span>
      <ChevronRight className="size-4 shrink-0 text-[#9fb2ba]" aria-hidden />
    </Link>
  );
}

/** Módulos de uma frente (ou de todas), em modal centralizado. */
function ModulesDialog({
  fronts,
  open,
  onClose,
}: {
  fronts: VisibleNavFront[];
  /** Id da frente, "all" para todas, null fechado. */
  open: string | null;
  onClose: () => void;
}) {
  const shown = open === "all" ? fronts : fronts.filter((front) => front.id === open);
  const single = shown.length === 1 ? shown[0] : null;
  return (
    <Dialog open={open !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn("flex max-h-[90dvh] flex-col gap-0 p-0", single ? "sm:max-w-lg" : "sm:max-w-2xl")}>
        <DialogHeader className="border-b border-[#e6eff1] px-6 py-4">
          <DialogTitle>{single ? single.label : "Todos os módulos"}</DialogTitle>
          <DialogDescription>
            {single
              ? `${single.features.length} ${plural(single.features.length, "módulo liberado", "módulos liberados")} para o seu acesso.`
              : "O que está liberado para o seu acesso, por área."}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-4 py-3">
          {shown.map((front) => (
            <div key={front.id} className={cn(!single && "py-2")}>
              {!single && <p className="px-2.5 pb-1 text-xs font-semibold uppercase text-[#48466e]">{front.label}</p>}
              <ul className={cn("grid gap-1", !single && "sm:grid-cols-2")}>
                {front.features.map((feature) => (
                  <li key={feature.id}>
                    <FeatureLink feature={feature} onNavigate={onClose} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Areas({ fronts, onOpen }: { fronts: VisibleNavFront[]; onOpen: (frontId: string) => void }) {
  if (fronts.length === 0) {
    return <p className="px-5 py-8 text-sm text-muted-foreground">Nenhum módulo liberado para o seu acesso ainda.</p>;
  }
  return (
    <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
      {fronts.map((front) => {
        const look = FRONT_LOOK[front.id] ?? DEFAULT_FRONT_LOOK;
        const count = front.features.length;
        return (
          <li key={front.id}>
            <button
              type="button"
              onClick={() => onOpen(front.id)}
              className={cn(
                "group flex min-h-[72px] w-full items-center gap-3.5 rounded-lg px-3.5 py-3 text-left outline-none transition-shadow hover:shadow-[0_6px_16px_rgba(4,32,47,0.10)] focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                look.tile
              )}
            >
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", look.chip)}>
                <look.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-[#0d2a38]">{front.label}</span>
                <span className="mt-0.5 block text-xs text-[#4a626c]">
                  {count} {plural(count, "módulo", "módulos")}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- pessoas */

type ArtView = { url: string; name: string; caption: string };

function PersonRow({
  person,
  trailing,
  highlight,
  detail,
  art,
  onOpenArt,
}: {
  person: HomeBirthday | HomeNewcomer | HomeWorkAnniversary;
  trailing: string;
  highlight?: boolean;
  /** Linha de baixo; sem ela, a área (ou o cargo). */
  detail?: string;
  art?: ArtView | null;
  onOpenArt?: (art: ArtView) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <EmployeeAvatar name={person.name} avatarUrl={person.avatarUrl} className="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#0d2a38]">{person.name}</p>
        <p className="truncate text-xs text-[#5a717b]">{detail ?? person.department ?? person.position ?? ""}</p>
      </div>
      {art && onOpenArt && (
        <button
          type="button"
          onClick={() => onOpenArt(art)}
          className="size-11 shrink-0 overflow-hidden rounded-md border border-[#dce9eb] outline-none transition-shadow hover:shadow-[0_4px_12px_rgba(4,32,47,0.14)] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
          aria-label={`Ver a arte de ${person.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art.url} alt="" className="size-full object-cover" loading="lazy" />
        </button>
      )}
      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
          highlight ? "bg-[#347796] text-white" : "bg-[#eaf2f5] text-[#285f7a]"
        )}
      >
        {trailing}
      </span>
    </li>
  );
}

const birthdayArt = (person: HomeBirthday): ArtView | null =>
  person.artUrl ? { url: person.artUrl, name: person.name, caption: "Aniversário" } : null;

const workArt = (person: HomeWorkAnniversary): ArtView | null =>
  person.artUrl
    ? { url: person.artUrl, name: person.name, caption: `Aniversário de empresa · ${person.years} ${plural(person.years, "ano", "anos")}` }
    : null;

function anniversaryWhen(person: { inDays: number; day: number; month: number }, today: string): string {
  if (person.inDays === 0) return "Hoje";
  if (person.inDays === 1) return "Amanhã";
  return shortDate(`${today.slice(0, 4)}-${String(person.month).padStart(2, "0")}-${String(person.day).padStart(2, "0")}`);
}

function Team({ data, allOpen, onAllOpenChange }: { data: HomeData; allOpen: boolean; onAllOpenChange: (open: boolean) => void }) {
  const { birthdays, newcomers, workAnniversaries, today } = data;
  const [art, setArt] = useState<ArtView | null>(null);
  /** Arte de quem comemora hoje (aniversário primeiro, depois tempo de casa): abre o bloco em destaque. */
  const featured =
    birthdays.filter((person) => person.inDays === 0).map(birthdayArt).find(Boolean) ??
    workAnniversaries.filter((person) => person.inDays === 0).map(workArt).find(Boolean) ??
    null;
  const subheading = "flex items-center gap-1.5 text-xs font-semibold uppercase text-[#48466e]";

  return (
    <div className="px-5 pb-3">
      {featured && (
        <button
          type="button"
          onClick={() => setArt(featured)}
          className="group mb-2 mt-1 block w-full overflow-hidden rounded-lg border border-[#dce9eb] bg-[#f6fafb] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={featured.url} alt={`Arte de ${featured.caption.toLowerCase()} de ${featured.name}`} className="max-h-72 w-full object-contain" />
          <span className="flex items-center gap-2 border-t border-[#dce9eb] bg-white px-3 py-2 text-sm font-semibold text-[#0d2a38]">
            <PartyPopper className="size-4 text-[#9c7434]" aria-hidden />
            Hoje: {featured.name}
            <span className="ml-auto text-xs font-medium text-[#347796] group-hover:underline">Ver a arte</span>
          </span>
        </button>
      )}
      {birthdays.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">Nenhum aniversário nos próximos 30 dias.</p>
      ) : (
        <ul className="divide-y divide-[#e6eff1]">
          {birthdays.slice(0, BIRTHDAYS_ON_SCREEN).map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              trailing={anniversaryWhen(person, today)}
              highlight={person.inDays === 0}
              art={birthdayArt(person)}
              onOpenArt={setArt}
            />
          ))}
        </ul>
      )}
      {workAnniversaries.length > 0 && (
        <div className="mt-2 border-t border-[#e6eff1] pt-3">
          <p className={subheading}>
            <Trophy className="size-3.5" aria-hidden />
            Aniversário de empresa
          </p>
          <ul>
            {workAnniversaries.slice(0, WORK_ANNIVERSARIES_ON_SCREEN).map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                trailing={anniversaryWhen(person, today)}
                highlight={person.inDays === 0}
                detail={`${person.years} ${plural(person.years, "ano", "anos")} de casa${person.department ? ` · ${person.department}` : ""}`}
                art={workArt(person)}
                onOpenArt={setArt}
              />
            ))}
          </ul>
        </div>
      )}
      {newcomers.length > 0 && (
        <div className="mt-2 border-t border-[#e6eff1] pt-3">
          <p className={subheading}>
            <UserPlus className="size-3.5" aria-hidden />
            Chegaram há pouco
          </p>
          <ul>
            {newcomers.map((person) => (
              <PersonRow key={person.id} person={person} trailing={`desde ${shortDate(person.since, today)}`} />
            ))}
          </ul>
        </div>
      )}

      <Dialog open={allOpen} onOpenChange={onAllOpenChange}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-[#e6eff1] px-6 py-4">
            <DialogTitle>Aniversários dos próximos 30 dias</DialogTitle>
            <DialogDescription>Aniversário das pessoas e de tempo de casa.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-3">
            <ul className="divide-y divide-[#e6eff1]">
              {birthdays.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  trailing={anniversaryWhen(person, today)}
                  highlight={person.inDays === 0}
                  art={birthdayArt(person)}
                  onOpenArt={setArt}
                />
              ))}
            </ul>
            {workAnniversaries.length > 0 && (
              <>
                <p className={cn(subheading, "mt-3 border-t border-[#e6eff1] pt-3")}>
                  <Trophy className="size-3.5" aria-hidden />
                  Aniversário de empresa
                </p>
                <ul className="divide-y divide-[#e6eff1]">
                  {workAnniversaries.map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      trailing={anniversaryWhen(person, today)}
                      highlight={person.inDays === 0}
                      detail={`${person.years} ${plural(person.years, "ano", "anos")} de casa${person.department ? ` · ${person.department}` : ""}`}
                      art={workArt(person)}
                      onOpenArt={setArt}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <BirthdayArtViewer art={art} onClose={() => setArt(null)} />
    </div>
  );
}

/* ------------------------------------------------------------- documentos */

/** Manuais e documentos do escritório que valem para todo mundo. */
function OfficeDocuments({ data }: { data: HomeData | null }) {
  const documents: Array<{ id: string; title: string; detail: string; href: string; icon: LucideIcon }> = [
    {
      id: "boas-praticas",
      title: "Manual de Boas Práticas",
      detail: "Edição 2025 · PDF com 17 páginas",
      href: "/api/inicio/manual-boas-praticas",
      icon: BookOpen,
    },
  ];
  if (data?.party) {
    documents.push({
      id: "dress-code",
      title: "Dress code da festa de 10 anos",
      detail: "Guia de trajes com sugestões de looks",
      href: "/dress-code",
      icon: Shirt,
    });
  }
  return (
    <ul className="divide-y divide-[#e6eff1] px-5 pb-2">
      {documents.map((document) => (
        <li key={document.id}>
          <a
            href={document.href}
            target="_blank"
            rel="noreferrer"
            className="group -mx-2 flex min-h-[60px] items-center gap-3.5 rounded-md px-2 py-2.5 outline-none transition-colors hover:bg-[#f4fafb] focus-visible:bg-[#f4fafb]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#eef1f8] text-[#48466e]">
              <document.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[#0d2a38]">{document.title}</span>
              <span className="block truncate text-xs text-[#5a717b]">{document.detail}</span>
            </span>
            <ExternalLink className="size-4 shrink-0 text-[#7b929c]" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------- favoritos */

type FavoriteOption = {
  key: string;
  label: string;
  group: string;
  href: string;
  external: boolean;
  icon?: LucideIcon;
  /** Endereço de uma ferramenta: o logo vem do próprio sistema (VIOS, Responsum…). */
  logoUrl?: string;
  /** Logo guardado em /public (sistemas do escritório). */
  logoSrc?: string;
};

const SYSTEMS_GROUP = "Sistemas do escritório";
const SYSTEM_ICON: Record<OfficeSystem["icon"], LucideIcon> = {
  metas: Target,
  crm: Handshake,
  leads: UserPlus,
  ia: Bot,
  projetos: KanbanSquare,
};

function FavoriteGlyph({ option, size }: { option: FavoriteOption; size: number }) {
  if (option.logoSrc) {
    return (
      <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={option.logoSrc} alt="" className="size-[78%] object-contain" />
      </span>
    );
  }
  if (option.logoUrl) return <ToolLogo url={option.logoUrl} size={size} className="rounded-md" />;
  const Icon = option.icon ?? Star;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-md bg-[#e8f8f8] text-[#285f7a]" style={{ width: size, height: size }}>
      <Icon className="size-[18px]" aria-hidden />
    </span>
  );
}

function FavoritesDialog({
  options,
  selected,
  open,
  saving,
  error,
  onClose,
  onSave,
}: {
  options: FavoriteOption[];
  selected: string[];
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (keys: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);
  const groups = useMemo(() => {
    const byGroup = new Map<string, FavoriteOption[]>();
    for (const option of options) byGroup.set(option.group, [...(byGroup.get(option.group) ?? []), option]);
    return [...byGroup.entries()];
  }, [options]);
  const full = draft.length >= MAX_FAVORITES;
  const toggle = (key: string) =>
    setDraft((current) => (current.includes(key) ? current.filter((item) => item !== key) : full ? current : [...current, key]));

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[#e6eff1] px-6 py-4">
          <DialogTitle>Personalizar favoritos</DialogTitle>
          <DialogDescription>
            Escolha até {MAX_FAVORITES} atalhos para a sua tela inicial. {draft.length} de {MAX_FAVORITES} escolhidos.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-4">
          {groups.map(([group, items]) => (
            <fieldset key={group} className="mb-4 last:mb-0">
              <legend className="mb-1.5 text-xs font-semibold uppercase text-[#48466e]">{group}</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {items.map((option) => {
                  const checked = draft.includes(option.key);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      disabled={!checked && full}
                      onClick={() => toggle(option.key)}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-md border px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0] disabled:opacity-45",
                        checked ? "border-[#347796] bg-[#eef7f9]" : "border-[#dce9eb] bg-white hover:bg-[#f4fafb]"
                      )}
                    >
                      <FavoriteGlyph option={option} size={32} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#0d2a38]">{option.label}</span>
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded border",
                          checked ? "border-[#347796] bg-[#347796] text-white" : "border-[#b9cdd3] bg-white"
                        )}
                        aria-hidden
                      >
                        {checked && <Check className="size-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <DialogFooter className="items-center border-t border-[#e6eff1] px-6 py-3">
          {error && (
            <p role="alert" className="mr-auto text-sm text-destructive">
              {error}
            </p>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(draft)} disabled={saving}>
            {saving ? "Salvando..." : "Salvar favoritos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Grava os favoritos na conta; devolve a lista salva ou lança o erro do servidor. */
async function putFavorites(keys: string[]): Promise<string[]> {
  const response = await fetch("/api/inicio/favoritos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ favorites: keys }),
  });
  const body = (await response.json().catch(() => null)) as { favorites?: string[]; error?: string } | null;
  if (!response.ok || !body?.favorites) throw new Error(body?.error ?? "Não foi possível salvar os favoritos.");
  return body.favorites;
}

function Favorites({ fronts, data, className }: { fronts: VisibleNavFront[]; data: HomeData | null; className?: string }) {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const links = data?.links ?? null;
  const [editing, setEditing] = useState(false);
  /** O que a pessoa acabou de salvar nesta visita (vale sobre o que veio do servidor). */
  const [justSaved, setJustSaved] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saved = justSaved ?? data?.favorites ?? null;
  const neverCustomized = Boolean(data) && data?.favorites === null;

  // Quem personalizou na primeira versão (só no navegador) leva a escolha para a conta.
  useEffect(() => {
    if (!userId || !neverCustomized) return;
    const legacy = takeLegacyFavorites(userId);
    if (!legacy) return;
    let cancelled = false;
    putFavorites(legacy)
      .then((keys) => !cancelled && setJustSaved(keys))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, neverCustomized]);

  const save = async (keys: string[]) => {
    setSaving(true);
    setSaveError(null);
    try {
      setJustSaved(await putFavorites(keys));
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível salvar os favoritos.");
    } finally {
      setSaving(false);
    }
  };

  const options = useMemo<FavoriteOption[]>(
    () => [
      ...fronts.flatMap((front) =>
        front.features.map((feature) => ({
          key: moduleFavoriteKey(feature.id),
          label: feature.label,
          group: front.label,
          href: feature.href,
          external: false,
          icon: feature.icon,
        }))
      ),
      ...OFFICE_SYSTEMS.map((system) => ({
        key: systemFavoriteKey(system.id),
        label: system.title,
        group: SYSTEMS_GROUP,
        href: system.url,
        external: true,
        icon: SYSTEM_ICON[system.icon],
        logoSrc: system.logo,
      })),
      ...(links ?? []).map((link) => ({
        key: linkFavoriteKey(link.id),
        label: link.title,
        group: "Ferramentas da sua área",
        href: link.url,
        external: true,
        logoUrl: link.url,
      })),
    ],
    [fronts, links]
  );

  // Quem nunca personalizou começa com os primeiros módulos, as ferramentas da área e os sistemas do escritório.
  const keys = useMemo(
    () =>
      saved ??
      [
        ...options.filter((option) => !option.external).slice(0, 4),
        ...options.filter((option) => option.external && option.group !== SYSTEMS_GROUP).slice(0, 2),
        ...options.filter((option) => option.group === SYSTEMS_GROUP),
      ].map((option) => option.key),
    [saved, options]
  );
  const favorites = keys.flatMap((key) => options.find((option) => option.key === key) ?? []);
  const tile =
    "group flex min-h-14 items-center gap-3 rounded-lg border border-[#dce9eb] bg-white px-3 py-2.5 outline-none transition-colors hover:border-[#b9d9df] hover:bg-[#f4fafb] focus-visible:border-[#47cdd0]";

  return (
    <section className={cn(SURFACE, className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#fbf3e3] text-[#9c7434]">
            <Star className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-[#0d2a38]">Seus favoritos</h2>
            <p className="text-xs text-[#5a717b]">Atalhos que você escolhe para abrir mais rápido</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={!userId || !data}>
          <SlidersHorizontal className="size-4" aria-hidden />
          Personalizar
        </Button>
      </header>
      {favorites.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Nenhum favorito escolhido. Use Personalizar para montar os seus atalhos.</p>
      ) : (
        <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {favorites.map((option) => {
            const body = (
              <>
                <FavoriteGlyph option={option} size={36} />
                <span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-[#0d2a38]">{option.label}</span>
              </>
            );
            return (
              <li key={option.key}>
                {option.external ? (
                  <a href={option.href} target="_blank" rel="noreferrer" className={tile}>
                    {body}
                  </a>
                ) : (
                  <Link href={option.href} className={tile}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editing && userId && (
        <FavoritesDialog
          options={options}
          selected={favorites.map((option) => option.key)}
          open
          saving={saving}
          error={saveError}
          onClose={() => {
            setEditing(false);
            setSaveError(null);
          }}
          onSave={save}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ blocos */

function BlockSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-5 py-5" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="size-10 animate-pulse rounded-lg bg-[#eaf2f5]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-[#eaf2f5]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-[#eaf2f5]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Block({
  id,
  icon: Icon,
  title,
  hint,
  action,
  className,
  children,
}: {
  id?: string;
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn(SURFACE, "flex scroll-mt-24 flex-col", className)}>
      <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f8f8] text-[#285f7a]">
              <Icon className="size-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#0d2a38]">{title}</h2>
            {hint && <p className="text-xs text-[#5a717b]">{hint}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function InicioClient() {
  const { profile } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [modulesOpen, setModulesOpen] = useState<string | null>(null);
  const [birthdaysOpen, setBirthdaysOpen] = useState(false);
  const [artsOpen, setArtsOpen] = useState(false);
  const fronts = useMemo(() => buildNav(profile).filter((front) => !front.untitled), [profile]);
  const moduleCount = fronts.reduce((sum, front) => sum + front.features.length, 0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/inicio", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) setError(body?.error ?? "Não foi possível carregar a tela inicial.");
        else {
          setError(null);
          setData(body as HomeData);
        }
      })
      .catch(() => !cancelled && setError("Não foi possível carregar a tela inicial."));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const loading = !data && !error;
  const retry = () => {
    setError(null);
    setAttempt((value) => value + 1);
  };
  const failed = (
    <div className="px-5 py-6 text-sm">
      <p className="text-destructive">{error}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={retry}>
        Tentar de novo
      </Button>
    </div>
  );

  const publications = data?.pending.find((item) => item.kind === "vistagem") ?? null;
  const agendaCount = data ? [data.nextLeave, data.party, data.nextRecess].filter(Boolean).length : null;
  const hasParty = Boolean(data?.party);

  return (
    <div className="mx-auto max-w-[1360px] space-y-5">
      <Hero data={data} loading={loading} />

      <Favorites fronts={fronts} data={data} />

      {publications?.breakdown ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <BreakdownMeter item={publications} className="lg:col-span-6" />
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-6">
            <StatTile
              tall
              icon={ClipboardCheck}
              value={data ? data.pending.length : null}
              label={data?.pending.length === 1 ? "Pendência para você" : "Pendências para você"}
              tone="bg-[#e8f8f8] text-[#1f6f72]"
              href="#pendencias"
            />
            <StatTile
              tall
              icon={CalendarDays}
              value={agendaCount}
              label={agendaCount === 1 ? "Data na agenda" : "Datas na agenda"}
              tone="bg-[#eef1f8] text-[#48466e]"
              href="#agenda"
            />
            <StatTile
              tall
              icon={Layers}
              value={moduleCount}
              label={moduleCount === 1 ? "Módulo disponível" : "Módulos disponíveis"}
              tone="bg-[#eaf2f7] text-[#285f7a]"
              onClick={() => setModulesOpen("all")}
            />
          </div>
        </div>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={ClipboardCheck}
          value={data ? data.pending.length : null}
          label={data?.pending.length === 1 ? "Pendência para você" : "Pendências para você"}
          tone="bg-[#e8f8f8] text-[#1f6f72]"
          href="#pendencias"
        />
        <StatTile
          icon={CalendarDays}
          value={agendaCount}
          label={agendaCount === 1 ? "Data na agenda" : "Datas na agenda"}
          tone="bg-[#eef1f8] text-[#48466e]"
          href="#agenda"
        />
        {publications ? (
          <StatTile
            icon={Bell}
            value={publications.count ?? 0}
            label="Publicações na Vistagem"
            tone="bg-amber-50 text-amber-700"
            href={publications.href}
          />
        ) : (
          <StatTile
            icon={Cake}
            value={data ? data.birthdays.length : null}
            label="Aniversários em 30 dias"
            tone="bg-[#fbf3e3] text-[#9c7434]"
            onClick={() => setBirthdaysOpen(true)}
          />
        )}
        <StatTile
          icon={Layers}
          value={moduleCount}
          label={moduleCount === 1 ? "Módulo disponível" : "Módulos disponíveis"}
          tone="bg-[#eaf2f7] text-[#285f7a]"
          onClick={() => setModulesOpen("all")}
        />
      </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <Block
          id="pendencias"
          title="Para você hoje"
          hint="O que está esperando uma ação sua"
          className={hasParty ? "lg:col-span-7 xl:col-span-5" : "lg:col-span-7 xl:col-span-8"}
        >
          {data ? <PendingList pending={data.pending} today={data.today} /> : error ? failed : <BlockSkeleton />}
        </Block>
        {data && hasParty && (
          <div className="lg:col-span-5 xl:col-span-4">
            <PartyBanner data={data} />
          </div>
        )}
        <Block
          id="agenda"
          icon={CalendarDays}
          title="Sua agenda"
          className={hasParty ? "lg:col-span-12 xl:col-span-3" : "lg:col-span-5 xl:col-span-4"}
        >
          {data ? <Agenda data={data} /> : error ? null : <BlockSkeleton rows={2} />}
        </Block>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Block
          icon={LayoutGrid}
          title="Acesse por área"
          hint="Os módulos liberados para o seu acesso, por frente"
          className="lg:col-span-7 xl:col-span-8"
          action={
            <button type="button" onClick={() => setModulesOpen("all")} className={TEXT_LINK}>
              Ver todos os módulos
              <ArrowRight className="size-3.5" aria-hidden />
            </button>
          }
        >
          <Areas fronts={fronts} onOpen={setModulesOpen} />
        </Block>
        <Block
          icon={Cake}
          title="Próximos aniversários"
          className="lg:col-span-5 xl:col-span-4"
          action={
            <div className="flex shrink-0 items-center gap-3">
              {data?.canManageBirthdayArts && (
                <button type="button" onClick={() => setArtsOpen(true)} className={TEXT_LINK}>
                  <ImagePlus className="size-3.5" aria-hidden />
                  Artes
                </button>
              )}
              {data &&
                (data.birthdays.length > BIRTHDAYS_ON_SCREEN || data.workAnniversaries.length > WORK_ANNIVERSARIES_ON_SCREEN) && (
                  <button type="button" onClick={() => setBirthdaysOpen(true)} className={TEXT_LINK}>
                    Ver todos
                    <ArrowRight className="size-3.5" aria-hidden />
                  </button>
                )}
            </div>
          }
        >
          {data ? (
            <Team data={data} allOpen={birthdaysOpen} onAllOpenChange={setBirthdaysOpen} />
          ) : error ? null : (
            <BlockSkeleton />
          )}
        </Block>
      </div>

      <Block icon={BookOpen} title="Manuais e documentos" hint="O que vale para todo o escritório">
        <OfficeDocuments data={data} />
      </Block>

      <ModulesDialog fronts={fronts} open={modulesOpen} onClose={() => setModulesOpen(null)} />
      {data?.canManageBirthdayArts && artsOpen && (
        <BirthdayArtsDialog
          open
          initialMonth={data.today.slice(0, 7)}
          onClose={() => setArtsOpen(false)}
          onChanged={() => setAttempt((value) => value + 1)}
        />
      )}
    </div>
  );
}
