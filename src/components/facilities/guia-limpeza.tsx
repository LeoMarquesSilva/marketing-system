"use client";

/* eslint-disable react-hooks/set-state-in-effect -- O guia acompanha a geometria do DOM em efeitos. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  CalendarDays,
  ChartColumn,
  CircleCheck,
  CircleHelp,
  CircleSlash,
  ClipboardCheck,
  DoorOpen,
  Gauge,
  Layers,
  MessageSquareWarning,
  NotebookPen,
  PenLine,
  Plus,
  Sparkles,
  SprayCan,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cleaningApi } from "@/lib/facilities/cleaning-client";
import { CLEANING_GUIDE_TITLE, cleaningGuideSteps, type CleaningGuide, type CleaningGuideIcon, type CleaningGuideStep } from "@/lib/facilities/cleaning-guide";
import { cn } from "@/lib/utils";

/** Acima da sidebar, do cabeçalho e da barra de baixo do celular. */
const GUIDE_Z = 1000;
const LOCAL_KEY = "limpeza.guias";
/** Espera a tela assentar (fontes, fotos) antes de abrir sozinho. */
const OPEN_DELAY_MS = 700;

const ICONS: Record<CleaningGuideIcon, LucideIcon> = {
  "boas-vindas": Sparkles,
  progresso: Gauge,
  marcar: CircleCheck,
  "nao-deu": CircleSlash,
  aviso: MessageSquareWarning,
  encerrar: ClipboardCheck,
  guia: CircleHelp,
  assinar: PenLine,
  numeros: ChartColumn,
  calendario: CalendarDays,
  anotacao: NotebookPen,
  ambientes: DoorOpen,
  equipe: Users,
  tipos: SprayCan,
  carga: Layers,
  organizar: ArrowUpDown,
  novo: Plus,
};

function seenLocally(guide: CleaningGuide): boolean {
  try {
    const stored = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "{}") as Record<string, string> | null;
    return Boolean(stored?.[guide]);
  } catch {
    return false;
  }
}

function rememberLocally(guide: CleaningGuide) {
  try {
    const stored = (JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "{}") ?? {}) as Record<string, string>;
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...stored, [guide]: new Date().toISOString() }));
  } catch {
    // Sem armazenamento no navegador: o banco guarda.
  }
}

/** O elemento visível do passo; null = cartão no meio da tela. */
function elementFor(step: CleaningGuideStep | undefined): HTMLElement | null {
  if (!step?.target) return null;
  return (
    Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)).find((el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    }) ?? null
  );
}

function useStepBox(step: CleaningGuideStep | undefined, active: boolean) {
  const [box, setBox] = useState<DOMRect | null>(null);
  const current = useRef<HTMLElement | null>(null);

  const measure = useCallback(
    (scroll: boolean) => {
      if (!active) return setBox(null);
      const el = elementFor(step);
      if (!el) {
        current.current = null;
        return setBox(null);
      }
      if (scroll || el !== current.current) {
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: still ? "auto" : "smooth" });
      }
      current.current = el;
      const next = el.getBoundingClientRect();
      setBox((prev) =>
        next.width > 0 && next.height > 0
          ? prev && prev.x === next.x && prev.y === next.y && prev.width === next.width && prev.height === next.height
            ? prev
            : next
          : null
      );
    },
    [step, active]
  );

  useLayoutEffect(() => {
    measure(true);
  }, [measure]);

  useEffect(() => {
    if (!active) return;
    const again = () => measure(false);
    window.addEventListener("resize", again);
    window.addEventListener("scroll", again, true);
    // A rolagem suave termina depois: mede de novo enquanto o passo estiver aberto.
    const timer = window.setInterval(again, 400);
    return () => {
      window.removeEventListener("resize", again);
      window.removeEventListener("scroll", again, true);
      window.clearInterval(timer);
    };
  }, [active, measure]);

  return box;
}

function Cutout({ box }: { box: DOMRect | null }) {
  if (!box) return <div className="fixed inset-0 bg-[#04121b]/70" style={{ zIndex: GUIDE_Z }} aria-hidden />;
  // Recorte só da parte visível: durante a rolagem o alvo pode estar fora da tela.
  const pad = 8;
  const x = Math.min(Math.max(0, box.left - pad), window.innerWidth);
  const y = Math.min(Math.max(0, box.top - pad), window.innerHeight);
  const w = Math.max(0, Math.min(window.innerWidth, box.right + pad) - x);
  const h = Math.max(0, Math.min(window.innerHeight, box.bottom + pad) - y);
  return (
    <svg className="fixed inset-0 h-full w-full" style={{ zIndex: GUIDE_Z }} aria-hidden>
      <defs>
        <mask id="guia-limpeza-recorte">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={12} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(4,18,27,0.70)" mask="url(#guia-limpeza-recorte)" />
      <rect x={x} y={y} width={w} height={h} rx={12} fill="none" stroke="#47cdd0" strokeWidth={2} />
    </svg>
  );
}

function GuideCard({
  title,
  step,
  index,
  total,
  box,
  onBack,
  onNext,
  onClose,
}: {
  title: string;
  step: CleaningGuideStep;
  index: number;
  total: number;
  box: DOMRect | null;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
  const last = index === total - 1;
  const Icon = ICONS[step.icon];

  useLayoutEffect(() => {
    const card = ref.current;
    if (!box || !card) {
      setPosition({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      return;
    }
    const margin = 12;
    const gap = 14;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const below = box.bottom + gap + height <= window.innerHeight - margin;
    const above = box.top - gap - height >= margin;
    const right = box.right + gap + width <= window.innerWidth - margin;
    const left = box.left - gap - width >= margin;
    let top: number;
    let leftPos: number;
    if (below || above) {
      top = below ? box.bottom + gap : box.top - gap - height;
      leftPos = box.left + box.width / 2 - width / 2;
    } else if (right || left) {
      leftPos = right ? box.right + gap : box.left - gap - width;
      top = Math.max(box.top, margin);
    } else {
      // Alvo que ocupa quase a tela toda: o cartão fica por cima, embaixo.
      top = window.innerHeight - height - margin;
      leftPos = window.innerWidth - width - margin;
    }
    top = Math.min(Math.max(top, margin), window.innerHeight - height - margin);
    leftPos = Math.min(Math.max(leftPos, margin), window.innerWidth - width - margin);
    setPosition({ top, left: leftPos, transform: "none" });
  }, [box, step.id]);

  return (
    <div
      ref={ref}
      className="fixed w-[min(400px,calc(100vw-1.5rem))] rounded-xl border border-white/10 bg-[#10293a] p-5 text-white shadow-2xl"
      style={{ zIndex: GUIDE_Z + 1, ...position }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guia-limpeza-titulo"
      aria-describedby="guia-limpeza-texto"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#47cdd0]/15 ring-1 ring-[#47cdd0]/25" aria-hidden>
            <Icon className="size-5 text-[#9fe7e8]" />
          </span>
          <div>
            <p className="text-xs font-medium text-white/60">{title}</p>
            <p className="text-xs text-white/45">
              Passo {index + 1} de {total}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-md text-white/55 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
          aria-label="Fechar o guia"
        >
          <X className="size-4" />
        </button>
      </div>
      <h2 id="guia-limpeza-titulo" className="text-lg font-semibold leading-snug">
        {step.title}
      </h2>
      <p id="guia-limpeza-texto" className="mt-2 text-[15px] leading-relaxed text-white/80">
        {step.body}
      </p>
      <div className="mt-4 flex justify-center gap-1" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-[#47cdd0]" : "w-1.5 bg-white/25")} />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onClose} className="h-10 text-white/60 hover:bg-white/10 hover:text-white">
          {last ? "Fechar" : "Pular"}
        </Button>
        <div className="flex gap-2">
          {index > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="h-10 gap-1 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Voltar
            </Button>
          )}
          <Button type="button" onClick={onNext} autoFocus className="h-10 gap-1 bg-[#47cdd0] px-4 text-[#04202f] hover:bg-[#6fd9db]">
            {last ? "Começar" : "Próximo"}
            {!last && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * "Ver guia" da tela da Limpeza e o passo a passo por cima dela. Abre sozinho na primeira vez que a pessoa entra
 * na tela (o banco e o navegador guardam quem já viu, até o fim ou pulando).
 */
export function GuiaLimpeza({
  guide,
  seen,
  canManage,
  autoOpen = true,
  tone = "light",
  className,
}: {
  guide: CleaningGuide;
  /** Já visto segundo o banco (lido junto com a tela). */
  seen: boolean;
  canManage: boolean;
  /** Abre sozinho só quando a tela tem o que mostrar (ex.: dia útil com a lista). */
  autoOpen?: boolean;
  tone?: "dark" | "light";
  className?: string;
}) {
  const isAdmin = (useAuth().profile?.role ?? "").toLowerCase() === "admin";
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [steps, setSteps] = useState<CleaningGuideStep[]>([]);
  const [mounted, setMounted] = useState(false);
  const saved = useRef(seen);
  const step = steps[index];
  const box = useStepBox(step, active);

  useEffect(() => setMounted(true), []);

  const open = useCallback(() => {
    // Passos opcionais saem quando a tela não tem o elemento (ex.: nenhum dia para conferir).
    const all = cleaningGuideSteps(guide, { canManage, isAdmin });
    setSteps(all.filter((item) => !item.optional || elementFor(item)));
    setIndex(0);
    setActive(true);
  }, [guide, canManage, isAdmin]);

  useEffect(() => {
    if (seen || !autoOpen || seenLocally(guide)) return;
    const timer = window.setTimeout(open, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [seen, autoOpen, guide, open]);

  const close = useCallback(() => {
    setActive(false);
    rememberLocally(guide);
    if (saved.current) return;
    saved.current = true;
    void cleaningApi.guideSeen(guide).catch(() => {
      // O navegador já guardou; o guia não abre de novo aqui.
    });
  }, [guide]);

  const next = useCallback(() => {
    if (index >= steps.length - 1) return close();
    setIndex((i) => i + 1);
  }, [index, steps.length, close]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!active) return;
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [active, next, back, close]);

  return (
    <>
      <button
        type="button"
        data-tour="ver-guia"
        onClick={open}
        title={`Ver o guia: ${CLEANING_GUIDE_TITLE[guide]}`}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
          tone === "dark"
            ? "border border-white/15 bg-white/[0.07] text-white hover:bg-white/[0.14]"
            : "border border-[#dce9eb] bg-white text-[#285f7a] hover:border-[#347796]/40 hover:bg-[#f2f6f7]",
          className
        )}
      >
        <CircleHelp className="size-4" aria-hidden />
        Ver guia
      </button>
      {mounted && active && step
        ? createPortal(
            <>
              <Cutout box={box} />
              <GuideCard
                title={CLEANING_GUIDE_TITLE[guide]}
                step={step}
                index={index}
                total={steps.length}
                box={box}
                onBack={back}
                onNext={next}
                onClose={close}
              />
            </>,
            document.body
          )
        : null}
    </>
  );
}
