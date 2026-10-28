"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CircleCheck,
  CornerDownRight,
  ExternalLink,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  SearchX,
  TriangleAlert,
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
import { SUBTIPOS_INCONSISTENCIA_AGENDAMENTO, TIPOS_INCONSISTENCIA_AGENDAMENTO } from "@/lib/vistagem/inconsistencias";
import type { TarefaNoVios } from "@/lib/vistagem/fila-vios";
import type { AgendamentoResumo, CheckResposta, ConferenciaItem } from "@/lib/vistagem/types";
import { linkTarefaVios } from "@/lib/vistagem/vios-links";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { CartaoInconsistencia } from "./inconsistencias-ui";
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
  campoClasse,
  TOM_CLASSE,
} from "./ui";

type Aba = "aChecar" | "revisar" | "checadas";

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "aChecar", rotulo: "A checar" },
  { valor: "revisar", rotulo: "Em revisão" },
  { valor: "checadas", rotulo: "Checadas" },
];

/** Retorno de uma ação da tela. */
type Retorno = { tom: "sucesso" | "erro"; texto: string };

/** Classe da tarefa é categoria, não estado: tons da marca (DESIGN.md). */

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** A tarefa pedida ficou no VIOS com outra data ou outro horário. */
function diverge(tarefa: TarefaNoVios, dataPedida: string, horaPedida: string | null): boolean {
  return Boolean(tarefa.principal && ((tarefa.data && tarefa.data !== dataPedida) || (horaPedida && tarefa.hora !== horaPedida)));
}

const temDivergencia = (item: ConferenciaItem) =>
  item.agendamentos.some((agendamento) => (agendamento.viosTarefas ?? []).some((tarefa) => diverge(tarefa, agendamento.data, agendamento.hora)));

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
    ...item.agendamentos.flatMap((agendamento) => [agendamento.responsavel, agendamento.viosTarefaId]),
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

function LinkVios({ ci, className }: { ci: string; className?: string }) {
  return (
    <a
      href={linkTarefaVios(ci)}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir a tarefa no VIOS (nova aba)"
      aria-label={`Abrir a tarefa CI ${ci} no VIOS (nova aba)`}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm text-xs font-medium text-[#347796] hover:text-[#285f7a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
        className
      )}
    >
      <span className="font-mono tabular-nums">CI {ci}</span>
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

/* ------------------------------------------------------------ tarefas */

/** Como a tarefa ficou no VIOS: a pedida e as que o fluxo criou, com a data e a hora agendadas. */
function AgendadoNoVios({ tarefas, dataPedida, horaPedida }: { tarefas: TarefaNoVios[]; dataPedida: string; horaPedida: string | null }) {
  return (
    <div className="col-span-full overflow-hidden rounded-md border border-[#e6eef0] bg-[#f7fbfc] text-xs">
      <p className="flex items-center gap-1.5 border-b border-[#e6eef0] px-3 py-1.5 font-medium text-[#285f7a]">
        <CalendarCheck className="size-3.5" aria-hidden />
        Agendado no VIOS
      </p>
      <ul className="divide-y divide-[#eef3f5]">
        {tarefas.map((tarefa) => {
          const divergente = diverge(tarefa, dataPedida, horaPedida);
          return (
            <li key={tarefa.ci} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className={cn("flex min-w-0 items-center gap-1", tarefa.principal ? "font-medium text-foreground" : "text-muted-foreground")}>
                {tarefa.principal ? null : (
                  <>
                    <CornerDownRight className="size-3 shrink-0" aria-hidden />
                    <span className="sr-only">Criada pelo fluxo:</span>
                  </>
                )}
                <span className="break-words">{tarefa.tipo ?? "Tarefa"}</span>
              </span>
              <span className={cn("font-mono", divergente ? "font-semibold text-amber-800" : "text-foreground")}>
                {formatarData(tarefa.data)}
                {tarefa.hora ? ` ${tarefa.hora}` : ""}
              </span>
              {divergente ? (
                <Selo tom="alerta" icone={TriangleAlert}>
                  Pedido {formatarData(dataPedida)}
                  {horaPedida ? ` ${horaPedida}` : ""}
                </Selo>
              ) : null}
              {tarefa.dataLimite && tarefa.dataLimite !== tarefa.data ? (
                <span className="text-muted-foreground">
                  limite <span className="font-mono">{formatarData(tarefa.dataLimite)}</span>
                </span>
              ) : null}
              {tarefa.responsaveis ? <span className="break-words text-muted-foreground">{tarefa.responsaveis}</span> : null}
              <LinkVios ci={tarefa.ci} className="sm:ml-auto" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const COLUNAS = "lg:grid-cols-[minmax(0,2fr)_10rem_minmax(0,1.2fr)_8rem]";

function TabelaCheck({ agendamentos }: { agendamentos: AgendamentoResumo[] }) {
  if (!agendamentos.length) return <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhuma tarefa nesta vistagem.</p>;
  return (
    <div>
      <CabecalhoLista aria-hidden className={cn("hidden gap-x-4 border-t lg:grid", COLUNAS)}>
        <span>Tarefa no VIOS</span>
        <span>Data pedida</span>
        <span>Responsável</span>
        <span>CI</span>
      </CabecalhoLista>
      <ul className="divide-y divide-[#eef3f5] border-t border-[#e6eef0] lg:border-t-0">
        {agendamentos.map((agendamento) => (
          <li key={agendamento.id} className={cn("grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3 text-sm lg:items-start", COLUNAS)}>
            <Celula rotulo="Tarefa no VIOS" mostrarRotulo={false} className="col-span-2 lg:col-span-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="break-words font-medium text-foreground">{agendamento.tarefa}</span>
                <Selo tom={TOM_CLASSE[agendamento.etiqueta]}>{ROTULO_ETIQUETA[agendamento.etiqueta]}</Selo>
              </span>
              {agendamento.observacao ? (
                <span className="mt-0.5 block whitespace-pre-wrap break-words text-xs text-muted-foreground">{agendamento.observacao}</span>
              ) : null}
            </Celula>
            <Celula rotulo="Data pedida">
              <span className="font-mono text-foreground">
                {formatarData(agendamento.data)}
                {agendamento.hora ? ` às ${agendamento.hora}` : ""}
              </span>
              {agendamento.dataFatal ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  enviar · fatal <span className="font-mono">{formatarData(agendamento.dataFatal)}</span>
                  {agendamento.diasPrazo && agendamento.contagemPrazo ? ` · ${agendamento.diasPrazo} ${ROTULO_CONTAGEM[agendamento.contagemPrazo]}` : ""}
                </span>
              ) : null}
            </Celula>
            <Celula rotulo="Responsável">
              <span className="break-words text-foreground">{agendamento.responsavel}</span>
              {agendamento.revisor ? <span className="mt-0.5 block break-words text-xs text-muted-foreground">Revisor: {agendamento.revisor}</span> : null}
            </Celula>
            <Celula rotulo="CI">
              {agendamento.viosTarefaId ? <LinkVios ci={agendamento.viosTarefaId} /> : <span className="text-xs text-muted-foreground">—</span>}
            </Celula>
            {agendamento.viosTarefas?.length ? (
              <AgendadoNoVios tarefas={agendamento.viosTarefas} dataPedida={agendamento.data} horaPedida={agendamento.hora} />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ publicação */

function ItemCheck({ item, aba, onConcluido }: { item: ConferenciaItem; aba: Aba; onConcluido: (mensagem: string) => void }) {
  const [modo, setModo] = useState<"nenhum" | "ok" | "erro">("nenhum");
  const [nota, setNota] = useState("");
  const [tipo, setTipo] = useState("");
  const [subtipo, setSubtipo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const { publicacao } = item;
  const processo = publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal;
  const base = `check-${publicacao.id}`;
  const divergente = aba !== "checadas" && temDivergencia(item);

  async function enviar(acao: "ok" | "erro") {
    setOcupado(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/check/${publicacao.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(acao === "ok" ? { acao, nota } : { acao, tipo, subtipo, descricao }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao salvar.");
      setModo("nenhum");
      onConcluido(acao === "ok" ? "Check registrado." : "Inconsistência registrada; a publicação ficou em revisão.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setOcupado(false);
    }
  }

  function fechar() {
    setModo("nenhum");
    setErro("");
  }

  const spinner = <LoaderCircle className="animate-spin" />;
  const descricaoDialogo = (
    <>
      Processo <span className="font-mono">{processo}</span>
    </>
  );

  return (
    <Painel aria-labelledby={base}>
      <PainelTopo
        id={base}
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-all font-mono">{processo}</span>
            {publicacao.tribunal ? <Selo>{publicacao.tribunal}</Selo> : null}
            <SeloEsocial publicacao={publicacao} />
            {divergente ? (
              <Selo tom="alerta" icone={CalendarClock}>
                Data ou hora diverge no VIOS
              </Selo>
            ) : null}
          </span>
        }
        descricao={
          <>
            Vistada {item.vistadoPor ? `por ${item.vistadoPor} ` : ""}em {formatarDataHora(publicacao.vistadoEm)} · conferida{" "}
            {item.conferidoPor ? `por ${item.conferidoPor} ` : ""}em {formatarDataHora(publicacao.conferidoEm)}
          </>
        }
      >
        {aba === "checadas" ? (
          <Selo tom="sucesso" icone={CircleCheck}>
            Checada em {formatarDataHora(publicacao.checadoEm)}
          </Selo>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setModo("erro")}>
              <TriangleAlert />
              Encontrei erro
            </Button>
            <Button size="sm" onClick={() => setModo("ok")}>
              <CircleCheck />
              {aba === "revisar" ? "Corrigido: dar check" : "Check OK"}
            </Button>
          </>
        )}
      </PainelTopo>

      {erro && modo === "nenhum" ? (
        <Secao>
          <Aviso tom="erro">{erro}</Aviso>
        </Secao>
      ) : null}

      <Secao titulo="Pasta e publicação" id={`${base}-publicacao`}>
        <DadosPasta publicacao={{ ...publicacao, pendencia: null }} />
        <DadosPublicacao publicacao={publicacao} />
      </Secao>

      {aba === "checadas" && publicacao.checkNota ? (
        <Secao titulo="Observação do check" id={`${base}-nota`}>
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{publicacao.checkNota}</p>
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
            Pedido × agendado no VIOS
          </h3>
          <span className="text-xs text-muted-foreground">{plural(item.agendamentos.length, "tarefa", "tarefas")}</span>
        </div>
        <TabelaCheck agendamentos={item.agendamentos} />
      </section>

      <DialogoAcao
        aberto={modo === "ok"}
        onFechar={fechar}
        ocupado={ocupado}
        titulo={aba === "revisar" ? "Corrigido: dar check" : "Check OK"}
        descricao={<>{descricaoDialogo}. A esteira e o agendamento no VIOS estão corretos.</>}
        rodape={
          <>
            <Button variant="outline" onClick={fechar} disabled={ocupado}>
              Cancelar
            </Button>
            <Button onClick={() => enviar("ok")} disabled={ocupado}>
              {ocupado ? spinner : <CircleCheck />}
              Confirmar check
            </Button>
          </>
        }
      >
        <Campo rotulo="Observação do check (opcional)">
          <Textarea value={nota} onChange={(evento) => setNota(evento.target.value)} rows={3} maxLength={2000} />
        </Campo>
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      </DialogoAcao>

      <DialogoAcao
        aberto={modo === "erro"}
        onFechar={fechar}
        ocupado={ocupado}
        titulo="Encontrei erro"
        descricao={<>{descricaoDialogo}. O erro vira inconsistência de agendamento e a publicação fica em revisão.</>}
        rodape={
          <>
            <Button variant="outline" onClick={fechar} disabled={ocupado}>
              Cancelar
            </Button>
            <Button onClick={() => enviar("erro")} disabled={ocupado || !tipo || !subtipo || !descricao.trim()}>
              {ocupado ? spinner : <TriangleAlert />}
              Registrar e colocar em revisão
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Tipo">
            <select className={campoClasse} value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
              <option value="">Escolha…</option>
              {TIPOS_INCONSISTENCIA_AGENDAMENTO.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Subtipo">
            <select className={campoClasse} value={subtipo} onChange={(evento) => setSubtipo(evento.target.value)}>
              <option value="">Escolha…</option>
              {SUBTIPOS_INCONSISTENCIA_AGENDAMENTO.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="O que está errado">
          <Textarea value={descricao} onChange={(evento) => setDescricao(evento.target.value)} rows={4} maxLength={2000} />
        </Campo>
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      </DialogoAcao>
    </Painel>
  );
}

/* ------------------------------------------------------------ tela */

const VAZIO: Record<Aba, { titulo: string; texto: string }> = {
  aChecar: { titulo: "Nenhum agendamento aguardando check.", texto: "O que o robô gravar no VIOS aparece aqui para conferir." },
  revisar: { titulo: "Nada em revisão.", texto: "Publicações com erro apontado no check ficam aqui até o novo check." },
  checadas: { titulo: "Nenhuma publicação checada ainda.", texto: "As publicações com check registrado aparecem aqui." },
};

function Check() {
  const [aba, setAba] = useState<Aba>("aChecar");
  const [dados, setDados] = useState<CheckResposta | null>(null);
  const [erro, setErro] = useState("");
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      // traz antes o andamento do robô, para entrar aqui o que acabou de ser gravado no VIOS
      await authFetch("/api/operacoes-legais/vistagem/envios", { method: "POST" }).catch(() => null);
      const resposta = await authFetch("/api/operacoes-legais/vistagem/check");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar o check.");
      setDados(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o check.");
      setDados({ aChecar: [], revisar: [], checadas: [] });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function atualizar() {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }

  const numeros = useMemo(() => {
    const aChecar = dados?.aChecar ?? [];
    const revisar = dados?.revisar ?? [];
    return {
      tarefasAChecar: aChecar.reduce((soma, item) => soma + item.agendamentos.length, 0),
      divergentes: [...aChecar, ...revisar].filter(temDivergencia).length,
    };
  }, [dados]);

  const lista = dados?.[aba];
  const filtrada = (lista ?? []).filter((item) => combinaBusca(item, busca));
  const valor = (n: number | undefined) => (dados ? (n ?? 0) : "—");

  return (
    <div className="space-y-4">
      <BarraAba resumo="Confira no VIOS se a esteira e o agendamento estão corretos. Erro encontrado vira inconsistência e a publicação fica em revisão.">
        <Button variant="outline" onClick={atualizar} disabled={atualizando || !dados}>
          {atualizando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
          Atualizar
        </Button>
      </BarraAba>

      <Indicadores>
        <Indicador icone={ListChecks} rotulo="A checar" valor={valor(dados?.aChecar.length)}>
          {dados ? `${plural(numeros.tarefasAChecar, "tarefa agendada", "tarefas agendadas")} no VIOS` : null}
        </Indicador>
        <Indicador icone={TriangleAlert} rotulo="Em revisão" valor={valor(dados?.revisar.length)} tom={dados?.revisar.length ? "alerta" : "neutro"}>
          {dados ? "Com erro apontado no check" : null}
        </Indicador>
        <Indicador icone={CircleCheck} rotulo="Checadas" valor={valor(dados?.checadas.length)}>
          {dados ? "Com check registrado" : null}
        </Indicador>
        <Indicador icone={CalendarClock} rotulo="Data ou hora divergente" valor={valor(numeros.divergentes)} tom={numeros.divergentes ? "alerta" : "neutro"}>
          {dados ? "Pedido diferente do agendado no VIOS" : null}
        </Indicador>
      </Indicadores>

      <BarraAba
        resumo={
          <Segmented
            label="Situação do check"
            value={aba}
            options={ABAS.map((item) => ({ value: item.valor, label: dados ? `${item.rotulo} ${dados[item.valor].length}` : item.rotulo }))}
            onChange={setAba}
          />
        }
      >
        <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar processo, pasta, cliente ou CI" aria-label="Buscar publicação" />
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
            <Button size="xs" variant="outline" onClick={() => void atualizar()} disabled={atualizando}>
              Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : null}

      {lista === undefined ? (
        <Painel>
          <Carregando rotulo="Carregando o check" />
        </Painel>
      ) : lista.length === 0 ? (
        <Painel>
          <Vazio icone={aba === "checadas" ? CircleCheck : ListChecks} titulo={VAZIO[aba].titulo}>
            {VAZIO[aba].texto}
          </Vazio>
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
        <ul className="space-y-4" aria-label={ABAS.find((item) => item.valor === aba)?.rotulo}>
          {filtrada.map((item) => (
            <li key={item.publicacao.id}>
              <ItemCheck
                item={item}
                aba={aba}
                onConcluido={(mensagem) => {
                  setRetorno({ tom: "sucesso", texto: mensagem });
                  void carregar();
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CheckClient() {
  return (
    <AcessoOperacoesLegais>
      <Check />
    </AcessoOperacoesLegais>
  );
}
