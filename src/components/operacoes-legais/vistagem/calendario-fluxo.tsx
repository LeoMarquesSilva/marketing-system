"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { partesDaData } from "@/lib/vistagem/como-fica-no-vios";

/**
 * Calendário do "Fluxo das tarefas": semanas de segunda a domingo, do primeiro ao último dia do fluxo, com cada
 * tarefa como um número no dia dela (o mesmo número da agenda logo abaixo). Fim de semana e feriado ficam
 * apagados; hoje, marcado.
 */

/** Tipo da tarefa, com as cores do VIOS (Prazo verde, Revisar amarelo, Protocolar vermelho, Providência azul). */
export type TomDoMarco = "prazo" | "providencia" | "compromisso" | "revisar" | "protocolar" | "fatal";

export interface MarcoDoCalendario {
  chave: string;
  numero: number;
  /** Nome no título do número ("Embargos de Declaração — 12/11"). */
  rotulo: string;
  data: string;
  tom: TomDoMarco;
  /** O jurídico mudou a data que o VIOS daria: contorno escuro em volta do número. */
  editada?: boolean;
}

/** Cor de cada tipo: o número fica dentro, em branco ou quase preto conforme o fundo. A fatal é só contorno. */
export const ESTILO_DO_MARCO: Record<TomDoMarco, string> = {
  prazo: "bg-[#3cc14d] text-[#04202f]",
  providencia: "bg-[#347796] text-white",
  compromisso: "bg-[#48466e] text-white",
  revisar: "bg-[#e2cc3e] text-[#04202f]",
  protocolar: "bg-[#f0316a] text-white",
  fatal: "bg-white text-[#b42318] ring-2 ring-inset ring-[#b42318]",
};

export const ROTULO_DO_TOM: Record<TomDoMarco, string> = {
  prazo: "Prazo",
  providencia: "Providência",
  compromisso: "Compromisso",
  revisar: "Revisar",
  protocolar: "Protocolar",
  fatal: "Fatal",
};

/** Contorno da data alterada pelo jurídico (fica por fora da cor do tipo). */
const CONTORNO_EDITADA = "outline outline-2 outline-offset-1 outline-[#04202f]";

/** Tipo da tarefa do fluxo pelo nome ("2. REVISAR", "3. PROTOCOLAR"); as outras ficam no tipo da tarefa pedida. */
export function tomDaTarefaDoFluxo(nome: string, tomDaPedida: TomDoMarco): TomDoMarco {
  const texto = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/\brevis/.test(texto)) return "revisar";
  if (/\bprotocol/.test(texto)) return "protocolar";
  return tomDaPedida;
}

const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
/** Mais do que isso vira uma tira longa demais na coluna das tarefas. */
const MAXIMO_DE_SEMANAS = 6;

function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Segunda-feira da semana do dia. */
function segundaDa(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return somarDias(iso, -((semana + 6) % 7));
}

/** As semanas que o calendário mostra: da semana de hoje (ou do primeiro marco) até a do último. */
export function semanasDoCalendario(datas: string[], hoje: string): string[][] {
  if (!datas.length) return [];
  const ordenadas = [...datas].sort();
  const primeira = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  let inicio = segundaDa(primeira < hoje ? primeira : hoje);
  const fim = segundaDa(ultima);
  const quantas = (de: string) => Math.round((Date.parse(fim) - Date.parse(de)) / (7 * 86_400_000)) + 1;
  // Hoje longe do fluxo: o calendário começa no fluxo, não em semanas vazias.
  if (quantas(inicio) > MAXIMO_DE_SEMANAS) inicio = segundaDa(primeira);
  const total = Math.min(quantas(inicio), MAXIMO_DE_SEMANAS);
  return Array.from({ length: total }, (_, semana) => Array.from({ length: 7 }, (_, dia) => somarDias(inicio, semana * 7 + dia)));
}

export function NumeroDoMarco({ numero, tom, editada = false, className }: { numero: number; tom: TomDoMarco; editada?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums leading-none",
        ESTILO_DO_MARCO[tom],
        editada && CONTORNO_EDITADA,
        className
      )}
      aria-hidden
    >
      {numero}
    </span>
  );
}

export function CalendarioDoFluxo({
  marcos,
  hoje,
  ehDiaUtil,
  rotulo,
  legenda,
}: {
  marcos: MarcoDoCalendario[];
  hoje: string;
  ehDiaUtil: (iso: string) => boolean;
  rotulo: string;
  /** Tipos de marco que aparecem (a legenda só lista estes). */
  legenda?: ReactNode;
}) {
  const semanas = semanasDoCalendario(
    marcos.map((marco) => marco.data),
    hoje
  );
  if (!semanas.length) return null;
  const porDia = new Map<string, MarcoDoCalendario[]>();
  for (const marco of marcos) porDia.set(marco.data, [...(porDia.get(marco.data) ?? []), marco]);
  const visiveis = new Set(semanas.flat());
  const fora = marcos.filter((marco) => !visiveis.has(marco.data)).length;

  return (
    <div className="space-y-1.5">
      <div role="grid" aria-label={rotulo} className="overflow-hidden rounded-md border border-[#e6eef0] bg-white">
        <div role="row" className="grid grid-cols-7 border-b border-[#e6eef0] bg-[#f7fbfc]">
          {SEMANA.map((dia, indice) => (
            <span
              key={dia}
              role="columnheader"
              className={cn("py-1 text-center text-[10px] font-semibold uppercase text-[#285f7a]", indice >= 5 && "text-muted-foreground/70")}
            >
              {dia}
            </span>
          ))}
        </div>
        {semanas.map((semana, linha) => (
          <div key={semana[0]} role="row" className={cn("grid grid-cols-7", linha > 0 && "border-t border-[#eef3f5]")}>
            {semana.map((dia, coluna) => {
              const util = ehDiaUtil(dia);
              const doDia = porDia.get(dia) ?? [];
              const partes = partesDaData(dia);
              const ehHoje = dia === hoje;
              // Mês ao lado do número no dia 1 e na primeira célula, para a pessoa se situar.
              const comMes = partes.dia === "01" || (linha === 0 && coluna === 0);
              return (
                <div
                  key={dia}
                  role="gridcell"
                  aria-label={`${partes.semana}, ${partes.dia} ${partes.mes}${ehHoje ? ", hoje" : ""}${util ? "" : ", sem expediente"}${
                    doDia.length ? `: ${doDia.map((marco) => `${marco.numero}. ${marco.rotulo}`).join("; ")}` : ""
                  }`}
                  className={cn(
                    "relative min-h-12 px-1 pb-1 pt-0.5",
                    coluna > 0 && "border-l border-[#eef3f5]",
                    !util && "bg-[#f4f7f8]",
                    ehHoje && "bg-[#e8f8f8]"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-baseline gap-0.5 text-[11px] tabular-nums",
                      ehHoje ? "font-semibold text-[#285f7a]" : util ? "text-foreground/80" : "text-muted-foreground/60"
                    )}
                  >
                    {partes.dia}
                    {comMes ? <span className="text-[9px] font-medium uppercase text-muted-foreground">{partes.mes}</span> : null}
                    {ehHoje ? <span className="ml-auto text-[9px] font-semibold uppercase text-[#347796]">hoje</span> : null}
                  </span>
                  {doDia.length ? (
                    <span className="mt-0.5 flex flex-wrap gap-0.5">
                      {doDia.map((marco) => (
                        <span
                          key={marco.chave}
                          title={`${marco.numero}. ${marco.rotulo} — ${partes.dia}/${dia.slice(5, 7)}${marco.editada ? " (data alterada)" : ""}`}
                        >
                          <NumeroDoMarco numero={marco.numero} tom={marco.tom} editada={marco.editada} />
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {legenda}
        {fora ? <span>{fora === 1 ? "1 data fica" : `${fora} datas ficam`} além destas semanas: veja na agenda.</span> : null}
      </div>
    </div>
  );
}

/** Legenda de um tipo de marco: a bolinha na cor e o nome (ou o contorno da data alterada). */
export function ItemDaLegenda({ tom, editada = false }: { tom?: TomDoMarco; editada?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn("size-2.5 rounded-full", editada ? cn("bg-white", CONTORNO_EDITADA, "outline-offset-0") : tom ? ESTILO_DO_MARCO[tom] : "")}
        aria-hidden
      />
      {editada ? "Data alterada" : tom ? ROTULO_DO_TOM[tom] : null}
    </span>
  );
}
