"use client";

/**
 * Peças visuais das páginas da festa de 10 anos (confirmação da equipe e convite dos
 * clientes), no padrão do comunicado: papel creme, dourado, Bebas Neue no título.
 */

import type { ReactNode } from "react";
import { CalendarDays, Check, Clock3, MapPin, Navigation, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const GOLD_TEXT = "text-[#9c7434]";
export const EYEBROW = "text-[12px] font-semibold uppercase tracking-[0.32em] text-[#9c7434]";
export const GOLD_BUTTON =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#d9b877] to-[#bf9650] px-7 text-[15px] font-semibold tracking-wide text-white shadow-[0_10px_24px_-12px_rgba(120,86,30,0.75)] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c7434] disabled:cursor-not-allowed disabled:opacity-50";
export const CALENDAR_BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#cfb27a] bg-[#fdfbf7] px-3 text-[13px] font-semibold text-[#7a5a26] transition hover:bg-[#f6eedf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c7434]";
export const OUTLINE_BUTTON =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#cfb27a] bg-[#fdfbf7] px-5 text-sm font-semibold text-[#7a5a26] transition hover:bg-[#f6eedf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c7434]";

const VENUE_PHOTOS = [
  { src: "/festa-10-anos/fazenda-1.jpg", alt: "Área coberta da Fazenda Santa Margarida com luminárias de palha e jardim" },
  { src: "/festa-10-anos/fazenda-2.jpg", alt: "Salão envidraçado com mesas postas e plantas" },
  { src: "/festa-10-anos/fazenda-3.jpg", alt: "Piscina iluminada ao entardecer, cercada de palmeiras" },
];

/** Endereço conferido no Google Maps em 06/11/2026. */
const VENUE_ADDRESS = "R. Rubens Gomes Balsas, 311 · Joaquim Egídio, Campinas/SP";
const VENUE_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Fazenda%20Santa%20Margarida%2C%20Rua%20Rubens%20Gomes%20Balsas%2C%20311%2C%20Joaquim%20Eg%C3%ADdio%2C%20Campinas%20-%20SP";

export async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error ?? "Não foi possível concluir. Tente de novo.");
  return data as T;
}

/** "06/11 às 17h34", no horário de Brasília. */
export function formatRespondedAt(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const [hour, minute] = date
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    .split(":");
  return `${day} às ${hour}h${minute}`;
}

/** Fio dourado com o ornamento do comunicado, simplificado. */
export function Ornament({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-[#cfab68]", className)} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#cfab68]" />
      <svg width="46" height="14" viewBox="0 0 46 14" fill="none">
        <circle cx="4" cy="7" r="1.6" fill="currentColor" />
        <path d="M10 7c3-4.5 7-4.5 9 0-2 4.5-6 4.5-9 0Z" stroke="currentColor" strokeWidth="1.1" />
        <path d="M23 2.5 27.5 7 23 11.5 18.5 7 23 2.5Z" fill="currentColor" />
        <path d="M36 7c-3-4.5-7-4.5-9 0 2 4.5 6 4.5 9 0Z" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="42" cy="7" r="1.6" fill="currentColor" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#cfab68]" />
    </div>
  );
}

/** Moldura da página: logo dos 10 anos, título, texto de abertura, data, hora e a Fazenda com o mapa. */
export function FestaShell({
  title,
  intro,
  footer,
  children,
}: {
  title: string;
  intro: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#fbf8f2] bg-[radial-gradient(ellipse_at_top_left,#f3e7d3_0%,transparent_45%),radial-gradient(ellipse_at_bottom_right,#f3e7d3_0%,transparent_40%)] font-[family-name:var(--font-festa-sans)] text-[#1f2328]">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="relative rounded-[32px] px-1 pb-8 pt-8 sm:px-8 sm:pt-10">
          {/* Moldura fina dourada, como a do comunicado. */}
          <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-[#dcc59a]" aria-hidden />
          <div className="relative">
            <header className="flex flex-col items-center px-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dress-code/10-anos/logo-10-anos.png"
                alt="Bismarchi | Pires Sociedade de Advogados — 10 anos"
                width={640}
                height={527}
                className="h-auto w-36 sm:w-44"
              />
              <p className={cn(EYEBROW, "mt-8")}>Celebração · 10 anos</p>
              <h1 className="mt-3 font-[family-name:var(--font-festa-display)] text-[clamp(3.4rem,13vw,5.6rem)] leading-[0.88] text-[#cfab68]">
                {title}
              </h1>
              <Ornament className="mt-6 w-full max-w-md" />
              <div className="mt-6 max-w-md text-[15px] leading-7 text-[#3a3f45]">{intro}</div>
            </header>

            <div className="mx-auto mt-7 flex max-w-md flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-full border border-[#dcc59a] bg-[#fdfbf7]/80 px-5 py-3 text-[15px] font-medium text-[#0d1e2e]">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-[18px] text-[#c49a52]" aria-hidden />
                17.12.2026
              </span>
              <span className="hidden h-5 w-px bg-[#dcc59a] sm:block" aria-hidden />
              <span className="inline-flex items-center gap-2">
                <Clock3 className="size-[18px] text-[#c49a52]" aria-hidden />
                18h00
              </span>
            </div>

            <section aria-label="Local da festa" className="mx-auto mt-5 max-w-md rounded-[28px] bg-[#f1e6d3]/70 px-4 pb-5 pt-4 text-center">
              <p className="flex items-center justify-center gap-2 text-[16px] font-semibold text-[#0d1e2e]">
                <MapPin className="size-[18px] text-[#c49a52]" aria-hidden />
                Fazenda Santa Margarida
              </p>
              <p className="mt-1 text-[13px] text-[#5c6168]">{VENUE_ADDRESS}</p>
              <div className="mt-4 grid grid-cols-3 gap-3 sm:gap-4">
                {VENUE_PHOTOS.map((photo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo.src}
                    src={photo.src}
                    alt={photo.alt}
                    width={212}
                    height={212}
                    className="aspect-square w-full rounded-full object-cover ring-1 ring-[#cfab68] ring-offset-2 ring-offset-[#f1e6d3]"
                  />
                ))}
              </div>
              <a
                href={VENUE_MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#cfb27a] bg-[#fdfbf7] px-4 py-2 text-[13px] font-semibold text-[#7a5a26] transition hover:bg-[#f6eedf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c7434]"
              >
                <Navigation className="size-4" aria-hidden />
                Ver no Google Maps
              </a>
            </section>

            <div className="mt-8 px-1 sm:px-0">{children}</div>
          </div>
        </div>
        {footer && <p className="mt-6 text-center text-xs text-[#7b7f85]">{footer}</p>}
      </div>
    </main>
  );
}

export function FestaCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[28px] border border-[#dcc59a] bg-[#fdfbf7] px-4 py-6 shadow-[0_18px_40px_-30px_rgba(120,86,30,0.45)] sm:px-7 sm:py-8", className)}>
      {children}
    </div>
  );
}

export function ChoiceCard({
  name,
  checked,
  onChange,
  icon: Icon,
  title,
  hint,
  compact = false,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  icon: LucideIcon;
  title: string;
  hint: string;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-start gap-3 rounded-2xl border bg-white/70 text-left transition",
        compact ? "p-3.5" : "p-4",
        checked
          ? "border-[#c49a52] bg-[#fbf3e3] shadow-[0_0_0_1px_#c49a52]"
          : "border-[#e6d8bc] hover:border-[#cfb27a] hover:bg-[#fdf8ee]",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#9c7434]"
      )}
    >
      <input type="radio" name={name} value={title} checked={checked} onChange={onChange} className="sr-only" />
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full transition",
          compact ? "size-9" : "size-11",
          checked ? "bg-[#c49a52] text-white" : "bg-[#f1e6d3] text-[#9c7434]"
        )}
        aria-hidden
      >
        <Icon className={compact ? "size-[18px]" : "size-5"} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[#0d1e2e]">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-5 text-[#5c6168]">{hint}</span>
      </span>
      {checked && (
        <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-[#c49a52] text-white" aria-hidden>
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
    </label>
  );
}
