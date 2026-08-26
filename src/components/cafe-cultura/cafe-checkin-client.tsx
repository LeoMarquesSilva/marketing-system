"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  Check,
  Clock3,
  Coffee,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { CafeCurrentView } from "@/lib/cafe-cultura/types";

const BRAND_LOGO = "/cafe-cultura/cafe-com-cultura-logo.png";

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${value}T12:00:00-03:00`));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function BrandPanel() {
  return (
    <div className="relative flex min-h-[248px] flex-col justify-between overflow-hidden bg-[#102637] px-6 pb-6 pt-7 sm:min-h-[290px] sm:px-9 sm:pb-8 lg:min-h-[610px] lg:px-11 lg:py-11">
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border border-[#e1bb70]/20" />
      <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full border border-[#e1bb70]/15" />
      <div className="pointer-events-none absolute bottom-[-88px] left-[-70px] size-64 rounded-full bg-[#d6a950]/12 blur-2xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:radial-gradient(#fff_0.7px,transparent_0.7px)] [background-size:6px_6px]" />

      <div className="relative flex items-center justify-between text-[#f4eadc]/60">
        <span className="text-[9px] font-semibold uppercase tracking-[0.26em]">Encontro mensal</span>
        <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em]">
          <Sparkles className="size-3 text-[#e1bb70]" /> Pessoas &amp; Cultura
        </span>
      </div>

      <div className="relative mx-auto my-5 w-full max-w-[330px] lg:my-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND_LOGO}
          alt="Café com Cultura"
          className="h-auto w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.16)]"
        />
      </div>

      <div className="relative border-l border-[#e1bb70]/60 pl-4">
        <p className="max-w-[310px] text-[17px] font-medium leading-snug tracking-[-0.015em] text-[#f7f0e8] sm:text-lg lg:text-xl">
          Uma manhã para celebrar, aprender e se conectar.
        </p>
        <p className="mt-2 text-[9px] font-medium uppercase tracking-[0.22em] text-[#d6b471]">
          Bismarchi | Pires
        </p>
      </div>
    </div>
  );
}

function ExperienceShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#e9e0d7] px-3 py-3 text-[#102637] sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-8 lg:px-10">
      <div className="pointer-events-none absolute -left-40 -top-40 size-[430px] rounded-full bg-[#d9ae61]/25 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-44 -right-36 size-[480px] rounded-full bg-[#f8f3ec]/90 blur-[80px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:radial-gradient(#102637_0.7px,transparent_0.7px)] [background-size:5px_5px]" />

      <section className="relative mx-auto w-full max-w-[980px] overflow-hidden rounded-[26px] border border-white/65 bg-[#f8f3ed] shadow-[0_35px_100px_-48px_rgba(16,38,55,0.72)] sm:rounded-[34px]">
        <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
          <BrandPanel />
          <div className="relative min-w-0 bg-[#f8f3ed]">{children}</div>
        </div>
      </section>
    </main>
  );
}

function EventDetails({ current }: { current: CafeCurrentView }) {
  return (
    <div data-testid="cafe-event-details" className="mt-5 grid gap-2.5 sm:grid-cols-2">
      <div className="flex min-h-[70px] items-center gap-3 rounded-2xl border border-[#102637]/10 bg-white/55 px-3.5 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#102637] text-[#e1bb70]">
          <CalendarDays className="size-[18px]" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#a27a38]">Data</p>
          <p className="mt-0.5 text-[13px] font-semibold capitalize leading-4 text-[#102637]">
            {formatEventDate(current.event.eventDate)}
          </p>
        </div>
      </div>

      <div className="flex min-h-[70px] items-center gap-3 rounded-2xl border border-[#102637]/10 bg-white/55 px-3.5 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#102637] text-[#e1bb70]">
          <Clock3 className="size-[18px]" strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#a27a38]">Horário</p>
          <p className="mt-0.5 text-[13px] font-semibold text-[#102637]">Das 09h às 12h</p>
        </div>
      </div>

      {current.event.location && (
        <div className="flex min-h-[58px] items-center gap-3 rounded-2xl border border-[#102637]/10 bg-white/55 px-3.5 py-3 sm:col-span-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#ead6ad]/55 text-[#8d672b]">
            <MapPin className="size-[18px]" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#a27a38]">Local</p>
            <p className="mt-0.5 truncate text-[13px] font-semibold text-[#102637]">{current.event.location}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CollaboratorGreeting({ current }: { current: CafeCurrentView }) {
  return (
    <div className="mt-5 flex items-center gap-3.5 border-y border-[#102637]/10 py-4">
      <Avatar className="size-12 border-2 border-[#f8f3ed] shadow-[0_0_0_1px_rgba(16,38,55,0.12)]">
        <AvatarImage src={current.collaborator.avatarUrl || undefined} alt={current.collaborator.name} />
        <AvatarFallback className="bg-[#102637] text-sm font-semibold text-[#e6c581]">
          {initials(current.collaborator.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-[19px] font-semibold tracking-[-0.025em] text-[#102637]">
          Olá, {firstName(current.collaborator.name)}
        </p>
        <p className="mt-0.5 text-[11px] leading-4 text-[#65747e]">Identificação confirmada pelo ORQESTRAI</p>
      </div>
      <span className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full bg-[#dfece6] text-[#26705d]">
        <Check className="size-3.5" strokeWidth={2.5} />
      </span>
    </div>
  );
}

export function CafeCheckinView({
  current,
  busy,
  error,
  onCheckin,
}: {
  current: CafeCurrentView;
  busy: boolean;
  error: string;
  onCheckin: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const checkedIn = Boolean(current.collaborator.checkinAt);
  const open = current.windowState === "open";

  return (
    <ExperienceShell>
      <div className="flex min-h-full flex-col px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-7 lg:px-10 lg:py-9">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#ae8138]">Sua presença importa</p>
              <h1 className="mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.035em] text-[#102637] sm:text-[28px]">
                Confirme sua chegada
              </h1>
            </div>
            <span className="hidden rounded-full border border-[#102637]/10 bg-white/50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#536773] sm:block">
              Edição mensal
            </span>
          </div>

          <EventDetails current={current} />
          <CollaboratorGreeting current={current} />
        </motion.div>

        <AnimatePresence mode="wait" initial={false}>
          {checkedIn ? (
            <motion.div
              key="confirmed"
              role="status"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 overflow-hidden rounded-[22px] border border-[#4c927e]/25 bg-[#e4f0e9] p-5 text-center"
            >
              <motion.span
                initial={reduceMotion ? false : { scale: 0.6, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.08 }}
                className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#26705d] text-white shadow-[0_12px_25px_-12px_rgba(38,112,93,0.85)]"
              >
                <Check className="size-6" strokeWidth={2.6} />
              </motion.span>
              <h2 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-[#1e5d4d]">Presença confirmada</h2>
              <p className="mt-1 text-sm text-[#4c7067]">
                Check-in registrado às <strong>{formatTime(current.collaborator.checkinAt!)}</strong>.
              </p>
              <p className="mt-3 text-sm italic text-[#55736b]">Que bom compartilhar esta manhã com você.</p>
            </motion.div>
          ) : open ? (
            <motion.div
              key="open"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.35, delay: 0.08 }}
              className="mt-5"
            >
              {current.collaborator.expectationStatus === "excused_absence" && (
                <p className="mb-3 rounded-xl border border-[#c59a51]/25 bg-[#f5e8cf] px-3 py-2 text-xs leading-5 text-[#73562b]">
                  Sua justificativa consta no RESPONSUM. Como você veio ao encontro, confirme abaixo sua presença real.
                </p>
              )}
              <motion.button
                type="button"
                onClick={onCheckin}
                disabled={busy}
                whileHover={reduceMotion || busy ? undefined : { y: -2 }}
                whileTap={reduceMotion || busy ? undefined : { scale: 0.985 }}
                className="group flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-[linear-gradient(135deg,#d7aa59,#e8c77f)] px-5 text-[15px] font-bold text-[#102637] shadow-[0_16px_30px_-17px_rgba(153,105,30,0.8)] transition-[filter,box-shadow] hover:brightness-[1.035] hover:shadow-[0_18px_35px_-16px_rgba(153,105,30,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102637] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
              >
                {busy ? (
                  <>
                    <LoaderCircle className="size-5 animate-spin" /> Registrando sua presença…
                  </>
                ) : (
                  <>
                    <span className="flex size-7 items-center justify-center rounded-full bg-[#102637] text-[#e8c77f] transition-transform group-hover:scale-105">
                      <Check className="size-4" strokeWidth={2.5} />
                    </span>
                    Confirmar minha presença
                  </>
                )}
              </motion.button>
              <p className="mt-3 text-center text-[10px] leading-4 text-[#758088]">
                Registraremos somente seu usuário e o horário de chegada.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="unavailable"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-[22px] border border-[#c59a51]/25 bg-[#f4e7cf] p-5 text-center"
            >
              <Clock3 className="mx-auto size-7 text-[#9b712f]" />
              <h2 className="mt-2 text-base font-semibold text-[#674c27]">
                {current.windowState === "before" ? "O check-in abre às 09h" : "Check-in encerrado"}
              </h2>
              <p className="mt-1 text-sm leading-5 text-[#7a6647]">
                {current.windowState === "before"
                  ? "Volte a esta página no horário do encontro. Seu lugar já está esperando por você."
                  : "A janela desta edição terminou às 12h."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </ExperienceShell>
  );
}

export function CafeCheckinClient() {
  const [current, setCurrent] = useState<CafeCurrentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cafe-com-cultura/current", { cache: "no-store", credentials: "include" });
      if (response.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar o encontro.");
      setCurrent(body.current);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o encontro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function checkin() {
    setBusy(true);
    setError("");
    try {
      const source = new URLSearchParams(window.location.search).get("source") === "qr" ? "qr" : "nfc";
      const response = await fetch("/api/cafe-com-cultura/check-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível registrar sua presença.");
      setCurrent(body.current);
    } catch (checkinError) {
      setError(checkinError instanceof Error ? checkinError.message : "Não foi possível registrar sua presença.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <ExperienceShell>
        <div className="flex min-h-[330px] flex-col items-center justify-center px-6 py-14 text-center lg:min-h-[610px]">
          <span className="relative flex size-16 items-center justify-center rounded-2xl bg-[#102637] text-[#e4bd73] shadow-[0_14px_30px_-15px_rgba(16,38,55,0.7)]">
            <Coffee className="size-7 animate-pulse" strokeWidth={1.7} />
            <span className="absolute -right-1 -top-1 size-3 animate-ping rounded-full bg-[#d7aa59]/60" />
          </span>
          <p className="mt-5 text-xl font-semibold tracking-[-0.025em]">Preparando seu lugar…</p>
          <p className="mt-2 max-w-[250px] text-sm leading-5 text-[#687780]">Identificando a edição e conectando sua conta.</p>
        </div>
      </ExperienceShell>
    );
  }

  if (!current) {
    return (
      <ExperienceShell>
        <div className="flex min-h-[330px] flex-col items-center justify-center px-6 py-14 text-center lg:min-h-[610px]">
          <Coffee className="size-9 text-[#a77c35]" strokeWidth={1.6} />
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">Encontro indisponível</h1>
          <p className="mt-2 max-w-[320px] text-sm leading-6 text-[#687780]">
            {error || "A edição deste mês ainda não está disponível."}
          </p>
          <Button type="button" variant="outline" onClick={load} className="mt-5 min-h-11 rounded-xl border-[#102637]/15 bg-white/40">
            <RefreshCw className="size-4" /> Tentar novamente
          </Button>
        </div>
      </ExperienceShell>
    );
  }

  return <CafeCheckinView current={current} busy={busy} error={error} onCheckin={checkin} />;
}
