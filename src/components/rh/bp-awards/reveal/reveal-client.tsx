"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Maximize, Minimize, TriangleAlert, X } from "lucide-react";
import styles from "@/components/rh/bp-awards/awards-theme.module.css";
import { getInitials } from "@/lib/ferias/filters";
import { awardPhotoUrl } from "@/lib/rh/bp-awards/format";
import {
  AWARDS_COMMITTEE_PATH,
  AWARDS_LOGO_SRC,
  awardSealSrc,
  type AwardCategory,
  type AwardCategoryKey,
  type AwardEdition,
  type AwardPerson,
  type RevealCategory,
} from "@/lib/rh/bp-awards/types";
import { cn } from "@/lib/utils";

type RevealData = { edition: AwardEdition; categories: RevealCategory[] } | null;

type Slide =
  | { kind: "opening" }
  | { kind: "value"; item: RevealCategory; index: number }
  | { kind: "finalists"; item: RevealCategory; index: number }
  | { kind: "suspense"; item: RevealCategory; index: number }
  | { kind: "winner"; item: RevealCategory; index: number }
  | { kind: "closing" };

const EASE = [0.16, 1, 0.3, 1] as const;
/** Fotos do telão: até ~36% da altura de uma tela 4K. */
const PORTRAIT_PIXELS = 800;

function buildSlides(categories: RevealCategory[]): Slide[] {
  const slides: Slide[] = [{ kind: "opening" }];
  categories.forEach((item, index) => {
    slides.push({ kind: "value", item, index });
    if (item.finalists.length > 0) slides.push({ kind: "finalists", item, index });
    slides.push({ kind: "suspense", item, index });
    slides.push({ kind: "winner", item, index });
  });
  slides.push({ kind: "closing" });
  return slides;
}

/** Foto grande para o telão (img simples: sem o "pisca" das iniciais do Avatar). */
function Portrait({ person, className }: { person: AwardPerson; className?: string }) {
  return (
    <span className={cn("relative block overflow-hidden rounded-full bg-[var(--aw-raised)]", className)}>
      {person.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={awardPhotoUrl(person.avatar_url, PORTRAIT_PIXELS)!} alt="" className="size-full object-cover object-center" />
      ) : (
        <span className="grid size-full place-items-center text-[7vh] font-bold text-[var(--aw-gold)]">
          {getInitials(person.short_name)}
        </span>
      )}
    </span>
  );
}

function Seal({ categoryKey, className }: { categoryKey: AwardCategoryKey; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={awardSealSrc(categoryKey)} alt="" width={640} height={640} className={cn("h-auto", className)} />;
}

/** "—— CLIENTE NO CENTRO ——": rótulo entre filetes, como a capa da identidade. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center justify-center gap-[1.4vh] text-[clamp(0.9rem,2vh,1.4rem)] font-bold tracking-[0.06em] text-[var(--aw-ivory)] uppercase">
      <span aria-hidden className="h-px w-[6vh] bg-[var(--aw-gold)]" />
      {children}
      <span aria-hidden className="h-px w-[6vh] bg-[var(--aw-gold)]" />
    </p>
  );
}

function valueLabel(category: AwardCategory, index: number): string {
  return `Valor ${index + 1} de 5 · ${category.name}`;
}

export function RevealClient({ data }: { data: RevealData }) {
  const slides = useMemo(() => buildSlides(data?.categories ?? []), [data]);
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const missingWinners = (data?.categories ?? []).filter((item) => !item.winner).length;

  const next = useCallback(() => setIndex((current) => Math.min(current + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setIndex((current) => Math.max(current - 1, 0)), []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  const wake = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeVisible(false), 2500);
  }, []);

  useEffect(() => {
    hideTimer.current = setTimeout(() => setChromeVisible(false), 2500);
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      // Passadores mandam PageDown/PageUp; teclado usa setas, espaço e Enter.
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(event.key)) {
        event.preventDefault();
        next();
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(event.key)) {
        event.preventDefault();
        prev();
      } else if (event.key === "Home") {
        setIndex(0);
      } else if (event.key === "End") {
        setIndex(slides.length - 1);
      } else if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", wake);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", wake);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [next, prev, slides.length, toggleFullscreen, wake]);

  if (!data) {
    return (
      <div className={cn(styles.theme, "grid place-items-center px-6 text-center")}>
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={AWARDS_LOGO_SRC} alt="Bismarchi | Pires Awards" width={900} height={869} className="h-auto w-56" />
          <p className="mt-6 text-[var(--aw-mist)]">A revelação é só para o comitê de Pessoas e Cultura.</p>
          <Link href="/" className={cn(styles.secondary, "mt-8")}>
            Voltar ao ORQESTRAI
          </Link>
        </div>
      </div>
    );
  }

  const slide = slides[index];
  const allPhotos = data.categories.flatMap((item) => item.finalists.concat(item.winner ? [item.winner] : []));

  return (
    <div
      className={cn(styles.theme, "relative h-dvh cursor-none select-none overflow-hidden", chromeVisible && "cursor-default")}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-chrome]")) return;
        if (event.clientX < window.innerWidth / 4) prev();
        else next();
      }}
    >
      {/* Aquece o cache das fotos e dos selos para não piscarem no telão. */}
      <div aria-hidden className="pointer-events-none absolute size-0 overflow-hidden opacity-0">
        {allPhotos.map((person, photoIndex) =>
          person.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${person.id}-${photoIndex}`} src={awardPhotoUrl(person.avatar_url, PORTRAIT_PIXELS)!} alt="" />
          ) : null
        )}
        {data.categories.map((item) => (
          <Seal key={item.category.key} categoryKey={item.category.key} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={index}
          aria-live="polite"
          className="absolute inset-0 flex flex-col items-center justify-center px-[6vw] py-[7vh] text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <SlideContent slide={slide} edition={data.edition} categories={data.categories} />
        </motion.section>
      </AnimatePresence>

      <div
        data-chrome
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 px-6 py-4 transition-opacity duration-300",
          chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="flex items-center gap-2">
          <Link href={AWARDS_COMMITTEE_PATH} className={cn(styles.secondary, "min-h-10 px-3 text-sm")}>
            <X className="size-4" aria-hidden />
            Sair
          </Link>
          {missingWinners > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--aw-gold-bright)]">
              <TriangleAlert className="size-4" aria-hidden />
              {missingWinners} {missingWinners === 1 ? "valor sem vencedor" : "valores sem vencedor"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-[var(--aw-mist)]">
            {index + 1}/{slides.length}
          </span>
          <button type="button" className={cn(styles.secondary, "min-h-10 px-3")} onClick={prev} aria-label="Voltar">
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <button type="button" className={cn(styles.secondary, "min-h-10 px-3")} onClick={next} aria-label="Avançar">
            <ArrowRight className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={cn(styles.secondary, "min-h-10 px-3")}
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {fullscreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}

function SlideContent({
  slide,
  edition,
  categories,
}: {
  slide: Slide;
  edition: AwardEdition;
  categories: RevealCategory[];
}) {
  switch (slide.kind) {
    case "opening":
      return (
        <>
          <motion.img
            src={AWARDS_LOGO_SRC}
            alt="Bismarchi | Pires Awards"
            width={900}
            height={869}
            className="h-[52vh] w-auto"
            initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.3, ease: EASE }}
          />
          <motion.div
            className="mt-[5vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6, ease: EASE }}
          >
            <Kicker>Premiação CIVIL · {edition.year}</Kicker>
          </motion.div>
          <p className="mt-[5vh] text-[clamp(0.85rem,1.7vh,1.05rem)] text-[var(--aw-dim)]">
            Setas ou passador para avançar · F para tela cheia
          </p>
        </>
      );

    case "value":
      return (
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.1, ease: EASE }}
          >
            <Seal categoryKey={slide.item.category.key} className="w-[44vh]" />
          </motion.div>
          <h1 className={cn(styles.display, "mt-[4vh] text-[clamp(2.25rem,7vh,5rem)] text-[var(--aw-ivory)]")}>
            {slide.item.category.name}
          </h1>
          <motion.p
            className="mt-[2.5vh] max-w-[62ch] text-[clamp(1rem,2.6vh,1.65rem)] font-light leading-relaxed text-[var(--aw-mist)]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45, ease: EASE }}
          >
            {slide.item.category.description}
          </motion.p>
        </>
      );

    case "finalists":
      return (
        <>
          <Kicker>{valueLabel(slide.item.category, slide.index)}</Kicker>
          <h1 className={cn(styles.display, "mt-[2.5vh] text-[clamp(2.25rem,7vh,5rem)] text-[var(--aw-ivory)]")}>
            {slide.item.finalists.length === 1 ? "O finalista" : "Os finalistas"}
          </h1>
          <ul className="mt-[6vh] flex flex-wrap items-start justify-center gap-[3vw]">
            {slide.item.finalists.map((person, position) => (
              <motion.li
                key={person.id}
                className="flex w-[clamp(13rem,36vh,26rem)] flex-col items-center"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.25 + position * 0.35, ease: EASE }}
              >
                <Portrait person={person} className="size-[clamp(9rem,26vh,18rem)] ring-2 ring-[var(--aw-line)]" />
                <span className="mt-[2.5vh] text-[clamp(1.1rem,3.2vh,2.1rem)] font-bold leading-tight text-[var(--aw-ivory)]">
                  {person.short_name}
                </span>
                <span className="mt-1 text-[clamp(0.85rem,2vh,1.25rem)] text-[var(--aw-mist)]">{person.department}</span>
              </motion.li>
            ))}
          </ul>
        </>
      );

    case "suspense":
      return (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            transition={{ duration: 1.2, ease: EASE }}
          >
            <Seal categoryKey={slide.item.category.key} className="w-[24vh]" />
          </motion.div>
          <motion.h1
            className={cn(styles.display, "mt-[5vh] max-w-[18ch] text-[clamp(2.5rem,9vh,6.5rem)] text-[var(--aw-ivory)]")}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.3, ease: EASE }}
          >
            E o prêmio vai para…
          </motion.h1>
        </>
      );

    case "winner": {
      const winner = slide.item.winner;
      if (!winner) {
        return (
          <>
            <Kicker>{valueLabel(slide.item.category, slide.index)}</Kicker>
            <h1 className={cn(styles.display, "mt-[3vh] text-[clamp(2.25rem,7vh,5rem)] text-[var(--aw-mist)]")}>
              Vencedor ainda não definido
            </h1>
            <p className="mt-[2vh] text-[var(--aw-dim)]">Defina no painel do comitê antes da festa.</p>
          </>
        );
      }
      return (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[38%] size-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(213,179,113,0.3),rgba(213,179,113,0))]"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.6, ease: EASE }}
          />
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.9, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1, ease: EASE }}
          >
            <Portrait person={winner} className="size-[clamp(11rem,38vh,27rem)] ring-[3px] ring-[var(--aw-gold)]" />
            {/* Selo do valor como medalha na foto. */}
            <motion.span
              className="absolute -bottom-[1vh] -right-[3vh] block"
              initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.9, delay: 0.7, ease: EASE }}
            >
              <span className="block rounded-full bg-[var(--aw-navy)] p-[0.6vh] shadow-[0_6px_18px_rgba(0,0,0,0.45)]">
                <Seal categoryKey={slide.item.category.key} className="w-[14vh]" />
              </span>
            </motion.span>
          </motion.div>
          <motion.div
            className="relative"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
          >
            <p className="mt-[4vh] text-[clamp(0.9rem,1.9vh,1.25rem)] font-bold tracking-[0.06em] text-[var(--aw-gold-bright)] uppercase">
              {slide.item.category.name}
            </p>
            <h1 className={cn(styles.display, "mt-[1vh] text-[clamp(2.5rem,8.5vh,6rem)] text-[var(--aw-ivory)]")}>
              {winner.short_name}
            </h1>
            <p className="mt-[0.5vh] text-[clamp(1rem,2.3vh,1.45rem)] text-[var(--aw-mist)]">{winner.department}</p>
          </motion.div>
          {slide.item.citation && (
            <motion.p
              className="relative mt-[3vh] max-w-[58ch] text-[clamp(1rem,2.5vh,1.6rem)] font-light leading-relaxed text-[var(--aw-ivory)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1.1, ease: EASE }}
            >
              “{slide.item.citation}”
            </motion.p>
          )}
        </>
      );
    }

    case "closing": {
      const winners = categories.filter((item) => item.winner);
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={AWARDS_LOGO_SRC} alt="Bismarchi | Pires Awards" width={900} height={869} className="h-[20vh] w-auto" />
          <h1 className={cn(styles.display, "mt-[3vh] text-[clamp(2rem,6vh,4.25rem)] text-[var(--aw-ivory)]")}>Parabéns!</h1>
          <ul className="mt-[5vh] flex flex-wrap items-start justify-center gap-x-[1.5vw] gap-y-[4vh]">
            {winners.map((item, position) => (
              <motion.li
                key={item.category.key}
                className="flex w-[clamp(10rem,25vh,18rem)] flex-col items-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 + position * 0.15, ease: EASE }}
              >
                <span className="relative">
                  <Portrait person={item.winner!} className="size-[clamp(7rem,17vh,13rem)] ring-2 ring-[var(--aw-gold)]" />
                  <span className="absolute -bottom-[0.8vh] -right-[1.5vh] block rounded-full bg-[var(--aw-navy)] p-[0.4vh]">
                    <Seal categoryKey={item.category.key} className="w-[7vh]" />
                  </span>
                </span>
                <span className="mt-[2.5vh] text-[clamp(0.95rem,2.4vh,1.5rem)] font-bold leading-tight text-[var(--aw-ivory)]">
                  {item.winner!.short_name}
                </span>
                <span className="mt-1 text-[clamp(0.7rem,1.5vh,0.95rem)] font-bold tracking-[0.04em] text-[var(--aw-gold-bright)] uppercase">
                  {item.category.name}
                </span>
              </motion.li>
            ))}
          </ul>
          <p className="mt-[5vh] text-[clamp(0.95rem,2.2vh,1.4rem)] text-[var(--aw-mist)]">
            Obrigado a todos que fazem parte destes 10 anos.
          </p>
        </>
      );
    }
  }
}
