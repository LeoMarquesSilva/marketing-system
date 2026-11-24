import { Fragment } from "react";
import { Minus, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatarData } from "./publicacao-ui";

/**
 * COMPROVAR PAGAMENTO todo mês (pedido de 24/11/2026), no cartão do Prazo da vistagem: quantas vezes a tarefa vai ao
 * VIOS, a primeira inclusive, e a fatal de cada mês. Ao gravar, o servidor cria uma tarefa por mês, cada uma com o
 * Enviar, o Revisar e o Protocolar contados da fatal daquele mês (`fataisDaRepeticao`).
 */
export function RepeticaoMensal({
  indice,
  vezes,
  maximo,
  fatais,
  onChange,
}: {
  indice: number;
  vezes: number;
  /** Até quantas vezes cabe no limite de tarefas da publicação, contando as outras. */
  maximo: number;
  /** As fatais de cada vez (`fataisDaRepeticao`); vazia enquanto a fatal não foi escolhida. */
  fatais: string[];
  onChange: (vezes: number) => void;
}) {
  // Data com outro dia do mês que a primeira: o mês não tem esse dia, ou ele não tem expediente.
  const diaDaPrimeira = fatais[0]?.slice(8, 10) ?? null;
  const ajustada = (iso: string, posicao: number) => Boolean(posicao && diaDaPrimeira && iso.slice(8, 10) !== diaDaPrimeira);
  const algumaAjustada = fatais.some(ajustada);
  return (
    <div className="space-y-1.5 rounded-md border border-[#e6eef0] bg-[#f7fbfc] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Repeat className="size-3.5 text-[#285f7a]" aria-hidden />
        <span className="text-xs font-medium text-foreground">Repetir todo mês</span>
        <div className="flex items-center gap-1" role="group" aria-label={`Vezes que a tarefa ${indice + 1} vai ao VIOS`}>
          <Button type="button" size="icon-sm" variant="outline" onClick={() => onChange(Math.max(1, vezes - 1))} disabled={vezes <= 1} aria-label="Uma vez a menos">
            <Minus />
          </Button>
          <span className="min-w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
            {vezes}
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => onChange(Math.min(maximo, vezes + 1))}
            disabled={vezes >= maximo}
            aria-label="Uma vez a mais"
            title={vezes >= maximo ? "Chegou ao limite de tarefas da publicação, contando as outras" : undefined}
          >
            <Plus />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">{vezes === 1 ? "vez (só esta fatal)" : "vezes ao todo, uma por mês"}</span>
      </div>
      {vezes > 1 && fatais.length ? (
        <>
          <p className="text-xs text-foreground">
            <span className="text-muted-foreground">Fatais no VIOS: </span>
            {fatais.map((fatal, posicao) => (
              <Fragment key={fatal}>
                {posicao ? " · " : null}
                <span className="tabular-nums">
                  {formatarData(fatal)}
                  {ajustada(fatal, posicao) ? "*" : ""}
                </span>
              </Fragment>
            ))}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Cada mês vai como um Prazo próprio, com o Enviar, o Revisar e o Protocolar contados da fatal daquele mês, no mesmo dia do mês
            da primeira fatal{algumaAjustada ? " (* sem esse dia no mês, o último; sem expediente, o dia útil anterior)" : ""}.
          </p>
        </>
      ) : vezes > 1 ? (
        <p className="text-[11px] text-muted-foreground">Escolha a data fatal para ver as dos meses seguintes.</p>
      ) : null}
    </div>
  );
}
