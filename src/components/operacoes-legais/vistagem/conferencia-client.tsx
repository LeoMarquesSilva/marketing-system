"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  FileSearch,
  Hourglass,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Inbox,
  Landmark,
  Layers,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  Search,
  SearchX,
  Send,
  ShieldAlert,
  Undo2,
  Workflow,
  X,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { ContextoDoProcesso, DialogoAcao, EscolhaEmCartoes, type OpcaoEmCartao } from "./dialogo-acao";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { RENOVAR_CONFERENCIA_MS } from "@/lib/vistagem/alterar-vistagem";
import { avisarContagensVistagem } from "@/hooks/use-vistagem-contagens";
import { marcarEnviosSincronizados, sincronizarEnvios } from "@/lib/vistagem/envios-client";
import { cn } from "@/lib/utils";
import { ROTULO_ETIQUETA, chaveNome } from "@/lib/vistagem/agendamento";
import { vaiParaCentral } from "@/lib/vistagem/central";
import { ROTULO_CONTAGEM } from "@/lib/vistagem/dias-uteis";
import { ROTULO_AJUSTE_CURTO } from "@/lib/vistagem/fluxo-previsto";
import { MAX_TEXTO_INCONSISTENCIA, TIPOS_INCONSISTENCIA_JURIDICO } from "@/lib/vistagem/inconsistencias";
import { podeEditarNaConferencia } from "@/lib/vistagem/ajuste-conferencia";
import type { AgendamentoResumo, ConferenciaItem, ConferenciaResposta, InconsistenciaItem, PublicacaoResumo, VistagemDetalhe } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { EditarTarefa } from "./editar-tarefa";
import { FaixaDoProcesso, NA_FAIXA, type NavegacaoNaFila } from "./faixa-processo";
import { FichaPasta } from "./ficha-pasta";
import { FichaProcesso, ResumoDaFicha } from "./ficha-processo";
import { BotaoHistorico } from "./historico-publicacao";
import { CartaoInconsistencia } from "./inconsistencias-ui";
import { FiltroData, dataNaLista } from "./filtro-data";
import { LeitorPublicacao } from "./leitor-publicacao";
import { IconeArea, IconeTribunal, LogoGrupo } from "./marcas";
import { descricaoDoTribunal } from "@/lib/vistagem/tribunais";
import { camposDaConferencia, combinaCampos } from "@/lib/vistagem/busca";
import { SITUACOES_NO_ROBO, situacaoNoRobo, type SituacaoNoRobo } from "@/lib/vistagem/situacao-robo";
import { ReguaDatas } from "./regua-datas";
import { SeloResultadoIa, SugestaoNaConferencia } from "./sugestao-ia-ui";
import { IconeOpcao, Seletor } from "./seletor";
import { AvatarPessoa } from "./combobox-busca";
import { CartoesTarefas, LinkVios, corDoTextoDoEnvio, envioDaTarefa } from "./tarefas-conferencia";
import { PainelAberturaDePasta, SeloAberturaDePasta } from "./abertura-pasta";
import { DetalheAgendada } from "./agendada-detalhe";
import { SeloEsocial, contarPor, formatarData, formatarDataHora, tribunalDe } from "./publicacao-ui";
import {
  Aviso,
  BarraAba,
  Busca,
  CabecalhoLista,
  Carregando,
  Painel,
  PainelTopo,
  Secao,
  Selo,
  SelosDeEtiqueta,
  Vazio,
  linhaLista,
  TOM_CLASSE,
} from "./ui";

type Aba = "conferir" | "enviadas" | "aberturas" | "inconsistencias";

/** Retorno de uma ação da tela (sucesso, alerta, informação ou erro). */
type Retorno = { tom: "sucesso" | "erro" | "alerta" | "info"; texto: string };

const temErro = (item: ConferenciaItem) => item.agendamentos.some((agendamento) => agendamento.envioStatus === "erro");

/** Ícone de cada situação no filtro Status do robô. */
const ICONE_SITUACAO: Record<SituacaoNoRobo, LucideIcon> = {
  erro: CircleAlert,
  aguardando_vios: Hourglass,
  com_robo: Bot,
  na_fila: Inbox,
  simulada: FileSearch,
  agendada: CircleCheck,
};

const processoDe = (item: ConferenciaItem) => item.publicacao.numeroProcesso ?? item.publicacao.numeroProcessoOriginal;

const SEM_AREA = "Sem área";

const areaDe = (item: ConferenciaItem) => item.publicacao.escritorioResponsavel?.trim() || SEM_AREA;

/** No Trabalhista as publicações se separam também pelo tribunal (TRT2, TRT15, TST…). */
const separaPorTribunal = (area: string) => chaveNome(area) === "TRABALHISTA";

interface GrupoConferencia {
  area: string;
  itens: ConferenciaItem[];
  /** Só no Trabalhista: os itens da área por tribunal. */
  tribunais: { tribunal: string; itens: ConferenciaItem[] }[] | null;
}

/** Lista da conferência por área (ordem alfabética) e, no Trabalhista, por tribunal; dentro de cada um, a ordem da lista. */
function agruparConferencia(itens: ConferenciaItem[]): GrupoConferencia[] {
  return contarPor(itens, areaDe).map(([area]) => {
    const daArea = itens.filter((item) => areaDe(item) === area);
    return {
      area,
      itens: daArea,
      tribunais: separaPorTribunal(area)
        ? contarPor(daArea, (item) => tribunalDe(item.publicacao)).map(([tribunal]) => ({
            tribunal,
            itens: daArea.filter((item) => tribunalDe(item.publicacao) === tribunal),
          }))
        : null,
    };
  });
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * A controladoria está com a publicação aberta na Conferência: por alguns minutos o jurídico não reabre a vistagem (se
 * as duas agirem ao mesmo tempo, vale a decisão da controladoria; pedido de 11/11/2026). Devolve como a publicação está
 * agora; sem resposta (rede), null.
 */
async function marcarAbertaNaConferencia(id: string): Promise<{ status: string; vistadoEm: string | null; revistadoEm: string | null } | null> {
  const resposta = await authFetch(`/api/operacoes-legais/vistagem/conferencia/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "abrir" }),
  }).catch(() => null);
  if (!resposta?.ok) return null;
  return resposta.json().catch(() => null);
}

/** Roda de novo no robô as tarefas com erro da publicação; devolve a confirmação pedida pelo servidor, se houver. */
async function pedirRodarNovamente(id: string, forcar: boolean): Promise<{ enviadas?: number; simulado?: boolean; precisaConfirmar?: string }> {
  const resposta = await authFetch(`/api/operacoes-legais/vistagem/conferencia/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "rodar_novamente", forcar }),
  });
  const corpo = await resposta.json();
  if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao rodar de novo.");
  return corpo;
}


/** Classe da tarefa é categoria, não estado: tons da marca (DESIGN.md). */


/* ------------------------------------------------------------ peças locais */

/** O que cada tipo de inconsistência do jurídico quer dizer, para a conferência escolher sem dúvida. */
const TIPO_DEVOLUCAO: Record<(typeof TIPOS_INCONSISTENCIA_JURIDICO)[number], Omit<OpcaoEmCartao, "valor">> = {
  "FORA DO WORKFLOW": {
    rotulo: "Fora do workflow",
    descricao: "A tarefa, a classe ou o fluxo escolhido não seguem o workflow do VIOS para esse ato.",
    icone: Workflow,
  },
  "INTERPRETAÇÃO DA PUBLI": {
    rotulo: "Interpretação da publicação",
    descricao: "A leitura da publicação está errada: o ato, a providência ou o prazo não são os que ela pede.",
    icone: FileSearch,
  },
  "CONTAGEM DE PRAZO": {
    rotulo: "Contagem de prazo",
    descricao: "Os dias, a contagem (úteis ou corridos) ou a data fatal estão errados.",
    icone: Hourglass,
  },
};
const OPCOES_DEVOLUCAO: OpcaoEmCartao[] = TIPOS_INCONSISTENCIA_JURIDICO.map((valor) => ({ valor, ...TIPO_DEVOLUCAO[valor] }));

/**
 * Célula da lista de tarefas: no mobile mostra o rótulo; no desktop o rótulo fica só para leitor de tela.
 * Compacta (coluna estreita), mostra o rótulo em qualquer largura.
 */
function Celula({
  rotulo,
  mostrarRotulo = true,
  compacta = false,
  className,
  children,
}: {
  rotulo: string;
  mostrarRotulo?: boolean;
  compacta?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <span className={cn("block text-xs text-muted-foreground", !mostrarRotulo ? "sr-only" : !compacta && "lg:sr-only")}>{rotulo}</span>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ tarefas */

const COLUNAS = "lg:grid-cols-[7rem_minmax(0,1.7fr)_9rem_minmax(0,1fr)_minmax(0,1fr)]";
const COLUNAS_ENVIO = "lg:grid-cols-[7rem_minmax(0,1.5fr)_9rem_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.3fr)]";

/**
 * Tarefas de uma vistagem (e, com envio, a situação de cada uma no robô); usada também na visão "Agendadas" do
 * jurídico. `compacta`: um cartão por tarefa em qualquer largura, para a coluna ao lado da publicação.
 */
export function TabelaTarefas({ agendamentos, comEnvio, compacta = false }: { agendamentos: AgendamentoResumo[]; comEnvio: boolean; compacta?: boolean }) {
  const colunas = compacta ? "" : comEnvio ? COLUNAS_ENVIO : COLUNAS;
  const largura = compacta ? "col-span-2" : "col-span-2 lg:col-span-1";
  if (!agendamentos.length) return <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhuma tarefa nesta vistagem.</p>;
  return (
    <div>
      {compacta ? null : (
        <CabecalhoLista aria-hidden className={cn("hidden gap-x-4 border-t lg:grid", colunas)}>
          <span>Tipo</span>
          <span>Tarefa</span>
          <span>Data</span>
          <span>Responsável</span>
          <span>Revisor</span>
          {comEnvio ? <span>Robô</span> : null}
        </CabecalhoLista>
      )}
      <ul className={cn("divide-y divide-[#eef3f5] border-t border-[#e6eef0]", !compacta && "lg:border-t-0")}>
        {agendamentos.map((item) => {
          const simulada = item.envioStatus === "concluido" && item.envioSimulado;
          return (
            <li key={item.id} className={cn("grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3 text-sm", !compacta && "lg:items-start", colunas)}>
              <Celula rotulo="Tipo" mostrarRotulo={false} className={largura}>
                <Selo tom={TOM_CLASSE[item.etiqueta]}>{ROTULO_ETIQUETA[item.etiqueta]}</Selo>
              </Celula>
              <Celula rotulo="Tarefa" mostrarRotulo={false} className={largura}>
                <span className="block break-words font-medium text-foreground">{item.tarefa}</span>
                {item.observacao ? <span className="mt-0.5 block whitespace-pre-wrap break-words text-xs text-muted-foreground">{item.observacao}</span> : null}
              </Celula>
              <Celula rotulo="Data" compacta={compacta}>
                <span className="tabular-nums text-foreground">
                  {formatarData(item.data)}
                  {!item.dataFatal && item.hora ? ` às ${item.hora}${item.horaFim ? ` até ${item.horaFim}` : ""}` : ""}
                  {item.dataLimite && item.dataLimite !== item.data ? ` · limite ${formatarData(item.dataLimite)}` : ""}
                </span>
                {item.dataFatal ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    enviar · fatal <span className="tabular-nums">{formatarData(item.dataFatal)}</span>
                    {item.diasPrazo && item.contagemPrazo ? ` · ${item.diasPrazo} ${ROTULO_CONTAGEM[item.contagemPrazo]}` : ""}
                  </span>
                ) : null}
              </Celula>
              <Celula rotulo="Responsável" compacta={compacta}>
                <span className="break-words text-foreground">{item.responsavel}</span>
              </Celula>
              <Celula rotulo="Revisor" compacta={compacta}>
                <span className={cn("break-words", item.revisor ? "text-foreground" : "text-muted-foreground")}>{item.revisor ?? "—"}</span>
              </Celula>
              {comEnvio ? (
                <Celula rotulo="Robô" compacta={compacta} className={largura}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {simulada ? (
                      <Selo tom="alerta" icone={Bot}>
                        Simulada
                      </Selo>
                    ) : (
                      <Selo tom={envioDaTarefa(item).tom}>
                        {envioDaTarefa(item).rotulo}
                        {item.envioSimulado ? " (simulação)" : ""}
                      </Selo>
                    )}
                    {item.viosTarefaId ? <LinkVios ci={item.viosTarefaId} /> : null}
                  </div>
                  {simulada ? <span className="mt-1 block text-xs text-muted-foreground">Preenchida no VIOS, não gravada</span> : null}
                  {item.envioErro ? <span className={cn("mt-1 block whitespace-pre-wrap break-words text-xs", corDoTextoDoEnvio(item))}>{item.envioErro}</span> : null}
                </Celula>
              ) : null}
              <FluxoDaTarefaAgendada item={item} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Tudo o que vai para o VIOS com a tarefa, para validar (não só o Enviar): depois do robô, as tarefas que o
 * fluxo de fato criou, com o CI; antes, o que o fluxo do VIOS vai criar, com as datas e quem fica em cada uma.
 */
function FluxoDaTarefaAgendada({ item }: { item: AgendamentoResumo }) {
  const criadas = (item.viosTarefas ?? []).filter((tarefa) => !tarefa.principal);
  const junto = (item.fluxoPrevisto ?? []).filter((tarefa) => tarefa.quando === "criacao");
  const aoConcluir = (item.fluxoPrevisto ?? []).filter((tarefa) => tarefa.quando === "conclusao");
  if (!criadas.length && !junto.length && !aoConcluir.length) return null;
  const linha = (chave: string, nome: string, data: string | null, quem: string | null, ci?: string) => (
    <li key={chave} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="font-medium text-foreground">{nome}</span>
      {data ? <span className="tabular-nums text-foreground">{formatarData(data)}</span> : null}
      {quem ? <span className="text-muted-foreground">{quem}</span> : null}
      {ci ? <LinkVios ci={ci} /> : null}
    </li>
  );
  return (
    <div className="col-span-full space-y-1.5 rounded-md border border-[#e6eef0] bg-[#f7fbfc] px-3 py-2 text-xs">
      {criadas.length ? (
        <>
          <p className="font-medium text-[#285f7a]">Criadas junto no VIOS</p>
          <ul className="space-y-1">
            {criadas.map((tarefa) => linha(tarefa.ci, tarefa.tipo ?? "Tarefa do fluxo", tarefa.data, tarefa.responsaveis, tarefa.ci))}
          </ul>
        </>
      ) : junto.length ? (
        <>
          <p className="font-medium text-[#285f7a]">O VIOS cria junto (o robô coloca os responsáveis)</p>
          <ul className="space-y-1">
            {junto.map((tarefa) => (
              // As que nascem de outra do fluxo (Embargos › 2. REVISAR) ficam recuadas embaixo dela.
              <li
                key={tarefa.caminho.join(" › ")}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                style={tarefa.nivel > 1 ? { paddingLeft: `${(tarefa.nivel - 1) * 0.75}rem` } : undefined}
              >
                <span className={cn("font-medium", tarefa.repetida ? "text-muted-foreground line-through" : "text-foreground")}>{tarefa.nome}</span>
                {tarefa.repetida ? (
                  <span className="text-muted-foreground">repetida: o robô cancela no VIOS (Duplicidade)</span>
                ) : (
                  <>
                    <span className={cn("tabular-nums", tarefa.data ? "text-foreground" : "text-muted-foreground")}>
                      {tarefa.data ? formatarData(tarefa.data) : "data do VIOS"}
                    </span>
                    <span className="text-muted-foreground">{tarefa.responsaveis}</span>
                  </>
                )}
                {tarefa.editada ? <Selo tom="marca">data alterada</Selo> : null}
                {tarefa.responsaveisEscolhidos && !tarefa.repetida ? <Selo tom="marca">responsável escolhido</Selo> : null}
                {tarefa.ajustada ? <Selo tom="marca">{ROTULO_AJUSTE_CURTO[tarefa.ajustada]}</Selo> : null}
                {!tarefa.repetida && tarefa.data && tarefa.dataVios && tarefa.data !== tarefa.dataVios ? (
                  <span className="text-muted-foreground">VIOS daria {formatarData(tarefa.dataVios)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {!criadas.length && aoConcluir.length ? (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Ao concluir, o VIOS cria:</span> {aoConcluir.map((tarefa) => tarefa.nome).join(", ")} (responsável
          padrão do VIOS)
        </p>
      ) : null}
    </div>
  );
}

function resumoTarefas(agendamentos: AgendamentoResumo[], comEnvio: boolean): string {
  const partes = [plural(agendamentos.length, "tarefa", "tarefas")];
  if (comEnvio) {
    const agendadas = agendamentos.filter((item) => item.envioStatus === "concluido").length;
    const comErro = agendamentos.filter((item) => item.envioStatus === "erro").length;
    if (agendadas) partes.push(plural(agendadas, "agendada", "agendadas"));
    if (comErro) partes.push(`${comErro} com erro`);
  }
  return partes.join(" · ");
}

/* ------------------------------------------------------------ publicação */

/**
 * Publicação como na vistagem do jurídico: ficha da pasta e do processo, régua de datas e o texto já aberto.
 * A lista traz o texto até um limite; o resto vem sob demanda.
 */
function PublicacaoComoNaVistagem({
  publicacao: inicial,
  agendamentos,
  auxiliar,
  fotos,
  hoje,
}: {
  publicacao: PublicacaoResumo;
  agendamentos: AgendamentoResumo[];
  auxiliar: string | null;
  fotos: Record<string, string>;
  hoje: string;
}) {
  const [publicacao, setPublicacao] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const fatais = agendamentos.flatMap((agendamento) => (agendamento.etiqueta === "PRAZO" && agendamento.dataFatal ? [agendamento.dataFatal] : [])).sort();
  const marcos = [
    { rotulo: "Divulgação", data: publicacao.dataDivulgacao, dica: "Disponibilização no diário." },
    { rotulo: "Publicação", data: publicacao.dataPublicacao, tom: "marca" as const, dica: "Considera-se publicada no 1º dia útil após a disponibilização." },
    { rotulo: fatais.length > 1 ? "1ª fatal" : "Fatal", data: fatais[0] ?? null, tom: "perigo" as const },
  ];

  async function carregarCompleto() {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/publicacoes/${publicacao.id}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar o texto.");
      setPublicacao((atual) => ({ ...atual, teor: corpo.publicacao.teor, teorResumido: false }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o texto.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <div className="space-y-4 px-4 py-3">
        <FichaPasta
          publicacao={publicacao}
          auxiliar={auxiliar}
          fotos={fotos}
          resumo={<ResumoDaFicha publicacao={publicacao} auxiliar={auxiliar} fotos={fotos} />}
        >
          <FichaProcesso publicacao={publicacao} />
        </FichaPasta>
        <ReguaDatas rotulo="Datas da publicação" hoje={hoje} marcos={marcos} />
      </div>
      {publicacao.teorResumido ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#e6eef0] bg-[#fcfdfd] px-4 py-2 text-xs text-muted-foreground">
          <span>Texto grande: aparece só o começo.</span>
          <button
            type="button"
            onClick={carregarCompleto}
            disabled={carregando}
            className="font-medium text-[#347796] underline-offset-4 hover:underline disabled:opacity-60"
          >
            {carregando ? "Carregando…" : "Ver texto completo"}
          </button>
          {erro ? <span className="text-red-700">{erro}</span> : null}
        </div>
      ) : null}
      <LeitorPublicacao key={publicacao.teorResumido ? "resumido" : "completo"} publicacao={publicacao} partesNoCabecalho />
    </>
  );
}

/** "04/11, 12:00" → "04/11 às 12:00". */
const dataEHora = (iso: string | null) => formatarDataHora(iso).replace(", ", " às ");

/**
 * Quem vistou ou conferiu, na faixa do processo: foto, o papel e quando em cima, o nome em destaque embaixo.
 * É com essa pessoa que a conferência fala, por isso fica ao lado do número do processo.
 */
function Autoria({ papel, nome, quando, fotos }: { papel: string; nome: string | null; quando: string | null; fotos: Record<string, string> }) {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:ml-1 sm:border-l sm:border-white/20 sm:pl-3">
      <AvatarPessoa nome={nome ?? "?"} foto={nome ? fotos[chaveNome(nome)] : null} className="size-8 ring-2 ring-white/25" />
      <div className="min-w-0 leading-tight">
        <p className="flex items-center gap-1 text-[11px] text-white/65">
          <span className="font-medium uppercase">{papel}</span>
          <CalendarClock className="ml-0.5 size-3" aria-hidden />
          <span className="tabular-nums">{dataEHora(quando)}</span>
        </p>
        <p className="truncate text-sm font-semibold text-white" title={nome ?? undefined}>
          {nome ?? "Não identificado"}
        </p>
      </div>
    </div>
  );
}

/** Botões na faixa azul-marinho: o contornado em branco e o principal em ciano, para se destacar do fundo. */
const BOTAO_FAIXA = "border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white focus-visible:ring-white/50 dark:bg-transparent";
const BOTAO_FAIXA_PRINCIPAL = "bg-[#47cdd0] font-semibold text-[#10293a] hover:bg-[#6ad8da] focus-visible:ring-white/60";

/** Posição na fila, para andar entre as publicações sem a lista (como na vistagem do jurídico). */
interface Navegacao {
  posicao: number;
  total: number;
  anterior: string | null;
  proxima: string | null;
}

function ItemConferencia({
  item,
  comEnvio,
  modoReal,
  fotos,
  hoje,
  navegacao,
  onAbrir,
  onVoltar,
  onConcluido,
  onEditado,
}: {
  item: ConferenciaItem;
  comEnvio: boolean;
  modoReal: boolean;
  fotos: Record<string, string>;
  hoje: string;
  navegacao: Navegacao | null;
  onAbrir: (id: string) => void;
  onVoltar: () => void;
  onConcluido?: (id: string, mensagem: string) => void;
  /** Tarefa ajustada pelo lápis: a publicação continua aberta, com as tarefas recarregadas. */
  onEditado: (mensagem: string) => Promise<void>;
}) {
  /** Tarefa com o modal do lápis aberto. */
  const [editando, setEditando] = useState<AgendamentoResumo | null>(null);
  /** Lista de pessoas e fluxos da pasta para o lápis: carrega no primeiro uso e vale para as outras tarefas da publicação. */
  const [dadosDoLapis, setDadosDoLapis] = useState<VistagemDetalhe | null>(null);
  const [devolvendo, setDevolvendo] = useState(false);
  const [tipoInconsistencia, setTipoInconsistencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const { publicacao } = item;
  const processo = processoDe(item);
  const base = `conferencia-${publicacao.id}`;
  const erroRobo = comEnvio && temErro(item);
  const podeReenviar =
    comEnvio && modoReal && item.agendamentos.some((a) => a.envioSimulado && (a.envioStatus === "concluido" || a.envioStatus === "erro"));
  const dialogoAberto = devolvendo || confirmacao !== null;
  // Sem pasta no VIOS: ao validar, vai como abertura de pasta para a Central do SharePoint, não para o robô.
  const abertura = vaiParaCentral(publicacao);

  /** Roda de novo as tarefas com erro; se o servidor pedir confirmação (pode duplicar no VIOS), abre o modal. */
  async function rodarDeNovo(forcar: boolean) {
    setOcupado(true);
    setErro("");
    try {
      const corpo = await pedirRodarNovamente(publicacao.id, forcar);
      if (corpo.precisaConfirmar) {
        setConfirmacao(corpo.precisaConfirmar);
        return;
      }
      setConfirmacao(null);
      onConcluido?.(publicacao.id, `${corpo.enviadas} tarefa(s) enviada(s) de novo ao robô${corpo.simulado ? " em modo simulação" : ""}.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao rodar de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function agir(acao: "validar" | "devolver" | "reenviar") {
    setOcupado(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/conferencia/${publicacao.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, tipo: tipoInconsistencia, descricao: motivo }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha na conferência.");
      setDevolvendo(false);
      onConcluido?.(
        publicacao.id,
        acao === "validar"
          ? corpo.central
            ? corpo.central.itemId
              ? `Sem pasta no VIOS: pedido de abertura de pasta criado na Central do SharePoint (item ${corpo.central.itemId}).`
              : "Sem pasta no VIOS: a Central do SharePoint não respondeu. Veja em Abertura de pasta."
            : `${corpo.enviadas} tarefa(s) enviada(s) ao robô${corpo.simulado ? " em modo simulação" : ""}.`
          : acao === "reenviar"
            ? `${corpo.enviadas} tarefa(s) reenviada(s) ao robô para gravar no VIOS.`
            : "Devolvida ao jurídico."
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha na conferência.");
    } finally {
      setOcupado(false);
    }
  }

  function fecharDialogo() {
    setDevolvendo(false);
    setConfirmacao(null);
    setErro("");
  }

  const spinner = <LoaderCircle className="animate-spin" />;
  const acoes =
    !comEnvio || erroRobo || podeReenviar ? (
      <>
        {!comEnvio ? (
          <>
            <Button size="sm" variant="outline" className={BOTAO_FAIXA} onClick={() => setDevolvendo(true)} disabled={ocupado}>
              <Undo2 />
              Devolver ao jurídico
            </Button>
            <Button size="sm" className={BOTAO_FAIXA_PRINCIPAL} onClick={() => agir("validar")} disabled={ocupado}>
              {ocupado && !dialogoAberto ? spinner : <Send />}
              {abertura ? "Validar e enviar à Central" : "Validar e enviar ao robô"}
            </Button>
          </>
        ) : null}
        {erroRobo ? (
          <Button size="sm" variant="outline" className={BOTAO_FAIXA} onClick={() => rodarDeNovo(false)} disabled={ocupado}>
            {ocupado && !dialogoAberto ? spinner : <RotateCcw />}
            Rodar novamente
          </Button>
        ) : null}
        {podeReenviar ? (
          <Button size="sm" className={BOTAO_FAIXA_PRINCIPAL} onClick={() => agir("reenviar")} disabled={ocupado}>
            {ocupado && !dialogoAberto ? spinner : <Bot />}
            Reenviar gravando no VIOS
          </Button>
        ) : null}
      </>
    ) : null;

  return (
    // No desktop ocupa a altura da tela, como a vistagem: publicação e tarefas rolam cada uma no seu lugar.
    <Painel aria-labelledby={`${base}-titulo`} className="@container lg:flex lg:h-full lg:flex-col">
      <Button variant="ghost" size="sm" className="m-2 self-start lg:hidden" onClick={onVoltar}>
        <ArrowLeft />
        Voltar à lista
      </Button>
      {/* Mesmo topo da vistagem: o número pesquisa o processo no tribunal, o botão ao lado copia e as setas andam na fila.
          Na mesma faixa, quem vistou (e quem conferiu) e as ações: sem uma linha só para isso, sobra altura para a leitura. */}
      <FaixaDoProcesso
        numero={processo}
        tribunal={publicacao.tribunal}
        tituloId={`${base}-titulo`}
        // Demanda de risco: a faixa fica vermelha, como na vistagem (pedido de 11/11/2026); o selo já está na ficha da pasta.
        risco={Boolean(publicacao.demandaRisco)}
        seloDeRisco={false}
        selos={
          <>
            <SeloEsocial publicacao={publicacao} />
            <Autoria papel="Vistada por" nome={item.vistadoPor} quando={publicacao.vistadoEm} fotos={fotos} />
            {/* Devolvida e vistada de novo: quem analisou primeiro fica em "Vistada por"; depois, quem devolveu e quem vistou de novo. */}
            {item.revistadoPor ? (
              <>
                <Autoria papel="Devolvida por" nome={item.devolvidoPor} quando={publicacao.devolvidoEm} fotos={fotos} />
                <Autoria papel="Vistada de novo por" nome={item.revistadoPor} quando={publicacao.revistadoEm} fotos={fotos} />
              </>
            ) : null}
            {comEnvio && publicacao.conferidoEm ? (
              <Autoria papel="Conferida por" nome={item.conferidoPor} quando={publicacao.conferidoEm} fotos={fotos} />
            ) : null}
          </>
        }
      >
        {/* O que aconteceu com a publicação: triagem, transferência de área, vistagem, devolução, robô. */}
        <BotaoHistorico publicacaoId={publicacao.id} processo={processo} className={cn(BOTAO_FAIXA, acoes && "mr-1")} />
        {acoes ? <div className="flex flex-wrap items-center gap-2" data-tour="cf-acoes">{acoes}</div> : null}
        {navegacao ? (
          <div className={cn("flex items-center gap-1", acoes && "ml-2 border-l border-white/20 pl-2")}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className={NA_FAIXA}
              disabled={!navegacao.anterior}
              onClick={() => navegacao.anterior && onAbrir(navegacao.anterior)}
              aria-label="Publicação anterior"
              title="Publicação anterior"
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-14 text-center text-xs tabular-nums text-white/80">
              {navegacao.posicao} de {navegacao.total}
            </span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className={NA_FAIXA}
              disabled={!navegacao.proxima}
              onClick={() => navegacao.proxima && onAbrir(navegacao.proxima)}
              aria-label="Próxima publicação"
              title="Próxima publicação"
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </FaixaDoProcesso>

      {(erro && !dialogoAberto) || erroRobo || podeReenviar ? (
        <Secao className="shrink-0">
          {erro && !dialogoAberto ? <Aviso tom="erro">{erro}</Aviso> : null}
          {erroRobo ? (
            <Aviso tom="erro" titulo="Erro no robô">
              {item.agendamentos.find((agendamento) => agendamento.envioStatus === "erro")?.envioErro ?? "sem detalhe"}
            </Aviso>
          ) : null}
          {podeReenviar ? <Aviso tom="info">Tarefas rodadas em simulação: reenvie para gravar no VIOS.</Aviso> : null}
        </Secao>
      ) : null}

      {/* Com espaço, a publicação fica à esquerda e o que o jurídico fez à direita, cada uma rolando sozinha, como na vistagem. */}
      <div className="grid lg:min-h-0 lg:flex-1 @max-4xl:overflow-y-auto @4xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @4xl:grid-rows-[minmax(0,1fr)] @4xl:divide-x @4xl:divide-[#e6eef0]">
        {/* Sem a altura fixa do desktop (tela menor ou zoom do navegador), publicação e tarefas param em 75% da tela e rolam sozinhas. */}
        <section data-tour="cf-publicacao" aria-label="Publicação" className="min-w-0 overflow-y-auto max-lg:max-h-[75dvh]">
          <PublicacaoComoNaVistagem
            publicacao={publicacao}
            agendamentos={item.agendamentos}
            auxiliar={item.auxiliar ?? null}
            fotos={fotos}
            hoje={hoje}
          />
        </section>

        {/* A coluna inteira tem o fundo das tarefas: com uma tarefa curta, o espaço que sobra embaixo é a própria coluna, não um vazio branco. */}
        <div className="min-w-0 border-t border-[#e6eef0] bg-[#f2f6f7] @4xl:overflow-y-auto @4xl:border-t-0 max-lg:@4xl:max-h-[75dvh]">
          {abertura && !comEnvio ? (
            <div className="px-4 pt-4">
              <Aviso tom="info" titulo="Sem pasta no VIOS">
                Ao validar, as tarefas não vão para o robô: viram um pedido de abertura de pasta na Central do SharePoint.
              </Aviso>
            </div>
          ) : null}

          {publicacao.observacaoVistagem ? (
            <Secao titulo="Observação do jurídico" id={`${base}-observacao`}>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{publicacao.observacaoVistagem}</p>
            </Secao>
          ) : null}

          {item.inconsistencias.length ? (
            <Secao titulo="Inconsistências" id={`${base}-inconsistencias`} acao={<Selo tom="alerta">{item.inconsistencias.length}</Selo>}>
              <div className="space-y-2">
                {item.inconsistencias.map((inconsistencia) => (
                  <CartaoInconsistencia key={inconsistencia.id} inconsistencia={inconsistencia} acao={null} />
                ))}
              </div>
            </Secao>
          ) : null}

          {/* O que a IA sugeriu na hora da vistagem e o que o jurídico fez com isso, logo acima das tarefas pedidas. */}
          {item.sugestaoIa ? (
            <Secao titulo="Sugestão da IA na vistagem" id={`${base}-sugestao-ia`} acao={<SeloResultadoIa resultado={item.sugestaoIa.resultado} />}>
              <SugestaoNaConferencia dados={item.sugestaoIa} />
            </Secao>
          ) : null}

          <section data-tour="cf-tarefas" aria-labelledby={`${base}-tarefas`} className="border-t border-[#e6eef0] first:border-t-0">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-4">
              <h3 id={`${base}-tarefas`} className="text-xs font-semibold uppercase tracking-normal text-[#285f7a]">
                Tarefas
              </h3>
              <span className="text-xs text-muted-foreground">{resumoTarefas(item.agendamentos, comEnvio)}</span>
            </div>
            <CartoesTarefas
              agendamentos={item.agendamentos}
              comEnvio={comEnvio}
              fotos={fotos}
              hoje={hoje}
              onEditar={setEditando}
              podeEditar={(agendamento) => podeEditarNaConferencia(publicacao.status, agendamento.envioStatus)}
            />
          </section>
        </div>
      </div>

      {editando ? (
        <EditarTarefa
          key={editando.id}
          publicacaoId={publicacao.id}
          processo={processo}
          tarefa={editando}
          comEnvio={comEnvio}
          dados={dadosDoLapis}
          onDados={setDadosDoLapis}
          onFechar={() => setEditando(null)}
          onSalva={async (mensagem) => {
            await onEditado(mensagem);
            setEditando(null);
          }}
        />
      ) : null}

      <DialogoAcao
        aberto={devolvendo}
        onFechar={fecharDialogo}
        ocupado={ocupado}
        icone={Undo2}
        tom="alerta"
        titulo="Devolver ao jurídico"
        descricao="A publicação volta para a fila do jurídico com a inconsistência e o seu texto, para ser vistada de novo."
        aviso={
          !tipoInconsistencia
            ? "Escolha o tipo da inconsistência."
            : !motivo.trim()
              ? "Descreva o que está errado."
              : `Volta para ${item.vistadoPor ?? "o jurídico"} com esse texto.`
        }
        rodape={
          <>
            <Button variant="outline" onClick={fecharDialogo} disabled={ocupado}>
              Cancelar
            </Button>
            <Button onClick={() => agir("devolver")} disabled={ocupado || !tipoInconsistencia || !motivo.trim()}>
              {ocupado ? spinner : <Undo2 />}
              Devolver ao jurídico
            </Button>
          </>
        }
      >
        <ContextoDoProcesso
          grupo={publicacao.grupoCliente}
          cliente={publicacao.cliente}
          area={publicacao.escritorioResponsavel}
          processo={processo}
          pessoa={item.vistadoPor}
          fotos={fotos}
        />
        <section className="space-y-2" aria-labelledby={`${base}-tipo-devolucao`}>
          <h3 id={`${base}-tipo-devolucao`} className="text-xs font-semibold uppercase text-[#285f7a]">
            Tipo de inconsistência
          </h3>
          <EscolhaEmCartoes
            rotulo="Tipo de inconsistência"
            opcoes={OPCOES_DEVOLUCAO}
            valor={tipoInconsistencia}
            onChange={setTipoInconsistencia}
            desabilitado={ocupado}
          />
        </section>
        <label className="block space-y-2">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold uppercase text-[#285f7a]">O que está errado</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {motivo.length}/{MAX_TEXTO_INCONSISTENCIA}
            </span>
          </span>
          <Textarea
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            rows={4}
            maxLength={MAX_TEXTO_INCONSISTENCIA}
            disabled={ocupado}
            placeholder="Ex.: o prazo é de 8 dias úteis, não 5; a fatal fica em 17/11."
            className="min-h-28 resize-y bg-white text-sm"
          />
          <span className="block text-xs text-muted-foreground">O jurídico vê este texto junto com a publicação.</span>
        </label>
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      </DialogoAcao>

      <DialogoAcao
        aberto={confirmacao !== null}
        onFechar={fecharDialogo}
        ocupado={ocupado}
        icone={RotateCcw}
        tom="alerta"
        titulo="Rodar de novo no robô?"
        descricao={
          <>
            Processo <span className="tabular-nums">{processo}</span>
          </>
        }
        rodape={
          <>
            <Button variant="outline" onClick={fecharDialogo} disabled={ocupado}>
              Cancelar
            </Button>
            <Button onClick={() => rodarDeNovo(true)} disabled={ocupado}>
              {ocupado ? spinner : <RotateCcw />}
              Rodar mesmo assim
            </Button>
          </>
        }
      >
        <Aviso tom="alerta" titulo="Atenção">
          {confirmacao}
        </Aviso>
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      </DialogoAcao>
    </Painel>
  );
}

/* ------------------------------------------------------------ inconsistências */

type SituacaoInconsistencia = "contestadas" | "abertas" | "excluidas";

const SITUACOES: { value: SituacaoInconsistencia; label: string }[] = [
  { value: "contestadas", label: "Contestadas pelo jurídico" },
  { value: "abertas", label: "Todas em aberto" },
  { value: "excluidas", label: "Excluídas" },
];

const COLUNAS_INCONSISTENCIA = "md:grid-cols-[15rem_minmax(0,1fr)]";

/** Inconsistências registradas: contestadas pelo jurídico primeiro, com a exclusão pela controladoria. */
function PainelInconsistencias() {
  const [situacao, setSituacao] = useState<SituacaoInconsistencia>("contestadas");
  const [itens, setItens] = useState<InconsistenciaItem[] | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (alvo: SituacaoInconsistencia) => {
    setItens(null);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/inconsistencias?situacao=${alvo}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar as inconsistências.");
      setItens(corpo.inconsistencias);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as inconsistências.");
      setItens([]);
    }
  }, []);

  useEffect(() => {
    void carregar(situacao);
  }, [carregar, situacao]);

  return (
    <Painel aria-labelledby="conferencia-inconsistencias">
      <PainelTopo
        id="conferencia-inconsistencias"
        titulo="Inconsistências registradas"
        descricao="As contestadas pelo jurídico pedem decisão: exclua a que não procede, com o motivo."
      >
        <Segmented label="Situação das inconsistências" value={situacao} options={SITUACOES} onChange={setSituacao} />
      </PainelTopo>

      {erro ? (
        <div className="px-4 pt-4">
          <Aviso
            tom="erro"
            acao={
              <Button size="xs" variant="outline" onClick={() => void carregar(situacao)}>
                Tentar de novo
              </Button>
            }
          >
            {erro}
          </Aviso>
        </div>
      ) : null}

      {itens === null ? (
        <Carregando rotulo="Carregando as inconsistências" />
      ) : itens.length === 0 ? (
        erro ? (
          <div className="h-4" />
        ) : (
          <Vazio icone={CircleCheck} titulo="Nenhuma inconsistência aqui.">
            {situacao === "contestadas" ? "Quando o jurídico contestar uma devolução, ela aparece nesta lista." : null}
          </Vazio>
        )
      ) : (
        <>
          <CabecalhoLista aria-hidden className={cn("hidden gap-x-6 md:grid", COLUNAS_INCONSISTENCIA)}>
            <span>Publicação</span>
            <span>Inconsistência</span>
          </CabecalhoLista>
          <ul className="divide-y divide-[#eef3f5]">
            {itens.map(({ inconsistencia, publicacao }) => (
              <li key={inconsistencia.id} className={cn("grid gap-x-6 gap-y-2 px-4 py-3", COLUNAS_INCONSISTENCIA)}>
                <div className="min-w-0 space-y-0.5">
                  <p className="break-all tabular-nums text-sm font-medium text-foreground">{publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {publicacao.escritorioResponsavel ? (
                      <span className="inline-flex items-center gap-1.5">
                        <IconeArea area={publicacao.escritorioResponsavel} />
                        {publicacao.escritorioResponsavel}
                      </span>
                    ) : null}
                    <span>
                      Publicação <span className="tabular-nums">{formatarData(publicacao.dataPublicacao)}</span>
                    </span>
                  </p>
                </div>
                <CartaoInconsistencia inconsistencia={inconsistencia} acao="excluir" onAlterada={() => void carregar(situacao)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Painel>
  );
}

/* ------------------------------------------------------------ tela */

/** Linha da fila: processo, cliente com logo e quem vistou; risco, erro no robô e inconsistências em selo. */
function LinhaDaFila({ item, comEnvio, aberta, onAbrir }: { item: ConferenciaItem; comEnvio: boolean; aberta: boolean; onAbrir: () => void }) {
  const { publicacao } = item;
  const abertas = item.inconsistencias.filter((inconsistencia) => !inconsistencia.excluidaEm).length;
  return (
    <button type="button" onClick={onAbrir} aria-current={aberta ? "true" : undefined} className={cn(linhaLista(aberta), "space-y-1")}>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold tabular-nums text-foreground">{processoDe(item)}</span>
        {publicacao.demandaRisco ? (
          <Selo tom="perigo" icone={ShieldAlert}>
            Risco
          </Selo>
        ) : null}
        <SelosDeEtiqueta etiquetas={publicacao.etiquetas} />
        <SeloAberturaDePasta publicacao={publicacao} />
        {comEnvio && temErro(item) ? (
          <Selo tom="perigo" icone={CircleAlert}>
            Erro no robô
          </Selo>
        ) : null}
        {abertas ? <Selo tom="alerta">{plural(abertas, "inconsistência", "inconsistências")}</Selo> : null}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
        {publicacao.grupoCliente ? <LogoGrupo grupo={publicacao.grupoCliente} tamanho="xs" /> : null}
        <span className="truncate">{publicacao.cliente ?? publicacao.grupoCliente ?? "—"}</span>
      </span>
      <span className="block truncate text-xs text-muted-foreground">
        {[
          item.vistadoPor ? `vistada por ${item.vistadoPor}` : null,
          item.revistadoPor ? `de novo por ${item.revistadoPor}` : null,
          resumoTarefas(item.agendamentos, comEnvio),
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </button>
  );
}

function Conferencia() {
  const [aba, setAba] = useState<Aba>("conferir");
  const [dados, setDados] = useState<ConferenciaResposta | null>(null);
  const [erro, setErro] = useState("");
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [busca, setBusca] = useState("");
  /** Data da publicação (AAAA-MM-DD); vazio é "Todas as datas". */
  const [dataPublicacao, setDataPublicacao] = useState("");
  /** Data da divulgação no diário (AAAA-MM-DD); vazio é "Todas as datas". */
  const [dataImportacao, setDataImportacao] = useState("");
  /** Área (escritório); vazio é "Todas as áreas". */
  const [area, setArea] = useState("");
  /** Tribunal; vazio é "Todos os tribunais". */
  const [tribunal, setTribunal] = useState("");
  /** Enviadas ao robô: situação no robô (erro, aguardando o VIOS…); vazio é "Todos os status". */
  const [statusRobo, setStatusRobo] = useState("");
  /** Publicação escolhida; sem escolha (ou fora dos filtros), abre a primeira da fila. */
  const [selecionada, setSelecionada] = useState<string | null>(null);
  /** A fila abre recolhida, como na vistagem: a publicação ocupa a largura toda. */
  const [filaRecolhida, setFilaRecolhida] = useState(true);
  /** No celular a fila e a publicação não cabem juntas: mostra a fila só quando pedida. */
  const [listaNoCelular, setListaNoCelular] = useState(false);
  /** Abertura de pasta aberta no detalhe (tarefas, fluxo, datas e responsáveis). */
  const [aberturaAberta, setAberturaAberta] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/conferencia");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar a conferência.");
      setDados(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar a conferência.");
      setDados({ aConferir: [], enviadas: [], aberturas: [], envioSimulado: true, fotos: {}, hoje: new Date().toISOString().slice(0, 10) });
    }
  }, []);

  useEffect(() => {
    // Traz o andamento do robô antes de listar, para não mostrar "na fila" o que já foi processado (só se faz mais de 1 min).
    void sincronizarEnvios().finally(() => void carregar());
  }, [carregar]);

  async function atualizarEnvios() {
    setAtualizando(true);
    setRetorno(null);
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/envios", { method: "POST" });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao atualizar.");
      marcarEnviosSincronizados();
      setRetorno({
        tom: "info",
        texto:
          `${corpo.consultadas} tarefa(s) consultada(s): ${corpo.concluidas} concluída(s) pelo robô, ${corpo.erros} com erro.` +
          (corpo.checadasSozinhas ? ` ${corpo.checadasSozinhas} com check automático (CIÊNCIA NF ou VERIFICAR RENÚNCIA única).` : ""),
      });
      await carregar();
    } catch (e) {
      setRetorno({ tom: "erro", texto: e instanceof Error ? e.message : "Falha ao atualizar." });
    } finally {
      setAtualizando(false);
    }
  }

  const aConferir = useMemo(() => dados?.aConferir ?? [], [dados]);
  const enviadas = useMemo(() => dados?.enviadas ?? [], [dados]);
  const aberturas = useMemo(() => dados?.aberturas ?? [], [dados]);
  const aberturasSemItem = aberturas.filter((item) => !item.publicacao.centralItemId).length;
  // Setas do detalhe da abertura: andam na ordem da lista.
  const indiceAbertura = aberturaAberta ? aberturas.findIndex((item) => item.publicacao.id === aberturaAberta) : -1;
  const navegacaoAbertura: NavegacaoNaFila | null =
    indiceAbertura >= 0
      ? {
          posicao: indiceAbertura + 1,
          total: aberturas.length,
          anterior: aberturas[indiceAbertura - 1]?.publicacao.id ?? null,
          proxima: aberturas[indiceAbertura + 1]?.publicacao.id ?? null,
        }
      : null;
  // O que a busca olha em cada publicação (inclui as partes do texto): montado uma vez por carga, não a cada letra.
  const camposDeBusca = useMemo(
    () => new Map([...aConferir, ...enviadas].map((item) => [item.publicacao.id, camposDaConferencia(item)])),
    [aConferir, enviadas]
  );
  const comErro = useMemo(() => enviadas.filter(temErro), [enviadas]);

  /** Roda de novo todas as publicações com erro; as que podem duplicar no VIOS ficam para o botão da publicação. */
  async function rodarNovamenteComErro() {
    setRodando(true);
    setRetorno(null);
    let quantidade = 0;
    const conferir: string[] = [];
    const falhas: string[] = [];
    for (const item of comErro) {
      const processo = item.publicacao.numeroProcesso ?? item.publicacao.numeroProcessoOriginal ?? item.publicacao.id;
      try {
        const corpo = await pedirRodarNovamente(item.publicacao.id, false);
        if (corpo.precisaConfirmar) conferir.push(processo);
        else quantidade += corpo.enviadas ?? 0;
      } catch (e) {
        falhas.push(`${processo}: ${e instanceof Error ? e.message : "falha"}`);
      }
    }
    setRetorno({
      tom: conferir.length || falhas.length ? "alerta" : "sucesso",
      texto: [
        `${quantidade} tarefa(s) enviada(s) de novo ao robô.`,
        conferir.length
          ? `Confira no VIOS antes de rodar (o robô pode ter gravado): ${conferir.join(", ")} — use o botão Rodar novamente da publicação.`
          : "",
        falhas.length ? `Não rodou: ${falhas.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
    await carregar();
    setRodando(false);
  }

  function concluido(id: string, mensagem: string) {
    // Segue para a próxima da fila (ou a anterior, se era a última).
    const posicao = ids.indexOf(id);
    if (posicao >= 0) setSelecionada(ids[posicao + 1] ?? ids[posicao - 1] ?? null);
    setRetorno({ tom: "sucesso", texto: mensagem });
    void carregar();
    setDados((atual) => (atual ? { ...atual, aConferir: atual.aConferir.filter((item) => item.publicacao.id !== id) } : atual));
    avisarContagensVistagem();
  }

  const lista = aba === "conferir" ? dados?.aConferir : aba === "enviadas" ? dados?.enviadas : [];
  const datasDaLista = (lista ?? []).map((item) => item.publicacao.dataPublicacao);
  const dataAtiva = dataNaLista(dataPublicacao, datasDaLista);
  const importacoesDaLista = (lista ?? []).map((item) => item.publicacao.dataImportacao);
  const importacaoAtiva = dataNaLista(dataImportacao, importacoesDaLista);
  // Área e tribunal escolhidos que sumiram da lista (outra aba, já conferidas) deixam de filtrar.
  const areasDaLista = contarPor(lista ?? [], areaDe);
  const areaAtiva = areasDaLista.some(([nome]) => nome === area) ? area : "";
  const daArea = (lista ?? []).filter((item) => !areaAtiva || areaDe(item) === areaAtiva);
  const tribunaisDaLista = contarPor(daArea, (item) => tribunalDe(item.publicacao));
  const tribunalAtivo = tribunaisDaLista.some(([nome]) => nome === tribunal) ? tribunal : "";
  // Status do robô: só em Enviadas ao robô; contado na área e no tribunal escolhidos. O escolhido que sumiu deixa de filtrar.
  const situacaoDe = (item: ConferenciaItem): SituacaoNoRobo => situacaoNoRobo(item.agendamentos);
  const doTribunal = daArea.filter((item) => !tribunalAtivo || tribunalDe(item.publicacao) === tribunalAtivo);
  const situacoesDaLista = aba === "enviadas" ? contarPor(doTribunal, situacaoDe) : [];
  const statusRoboAtivo = situacoesDaLista.some(([valor]) => valor === statusRobo) ? statusRobo : "";
  const filtrada = daArea.filter(
    (item) =>
      combinaCampos(camposDeBusca.get(item.publicacao.id) ?? [], busca) &&
      (!tribunalAtivo || tribunalDe(item.publicacao) === tribunalAtivo) &&
      (!statusRoboAtivo || situacaoDe(item) === statusRoboAtivo) &&
      (!dataAtiva || item.publicacao.dataPublicacao === dataAtiva) &&
      (!importacaoAtiva || item.publicacao.dataImportacao === importacaoAtiva)
  );
  const grupos = agruparConferencia(filtrada);

  function limparFiltros() {
    setBusca("");
    setArea("");
    setTribunal("");
    setStatusRobo("");
    setDataPublicacao("");
    setDataImportacao("");
  }

  // Mesma ordem da fila (área › tribunal): é por ela que as setas andam para a anterior e a próxima.
  const ordem = grupos.flatMap((grupo) => (grupo.tribunais ? grupo.tribunais.flatMap((porTribunal) => porTribunal.itens) : grupo.itens));
  const ids = ordem.map((item) => item.publicacao.id);
  // Buscar não troca o processo aberto: os resultados aparecem na fila e a pessoa escolhe. Os outros filtros, sim.
  const buscando = busca.trim() !== "";
  const fixaNaBusca = buscando && selecionada ? ((lista ?? []).find((item) => item.publicacao.id === selecionada) ?? null) : null;
  const indiceAberta = selecionada && ids.includes(selecionada) ? ids.indexOf(selecionada) : fixaNaBusca ? -1 : ids.length ? 0 : -1;
  const aberta = indiceAberta >= 0 ? ordem[indiceAberta] : fixaNaBusca;
  // Aberta fora dos resultados: sem setas (elas andam pelos resultados).
  const navegacao: Navegacao | null =
    aberta && indiceAberta >= 0
      ? { posicao: indiceAberta + 1, total: ids.length, anterior: ids[indiceAberta - 1] ?? null, proxima: ids[indiceAberta + 1] ?? null }
      : null;
  // Com busca, a fila fica à vista com os resultados (no celular, a lista aparece no lugar da publicação).
  const filaAberta = !filaRecolhida || buscando;

  function mudarBusca(texto: string) {
    // Prende o processo que está aberto antes de filtrar, para ele não pular para o primeiro resultado.
    if (!selecionada && aberta) setSelecionada(aberta.publicacao.id);
    setBusca(texto);
    if (texto.trim()) setListaNoCelular(true);
  }

  const idAberta = aberta?.publicacao.id ?? null;
  // Publicação aberta em "A conferir": marca na hora e renova enquanto a aba estiver à vista, para o jurídico não reabrir
  // a vistagem enquanto a controladoria confere. Se o jurídico reabriu ou vistou de novo antes, recarrega a lista.
  const aConferirAberta = aba === "conferir" && aberta?.publicacao.status === "controladoria_vistar" ? aberta.publicacao : null;
  const idAConferir = aConferirAberta?.id ?? null;
  const vistagemAberta = aConferirAberta ? `${aConferirAberta.vistadoEm ?? ""}|${aConferirAberta.revistadoEm ?? ""}` : "";
  useEffect(() => {
    if (!idAConferir) return;
    let cancelado = false;
    const marcar = async () => {
      if (document.visibilityState === "hidden") return;
      const atual = await marcarAbertaNaConferencia(idAConferir);
      if (cancelado || !atual) return;
      const mudou = atual.status !== "controladoria_vistar" || `${atual.vistadoEm ?? ""}|${atual.revistadoEm ?? ""}` !== vistagemAberta;
      if (!mudou) return;
      setRetorno({
        tom: "info",
        texto:
          atual.status === "juridico_vistar"
            ? "O jurídico reabriu esta vistagem para alterar antes da conferência. A lista foi recarregada."
            : "Esta vistagem mudou desde que a lista foi carregada. A lista foi recarregada.",
      });
      void carregar();
    };
    void marcar();
    const timer = window.setInterval(() => void marcar(), RENOVAR_CONFERENCIA_MS);
    document.addEventListener("visibilitychange", marcar);
    return () => {
      cancelado = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", marcar);
    };
  }, [idAConferir, vistagemAberta, carregar]);
  useEffect(() => {
    // Ao andar pelas setas, a fila acompanha a publicação aberta.
    document.querySelector("[data-fila-conferencia] [aria-current=true]")?.scrollIntoView({ block: "nearest" });
  }, [idAberta]);

  function abrir(id: string) {
    setSelecionada(id);
    setListaNoCelular(false);
  }

  const linhasDaFila = (itens: ConferenciaItem[]) => (
    <ul className="divide-y divide-[#eef3f5]">
      {itens.map((item) => (
        <li key={item.publicacao.id}>
          <LinhaDaFila item={item} comEnvio={aba === "enviadas"} aberta={item.publicacao.id === aberta?.publicacao.id} onAbrir={() => abrir(item.publicacao.id)} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      <BarraAba
        resumo={
          <div className="w-fit" data-tour="cf-abas">
          <Segmented
            label="Situação"
            value={aba}
            options={[
              { value: "conferir", label: dados ? `A conferir ${aConferir.length}` : "A conferir" },
              { value: "enviadas", label: dados ? `Enviadas ao robô ${enviadas.length}` : "Enviadas ao robô" },
              { value: "aberturas", label: !dados ? "Abertura de pasta" : aberturasSemItem ? `Abertura de pasta ${aberturas.length} (${aberturasSemItem} sem item)` : `Abertura de pasta ${aberturas.length}` },
              { value: "inconsistencias", label: "Inconsistências" },
            ]}
            onChange={setAba}
          />
          </div>
        }
      >
        {aba !== "inconsistencias" && aba !== "aberturas" ? (
          <>
            {!filaAberta ? (
              <Button type="button" variant="outline" className="hidden lg:inline-flex" onClick={() => setFilaRecolhida(false)} data-tour="cf-fila">
                <PanelLeftOpen />
                Mostrar fila
              </Button>
            ) : null}
            <Busca data-tour="cf-busca"
              value={busca}
              onChange={(evento) => mudarBusca(evento.target.value)}
              onKeyDown={(evento) => {
                // Enter abre o primeiro resultado; Esc limpa a busca.
                if (evento.key === "Enter" && ids[0]) abrir(ids[0]);
                if (evento.key === "Escape") mudarBusca("");
              }}
              placeholder="Buscar processo, cliente, parte ou pessoa"
              aria-label="Buscar publicação"
            />
            <Seletor
              rotulo="Área"
              className="sm:w-60"
              valor={areaAtiva}
              onChange={(valor) => {
                setArea(valor);
                setTribunal("");
              }}
              todos={{ rotulo: "Todas as áreas", contagem: lista?.length, icone: <IconeOpcao icone={Layers} /> }}
              opcoes={areasDaLista.map(([nome, quantidade]) => ({ valor: nome, rotulo: nome, contagem: quantidade, icone: <IconeArea area={nome} /> }))}
            />
            <Seletor
              rotulo="Tribunal"
              className="sm:w-52"
              valor={tribunalAtivo}
              onChange={setTribunal}
              todos={{ rotulo: "Todos os tribunais", contagem: daArea.length, icone: <IconeOpcao icone={Landmark} /> }}
              opcoes={tribunaisDaLista.map(([nome, quantidade]) => ({ valor: nome, rotulo: nome, descricao: descricaoDoTribunal(nome), contagem: quantidade, icone: <IconeTribunal sigla={nome} /> }))}
            />
            <FiltroData rotulo="Data Publicação" datas={datasDaLista} valor={dataAtiva} onChange={setDataPublicacao} />
            <FiltroData rotulo="Data da importação" datas={importacoesDaLista} valor={importacaoAtiva} onChange={setDataImportacao} />
          </>
        ) : null}
        {aba === "enviadas" ? (
          <>
            <Seletor
              rotulo="Status do robô"
              className="sm:w-56"
              valor={statusRoboAtivo}
              onChange={setStatusRobo}
              todos={{ rotulo: "Todos os status", contagem: doTribunal.length, icone: <IconeOpcao icone={Bot} /> }}
              // Na ordem do filtro (primeiro o que pede ação), só as situações que existem na lista.
              opcoes={SITUACOES_NO_ROBO.flatMap((situacao) => {
                const quantidade = situacoesDaLista.find(([valor]) => valor === situacao.valor)?.[1];
                return quantidade
                  ? [{ valor: situacao.valor, rotulo: situacao.rotulo, descricao: situacao.descricao, contagem: quantidade, icone: <IconeOpcao icone={ICONE_SITUACAO[situacao.valor]} /> }]
                  : [];
              })}
            />
            <Button variant="outline" onClick={atualizarEnvios} disabled={atualizando || rodando}>
              {atualizando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Atualizar status do robô
            </Button>
            {comErro.length ? (
              <Button variant="outline" onClick={rodarNovamenteComErro} disabled={rodando || atualizando}>
                {rodando ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
                Rodar novamente os com erro ({comErro.length})
              </Button>
            ) : null}
          </>
        ) : null}
      </BarraAba>

      {retorno ? (
        <Aviso
          tom={retorno.tom}
          acao={
            <Button variant="ghost" size="icon-xs" className="-my-1 -mr-1" aria-label="Fechar aviso" onClick={() => setRetorno(null)}>
              <X />
            </Button>
          }
        >
          {retorno.texto}
        </Aviso>
      ) : null}
      {erro ? (
        <Aviso
          tom="erro"
          acao={
            <Button size="xs" variant="outline" onClick={() => void carregar()}>
              Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : null}

      {aba === "inconsistencias" ? (
        <PainelInconsistencias />
      ) : aba === "aberturas" && dados ? (
        <PainelAberturaDePasta
          itens={aberturas}
          onAbrir={setAberturaAberta}
          onTentado={(texto) => {
            setRetorno({ tom: "sucesso", texto });
            void carregar();
          }}
          onErro={(texto) => {
            setRetorno({ tom: "erro", texto });
            void carregar();
          }}
        />
      ) : lista === undefined ? (
        <Painel>
          <Carregando rotulo="Carregando a conferência" />
        </Painel>
      ) : lista.length === 0 ? (
        <Painel data-tour="cf-vazio">
          {aba === "conferir" ? (
            <Vazio icone={Inbox} titulo="Nenhuma vistagem para conferir.">
              Quando o jurídico vistar uma publicação, ela aparece aqui.
            </Vazio>
          ) : (
            <Vazio icone={Bot} titulo="Nenhuma tarefa enviada ao robô ainda.">
              As publicações validadas aparecem aqui com o andamento do robô.
            </Vazio>
          )}
        </Painel>
      ) : filtrada.length === 0 && !(buscando && aberta) ? (
        <Painel>
          <Vazio icone={SearchX} titulo="Nenhuma publicação com esses filtros.">
            <Button variant="link" className="h-auto p-0" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          </Vazio>
        </Painel>
      ) : (
        // Um processo por vez, como na vistagem do jurídico: a fila (por área e, no Trabalhista, por tribunal) fica
        // recolhida e as setas da faixa andam entre as publicações. No desktop, fila e publicação rolam cada uma no seu painel.
        <div
          className={cn(
            // A linha tem a altura da grade (e não a do conteúdo): é o que deixa publicação e tarefas rolarem por dentro.
            "grid gap-4 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[30rem] lg:grid-rows-[minmax(0,1fr)]",
            filaAberta ? "lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]" : "lg:grid-cols-1"
          )}
        >
          <Painel
            aria-label={buscando ? "Resultados da busca" : aba === "conferir" ? "Publicações a conferir" : "Publicações enviadas ao robô"}
            data-fila-conferencia
            data-tour="cf-fila"
            className={cn("lg:flex lg:h-full lg:flex-col", aberta && !listaNoCelular && "hidden lg:flex", !filaAberta && "lg:hidden")}
          >
            {buscando ? (
              // Na busca, o topo da fila diz o que foi buscado e quantos achou; o X limpa e a fila volta ao normal.
              <div className="flex items-center gap-2 border-b border-[#e6eef0] bg-[#f2fbfb] px-4 py-2">
                <Search className="size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-xs text-[#285f7a]" aria-live="polite">
                  <span className="font-semibold tabular-nums">{ordem.length}</span> {ordem.length === 1 ? "resultado" : "resultados"} para{" "}
                  <span className="font-semibold">“{busca.trim()}”</span>
                </span>
                <Button type="button" size="icon-xs" variant="ghost" onClick={() => mudarBusca("")} aria-label="Limpar a busca" title="Limpar a busca">
                  <X />
                </Button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 border-b border-[#e6eef0] px-4 py-2 lg:flex">
                <span className="flex-1 text-xs font-medium text-muted-foreground">
                  Fila <span className="tabular-nums">· {ordem.length}</span>
                </span>
                <Button type="button" size="icon-xs" variant="ghost" onClick={() => setFilaRecolhida(true)} aria-label="Recolher a fila" title="Recolher a fila">
                  <PanelLeftClose />
                </Button>
              </div>
            )}
            <div className="max-h-[70vh] overflow-auto lg:max-h-none lg:flex-1">
              {buscando && !ordem.length ? (
                <Vazio icone={SearchX} titulo="Nada encontrado." className="py-8">
                  Tente parte do nome do grupo, da parte ou o número do processo.
                </Vazio>
              ) : null}
              {buscando && ordem.length > 0 && aberta && indiceAberta < 0 ? (
                // O processo aberto ao lado não está nos resultados: avisa, para não parecer que a busca o achou.
                <p className="border-b border-[#eef3f5] px-4 py-2 text-[11px] text-muted-foreground">
                  O processo aberto ao lado não está nos resultados. Escolha um da lista.
                </p>
              ) : null}
              {grupos.map((grupo) => (
                <section key={grupo.area} aria-label={grupo.area}>
                  <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2 text-xs font-semibold text-[#285f7a]">
                    <IconeArea area={grupo.area} />
                    <span className="truncate">{grupo.area}</span>
                    <span className="font-normal tabular-nums text-muted-foreground">{grupo.itens.length}</span>
                  </h3>
                  {grupo.tribunais
                    ? grupo.tribunais.map((porTribunal) => (
                        <section key={porTribunal.tribunal} aria-label={`${grupo.area} · ${porTribunal.tribunal}`}>
                          <p className="flex items-center gap-1.5 border-b border-[#eef3f5] px-4 py-1.5 text-[11px] font-semibold text-muted-foreground">
                            <Landmark className="size-3.5 text-[#3e84a8]" aria-hidden />
                            {porTribunal.tribunal}
                            <span className="font-normal tabular-nums">{porTribunal.itens.length}</span>
                          </p>
                          {linhasDaFila(porTribunal.itens)}
                        </section>
                      ))
                    : linhasDaFila(grupo.itens)}
                </section>
              ))}
            </div>
          </Painel>

          <div className={cn("min-w-0 lg:h-full lg:min-h-0", (!aberta || listaNoCelular) && "hidden lg:block")}>
            {aberta ? (
              <ItemConferencia
                key={aberta.publicacao.id}
                item={aberta}
                comEnvio={aba === "enviadas"}
                modoReal={!dados?.envioSimulado}
                fotos={dados?.fotos ?? {}}
                hoje={dados?.hoje ?? new Date().toISOString().slice(0, 10)}
                navegacao={navegacao}
                onAbrir={abrir}
                onVoltar={() => setListaNoCelular(true)}
                onConcluido={concluido}
                onEditado={async (mensagem) => {
                  setRetorno({ tom: "sucesso", texto: mensagem });
                  await carregar();
                }}
              />
            ) : null}
          </div>
        </div>
      )}

      {/* Abertura de pasta: as tarefas com a árvore do fluxo, datas e responsáveis, como a Central recebeu. Só consulta. */}
      <DetalheAgendada
        item={aba === "aberturas" && indiceAbertura >= 0 ? aberturas[indiceAbertura] : null}
        fotos={dados?.fotos ?? {}}
        hoje={dados?.hoje ?? new Date().toISOString().slice(0, 10)}
        navegacao={navegacaoAbertura}
        onAbrir={setAberturaAberta}
        onFechar={() => setAberturaAberta(null)}
      />
    </div>
  );
}

export function ConferenciaClient() {
  return (
    <AcessoOperacoesLegais>
      <Conferencia />
    </AcessoOperacoesLegais>
  );
}
