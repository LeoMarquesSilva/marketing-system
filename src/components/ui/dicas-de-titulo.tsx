"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Tempo com o mouse parado em cima antes de a dica aparecer. */
const ATRASO = 350;
/** Distância mínima das bordas da janela. */
const MARGEM = 8;
/** Espaço entre o item e o balão. */
const AFASTAMENTO = 8;

interface Dica {
  texto: string;
  /** Centro do item na horizontal. */
  x: number;
  /** Topo (balão em cima) ou base (balão embaixo) do item. */
  y: number;
  lado: "cima" | "baixo";
}

function semEspacos(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** O texto passa do espaço (cortado com reticências ou em menos linhas)? Olha o item e o que tem dentro. */
function estaCortado(elemento: HTMLElement): boolean {
  return [elemento, ...elemento.querySelectorAll<HTMLElement>("*")].some(
    (no) => no.scrollWidth > no.clientWidth + 1 || (no.clientHeight > 0 && no.scrollHeight > no.clientHeight + 1)
  );
}

/** A dica só repetiria o que já está inteiro na tela: não mostra. */
function repeteOVisivel(elemento: HTMLElement, texto: string): boolean {
  return semEspacos(elemento.innerText || "") === semEspacos(texto) && !estaCortado(elemento);
}

function Balao({ dica }: { dica: Dica }) {
  const caixa = useRef<HTMLDivElement>(null);
  const seta = useRef<HTMLSpanElement>(null);

  // Mede o balão já desenhado e o encaixa dentro da janela; a seta continua apontando para o item.
  useLayoutEffect(() => {
    const balao = caixa.current;
    if (!balao) return;
    const { width, height } = balao.getBoundingClientRect();
    const esquerda = Math.min(Math.max(dica.x - width / 2, MARGEM), window.innerWidth - width - MARGEM);
    const topo = dica.lado === "cima" ? dica.y - height - AFASTAMENTO : dica.y + AFASTAMENTO;
    balao.style.left = `${esquerda}px`;
    balao.style.top = `${topo}px`;
    balao.style.visibility = "visible";
    if (seta.current) seta.current.style.left = `${Math.min(Math.max(dica.x - esquerda - 5, 10), width - 20)}px`;
  }, [dica]);

  return (
    <div
      ref={caixa}
      role="tooltip"
      style={{ position: "fixed", left: 0, top: 0, visibility: "hidden" }}
      className="pointer-events-none z-[300] max-w-[min(22rem,calc(100vw-1rem))] whitespace-pre-line break-words rounded-md border border-[#47cdd0]/30 bg-[#04202f] px-2.5 py-1.5 text-xs leading-snug text-white shadow-[0_12px_28px_-12px_rgba(3,7,12,0.6)] animate-in fade-in-0 zoom-in-95"
    >
      {dica.texto}
      <span
        ref={seta}
        aria-hidden
        className={
          dica.lado === "cima"
            ? "absolute -bottom-[5px] size-2.5 rotate-45 border-b border-r border-[#47cdd0]/30 bg-[#04202f]"
            : "absolute -top-[5px] size-2.5 rotate-45 border-l border-t border-[#47cdd0]/30 bg-[#04202f]"
        }
      />
    </div>
  );
}

/**
 * Troca o balão padrão do navegador (o `title`) por uma dica no padrão do Orquestra (fundo #04202f, borda ciano),
 * no sistema todo (montado uma vez no layout raiz). Ao passar o mouse, o `title` vira
 * `data-dica` (assim o navegador não mostra o dele) e, se o item não tiver nome acessível, vira também
 * `aria-description`. Nome que já cabe inteiro não ganha dica; nome cortado, link e botão de ícone ganham.
 */
export function DicasDeTitulo() {
  const [dica, setDica] = useState<Dica | null>(null);

  useEffect(() => {
    let alvo: HTMLElement | null = null;
    let espera = 0;

    function esconder() {
      window.clearTimeout(espera);
      alvo = null;
      setDica(null);
    }

    function aoEntrar(evento: PointerEvent) {
      if (evento.pointerType === "touch") return;
      const elemento = (evento.target as Element | null)?.closest?.("[title], [data-dica]");
      if (!(elemento instanceof HTMLElement) || elemento === alvo) return;
      const texto = elemento.getAttribute("title") ?? elemento.dataset.dica ?? "";
      if (elemento.hasAttribute("title")) {
        elemento.dataset.dica = texto;
        elemento.removeAttribute("title");
        const temNome = elemento.hasAttribute("aria-label") || elemento.hasAttribute("aria-labelledby") || elemento.hasAttribute("aria-description");
        if (!temNome && semEspacos(elemento.textContent ?? "") !== semEspacos(texto)) elemento.setAttribute("aria-description", texto);
      }
      esconder();
      if (!texto.trim() || repeteOVisivel(elemento, texto)) return;
      alvo = elemento;
      espera = window.setTimeout(() => {
        if (alvo !== elemento || !elemento.isConnected) return;
        const caixa = elemento.getBoundingClientRect();
        const lado = caixa.top > 72 ? "cima" : "baixo";
        setDica({ texto: texto.trim(), x: caixa.left + caixa.width / 2, y: lado === "cima" ? caixa.top : caixa.bottom, lado });
      }, ATRASO);
    }

    function aoSair(evento: PointerEvent) {
      if (!alvo) return;
      const destino = evento.relatedTarget as Node | null;
      if (destino && alvo.contains(destino)) return;
      esconder();
    }

    document.addEventListener("pointerover", aoEntrar);
    document.addEventListener("pointerout", aoSair);
    document.addEventListener("pointerdown", esconder, true);
    document.addEventListener("keydown", esconder, true);
    window.addEventListener("scroll", esconder, true);
    window.addEventListener("blur", esconder);
    return () => {
      window.clearTimeout(espera);
      document.removeEventListener("pointerover", aoEntrar);
      document.removeEventListener("pointerout", aoSair);
      document.removeEventListener("pointerdown", esconder, true);
      document.removeEventListener("keydown", esconder, true);
      window.removeEventListener("scroll", esconder, true);
      window.removeEventListener("blur", esconder);
    };
  }, []);

  return dica ? createPortal(<Balao key={`${dica.texto}|${dica.x}|${dica.y}`} dica={dica} />, document.body) : null;
}
