"use client";

import { useId, useState, type ReactNode } from "react";
import { ExternalLink, FoldVertical, ShieldAlert, UnfoldVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/ferias/filters";
import { cn } from "@/lib/utils";
import { chaveNome } from "@/lib/vistagem/agendamento";
import type { PublicacaoResumo } from "@/lib/vistagem/types";
import { linkPastaVios } from "@/lib/vistagem/vios-links";
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

/** CI da pasta com o link para abri-la no VIOS. */
export function LinkPastaVios({ ci }: { ci: string }) {
  return (
    <a
      href={linkPastaVios(ci)}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir a pasta no VIOS (nova aba)"
      className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold tabular-nums text-[#347796] underline decoration-[#347796]/40 underline-offset-4 hover:text-[#285f7a] hover:decoration-[#285f7a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
    >
      CI {ci}
      <ExternalLink className="size-3.5" aria-hidden />
      <span className="sr-only">(abre a pasta no VIOS, em nova aba)</span>
    </a>
  );
}

const CHAVE_RECOLHIDA = "vistagem:ficha-recolhida";

/** Ficha aberta ou recolhida: começa aberta e a escolha vale para os próximos processos enquanto a aba estiver aberta. */
function useFichaRecolhida(): [boolean, () => void] {
  const [recolhida, setRecolhida] = useState(() => {
    try {
      return window.sessionStorage.getItem(CHAVE_RECOLHIDA) === "1";
    } catch {
      return false;
    }
  });
  function alternar() {
    setRecolhida((atual) => {
      try {
        window.sessionStorage.setItem(CHAVE_RECOLHIDA, atual ? "0" : "1");
      } catch {
        // Sem armazenamento (aba anônima): vale só para esta ficha.
      }
      return !atual;
    });
  }
  return [recolhida, alternar];
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
 * Com `resumo`, a ficha ganha o botão Recolher: o grupo fica no topo e o resto vira o resumo; `extra` (a síntese)
 * aparece aberta ou recolhida.
 */
export function FichaPasta({
  publicacao,
  auxiliar,
  fotos,
  acao,
  resumo,
  extra,
  children,
}: {
  publicacao: PublicacaoResumo;
  /** Auxiliar da pasta no VIOS (o revisor sugerido do Prazo). */
  auxiliar: string | null;
  fotos: Record<string, string>;
  acao?: ReactNode;
  /** O que fica no lugar da pasta e do processo com a ficha recolhida. */
  resumo?: ReactNode;
  /** Sempre visível, embaixo (a síntese do processo). */
  extra?: ReactNode;
  children?: ReactNode;
}) {
  const area = publicacao.escritorioResponsavel;
  const foto = (nome: string | null) => (nome ? fotos[chaveNome(nome)] ?? null : null);
  const [recolhidaEscolha, alternar] = useFichaRecolhida();
  const recolhida = Boolean(resumo) && recolhidaEscolha;
  const id = useId();
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
        {resumo ? (
          // Contornado como os outros botões da tela (Transferir área, Devolver), com o ícone na cor da marca.
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={!recolhida}
            aria-controls={id}
            onClick={alternar}
            title={recolhida ? "Mostrar pasta, processo, partes e advogados" : "Deixar só o resumo e dar mais espaço para a publicação"}
            className="border-[#b9d3dd] bg-white font-semibold text-[#285f7a] shadow-xs hover:border-[#47cdd0] hover:bg-[#e8f8f8] hover:text-[#183f50] [&_svg]:text-[#347796]"
          >
            {recolhida ? <UnfoldVertical /> : <FoldVertical />}
            {recolhida ? "Expandir ficha" : "Recolher ficha"}
          </Button>
        ) : null}
      </div>
      {recolhida ? (
        <div id={id}>{resumo}</div>
      ) : (
        <div id={id} className="space-y-3">
          <div className="grid gap-x-4 gap-y-3 rounded-md border border-[#c9dde6] bg-[#e9f2f6] px-3 py-2.5 @md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Celula rotulo="Pasta no VIOS">
              {publicacao.pastaCi ? (
                <>
                  <LinkPastaVios ci={publicacao.pastaCi} />
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
      )}
      {extra}
    </div>
  );
}
