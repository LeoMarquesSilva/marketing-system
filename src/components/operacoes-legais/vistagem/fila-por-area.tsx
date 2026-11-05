"use client";

import type { ReactNode, Ref } from "react";
import { Landmark, PanelLeftClose, Search, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chaveNome } from "@/lib/vistagem/agendamento";
import type { PublicacaoResumo } from "@/lib/vistagem/types";
import { IconeArea } from "./marcas";
import { contarPor, tribunalDe } from "./publicacao-ui";
import { Painel, Vazio } from "./ui";

/**
 * Fila de um processo por vez (Conferência e Check): agrupada por área e, no Trabalhista, também por tribunal.
 * A Conferência tem a mesma fila escrita dentro dela; esta é a versão compartilhada, para as duas usarem.
 */

export const SEM_AREA = "Sem área";

export const areaDaPublicacao = (item: { publicacao: PublicacaoResumo }) => item.publicacao.escritorioResponsavel?.trim() || SEM_AREA;

/** No Trabalhista as publicações se separam também pelo tribunal (TRT2, TRT15, TST…). */
const separaPorTribunal = (area: string) => chaveNome(area) === "TRABALHISTA";

export interface GrupoDaFila<T> {
  area: string;
  itens: T[];
  /** Só no Trabalhista: os itens da área por tribunal. */
  tribunais: { tribunal: string; itens: T[] }[] | null;
}

/** Itens por área (ordem alfabética) e, no Trabalhista, por tribunal; dentro de cada um, a ordem da lista. */
export function agruparPorArea<T extends { publicacao: PublicacaoResumo }>(itens: T[]): GrupoDaFila<T>[] {
  return contarPor(itens, areaDaPublicacao).map(([area]) => {
    const daArea = itens.filter((item) => areaDaPublicacao(item) === area);
    return {
      area,
      itens: daArea,
      tribunais: separaPorTribunal(area)
        ? contarPor(daArea, (item) => tribunalDe(item.publicacao)).map(([tribunal]) => ({
            tribunal,
            itens: daArea.filter((item) => tribunalDe(item.publicacao) === tribunal),
          }))
        : null,
    };
  });
}

/** A ordem da fila (área › tribunal): é por ela que as setas andam para a anterior e a próxima. */
export function ordemDaFila<T>(grupos: GrupoDaFila<T>[]): T[] {
  return grupos.flatMap((grupo) => (grupo.tribunais ? grupo.tribunais.flatMap((porTribunal) => porTribunal.itens) : grupo.itens));
}

/**
 * O painel da fila: topo com "Fila · N" e o botão de recolher (ou, buscando, o que foi buscado e quantos achou) e os
 * grupos com o título fixo ao rolar. `linha` desenha cada item (um botão com aria-current na aberta).
 */
export function FilaPorArea<T extends { publicacao: PublicacaoResumo }>({
  grupos,
  total,
  linha,
  busca,
  abertaForaDosResultados,
  onLimparBusca,
  onRecolher,
  rotulo,
  className,
  rolagem,
}: {
  grupos: GrupoDaFila<T>[];
  /** Quantos itens a fila mostra (no topo). */
  total: number;
  linha: (item: T) => ReactNode;
  /** Texto da busca; vazio é a fila normal. */
  busca: string;
  /** Buscando, o processo aberto ao lado não está nos resultados: a fila avisa. */
  abertaForaDosResultados: boolean;
  onLimparBusca: () => void;
  onRecolher: () => void;
  rotulo: string;
  className?: string;
  /** A área que rola (para a fila acompanhar a publicação aberta). */
  rolagem?: Ref<HTMLDivElement>;
}) {
  const buscando = busca.trim() !== "";
  return (
    <Painel aria-label={rotulo} data-tour="ck-fila" className={cn("lg:flex lg:h-full lg:flex-col", className)}>
      {buscando ? (
        // Na busca, o topo da fila diz o que foi buscado e quantos achou; o X limpa e a fila volta ao normal.
        <div className="flex items-center gap-2 border-b border-[#e6eef0] bg-[#f2fbfb] px-4 py-2">
          <Search className="size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-xs text-[#285f7a]" aria-live="polite">
            <span className="font-semibold tabular-nums">{total}</span> {total === 1 ? "resultado" : "resultados"} para{" "}
            <span className="font-semibold">“{busca.trim()}”</span>
          </span>
          <Button type="button" size="icon-xs" variant="ghost" onClick={onLimparBusca} aria-label="Limpar a busca" title="Limpar a busca">
            <X />
          </Button>
        </div>
      ) : (
        <div className="hidden items-center gap-2 border-b border-[#e6eef0] px-4 py-2 lg:flex">
          <span className="flex-1 text-xs font-medium text-muted-foreground">
            Fila <span className="tabular-nums">· {total}</span>
          </span>
          <Button type="button" size="icon-xs" variant="ghost" onClick={onRecolher} aria-label="Recolher a fila" title="Recolher a fila">
            <PanelLeftClose />
          </Button>
        </div>
      )}
      <div ref={rolagem} className="max-h-[70vh] overflow-auto lg:max-h-none lg:flex-1">
        {buscando && !total ? (
          <Vazio icone={SearchX} titulo="Nada encontrado." className="py-8">
            Tente parte do nome do grupo, da parte ou o número do processo.
          </Vazio>
        ) : null}
        {buscando && total > 0 && abertaForaDosResultados ? (
          // O processo aberto ao lado não está nos resultados: avisa, para não parecer que a busca o achou.
          <p className="border-b border-[#eef3f5] px-4 py-2 text-[11px] text-muted-foreground">O processo aberto ao lado não está nos resultados. Escolha um da lista.</p>
        ) : null}
        {grupos.map((grupo) => (
          <section key={grupo.area} aria-label={grupo.area}>
            <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2 text-xs font-semibold text-[#285f7a]">
              <IconeArea area={grupo.area} />
              <span className="truncate">{grupo.area}</span>
              <span className="font-normal tabular-nums text-muted-foreground">{grupo.itens.length}</span>
            </h3>
            {grupo.tribunais
              ? grupo.tribunais.map((porTribunal) => (
                  <section key={porTribunal.tribunal} aria-label={`${grupo.area} · ${porTribunal.tribunal}`}>
                    <p className="flex items-center gap-1.5 border-b border-[#eef3f5] px-4 py-1.5 text-[11px] font-semibold text-muted-foreground">
                      <Landmark className="size-3.5 text-[#3e84a8]" aria-hidden />
                      {porTribunal.tribunal}
                      <span className="font-normal tabular-nums">{porTribunal.itens.length}</span>
                    </p>
                    <Linhas itens={porTribunal.itens} linha={linha} />
                  </section>
                ))
              : <Linhas itens={grupo.itens} linha={linha} />}
          </section>
        ))}
      </div>
    </Painel>
  );
}

function Linhas<T extends { publicacao: PublicacaoResumo }>({ itens, linha }: { itens: T[]; linha: (item: T) => ReactNode }) {
  return (
    <ul className="divide-y divide-[#eef3f5]">
      {itens.map((item) => (
        <li key={item.publicacao.id}>{linha(item)}</li>
      ))}
    </ul>
  );
}
