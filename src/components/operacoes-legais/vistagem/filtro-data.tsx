"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { Seletor } from "./seletor";

const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-10-29" → "29/10/2026 · qui". */
function rotuloDaData(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano} · ${DIAS_DA_SEMANA[new Date(`${data}T12:00:00Z`).getUTCDay()]}`;
}

/** A data escolhida só filtra enquanto existir na lista (trocou a área ou a aba e ela sumiu: volta a "Todas"). */
export function dataNaLista(valor: string, datas: (string | null)[]): string {
  return valor && datas.includes(valor) ? valor : "";
}

/**
 * Filtro pela data da publicação: as datas que aparecem na lista, da mais recente para a mais antiga, com quantas
 * publicações há em cada uma.
 */
export function FiltroDataPublicacao({
  datas,
  valor,
  onChange,
  className = "sm:w-56",
}: {
  datas: (string | null)[];
  valor: string;
  onChange: (valor: string) => void;
  className?: string;
}) {
  const opcoes = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const data of datas) if (data) contagem.set(data, (contagem.get(data) ?? 0) + 1);
    return [...contagem.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([data, quantidade]) => ({ valor: data, rotulo: rotuloDaData(data), contagem: quantidade }));
  }, [datas]);
  return (
    <Seletor
      rotulo="Data da publicação"
      className={className}
      valor={dataNaLista(valor, datas)}
      onChange={onChange}
      todos={{ rotulo: "Todas as datas", contagem: datas.length, icone: <CalendarDays className="size-4 text-[#3e84a8]" aria-hidden /> }}
      opcoes={opcoes}
    />
  );
}
