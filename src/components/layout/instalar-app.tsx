"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, Menu, Share, SquarePlus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EVENTO_INSTALACAO,
  instrucaoManualDeInstalacao,
  registrarServiceWorkerDoApp,
  rodandoComoApp,
  type InstrucaoManual,
} from "@/lib/pwa";

/** navegador = Chrome/Edge abrem a própria janela de instalação; o resto mostra o modal. */
export type ModoInstalacao = "navegador" | InstrucaoManual;

function assinar(avisar: () => void): () => void {
  const janela = window.matchMedia("(display-mode: standalone)");
  window.addEventListener(EVENTO_INSTALACAO, avisar);
  janela.addEventListener("change", avisar);
  return () => {
    window.removeEventListener(EVENTO_INSTALACAO, avisar);
    janela.removeEventListener("change", avisar);
  };
}

function modoAtual(): ModoInstalacao | null {
  // Já instalado e aberto como app: nada a oferecer.
  if (rodandoComoApp()) return null;
  if (window.__orqestraiInstalar) return "navegador";
  return instrucaoManualDeInstalacao();
}

function modoNoServidor(): ModoInstalacao | null {
  return null;
}

/**
 * Botão "Instalar o ORQESTRAI": `modo` é null quando o navegador não deixa
 * instalar ou o app já está instalado (o Chrome para de mandar o convite).
 */
export function useInstalarApp() {
  const modo = useSyncExternalStore(assinar, modoAtual, modoNoServidor);
  const [instrucoesAbertas, setInstrucoesAbertas] = useState(false);

  const instalar = useCallback(() => {
    const convite = window.__orqestraiInstalar;
    if (convite) {
      // prompt() precisa sair direto do clique, sem await antes.
      void convite.prompt().then(async () => {
        await convite.userChoice;
        // Cada convite serve uma vez; se a pessoa recusou, o Chrome manda outro depois.
        window.__orqestraiInstalar = null;
        window.dispatchEvent(new Event(EVENTO_INSTALACAO));
      });
      return;
    }
    if (instrucaoManualDeInstalacao()) setInstrucoesAbertas(true);
  }, []);

  return { modo, instalar, instrucoesAbertas, setInstrucoesAbertas };
}

/** Registra o service worker do site (página offline + push) em todas as telas do sistema. */
export function ServiceWorkerDoApp() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    registrarServiceWorkerDoApp().catch((erro: unknown) => {
      console.warn("[pwa] service worker não registrou", erro);
    });
  }, []);
  return null;
}

interface Passo {
  icone: LucideIcon;
  texto: ReactNode;
  dica?: string;
}

const PASSOS: Record<InstrucaoManual, { titulo: string; passos: Passo[] }> = {
  ios: {
    titulo: "Instalar o ORQESTRAI no iPhone ou iPad",
    passos: [
      {
        icone: Share,
        texto: (
          <>
            Toque em <strong>Compartilhar</strong> no Safari.
          </>
        ),
        dica: "Não aparece na barra? Toque em ••• primeiro.",
      },
      {
        icone: SquarePlus,
        texto: (
          <>
            Escolha <strong>Adicionar à Tela de Início</strong>.
          </>
        ),
        dica: "Se não estiver na lista, role as opções para baixo.",
      },
      {
        icone: Check,
        texto: (
          <>
            Toque em <strong>Adicionar</strong>. O ícone do ORQESTRAI fica na tela de início.
          </>
        ),
      },
    ],
  },
  "safari-mac": {
    titulo: "Instalar o ORQESTRAI no Mac",
    passos: [
      {
        icone: Menu,
        texto: (
          <>
            No menu <strong>Arquivo</strong> do Safari, escolha <strong>Adicionar ao Dock</strong>.
          </>
        ),
        dica: "Também dá pelo botão Compartilhar do Safari.",
      },
      {
        icone: Check,
        texto: (
          <>
            Confirme em <strong>Adicionar</strong>. O ORQESTRAI abre em janela própria, pelo Dock ou
            pelo Launchpad.
          </>
        ),
      },
    ],
  },
};

/** Modal centralizado para quem não tem a janela de instalação do navegador (iPhone, Safari do Mac). */
export function InstrucoesInstalacaoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const instrucao = useSyncExternalStore(assinar, instrucaoManualDeInstalacao, () => null);
  const conteudo = PASSOS[instrucao ?? "ios"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 border-b border-[#e6eef0] px-6 py-4 pr-14 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/pwa/icon-192.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-[10px] shadow-[0_4px_14px_rgba(3,32,47,0.25)]"
            aria-hidden
          />
          <div className="min-w-0 space-y-1">
            <DialogTitle className="text-base leading-snug">{conteudo.titulo}</DialogTitle>
            <DialogDescription className="text-xs">
              Ganha ícone próprio e abre em tela cheia, como um aplicativo.
            </DialogDescription>
          </div>
        </DialogHeader>

        <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {conteudo.passos.map((passo, indice) => (
            <li key={indice} className="flex gap-3.5">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#dce9eb] bg-[#f3f9fa] text-[#285f7a]">
                <passo.icone className="h-[18px] w-[18px]" aria-hidden />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#347796] text-[11px] font-semibold leading-none text-white">
                  {indice + 1}
                </span>
              </span>
              <div className="min-w-0 pt-0.5 text-sm leading-relaxed text-[#1c1c1c]">
                <p>{passo.texto}</p>
                {passo.dica && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{passo.dica}</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        <DialogFooter className="border-t border-[#e6eef0] px-6 py-4">
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
