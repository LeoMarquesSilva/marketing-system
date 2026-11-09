"use client";

import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Bot, CalendarCheck, Check, CircleAlert, FolderPlus, SearchCheck, Stamp, TriangleAlert, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { chaveNome } from "@/lib/vistagem/agendamento";
import type { ConferenciaItem, PublicacaoStatus } from "@/lib/vistagem/types";
import { AvatarPessoa } from "./combobox-busca";
import { formatarDataHora } from "./publicacao-ui";
import type { TomSelo } from "./ui";

/**
 * Esteira da publicação depois da vistagem do jurídico: Vistada → Conferência → Robô → Agendada no VIOS → Checada.
 * Sem pasta no VIOS, é mais curta: Vistada → Central do SharePoint (pedido de abertura de pasta).
 * Tudo vem da situação gravada (status, quem e quando); nada é deduzido.
 */

/** Onde a publicação está, para o filtro da visão Agendadas. */
export type SituacaoAgendada = "conferencia" | "robo" | "agendada" | "checada" | "revisao" | "central";

export const SITUACOES_AGENDADA: SituacaoAgendada[] = ["conferencia", "robo", "agendada", "checada", "revisao", "central"];

export const SITUACAO_AGENDADA: Record<SituacaoAgendada, { rotulo: string; descricao: string; icone: LucideIcon; tom: TomSelo }> = {
  conferencia: { rotulo: "Na conferência", descricao: "A controladoria confere a vistagem", icone: SearchCheck, tom: "neutro" },
  robo: { rotulo: "Com o robô", descricao: "Conferida; o robô agenda no VIOS", icone: Bot, tom: "marca" },
  agendada: { rotulo: "Agendada no VIOS", descricao: "No VIOS; falta o check da controladoria", icone: CalendarCheck, tom: "sucesso" },
  checada: { rotulo: "Checada", descricao: "A controladoria conferiu no VIOS", icone: BadgeCheck, tom: "sucesso" },
  revisao: { rotulo: "Em revisão", descricao: "Erro apontado no check, aguarda correção", icone: TriangleAlert, tom: "perigo" },
  central: { rotulo: "Abertura de pasta", descricao: "Sem pasta no VIOS: a controladoria agenda pela Central do SharePoint", icone: FolderPlus, tom: "marca" },
};

const POR_STATUS: Partial<Record<PublicacaoStatus, SituacaoAgendada>> = {
  controladoria_vistar: "conferencia",
  pronto_para_agendar: "robo",
  agendado: "agendada",
  checado: "checada",
  revisar: "revisao",
  abertura_pasta: "central",
};

/** Situação da publicação na visão Agendadas; null para um status que não deveria estar nela. */
export function situacaoAgendada(item: ConferenciaItem): SituacaoAgendada | null {
  return POR_STATUS[item.publicacao.status] ?? null;
}

/** Quantas vezes a conferência devolveu: as inconsistências do jurídico (uma por devolução); sem elas, 1 se há data de devolução. */
export function devolucoesDe(item: ConferenciaItem): number {
  const doJuridico = item.inconsistencias.filter((inconsistencia) => inconsistencia.origem === "juridico").length;
  return doJuridico || (item.publicacao.devolvidoEm ? 1 : 0);
}

export const temErroNoRobo = (item: ConferenciaItem) => item.agendamentos.some((agendamento) => agendamento.envioStatus === "erro");

type EstadoEtapa = "feita" | "atual" | "pendente" | "problema";

type ChaveEtapa = "vistada" | "conferencia" | "robo" | "vios" | "checada" | "central";

export interface EtapaEsteira {
  chave: ChaveEtapa;
  rotulo: string;
  /** Na esteira estreita (celular). */
  curto: string;
  icone: LucideIcon;
  estado: EstadoEtapa;
  /** O que aconteceu ou o que se espera, em uma frase curta. */
  texto: string;
  quem: string | null;
  quando: string | null;
  /** A conferência devolveu esta publicação antes (marca na etapa Conferência). */
  devolvida?: boolean;
}

type ChaveDaEsteiraDoRobo = Exclude<ChaveEtapa, "central">;

const ORDEM: ChaveDaEsteiraDoRobo[] = ["vistada", "conferencia", "robo", "vios", "checada"];

/** Etapa em que a publicação está agora (índice em ORDEM); checada = todas feitas. */
const ATUAL: Record<Exclude<SituacaoAgendada, "central">, number> = { conferencia: 1, robo: 2, agendada: 4, checada: 5, revisao: 4 };

/** Primeira data de envio ao robô entre as tarefas (quando a conferência validou e as tarefas foram para a fila). */
function primeiroEnvio(item: ConferenciaItem): string | null {
  return item.agendamentos.map((agendamento) => agendamento.enviadoEm).filter((data): data is string => Boolean(data)).sort()[0] ?? null;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Sem pasta no VIOS: a vistagem e o pedido na Central. O que vem depois (abrir a pasta e agendar) acontece no SharePoint. */
function etapasDaCentral(item: ConferenciaItem): EtapaEsteira[] {
  const { publicacao } = item;
  const chegou = Boolean(publicacao.centralItemId);
  return [
    {
      chave: "vistada",
      rotulo: "Vistada",
      curto: "Vistada",
      icone: Stamp,
      estado: "feita",
      texto: "Vistada pelo jurídico",
      quem: item.vistadoPor,
      quando: publicacao.vistadoEm,
    },
    {
      chave: "central",
      rotulo: "Central do SharePoint",
      curto: "Central",
      icone: FolderPlus,
      estado: publicacao.centralErro && !chegou ? "problema" : chegou ? "feita" : "atual",
      texto: chegou
        ? `Pedido de abertura de pasta criado (item ${publicacao.centralItemId}); a controladoria agenda pela Central`
        : publicacao.centralErro
          ? "Não chegou à Central: a controladoria vai tentar de novo"
          : "Criando o pedido de abertura de pasta",
      quem: null,
      quando: publicacao.centralEnviadaEm,
    },
  ];
}

/** As cinco etapas da esteira, com o estado de cada uma, quem e quando (o que estiver gravado). */
export function etapasDaEsteira(item: ConferenciaItem): EtapaEsteira[] {
  const { publicacao, agendamentos } = item;
  const situacaoGravada = situacaoAgendada(item) ?? "conferencia";
  if (situacaoGravada === "central") return etapasDaCentral(item);
  const situacao = situacaoGravada;
  const atual = ATUAL[situacao];
  const estado = (indice: number): EstadoEtapa => (indice < atual ? "feita" : indice === atual ? "atual" : "pendente");
  const total = agendamentos.length;
  const agendadas = agendamentos.filter((agendamento) => agendamento.envioStatus === "concluido").length;
  const erroNoRobo = situacao === "robo" && temErroNoRobo(item);
  const devolvida = devolucoesDe(item) > 0;
  // Erro apontado no check: a inconsistência de agendamento mais nova que não foi excluída.
  const apontada = situacao === "revisao"
    ? [...item.inconsistencias]
        .filter((inconsistencia) => inconsistencia.origem === "agendamento" && !inconsistencia.excluidaEm)
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0] ?? null
    : null;

  const etapas: Record<ChaveDaEsteiraDoRobo, Omit<EtapaEsteira, "chave" | "estado"> & { estado?: EstadoEtapa }> = {
    vistada: {
      rotulo: "Vistada",
      curto: "Vistada",
      icone: Stamp,
      texto: devolvida ? "Vistada de novo depois da devolução" : "Vistada pelo jurídico",
      quem: item.vistadoPor,
      quando: publicacao.vistadoEm,
    },
    conferencia: {
      rotulo: "Conferência",
      curto: "Conferência",
      icone: SearchCheck,
      texto: atual === 1 ? "Na conferência da controladoria" : "Conferida e enviada ao robô",
      quem: atual > 1 ? item.conferidoPor : null,
      quando: atual > 1 ? publicacao.conferidoEm : null,
      devolvida,
    },
    robo: {
      rotulo: "Robô",
      curto: "Robô",
      icone: Bot,
      estado: erroNoRobo ? "problema" : undefined,
      texto: erroNoRobo
        ? "Erro no robô: a controladoria vai rodar de novo"
        : atual === 2
          ? `Com o robô · ${agendadas} de ${plural(total, "tarefa agendada", "tarefas agendadas")}`
          : atual > 2
            ? "Enviada ao robô"
            : "Vai para o robô depois da conferência",
      quem: null,
      quando: atual >= 2 ? primeiroEnvio(item) : null,
    },
    vios: {
      rotulo: "Agendada no VIOS",
      curto: "VIOS",
      icone: CalendarCheck,
      texto: atual > 3 ? `Agendada no VIOS · ${plural(total, "tarefa", "tarefas")}` : "Aguardando o robô",
      quem: null,
      quando: null,
    },
    checada: {
      rotulo: "Checada",
      curto: "Check",
      icone: BadgeCheck,
      estado: situacao === "revisao" ? "problema" : undefined,
      texto:
        situacao === "revisao"
          ? "Em revisão: erro apontado no check"
          : situacao === "checada"
            ? "Checada pela controladoria"
            : situacao === "agendada"
              ? "Aguardando o check da controladoria"
              : "Check depois de agendada",
      quem: situacao === "checada" ? (item.checadoPor ?? null) : apontada?.criadoPor ?? null,
      quando: situacao === "checada" ? publicacao.checadoEm : apontada?.criadoEm ?? null,
    },
  };
  return ORDEM.map((chave, indice) => {
    const etapa = etapas[chave];
    return { ...etapa, chave, estado: etapa.estado ?? estado(indice) };
  });
}

/* ------------------------------------------------------------ desenho */

/** Bolinha da etapa: feita (✓), atual (ícone em destaque), pendente (ícone apagado) ou problema (alerta). */
function Marco({ etapa, final, tamanho }: { etapa: EtapaEsteira; final: boolean; tamanho: "sm" | "md" }) {
  const Icone = etapa.estado === "feita" ? Check : etapa.estado === "problema" ? (etapa.chave === "checada" ? TriangleAlert : CircleAlert) : etapa.icone;
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full",
        tamanho === "sm" ? "size-6 [&>svg]:size-3.5" : "size-8 [&>svg]:size-4",
        etapa.estado === "feita" && (final ? "bg-emerald-600 text-white" : "bg-[#347796] text-white"),
        etapa.estado === "atual" && "bg-[#e8f8f8] text-[#285f7a] ring-2 ring-[#47cdd0]",
        etapa.estado === "pendente" && "bg-white text-slate-400 ring-1 ring-[#d3e2e6]",
        etapa.estado === "problema" && "bg-red-50 text-red-700 ring-2 ring-red-300"
      )}
      aria-hidden
    >
      <Icone strokeWidth={etapa.estado === "feita" ? 3 : 2} />
      {etapa.devolvida ? (
        <span
          className={cn(
            "absolute grid place-items-center rounded-full bg-amber-500 text-white ring-2 ring-white",
            tamanho === "sm" ? "-right-1.5 -top-1.5 size-3.5 [&>svg]:size-2" : "-right-1 -top-1 size-4 [&>svg]:size-2.5"
          )}
        >
          <Undo2 strokeWidth={3} />
        </span>
      ) : null}
    </span>
  );
}

const ESTADO_PARA_LEITOR: Record<EstadoEtapa, string> = { feita: "feita", atual: "agora", pendente: "ainda não", problema: "com problema" };

/** Rótulo curto (celular) e inteiro da etapa com problema. */
const ROTULO_PROBLEMA: Partial<Record<ChaveEtapa, { curto: string; inteiro: string }>> = {
  robo: { curto: "Erro", inteiro: "Erro no robô" },
  checada: { curto: "Revisão", inteiro: "Em revisão" },
  central: { curto: "Erro", inteiro: "Não chegou" },
};

/** "05/11, 23:23" → "05/11 às 23:23". */
const dataEHora = (iso: string | null) => (iso ? formatarDataHora(iso).replace(", ", " às ") : null);

/**
 * Esteira compacta, no cartão da lista: as etapas lado a lado, ligadas por uma linha que se preenche até onde a
 * publicação chegou. Rótulo curto no celular; quem e quando ficam no title (e no detalhe).
 */
export function EsteiraCompacta({ etapas, className }: { etapas: EtapaEsteira[]; className?: string }) {
  return (
    <ol aria-label="Esteira da publicação" className={cn("@container grid", etapas.length === 2 ? "grid-cols-2" : "grid-cols-5", className)}>
      {etapas.map((etapa, indice) => {
        const proxima = etapas[indice + 1];
        const linhaCheia = proxima && etapa.estado === "feita" && proxima.estado !== "pendente";
        const dica = [etapa.texto, etapa.quem, dataEHora(etapa.quando)].filter(Boolean).join(" · ");
        return (
          <li
            key={etapa.chave}
            title={dica}
            aria-current={etapa.estado === "atual" || etapa.estado === "problema" ? "step" : undefined}
            className="relative flex min-w-0 flex-col items-center gap-1 text-center"
          >
            {proxima ? (
              <span
                aria-hidden
                className={cn("absolute left-1/2 top-3 h-0.5 w-full -translate-y-1/2", linhaCheia ? "bg-[#347796]" : "bg-[#dce9eb]")}
              />
            ) : null}
            <span className="relative z-[1] rounded-full bg-white">
              <Marco etapa={etapa} final={indice === etapas.length - 1} tamanho="sm" />
            </span>
            <span
              className={cn(
                "max-w-full px-0.5 text-[11px] leading-tight",
                etapa.estado === "atual" && "font-semibold text-[#10293a]",
                etapa.estado === "feita" && "font-medium text-[#285f7a]",
                etapa.estado === "pendente" && "text-muted-foreground",
                etapa.estado === "problema" && "font-semibold text-red-700"
              )}
            >
              <span className="@xs:hidden">{etapa.estado === "problema" ? (ROTULO_PROBLEMA[etapa.chave]?.curto ?? etapa.curto) : etapa.curto}</span>
              <span className="hidden @xs:inline">
                {etapa.estado === "problema" ? (ROTULO_PROBLEMA[etapa.chave]?.inteiro ?? etapa.rotulo) : etapa.rotulo}
              </span>
              <span className="sr-only">: {ESTADO_PARA_LEITOR[etapa.estado]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Esteira no detalhe: uma etapa por linha, com o que aconteceu, quem fez (com foto) e quando. A linha que liga as
 * bolinhas é o fio da linha do tempo, não um destaque de cartão.
 */
export function EsteiraDetalhada({ etapas, fotos }: { etapas: EtapaEsteira[]; fotos: Record<string, string> }) {
  return (
    <ol aria-label="Esteira da publicação" className="space-y-0">
      {etapas.map((etapa, indice) => {
        const proxima = etapas[indice + 1];
        const linhaCheia = proxima && etapa.estado === "feita" && proxima.estado !== "pendente";
        return (
          <li
            key={etapa.chave}
            aria-current={etapa.estado === "atual" || etapa.estado === "problema" ? "step" : undefined}
            className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0"
          >
            {proxima ? (
              <span aria-hidden className={cn("absolute bottom-0 left-4 top-8 w-0.5 -translate-x-1/2", linhaCheia ? "bg-[#347796]" : "bg-[#dce9eb]")} />
            ) : null}
            <Marco etapa={etapa} final={indice === etapas.length - 1} tamanho="md" />
            {/* Estreito (celular), quem e quando descem para baixo do texto da etapa. */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
              <div className="min-w-0 flex-[1_1_15rem]">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    etapa.estado === "pendente" ? "text-muted-foreground" : etapa.estado === "problema" ? "text-red-700" : "text-[#10293a]"
                  )}
                >
                  {etapa.rotulo}
                  {etapa.estado === "atual" ? <span className="ml-2 align-middle text-[11px] font-semibold uppercase text-[#347796]">agora</span> : null}
                </p>
                <p className={cn("text-xs", etapa.estado === "problema" ? "text-red-700" : "text-muted-foreground")}>{etapa.texto}</p>
                {etapa.devolvida ? (
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-800">
                    <Undo2 className="size-3.5" aria-hidden />
                    A conferência já devolveu esta publicação ao jurídico (veja as inconsistências)
                  </p>
                ) : null}
              </div>
              {etapa.quem || etapa.quando ? (
                <div className="flex min-w-0 items-center gap-2">
                  {etapa.quem ? <AvatarPessoa nome={etapa.quem} foto={fotos[chaveNome(etapa.quem)]} className="size-7" /> : null}
                  <div className="min-w-0 leading-tight">
                    {etapa.quem ? (
                      <p className="truncate text-xs font-medium text-foreground" title={etapa.quem}>
                        {etapa.quem}
                      </p>
                    ) : null}
                    {etapa.quando ? <p className="text-[11px] tabular-nums text-muted-foreground">{dataEHora(etapa.quando)}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
