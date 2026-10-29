"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, CalendarDays, ChevronRight, CircleDollarSign, FileText, Gavel, Hourglass, TriangleAlert, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { destacar, lerPublicacao, pontosDeAtencao, type PontoDeAtencao, type TipoDestaque } from "@/lib/vistagem/leitura";
import type { PublicacaoResumo } from "@/lib/vistagem/types";
import { Selo } from "./ui";

const MARCA: Record<TipoDestaque, string> = {
  prazo: "rounded-sm bg-amber-100 px-0.5 font-medium text-amber-950",
  pena: "rounded-sm bg-red-50 px-0.5 text-red-800 underline decoration-red-300 underline-offset-2",
  valor: "rounded-sm bg-emerald-50 px-0.5 font-medium text-emerald-900",
  data: "rounded-sm bg-[#e8f8f8] px-0.5 font-medium text-[#183f50]",
  hora: "rounded-sm bg-[#e8f8f8] px-0.5 font-medium text-[#183f50]",
  evento: "rounded-sm bg-[#eeedf5] px-0.5 font-medium text-[#48466e]",
  ordem: "font-semibold text-[#10293a]",
};

const PONTO: Record<PontoDeAtencao["tipo"], { icone: LucideIcon; rotulo: string; classe: string }> = {
  prazo: { icone: Hourglass, rotulo: "Prazo", classe: "bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100" },
  evento: { icone: CalendarClock, rotulo: "Ato", classe: "bg-[#eeedf5] text-[#48466e] ring-[#48466e]/15 hover:bg-[#e4e2f0]" },
  data: { icone: CalendarDays, rotulo: "Data", classe: "bg-[#e8f8f8] text-[#183f50] ring-[#47cdd0]/30 hover:bg-[#d9f3f3]" },
  pena: { icone: TriangleAlert, rotulo: "Pena", classe: "bg-red-50 text-red-800 ring-red-200 hover:bg-red-100" },
  valor: { icone: CircleDollarSign, rotulo: "Valor", classe: "bg-emerald-50 text-emerald-900 ring-emerald-200 hover:bg-emerald-100" },
};

const POLO: Record<string, string> = { A: "Polo ativo", P: "Polo passivo" };

function Detalhes({ titulo, icone: Icone, children }: { titulo: ReactNode; icone: LucideIcon; children: ReactNode }) {
  return (
    <details className="group border-t border-[#e6eef0]">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#285f7a] hover:bg-[#f6fafb] [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
        <Icone className="size-3.5 shrink-0" aria-hidden />
        {titulo}
      </summary>
      <div className="px-4 pb-3">{children}</div>
    </details>
  );
}

/**
 * Leitura da publicação para o jurídico: o que pede atenção no topo (prazo, ato, data, pena, valor),
 * o texto em parágrafos com os trechos marcados, e partes, advogados e o texto original recolhidos.
 * `onUsarDias` põe os dias de um prazo citado na tarefa de Prazo. A rolagem fica com quem usa.
 */
export function LeitorPublicacao({
  publicacao,
  onUsarDias,
  ocultarIdComunicacao = false,
  partesNoCabecalho = false,
  className,
}: {
  publicacao: PublicacaoResumo;
  onUsarDias?: (dias: number, contagem: "uteis" | "corridos" | null) => void;
  /** Controladoria: o ID comunicação não ajuda a decidir a pasta e sai da tela. */
  ocultarIdComunicacao?: boolean;
  /** Jurídico: partes e advogados já estão no cabeçalho; o fim do leitor fica só com os terceiros, se houver. */
  partesNoCabecalho?: boolean;
  className?: string;
}) {
  const leitura = useMemo(() => lerPublicacao(publicacao.teor), [publicacao.teor]);
  // Com o polo ativo, o passivo e os advogados no cabeçalho, aqui ficam só os outros polos (terceiros).
  const partes = partesNoCabecalho ? leitura.partes.filter((parte) => parte.polo !== "A" && parte.polo !== "P") : leitura.partes;
  const advogados = partesNoCabecalho ? [] : leitura.advogados;
  const pontos = useMemo(() => pontosDeAtencao(leitura.paragrafos, publicacao.dataPublicacao), [leitura, publicacao.dataPublicacao]);
  const [ativo, setAtivo] = useState<string | null>(null);
  const base = `leitura-${publicacao.id}`;

  useEffect(() => {
    if (!ativo) return;
    const tempo = window.setTimeout(() => setAtivo(null), 1600);
    return () => window.clearTimeout(tempo);
  }, [ativo]);

  function irPara(ponto: PontoDeAtencao) {
    const id = `${base}-${ponto.paragrafo}-${ponto.inicio}`;
    document.getElementById(id)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setAtivo(id);
  }

  const cabecalho = [leitura.orgao, leitura.tipoComunicacao].filter(Boolean).join(" · ");

  return (
    <div className={className}>
      {pontos.length ? (
        <div className="space-y-2 border-y border-[#e6eef0] bg-[#fcfdfd] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase text-[#285f7a]">Pontos de atenção</p>
          <ul className="flex flex-wrap gap-1.5">
            {pontos.map((ponto) => {
              const info = PONTO[ponto.tipo];
              return (
                <li key={`${ponto.paragrafo}-${ponto.inicio}`} className="inline-flex max-w-full items-stretch">
                  <button
                    type="button"
                    onClick={() => irPara(ponto)}
                    title="Ir ao trecho no texto"
                    className={cn(
                      "inline-flex min-w-0 items-center gap-1.5 px-2 py-1 text-xs ring-1 ring-inset transition-colors",
                      ponto.tipo === "prazo" && ponto.dias && onUsarDias ? "rounded-l-md" : "rounded-md",
                      info.classe
                    )}
                  >
                    <info.icone className="size-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">{info.rotulo}: </span>
                    <span className="truncate">{ponto.texto}</span>
                  </button>
                  {ponto.tipo === "prazo" && ponto.dias && onUsarDias ? (
                    <button
                      type="button"
                      onClick={() => onUsarDias(ponto.dias as number, ponto.contagem ?? null)}
                      className="rounded-r-md bg-amber-100 px-2 text-xs font-semibold text-amber-950 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-amber-200"
                      title={`Pôr ${ponto.dias} dias na tarefa de Prazo`}
                    >
                      Usar {ponto.dias} dias
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div>
        <article className="space-y-3 px-4 py-4" aria-label="Texto da publicação">
          {cabecalho || leitura.classe ? (
            <header className="space-y-1">
              {cabecalho ? <p className="text-sm font-semibold text-foreground">{cabecalho}</p> : null}
              {leitura.classe ? <p className="text-xs text-muted-foreground">{leitura.classe}</p> : null}
            </header>
          ) : null}
          {leitura.intimados.length ? (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <UserRound className="size-3.5 text-[#3e84a8]" aria-hidden />
              {leitura.intimados.length > 1 ? "Intimados" : "Intimado"}:
              {leitura.intimados.map((nome) => (
                <span key={nome} className="font-medium text-foreground">
                  {nome}
                </span>
              ))}
            </p>
          ) : null}

          <div className="space-y-3">
            {leitura.paragrafos.map((paragrafo, indice) => {
              if (paragrafo.tipo === "titulo") {
                return (
                  <h4 key={indice} className="pt-2 text-xs font-semibold uppercase tracking-wide text-[#285f7a]">
                    {paragrafo.texto}
                  </h4>
                );
              }
              if (paragrafo.tipo === "secundario") {
                return (
                  <p key={indice} className="text-xs leading-5 text-muted-foreground">
                    {paragrafo.texto}
                  </p>
                );
              }
              return (
                <p key={indice} className="text-[15px] leading-7 text-foreground">
                  {destacar(paragrafo.texto).map((trecho) => {
                    if (!trecho.tipo) return <span key={trecho.inicio}>{trecho.texto}</span>;
                    const id = `${base}-${indice}-${trecho.inicio}`;
                    return (
                      <mark
                        key={trecho.inicio}
                        id={id}
                        className={cn(
                          "bg-transparent text-inherit transition-shadow duration-300",
                          MARCA[trecho.tipo],
                          ativo === id && "ring-2 ring-[#47cdd0] ring-offset-1"
                        )}
                      >
                        {trecho.texto}
                      </mark>
                    );
                  })}
                </p>
              );
            })}
          </div>
        </article>

        {partes.length || advogados.length ? (
          <Detalhes
            icone={partes.length ? Users : Gavel}
            titulo={
              !advogados.length ? `Outras partes (${partes.length})` : partes.length ? `Partes e advogados (${partes.length + advogados.length})` : `Advogados (${advogados.length})`
            }
          >
            <div className="grid gap-3 text-xs @lg:grid-cols-2">
              {partes.length ? (
                <ul className="space-y-1">
                  {partes.map((parte) => (
                    <li key={`${parte.nome}|${parte.polo}`} className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium text-foreground">{parte.nome}</span>
                      <span className="text-muted-foreground">{POLO[parte.polo] ?? parte.polo}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {advogados.length ? (
                <ul className="space-y-1">
                  {advogados.map((advogado) => (
                    <li key={`${advogado.nome}|${advogado.oab}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Gavel className="size-3 text-muted-foreground" aria-hidden />
                      <span className={cn(advogado.doEscritorio ? "font-semibold text-[#183f50]" : "text-foreground")}>{advogado.nome}</span>
                      <span className="tabular-nums text-muted-foreground">
                        OAB {advogado.oab}/{advogado.uf}
                      </span>
                      {advogado.doEscritorio ? <Selo tom="marca">do escritório</Selo> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Detalhes>
        ) : null}

        <Detalhes icone={FileText} titulo={ocultarIdComunicacao ? "Texto original" : "Texto original e identificadores"}>
          <dl className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {publicacao.djenIdComunicacao && !ocultarIdComunicacao ? (
              <div className="flex gap-1">
                <dt className="text-muted-foreground">ID comunicação</dt>
                <dd className="tabular-nums">{publicacao.djenIdComunicacao}</dd>
              </div>
            ) : null}
            {publicacao.documentoIds.length ? (
              <div className="flex gap-1">
                <dt className="text-muted-foreground">Id do documento</dt>
                <dd className="tabular-nums">{publicacao.documentoIds.join(", ")}</dd>
              </div>
            ) : null}
            {leitura.meio ? (
              <div className="flex gap-1">
                <dt className="text-muted-foreground">Meio</dt>
                <dd>{leitura.meio}</dd>
              </div>
            ) : null}
          </dl>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#e6eef0] bg-[#f7fbfc] p-3 font-sans text-xs leading-relaxed text-foreground">
            {publicacao.teor}
          </pre>
        </Detalhes>
      </div>
    </div>
  );
}
