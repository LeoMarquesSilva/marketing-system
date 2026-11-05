"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { relativoAHoje } from "./regua-datas";
import { IconeOpcao, Seletor } from "./seletor";

const DIAS_DA_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** "2026-10-29" → "29/10/2026". */
function rotuloDaData(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Hoje no calendário de quem está usando (AAAA-MM-DD). */
function hojeLocal(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

/** Linha de apoio na lista: "quinta-feira · há 6 dias". */
function descricaoDaData(data: string, hoje: string): string {
  return `${DIAS_DA_SEMANA[new Date(`${data}T12:00:00Z`).getUTCDay()]} · ${relativoAHoje(data, hoje)}`;
}

/** A data escolhida só filtra enquanto existir na lista (trocou a área ou a aba e ela sumiu: volta a "todas"). */
export function dataNaLista(valor: string, datas: (string | null)[]): string {
  return valor && datas.includes(valor) ? valor : "";
}

const icone = <IconeOpcao icone={CalendarDays} />;

/**
 * Filtro por uma data da publicação (publicação ou importação): as datas que aparecem na lista, da mais recente
 * para a mais antiga, com quantas publicações há em cada uma. Sem data escolhida, o campo mostra o nome do filtro.
 */
export function FiltroData({
  rotulo,
  rotuloCurto,
  datas,
  valor,
  onChange,
  className = "sm:w-52",
}: {
  /** "Data Publicação" ou "Data do recebimento": nome do filtro e título da lista. */
  rotulo: string;
  /** Nome mais curto no campo, para filtros compactos (ex.: "Recebimento"). */
  rotuloCurto?: string;
  datas: (string | null)[];
  valor: string;
  onChange: (valor: string) => void;
  className?: string;
}) {
  const opcoes = useMemo(() => {
    const hoje = hojeLocal();
    const contagem = new Map<string, number>();
    for (const data of datas) if (data) contagem.set(data, (contagem.get(data) ?? 0) + 1);
    return [...contagem.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([data, quantidade]) => ({ valor: data, rotulo: rotuloDaData(data), descricao: descricaoDaData(data, hoje), contagem: quantidade, icone }));
  }, [datas]);
  return (
    <Seletor
      rotulo={rotulo}
      className={className}
      valor={dataNaLista(valor, datas)}
      onChange={onChange}
      todos={{ rotulo: "Todas as datas", contagem: datas.length, icone }}
      rotuloVazio={
        <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
          {icone}
          <span className="truncate">{rotuloCurto ?? rotulo}</span>
        </span>
      }
      opcoes={opcoes}
    />
  );
}
