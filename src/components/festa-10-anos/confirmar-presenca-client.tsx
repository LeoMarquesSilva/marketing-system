"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  Car,
  Check,
  Clock3,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  PartyPopper,
  Shirt,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RSVP_TRANSPORT_LABEL,
  formatRsvpDeadline,
  usesOutbound,
  usesReturn,
  type RsvpTransport,
  type RsvpView,
} from "@/lib/event-rsvp";
import { FESTA_ICS_PATH, googleCalendarUrl, outlookCalendarUrl } from "@/lib/festa-10-anos-agenda";

const API = "/api/festa-10-anos";

const GOLD_TEXT = "text-[#9c7434]";
const EYEBROW = "text-[12px] font-semibold uppercase tracking-[0.32em] text-[#9c7434]";
const GOLD_BUTTON =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#d9b877] to-[#bf9650] px-7 text-[15px] font-semibold tracking-wide text-white shadow-[0_10px_24px_-12px_rgba(120,86,30,0.75)] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c7434] disabled:cursor-not-allowed disabled:opacity-50";
const CALENDAR_BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#cfb27a] bg-[#fdfbf7] px-3 text-[13px] font-semibold text-[#7a5a26] transition hover:bg-[#f6eedf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c7434]";
const OUTLINE_BUTTON =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#cfb27a] bg-[#fdfbf7] px-5 text-sm font-semibold text-[#7a5a26] transition hover:bg-[#f6eedf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c7434]";

const VENUE_PHOTOS = [
  { src: "/festa-10-anos/fazenda-1.jpg", alt: "Área coberta da Fazenda Santa Margarida com luminárias de palha e jardim" },
  { src: "/festa-10-anos/fazenda-2.jpg", alt: "Salão envidraçado com mesas postas e plantas" },
  { src: "/festa-10-anos/fazenda-3.jpg", alt: "Piscina iluminada ao entardecer, cercada de palmeiras" },
];

type TransportOption = { value: RsvpTransport; icon: LucideIcon; title: string; hint: string };

const TRANSPORT_OPTIONS: TransportOption[] = [
  { value: "ida_volta", icon: Bus, title: "Ida e volta", hint: "Vou e volto de micro-ônibus" },
  { value: "so_ida", icon: ArrowRight, title: "Só ida", hint: "Volto por conta própria" },
  { value: "so_volta", icon: ArrowLeft, title: "Só volta", hint: "Vou por conta própria" },
  { value: "nao", icon: Car, title: "Não vou usar", hint: "Vou e volto por conta própria" },
];

/** Endereço conferido no Google Maps em 06/11/2026. */
const VENUE_ADDRESS = "R. Rubens Gomes Balsas, 311 · Joaquim Egídio, Campinas/SP";
const VENUE_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Fazenda%20Santa%20Margarida%2C%20Rua%20Rubens%20Gomes%20Balsas%2C%20311%2C%20Joaquim%20Eg%C3%ADdio%2C%20Campinas%20-%20SP";

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error ?? "Não foi possível concluir. Tente de novo.");
  return data as T;
}

function formatRespondedAt(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const [hour, minute] = date
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    .split(":");
  return `${day} às ${hour}h${minute}`;
}

function transportSentence(transport: RsvpTransport | null): string {
  if (transport === "ida_volta") return "Você vai e volta com a gente, saindo do escritório.";
  if (transport === "so_ida") return "Você vai com a gente, saindo do escritório, e volta por conta própria.";
  if (transport === "so_volta") return "Você vai por conta própria e volta com a gente ao final da festa.";
  return "Você vai e volta por conta própria.";
}

/** Fio dourado com o ornamento do comunicado, simplificado. */
function Ornament({ className }: { className?: string }) {
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

function Shell({ firstName, children }: { firstName?: string; children: ReactNode }) {
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
                Confirme sua presença
              </h1>
              <Ornament className="mt-6 w-full max-w-md" />
              <p className="mt-6 max-w-md text-[15px] leading-7 text-[#3a3f45]">
                {firstName ? <strong className="font-semibold text-[#0d1e2e]">Olá, {firstName}! </strong> : null}
                Nossa festa de 10 anos está chegando, e queremos celebrar esse marco ao lado de todos que fazem parte da
                nossa história.
              </p>
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
        <p className="mt-6 text-center text-xs text-[#7b7f85]">
          <Link href="/" className="underline-offset-4 hover:underline">
            Ir para o ORQESTRAI
          </Link>
        </p>
      </div>
    </main>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[28px] border border-[#dcc59a] bg-[#fdfbf7] px-4 py-6 shadow-[0_18px_40px_-30px_rgba(120,86,30,0.45)] sm:px-7 sm:py-8", className)}>
      {children}
    </div>
  );
}

function ChoiceCard({
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

function DietaryNote({ dietary }: { dietary: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-[#f6efe2] px-4 py-3 text-[13px] leading-5 text-[#3a3f45]">
      <UtensilsCrossed className="mt-0.5 size-4 shrink-0 text-[#9c7434]" aria-hidden />
      <p>
        {!dietary ? (
          <>Tem alguma restrição alimentar? </>
        ) : dietary === "Nenhuma restrição" ? (
          <>Pela sua ficha cadastral, você não tem restrição alimentar. Algo mudou? </>
        ) : (
          <>
            Restrição alimentar na sua ficha cadastral: <strong className="font-semibold text-[#0d1e2e]">{dietary}</strong>.
            Algo mudou?{" "}
          </>
        )}
        <Link href="/minha-ficha" className="font-semibold text-[#7a5a26] underline underline-offset-2">
          {dietary ? "Atualize a ficha" : "Informe na sua ficha cadastral"}
        </Link>
        .
      </p>
    </div>
  );
}

function Summary({
  view,
  preview,
  onEdit,
}: {
  view: Pick<RsvpView, "attending" | "transport" | "respondedAt" | "open" | "closesAt" | "dietary">;
  preview: boolean;
  onEdit: () => void;
}) {
  const going = view.attending === true;
  const usesBus = usesOutbound(view.transport) || usesReturn(view.transport);
  return (
    <Card className="text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-b from-[#d9b877] to-[#bf9650] text-white shadow-[0_10px_24px_-12px_rgba(120,86,30,0.75)]">
        {going ? <PartyPopper className="size-7" aria-hidden /> : <Check className="size-7" aria-hidden />}
      </span>
      <h2 className="mt-4 font-[family-name:var(--font-festa-display)] text-[2.6rem] leading-none text-[#cfab68]">
        {going ? "Presença confirmada!" : "Resposta registrada"}
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-[#3a3f45]">
        {going
          ? "Nos vemos no dia 17 de dezembro, às 18h, na Fazenda Santa Margarida."
          : "Obrigado por avisar! Vamos sentir sua falta nessa comemoração."}
      </p>

      {going && (
        <div className="mx-auto mt-5 max-w-sm space-y-3 text-left">
          <div className="flex items-start gap-3 rounded-2xl border border-[#e6d8bc] bg-white/70 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1e6d3] text-[#9c7434]" aria-hidden>
              {usesBus ? <Bus className="size-[18px]" /> : <Car className="size-[18px]" />}
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-[#0d1e2e]">
                {usesBus && view.transport ? `Micro-ônibus: ${RSVP_TRANSPORT_LABEL[view.transport].toLowerCase()}` : "Sem micro-ônibus"}
              </span>
              <span className="mt-0.5 block text-[13px] leading-5 text-[#5c6168]">{transportSentence(view.transport)}</span>
            </span>
          </div>
          {!usesBus && (
            <p className="rounded-2xl bg-[#0d1e2e] px-4 py-3 text-center text-[13px] font-semibold leading-5 text-[#f3e7d3]">
              Se beber, não dirija!
              {view.open ? " Se quiser usar o micro-ônibus, é só alterar a resposta aqui embaixo." : ""}
            </p>
          )}
          <div className="rounded-2xl border border-[#e6d8bc] bg-white/70 px-4 py-3">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[#0d1e2e]">
              <CalendarPlus className="size-[18px] text-[#9c7434]" aria-hidden />
              Salve na sua agenda
            </p>
            <div className="mt-3 grid gap-2">
              <a href={googleCalendarUrl(view.transport)} target="_blank" rel="noreferrer" className={CALENDAR_BUTTON}>
                Google Agenda
                <ExternalLink className="size-3.5 opacity-70" aria-hidden />
              </a>
              <a href={outlookCalendarUrl(view.transport)} target="_blank" rel="noreferrer" className={CALENDAR_BUTTON}>
                Outlook (e-mail do escritório)
                <ExternalLink className="size-3.5 opacity-70" aria-hidden />
              </a>
              <a href={FESTA_ICS_PATH} download="festa-10-anos.ics" className={CALENDAR_BUTTON}>
                iPhone, Android e outras agendas
                <Download className="size-3.5 opacity-70" aria-hidden />
              </a>
            </div>
          </div>
          <Link
            href="/dress-code"
            className="flex items-center gap-3 rounded-2xl border border-[#e6d8bc] bg-white/70 px-4 py-3 transition hover:border-[#cfb27a] hover:bg-[#fdf8ee]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1e6d3] text-[#9c7434]" aria-hidden>
              <Shirt className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-[#0d1e2e]">Dress code: esporte fino</span>
              <span className="block text-[13px] text-[#5c6168]">Veja as referências de looks em azul e areia</span>
            </span>
            <ArrowRight className="size-4 text-[#9c7434]" aria-hidden />
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {view.open ? (
          <>
            <button type="button" onClick={onEdit} className={OUTLINE_BUTTON}>
              Alterar resposta
            </button>
            {view.closesAt && (
              <p className="text-xs text-[#5c6168]">Você pode mudar a resposta até {formatRsvpDeadline(view.closesAt)}.</p>
            )}
          </>
        ) : (
          <p className="text-xs text-[#5c6168]">
            O prazo para responder terminou{view.closesAt ? ` em ${formatRsvpDeadline(view.closesAt)}` : ""}. Para mudar, fale
            com a organização da festa.
          </p>
        )}
        {preview ? (
          <p className="text-xs font-semibold text-[#9c7434]">Prévia: nada foi gravado.</p>
        ) : (
          view.respondedAt && <p className="text-xs text-[#7b7f85]">Respondido em {formatRespondedAt(view.respondedAt)}.</p>
        )}
      </div>
    </Card>
  );
}

export function ConfirmarPresencaClient({ preview }: { preview: boolean }) {
  const [view, setView] = useState<RsvpView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attending, setAttending] = useState<boolean | null>(null);
  const [transport, setTransport] = useState<RsvpTransport | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewAnswer, setPreviewAnswer] = useState<{ attending: boolean; transport: RsvpTransport | null } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await requestJson<RsvpView>(API);
      setView(data);
      setAttending(data.respondedAt ? data.attending : null);
      setTransport(data.respondedAt ? data.transport : null);
      setEditing(!data.respondedAt);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ready = attending === false || (attending === true && transport !== null);

  const submit = async () => {
    if (!ready || attending === null) return;
    setSaveError(null);
    if (preview) {
      setPreviewAnswer({ attending, transport: attending ? transport : null });
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const data = await requestJson<RsvpView>(API, {
        method: "POST",
        body: JSON.stringify({ attending, transport: attending ? transport : null }),
      });
      setView(data);
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível registrar a sua resposta.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <Shell>
        <Card className="text-center">
          <p className="text-[15px] leading-7 text-[#3a3f45]">{loadError}</p>
          <button type="button" onClick={() => void load()} className={cn(OUTLINE_BUTTON, "mt-4")}>
            Tentar de novo
          </button>
        </Card>
      </Shell>
    );
  }

  if (!view) {
    return (
      <Shell>
        <Card>
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#5c6168]" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Carregando sua confirmação…
          </div>
        </Card>
      </Shell>
    );
  }

  if (!view.eligible && !preview) {
    return (
      <Shell firstName={view.firstName}>
        <Card className="text-center">
          <p className="text-[15px] leading-7 text-[#3a3f45]">
            Esta confirmação é só para a equipe do escritório e não encontramos o seu nome na lista. Se você faz parte da
            equipe, fale com a organização da festa.
          </p>
        </Card>
      </Shell>
    );
  }

  const shownAnswer = preview && previewAnswer ? { ...view, ...previewAnswer, open: true } : view;
  const answered = preview ? Boolean(previewAnswer) : Boolean(view.respondedAt);
  const canEdit = view.open || preview;

  if (answered && !editing) {
    return (
      <Shell firstName={view.firstName}>
        <Summary
          view={shownAnswer}
          preview={preview}
          onEdit={() => {
            setAttending(shownAnswer.attending);
            setTransport(shownAnswer.transport);
            setEditing(true);
          }}
        />
      </Shell>
    );
  }

  if (!canEdit) {
    return (
      <Shell firstName={view.firstName}>
        <Card className="text-center">
          <CalendarX2 className="mx-auto size-8 text-[#c49a52]" aria-hidden />
          <p className="mt-3 text-[15px] leading-7 text-[#3a3f45]">
            O prazo para confirmar terminou{view.closesAt ? ` em ${formatRsvpDeadline(view.closesAt)}` : ""}. Se ainda
            precisa responder, fale com a organização da festa.
          </p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell firstName={view.firstName}>
      <Card>
        {preview && (
          <p className="mb-5 rounded-full bg-[#f1e6d3] px-4 py-2 text-center text-xs font-semibold text-[#7a5a26]">
            Prévia: as respostas não são gravadas.
          </p>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-8"
        >
          <fieldset>
            <legend className="w-full text-center">
              <span className="block text-xl font-semibold text-[#0d1e2e]">Você vai à festa?</span>
            </legend>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                name="presenca"
                checked={attending === true}
                onChange={() => setAttending(true)}
                icon={PartyPopper}
                title="Sim, estarei lá!"
                hint="Conte comigo para brindar"
              />
              <ChoiceCard
                name="presenca"
                checked={attending === false}
                onChange={() => setAttending(false)}
                icon={CalendarX2}
                title="Não vou poder ir"
                hint="Desta vez vou ficar de fora"
              />
            </div>
          </fieldset>

          <AnimatePresence initial={false}>
            {attending === true && (
              <motion.div
                key="transporte"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <Ornament />
                <fieldset>
                  <legend className="w-full text-center">
                    <span className="block text-xl font-semibold text-[#0d1e2e]">Vai precisar do transporte?</span>
                    <span className="mx-auto mt-2 block max-w-sm text-[14px] leading-6 text-[#5c6168]">
                      Vamos disponibilizar um micro-ônibus com saída do escritório até a festa e retorno ao final do
                      evento.
                    </span>
                  </legend>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {TRANSPORT_OPTIONS.map((option) => (
                      <ChoiceCard
                        key={option.value}
                        name="transporte"
                        checked={transport === option.value}
                        onChange={() => setTransport(option.value)}
                        icon={option.icon}
                        title={option.title}
                        hint={option.hint}
                        compact
                      />
                    ))}
                  </div>
                </fieldset>
                <p className="rounded-2xl bg-[#0d1e2e] px-5 py-4 text-center text-[14px] font-semibold leading-6 text-[#f3e7d3]">
                  Reforçamos: se beber, não dirija! Aproveite o transporte oferecido pelo escritório e curta a celebração
                  sem preocupações.
                </p>
                <p className="text-center text-[12px] font-medium leading-5 text-[#5c6168]">
                  * No dia da festa, o micro-ônibus estará disponível apenas para quem indicar aqui a necessidade de
                  transporte.
                </p>
                <DietaryNote dietary={view.dietary} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col items-center gap-3 pt-1">
            {saveError && (
              <p className="w-full rounded-2xl bg-[#fbeaea] px-4 py-3 text-center text-sm text-[#8a2b2b]" role="alert">
                {saveError}
              </p>
            )}
            <button type="submit" disabled={!ready || saving} className={cn(GOLD_BUTTON, "w-full sm:w-auto sm:min-w-72")}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              {saving ? "Enviando…" : attending === true ? "Confirmar presença" : "Enviar resposta"}
            </button>
            {answered && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setSaveError(null);
                }}
                className={cn("text-sm font-semibold underline-offset-4 hover:underline", GOLD_TEXT)}
              >
                Voltar sem alterar
              </button>
            )}
            {view.closesAt && (
              <p className="text-center text-xs font-semibold text-[#0d1e2e]">
                Responda até {formatRsvpDeadline(view.closesAt)}. Até lá, você pode mudar a resposta quando quiser.
              </p>
            )}
          </div>
        </form>
      </Card>
    </Shell>
  );
}
