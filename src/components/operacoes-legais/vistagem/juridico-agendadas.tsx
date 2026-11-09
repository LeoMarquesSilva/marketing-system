"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bot, CalendarCheck, CalendarDays, ChevronRight, CircleAlert, Flag, Layers, Search, ShieldAlert, TriangleAlert, Undo2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { ROTULO_ETIQUETA, chaveNome, nomesDasPessoas } from "@/lib/vistagem/agendamento";
import { camposDaConferencia, combinaCampos } from "@/lib/vistagem/busca";
import { compararTarefa } from "@/lib/vistagem/check";
import { nomeCurto, partesDaData } from "@/lib/vistagem/como-fica-no-vios";
import { descricaoDoTribunal } from "@/lib/vistagem/tribunais";
import type { AgendadasJuridicoResposta, AgendamentoResumo, ConferenciaItem } from "@/lib/vistagem/types";
import { SeloAberturaDePasta, SituacaoNaCentral } from "./abertura-pasta";
import { DetalheAgendada } from "./agendada-detalhe";
import { AvatarPessoa } from "./combobox-busca";
import {
  EsteiraCompacta,
  SITUACAO_AGENDADA,
  SITUACOES_AGENDADA,
  devolucoesDe,
  etapasDaEsteira,
  situacaoAgendada,
  temErroNoRobo,
  type SituacaoAgendada,
} from "./esteira-agendada";
import type { NavegacaoNaFila } from "./faixa-processo";
import { IconeTribunal, LogoGrupo, SeloArea } from "./marcas";
import { formatarData, formatarDataHora } from "./publicacao-ui";
import { IconeOpcao, Seletor } from "./seletor";
import { DiaNaAgenda, ESTILO_CLASSE, ICONE_CLASSE, LinkVios, corDoTextoDoEnvio, envioDaTarefa } from "./tarefas-conferencia";
import { Aviso, Carregando, Painel, Selo, Vazio } from "./ui";

/** Filtro por situação; vazio é "Todas". */
type Filtro = "" | SituacaoAgendada;

/** Nome de cada situação no filtro (no plural, como uma lista). */
const NO_FILTRO: Record<SituacaoAgendada, string> = {
  conferencia: "Na conferência",
  robo: "Com o robô",
  agendada: "Agendadas",
  checada: "Checadas",
  revisao: "Em revisão",
  central: "Abertura de pasta",
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const FUSO = "America/Sao_Paulo";

const hojeDoNavegador = () => new Date().toLocaleDateString("sv-SE", { timeZone: FUSO });

/** Dia (AAAA-MM-DD, em Brasília) em que a publicação foi vistada. */
function diaDaVistagem(iso: string | null): string | null {
  return iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: FUSO }) : null;
}

/** "23:23", no fuso de Brasília. */
function horaDe(iso: string | null): string | null {
  return iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : null;
}

function diaAnterior(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia - 1)).toISOString().slice(0, 10);
}

/** Cabeçalho do dia: "Hoje" e "Ontem" com a data ao lado; os outros dias, só a data ("seg, 03/11"). */
function tituloDoDia(dia: string | null, hoje: string): { titulo: string; data: string | null } {
  if (!dia) return { titulo: "Sem data", data: null };
  const partes = partesDaData(dia);
  const [, mes] = dia.split("-");
  const data = `${partes.semana}, ${partes.dia}/${mes}`;
  if (dia === hoje) return { titulo: "Hoje", data };
  if (dia === diaAnterior(hoje)) return { titulo: "Ontem", data };
  return { titulo: data, data: null };
}

/* ------------------------------------------------------------ filtro */

/** Filtro por situação no desktop: botões com ícone e contagem, no desenho do Segmented. */
function FiltroSituacao({ valor, onChange, contagens, total }: { valor: Filtro; onChange: (valor: Filtro) => void; contagens: Map<SituacaoAgendada, number>; total: number }) {
  const opcoes: { valor: Filtro; rotulo: string; descricao: string; icone: LucideIcon; contagem: number }[] = [
    { valor: "", rotulo: "Todas", descricao: "Tudo o que foi vistado no período", icone: Layers, contagem: total },
    ...SITUACOES_AGENDADA.map((situacao) => ({
      valor: situacao,
      rotulo: NO_FILTRO[situacao],
      descricao: SITUACAO_AGENDADA[situacao].descricao,
      icone: SITUACAO_AGENDADA[situacao].icone,
      contagem: contagens.get(situacao) ?? 0,
    })),
  ];
  return (
    <div role="radiogroup" aria-label="Situação" className="inline-flex flex-wrap rounded-md border border-input bg-white p-0.5">
      {opcoes.map((opcao) => {
        const escolhida = opcao.valor === valor;
        const Icone = opcao.icone;
        const alerta = opcao.valor === "revisao" && opcao.contagem > 0;
        return (
          <button
            key={opcao.valor || "todas"}
            type="button"
            role="radio"
            aria-checked={escolhida}
            title={opcao.descricao}
            onClick={() => onChange(opcao.valor)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-[5px] px-2.5 text-sm transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
              escolhida
                ? "bg-[#347796] font-medium text-white"
                : opcao.contagem
                  ? "text-foreground hover:bg-[#47cdd0]/10"
                  : "text-muted-foreground hover:bg-[#47cdd0]/10 hover:text-foreground"
            )}
          >
            <Icone className={cn("size-4", !escolhida && (alerta ? "text-red-600" : "text-[#3e84a8]"), !escolhida && !opcao.contagem && "opacity-50")} aria-hidden />
            {opcao.rotulo}
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[11px] font-medium tabular-nums",
                escolhida ? "bg-white/20 text-white" : alerta ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200" : "bg-[#eef4f6] text-[#285f7a]"
              )}
            >
              {opcao.contagem}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ cartão */

/** Responsável da tarefa: fotos sobrepostas e o nome curto (o inteiro no título). */
function Responsavel({ texto, fotos }: { texto: string; fotos: Record<string, string> }) {
  const nomes = nomesDasPessoas(texto);
  if (!nomes.length) return <span className="text-xs text-muted-foreground">Não informado</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={`Responsável: ${nomes.join(", ")}`}>
      <span className="flex shrink-0 -space-x-1.5">
        {nomes.slice(0, 3).map((nome) => (
          <AvatarPessoa key={nome} nome={nome} foto={fotos[chaveNome(nome)]} className="size-6 ring-2 ring-white" />
        ))}
      </span>
      <span className="min-w-0 truncate text-xs text-foreground">
        {nomeCurto(nomes[0])}
        {nomes.length > 1 ? <span className="text-muted-foreground"> +{nomes.length - 1}</span> : null}
      </span>
    </span>
  );
}

/** Uma tarefa no cartão, em uma linha no desktop: classe, nome, data no VIOS, responsável e a situação no robô com o CI (abertura de pasta não passa pelo robô). */
function LinhaTarefa({ item, fotos, hoje, semRobo = false }: { item: AgendamentoResumo; fotos: Record<string, string>; hoje: string; semRobo?: boolean }) {
  const Icone = ICONE_CLASSE[item.etiqueta];
  const simulada = item.envioStatus === "concluido" && item.envioSimulado;
  const doFluxo = (item.viosTarefas ?? []).filter((tarefa) => !tarefa.principal).length;
  const ci = item.viosTarefaId ?? item.viosTarefas?.find((tarefa) => tarefa.principal)?.ci ?? null;
  const envio = envioDaTarefa(item);
  // Pedido × o que o robô gravou: só quando o robô já devolveu a tarefa (sem o dado, não há o que comparar).
  const divergencias = item.viosTarefas?.length ? compararTarefa(item).divergencias : [];
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 @3xl:grid-cols-[2rem_minmax(0,1fr)_8.5rem_minmax(0,11rem)_minmax(0,15rem)]">
      <span className={cn("grid size-8 place-items-center rounded-md ring-1", ESTILO_CLASSE[item.etiqueta])} aria-hidden>
        <Icone className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground" title={item.tarefa}>
          {item.tarefa}
        </p>
        <p className="flex flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
          <span>{ROTULO_ETIQUETA[item.etiqueta]}</span>
          {item.etiqueta === "PRAZO" && item.dataFatal ? (
            <span className="inline-flex items-center gap-1">
              <Flag className="size-3 text-red-600" aria-hidden />
              fatal <span className="font-semibold tabular-nums text-red-700">{formatarData(item.dataFatal).slice(0, 5)}</span>
            </span>
          ) : null}
          {doFluxo ? (
            <span className="inline-flex items-center gap-1" title="Tarefas que o fluxo do VIOS criou junto">
              <Workflow className="size-3 text-[#3e84a8]" aria-hidden />+{doFluxo} do fluxo
            </span>
          ) : null}
          {divergencias.length ? (
            <span className="inline-flex items-center gap-1 font-medium text-amber-800" title={divergencias.map((divergencia) => divergencia.texto).join("; ")}>
              <TriangleAlert className="size-3" aria-hidden />
              VIOS difere do pedido
            </span>
          ) : null}
        </p>
      </div>
      {/* No celular, data, responsável e robô ficam numa linha embaixo do nome; no desktop, cada um na sua coluna. */}
      <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 @3xl:contents">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <CalendarDays className="size-3.5 text-[#3e84a8] @3xl:hidden" aria-hidden />
          <span className="sr-only">{item.etiqueta === "PRAZO" ? "Enviar no VIOS:" : "Data no VIOS:"}</span>
          <DiaNaAgenda data={item.data} hoje={hoje} />
          {item.hora ? <span className="text-xs tabular-nums text-muted-foreground">às {item.hora}</span> : null}
        </span>
        <Responsavel texto={item.responsavel} fotos={fotos} />
        {semRobo ? null : (
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {simulada ? (
            <Selo tom="alerta" icone={Bot}>
              Simulada
            </Selo>
          ) : (
            <Selo tom={envio.tom} icone={item.envioStatus === "erro" ? CircleAlert : item.envioStatus === "concluido" ? CalendarCheck : Bot}>
              {envio.rotulo}
            </Selo>
          )}
          {/* O link fica acima do botão que cobre o cartão. */}
          {ci ? (
            <span className="relative z-10">
              <LinkVios ci={ci} />
            </span>
          ) : null}
        </span>
        )}
      </div>
      {item.envioErro ? <p className={cn("col-span-full whitespace-pre-wrap break-words pl-11 text-xs", corDoTextoDoEnvio(item))}>{item.envioErro}</p> : null}
    </li>
  );
}

/**
 * Uma publicação vistada: quem é (logo, processo, grupo, área, tribunal e quem vistou, com foto), a esteira até o
 * check e as tarefas. O cartão inteiro abre o detalhe; o botão é o número do processo.
 */
function CartaoAgendada({ item, fotos, hoje, onAbrir }: { item: ConferenciaItem; fotos: Record<string, string>; hoje: string; onAbrir: () => void }) {
  const { publicacao } = item;
  const base = `agendada-${publicacao.id}`;
  const processo = publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal;
  const situacao = situacaoAgendada(item);
  const devolucoes = devolucoesDe(item);
  const erroNoRobo = situacao === "robo" && temErroNoRobo(item);
  const erroNaCentral = situacao === "central" && !publicacao.centralItemId && Boolean(publicacao.centralErro);
  const problema = situacao === "revisao" || erroNoRobo || erroNaCentral;
  const apontada =
    situacao === "revisao"
      ? ([...item.inconsistencias]
          .filter((inconsistencia) => inconsistencia.origem === "agendamento" && !inconsistencia.excluidaEm)
          .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0] ?? null)
      : null;
  const grupo = publicacao.grupoCliente ?? publicacao.cliente;
  return (
    <article
      aria-labelledby={`${base}-processo`}
      className={cn(
        "@container group relative overflow-hidden rounded-lg border bg-white shadow-[0_1px_3px_rgba(16,41,58,0.08)] transition-[border-color,box-shadow] duration-150",
        "hover:shadow-[0_6px_18px_-8px_rgba(16,41,58,0.28)] has-[[data-abrir]:focus-visible]:ring-[3px] has-[[data-abrir]:focus-visible]:ring-[#47cdd0]/40",
        problema ? "border-red-200 hover:border-red-300" : "border-[#d3e2e6] hover:border-[#9fc6d4]"
      )}
    >
      <div className="flex flex-col gap-3 px-4 py-3 @3xl:flex-row @3xl:items-center @3xl:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <LogoGrupo grupo={publicacao.grupoCliente} tamanho="md" className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <button
                type="button"
                data-abrir
                id={`${base}-processo`}
                onClick={onAbrir}
                className="rounded-sm text-sm font-semibold tabular-nums text-[#10293a] underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] group-hover:underline"
              >
                {processo}
                <span className="sr-only"> · ver detalhes</span>
              </button>
              {publicacao.tribunal ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground" title={descricaoDoTribunal(publicacao.tribunal) ?? undefined}>
                  <IconeTribunal sigla={publicacao.tribunal} />
                  {publicacao.tribunal}
                </span>
              ) : null}
              {publicacao.demandaRisco ? (
                <Selo tom="perigo" icone={ShieldAlert}>
                  Risco
                </Selo>
              ) : null}
              <SeloAberturaDePasta publicacao={publicacao} />
              {devolucoes ? (
                <Selo tom="alerta" icone={Undo2}>
                  Devolvida{devolucoes > 1 ? ` ${devolucoes}×` : ""}
                </Selo>
              ) : null}
            </p>
            {/* Estreito, o cliente desce para baixo do grupo: os dois cabem sem cortar o grupo. */}
            <p className="flex min-w-0 flex-col text-sm @lg:flex-row @lg:items-baseline @lg:gap-2">
              <span className="truncate font-medium text-foreground @lg:shrink-0 @lg:max-w-[60%]" title={grupo ?? undefined}>
                {grupo ?? "Sem grupo"}
              </span>
              {publicacao.cliente && publicacao.cliente !== grupo ? (
                <span className="min-w-0 truncate text-xs text-muted-foreground" title={publicacao.cliente}>
                  {publicacao.cliente}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              {publicacao.escritorioResponsavel ? <SeloArea area={publicacao.escritorioResponsavel} /> : <Selo>Sem área</Selo>}
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {item.vistadoPor ? <AvatarPessoa nome={item.vistadoPor} foto={fotos[chaveNome(item.vistadoPor)]} className="size-5 [&_[data-slot=avatar-fallback]]:text-[8px]" /> : null}
                <span className="truncate">
                  Vistada{item.vistadoPor ? (
                    <>
                      {" "}
                      por <span className="font-medium text-foreground">{nomeCurto(item.vistadoPor)}</span>
                    </>
                  ) : null}
                  {horaDe(publicacao.vistadoEm) ? <span className="tabular-nums"> às {horaDe(publicacao.vistadoEm)}</span> : null}
                </span>
              </span>
              {/* Devolvida e vistada de novo: quem refez e quando ("Vistada por" fica com quem analisou primeiro). */}
              {item.revistadoPor && publicacao.revistadoEm ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <AvatarPessoa nome={item.revistadoPor} foto={fotos[chaveNome(item.revistadoPor)]} className="size-5 [&_[data-slot=avatar-fallback]]:text-[8px]" />
                  <span className="truncate">
                    Vistada de novo por <span className="font-medium text-foreground">{nomeCurto(item.revistadoPor)}</span>{" "}
                    <span className="tabular-nums">em {formatarDataHora(publicacao.revistadoEm)}</span>
                  </span>
                </span>
              ) : null}
            </div>
          </div>
          <ChevronRight className="mt-1 size-4 shrink-0 text-[#9fb8c2] transition-colors group-hover:text-[#347796] @3xl:hidden" aria-hidden />
        </div>
        <div className="flex w-full shrink-0 items-center gap-3 @3xl:w-[25rem]">
          <EsteiraCompacta etapas={etapasDaEsteira(item)} className="min-w-0 flex-1" />
          <ChevronRight className="hidden size-4 shrink-0 text-[#9fb8c2] transition-colors group-hover:text-[#347796] @3xl:block" aria-hidden />
        </div>
      </div>

      {situacao === "central" && !erroNaCentral ? (
        <p className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[#e6eef0] bg-[#f6fbfb] px-4 py-2 text-xs text-[#285f7a]">
          <span>Sem pasta no VIOS: a controladoria abre a pasta e agenda pela Central.</span>
          <SituacaoNaCentral publicacao={publicacao} />
        </p>
      ) : null}

      {problema ? (
        <p className="flex items-start gap-2 border-t border-red-100 bg-red-50/70 px-4 py-2 text-xs text-red-800">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {erroNaCentral ? (
            <span className="min-w-0">
              <span className="font-semibold">Não chegou à Central: </span>a controladoria vai tentar de novo.
            </span>
          ) : situacao === "revisao" ? (
            <span className="min-w-0">
              <span className="font-semibold">Em revisão: </span>
              {apontada ? `${apontada.descricao}${apontada.criadoPor ? ` (${nomeCurto(apontada.criadoPor)})` : ""}` : "erro apontado no check."}
            </span>
          ) : (
            <span className="min-w-0">
              <span className="font-semibold">Erro no robô: </span>a controladoria precisa rodar de novo.
            </span>
          )}
        </p>
      ) : null}

      <ul aria-label={`Tarefas de ${processo}`} className="divide-y divide-[#eef3f5] border-t border-[#e6eef0] bg-[#fcfdfd]">
        {item.agendamentos.length ? (
          item.agendamentos.map((agendamento) => <LinhaTarefa key={agendamento.id} item={agendamento} fotos={fotos} hoje={hoje} semRobo={situacao === "central"} />)
        ) : (
          <li className="px-4 py-2.5 text-xs text-muted-foreground">Nenhuma tarefa nesta vistagem.</li>
        )}
      </ul>
    </article>
  );
}

/* ------------------------------------------------------------ tela */

/**
 * Visão do jurídico, só de consulta: o que já foi vistado nos últimos dias, das suas áreas, por dia, e onde cada
 * publicação está na esteira (conferência, robô, agendada no VIOS, checada, em revisão ou abertura de pasta). Cada cartão abre o detalhe.
 */
export function AgendadasJuridico({ escritorio, busca }: { escritorio: string; busca: string }) {
  const [dados, setDados] = useState<AgendadasJuridicoResposta | null>(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("");
  /** Publicação aberta no detalhe. */
  const [aberta, setAberta] = useState<string | null>(null);

  // Trocar a área remonta o componente (key), então o estado já começa vazio.
  useEffect(() => {
    let cancelado = false;
    authFetch(`/api/operacoes-legais/vistagem/juridico/agendadas${escritorio ? `?escritorio=${encodeURIComponent(escritorio)}` : ""}`)
      .then(async (resposta) => {
        const corpo = (await resposta.json()) as Partial<AgendadasJuridicoResposta> & { error?: string };
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar o que foi agendado.");
        if (cancelado) return;
        setDados({ itens: corpo.itens ?? [], fotos: corpo.fotos ?? {}, hoje: corpo.hoje ?? hojeDoNavegador(), dias: corpo.dias ?? 30 });
      })
      .catch((e) => {
        if (cancelado) return;
        setErro(e instanceof Error ? e.message : "Falha ao carregar o que foi agendado.");
        setDados({ itens: [], fotos: {}, hoje: hojeDoNavegador(), dias: 30 });
      });
    return () => {
      cancelado = true;
    };
  }, [escritorio]);

  const itens = useMemo(() => dados?.itens ?? [], [dados]);
  const fotos = dados?.fotos ?? {};
  const hoje = dados?.hoje ?? hojeDoNavegador();

  // O que a busca olha em cada publicação (inclui as partes do texto): montado uma vez por carga, não a cada letra.
  const camposDeBusca = useMemo(() => new Map(itens.map((item) => [item.publicacao.id, [...camposDaConferencia(item), item.checadoPor ?? ""]])), [itens]);
  const daBusca = useMemo(() => itens.filter((item) => combinaCampos(camposDeBusca.get(item.publicacao.id) ?? [], busca)), [itens, busca, camposDeBusca]);
  const contagens = useMemo(() => {
    const mapa = new Map<SituacaoAgendada, number>();
    for (const item of daBusca) {
      const situacao = situacaoAgendada(item);
      if (situacao) mapa.set(situacao, (mapa.get(situacao) ?? 0) + 1);
    }
    return mapa;
  }, [daBusca]);
  const filtrada = useMemo(() => (filtro ? daBusca.filter((item) => situacaoAgendada(item) === filtro) : daBusca), [daBusca, filtro]);

  const blocos = useMemo(() => {
    const porDia = new Map<string, ConferenciaItem[]>();
    for (const item of filtrada) {
      const dia = diaDaVistagem(item.publicacao.vistadoEm) ?? "";
      porDia.set(dia, [...(porDia.get(dia) ?? []), item]);
    }
    return [...porDia.entries()];
  }, [filtrada]);

  // Setas do detalhe: andam na ordem da tela (dia mais novo primeiro), dentro do filtro e da busca.
  const ordem = blocos.flatMap(([, lista]) => lista.map((item) => item.publicacao.id));
  const indice = aberta ? ordem.indexOf(aberta) : -1;
  const itemAberto = aberta ? (itens.find((item) => item.publicacao.id === aberta) ?? null) : null;
  const navegacao: NavegacaoNaFila | null =
    indice >= 0 ? { posicao: indice + 1, total: ordem.length, anterior: ordem[indice - 1] ?? null, proxima: ordem[indice + 1] ?? null } : null;

  if (dados === null) {
    return (
      <Painel>
        <Carregando rotulo="Carregando o que foi agendado" />
      </Painel>
    );
  }

  const tarefas = filtrada.reduce((soma, item) => soma + item.agendamentos.length, 0);
  const devolvidas = filtrada.filter((item) => devolucoesDe(item) > 0).length;

  return (
    <div className="space-y-3">
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {!itens.length ? (
        !erro ? (
          <Painel>
            <Vazio icone={CalendarCheck} titulo="Nada vistado nos últimos dias">
              O que for vistado nos últimos {dados.dias} dias aparece aqui, com a situação de cada tarefa no VIOS.
            </Vazio>
          </Painel>
        ) : null
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="hidden lg:block">
              <FiltroSituacao valor={filtro} onChange={setFiltro} contagens={contagens} total={daBusca.length} />
            </div>
            <Seletor
              rotulo="Situação"
              className="sm:w-64 lg:hidden"
              valor={filtro}
              onChange={(valor) => setFiltro(valor as Filtro)}
              todos={{ rotulo: "Todas as situações", descricao: "Tudo o que foi vistado no período", contagem: daBusca.length, icone: <IconeOpcao icone={Layers} /> }}
              opcoes={SITUACOES_AGENDADA.map((situacao) => ({
                valor: situacao,
                rotulo: NO_FILTRO[situacao],
                descricao: SITUACAO_AGENDADA[situacao].descricao,
                contagem: contagens.get(situacao) ?? 0,
                icone: (
                  <IconeOpcao
                    icone={SITUACAO_AGENDADA[situacao].icone}
                    className={situacao === "revisao" ? "bg-red-50 text-red-700 ring-red-200" : situacao === "checada" || situacao === "agendada" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : undefined}
                  />
                ),
              }))}
            />
            <p className="text-xs text-muted-foreground lg:ml-auto" aria-live="polite">
              <span className="font-semibold tabular-nums text-foreground">{filtrada.length}</span> {filtrada.length === 1 ? "publicação" : "publicações"} ·{" "}
              <span className="tabular-nums">{plural(tarefas, "tarefa", "tarefas")}</span>
              {devolvidas ? <span className="text-amber-800"> · {plural(devolvidas, "devolvida", "devolvidas")} antes</span> : null}
            </p>
          </div>

          {!filtrada.length ? (
            <Painel>
              <Vazio icone={Search} titulo={filtro ? `Nenhuma publicação ${NO_FILTRO[filtro].toLowerCase()}${busca.trim() ? " com essa busca" : ""}` : "Nenhuma publicação com essa busca"}>
                {filtro ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setFiltro("")}>
                    Ver todas as situações
                  </Button>
                ) : null}
              </Vazio>
            </Painel>
          ) : (
            // No desktop a lista rola por dentro (o main do app não deixa o cabeçalho do dia ficar fixo na página).
            <div className="lg:-mr-2 lg:h-[calc(100dvh-14rem)] lg:min-h-[24rem] lg:overflow-y-auto lg:pr-2">
              {blocos.map(([dia, lista]) => {
                const { titulo, data } = tituloDoDia(dia || null, hoje);
                const idDia = `agendadas-dia-${dia || "sem-data"}`;
                return (
                  <section key={dia || "sem-data"} aria-labelledby={idDia} className="pb-4">
                    <h3 id={idDia} className="sticky top-0 z-20 flex items-center gap-2 bg-background pb-2 pt-1 text-sm font-semibold text-[#10293a]">
                      <span className="grid size-6 place-items-center rounded-md bg-[#e8f8f8] text-[#3e84a8] ring-1 ring-[#47cdd0]/25" aria-hidden>
                        <CalendarDays className="size-3.5" />
                      </span>
                      <span>
                        {titulo}
                        {data ? <span className="font-normal text-muted-foreground"> · {data}</span> : null}
                      </span>
                      <span className="rounded-full bg-[#eef4f6] px-2 py-px text-[11px] font-medium tabular-nums text-[#285f7a]">
                        {plural(lista.length, "publicação", "publicações")}
                      </span>
                      <span className="h-px flex-1 bg-[#dce9eb]" aria-hidden />
                    </h3>
                    <ul className="space-y-3">
                      {lista.map((item) => (
                        <li key={item.publicacao.id}>
                          <CartaoAgendada item={item} fotos={fotos} hoje={hoje} onAbrir={() => setAberta(item.publicacao.id)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <DetalheAgendada item={itemAberto} fotos={fotos} hoje={hoje} navegacao={navegacao} onAbrir={setAberta} onFechar={() => setAberta(null)} />
    </div>
  );
}
