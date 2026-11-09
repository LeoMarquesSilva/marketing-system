"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { chaveNome } from "@/lib/vistagem/agendamento";
import { AvatarPessoa } from "./combobox-busca";
import { LogoGrupo, SeloArea } from "./marcas";

const TOM_ICONE = {
  marca: "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/30",
  alerta: "bg-amber-50 text-amber-800 ring-amber-200",
  perigo: "bg-red-50 text-red-700 ring-red-200",
} as const;

/**
 * Modal de ação da Vistagem, centralizado como manda o DESIGN.md: cabeçalho com ícone, título e descrição, corpo que
 * rola e rodapé fixo com as ações. `aviso` vai à esquerda do rodapé (o que falta para liberar o botão principal).
 */
export function DialogoAcao({
  aberto,
  onFechar,
  ocupado,
  icone: Icone,
  tom = "marca",
  titulo,
  descricao,
  aviso,
  rodape,
  children,
  className,
}: {
  aberto: boolean;
  onFechar: () => void;
  ocupado: boolean;
  icone?: LucideIcon;
  tom?: keyof typeof TOM_ICONE;
  titulo: ReactNode;
  descricao: ReactNode;
  /** Texto curto à esquerda do rodapé. */
  aviso?: ReactNode;
  rodape: ReactNode;
  children: ReactNode;
  /** Ex.: outra largura para um modal com mais campos. */
  className?: string;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && !ocupado && onFechar()}>
      <DialogContent
        className={cn("flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 focus:outline-none sm:max-w-xl", className)}
        showCloseButton={!ocupado}
        // O foco fica no próprio modal: no primeiro cartão de escolha, ele parecia já escolhido.
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          (evento.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogHeader className="flex-row items-start gap-3 border-b border-[#e6eef0] px-6 py-4 pr-14 text-left">
          {Icone ? (
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg ring-1", TOM_ICONE[tom])} aria-hidden>
              <Icone className="size-5" />
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            <DialogTitle className="text-lg leading-tight text-[#10293a]">{titulo}</DialogTitle>
            <DialogDescription className="text-sm leading-snug">{descricao}</DialogDescription>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-4">
          <div className="min-w-0 flex-1 text-xs text-muted-foreground">{aviso}</div>
          <div className="flex flex-wrap items-center justify-end gap-2">{rodape}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * De quem é a publicação que está no modal: logo e nome do grupo, área, número do processo e quem vistou (com
 * foto), que é quem recebe a devolução.
 */
export function ContextoDoProcesso({
  grupo,
  cliente,
  area,
  processo,
  pessoa,
  papel = "Vistada por",
  fotos,
}: {
  grupo: string | null;
  cliente: string | null;
  area: string | null;
  processo: string;
  pessoa: string | null;
  papel?: string;
  fotos: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-[#dce9eb] bg-[#f7fbfc] px-3.5 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <LogoGrupo grupo={grupo} tamanho="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground" title={grupo ?? undefined}>
            {grupo ?? cliente ?? "Sem grupo"}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums">{processo}</span>
            {area ? <SeloArea area={area} /> : null}
          </p>
        </div>
      </div>
      {pessoa ? (
        <div className="flex min-w-0 items-center gap-2 border-[#dce9eb] sm:border-l sm:pl-4">
          <AvatarPessoa nome={pessoa} foto={fotos[chaveNome(pessoa)]} className="size-8" />
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] font-medium uppercase text-[#285f7a]">{papel}</p>
            <p className="truncate text-sm font-medium text-foreground" title={pessoa}>
              {pessoa}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface OpcaoEmCartao {
  valor: string;
  rotulo: string;
  descricao: string;
  icone: LucideIcon;
}

/**
 * Escolha única em cartões (no lugar de um dropdown com poucas opções): ícone, nome e uma linha do que significa.
 * Setas do teclado andam entre os cartões, como num grupo de rádio.
 */
export function EscolhaEmCartoes({
  rotulo,
  opcoes,
  valor,
  onChange,
  desabilitado = false,
}: {
  rotulo: string;
  opcoes: OpcaoEmCartao[];
  valor: string;
  onChange: (valor: string) => void;
  desabilitado?: boolean;
}) {
  const grupo = useRef<HTMLDivElement>(null);

  function navegar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const passo = evento.key === "ArrowDown" || evento.key === "ArrowRight" ? 1 : evento.key === "ArrowUp" || evento.key === "ArrowLeft" ? -1 : 0;
    if (!passo) return;
    evento.preventDefault();
    const proximo = (indice + passo + opcoes.length) % opcoes.length;
    onChange(opcoes[proximo].valor);
    grupo.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[proximo]?.focus();
  }

  return (
    <div ref={grupo} role="radiogroup" aria-label={rotulo} className="grid gap-2">
      {opcoes.map((opcao, indice) => {
        const escolhida = opcao.valor === valor;
        const Icone = opcao.icone;
        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={escolhida}
            // Só o escolhido (ou o primeiro, sem escolha) entra no Tab; as setas fazem o resto.
            tabIndex={escolhida || (!valor && indice === 0) ? 0 : -1}
            disabled={desabilitado}
            onClick={() => onChange(opcao.valor)}
            onKeyDown={(evento) => navegar(evento, indice)}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30 disabled:opacity-60",
              escolhida ? "border-[#47cdd0] bg-[#f2fbfb] shadow-[0_0_0_1px_#47cdd0]" : "border-[#dce9eb] bg-white hover:border-[#3e84a8]/40 hover:bg-[#f7fbfc]"
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-md ring-1 transition-colors",
                escolhida ? "bg-[#347796] text-white ring-[#347796]" : "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/25"
              )}
              aria-hidden
            >
              <Icone className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-semibold", escolhida ? "text-[#183f50]" : "text-foreground")}>{opcao.rotulo}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{opcao.descricao}</span>
            </span>
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                escolhida ? "border-[#347796] bg-[#347796] text-white" : "border-[#c9dde6] bg-white text-transparent"
              )}
              aria-hidden
            >
              <Check className="size-3" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
