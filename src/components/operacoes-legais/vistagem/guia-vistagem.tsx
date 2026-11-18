"use client";

/* eslint-disable react-hooks/set-state-in-effect -- O guia acompanha a geometria do DOM e a aba aberta em efeitos. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleHelp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { guiasVistos, moduloDaRota, type ModuloGuia, type PassoGuia } from "@/lib/vistagem/guia";
import { PASSOS_GUIA, TITULO_GUIA } from "@/lib/vistagem/guia-passos";

/** Acima da sidebar e do cabeçalho; o guia sai do stacking context do conteúdo pelo portal. */
const GUIA_Z = 1000;
const CHAVE_LOCAL = "vistagem.guias";
/** Quanto o guia espera, no máximo, a tela carregar (fila, publicação aberta) antes de abrir assim mesmo. */
const ESPERA_TELA_MS = 10000;
/** A tela "assentou" quando os elementos dos passos param de aparecer por este tempo. */
const TELA_ASSENTADA_MS = 1200;

function lerLocal(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_LOCAL) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

/** Sem acesso à Vistagem (401/403): o guia não abre. */
const SEM_ACESSO = Symbol("sem-acesso");
/**
 * Guias vistos segundo o banco, lidos uma vez por usuário e carga da página: cada leitura é uma função na Vercel, e a
 * troca de aba pedia de novo. Só a resposta boa fica guardada; falha ou sem acesso pergunta outra vez na próxima aba.
 */
let vistosDoBanco: { usuario: string; resposta: Promise<unknown> } | null = null;

function lerVistosDoBanco(usuario: string): Promise<unknown> {
  if (vistosDoBanco?.usuario === usuario) return vistosDoBanco.resposta;
  const esquecer = () => {
    if (vistosDoBanco?.usuario === usuario) vistosDoBanco = null;
  };
  const resposta = (async () => {
    try {
      const retorno = await authFetch("/api/operacoes-legais/vistagem/guia", { cache: "no-store" });
      if (retorno.ok) return ((await retorno.json()) as { vistos?: unknown }).vistos ?? null;
      esquecer();
      return retorno.status === 401 || retorno.status === 403 ? SEM_ACESSO : null;
    } catch {
      // Sem resposta do servidor: vale o que o navegador guardou.
      esquecer();
      return null;
    }
  })();
  vistosDoBanco = { usuario, resposta };
  return resposta;
}

function gravarLocal(modulo: ModuloGuia) {
  try {
    window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ ...lerLocal(), [modulo]: new Date().toISOString() }));
  } catch {
    // Sem armazenamento no navegador: o banco guarda (ou o guia abre de novo na próxima vez).
  }
}

/** O elemento visível do passo: o alvo, senão a alternativa; null = cartão no meio da tela. */
function elementoDoPasso(passo: PassoGuia | undefined): HTMLElement | null {
  if (!passo) return null;
  for (const alvo of [passo.alvo, passo.alternativa]) {
    if (!alvo) continue;
    const visivel = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${alvo}"]`)).find((el) => {
      const caixa = el.getBoundingClientRect();
      return caixa.width > 0 && caixa.height > 0;
    });
    if (visivel) return visivel;
  }
  return null;
}

function useCaixaDoPasso(passo: PassoGuia | undefined, ativo: boolean) {
  const [caixa, setCaixa] = useState<DOMRect | null>(null);
  // Elemento destacado agora: se a tela o troca (a lista recarrega), o guia acha o novo e rola até ele.
  const atual = useRef<HTMLElement | null>(null);

  const medir = useCallback(
    (rolar: boolean) => {
      if (!ativo) return setCaixa(null);
      const el = elementoDoPasso(passo);
      if (!el) {
        atual.current = null;
        return setCaixa(null);
      }
      if (rolar || el !== atual.current) {
        const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: semMovimento ? "auto" : "smooth" });
      }
      atual.current = el;
      const nova = el.getBoundingClientRect();
      setCaixa((antiga) =>
        nova.width > 0 && nova.height > 0
          ? antiga && antiga.x === nova.x && antiga.y === nova.y && antiga.width === nova.width && antiga.height === nova.height
            ? antiga
            : nova
          : null
      );
    },
    [passo, ativo]
  );

  useLayoutEffect(() => {
    medir(true);
  }, [medir]);

  useEffect(() => {
    if (!ativo) return;
    const remedir = () => medir(false);
    window.addEventListener("resize", remedir);
    window.addEventListener("scroll", remedir, true);
    // A rolagem suave termina depois, e a tela pode trocar ou abrir o elemento (lista que recarrega, publicação que
    // abre): mede de novo enquanto o passo estiver aberto.
    const vigia = window.setInterval(remedir, 500);
    return () => {
      window.removeEventListener("resize", remedir);
      window.removeEventListener("scroll", remedir, true);
      window.clearInterval(vigia);
    };
  }, [ativo, medir]);

  return caixa;
}

function Recorte({ caixa }: { caixa: DOMRect | null }) {
  if (!caixa) return <div className="fixed inset-0 bg-[#04121b]/70" style={{ zIndex: GUIA_Z }} aria-hidden />;
  const folga = 8;
  const x = Math.max(0, caixa.left - folga);
  const y = Math.max(0, caixa.top - folga);
  const w = Math.min(window.innerWidth - x, caixa.width + folga * 2);
  const h = Math.min(window.innerHeight - y, caixa.height + folga * 2);
  return (
    <svg className="fixed inset-0 h-full w-full" style={{ zIndex: GUIA_Z }} aria-hidden>
      <defs>
        <mask id="guia-vistagem-recorte">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={10} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(4,18,27,0.70)" mask="url(#guia-vistagem-recorte)" />
      <rect x={x} y={y} width={w} height={h} rx={10} fill="none" stroke="#47cdd0" strokeWidth={2} />
    </svg>
  );
}

function CartaoDoGuia({
  titulo,
  passo,
  indice,
  total,
  caixa,
  onVoltar,
  onAvancar,
  onFechar,
}: {
  titulo: string;
  passo: PassoGuia;
  indice: number;
  total: number;
  caixa: DOMRect | null;
  onVoltar: () => void;
  onAvancar: () => void;
  onFechar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [posicao, setPosicao] = useState<React.CSSProperties>({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
  const ultimo = indice === total - 1;

  useLayoutEffect(() => {
    const cartao = ref.current;
    if (!caixa || !cartao) {
      setPosicao({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      return;
    }
    const margem = 16;
    const distancia = 14;
    const largura = cartao.offsetWidth;
    const altura = cartao.offsetHeight;
    const cabeAbaixo = caixa.bottom + distancia + altura <= window.innerHeight - margem;
    const cabeAcima = caixa.top - distancia - altura >= margem;
    const cabeDireita = caixa.right + distancia + largura <= window.innerWidth - margem;
    const cabeEsquerda = caixa.left - distancia - largura >= margem;
    let top: number;
    let left: number;
    if (cabeAbaixo || cabeAcima) {
      top = cabeAbaixo ? caixa.bottom + distancia : caixa.top - distancia - altura;
      left = caixa.left + caixa.width / 2 - largura / 2;
    } else if (cabeDireita || cabeEsquerda) {
      // Alvo alto (coluna, painel): o cartão vai ao lado, na altura do topo visível.
      left = cabeDireita ? caixa.right + distancia : caixa.left - distancia - largura;
      top = Math.max(caixa.top, margem);
    } else {
      // Alvo que ocupa quase a tela toda: o cartão fica por cima, no canto de baixo.
      top = window.innerHeight - altura - margem;
      left = window.innerWidth - largura - margem;
    }
    top = Math.min(Math.max(top, margem), window.innerHeight - altura - margem);
    left = Math.min(Math.max(left, margem), window.innerWidth - largura - margem);
    setPosicao({ top, left, transform: "none" });
  }, [caixa, passo.id]);

  return (
    <div
      ref={ref}
      className="fixed w-[min(400px,calc(100vw-2rem))] rounded-xl border border-white/10 bg-[#10293a] p-5 text-white shadow-2xl"
      style={{ zIndex: GUIA_Z + 1, ...posicao }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guia-vistagem-titulo"
      aria-describedby="guia-vistagem-texto"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#47cdd0]/20" aria-hidden>
            <CircleHelp className="size-4 text-[#9fe7e8]" />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/55">{titulo}</p>
            <p className="text-[11px] text-white/45">
              Passo {indice + 1} de {total}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="rounded-md p-1 text-white/55 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
          aria-label="Fechar o guia"
        >
          <X className="size-4" />
        </button>
      </div>
      <h2 id="guia-vistagem-titulo" className="text-base font-semibold leading-snug">
        {passo.titulo}
      </h2>
      <p id="guia-vistagem-texto" className="mt-2 text-sm leading-relaxed text-white/80">
        {passo.texto}
      </p>
      <div className="mt-5 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onFechar} className="text-white/60 hover:bg-white/10 hover:text-white">
          {ultimo ? "Fechar" : "Pular"}
        </Button>
        <div className="flex gap-2">
          {indice > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={onVoltar} className="gap-1 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <ArrowLeft className="size-3.5" />
              Voltar
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={onAvancar} autoFocus className="gap-1 bg-[#47cdd0] text-[#04202f] hover:bg-[#6fd9db]">
            {ultimo ? "Começar a usar" : "Próximo"}
            {ultimo ? null : <ArrowRight className="size-3.5" />}
          </Button>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-1" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={cn("h-1.5 rounded-full transition-all", i === indice ? "w-5 bg-[#47cdd0]" : "w-1.5 bg-white/25")} />
        ))}
      </div>
    </div>
  );
}

/**
 * Guia da aba aberta da Vistagem: o botão "Ver guia" do cabeçalho e o passo a passo por cima da tela. Abre sozinho
 * na primeira vez que a pessoa entra na aba (o banco e o navegador guardam quem já viu, até o fim ou pulando).
 */
export function GuiaDaVistagem() {
  const pathname = usePathname();
  const usuario = useAuth().user?.id ?? null;
  const modulo = moduloDaRota(pathname);
  const passos = modulo ? PASSOS_GUIA[modulo] : [];
  const [ativo, setAtivo] = useState(false);
  const [indice, setIndice] = useState(0);
  const [montado, setMontado] = useState(false);
  const passo = passos[indice];
  const caixa = useCaixaDoPasso(passo, ativo);

  useEffect(() => setMontado(true), []);

  // Troca de aba: fecha o guia aberto e, se for a primeira vez nesta aba, abre o dela quando a tela carregar.
  useEffect(() => {
    setAtivo(false);
    setIndice(0);
    if (!usuario || !modulo || !PASSOS_GUIA[modulo].length) return;
    let cancelado = false;
    let espera: number | undefined;
    (async () => {
      // Já visto neste navegador: nem pergunta ao banco.
      if (guiasVistos(lerLocal())[modulo]) return;
      const doBanco = await lerVistosDoBanco(usuario);
      if (doBanco === SEM_ACESSO) return;
      if (cancelado || guiasVistos(doBanco, lerLocal())[modulo]) return;
      // Abre quando a tela assenta: os elementos dos passos param de aparecer (a fila carrega, a primeira publicação
      // abre). Sem isso, os passos da publicação aberta caíam no meio da tela enquanto ela ainda carregava.
      const inicio = Date.now();
      let anterior = -1;
      let estavelDesde = Date.now();
      const abrirQuandoPronto = () => {
        if (cancelado) return;
        const achados = PASSOS_GUIA[modulo].filter((item) => elementoDoPasso(item)).length;
        // "Carregando…" das telas da Vistagem (Carregando, em ui.tsx): ainda vem coisa.
        const carregando = Boolean(document.querySelector('main [role="status"] .animate-spin'));
        if (achados !== anterior || carregando) {
          anterior = achados;
          estavelDesde = Date.now();
        }
        const assentou = achados > 0 && Date.now() - estavelDesde >= TELA_ASSENTADA_MS;
        if (assentou || Date.now() - inicio > ESPERA_TELA_MS) {
          setIndice(0);
          setAtivo(true);
          return;
        }
        espera = window.setTimeout(abrirQuandoPronto, 300);
      };
      espera = window.setTimeout(abrirQuandoPronto, 500);
    })();
    return () => {
      cancelado = true;
      if (espera) window.clearTimeout(espera);
    };
  }, [modulo, usuario]);

  const fechar = useCallback(() => {
    setAtivo(false);
    if (!modulo) return;
    gravarLocal(modulo);
    void authFetch("/api/operacoes-legais/vistagem/guia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo }),
    }).catch(() => {
      // O navegador já guardou; o guia não abre de novo aqui.
    });
  }, [modulo]);

  const avancar = useCallback(() => {
    if (indice >= passos.length - 1) return fechar();
    setIndice((atual) => atual + 1);
  }, [indice, passos.length, fechar]);

  const voltar = useCallback(() => setIndice((atual) => Math.max(0, atual - 1)), []);

  useEffect(() => {
    if (!ativo) return;
    const teclas = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") fechar();
      else if (evento.key === "ArrowRight") avancar();
      else if (evento.key === "ArrowLeft") voltar();
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, [ativo, avancar, voltar, fechar]);

  if (!modulo || !passos.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIndice(0);
          setAtivo(true);
        }}
        title={`Ver o guia de ${TITULO_GUIA[modulo]}`}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-[#dce9eb] bg-white px-2.5 text-sm font-medium text-[#285f7a] outline-none transition-colors hover:border-[#347796]/40 hover:bg-[#f2f6f7] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
      >
        <CircleHelp className="size-4" aria-hidden />
        <span className="hidden xl:inline">Ver guia</span>
        <span className="sr-only xl:hidden">Ver guia</span>
      </button>
      {montado && ativo && passo
        ? createPortal(
            <>
              <Recorte caixa={caixa} />
              <CartaoDoGuia
                titulo={`Guia · ${TITULO_GUIA[modulo]}`}
                passo={passo}
                indice={indice}
                total={passos.length}
                caixa={caixa}
                onVoltar={voltar}
                onAvancar={avancar}
                onFechar={fechar}
              />
            </>,
            document.body
          )
        : null}
    </>
  );
}
