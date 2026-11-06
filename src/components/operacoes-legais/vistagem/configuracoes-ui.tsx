import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Painel } from "./ui";

/** Peças das Configurações da Vistagem usadas por mais de um cartão. */

export function Interruptor({ ligado, onChange, rotulo, desabilitado = false }: { ligado: boolean; onChange: (ligado: boolean) => void; rotulo: string; desabilitado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={() => onChange(!ligado)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60 focus-visible:ring-offset-2",
        ligado ? "bg-[#347796]" : "bg-slate-300"
      )}
    >
      <span className={cn("inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-150", ligado ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

/** Cartão de uma regra editável: ícone, título, explicação, o valor em vigor e as ações. */
export function CartaoEditavel({
  icone: Icone,
  titulo,
  descricao,
  acao,
  rodape,
  children,
  tour,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: ReactNode;
  acao?: ReactNode;
  rodape?: ReactNode;
  children: ReactNode;
  /** data-tour do cartão (guia da Vistagem). */
  tour?: string;
}) {
  return (
    <Painel className="flex flex-col" data-tour={tour}>
      <div className="flex items-start gap-3 border-b border-[#e6eef0] px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#e8f8f8] text-[#347796]" aria-hidden>
          <Icone className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
        </div>
        {acao}
      </div>
      <div className="flex-1 px-4 py-3">{children}</div>
      {rodape ? <div className="border-t border-[#eef3f5] bg-[#f7fbfc] px-4 py-2">{rodape}</div> : null}
    </Painel>
  );
}
