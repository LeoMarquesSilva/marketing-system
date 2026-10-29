"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bot,
  Check,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Inbox,
  LoaderCircle,
  MessageSquareWarning,
  RefreshCw,
  RotateCcw,
  SearchX,
  Send,
  Undo2,
  X,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { ROTULO_ETIQUETA } from "@/lib/vistagem/agendamento";
import { ROTULO_CONTAGEM } from "@/lib/vistagem/dias-uteis";
import { TIPOS_INCONSISTENCIA_JURIDICO } from "@/lib/vistagem/inconsistencias";
import type { AgendamentoResumo, ConferenciaItem, ConferenciaResposta, EnvioStatus, InconsistenciaItem } from "@/lib/vistagem/types";
import { linkTarefaVios } from "@/lib/vistagem/vios-links";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { CartaoInconsistencia } from "./inconsistencias-ui";
import { IconeArea } from "./marcas";
import { Seletor } from "./seletor";
import { DadosPasta, DadosPublicacao, SeloEsocial, TeorPublicacao, formatarData, formatarDataHora } from "./publicacao-ui";
import {
  Aviso,
  BarraAba,
  Busca,
  CabecalhoLista,
  Campo,
  Carregando,
  Indicador,
  Indicadores,
  Painel,
  PainelTopo,
  Secao,
  Selo,
  Vazio,
  TOM_CLASSE,
  type TomSelo,
} from "./ui";

type Aba = "conferir" | "enviadas" | "inconsistencias";

/** Retorno de uma ação da tela (sucesso, alerta, informação ou erro). */
type Retorno = { tom: "sucesso" | "erro" | "alerta" | "info"; texto: string };

const temErro = (item: ConferenciaItem) => item.agendamentos.some((agendamento) => agendamento.envioStatus === "erro");

const processoDe = (item: ConferenciaItem) => item.publicacao.numeroProcesso ?? item.publicacao.numeroProcessoOriginal;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

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

interface Integracao {
  nome: string;
  ok: boolean;
  detalhe: string;
}

const ENVIO: Record<EnvioStatus, { rotulo: string; tom: TomSelo }> = {
  nao_enviado: { rotulo: "Não enviada", tom: "neutro" },
  pendente: { rotulo: "Na fila do robô", tom: "marca" },
  enviado: { rotulo: "Com o robô", tom: "marca" },
  processando: { rotulo: "Agendando no VIOS", tom: "marca" },
  concluido: { rotulo: "Agendada", tom: "sucesso" },
  erro: { rotulo: "Erro no robô", tom: "perigo" },
};

const NA_FILA: EnvioStatus[] = ["pendente", "enviado", "processando"];

/** Classe da tarefa é categoria, não estado: tons da marca (DESIGN.md). */

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Busca local na lista já carregada: processo (com ou sem pontuação), pasta, cliente, tribunal e pessoas. */
function combinaBusca(item: ConferenciaItem, busca: string): boolean {
  const termo = normalizar(busca.trim());
  if (!termo) return true;
  const { publicacao } = item;
  const campos = [
    publicacao.numeroProcesso,
    publicacao.numeroProcessoOriginal,
    publicacao.pastaCi,
    publicacao.cliente,
    publicacao.grupoCliente,
    publicacao.tribunal,
    publicacao.escritorioResponsavel,
    item.vistadoPor,
    item.conferidoPor,
    ...item.agendamentos.map((agendamento) => agendamento.responsavel),
  ]
    .filter((valor): valor is string => Boolean(valor))
    .map(normalizar);
  if (campos.some((valor) => valor.includes(termo))) return true;
  const digitos = termo.replace(/\D/g, "");
  return digitos.length >= 4 && campos.some((valor) => valor.replace(/\D/g, "").includes(digitos));
}

/* ------------------------------------------------------------ peças locais */

/** Modal centralizado do padrão (DESIGN.md): cabeçalho e rodapé fixos, só o corpo rola. */
function DialogoAcao({
  aberto,
  onFechar,
  ocupado,
  titulo,
  descricao,
  rodape,
  children,
}: {
  aberto: boolean;
  onFechar: () => void;
  ocupado: boolean;
  titulo: ReactNode;
  descricao: ReactNode;
  rodape: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && !ocupado && onFechar()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg" showCloseButton={!ocupado}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-4 pr-14 text-left">
          <DialogTitle className="text-lg">{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-4">{rodape}</div>
      </DialogContent>
    </Dialog>
  );
}

/** Célula da lista de tarefas: no mobile mostra o rótulo; no desktop o rótulo fica só para leitor de tela. */
function Celula({ rotulo, mostrarRotulo = true, className, children }: { rotulo: string; mostrarRotulo?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <span className={cn("block text-xs text-muted-foreground", mostrarRotulo ? "lg:sr-only" : "sr-only")}>{rotulo}</span>
      {children}
    </div>
  );
}

function LinkVios({ ci }: { ci: string }) {
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

/* ------------------------------------------------------------ tarefas */

const COLUNAS = "lg:grid-cols-[7rem_minmax(0,1.7fr)_9rem_minmax(0,1fr)_minmax(0,1fr)]";
const COLUNAS_ENVIO = "lg:grid-cols-[7rem_minmax(0,1.5fr)_9rem_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.3fr)]";

function TabelaTarefas({ agendamentos, comEnvio }: { agendamentos: AgendamentoResumo[]; comEnvio: boolean }) {
  const colunas = comEnvio ? COLUNAS_ENVIO : COLUNAS;
  if (!agendamentos.length) return <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhuma tarefa nesta vistagem.</p>;
  return (
    <div>
      <CabecalhoLista aria-hidden className={cn("hidden gap-x-4 border-t lg:grid", colunas)}>
        <span>Tipo</span>
        <span>Tarefa</span>
        <span>Data</span>
        <span>Responsável</span>
        <span>Revisor</span>
        {comEnvio ? <span>Robô</span> : null}
      </CabecalhoLista>
      <ul className="divide-y divide-[#eef3f5] border-t border-[#e6eef0] lg:border-t-0">
        {agendamentos.map((item) => {
          const simulada = item.envioStatus === "concluido" && item.envioSimulado;
          return (
            <li key={item.id} className={cn("grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3 text-sm lg:items-start", colunas)}>
              <Celula rotulo="Tipo" mostrarRotulo={false} className="col-span-2 lg:col-span-1">
                <Selo tom={TOM_CLASSE[item.etiqueta]}>{ROTULO_ETIQUETA[item.etiqueta]}</Selo>
              </Celula>
              <Celula rotulo="Tarefa" mostrarRotulo={false} className="col-span-2 lg:col-span-1">
                <span className="block break-words font-medium text-foreground">{item.tarefa}</span>
                {item.observacao ? <span className="mt-0.5 block whitespace-pre-wrap break-words text-xs text-muted-foreground">{item.observacao}</span> : null}
              </Celula>
              <Celula rotulo="Data">
                <span className="tabular-nums text-foreground">
                  {formatarData(item.data)}
                  {!item.dataFatal && item.hora ? ` às ${item.hora}` : ""}
                </span>
                {item.dataFatal ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    enviar · fatal <span className="tabular-nums">{formatarData(item.dataFatal)}</span>
                    {item.diasPrazo && item.contagemPrazo ? ` · ${item.diasPrazo} ${ROTULO_CONTAGEM[item.contagemPrazo]}` : ""}
                  </span>
                ) : null}
              </Celula>
              <Celula rotulo="Responsável">
                <span className="break-words text-foreground">{item.responsavel}</span>
              </Celula>
              <Celula rotulo="Revisor">
                <span className={cn("break-words", item.revisor ? "text-foreground" : "text-muted-foreground")}>{item.revisor ?? "—"}</span>
              </Celula>
              {comEnvio ? (
                <Celula rotulo="Robô" className="col-span-2 lg:col-span-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {simulada ? (
                      <Selo tom="alerta" icone={Bot}>
                        Simulada
                      </Selo>
                    ) : (
                      <Selo tom={ENVIO[item.envioStatus].tom}>
                        {ENVIO[item.envioStatus].rotulo}
                        {item.envioSimulado ? " (simulação)" : ""}
                      </Selo>
                    )}
                    {item.viosTarefaId ? <LinkVios ci={item.viosTarefaId} /> : null}
                  </div>
                  {simulada ? <span className="mt-1 block text-xs text-muted-foreground">Preenchida no VIOS, não gravada</span> : null}
                  {item.envioErro ? <span className="mt-1 block whitespace-pre-wrap break-words text-xs text-red-700">{item.envioErro}</span> : null}
                </Celula>
              ) : null}
            </li>
          );
        })}
      </ul>
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

function ItemConferencia({
  item,
  comEnvio,
  modoReal,
  onConcluido,
}: {
  item: ConferenciaItem;
  comEnvio: boolean;
  modoReal: boolean;
  onConcluido?: (id: string, mensagem: string) => void;
}) {
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
          ? `${corpo.enviadas} tarefa(s) enviada(s) ao robô${corpo.simulado ? " em modo simulação" : ""}.`
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
            <Button size="sm" variant="outline" onClick={() => setDevolvendo(true)} disabled={ocupado}>
              <Undo2 />
              Devolver ao jurídico
            </Button>
            <Button size="sm" onClick={() => agir("validar")} disabled={ocupado}>
              {ocupado && !dialogoAberto ? spinner : <Send />}
              Validar e enviar ao robô
            </Button>
          </>
        ) : null}
        {erroRobo ? (
          <Button size="sm" variant="outline" onClick={() => rodarDeNovo(false)} disabled={ocupado}>
            {ocupado && !dialogoAberto ? spinner : <RotateCcw />}
            Rodar novamente
          </Button>
        ) : null}
        {podeReenviar ? (
          <Button size="sm" onClick={() => agir("reenviar")} disabled={ocupado}>
            {ocupado && !dialogoAberto ? spinner : <Bot />}
            Reenviar gravando no VIOS
          </Button>
        ) : null}
      </>
    ) : null;

  return (
    <Painel aria-labelledby={base}>
      <PainelTopo
        id={base}
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-all tabular-nums">{processo}</span>
            {publicacao.tribunal ? <Selo>{publicacao.tribunal}</Selo> : null}
            <SeloEsocial publicacao={publicacao} />
          </span>
        }
        descricao={
          <>
            Vistada {item.vistadoPor ? `por ${item.vistadoPor} ` : ""}em {formatarDataHora(publicacao.vistadoEm)}
            {comEnvio && publicacao.conferidoEm
              ? ` · conferida ${item.conferidoPor ? `por ${item.conferidoPor} ` : ""}em ${formatarDataHora(publicacao.conferidoEm)}`
              : ""}
          </>
        }
      >
        {acoes}
      </PainelTopo>

      {(erro && !dialogoAberto) || erroRobo || podeReenviar ? (
        <Secao>
          {erro && !dialogoAberto ? <Aviso tom="erro">{erro}</Aviso> : null}
          {erroRobo ? (
            <Aviso tom="erro" titulo="Erro no robô">
              {item.agendamentos.find((agendamento) => agendamento.envioStatus === "erro")?.envioErro ?? "sem detalhe"}
            </Aviso>
          ) : null}
          {podeReenviar ? <Aviso tom="info">Tarefas rodadas em simulação: reenvie para gravar no VIOS.</Aviso> : null}
        </Secao>
      ) : null}

      <Secao titulo="Pasta e publicação" id={`${base}-publicacao`}>
        <DadosPasta publicacao={{ ...publicacao, pendencia: null }} />
        <DadosPublicacao publicacao={publicacao} />
      </Secao>

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

      <Secao>
        <TeorPublicacao publicacao={publicacao} />
      </Secao>

      <section aria-labelledby={`${base}-tarefas`} className="border-t border-[#e6eef0]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-4">
          <h3 id={`${base}-tarefas`} className="text-xs font-semibold uppercase tracking-normal text-[#285f7a]">
            Tarefas
          </h3>
          <span className="text-xs text-muted-foreground">{resumoTarefas(item.agendamentos, comEnvio)}</span>
        </div>
        <TabelaTarefas agendamentos={item.agendamentos} comEnvio={comEnvio} />
      </section>

      <DialogoAcao
        aberto={devolvendo}
        onFechar={fecharDialogo}
        ocupado={ocupado}
        titulo="Devolver ao jurídico"
        descricao={
          <>
            Processo <span className="tabular-nums">{processo}</span>. A publicação volta para o jurídico com esta inconsistência.
          </>
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
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">Inconsistência do jurídico</span>
          <Seletor
            rotulo="Inconsistência do jurídico"
            placeholder="Escolha o tipo…"
            valor={tipoInconsistencia}
            onChange={setTipoInconsistencia}
            opcoes={TIPOS_INCONSISTENCIA_JURIDICO.map((valor) => ({ valor, rotulo: valor }))}
          />
        </div>
        <Campo rotulo="O que está errado" dica="O jurídico vê este texto.">
          <Textarea value={motivo} onChange={(evento) => setMotivo(evento.target.value)} rows={4} maxLength={2000} />
        </Campo>
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      </DialogoAcao>

      <DialogoAcao
        aberto={confirmacao !== null}
        onFechar={fecharDialogo}
        ocupado={ocupado}
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

function Conferencia() {
  const [aba, setAba] = useState<Aba>("conferir");
  const [dados, setDados] = useState<ConferenciaResposta | null>(null);
  const [integracoes, setIntegracoes] = useState<Integracao[] | null>(null);
  const [erro, setErro] = useState("");
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/conferencia");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar a conferência.");
      setDados(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar a conferência.");
      setDados({ aConferir: [], enviadas: [], envioSimulado: true });
    }
  }, []);

  useEffect(() => {
    // Traz o andamento do robô antes de listar, para não mostrar "na fila" o que já foi processado.
    void authFetch("/api/operacoes-legais/vistagem/envios", { method: "POST" })
      .catch(() => null)
      .finally(() => void carregar());
    authFetch("/api/operacoes-legais/vistagem/integracoes")
      .then((resposta) => resposta.json())
      .then((corpo) => setIntegracoes(corpo.integracoes ?? []))
      .catch(() => setIntegracoes([]));
  }, [carregar]);

  async function atualizarEnvios() {
    setAtualizando(true);
    setRetorno(null);
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/envios", { method: "POST" });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao atualizar.");
      setRetorno({
        tom: "info",
        texto: `${corpo.consultadas} tarefa(s) consultada(s): ${corpo.concluidas} concluída(s) pelo robô, ${corpo.erros} com erro.`,
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
  const comErro = useMemo(() => enviadas.filter(temErro), [enviadas]);

  const numeros = useMemo(() => {
    const tarefasEnviadas = enviadas.flatMap((item) => item.agendamentos);
    const abertas = [...aConferir, ...enviadas].flatMap((item) => item.inconsistencias).filter((item) => !item.excluidaEm);
    return {
      tarefasAConferir: aConferir.reduce((soma, item) => soma + item.agendamentos.length, 0),
      agendadas: tarefasEnviadas.filter((item) => item.envioStatus === "concluido").length,
      naFila: tarefasEnviadas.filter((item) => NA_FILA.includes(item.envioStatus)).length,
      inconsistencias: abertas.length,
      contestadas: abertas.filter((item) => item.contestacao).length,
    };
  }, [aConferir, enviadas]);

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
    setRetorno({ tom: "sucesso", texto: mensagem });
    void carregar();
    setDados((atual) => (atual ? { ...atual, aConferir: atual.aConferir.filter((item) => item.publicacao.id !== id) } : atual));
  }

  const lista = aba === "conferir" ? dados?.aConferir : aba === "enviadas" ? dados?.enviadas : [];
  const filtrada = (lista ?? []).filter((item) => combinaBusca(item, busca));
  const valor = (n: number) => (dados ? n : "—");

  return (
    <div className="space-y-4">
      <BarraAba resumo="Valide para mandar as tarefas ao robô de agendamento do VIOS, ou devolva ao jurídico com o motivo.">
        {dados?.envioSimulado ? (
          <Selo tom="alerta" icone={Bot}>
            Modo simulação: o robô preenche no VIOS sem gravar
          </Selo>
        ) : null}
        {(integracoes ?? []).map((integracao) => (
          <span key={integracao.nome} title={integracao.detalhe} className="inline-flex">
            <Selo tom={integracao.ok ? "sucesso" : "perigo"} icone={integracao.ok ? Check : CircleAlert}>
              {integracao.nome}
            </Selo>
            <span className="sr-only">
              {integracao.ok ? " funcionando" : " com problema"}: {integracao.detalhe}
            </span>
          </span>
        ))}
      </BarraAba>

      <Indicadores>
        <Indicador icone={Inbox} rotulo="A conferir" valor={valor(aConferir.length)}>
          {dados ? plural(numeros.tarefasAConferir, "tarefa para validar", "tarefas para validar") : null}
        </Indicador>
        <Indicador icone={Bot} rotulo="Enviadas ao robô" valor={valor(enviadas.length)}>
          {dados ? `${plural(numeros.agendadas, "tarefa agendada", "tarefas agendadas")} no VIOS · ${numeros.naFila} na fila` : null}
        </Indicador>
        <Indicador icone={CircleAlert} rotulo="Com erro no robô" valor={valor(comErro.length)} tom={comErro.length ? "perigo" : "neutro"}>
          {dados ? (comErro.length ? "Rode de novo em Enviadas ao robô" : "Nenhum erro agora") : null}
        </Indicador>
        <Indicador
          icone={MessageSquareWarning}
          rotulo="Inconsistências abertas"
          valor={valor(numeros.inconsistencias)}
          tom={numeros.contestadas ? "alerta" : "neutro"}
        >
          {dados ? `${plural(numeros.contestadas, "contestada", "contestadas")} pelo jurídico` : null}
        </Indicador>
      </Indicadores>

      <BarraAba
        resumo={
          <Segmented
            label="Situação"
            value={aba}
            options={[
              { value: "conferir", label: dados ? `A conferir ${aConferir.length}` : "A conferir" },
              { value: "enviadas", label: dados ? `Enviadas ao robô ${enviadas.length}` : "Enviadas ao robô" },
              { value: "inconsistencias", label: "Inconsistências" },
            ]}
            onChange={setAba}
          />
        }
      >
        {aba !== "inconsistencias" ? (
          <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar processo, pasta ou cliente" aria-label="Buscar publicação" />
        ) : null}
        {aba === "enviadas" ? (
          <>
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
      ) : lista === undefined ? (
        <Painel>
          <Carregando rotulo="Carregando a conferência" />
        </Painel>
      ) : lista.length === 0 ? (
        <Painel>
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
      ) : filtrada.length === 0 ? (
        <Painel>
          <Vazio icone={SearchX} titulo="Nenhuma publicação com essa busca.">
            <Button variant="link" className="h-auto p-0" onClick={() => setBusca("")}>
              Limpar busca
            </Button>
          </Vazio>
        </Painel>
      ) : (
        <ul className="space-y-4" aria-label={aba === "conferir" ? "Vistagens a conferir" : "Publicações enviadas ao robô"}>
          {filtrada.map((item) => (
            <li key={item.publicacao.id}>
              <ItemConferencia item={item} comEnvio={aba === "enviadas"} modoReal={!dados?.envioSimulado} onConcluido={concluido} />
            </li>
          ))}
        </ul>
      )}
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
