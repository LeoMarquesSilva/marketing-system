"use client";

import { cn } from "@/lib/utils";

export interface MarcoRegua {
  rotulo: string;
  data: string | null;
  /** marca: a data que vai para o VIOS; perigo: a fatal; neutro: as demais. */
  tom?: "neutro" | "marca" | "perigo";
  /** Texto do title (passar o mouse), para explicar a conta. */
  dica?: string;
}

const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias". */
export function relativoAHoje(data: string, hoje: string): string {
  const dias = diasEntre(hoje, data);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  return dias > 0 ? `em ${dias} dias` : `há ${-dias} dias`;
}

const PONTO = {
  neutro: "bg-[#9fb8c2]",
  marca: "bg-[#347796]",
  perigo: "bg-red-600",
} as const;

const DATA = {
  neutro: "text-foreground",
  marca: "text-[#183f50]",
  perigo: "text-red-700",
} as const;

/**
 * Linha do tempo das datas (divulgação → publicação → início do prazo, ou enviar → revisar →
 * protocolar → fatal): o dia da semana e a distância de hoje ajudam a conferir a conta sem calendário.
 */
export function ReguaDatas({ marcos, hoje, className, rotulo }: { marcos: MarcoRegua[]; hoje: string; className?: string; rotulo?: string }) {
  const visiveis = marcos.filter((marco) => marco.data);
  if (!visiveis.length) return null;
  const ultimo = visiveis.length - 1;
  return (
    <div className={className}>
      {/* A régua ocupa a largura toda: o primeiro marco encosta à esquerda, o último à direita e a linha liga os pontos. */}
      <ol aria-label={rotulo} className="relative flex justify-between gap-3">
        {visiveis.length > 1 ? <span aria-hidden className="absolute left-[5px] right-[5px] top-[26px] h-px bg-[#dce9eb]" /> : null}
        {visiveis.map((marco, indice) => {
          const data = marco.data as string;
          const tom = marco.tom ?? "neutro";
          const passou = data < hoje;
          const alinhamento = indice === 0 ? "text-left" : indice === ultimo ? "text-right" : "text-center";
          return (
            <li key={`${marco.rotulo}-${indice}`} className={cn("relative min-w-0", alinhamento)} title={marco.dica}>
              <p className="truncate text-[11px] font-medium leading-4 text-muted-foreground">{marco.rotulo}</p>
              <div className={cn("my-1.5 flex h-2.5", indice === 0 ? "justify-start" : indice === ultimo ? "justify-end" : "justify-center")} aria-hidden>
                <span className={cn("size-2.5 shrink-0 rounded-full ring-[3px] ring-white", PONTO[tom], passou && tom === "neutro" && "bg-[#c9d8de]")} />
              </div>
              <p className={cn("text-sm font-semibold tabular-nums", DATA[tom], passou && tom === "neutro" && "text-muted-foreground")}>
                {data.slice(8, 10)}/{data.slice(5, 7)}
                <span className="ml-1 font-sans text-[11px] font-normal text-muted-foreground">{DIAS_DA_SEMANA[new Date(`${data}T12:00:00Z`).getUTCDay()]}</span>
              </p>
              <p className={cn("truncate text-[11px]", data === hoje ? "font-medium text-[#285f7a]" : "text-muted-foreground")}>{relativoAHoje(data, hoje)}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
