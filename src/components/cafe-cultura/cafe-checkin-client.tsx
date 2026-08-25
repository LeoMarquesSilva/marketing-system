"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, Clock3, Coffee, LoaderCircle, MapPin, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { CafeCurrentView } from "@/lib/cafe-cultura/types";

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

function ExperienceShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f4efe5] px-4 py-5 text-[#173d4d] sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:radial-gradient(circle_at_20%_10%,transparent_0_31px,#9d6f3e_32px_33px,transparent_34px),radial-gradient(circle_at_80%_82%,transparent_0_54px,#2f7186_55px_56px,transparent_57px)] [background-size:180px_180px,240px_240px]" />
      <div className="pointer-events-none absolute -left-28 top-16 size-72 rounded-full bg-[#d4a76b]/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 size-80 rounded-full bg-[#5ca8b8]/20 blur-3xl" />
      <section className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-[28px] border border-white/70 bg-[#fffdf8]/95 shadow-[0_34px_90px_-48px_rgba(23,61,77,0.7)]">
        <div className="h-1.5 bg-[linear-gradient(90deg,#2f7186_0_64%,#c18a4d_64%)]" />
        <header className="flex items-center justify-between border-b border-[#173d4d]/10 px-5 py-4 sm:px-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/LOGO%20HORIZONTAL%20AZUL.png" alt="Bismarchi | Pires" className="h-8 w-auto object-contain" />
          <span className="inline-flex items-center gap-2 rounded-full border border-[#2f7186]/15 bg-[#e9f3f3] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2f7186]">
            <span className="size-1.5 rounded-full bg-[#3d9a8d] shadow-[0_0_0_4px_rgba(61,154,141,0.12)]" />
            Presença
          </span>
        </header>
        {children}
      </section>
    </main>
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
  const checkedIn = Boolean(current.collaborator.checkinAt);
  const open = current.windowState === "open";
  return (
    <ExperienceShell>
      <div className="px-5 pb-6 pt-7 sm:px-7 sm:pb-8">
        <div className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#173d4d] text-[#f6d39e] shadow-[0_12px_26px_-14px_rgba(23,61,77,0.8)]">
            <Coffee className="size-7" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6a36]">Encontro mensal</p>
            <h1 className="mt-1 font-serif text-[26px] font-semibold leading-tight tracking-[-0.025em] text-[#173d4d]">
              Café com Cultura
            </h1>
          </div>
        </div>

        <div className="mt-6 grid gap-2.5 rounded-2xl border border-[#173d4d]/10 bg-white/65 p-4 text-sm">
          <p className="flex items-center gap-3 capitalize">
            <CalendarDays className="size-4 text-[#9a6a36]" />
            <span className="font-medium">{formatEventDate(current.event.eventDate)}</span>
          </p>
          <p className="flex items-center gap-3">
            <Clock3 className="size-4 text-[#9a6a36]" />
            <span>Check-in das 09h às 12h</span>
          </p>
          {current.event.location && (
            <p className="flex items-center gap-3">
              <MapPin className="size-4 text-[#9a6a36]" />
              <span>{current.event.location}</span>
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Avatar className="size-11 border-2 border-white shadow-sm">
            <AvatarImage src={current.collaborator.avatarUrl || undefined} alt={current.collaborator.name} />
            <AvatarFallback className="bg-[#dcebed] text-sm font-semibold text-[#245c70]">
              {initials(current.collaborator.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold tracking-tight">Olá, {firstName(current.collaborator.name)}</p>
            <p className="text-xs text-[#54717c]">Você está entrando com sua conta do ORQESTRAI.</p>
          </div>
        </div>

        {checkedIn ? (
          <div className="mt-6 rounded-2xl border border-[#62a397]/30 bg-[#eaf5ef] p-5 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#2f7d70] text-white shadow-[0_9px_22px_-10px_rgba(47,125,112,0.9)]">
              <Check className="size-6" strokeWidth={2.4} />
            </span>
            <h2 className="mt-3 text-lg font-semibold text-[#205e54]">Presença confirmada</h2>
            <p className="mt-1 text-sm text-[#477068]">
              Seu check-in foi registrado às {formatTime(current.collaborator.checkinAt!)}.
            </p>
            <p className="mt-3 font-serif text-base italic text-[#476861]">Que bom ter você por aqui.</p>
          </div>
        ) : open ? (
          <div className="mt-6">
            {current.collaborator.expectationStatus === "excused_absence" && (
              <p className="mb-3 rounded-xl border border-[#c18a4d]/25 bg-[#fbf1df] px-3 py-2 text-xs leading-5 text-[#77532f]">
                Sua justificativa consta no RESPONSUM. Como você veio ao encontro, confirme abaixo sua presença real.
              </p>
            )}
            <Button
              type="button"
              onClick={onCheckin}
              disabled={busy}
              className="min-h-14 w-full rounded-2xl bg-[#173d4d] text-base font-semibold text-white shadow-[0_15px_28px_-17px_rgba(23,61,77,0.9)] hover:bg-[#245568]"
            >
              {busy ? <><LoaderCircle className="size-5 animate-spin" /> Registrando…</> : <><Check className="size-5" /> Confirmar minha presença</>}
            </Button>
            <p className="mt-3 text-center text-[11px] leading-4 text-[#6c828a]">
              Ao confirmar, registraremos somente seu usuário e o horário de chegada.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-[#c18a4d]/25 bg-[#fbf1df] p-5 text-center">
            <Clock3 className="mx-auto size-7 text-[#9a6a36]" />
            <h2 className="mt-2 text-base font-semibold text-[#6f4d2c]">
              {current.windowState === "before" ? "O check-in abre às 09h" : "Check-in encerrado"}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#806746]">
              {current.windowState === "before"
                ? "Volte a esta página no horário do encontro."
                : "A janela desta edição terminou às 12h."}
            </p>
          </div>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700">{error}</p>}
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
        <div className="px-6 py-16 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#173d4d] text-[#f6d39e]">
            <Coffee className="size-8 animate-pulse" />
          </span>
          <p className="mt-5 font-serif text-xl font-semibold">Preparando seu lugar…</p>
          <p className="mt-2 text-sm text-[#647c85]">Identificando a edição e sua conta.</p>
        </div>
      </ExperienceShell>
    );
  }

  if (!current) {
    return (
      <ExperienceShell>
        <div className="px-6 py-14 text-center">
          <Coffee className="mx-auto size-9 text-[#9a6a36]" />
          <h1 className="mt-4 font-serif text-2xl font-semibold">Café com Cultura</h1>
          <p className="mt-2 text-sm leading-6 text-[#647c85]">{error || "A edição deste mês ainda não está disponível."}</p>
          <Button type="button" variant="outline" onClick={load} className="mt-5 min-h-11 rounded-xl">
            <RefreshCw className="size-4" /> Tentar novamente
          </Button>
        </div>
      </ExperienceShell>
    );
  }

  return <CafeCheckinView current={current} busy={busy} error={error} onCheckin={checkin} />;
}
