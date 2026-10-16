"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Look } from "./looks";

function Credit({ look, className }: { look: Look; className: string }) {
  if (!look.credit) return null;
  return (
    <span className={className}>
      Foto:{" "}
      <a href={look.credit.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
        {look.credit.name} · {look.credit.source}
      </a>
    </span>
  );
}

/**
 * Um layout por breakpoint, alternados só por CSS: o oculto fica com display:none e
 * as imagens lazy dele não carregam. Assim a ordem por linha vale sem JS e sem salto
 * de layout na hidratação.
 */
const LAYOUTS = [
  { columns: 2, className: "flex sm:hidden" },
  { columns: 3, className: "hidden sm:flex lg:hidden" },
  { columns: 4, className: "hidden lg:flex" },
];

/** Altura da legenda em proporção à largura da coluna (estimativa). */
const CAPTION_RATIO = 0.2;

/**
 * Masonry que preserva a ordem de leitura: cada foto vai para a coluna mais baixa
 * no momento, então as primeiras da lista abrem as colunas (ao contrário de CSS columns,
 * que enche uma coluna inteira antes de passar para a próxima).
 */
function distribute(looks: Look[], columns: number) {
  const result = Array.from({ length: columns }, () => [] as { look: Look; index: number }[]);
  const heights = new Array<number>(columns).fill(0);
  looks.forEach((look, index) => {
    const target = heights.indexOf(Math.min(...heights));
    result[target].push({ look, index });
    heights[target] += look.height / look.width + CAPTION_RATIO;
  });
  return result;
}

export function LookGallery({ looks, label }: { looks: Look[]; label: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStartX = useRef<number | null>(null);
  const [index, setIndex] = useState<number | null>(null);

  const open = (i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  };

  const close = () => dialogRef.current?.close();

  const step = useCallback(
    (delta: number) => {
      setIndex((current) => (current === null ? current : (current + delta + looks.length) % looks.length));
    },
    [looks.length]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    const onClose = () => setIndex(null);
    dialog.addEventListener("keydown", onKey);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("keydown", onKey);
      dialog.removeEventListener("close", onClose);
    };
  }, [step]);

  const current = index === null ? null : looks[index];

  return (
    <>
      {LAYOUTS.map(({ columns, className }) => (
        <div
          key={columns}
          className={`${className} items-start gap-3 sm:gap-4`}
          role="group"
          aria-label={`Fotos de referência — ${label}`}
        >
          {distribute(looks, columns).map((column, c) => (
            <ul key={c} className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
              {column.map(({ look, index: i }) => (
                <li key={look.src}>
                  <figure>
                    <button
                      type="button"
                      onClick={() => open(i)}
                      className="group block w-full overflow-hidden rounded-2xl border border-[#e4d3ae] bg-[#efe5d3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c7434]"
                      aria-label={`Ampliar foto: ${look.caption}`}
                    >
                      <Image
                        src={look.src}
                        alt={look.caption}
                        width={look.width}
                        height={look.height}
                        sizes="(min-width: 1024px) 250px, (min-width: 640px) 32vw, 48vw"
                        className="h-auto w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                      />
                    </button>
                    <figcaption className="mt-2 px-1 text-center">
                      <span className="block text-[13px] leading-snug text-[#3a3f45]">{look.caption}</span>
                      <Credit look={look} className="mt-0.5 block text-[11px] text-[#8a8478]" />
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          ))}
        </div>
      ))}

      <dialog
        ref={dialogRef}
        aria-label={current ? current.caption : label}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          const end = event.changedTouches[0]?.clientX;
          touchStartX.current = null;
          if (start === null || end === undefined || Math.abs(end - start) < 40) return;
          step(end < start ? 1 : -1);
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-[#0d1e2e]/92"
      >
        {current && index !== null && (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-4 px-4 py-14 font-[family-name:var(--font-dress-sans)] text-[#f8f6f1]"
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <button
              type="button"
              onClick={close}
              className="absolute top-3 right-3 grid h-11 w-11 place-items-center rounded-full text-[#f8f6f1]/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-6 w-6" aria-hidden />
            </button>

            <Image
              key={current.src}
              src={current.src}
              alt={current.caption}
              width={current.width}
              height={current.height}
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="h-auto max-h-[76dvh] w-auto max-w-full rounded-xl object-contain"
            />

            <div className="flex w-full max-w-md items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => step(-1)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 transition hover:border-[#d3b171] hover:text-[#d3b171]"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <p className="text-center">
                <span className="block text-sm font-medium">{current.caption}</span>
                <span className="mt-0.5 block text-[11px] tracking-[0.16em] text-[#d3b171] uppercase">
                  {label} · {index + 1} de {looks.length}
                </span>
                <Credit look={current} className="mt-1 block text-[11px] text-white/55" />
              </p>
              <button
                type="button"
                onClick={() => step(1)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 transition hover:border-[#d3b171] hover:text-[#d3b171]"
                aria-label="Próxima foto"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
