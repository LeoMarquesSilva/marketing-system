"use client";

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/ferias/filters";
import { cn } from "@/lib/utils";
import { chaveNome } from "@/lib/vistagem/agendamento";
import type { PublicacaoResumo } from "@/lib/vistagem/types";
import { LogoGrupo, SeloArea } from "./marcas";
import { Selo } from "./ui";

/** "Vanessa Lanza Sellani" → "Vanessa Lanza": cabe na ficha; o nome inteiro fica no title. */
function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return partes.length > 2 ? `${partes[0]} ${partes[1]}` : nome.trim();
}

function Pessoa({ papel, nome, foto }: { papel: string; nome: string | null; foto: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-8 shrink-0 ring-1 ring-black/5" title={nome ?? undefined}>
        {foto ? <AvatarImage src={foto} alt="" /> : null}
        <AvatarFallback className="bg-white text-xs font-semibold text-[#315f73]">{nome ? getInitials(nome) : "?"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#285f7a]">{papel}</p>
        <p className="truncate text-sm font-medium text-foreground" title={nome ?? undefined}>
          {nome ? nomeCurto(nome) : "—"}
        </p>
      </div>
    </div>
  );
}

export function Celula({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium text-[#285f7a]">{rotulo}</p>
      <div className="mt-0.5 min-w-0">{children}</div>
    </div>
  );
}

/**
 * Ficha da pasta para o jurídico conferir antes de vistar: logo e nome do grupo, cliente, área, a pasta no VIOS e
 * as pessoas (advogado responsável e auxiliar, com foto). Se algo estiver errado, a ação ao lado
 * (Transferir área) resolve. `children` entra embaixo, no mesmo bloco (os dados do processo).
 */
export function FichaPasta({
  publicacao,
  auxiliar,
  fotos,
  acao,
  children,
}: {
  publicacao: PublicacaoResumo;
  /** Auxiliar da pasta no VIOS (o revisor sugerido do Prazo). */
  auxiliar: string | null;
  fotos: Record<string, string>;
  acao?: ReactNode;
  children?: ReactNode;
}) {
  const area = publicacao.escritorioResponsavel;
  const foto = (nome: string | null) => (nome ? fotos[chaveNome(nome)] ?? null : null);
  return (
    <div className="@container space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <LogoGrupo grupo={publicacao.grupoCliente} tamanho="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
            {area ? <SeloArea area={area} /> : <Selo tom="neutro">Sem área</Selo>}
            {publicacao.demandaRisco ? (
              <Selo tom="perigo" icone={ShieldAlert}>
                Demanda de risco
              </Selo>
            ) : null}
          </p>
          <p className="truncate text-base font-semibold text-foreground" title={publicacao.grupoCliente ?? undefined}>
            {publicacao.grupoCliente ?? "Sem grupo"}
          </p>
          {publicacao.cliente && publicacao.cliente !== publicacao.grupoCliente ? (
            <p className="truncate text-xs text-muted-foreground" title={publicacao.cliente}>
              {publicacao.cliente}
            </p>
          ) : null}
        </div>
        {acao}
      </div>
      <div className="grid gap-x-4 gap-y-3 rounded-md border border-[#c9dde6] bg-[#e9f2f6] px-3 py-2.5 @md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Celula rotulo="Pasta no VIOS">
          {publicacao.pastaCi ? (
            <>
              <p className="tabular-nums text-sm font-semibold text-foreground">CI {publicacao.pastaCi}</p>
              <p className="truncate text-[11px] text-muted-foreground" title={[publicacao.pastaVinculo, publicacao.situacaoProcesso].filter(Boolean).join(" · ")}>
                {[publicacao.pastaVinculo, publicacao.situacaoProcesso].filter(Boolean).join(" · ") || "—"}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem pasta</p>
          )}
        </Celula>
        <Pessoa papel="Advogado responsável" nome={publicacao.advogadoResponsavel} foto={foto(publicacao.advogadoResponsavel)} />
        <Pessoa papel="Auxiliar da pasta" nome={auxiliar} foto={foto(auxiliar)} />
      </div>
      {children}
    </div>
  );
}
