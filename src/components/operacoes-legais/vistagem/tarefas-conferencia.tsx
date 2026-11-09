"use client";

import { useId, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Bot, CalendarClock, CalendarDays, ChevronDown, CircleCheckBig, ClipboardList, CornerDownRight, ExternalLink, Hourglass, Pencil, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROTULO_ETIQUETA, chaveNome, nomesDasPessoas } from "@/lib/vistagem/agendamento";
import { agendaNoVios, nomeCurto, partesDaData } from "@/lib/vistagem/como-fica-no-vios";
import { ROTULO_CONTAGEM } from "@/lib/vistagem/dias-uteis";
import type { AgendamentoResumo, AjusteNaTarefa, EnvioStatus, MudancaNaTarefa } from "@/lib/vistagem/types";
import { linkTarefaVios } from "@/lib/vistagem/vios-links";
import { AvatarPessoa } from "./combobox-busca";
import { formatarData, formatarDataHora } from "./publicacao-ui";
import { ReguaDatas, relativoAHoje, type MarcoRegua } from "./regua-datas";
import { Selo, TOM_CLASSE, type TomSelo } from "./ui";

type Classe = AgendamentoResumo["etiqueta"];

/** Ícone de cada classe, na mesma família de cores do selo (TOM_CLASSE): categoria, não estado. */
export const ICONE_CLASSE: Record<Classe, LucideIcon> = { PRAZO: Hourglass, PROVIDENCIA: ClipboardList, COMPROMISSO: CalendarClock };

export const ESTILO_CLASSE: Record<Classe, string> = {
  PRAZO: "bg-[#183f50] text-white ring-[#183f50]",
  PROVIDENCIA: "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/30",
  COMPROMISSO: "bg-[#eeedf5] text-[#48466e] ring-[#48466e]/15",
};

/**
 * O robô está esperando a publicação chegar a Intimações do VIOS (tenta de hora em hora; às 17h do dia da publicação,
 * agenda direto na pasta). A fila deixa a tarefa pendente com o motivo no texto do envio.
 */
export function aguardandoOVios(item: Pick<AgendamentoResumo, "envioStatus" | "envioErro">): boolean {
  return item.envioStatus === "pendente" && /^Aguardando a disponibilidade da publicação no VIOS/.test(item.envioErro ?? "");
}

/** Rótulo e tom do envio da tarefa: o do status, ou a espera pelo VIOS (e a volta para a pasta) quando é o caso. */
export function envioDaTarefa(item: Pick<AgendamentoResumo, "envioStatus" | "envioErro">): { rotulo: string; tom: TomSelo } {
  if (aguardandoOVios(item)) return { rotulo: "Aguardando o VIOS", tom: "alerta" };
  if (item.envioStatus === "pendente" && /agendar direto na pasta/.test(item.envioErro ?? "")) return { rotulo: "Vai para a pasta", tom: "alerta" };
  return ENVIO[item.envioStatus];
}

/** Cor do texto do envio: erro do robô em vermelho; aviso da fila (esperando o VIOS, nova tentativa) em âmbar. */
export function corDoTextoDoEnvio(item: Pick<AgendamentoResumo, "envioStatus">): string {
  return item.envioStatus === "erro" ? "text-red-700" : "text-amber-800";
}

export const ENVIO: Record<EnvioStatus, { rotulo: string; tom: TomSelo }> = {
  nao_enviado: { rotulo: "Não enviada", tom: "neutro" },
  pendente: { rotulo: "Na fila do robô", tom: "marca" },
  enviado: { rotulo: "Com o robô", tom: "marca" },
  processando: { rotulo: "Agendando no VIOS", tom: "marca" },
  concluido: { rotulo: "Agendada", tom: "sucesso" },
  erro: { rotulo: "Erro no robô", tom: "perigo" },
};

export function LinkVios({ ci }: { ci: string }) {
  return (
    <a
      href={linkTarefaVios(ci)}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir a tarefa no VIOS (nova aba)"
      aria-label={`Abrir a tarefa CI ${ci} no VIOS (nova aba)`}
      className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-[#347796] hover:text-[#285f7a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
    >
      <span className="tabular-nums">CI {ci}</span>
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

/** Uma ou mais pessoas com foto (ou iniciais) e o nome; vazio mostra o texto de `vazio`. */
export function Pessoas({ texto, fotos, vazio = "—" }: { texto: string | null; fotos: Record<string, string>; vazio?: string }) {
  const nomes = nomesDasPessoas(texto);
  if (!nomes.length) return <span className="text-sm text-muted-foreground">{vazio}</span>;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
      {nomes.map((nome) => (
        <li key={nome} className="flex min-w-0 items-center gap-1.5">
          <AvatarPessoa nome={nome} foto={fotos[chaveNome(nome)]} className="size-7" />
          <span className="min-w-0 break-words text-sm text-foreground">{nome}</span>
        </li>
      ))}
    </ul>
  );
}

function Rotulo({ children }: { children: string }) {
  return <dt className="text-[11px] font-medium text-muted-foreground">{children}</dt>;
}

/** "2. REVISAR" → "Revisar": cabe na régua; o nome inteiro fica na lista do fluxo. */
function rotuloCurto(nome: string): string {
  const semNumero = nome.replace(/^\d+\.\s*/, "").trim().toLowerCase();
  return semNumero.charAt(0).toUpperCase() + semNumero.slice(1);
}

/**
 * No Prazo, a régua mostra a cadeia do prazo, como na vistagem: Enviar (o que vai para o VIOS), Revisar e Protocolar
 * do fluxo e a fatal, em ordem de data. As outras tarefas do fluxo ficam na lista logo abaixo.
 */
function marcosDoPrazo(item: AgendamentoResumo): MarcoRegua[] {
  const cadeia = (item.fluxoPrevisto ?? []).filter(
    (tarefa) => tarefa.quando === "criacao" && tarefa.nivel === 1 && tarefa.data && /revisar|protocolar/i.test(tarefa.nome)
  );
  const meio: MarcoRegua[] = cadeia.map((tarefa) => ({ rotulo: rotuloCurto(tarefa.nome), data: tarefa.data, dica: tarefa.nome }));
  return [
    { rotulo: "Enviar · no VIOS", data: item.data, tom: "marca", dica: "Data da tarefa que vai para o VIOS." },
    ...meio.sort((a, b) => (a.data ?? "").localeCompare(b.data ?? "")),
    { rotulo: "Fatal", data: item.dataFatal, tom: "perigo" },
  ];
}

/** Quem fica na tarefa, na agenda: fotos sobrepostas e o nome curto (o nome inteiro no título). */
function QuemFica({ texto, fotos }: { texto: string | null; fotos: Record<string, string> }) {
  const nomes = nomesDasPessoas(texto);
  if (!nomes.length) return <span className="text-xs text-muted-foreground">Responsável padrão do VIOS</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={nomes.join(", ")}>
      <span className="flex shrink-0 -space-x-1.5">
        {nomes.slice(0, 3).map((nome) => (
          <AvatarPessoa key={nome} nome={nome} foto={fotos[chaveNome(nome)]} className="size-5 ring-2 ring-white [&_[data-slot=avatar-fallback]]:text-[8px]" />
        ))}
      </span>
      <span className="min-w-0 truncate text-xs text-foreground">
        {nomeCurto(nomes[0])}
        {nomes.length > 1 ? <span className="text-muted-foreground"> +{nomes.length - 1}</span> : null}
      </span>
    </span>
  );
}

/** Data numa linha só: "04/11 qua" (com o ano, "16/02/27 ter", quando não é o de hoje). */
export function DiaNaAgenda({ data, hoje }: { data: string | null; hoje: string }) {
  if (!data) return <span className="text-[11px] text-muted-foreground">data do VIOS</span>;
  const partes = partesDaData(data);
  const [, mes] = data.split("-");
  return (
    <span className="whitespace-nowrap text-xs" title={`${formatarData(data)} · ${relativoAHoje(data, hoje)}`}>
      <span className="font-semibold tabular-nums text-[#10293a]">
        {partes.dia}/{mes}
        {partes.ano !== hoje.slice(0, 4) ? `/${partes.ano.slice(2)}` : ""}
      </span>{" "}
      <span className="text-muted-foreground">{partes.semana}</span>
    </span>
  );
}

/**
 * Como a tarefa fica no VIOS, em ordem de data, como uma agenda: a pedida pela vistagem (destacada) e as que o fluxo
 * cria junto, com quem fica em cada uma. Depois do robô, é o que ele gravou, com o CI de cada tarefa.
 */
export function AgendaNoVios({ item, fotos, hoje }: { item: AgendamentoResumo; fotos: Record<string, string>; hoje: string }) {
  const agenda = agendaNoVios(item);
  // Sempre começa aberta; recolher vale só para este cartão, enquanto a tela estiver aberta.
  const [aberta, setAberta] = useState(true);
  const id = useId();
  // Só a tarefa pedida, sem fluxo: a data e o responsável já estão no cartão.
  if (agenda.linhas.length < 2 && !agenda.aoConcluir.length) return null;
  return (
    <section data-tour="cf-fluxo" className="@container overflow-hidden rounded-md border border-[#e6eef0]" aria-label={`Fluxo das tarefas de ${item.tarefa}`}>
      <button
        type="button"
        aria-expanded={aberta}
        aria-controls={id}
        onClick={() => setAberta((atual) => !atual)}
        title={agenda.gravada ? "O que o robô gravou no VIOS" : "O que o VIOS cria junto com esta tarefa; o robô coloca os responsáveis"}
        className="flex w-full items-center gap-2 bg-[#f7fbfc] px-3 py-1.5 text-left transition-colors hover:bg-[#eef6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]/50"
      >
        <Workflow className="size-3.5 shrink-0 text-[#285f7a]" aria-hidden />
        <span className="text-xs font-semibold text-[#285f7a]">Fluxo das tarefas</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          · {agenda.linhas.length} tarefas{agenda.gravada ? ", gravadas pelo robô" : ""}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-[#347796]">
          {aberta ? "Recolher" : "Expandir"}
          <ChevronDown className={cn("size-3.5 transition-transform", !aberta && "-rotate-90")} aria-hidden />
        </span>
      </button>
      <div id={id} hidden={!aberta} className="border-t border-[#e6eef0]">
        <ol className="divide-y divide-[#eef3f5]">
          {agenda.linhas.map((linha) => {
            const dataMudou = linha.editada || Boolean(linha.data && linha.dataVios && linha.data !== linha.dataVios);
            return (
              <li
                key={linha.chave}
                className={cn(
                  "grid grid-cols-[4.75rem_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-1 px-3 py-1.5 @sm:grid-cols-[4.75rem_minmax(0,1fr)_minmax(0,8.5rem)]",
                  linha.principal && "bg-[#f2fbfb]"
                )}
              >
                <DiaNaAgenda data={linha.data} hoje={hoje} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className={cn("break-words text-xs", linha.principal ? "font-semibold text-[#10293a]" : "font-medium text-foreground")}>{linha.nome}</span>
                    {linha.principal ? <Selo tom="marca" className="px-1.5 py-0 text-[11px]">esta tarefa</Selo> : null}
                    {linha.hora ? <span className="text-[11px] tabular-nums text-muted-foreground">às {linha.hora}</span> : null}
                    {linha.ci ? <LinkVios ci={linha.ci} /> : null}
                  </p>
                  {linha.criadaPor ? (
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <CornerDownRight className="size-3 shrink-0" aria-hidden />
                      criada por {linha.criadaPor}
                    </p>
                  ) : null}
                  {dataMudou ? (
                    <p className="text-[11px] text-amber-800">
                      Data alterada{linha.dataVios ? ` · o VIOS daria ${formatarData(linha.dataVios)}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="col-start-2 min-w-0 self-center @sm:col-start-3">
                  <QuemFica texto={linha.responsaveis} fotos={fotos} />
                </div>
              </li>
            );
          })}
        </ol>
        {agenda.aoConcluir.length ? (
          <p className="flex items-start gap-1.5 border-t border-[#e6eef0] bg-[#fafcfc] px-3 py-1.5 text-[11px] text-muted-foreground">
            <CircleCheckBig className="mt-0.5 size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
            <span>
              Ao concluir esta tarefa, o VIOS cria <span className="font-medium text-foreground">{agenda.aoConcluir.join(", ")}</span> (responsável padrão do
              VIOS).
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** O que muda ou mudou numa tarefa: "Data fatal: 20/11/2026 → 24/11/2026". */
export function ListaDeMudancas({ mudancas }: { mudancas: MudancaNaTarefa[] }) {
  return (
    <ul className="space-y-0.5 text-xs text-foreground">
      {mudancas.map((mudanca) => (
        <li key={mudanca.campo} className="break-words">
          <span className="font-medium">{mudanca.campo}:</span> <span className="text-muted-foreground">{mudanca.de}</span>
          <ArrowRight className="mx-1 inline size-3 text-muted-foreground" aria-label="passou para" />
          {mudanca.para}
        </li>
      ))}
    </ul>
  );
}

/** O que a controladoria ajustou na tarefa, com quem e quando: a data e o responsável não são mais os que o jurídico vistou. */
function AjustesDaTarefa({ ajustes }: { ajustes: AjusteNaTarefa[] }) {
  return (
    <section aria-label="Ajustes feitos na conferência" className="space-y-2 rounded-md border border-[#dce9eb] bg-[#f7fbfc] px-3 py-2">
      {ajustes.map((ajuste) => (
        <div key={ajuste.em} className="space-y-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-[#285f7a]">
            <Pencil className="size-3 shrink-0" aria-hidden />
            Ajustada na conferência{ajuste.por ? ` por ${ajuste.por}` : ""}
            <span className="font-normal tabular-nums text-muted-foreground">{formatarDataHora(ajuste.em)}</span>
          </p>
          <ListaDeMudancas mudancas={ajuste.mudancas} />
        </div>
      ))}
    </section>
  );
}

/**
 * Tarefas da vistagem em cartões separados e numerados, para a coluna ao lado da publicação (conferência): classe
 * com ícone, data (no Prazo, a régua até a fatal), responsável e revisor com foto, a situação no robô e a agenda do VIOS.
 * Com `onEditar`, as tarefas em que `podeEditar` vale têm o lápis para ajustar data e responsáveis.
 */
export function CartoesTarefas({
  agendamentos,
  comEnvio,
  fotos,
  hoje,
  onEditar,
  podeEditar,
}: {
  agendamentos: AgendamentoResumo[];
  comEnvio: boolean;
  fotos: Record<string, string>;
  hoje: string;
  onEditar?: (agendamento: AgendamentoResumo) => void;
  podeEditar?: (agendamento: AgendamentoResumo) => boolean;
}) {
  if (!agendamentos.length) return <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhuma tarefa nesta vistagem.</p>;
  const total = agendamentos.length;
  return (
    // O fundo vem da coluna (conferência): os cartões ficam sobre ele, até o fim da tela.
    <ol className="space-y-4 px-3 pb-4">
      {agendamentos.map((item, indice) => {
        const Icone = ICONE_CLASSE[item.etiqueta];
        const simulada = item.envioStatus === "concluido" && item.envioSimulado;
        const prazoComFatal = item.etiqueta === "PRAZO" && item.dataFatal;
        return (
          <li
            key={item.id}
            aria-label={total > 1 ? `Tarefa ${indice + 1} de ${total}: ${item.tarefa}` : item.tarefa}
            className="overflow-hidden rounded-lg border border-[#d3e2e6] bg-white shadow-[0_1px_3px_rgba(16,41,58,0.08)]"
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
                  {comEnvio ? (
                    simulada ? (
                      <Selo tom="alerta" icone={Bot}>
                        Simulada
                      </Selo>
                    ) : (
                      <Selo tom={envioDaTarefa(item).tom} icone={Bot}>
                        {envioDaTarefa(item).rotulo}
                        {item.envioSimulado ? " (simulação)" : ""}
                      </Selo>
                    )
                  ) : null}
                  {comEnvio && item.viosTarefaId ? <LinkVios ci={item.viosTarefaId} /> : null}
                </div>
                <p className="break-words font-semibold text-foreground">{item.tarefa}</p>
                {item.observacao ? <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{item.observacao}</p> : null}
                {simulada ? <p className="text-xs text-muted-foreground">Preenchida no VIOS, não gravada.</p> : null}
                {item.envioErro ? <p className={cn("whitespace-pre-wrap break-words text-xs", corDoTextoDoEnvio(item))}>{item.envioErro}</p> : null}
              </div>
              {onEditar && podeEditar?.(item) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 bg-white"
                  title="Ajustar data e responsáveis desta tarefa, sem devolver ao jurídico"
                  aria-label={`Editar data e responsáveis de ${item.tarefa}`}
                  onClick={() => onEditar(item)}
                >
                  <Pencil />
                  Editar
                </Button>
              ) : null}
            </header>

            <div className="space-y-3 px-4 py-3.5">
              {item.ajustes?.length ? <AjustesDaTarefa ajustes={item.ajustes} /> : null}
              {prazoComFatal ? (
                <div className="space-y-1.5 rounded-md border border-[#e6eef0] bg-white px-3 py-2">
                  <ReguaDatas rotulo={`Datas de ${item.tarefa}`} hoje={hoje} marcos={marcosDoPrazo(item)} />
                  {item.diasPrazo && item.contagemPrazo ? (
                    <p className="text-[11px] text-muted-foreground">
                      {item.diasPrazo} {ROTULO_CONTAGEM[item.contagemPrazo]} após a publicação
                    </p>
                  ) : null}
                </div>
              ) : null}

              <dl className="grid gap-x-4 gap-y-3 @md:grid-cols-2">
                {!prazoComFatal ? (
                  <div className="space-y-1 @md:col-span-2">
                    <Rotulo>{item.etiqueta === "COMPROMISSO" ? "Data e horário" : "Data no VIOS"}</Rotulo>
                    <dd className="flex items-center gap-1.5 text-sm tabular-nums text-foreground">
                      <CalendarDays className="size-4 text-[#3e84a8]" aria-hidden />
                      {formatarData(item.data)}
                      {item.hora ? ` às ${item.hora}${item.horaFim ? ` até ${item.horaFim}` : ""}` : ""}
                      {item.dataLimite && item.dataLimite !== item.data ? ` · limite ${formatarData(item.dataLimite)}` : ""}
                    </dd>
                  </div>
                ) : null}
                <div className="min-w-0 space-y-1">
                  <Rotulo>Responsável</Rotulo>
                  <dd>
                    <Pessoas texto={item.responsavel} fotos={fotos} />
                  </dd>
                </div>
                <div className="min-w-0 space-y-1">
                  <Rotulo>Revisor</Rotulo>
                  <dd>
                    <Pessoas texto={item.revisor} fotos={fotos} vazio="Sem revisor" />
                  </dd>
                </div>
              </dl>

              <AgendaNoVios item={item} fotos={fotos} hoje={hoje} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
