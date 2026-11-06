"use client";

import { NavLink } from "@/components/layout/nav-link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { isAdminRole } from "@/lib/access-control";
import { buildNav, resolveHeaderContext, type NavPage } from "@/lib/navigation";
import { NavBadgePill, useNavBadges, type NavBadge } from "@/components/layout/nav-badges";
import { GuiaDaVistagem } from "@/components/operacoes-legais/vistagem/guia-vistagem";
import { moduloDaRota } from "@/lib/vistagem/guia";

/**
 * Cabeçalho do sistema: ícone e nome da funcionalidade (o único h1 da tela) e, quando ela tem mais de uma página,
 * as abas. No desktop fica numa linha só de 64 px (as telas de lista da Vistagem contam com essa altura); abaixo
 * de lg, as abas descem para uma segunda linha rolável.
 */
export function Header() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const badgeFor = useNavBadges();
  const nav = useMemo(() => buildNav(profile), [profile]);
  const contexto = resolveHeaderContext(pathname, nav);
  const { eyebrow, title, icon: Icon, tabs, activeHref } = contexto;
  const comAbas = tabs.length > 1;
  // Configurações do módulo: só para admin.
  const configuracoes = contexto.configuracoes && isAdminRole(profile) ? contexto.configuracoes : null;
  // Sem abas (a funcionalidade com uma página só liberada), o número da página vai ao lado do título.
  const badgeDaPagina = !comAbas && activeHref ? badgeFor(activeHref) : null;
  const resumo = badgeDaPagina?.soNoCabecalho && badgeDaPagina.value > 0 ? badgeDaPagina : null;
  // Abas da Vistagem: botão "Ver guia" (e o guia que abre sozinho na primeira visita a cada aba).
  const comGuia = moduloDaRota(pathname) !== null;

  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.07] bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
      <div className="flex flex-wrap items-stretch gap-x-4 px-4 sm:px-6 lg:flex-nowrap">
        <div className={cn("flex h-16 min-w-0 flex-1 items-center gap-3", comAbas && "lg:max-w-[22rem] lg:flex-none")}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#47cdd0]/15 text-[#347796]"
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            {eyebrow ? <p className="truncate text-xs font-medium text-[#347796]">{eyebrow}</p> : null}
            <div className="flex min-w-0 items-center gap-2">
              <h1 className={cn("truncate text-base font-semibold text-foreground", comAbas ? "sm:text-lg lg:text-base 2xl:text-lg" : "sm:text-lg")}>
                {title}
              </h1>
              {resumo ? <ResumoDaPagina badge={resumo} /> : null}
            </div>
          </div>
        </div>

        {comAbas ? (
          <>
            <span className="hidden h-6 w-px shrink-0 self-center bg-black/[0.08] lg:block" aria-hidden />
            <AbasDoCabecalho key={title} titulo={title} tabs={tabs} activeHref={activeHref} badgeFor={badgeFor} />
          </>
        ) : null}

        {configuracoes || comGuia ? (
          // Guia da Vistagem e, para o admin, a engrenagem das configurações: tomam o lugar do logo no canto direito.
          <div className="ml-auto flex h-16 shrink-0 items-center gap-2 lg:order-last">
            <span className="mr-1 hidden h-6 w-px bg-black/[0.08] lg:block" aria-hidden />
            {comGuia ? <GuiaDaVistagem /> : null}
            {configuracoes ? (
            <NavLink
              href={configuracoes.href}
              aria-current={configuracoes.ativa ? "page" : undefined}
              title={`${configuracoes.label} de ${title}`}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm font-medium outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                configuracoes.ativa
                  ? "border-[#347796] bg-[#347796] text-white"
                  : "border-[#dce9eb] bg-white text-[#285f7a] hover:border-[#347796]/40 hover:bg-[#f2f6f7]"
              )}
            >
              <Settings className="size-4" aria-hidden />
              <span className="hidden xl:inline">{configuracoes.label}</span>
            </NavLink>
            ) : null}
          </div>
        ) : (
          /* Com abas, o logo horizontal só volta em telas bem largas: no desktop comum, o espaço é das abas. */
          <div className={cn("ml-auto flex h-16 shrink-0 items-center gap-3", comAbas && "lg:hidden 2xl:flex")}>
          <span className="hidden h-6 w-px bg-black/[0.08] sm:block" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ORQESTRAI/identidade-visual/logos/orquestrai-logo-horizontal-ai-color.svg"
            alt="ORQESTRAI"
            className="hidden h-6 w-auto select-none object-contain sm:block"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ORQESTRAI/identidade-visual/logos/orquestrai-symbol-dark.svg"
            alt="ORQESTRAI"
            className="h-7 w-7 select-none object-contain sm:hidden"
          />
          </div>
        )}
      </div>
    </header>
  );
}

/** Número da página ao lado do título, com o que ele conta ("12 para vistar"). */
function ResumoDaPagina({ badge }: { badge: NavBadge }) {
  return (
    <span
      role="status"
      aria-label={badge.descricao}
      title={badge.descricao}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eaf2f5] px-2 py-0.5 text-xs font-medium text-[#285f7a]"
    >
      <span className="font-semibold tabular-nums">{badge.value > 99 ? "99+" : badge.value.toLocaleString("pt-BR")}</span>
      {badge.resumo ? <span className="hidden sm:inline">{badge.resumo}</span> : null}
    </span>
  );
}

/** Esmaece a borda da lista de abas quando há mais abas daquele lado. */
function mascaraDasBordas(antes: boolean, depois: boolean): string | undefined {
  if (!antes && !depois) return undefined;
  const inicio = antes ? "transparent 0, #000 2.5rem" : "#000 0";
  const fim = depois ? "#000 calc(100% - 2.5rem), transparent 100%" : "#000 100%";
  return `linear-gradient(to right, ${inicio}, ${fim})`;
}

/**
 * Abas da funcionalidade: a ativa em texto escuro e negrito, com o traço da marca na base do cabeçalho; as outras
 * neutras, com fundo leve no hover. O número de cada aba vem em pílula (no tom da marca na ativa). Com mais abas
 * do que cabem, a lista rola: as bordas esmaecem, setas aparecem para quem usa mouse e a aba ativa fica sempre à vista.
 */
function AbasDoCabecalho({
  titulo,
  tabs,
  activeHref,
  badgeFor,
}: {
  titulo: string;
  tabs: NavPage[];
  activeHref: string | null;
  badgeFor: (href: string) => NavBadge;
}) {
  const listaRef = useRef<HTMLDivElement>(null);
  const [bordas, setBordas] = useState({ antes: false, depois: false });

  const medir = useCallback(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const antes = lista.scrollLeft > 1;
    const depois = lista.scrollLeft + lista.clientWidth < lista.scrollWidth - 1;
    setBordas((atual) => (atual.antes === antes && atual.depois === depois ? atual : { antes, depois }));
  }, []);

  // A aba ativa sempre à vista (no celular e quando as abas não cabem).
  useEffect(() => {
    const lista = listaRef.current;
    const ativa = lista?.querySelector<HTMLElement>('[aria-current="page"]');
    if (lista && ativa) {
      const folga = 40;
      const inicio = ativa.offsetLeft - folga;
      const fim = ativa.offsetLeft + ativa.offsetWidth + folga;
      if (inicio < lista.scrollLeft) lista.scrollLeft = Math.max(0, inicio);
      else if (fim > lista.scrollLeft + lista.clientWidth) lista.scrollLeft = fim - lista.clientWidth;
    }
    medir();
  }, [activeHref, medir]);

  // Mudou a largura da tela ou chegaram os números das abas: mede de novo.
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(lista);
    if (lista.firstElementChild) observador.observe(lista.firstElementChild);
    return () => observador.disconnect();
  }, [medir]);

  const rolar = (sentido: 1 | -1) => {
    const lista = listaRef.current;
    lista?.scrollBy({ left: sentido * Math.max(160, lista.clientWidth * 0.6), behavior: "smooth" });
  };
  const mascara = mascaraDasBordas(bordas.antes, bordas.depois);

  return (
    <nav
      aria-label={`Páginas de ${titulo}`}
      className="relative order-last -mx-4 w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)] lg:order-none lg:mx-0 lg:w-auto lg:min-w-0 lg:flex-1"
    >
      <div
        ref={listaRef}
        onScroll={medir}
        className="overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: mascara, WebkitMaskImage: mascara }}
      >
        <LayoutGroup id={titulo}>
          <ul className="relative flex w-max items-stretch px-2.5 sm:px-4 lg:px-0">
            {tabs.map((tab) => {
              const active = tab.href === activeHref;
              return (
                <li key={tab.href} className="flex">
                  <NavLink
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-11 shrink-0 items-center px-0.5 text-sm outline-none lg:h-16",
                      active ? "text-[#04202f]" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors duration-150",
                        "group-focus-visible:ring-2 group-focus-visible:ring-[#47cdd0]",
                        !active && "group-hover:bg-[#f2f6f7]"
                      )}
                    >
                      {/* A cópia invisível em negrito reserva a largura: a aba não "pula" ao ficar ativa. */}
                      <span className="grid whitespace-nowrap">
                        <span className="invisible col-start-1 row-start-1 font-semibold" aria-hidden>
                          {tab.label}
                        </span>
                        <span className={cn("col-start-1 row-start-1", active ? "font-semibold" : "font-medium")}>{tab.label}</span>
                      </span>
                      <NavBadgePill badge={badgeFor(tab.href)} variant="tab" active={active} />
                    </span>
                    {active ? (
                      <motion.span
                        layoutId="aba-ativa-do-cabecalho"
                        className="absolute inset-x-1.5 bottom-0 h-[3px] rounded-t-[2px] bg-[#347796]"
                        transition={{ type: "spring", stiffness: 520, damping: 42 }}
                        aria-hidden
                      />
                    ) : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </LayoutGroup>
      </div>

      {/* Setas só para mouse: no toque, a lista rola com o dedo; no teclado, o foco leva a aba à vista. */}
      {bordas.antes ? <BotaoRolar lado="antes" onClick={() => rolar(-1)} /> : null}
      {bordas.depois ? <BotaoRolar lado="depois" onClick={() => rolar(1)} /> : null}
    </nav>
  );
}

function BotaoRolar({ lado, onClick }: { lado: "antes" | "depois"; onClick: () => void }) {
  const Icone = lado === "antes" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      onClick={onClick}
      className={cn(
        "absolute top-1/2 hidden size-7 -translate-y-1/2 items-center justify-center rounded-md border border-[#dce9eb] bg-white text-[#347796] shadow-[0_1px_2px_rgba(16,41,58,0.08)] transition-colors hover:bg-[#f2f6f7] pointer-fine:flex",
        lado === "antes" ? "left-1 lg:left-0" : "right-1 lg:right-0"
      )}
    >
      <Icone className="size-4" />
    </button>
  );
}
