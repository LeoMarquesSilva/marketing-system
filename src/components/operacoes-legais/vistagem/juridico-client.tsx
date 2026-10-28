"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileText,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { ETIQUETAS_AGENDAMENTO, ROTULO_ETIQUETA, atalhosDePrazo, avisosDaData, chaveNome, horaValida, type EtiquetaAgendamento } from "@/lib/vistagem/agendamento";
import {
  CONTAGENS_PRAZO,
  ROTULO_CONTAGEM,
  criarCalendario,
  criarCalendarioDePrazo,
  datasDoPrazo,
  fatalPorContagem,
  noRecessoForense,
  somarDiasUteis,
  type ContagemPrazo,
} from "@/lib/vistagem/dias-uteis";
import {
  CLASSIFICACOES_ESOCIAL,
  ESOCIAL_PADRAO,
  TAREFA_ESOCIAL,
  classificacaoEsocial,
  pedeTarefaEsocial,
  type ClassificacaoEsocial,
} from "@/lib/vistagem/esocial";
import { CADEIA_PADRAO, PESSOA_FIXA_PROTOCOLAR, cadeiaDoFluxo, type FluxoDaTarefa, type TarefaDoFluxo } from "@/lib/vistagem/fluxo-vios";
import { fatalSugerida, type SugestaoIa } from "@/lib/vistagem/sugestao-ia";
import { ESCRITORIOS } from "@/lib/vistagem/triagem";
import type { PublicacaoResumo, VistagemDetalhe } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { ComboboxBusca } from "./combobox-busca";
import { CartaoInconsistencia } from "./inconsistencias-ui";
import { DadosPasta, DadosPublicacao, formatarData, formatarDataHora } from "./publicacao-ui";
import { CartaoSugestaoIa, SeloIa, type EstadoSugestao } from "./sugestao-ia-ui";
import { Aviso, BarraAba, Busca, Campo, Carregando, Painel, Selo, Vazio, campoClasse, linhaLista } from "./ui";

type Etiqueta = EtiquetaAgendamento;

interface Linha {
  chave: number;
  etiqueta: Etiqueta;
  tarefa: string;
  /** Providência/Compromisso: data da tarefa no VIOS. */
  data: string;
  /** Prazo: data fatal (o VIOS recebe o Enviar, calculado pelo fluxo da tarefa). */
  dataFatal: string;
  diasPrazo: number | null;
  /** Prazo pelo atalho de dias: úteis ou corridos (escolhido no modal). */
  contagemPrazo: ContagemPrazo | null;
  /** Compromisso: horário HH:MM (Hora tarefa no VIOS). */
  hora: string;
  responsavel: string;
  revisor: string;
  observacao: string;
  /** Inserir E-social pedida pela classificação eSocial: tarefa fixa, sai quando a classificação muda. */
  esocial: boolean;
  /** Veio da sugestão da IA. */
  ia: boolean;
}

let proximaChave = 1;
function novaLinha(base: Partial<Linha> = {}): Linha {
  return {
    chave: proximaChave++,
    etiqueta: "PRAZO",
    tarefa: "",
    data: "",
    dataFatal: "",
    diasPrazo: null,
    contagemPrazo: "uteis",
    hora: "",
    responsavel: "",
    revisor: "",
    observacao: "",
    esocial: false,
    ia: false,
    ...base,
  };
}

const campo = campoClasse;

function linhaCompleta(linha: Linha): boolean {
  if (!linha.tarefa || !linha.responsavel || !linha.observacao.trim()) return false;
  if (linha.etiqueta === "PRAZO") return Boolean(linha.dataFatal && linha.revisor);
  return Boolean(linha.data) && (linha.etiqueta !== "COMPROMISSO" || horaValida(linha.hora));
}

/** Pergunta data e horário ao escolher um Compromisso (audiência, perícia, sessão…). Montar com key da linha. */
function ModalHorario({
  linha,
  hoje,
  onConfirmar,
  onFechar,
}: {
  linha: Linha | null;
  hoje: string;
  onConfirmar: (data: string, hora: string) => void;
  onFechar: () => void;
}) {
  const [data, setData] = useState(linha?.data ?? "");
  const [hora, setHora] = useState(linha?.hora ?? "");
  const avisos = data ? avisosDaData(data, hoje) : [];
  const pronto = Boolean(data) && horaValida(hora);

  return (
    <Dialog open={Boolean(linha)} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (pronto) onConfirmar(data, hora);
          }}
        >
          <DialogHeader>
            <DialogTitle>Data e horário do compromisso</DialogTitle>
            <DialogDescription>{linha?.tarefa || "Compromisso"}: o horário vai para a Hora tarefa no VIOS.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Data
              <input type="date" className={campo} value={data} onChange={(evento) => setData(evento.target.value)} required />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Horário
              <input type="time" className={campo} value={hora} onChange={(evento) => setHora(evento.target.value)} required autoFocus />
            </label>
          </div>
          {avisos.length ? (
            <p className="flex items-center gap-1 text-xs text-amber-800">
              <TriangleAlert className="size-3.5" />
              {avisos.join(" ")}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Depois
            </Button>
            <Button type="submit" disabled={!pronto}>
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** O que o fluxo automático do VIOS cria junto com a tarefa e quem o robô coloca em cada uma. */
function FluxoNoVios({
  fluxo,
  responsavel,
  revisor,
  datas,
}: {
  fluxo: FluxoDaTarefa;
  responsavel: string;
  revisor: string;
  datas: { revisar: string | null; protocolar: string | null } | null;
}) {
  const quem = (tarefa: TarefaDoFluxo) => {
    if (tarefa.papel === "revisor") return revisor || "padrão do VIOS (sem revisor)";
    const pessoa = responsavel || "responsável";
    return tarefa.papel === "protocolar" ? `${pessoa} + ${PESSOA_FIXA_PROTOCOLAR}` : pessoa;
  };
  const dataDe = (tarefa: TarefaDoFluxo) =>
    tarefa.papel === "revisor" ? datas?.revisar ?? null : tarefa.papel === "protocolar" ? datas?.protocolar ?? null : null;
  // Recolhido: uma linha diz o que o VIOS cria; o detalhe abre quando a pessoa quer conferir.
  const resumo = [
    fluxo.criacao.length ? `cria junto ${fluxo.criacao.map((tarefa) => tarefa.nome).join(", ")}` : null,
    fluxo.conclusao.length ? `ao concluir, ${fluxo.conclusao.map((tarefa) => tarefa.nome).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <details className="group rounded-md border border-[#e6eef0] bg-[#f7fbfc] text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-muted-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
        <span className="font-medium text-[#285f7a]">Fluxo do VIOS</span>
        <span className="truncate">{resumo}</span>
      </summary>
      <div className="space-y-2 border-t border-[#e6eef0] px-3 py-2">
      {fluxo.criacao.length ? (
        <div className="space-y-1">
          <p className="font-medium text-foreground">O VIOS cria junto (o robô coloca os responsáveis):</p>
          <ul className="space-y-1.5">
            {fluxo.criacao.map((tarefa) => {
              const data = dataDe(tarefa);
              return (
                <li key={tarefa.id} className="text-foreground">
                  <span className="font-medium text-foreground">{tarefa.nome}</span>
                  {tarefa.prazo ? <span className="text-muted-foreground"> · {tarefa.prazo}</span> : null}
                  {data ? <span className="font-mono"> · {formatarData(data)}</span> : null}
                  <span> → {quem(tarefa)}</span>
                  {tarefa.tambemCria.length ? (
                    <span className="block pl-3 text-muted-foreground">cria também: {tarefa.tambemCria.join(", ")}</span>
                  ) : null}
                  {tarefa.aoConcluir.length ? (
                    <span className="block pl-3 text-muted-foreground">ao concluir, cria: {tarefa.aoConcluir.join(", ")}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {fluxo.conclusao.length ? (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Ao concluir esta tarefa, o VIOS cria:</span>{" "}
          {fluxo.conclusao.map((tarefa) => tarefa.nome).join(", ")} (com o responsável padrão do VIOS).
        </p>
      ) : null}
      </div>
    </details>
  );
}

/** Posição na fila, para andar entre as publicações sem a lista. */
interface Navegacao {
  posicao: number;
  total: number;
  anterior: string | null;
  proxima: string | null;
}

function EditorVistagem({
  id,
  navegacao,
  onAbrir,
  onConcluida,
  onTransferida,
  onVoltar,
}: {
  id: string;
  navegacao: Navegacao | null;
  onAbrir: (id: string) => void;
  onConcluida: (id: string) => void;
  onTransferida: (destino: string) => void;
  onVoltar: () => void;
}) {
  const [detalhe, setDetalhe] = useState<VistagemDetalhe | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  /** Trabalhista: classificação eSocial (não vai para o VIOS). */
  const [esocial, setEsocial] = useState<ClassificacaoEsocial>(ESOCIAL_PADRAO);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  /** Linha do Compromisso com o modal de data e horário aberto. */
  const [horarioDe, setHorarioDe] = useState<number | null>(null);
  /** Atalho de dias clicado, à espera da escolha entre úteis e corridos. */
  const [transferindo, setTransferindo] = useState(false);
  /** Sugestão da IA (Trabalhista) e o que o jurídico fez com ela. */
  const [sugestao, setSugestao] = useState<SugestaoIa | null>(null);
  const [estadoSugestao, setEstadoSugestao] = useState<EstadoSugestao | null>(null);
  const [erroSugestao, setErroSugestao] = useState("");
  /** Tarefas e eSocial de antes de usar a sugestão, para desfazer. */
  const [antesDaSugestao, setAntesDaSugestao] = useState<{ linhas: Linha[]; esocial: ClassificacaoEsocial } | null>(null);

  useEffect(() => {
    let cancelado = false;
    setDetalhe(null);
    setErro("");
    setSugestao(null);
    setEstadoSugestao(null);
    setErroSugestao("");
    setAntesDaSugestao(null);
    authFetch(`/api/operacoes-legais/vistagem/juridico/${id}`)
      .then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar a publicação.");
        if (cancelado) return;
        const dados = corpo as VistagemDetalhe;
        setDetalhe(dados);
        const classificacao = classificacaoEsocial(dados.publicacao.publicacaoEsocial) ?? ESOCIAL_PADRAO;
        const tarefaEsocialId = dados.esocial?.tarefa && pedeTarefaEsocial(classificacao) ? dados.esocial.tarefa.id : null;
        setEsocial(classificacao);
        setLinhas(
          dados.agendamentos.length
            ? dados.agendamentos.map((item) =>
                novaLinha({
                  etiqueta: item.etiqueta,
                  // a lista mostra o tipo junto quando o VIOS tem dois com o mesmo nome
                  tarefa: dados.catalogo?.tarefas[item.etiqueta].find((opcao) => opcao.id === item.tarefaId)?.nome ?? item.tarefa,
                  data: item.etiqueta === "PRAZO" ? "" : item.data,
                  dataFatal: item.dataFatal ?? "",
                  diasPrazo: item.diasPrazo,
                  contagemPrazo: item.contagemPrazo ?? "uteis",
                  hora: item.hora ?? "",
                  responsavel: item.responsavel,
                  revisor: item.revisor ?? "",
                  observacao: item.observacao ?? "",
                  esocial: tarefaEsocialId !== null && item.tarefaId === tarefaEsocialId,
                })
              )
            : [novaLinha({ responsavel: dados.responsavelSugerido ?? "", revisor: dados.revisorSugerido ?? "" })]
        );
        if (dados.sugestaoIa) {
          setSugestao(dados.sugestaoIa);
          setEstadoSugestao("pronta");
        } else if (dados.sugestaoIaDisponivel) {
          // Ainda sem sugestão (o cron não chegou nela): gera agora, sem travar a tela.
          setEstadoSugestao("carregando");
          authFetch(`/api/operacoes-legais/vistagem/juridico/${id}/sugestao`, { method: "POST" })
            .then(async (resposta) => {
              const corpo = await resposta.json();
              if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao gerar a sugestão.");
              if (cancelado) return;
              setSugestao(corpo as SugestaoIa);
              setEstadoSugestao("pronta");
            })
            .catch((e) => {
              if (cancelado) return;
              setErroSugestao(e instanceof Error ? e.message : "Falha ao gerar a sugestão.");
              setEstadoSugestao("erro");
            });
        }
      })
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : "Falha ao carregar a publicação."));
    return () => {
      cancelado = true;
    };
  }, [id, recarga]);

  const ehDiaUtil = useMemo(() => criarCalendario(detalhe?.feriados ?? []), [detalhe?.feriados]);
  // A fatal conta só dias úteis fora do recesso forense; Enviar/Revisar/Protocolar seguem o expediente.
  const contaPrazo = useMemo(() => criarCalendarioDePrazo(detalhe?.feriados ?? []), [detalhe?.feriados]);

  function alterar(chave: number, mudanca: Partial<Linha>) {
    setLinhas((atuais) => atuais.map((linha) => (linha.chave === chave ? { ...linha, ...mudanca } : linha)));
  }

  function trocarEtiqueta(linha: Linha, etiqueta: Etiqueta) {
    // No Prazo o revisor é obrigatório: sugere o auxiliar da pasta se ainda estiver vazio.
    alterar(linha.chave, {
      etiqueta,
      tarefa: "",
      revisor: etiqueta === "PRAZO" && !linha.revisor ? detalhe?.revisorSugerido ?? "" : linha.revisor,
    });
  }

  /** Acordo homologado e Homologação de cálculo põem a tarefa Inserir E-social no fim da lista; as outras a tiram. */
  function linhasComEsocial(atuais: Linha[], valor: ClassificacaoEsocial): Linha[] {
    const tarefa = detalhe?.esocial?.tarefa;
    if (!pedeTarefaEsocial(valor) || !tarefa) return atuais.filter((linha) => !linha.esocial);
    const existente = atuais.find((linha) => linha.esocial || (linha.etiqueta === "PROVIDENCIA" && linha.tarefa === tarefa.nome));
    if (existente) return atuais.map((linha) => (linha === existente ? { ...linha, esocial: true } : linha));
    return [
      ...atuais,
      novaLinha({
        etiqueta: "PROVIDENCIA",
        tarefa: tarefa.nome,
        responsavel: detalhe?.esocial?.responsavelSugerido ?? "",
        // No VIOS, a Inserir E-social vai para o dia útil seguinte à vistagem.
        data: detalhe ? somarDiasUteis(detalhe.hoje, 1, ehDiaUtil) : "",
        observacao: `Inserir no eSocial: ${valor}.`,
        esocial: true,
      }),
    ];
  }

  function trocarEsocial(valor: ClassificacaoEsocial) {
    setEsocial(valor);
    setLinhas((atuais) => linhasComEsocial(atuais, valor));
  }

  /** Troca as tarefas pelas da sugestão (responsável e revisor seguem o padrão da pasta) e aplica o eSocial sugerido. */
  function usarSugestao() {
    if (!detalhe?.catalogo || !sugestao) return;
    const { catalogo, publicacao } = detalhe;
    const sugeridas = sugestao.tarefas.flatMap((tarefa) => {
      const opcao = catalogo.tarefas[tarefa.classe].find((item) => item.id === tarefa.tarefaId);
      if (!opcao) return [];
      const prazo = tarefa.classe === "PRAZO";
      return [
        novaLinha({
          etiqueta: tarefa.classe,
          tarefa: opcao.nome,
          dataFatal: prazo ? fatalSugerida(tarefa, publicacao.dataPublicacao, contaPrazo) ?? "" : "",
          diasPrazo: prazo ? tarefa.dias : null,
          contagemPrazo: prazo && tarefa.dias ? tarefa.contagem : null,
          data: tarefa.classe === "COMPROMISSO" ? tarefa.data ?? "" : "",
          hora: tarefa.hora ?? "",
          responsavel: detalhe.responsavelSugerido ?? "",
          revisor: prazo ? detalhe.revisorSugerido ?? "" : "",
          observacao: tarefa.motivo,
          ia: true,
        }),
      ];
    });
    if (!sugeridas.length) return;
    const classificacao = detalhe.esocial ? sugestao.esocial : esocial;
    setAntesDaSugestao({ linhas, esocial });
    setEsocial(classificacao);
    setLinhas(detalhe.esocial ? linhasComEsocial(sugeridas, classificacao) : sugeridas);
    setEstadoSugestao("usada");
  }

  function desfazerSugestao() {
    if (antesDaSugestao) {
      setLinhas(antesDaSugestao.linhas);
      setEsocial(antesDaSugestao.esocial);
    }
    setAntesDaSugestao(null);
    setEstadoSugestao("pronta");
  }

  async function enviar() {
    setEnviando(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/juridico/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observacao: null,
          publicacaoEsocial: detalhe?.esocial ? esocial : null,
          sugestaoUsada: estadoSugestao === "usada",
          agendamentos: linhas.map((linha) => ({
            etiqueta: linha.etiqueta,
            tarefa: linha.tarefa,
            tarefaId: detalhe?.catalogo?.tarefas[linha.etiqueta].find((opcao) => opcao.nome === linha.tarefa)?.id ?? null,
            data: linha.etiqueta === "PRAZO" ? "" : linha.data,
            dataFatal: linha.etiqueta === "PRAZO" ? linha.dataFatal : null,
            diasPrazo: linha.etiqueta === "PRAZO" ? linha.diasPrazo : null,
            contagemPrazo: linha.etiqueta === "PRAZO" && linha.diasPrazo ? linha.contagemPrazo : null,
            hora: linha.etiqueta === "COMPROMISSO" ? linha.hora : null,
            responsavel: linha.responsavel,
            revisor: linha.revisor || null,
            observacao: linha.observacao || null,
          })),
        }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao enviar.");
      onConcluida(id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  if (!detalhe) {
    return erro ? (
      <Aviso tom="erro">{erro}</Aviso>
    ) : (
      <Painel><Carregando rotulo="Carregando a publicação" /></Painel>
    );
  }

  const { publicacao, catalogo } = detalhe;
  // Sem o tipo Inserir E-social no VIOS, Acordo homologado e Homologação de cálculo não podem ser enviados.
  const faltaTarefaEsocial = Boolean(detalhe.esocial && pedeTarefaEsocial(esocial) && !detalhe.esocial.tarefa);
  const completo = linhas.every(linhaCompleta) && !faltaTarefaEsocial;
  const incompletas = linhas.flatMap((linha, indice) => (linhaCompleta(linha) ? [] : [`a Tarefa ${indice + 1}`]));
  const devolucoes = detalhe.inconsistencias.filter((item) => item.origem === "juridico");

  return (
    // Com espaço (fila recolhida ou tela larga), publicação e vistagem ficam lado a lado e rolam cada uma no seu lugar.
    <div className="@container h-full">
      <div className="grid gap-4 @4xl:h-full @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-3 @4xl:h-full">
          <Button variant="ghost" size="sm" className="self-start lg:hidden" onClick={onVoltar}>
            <ArrowLeft />
            Voltar à lista
          </Button>

          {devolucoes.length ? (
            <div className="space-y-2">
              <Aviso tom="alerta" titulo={`Devolvida pela controladoria em ${formatarDataHora(publicacao.devolvidoEm)}`} />
              {devolucoes.map((item) => (
                <CartaoInconsistencia key={item.id} inconsistencia={item} acao="contestar" onAlterada={() => setRecarga((valor) => valor + 1)} />
              ))}
            </div>
          ) : publicacao.devolucaoMotivo ? (
            <Aviso tom="alerta" titulo={`Devolvida pela controladoria em ${formatarDataHora(publicacao.devolvidoEm)}`}>
              {publicacao.devolucaoMotivo}
            </Aviso>
          ) : null}

          {publicacao.transferidoDe ? (
            <Aviso tom="info" titulo={`Transferida de ${publicacao.transferidoDe} em ${formatarDataHora(publicacao.transferidoEm)}`}>
              {publicacao.transferenciaMotivo}
            </Aviso>
          ) : null}

          <Painel aria-labelledby="publicacao-titulo" className="flex min-h-0 flex-col @4xl:flex-1">
            <div className="space-y-2 border-b border-[#e6eef0] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="publicacao-titulo" className="font-mono text-base font-semibold text-foreground">
                  {publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}
                </h2>
                {publicacao.tribunal ? <Selo tom="marca">{publicacao.tribunal}</Selo> : null}
                <div className="ml-auto flex items-center gap-1">
                  {navegacao ? (
                    <>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={!navegacao.anterior}
                        onClick={() => navegacao.anterior && onAbrir(navegacao.anterior)}
                        aria-label="Publicação anterior"
                        title="Publicação anterior"
                      >
                        <ChevronLeft />
                      </Button>
                      <span className="min-w-14 text-center text-xs tabular-nums text-muted-foreground">
                        {navegacao.posicao} de {navegacao.total}
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={!navegacao.proxima}
                        onClick={() => navegacao.proxima && onAbrir(navegacao.proxima)}
                        aria-label="Próxima publicação"
                        title="Próxima publicação"
                      >
                        <ChevronRight />
                      </Button>
                    </>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" className="ml-1" onClick={() => setTransferindo(true)}>
                    <ArrowRightLeft />
                    Transferir área
                  </Button>
                </div>
              </div>
              <DadosPasta publicacao={{ ...publicacao, pendencia: null }} />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
              <DadosPublicacao publicacao={publicacao} />
              <pre className="max-h-[28rem] min-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#e6eef0] bg-[#f7fbfc] p-3 font-sans text-sm leading-relaxed text-foreground @4xl:max-h-none @4xl:flex-1">
                {publicacao.teor}
              </pre>
            </div>
          </Painel>
        </div>

        <div className="min-h-0 space-y-3 @4xl:h-full @4xl:overflow-y-auto @4xl:pr-1">
          {estadoSugestao && catalogo ? (
            <CartaoSugestaoIa
              estado={estadoSugestao}
              sugestao={sugestao}
              erro={erroSugestao}
              nomeDaTarefa={(tarefa) => catalogo.tarefas[tarefa.classe].find((item) => item.id === tarefa.tarefaId)?.nome ?? tarefa.tarefa}
              dataPublicacao={publicacao.dataPublicacao}
              contaPrazo={contaPrazo}
              comEsocial={Boolean(detalhe.esocial)}
              onUsar={usarSugestao}
              onIgnorar={() => setEstadoSugestao("ignorada")}
              onDesfazer={desfazerSugestao}
              onMostrar={() => setEstadoSugestao("pronta")}
            />
          ) : null}

          {/* sem overflow-hidden: o rodapé com o botão de enviar fica preso no fim da coluna */}
          <Painel aria-labelledby="tarefas-titulo" className="overflow-visible">
            {detalhe.fluxosErro ? (
              <div className="px-4 pt-4">
                <Aviso tom="alerta">
                  O fluxo de tarefas do VIOS não carregou ({detalhe.fluxosErro}). As datas do Prazo usam o fluxo padrão e o envio pode ser recusado.
                </Aviso>
              </div>
            ) : null}

            {!catalogo ? (
              <div className="p-4">
                <Aviso tom="erro">{detalhe.catalogoErro ?? "Não há lista de tarefas do VIOS para a área desta pasta."} Avise a controladoria.</Aviso>
              </div>
            ) : (
              <>
                <div className="space-y-2 rounded-t-lg border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <h2 id="tarefas-titulo" className="text-sm font-semibold text-foreground">
                        Tarefas no VIOS
                      </h2>
                      <p className="text-xs text-muted-foreground">Lista do VIOS para {catalogo.area}</p>
                    </div>
                    {detalhe.esocial ? (
                      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span title="Não vai para o VIOS">eSocial</span>
                        <select
                          className={cn(campo, "h-9 w-52")}
                          value={esocial}
                          onChange={(evento) => trocarEsocial(evento.target.value as ClassificacaoEsocial)}
                          aria-describedby="esocial-dica"
                        >
                          {CLASSIFICACOES_ESOCIAL.map((classificacao) => (
                            <option key={classificacao} value={classificacao}>
                              {classificacao}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLinhas((atuais) => [
                          ...atuais,
                          novaLinha({ responsavel: detalhe.responsavelSugerido ?? "", revisor: detalhe.revisorSugerido ?? "" }),
                        ])
                      }
                      disabled={linhas.length >= 10}
                    >
                      <Plus />
                      Adicionar tarefa
                    </Button>
                  </div>
                  {detalhe.esocial ? (
                    faltaTarefaEsocial ? (
                      <Aviso tom="erro">
                        {esocial} pede a tarefa {TAREFA_ESOCIAL}, mas esse tipo de tarefa não está na lista do VIOS para Trabalhista. Avise a controladoria.
                      </Aviso>
                    ) : (
                      <p id="esocial-dica" className="text-xs text-muted-foreground">
                        {pedeTarefaEsocial(esocial)
                          ? `eSocial (não vai para o VIOS): ${esocial} pede também a tarefa ${TAREFA_ESOCIAL}, já na lista abaixo.`
                          : "A classificação eSocial fica só na publicação; não vai para o VIOS."}
                      </p>
                    )
                  ) : null}
                </div>

                <ol className="divide-y divide-[#e6eef0]">
                  {linhas.map((linha, indice) => {
                    const prazo = linha.etiqueta === "PRAZO";
                    const tarefaId = catalogo.tarefas[linha.etiqueta].find((opcao) => opcao.nome === linha.tarefa)?.id ?? null;
                    const fluxo = tarefaId ? detalhe.fluxos[tarefaId] ?? null : null;
                    // Sem tarefa escolhida (ou sem o fluxo carregado) mostra o fluxo padrão; o servidor recalcula ao gravar.
                    const cadeiaFluxo = !tarefaId || detalhe.fluxosErro ? CADEIA_PADRAO : cadeiaDoFluxo(fluxo);
                    const cadeia = prazo && linha.dataFatal ? datasDoPrazo(linha.dataFatal, ehDiaUtil, cadeiaFluxo) : null;
                    const datasDoFluxo = prazo
                      ? cadeia
                      : linha.data && cadeiaFluxo
                        ? {
                            revisar: cadeiaFluxo.revisar === null ? null : somarDiasUteis(linha.data, cadeiaFluxo.revisar, ehDiaUtil),
                            protocolar: somarDiasUteis(linha.data, cadeiaFluxo.protocolar, ehDiaUtil),
                          }
                        : null;
                    const avisos = prazo
                      ? linha.dataFatal
                        ? avisosDaData(linha.dataFatal, detalhe.hoje).concat(
                            contaPrazo(linha.dataFatal)
                              ? []
                              : [noRecessoForense(linha.dataFatal) ? "A data fatal cai no recesso forense (20/12 a 20/01)." : "A data fatal não é dia útil."]
                          )
                        : []
                      : linha.data
                        ? avisosDaData(linha.data, detalhe.hoje)
                        : [];
                    return (
                      <li key={linha.chave} aria-label={`Tarefa ${indice + 1}`} className="space-y-3 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">Tarefa {indice + 1}</span>
                          {linha.esocial ? <Selo tom="marca">eSocial</Selo> : null}
                          {linha.ia ? <SeloIa /> : null}
                          <div className="ml-auto flex flex-wrap items-center gap-2">
                            {linha.esocial ? (
                              <span className="text-xs text-muted-foreground">Pedida pela classificação eSocial</span>
                            ) : (
                              <Segmented
                                label={`Classe da tarefa ${indice + 1}`}
                                value={linha.etiqueta}
                                options={ETIQUETAS_AGENDAMENTO.map((valor) => ({ value: valor, label: ROTULO_ETIQUETA[valor] }))}
                                onChange={(valor) => trocarEtiqueta(linha, valor)}
                              />
                            )}
                            {!linha.esocial && linhas.length > 1 ? (
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                                onClick={() => setLinhas((atuais) => atuais.filter((item) => item.chave !== linha.chave))}
                                aria-label={`Remover tarefa ${indice + 1}`}
                                title="Remover tarefa"
                              >
                                <Trash2 />
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {linha.esocial ? (
                          <p className={cn(campo, "flex items-center bg-[#f7fbfc] text-foreground")} aria-label={`Tarefa ${indice + 1}`}>
                            {linha.tarefa}
                          </p>
                        ) : (
                          <ComboboxBusca
                            opcoes={catalogo.tarefas[linha.etiqueta]}
                            valor={linha.tarefa}
                            onChange={(nome) => {
                              alterar(linha.chave, { tarefa: nome });
                              if (nome && linha.etiqueta === "COMPROMISSO") setHorarioDe(linha.chave);
                            }}
                            placeholder="Tarefa: digite para buscar…"
                            rotulo={`Tarefa ${indice + 1}`}
                          />
                        )}

                        {prazo ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                              <Campo rotulo="Data fatal" className="w-40">
                                <input
                                  type="date"
                                  className={campo}
                                  value={linha.dataFatal}
                                  onChange={(evento) => alterar(linha.chave, { dataFatal: evento.target.value, diasPrazo: null })}
                                />
                              </Campo>
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <span className="block text-xs font-medium text-muted-foreground">
                                  Ou dias após {publicacao.dataPublicacao ? formatarData(publicacao.dataPublicacao) : "a publicação"}
                                  {linha.diasPrazo ? (
                                    <span className="font-semibold text-[#183f50]">
                                      {" "}
                                      · {linha.diasPrazo} {ROTULO_CONTAGEM[linha.contagemPrazo ?? "uteis"]}
                                    </span>
                                  ) : null}
                                </span>
                                <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Prazo em dias">
                                  {/* Úteis ou corridos ao lado dos dias: troca a contagem e recalcula a fatal do atalho escolhido. */}
                                  <Segmented
                                    label={`Contagem do prazo da tarefa ${indice + 1}`}
                                    value={linha.contagemPrazo ?? "uteis"}
                                    options={CONTAGENS_PRAZO.map((contagem) => ({ value: contagem, label: contagem === "uteis" ? "Úteis" : "Corridos" }))}
                                    onChange={(contagem) =>
                                      alterar(linha.chave, {
                                        contagemPrazo: contagem,
                                        ...(linha.diasPrazo && publicacao.dataPublicacao
                                          ? { dataFatal: fatalPorContagem(publicacao.dataPublicacao, linha.diasPrazo, contagem, contaPrazo) }
                                          : {}),
                                      })
                                    }
                                  />
                                  {atalhosDePrazo(catalogo.area).map((dias) => (
                                    <Button
                                      key={dias}
                                      type="button"
                                      size="xs"
                                      variant="outline"
                                      aria-pressed={linha.diasPrazo === dias}
                                      disabled={!publicacao.dataPublicacao}
                                      className={cn(
                                        "h-10 min-w-9 tabular-nums",
                                        linha.diasPrazo === dias && "border-[#285f7a] bg-[#347796] text-white hover:bg-[#285f7a] hover:text-white"
                                      )}
                                      onClick={() =>
                                        publicacao.dataPublicacao &&
                                        alterar(linha.chave, {
                                          diasPrazo: dias,
                                          dataFatal: fatalPorContagem(publicacao.dataPublicacao, dias, linha.contagemPrazo ?? "uteis", contaPrazo),
                                        })
                                      }
                                    >
                                      {dias}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            {cadeia ? (
                              <dl className="grid grid-cols-2 overflow-hidden rounded-md border border-[#e6eef0] text-xs sm:grid-cols-4">
                                <div className="bg-[#e8f8f8] px-3 py-1.5">
                                  <dt className="font-medium text-[#285f7a]">{cadeia.protocolar ? "Enviar" : "Tarefa"} · no VIOS</dt>
                                  <dd className="font-mono text-sm font-semibold text-[#183f50]">{formatarData(cadeia.enviar)}</dd>
                                </div>
                                {cadeia.revisar ? (
                                  <div className="border-l border-[#e6eef0] px-3 py-1.5">
                                    <dt className="text-muted-foreground">Revisar</dt>
                                    <dd className="font-mono text-sm text-foreground">{formatarData(cadeia.revisar)}</dd>
                                  </div>
                                ) : null}
                                {cadeia.protocolar ? (
                                  <div className="border-t border-[#e6eef0] px-3 py-1.5 sm:border-l sm:border-t-0">
                                    <dt className="text-muted-foreground">Protocolar</dt>
                                    <dd className="font-mono text-sm text-foreground">{formatarData(cadeia.protocolar)}</dd>
                                  </div>
                                ) : null}
                                <div className="border-l border-t border-[#e6eef0] px-3 py-1.5 sm:border-t-0">
                                  <dt className="text-muted-foreground">Fatal</dt>
                                  <dd className="font-mono text-sm font-semibold text-red-700">{formatarData(cadeia.fatal)}</dd>
                                </div>
                              </dl>
                            ) : null}
                            {tarefaId && !cadeiaFluxo ? (
                              <p className="text-xs text-muted-foreground">
                                O VIOS não cria Revisar nem Protocolar para esta tarefa: ela vai com a data do protocolo (1 dia útil antes da fatal).
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-end gap-3">
                            <Campo rotulo="Data no VIOS" className="w-44">
                              <input type="date" className={campo} value={linha.data} onChange={(evento) => alterar(linha.chave, { data: evento.target.value })} />
                            </Campo>
                            {linha.etiqueta === "COMPROMISSO" ? (
                              <Campo rotulo="Horário" className="w-32">
                                <input
                                  type="time"
                                  className={campo}
                                  value={linha.hora}
                                  onChange={(evento) => alterar(linha.chave, { hora: evento.target.value })}
                                  aria-invalid={!horaValida(linha.hora)}
                                />
                              </Campo>
                            ) : null}
                          </div>
                        )}
                        {avisos.length ? (
                          <p className="flex items-center gap-1.5 text-xs text-amber-800">
                            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                            {avisos.join(" ")}
                          </p>
                        ) : null}

                        <div className="grid gap-3 @md:grid-cols-2">
                          <div className="space-y-1.5">
                            <span className="block text-xs font-medium text-muted-foreground">Responsável</span>
                            <ComboboxBusca
                              opcoes={catalogo.usuarios}
                              valor={linha.responsavel}
                              onChange={(nome) => alterar(linha.chave, { responsavel: nome })}
                              placeholder="Digite para buscar…"
                              rotulo={`Responsável da tarefa ${indice + 1}`}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <span className="block text-xs font-medium text-muted-foreground">
                              {prazo ? "Revisor (obrigatório)" : "Revisor (opcional)"}
                              {prazo && detalhe.revisorSugerido && linha.revisor === detalhe.revisorSugerido ? (
                                <span className="font-normal"> · auxiliar da pasta</span>
                              ) : null}
                            </span>
                            <ComboboxBusca
                              opcoes={catalogo.usuarios}
                              valor={linha.revisor}
                              onChange={(nome) => alterar(linha.chave, { revisor: nome })}
                              placeholder={prazo ? "Digite para buscar o revisor…" : "Sem revisor"}
                              rotulo={`Revisor da tarefa ${indice + 1}`}
                              permitirVazio
                              invalido={prazo && !linha.revisor}
                            />
                          </div>
                        </div>

                        <Campo rotulo="Observação (vai na descrição da tarefa no VIOS)">
                          <Textarea
                            value={linha.observacao}
                            onChange={(evento) => alterar(linha.chave, { observacao: evento.target.value })}
                            maxLength={2000}
                            rows={2}
                            placeholder="O que fazer e por quê"
                            aria-invalid={!linha.observacao.trim()}
                          />
                        </Campo>

                        {fluxo ? (
                          <FluxoNoVios fluxo={fluxo} responsavel={linha.responsavel} revisor={linha.revisor} datas={datasDoFluxo} />
                        ) : null}
                      </li>
                    );
                  })}
                </ol>

                {erro ? (
                  <div className="px-4 pb-3">
                    <Aviso tom="erro">{erro}</Aviso>
                  </div>
                ) : null}

                <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-b-lg border-t border-[#e6eef0] bg-white px-4 py-3 shadow-[0_-8px_16px_-12px_rgba(16,41,58,0.18)]">
                  <p className="min-w-0 flex-1 text-xs text-muted-foreground" aria-live="polite">
                    {completo
                      ? `${linhas.length} ${linhas.length === 1 ? "tarefa pronta" : "tarefas prontas"} para a conferência.`
                      : faltaTarefaEsocial
                        ? `Falta o tipo ${TAREFA_ESOCIAL} no VIOS.`
                        : `Complete ${incompletas.join(", ")}: tarefa, data${linhas.some((linha) => linha.etiqueta === "PRAZO") ? ", revisor" : ""}, responsável e observação.`}
                  </p>
                  <Button onClick={enviar} disabled={enviando || !completo}>
                    {enviando ? <LoaderCircle className="animate-spin" /> : <Send />}
                    Enviar para conferência
                  </Button>
                </div>
              </>
            )}
          </Painel>
        </div>
      </div>

      <ModalHorario
        key={horarioDe ?? "fechado"}
        linha={linhas.find((linha) => linha.chave === horarioDe) ?? null}
        hoje={detalhe.hoje}
        onConfirmar={(data, hora) => {
          if (horarioDe !== null) alterar(horarioDe, { data, hora });
          setHorarioDe(null);
        }}
        onFechar={() => setHorarioDe(null)}
      />

      <ModalTransferir
        aberto={transferindo}
        publicacaoId={id}
        escritorioAtual={publicacao.escritorioResponsavel}
        onTransferida={(destino) => {
          setTransferindo(false);
          onTransferida(destino);
        }}
        onFechar={() => setTransferindo(false)}
      />
    </div>
  );
}

/** Manda a publicação para a fila de outra área, com o motivo (só no Orquestra; a pasta no VIOS não muda). */
function ModalTransferir({
  aberto,
  publicacaoId,
  escritorioAtual,
  onTransferida,
  onFechar,
}: {
  aberto: boolean;
  publicacaoId: string;
  escritorioAtual: string | null;
  onTransferida: (destino: string) => void;
  onFechar: () => void;
}) {
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const pronto = Boolean(destino) && Boolean(motivo.trim());

  async function transferir() {
    setEnviando(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/juridico/${publicacaoId}/transferir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destino, motivo }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao transferir.");
      onTransferida(destino);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao transferir.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && !enviando && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (pronto && !enviando) void transferir();
          }}
        >
          <DialogHeader>
            <DialogTitle>Transferir para outra área</DialogTitle>
            <DialogDescription>
              A publicação sai da fila de {escritorioAtual ?? "sem área"} e vai para a da área escolhida. A pasta no VIOS não muda.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Área de destino
            <select className={campo} value={destino} onChange={(evento) => setDestino(evento.target.value)} required>
              <option value="">Escolha a área…</option>
              {ESCRITORIOS.filter((escritorio) => escritorio !== escritorioAtual).map((escritorio) => (
                <option key={escritorio} value={escritorio}>
                  {escritorio}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Motivo
            <Textarea value={motivo} onChange={(evento) => setMotivo(evento.target.value)} maxLength={2000} rows={3} required />
          </label>
          {erro ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!pronto || enviando}>
              {enviando ? <LoaderCircle className="animate-spin" /> : <ArrowRightLeft />}
              Transferir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const SEM_GRUPO = "Sem grupo";

type FiltroRisco = "todas" | "risco" | "sem_risco";

interface GrupoFila {
  nome: string;
  publicacoes: PublicacaoResumo[];
  riscos: number;
}

/** Agrupa a fila por grupo do cliente; grupos e publicações com demanda de risco primeiro. */
function agruparFila(publicacoes: PublicacaoResumo[]): GrupoFila[] {
  const grupos = new Map<string, PublicacaoResumo[]>();
  for (const publicacao of publicacoes) {
    const nome = publicacao.grupoCliente?.trim() || SEM_GRUPO;
    grupos.set(nome, [...(grupos.get(nome) ?? []), publicacao]);
  }
  return [...grupos.entries()]
    .map(([nome, lista]) => ({
      nome,
      publicacoes: [...lista].sort(
        (a, b) => Number(Boolean(b.demandaRisco)) - Number(Boolean(a.demandaRisco)) || (a.dataPublicacao ?? "").localeCompare(b.dataPublicacao ?? "")
      ),
      riscos: lista.filter((p) => p.demandaRisco).length,
    }))
    .sort((a, b) => Number(b.riscos > 0) - Number(a.riscos > 0) || a.nome.localeCompare(b.nome, "pt-BR"));
}

function Juridico() {
  const [escritorio, setEscritorio] = useState("");
  const [publicacoes, setPublicacoes] = useState<PublicacaoResumo[] | null>(null);
  const [porEscritorio, setPorEscritorio] = useState<Record<string, number>>({});
  /** Áreas do usuário do jurídico; null é a controladoria (todas). */
  const [areas, setAreas] = useState<string[] | null>(null);
  /** Publicação escolhida; sem escolha (ou fora dos filtros), abre a primeira da fila. */
  const [selecionada, setSelecionada] = useState<string | null>(null);
  /** No celular a lista e a publicação não cabem juntas: mostra a lista só quando pedida. */
  const [listaNoCelular, setListaNoCelular] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const [risco, setRisco] = useState<FiltroRisco>("todas");
  /** A fila abre sempre recolhida: a publicação ocupa a largura toda. */
  const [filaRecolhida, setFilaRecolhida] = useState(true);

  const carregar = useCallback(async (filtro: string) => {
    setPublicacoes(null);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/juridico${filtro ? `?escritorio=${encodeURIComponent(filtro)}` : ""}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar a fila.");
      setPublicacoes(corpo.publicacoes);
      setPorEscritorio(corpo.porEscritorio);
      setAreas(corpo.areas ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar a fila.");
      setPublicacoes([]);
    }
  }, []);

  useEffect(() => {
    void carregar(escritorio);
  }, [carregar, escritorio]);

  const escritorios = useMemo(() => Object.entries(porEscritorio).sort((a, b) => a[0].localeCompare(b[0], "pt-BR")), [porEscritorio]);
  const total = escritorios.reduce((soma, [, quantidade]) => soma + quantidade, 0);
  const gruposDaFila = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const publicacao of publicacoes ?? []) {
      const nome = publicacao.grupoCliente?.trim() || SEM_GRUPO;
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    }
    return [...contagem.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [publicacoes]);
  // Grupo escolhido que sumiu da fila (outro escritório) deixa de filtrar.
  const grupoAtivo = gruposDaFila.some(([nome]) => nome === grupo) ? grupo : "";
  const filtradas = useMemo(() => {
    const termo = chaveNome(busca);
    const digitos = termo.replace(/\D/g, "");
    return (publicacoes ?? []).filter((publicacao) => {
      if (grupoAtivo && (publicacao.grupoCliente?.trim() || SEM_GRUPO) !== grupoAtivo) return false;
      if (risco === "risco" && !publicacao.demandaRisco) return false;
      if (risco === "sem_risco" && publicacao.demandaRisco) return false;
      if (!termo) return true;
      return (
        (digitos.length >= 4 && (publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal).replace(/\D/g, "").includes(digitos)) ||
        [publicacao.cliente, publicacao.grupoCliente, publicacao.pastaCi].some((texto) => chaveNome(texto).includes(termo))
      );
    });
  }, [publicacoes, busca, grupoAtivo, risco]);
  const filtrosAtivos = Boolean(busca.trim() || grupoAtivo || risco !== "todas");
  const grupos = useMemo(() => agruparFila(filtradas), [filtradas]);
  // Mesma ordem da lista: é por ela que o editor anda para a anterior e a próxima.
  const ordem = useMemo(() => grupos.flatMap((item) => item.publicacoes.map((publicacao) => publicacao.id)), [grupos]);
  const aberta = selecionada && ordem.includes(selecionada) ? selecionada : ordem[0] ?? null;
  const indiceAberta = aberta ? ordem.indexOf(aberta) : -1;
  const navegacao =
    indiceAberta >= 0
      ? {
          posicao: indiceAberta + 1,
          total: ordem.length,
          anterior: ordem[indiceAberta - 1] ?? null,
          proxima: ordem[indiceAberta + 1] ?? null,
        }
      : null;

  useEffect(() => {
    // Ao andar pelas setas, a lista acompanha a publicação aberta.
    document.querySelector("[data-fila-vistagem] [aria-current=true]")?.scrollIntoView({ block: "nearest" });
  }, [aberta]);
  const riscos = (publicacoes ?? []).filter((publicacao) => publicacao.demandaRisco).length;
  const devolvidas = (publicacoes ?? []).filter((publicacao) => publicacao.devolucaoMotivo || publicacao.devolvidoEm).length;

  function abrir(id: string) {
    setSelecionada(id);
    setListaNoCelular(false);
    setAviso("");
  }

  function limparFiltros() {
    setBusca("");
    setGrupo("");
    setRisco("todas");
  }

  function transferida(destino: string) {
    // O destino pode ser outra área do próprio usuário: recarrega a fila e as contagens.
    setSelecionada(null);
    setAviso(`Publicação transferida para ${destino}.`);
    void carregar(escritorio);
  }

  function concluida(id: string) {
    // Segue para a próxima da fila (ou a anterior, se era a última).
    const posicao = ordem.indexOf(id);
    setSelecionada(ordem[posicao + 1] ?? ordem[posicao - 1] ?? null);
    setPublicacoes((publicacoes ?? []).filter((p) => p.id !== id));
    setAviso("Vistagem enviada para a conferência da controladoria.");
    setPorEscritorio((atual) => {
      const p = (publicacoes ?? []).find((item) => item.id === id);
      const chave = p?.escritorioResponsavel ?? "Sem escritório";
      return { ...atual, [chave]: Math.max(0, (atual[chave] ?? 1) - 1) };
    });
  }

  return (
    <div className="space-y-4">
      <BarraAba
        resumo={
          <>
            <p>
              <span className="font-semibold tabular-nums text-foreground">{publicacoes?.length ?? "…"}</span>{" "}
              {publicacoes?.length === 1 ? "publicação" : "publicações"} a vistar{escritorio ? ` em ${escritorio}` : ""}
              {riscos ? <span className="text-red-700"> · {riscos} de risco</span> : null}
              {devolvidas ? <span className="text-amber-800"> · {devolvidas} {devolvidas === 1 ? "devolvida" : "devolvidas"}</span> : null}
              {filtrosAtivos && publicacoes ? (
                <>
                  {" · "}
                  <span className="font-medium text-foreground">{filtradas.length} no filtro</span>{" "}
                  <button type="button" className="text-xs font-medium text-[#347796] underline-offset-4 hover:underline" onClick={limparFiltros}>
                    limpar
                  </button>
                </>
              ) : null}
            </p>
            {areas ? (
              <p className="mt-0.5 text-xs">
                {areas.length ? `Suas áreas: ${areas.join(", ")}.` : "Nenhuma área marcada para você. Peça à controladoria para liberar as suas."}
              </p>
            ) : null}
          </>
        }
      >
        {filaRecolhida ? (
          <Button type="button" variant="outline" className="hidden lg:inline-flex" onClick={() => setFilaRecolhida(false)}>
            <PanelLeftOpen />
            Mostrar fila
          </Button>
        ) : null}
        <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Processo, cliente ou CI" aria-label="Buscar publicação" />
        <select aria-label="Escritório" className={cn(campo, "w-full sm:w-60")} value={escritorio} onChange={(evento) => setEscritorio(evento.target.value)}>
          <option value="">Todos os escritórios ({total})</option>
          {escritorios.map(([nome, quantidade]) => (
            <option key={nome} value={nome}>
              {nome} ({quantidade})
            </option>
          ))}
        </select>
        <select aria-label="Grupo do cliente" className={cn(campo, "w-full sm:w-56")} value={grupoAtivo} onChange={(evento) => setGrupo(evento.target.value)}>
          <option value="">Todos os grupos</option>
          {gruposDaFila.map(([nome, quantidade]) => (
            <option key={nome} value={nome}>
              {nome} ({quantidade})
            </option>
          ))}
        </select>
        <Segmented
          label="Demanda de risco"
          value={risco}
          options={[
            { value: "todas", label: "Todas" },
            { value: "risco", label: `De risco ${riscos}` },
            { value: "sem_risco", label: `Sem risco ${(publicacoes?.length ?? 0) - riscos}` },
          ]}
          onChange={setRisco}
        />
      </BarraAba>

      {aviso ? <Aviso tom="sucesso">{aviso}</Aviso> : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {/* No desktop, lista e publicação rolam cada uma no seu painel (o main do app não deixa usar sticky). */}
      <div
        className={cn(
          "grid gap-4 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[30rem]",
          filaRecolhida ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]"
        )}
      >
        <Painel
          aria-label="Publicações a vistar"
          data-fila-vistagem
          className={cn("lg:flex lg:h-full lg:flex-col", aberta && !listaNoCelular && "hidden lg:flex", filaRecolhida && "lg:hidden")}
        >
          <div className="hidden items-center gap-2 border-b border-[#e6eef0] px-4 py-2 lg:flex">
            <span className="flex-1 text-xs font-medium text-muted-foreground">
              Fila <span className="tabular-nums">· {filtradas.length}</span>
            </span>
            <Button type="button" size="icon-xs" variant="ghost" onClick={() => setFilaRecolhida(true)} aria-label="Recolher a fila" title="Recolher a fila">
              <PanelLeftClose />
            </Button>
          </div>
          {publicacoes === null ? (
            <Carregando rotulo="Carregando a fila" />
          ) : publicacoes.length === 0 ? (
            <Vazio icone={CircleCheck} titulo="Nada para vistar">
              As publicações do dia aparecem aqui depois da captura e da triagem.
            </Vazio>
          ) : filtradas.length === 0 ? (
            <Vazio icone={Search} titulo="Nenhuma publicação com esses filtros">
              <Button type="button" variant="outline" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            </Vazio>
          ) : (
            <div className="max-h-[70vh] overflow-auto lg:max-h-none lg:flex-1">
              {grupos.map((bloco) => (
                <section key={bloco.nome} aria-label={bloco.nome}>
                  <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2 text-xs font-semibold text-[#285f7a]">
                    <span className="truncate">{bloco.nome}</span>
                    <span className="font-normal tabular-nums text-muted-foreground">{bloco.publicacoes.length}</span>
                    {bloco.riscos ? (
                      <Selo tom="perigo" className="ml-auto">
                        {bloco.riscos} de risco
                      </Selo>
                    ) : null}
                  </h3>
                  <ul className="divide-y divide-[#eef3f5]">
                    {bloco.publicacoes.map((publicacao) => (
                      <li key={publicacao.id}>
                        <button
                          type="button"
                          onClick={() => abrir(publicacao.id)}
                          aria-current={publicacao.id === aberta ? "true" : undefined}
                          className={cn(linhaLista(publicacao.id === aberta), "space-y-1")}
                        >
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-foreground">{publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}</span>
                            {publicacao.demandaRisco ? (
                              <Selo tom="perigo" icone={ShieldAlert}>
                                Risco
                              </Selo>
                            ) : null}
                            {publicacao.devolucaoMotivo || publicacao.devolvidoEm ? <Selo tom="alerta">Devolvida</Selo> : null}
                            {publicacao.transferidoDe ? <Selo tom="marca">Transferida</Selo> : null}
                          </span>
                          <span className="block truncate text-sm text-foreground">{publicacao.cliente ?? "—"}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[publicacao.escritorioResponsavel, publicacao.tribunal, `publ. ${formatarData(publicacao.dataPublicacao)}`].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Painel>

        <div className={cn("min-w-0 lg:h-full lg:overflow-y-auto lg:pr-1", (!aberta || listaNoCelular) && "hidden lg:block")}>
          {aberta ? (
            <EditorVistagem
              key={aberta}
              id={aberta}
              navegacao={navegacao}
              onAbrir={abrir}
              onConcluida={concluida}
              onTransferida={transferida}
              onVoltar={() => setListaNoCelular(true)}
            />
          ) : (
            <Painel>
              <Vazio icone={FileText} titulo={publicacoes === null ? "Carregando a fila" : "Nenhuma publicação para abrir"}>
                <p>{publicacoes === null ? "A primeira publicação da fila abre aqui." : "Quando houver publicação na fila (ou nos filtros), a primeira abre aqui."}</p>
                {filaRecolhida ? (
                  <Button type="button" variant="outline" className="mt-3" onClick={() => setFilaRecolhida(false)}>
                    <PanelLeftOpen />
                    Mostrar fila
                  </Button>
                ) : null}
              </Vazio>
            </Painel>
          )}
        </div>
      </div>
    </div>
  );
}

export function JuridicoClient() {
  return (
    <AcessoOperacoesLegais>
      <Juridico />
    </AcessoOperacoesLegais>
  );
}
