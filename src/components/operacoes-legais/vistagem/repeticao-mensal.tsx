import { Plus, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { comMaisUmMes, type MesDaRecorrencia } from "@/lib/vistagem/repeticao-mensal";
import { CampoData } from "./campo-data";
import { formatarData } from "./publicacao-ui";

/** O que há de errado na data de um mês da recorrência (a tela não deixa enviar), ou o aviso de dia sem expediente. */
function situacaoDoMes(
  mes: MesDaRecorrencia,
  meses: MesDaRecorrencia[],
  primeira: string,
  ehDiaUtil: (iso: string) => boolean
): { erro: string | null; aviso: string | null } {
  if (!mes.fatal) return { erro: primeira ? "Falta a data." : null, aviso: null };
  if (primeira && mes.fatal <= primeira) return { erro: "Tem de ser depois da 1ª fatal.", aviso: null };
  if (meses.filter((outro) => outro.fatal === mes.fatal).length > 1) return { erro: "Data repetida.", aviso: null };
  return { erro: null, aviso: ehDiaUtil(mes.fatal) ? null : "Não é dia útil." };
}

/**
 * COMPROVAR PAGAMENTO recorrente, todo mês (pedido de 24/11/2026: "como se fosse recorrente", com a possibilidade de
 * adicionar e editar), no cartão do Prazo da vistagem. Ligado, cada mês seguinte aparece com a data sugerida
 * (`fatalNoMes`: o mesmo dia do mês da 1ª fatal; sem ele, o último; sem expediente, o dia útil anterior), que a pessoa
 * pode mudar ou tirar, e ela acrescenta quantos meses quiser, até o limite de tarefas da publicação. Ao gravar, cada
 * mês vira uma tarefa com o Enviar, o Revisar e o Protocolar contados da fatal dele.
 */
export function RecorrenciaMensal({
  indice,
  primeira,
  meses,
  maximo,
  ehDiaUtil,
  onChange,
}: {
  indice: number;
  /** A data fatal da tarefa (AAAA-MM-DD), a 1ª vez; vazia enquanto não foi escolhida. */
  primeira: string;
  /** Os meses seguintes; null = não é recorrente. */
  meses: MesDaRecorrencia[] | null;
  /** Até quantas vezes ao todo cabe no limite de tarefas da publicação, contando as outras tarefas. */
  maximo: number;
  ehDiaUtil: (iso: string) => boolean;
  onChange: (meses: MesDaRecorrencia[] | null) => void;
}) {
  const ativa = Boolean(meses?.length);
  const lista = meses ?? [];
  const vezes = 1 + lista.length;
  const cabeMais = vezes < maximo;
  const tirar = (alvo: MesDaRecorrencia) => {
    const restantes = lista.filter((mes) => mes !== alvo);
    onChange(restantes.length ? restantes : null);
  };
  return (
    <div className="space-y-2 rounded-md border border-[#e6eef0] bg-[#f7fbfc] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="xs"
          variant="outline"
          aria-pressed={ativa}
          disabled={!ativa && !cabeMais}
          title={!ativa && !cabeMais ? "Chegou ao limite de tarefas da publicação, contando as outras" : undefined}
          className={cn("h-8 gap-1.5", ativa && "border-[#285f7a] bg-[#347796] text-white hover:bg-[#285f7a] hover:text-white")}
          onClick={() => onChange(ativa ? null : comMaisUmMes([], primeira, ehDiaUtil))}
        >
          <Repeat aria-hidden />
          Recorrente todo mês
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {ativa ? `${vezes} vezes ao todo, uma por mês` : "Parcelas: a tarefa vai também nos meses seguintes."}
        </span>
      </div>
      {ativa ? (
        <>
          <ol className="space-y-1.5" aria-label={`Meses da tarefa ${indice + 1}`}>
            <li className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-7 font-semibold tabular-nums text-[#285f7a]">1ª</span>
              <span className="tabular-nums">{primeira ? formatarData(primeira) : "a data fatal acima"}</span>
              <span className="text-muted-foreground">esta tarefa</span>
            </li>
            {lista.map((mes, posicao) => {
              const { erro, aviso } = situacaoDoMes(mes, lista, primeira, ehDiaUtil);
              return (
                <li key={mes.meses} className="flex flex-wrap items-center gap-2">
                  <span className="w-7 text-xs font-semibold tabular-nums text-[#285f7a]">{posicao + 2}ª</span>
                  <div className="w-[11rem]">
                    <CampoData
                      compacto
                      rotulo={`Data fatal da ${posicao + 2}ª vez da tarefa ${indice + 1}`}
                      valor={mes.fatal}
                      ehDiaUtil={ehDiaUtil}
                      min={primeira || undefined}
                      destacado={mes.editada}
                      invalido={Boolean(erro)}
                      onChange={(fatal) => onChange(lista.map((outro) => (outro === mes ? { ...outro, fatal, editada: true } : outro)))}
                    />
                  </div>
                  {erro ? <span className="text-[11px] font-medium text-red-700">{erro}</span> : null}
                  {!erro && aviso ? <span className="text-[11px] text-amber-700">{aviso}</span> : null}
                  {!erro && mes.editada ? <span className="text-[11px] text-[#285f7a]">mudada</span> : null}
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                    aria-label={`Tirar a ${posicao + 2}ª vez da tarefa ${indice + 1}`}
                    title="Tirar este mês"
                    onClick={() => tirar(mes)}
                  >
                    <X />
                  </Button>
                </li>
              );
            })}
          </ol>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={!cabeMais}
            title={!cabeMais ? "Chegou ao limite de tarefas da publicação, contando as outras" : undefined}
            onClick={() => onChange(comMaisUmMes(lista, primeira, ehDiaUtil))}
          >
            <Plus aria-hidden />
            Adicionar mês
          </Button>
          <p className="text-[11px] text-muted-foreground">
            A data de cada mês vem sugerida: o mesmo dia do mês da 1ª fatal; sem esse dia, o último do mês; sem expediente, o dia útil
            anterior. Dá para mudar ou tirar cada uma. Cada mês vai como um Prazo próprio, com o Enviar, o Revisar e o Protocolar
            contados da fatal dele.
          </p>
        </>
      ) : null}
    </div>
  );
}
