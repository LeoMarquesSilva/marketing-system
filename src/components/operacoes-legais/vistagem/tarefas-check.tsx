"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Bot, CalendarDays, CircleCheck, Clock, Flag, Info, TriangleAlert, UserCheck, UserRound, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROTULO_ETIQUETA, chaveNome, nomesDasPessoas, revisorFicaNaTarefa } from "@/lib/vistagem/agendamento";
import { compararTarefa, revisorEstaNaTarefa, type ComparacaoDaTarefa, type SituacaoCampo, type SituacaoCheck } from "@/lib/vistagem/check";
import { nomeCurto } from "@/lib/vistagem/como-fica-no-vios";
import { ROTULO_CONTAGEM } from "@/lib/vistagem/dias-uteis";
import type { AgendamentoResumo } from "@/lib/vistagem/types";
import { formatarData } from "./publicacao-ui";
import { AvatarPessoa } from "./combobox-busca";
import { AgendaNoVios, DiaNaAgenda, ENVIO, ESTILO_CLASSE, ICONE_CLASSE, LinkVios } from "./tarefas-conferencia";
import { Selo, TOM_CLASSE } from "./ui";

/**
 * Tarefas no Check: cada uma num cartão numerado, como na Conferência, com o pedido e o que o robô gravou no VIOS
 * lado a lado (data, horário e responsável), a divergência marcada e o CI para abrir a tarefa no VIOS.
 */

const SITUACAO: Record<SituacaoCheck, { rotulo: string; icone: LucideIcon; tom: "sucesso" | "alerta" | "marca"; dica: string }> = {
  confere: { rotulo: "Confere", icone: CircleCheck, tom: "sucesso", dica: "Tudo o que o robô devolveu bate com o pedido." },
  diverge: { rotulo: "Diverge", icone: TriangleAlert, tom: "alerta", dica: "Data, horário ou responsável no VIOS diferente do pedido." },
  conferir: { rotulo: "Conferir no VIOS", icone: Info, tom: "marca", dica: "Nada diverge, mas o robô não devolveu algum dado: confira pelo CI." },
};

export function SeloSituacao({ situacao, className }: { situacao: SituacaoCheck; className?: string }) {
  const { rotulo, icone, tom, dica } = SITUACAO[situacao];
  return (
    <span title={dica} className="inline-flex">
      <Selo tom={tom} icone={icone} className={className}>
        {rotulo}
      </Selo>
    </span>
  );
}

/** Ícone do resultado de cada campo, com o texto para leitor de tela. */
function MarcaDoCampo({ situacao }: { situacao: SituacaoCampo | null }) {
  if (situacao === "confere") {
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" title="Confere">
        <CircleCheck className="size-3.5" aria-hidden />
        <span className="sr-only">Confere</span>
      </span>
    );
  }
  if (situacao === "diverge") {
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-300" title="Diverge do pedido">
        <TriangleAlert className="size-3.5" aria-hidden />
        <span className="sr-only">Diverge do pedido</span>
      </span>
    );
  }
  if (situacao === "sem_dado") {
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-200" title="O robô não devolveu este dado: confira no VIOS">
        <Info className="size-3.5" aria-hidden />
        <span className="sr-only">Não veio do robô</span>
      </span>
    );
  }
  return <span className="size-5 shrink-0" aria-hidden />;
}

/** Pessoas na comparação: foto e nome curto (o inteiro no title), para caber nas duas colunas com a fila aberta. */
function PessoasCurtas({ texto, fotos, vazio = "—" }: { texto: string | null; fotos: Record<string, string>; vazio?: string }) {
  const nomes = nomesDasPessoas(texto);
  if (!nomes.length) return <span className="text-xs text-muted-foreground">{vazio}</span>;
  return (
    <ul className="space-y-1">
      {nomes.map((nome) => (
        <li key={nome} className="flex min-w-0 items-center gap-1.5" title={nome}>
          <AvatarPessoa nome={nome} foto={fotos[chaveNome(nome)]} className="size-6" />
          <span className="min-w-0 break-words text-[13px] leading-tight text-foreground">{nomeCurto(nome)}</span>
        </li>
      ))}
    </ul>
  );
}

/** O robô não devolveu o dado: a tela não deduz, pede para conferir no VIOS. */
function NaoVeio({ children = "Não veio do robô" }: { children?: ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

/** Uma linha da comparação: o campo, o pedido e o que está no VIOS, com a marca do resultado. */
function Linha({
  icone: Icone,
  rotulo,
  dica,
  pedido,
  noVios,
  situacao,
}: {
  icone: LucideIcon;
  rotulo: string;
  dica?: string;
  pedido: ReactNode;
  noVios: ReactNode;
  /** null: só informa (sem conferência automática). */
  situacao: SituacaoCampo | null;
}) {
  const diverge = situacao === "diverge";
  return (
    // Estreito (celular, fila aberta): cada campo vira um bloco, com o campo em cima e "Pedido" e "No VIOS" lado a lado.
    <tr className={cn("align-top @max-sm:grid @max-sm:grid-cols-2 @max-sm:gap-x-3 @max-sm:gap-y-1 @max-sm:px-3 @max-sm:py-2", diverge && "bg-amber-50")}>
      <th scope="row" className="py-2 pl-3 pr-2 text-left font-normal @max-sm:col-span-2 @max-sm:p-0" title={dica}>
        <span className={cn("flex items-center gap-1.5 text-[11px] font-medium", diverge ? "text-amber-900" : "text-muted-foreground")}>
          <Icone className={cn("size-3.5 shrink-0", diverge ? "text-amber-700" : "text-[#3e84a8]")} aria-hidden />
          {rotulo}
        </span>
      </th>
      <td className="min-w-0 px-2 py-2 @max-sm:p-0">
        <RotuloEstreito>Pedido</RotuloEstreito>
        {pedido}
      </td>
      <td className="min-w-0 py-2 pl-2 pr-3 @max-sm:p-0">
        <RotuloEstreito>No VIOS</RotuloEstreito>
        <div className="flex items-start justify-between gap-2">
          <div className={cn("min-w-0", diverge && "text-amber-900")}>{noVios}</div>
          <MarcaDoCampo situacao={situacao} />
        </div>
      </td>
    </tr>
  );
}

/** "Pedido" e "No VIOS" em cima do valor quando a tabela está empilhada (o cabeçalho some); na tabela, fica escondido. */
function RotuloEstreito({ children }: { children: string }) {
  return <span className="hidden text-[11px] font-semibold uppercase text-[#285f7a] @max-sm:block">{children}</span>;
}

/**
 * Revisor: o robô não devolve o campo revisor da tarefa. Quando o fluxo tem tarefas Revisar (no Prazo, o robô põe o
 * revisor nelas), a tela mostra quem ficou em cada uma, sem dar veredito.
 */
function RevisoresNoVios({ item, fotos, hoje }: { item: AgendamentoResumo; fotos: Record<string, string>; hoje: string }) {
  const revisar = (item.viosTarefas ?? []).filter((tarefa) => !tarefa.principal && chaveNome(tarefa.tipo).includes("REVISAR"));
  if (!revisar.length) return <NaoVeio />;
  return (
    <ul className="space-y-1.5" aria-label="Tarefas Revisar do fluxo no VIOS">
      {revisar.map((tarefa) => (
        <li key={tarefa.ci} className="space-y-0.5">
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{tarefa.tipo}</span>
            <DiaNaAgenda data={tarefa.data} hoje={hoje} />
          </p>
          <PessoasCurtas texto={tarefa.responsaveis} fotos={fotos} vazio="Sem responsável" />
        </li>
      ))}
    </ul>
  );
}

function Comparacao({
  item,
  comparacao,
  fotos,
  hoje,
}: {
  item: AgendamentoResumo;
  comparacao: ComparacaoDaTarefa;
  fotos: Record<string, string>;
  hoje: string;
}) {
  const { gravada } = comparacao;
  const responsavel = comparacao.responsavel;
  const revisorNaTarefa = revisorEstaNaTarefa(item);
  return (
    <div className="@container overflow-hidden rounded-md border border-[#e6eef0]">
      <table className="w-full table-fixed border-collapse text-sm @max-sm:block">
        <caption className="sr-only">Pedido e o que está no VIOS para {item.tarefa}</caption>
        <colgroup>
          <col className="w-[6.25rem]" />
          <col />
          <col />
        </colgroup>
        <thead className="bg-[#f7fbfc] text-[11px] font-semibold uppercase text-[#285f7a] @max-sm:hidden">
          <tr>
            <th scope="col" className="py-1.5 pl-3 pr-2 text-left font-semibold">
              <span className="sr-only">Campo</span>
            </th>
            <th scope="col" className="px-2 py-1.5 text-left font-semibold">
              Pedido
            </th>
            <th scope="col" className="py-1.5 pl-2 pr-3 text-left font-semibold">
              No VIOS
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eef3f5] border-t border-[#e6eef0] @max-sm:block @max-sm:border-t-0">
          <Linha
            icone={CalendarDays}
            rotulo={item.etiqueta === "PRAZO" ? "Enviar" : "Data"}
            dica={item.etiqueta === "PRAZO" ? "Data da tarefa no VIOS: o Enviar, antes da fatal." : undefined}
            situacao={comparacao.data.situacao}
            pedido={<DiaNaAgenda data={comparacao.data.pedido} hoje={hoje} />}
            noVios={
              gravada?.data ? (
                <span className="block">
                  <DiaNaAgenda data={gravada.data} hoje={hoje} />
                  {gravada.dataLimite && gravada.dataLimite !== gravada.data ? (
                    <span className="block text-[11px] font-normal text-muted-foreground">limite {formatarData(gravada.dataLimite)}</span>
                  ) : null}
                </span>
              ) : (
                <NaoVeio />
              )
            }
          />
          {comparacao.hora ? (
            <Linha
              icone={Clock}
              rotulo="Horário"
              situacao={comparacao.hora.situacao}
              pedido={<span className="text-xs font-semibold tabular-nums text-[#10293a]">{comparacao.hora.pedido}</span>}
              noVios={
                comparacao.hora.noVios ? (
                  <span className="text-xs font-semibold tabular-nums text-[#10293a]">{comparacao.hora.noVios}</span>
                ) : (
                  <NaoVeio>Não veio do robô: confira no VIOS</NaoVeio>
                )
              }
            />
          ) : null}
          <Linha
            icone={UserRound}
            rotulo="Responsável"
            situacao={responsavel.situacao}
            pedido={<PessoasCurtas texto={item.responsavel} fotos={fotos} />}
            noVios={
              responsavel.noVios.length ? (
                <span className="block space-y-1">
                  <PessoasCurtas texto={gravada?.responsaveis ?? null} fotos={fotos} />
                  {responsavel.faltando.length ? (
                    <span className="block text-[11px] font-medium">Falta: {responsavel.faltando.join(", ")}</span>
                  ) : null}
                </span>
              ) : (
                <NaoVeio />
              )
            }
          />
          {item.revisor ? (
            <Linha
              icone={UserCheck}
              rotulo="Revisor"
              dica={
                revisorFicaNaTarefa(item.tarefa)
                  ? "Na Sessão de Julgamento o revisor fica na própria tarefa, junto com o responsável."
                  : "O robô não devolve o revisor da tarefa. No VIOS, aparecem aqui as tarefas Revisar do fluxo e quem está nelas."
              }
              situacao={revisorNaTarefa ? "confere" : null}
              pedido={<PessoasCurtas texto={item.revisor} fotos={fotos} />}
              noVios={
                revisorNaTarefa ? (
                  <PessoasCurtas texto={item.revisor} fotos={fotos} />
                ) : revisorNaTarefa === false ? (
                  <NaoVeio>Não está na tarefa: confira no VIOS</NaoVeio>
                ) : (
                  <RevisoresNoVios item={item} fotos={fotos} hoje={hoje} />
                )
              }
            />
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** Datas do fluxo que o jurídico escolheu: o robô grava depois de lançar; aqui se confere se ficaram no VIOS. */
function DatasDoFluxo({ comparacao, hoje }: { comparacao: ComparacaoDaTarefa; hoje: string }) {
  if (!comparacao.datasDoFluxo.length) return null;
  return (
    <div className="overflow-hidden rounded-md border border-[#e6eef0]">
      <p className="flex items-center gap-1.5 border-b border-[#e6eef0] bg-[#f7fbfc] px-3 py-1.5 text-xs font-semibold text-[#285f7a]">
        <Workflow className="size-3.5" aria-hidden />
        Datas do fluxo escolhidas pelo jurídico
      </p>
      <ul className="divide-y divide-[#eef3f5]">
        {comparacao.datasDoFluxo.map((doFluxo) => (
          <li
            key={doFluxo.caminho.join(" › ")}
            className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-xs", doFluxo.situacao === "diverge" && "bg-amber-50")}
          >
            <span className="min-w-0 flex-1 font-medium text-foreground" title={doFluxo.caminho.join(" › ")}>
              {doFluxo.nome}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">pedido</span>
              <DiaNaAgenda data={doFluxo.pedido} hoje={hoje} />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">no VIOS</span>
              {doFluxo.noVios.length ? (
                doFluxo.noVios.map((data, indice) => <DiaNaAgenda key={`${data}-${indice}`} data={data} hoje={hoje} />)
              ) : (
                <NaoVeio />
              )}
            </span>
            <MarcaDoCampo situacao={doFluxo.situacao} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Os cartões do Check, na coluna ao lado da publicação. `onApontar`: botão "Apontar esta divergência" no cartão
 * divergente (abre o registro da inconsistência já com o texto da divergência).
 */
export function CartoesCheck({
  agendamentos,
  fotos,
  hoje,
  onApontar,
}: {
  agendamentos: AgendamentoResumo[];
  fotos: Record<string, string>;
  hoje: string;
  onApontar?: (agendamento: AgendamentoResumo) => void;
}) {
  if (!agendamentos.length) return <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhuma tarefa nesta vistagem.</p>;
  const total = agendamentos.length;
  return (
    <ol className="space-y-4 px-3 pb-4">
      {agendamentos.map((item, indice) => {
        const Icone = ICONE_CLASSE[item.etiqueta];
        const comparacao = compararTarefa(item);
        const simulada = item.envioStatus === "concluido" && item.envioSimulado;
        return (
          <li
            key={item.id}
            aria-label={total > 1 ? `Tarefa ${indice + 1} de ${total}: ${item.tarefa}` : item.tarefa}
            className={cn(
              "overflow-hidden rounded-lg border bg-white shadow-[0_1px_3px_rgba(16,41,58,0.08)]",
              comparacao.situacao === "diverge" ? "border-amber-300" : "border-[#d3e2e6]"
            )}
          >
            <header className="flex items-start gap-3 border-b border-[#eef3f5] bg-[#fafcfc] px-4 py-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-md ring-1", ESTILO_CLASSE[item.etiqueta])} aria-hidden>
                <Icone className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {total > 1 ? (
                    <span className="mr-0.5 text-[11px] font-semibold uppercase tabular-nums text-[#285f7a]">
                      Tarefa {indice + 1} de {total}
                    </span>
                  ) : null}
                  <Selo tom={TOM_CLASSE[item.etiqueta]}>{ROTULO_ETIQUETA[item.etiqueta]}</Selo>
                  <SeloSituacao situacao={comparacao.situacao} />
                  {simulada ? (
                    <Selo tom="alerta" icone={Bot}>
                      Simulada
                    </Selo>
                  ) : item.envioStatus !== "concluido" ? (
                    <Selo tom={ENVIO[item.envioStatus].tom} icone={Bot}>
                      {ENVIO[item.envioStatus].rotulo}
                    </Selo>
                  ) : null}
                  {comparacao.ci ? (
                    <span className="ml-auto">
                      <LinkVios ci={comparacao.ci} />
                    </span>
                  ) : null}
                </div>
                <p className="break-words font-semibold text-foreground">{item.tarefa}</p>
                {item.etiqueta === "PRAZO" && item.dataFatal ? (
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <Flag className="size-3.5 text-red-600" aria-hidden />
                    Fatal <span className="font-semibold tabular-nums text-red-700">{formatarData(item.dataFatal)}</span>
                    {item.diasPrazo && item.contagemPrazo ? <span>· {item.diasPrazo} {ROTULO_CONTAGEM[item.contagemPrazo]} após a publicação</span> : null}
                  </p>
                ) : null}
                {item.observacao ? <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{item.observacao}</p> : null}
                {simulada ? <p className="text-xs text-muted-foreground">Preenchida no VIOS, não gravada.</p> : null}
                {item.envioErro ? <p className="whitespace-pre-wrap break-words text-xs text-red-700">{item.envioErro}</p> : null}
              </div>
            </header>

            <div className="space-y-3 px-4 py-3.5">
              {!comparacao.gravada ? (
                <p className="flex items-start gap-1.5 rounded-md border border-[#e6eef0] bg-[#f7fbfc] px-3 py-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
                  {comparacao.ci
                    ? "O robô não devolveu como a tarefa ficou no VIOS. Confira pelo CI."
                    : "O robô não devolveu o CI nem como a tarefa ficou no VIOS. Procure a tarefa na pasta."}
                </p>
              ) : null}
              <Comparacao item={item} comparacao={comparacao} fotos={fotos} hoje={hoje} />
              <DatasDoFluxo comparacao={comparacao} hoje={hoje} />
              <AgendaNoVios item={item} fotos={fotos} hoje={hoje} />
              {onApontar && comparacao.situacao === "diverge" ? (
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="outline" onClick={() => onApontar(item)} className="border-amber-300 text-amber-900 hover:bg-amber-50">
                    <TriangleAlert />
                    Apontar esta divergência
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
