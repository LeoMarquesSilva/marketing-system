"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRightLeft, CircleCheck, FileText, LoaderCircle, Plus, Search, Send, ShieldAlert, Trash2, TriangleAlert } from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { ETIQUETAS_AGENDAMENTO, ROTULO_ETIQUETA, avisosDaData, chaveNome, horaValida, type EtiquetaAgendamento } from "@/lib/vistagem/agendamento";
import {
  CONTAGENS_PRAZO,
  DIAS_PRAZO,
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
import { Aviso, BarraAba, Busca, Campo, Carregando, Painel, PainelTopo, Secao, Selo, Vazio, campoClasse, linhaLista } from "./ui";

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
    contagemPrazo: null,
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
  if (!linha.tarefa || !linha.responsavel) return false;
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

/** Ao clicar num atalho de dias, pergunta se o prazo é em dias úteis ou corridos, com a fatal de cada um. */
function ModalContagem({
  aberto,
  dias,
  dataPublicacao,
  contaPrazo,
  onEscolher,
  onFechar,
}: {
  aberto: boolean;
  /** Mantido ao fechar, para o conteúdo não sumir durante a animação de saída. */
  dias: number | null;
  dataPublicacao: string | null;
  contaPrazo: (iso: string) => boolean;
  onEscolher: (contagem: ContagemPrazo, fatal: string) => void;
  onFechar: () => void;
}) {
  const fatais = dias && dataPublicacao ? CONTAGENS_PRAZO.map((contagem) => [contagem, fatalPorContagem(dataPublicacao, dias, contagem, contaPrazo)] as const) : [];

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Prazo de {dias} dias</DialogTitle>
          <DialogDescription>
            Contados a partir do 1º dia útil após a publicação{dataPublicacao ? ` de ${formatarData(dataPublicacao)}` : ""}. O recesso
            forense (20/12 a 20/01) suspende a contagem.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {fatais.map(([contagem, fatal], indice) => (
            <Button
              key={contagem}
              type="button"
              variant="outline"
              className="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
              onClick={() => onEscolher(contagem, fatal)}
              autoFocus={indice === 0}
            >
              <span className="block text-sm font-semibold text-foreground first-letter:uppercase">{ROTULO_CONTAGEM[contagem]}</span>
              <span className="text-xs font-normal text-muted-foreground">
                fatal <span className="font-mono font-semibold text-[#183f50]">{formatarData(fatal)}</span>
              </span>
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Nos dias corridos, vencimento em fim de semana ou feriado passa para o próximo dia útil.</p>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
        </DialogFooter>
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
  return (
    <div className="space-y-2 rounded-md border border-[#e6eef0] bg-[#f7fbfc] p-3 text-xs">
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
  );
}

function EditorVistagem({
  id,
  onConcluida,
  onTransferida,
  onVoltar,
}: {
  id: string;
  onConcluida: (id: string) => void;
  onTransferida: (destino: string) => void;
  onVoltar: () => void;
}) {
  const [detalhe, setDetalhe] = useState<VistagemDetalhe | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [observacao, setObservacao] = useState("");
  /** Trabalhista: classificação eSocial (não vai para o VIOS). */
  const [esocial, setEsocial] = useState<ClassificacaoEsocial>(ESOCIAL_PADRAO);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  /** Linha do Compromisso com o modal de data e horário aberto. */
  const [horarioDe, setHorarioDe] = useState<number | null>(null);
  /** Atalho de dias clicado, à espera da escolha entre úteis e corridos. */
  const [contagemDe, setContagemDe] = useState<{ chave: number; dias: number; aberto: boolean } | null>(null);
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
        setObservacao(dados.publicacao.observacaoVistagem ?? "");
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
                  contagemPrazo: item.contagemPrazo,
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
      novaLinha({ etiqueta: "PROVIDENCIA", tarefa: tarefa.nome, responsavel: detalhe?.esocial?.responsavelSugerido ?? "", esocial: true }),
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
          observacao,
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
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="lg:hidden" onClick={onVoltar}>
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

      <Painel aria-labelledby="publicacao-titulo">
        <div className="flex flex-wrap items-start gap-3 border-b border-[#e6eef0] px-4 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="publicacao-titulo" className="font-mono text-base font-semibold text-foreground">
                {publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}
              </h2>
              {publicacao.tribunal ? <Selo tom="marca">{publicacao.tribunal}</Selo> : null}
            </div>
            <DadosPasta publicacao={{ ...publicacao, pendencia: null }} />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setTransferindo(true)}>
            <ArrowRightLeft />
            Transferir área
          </Button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <DadosPublicacao publicacao={publicacao} />
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#e6eef0] bg-[#f7fbfc] p-3 font-sans text-sm leading-relaxed text-foreground">
            {publicacao.teor}
          </pre>
        </div>
      </Painel>

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

      {/* sem overflow-hidden: o rodapé com o botão de enviar fica preso no fim da tela */}
      <Painel aria-labelledby="vistagem-titulo" className="overflow-visible">
        <PainelTopo
          id="vistagem-titulo"
          titulo="Vistagem"
          descricao={catalogo ? `Tarefas da lista do VIOS para ${catalogo.area}.` : undefined}
          className="rounded-t-lg bg-[#f7fbfc]"
        />

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
            {detalhe.esocial ? (
              <Secao titulo="Publicação - eSocial" id="esocial-titulo" acao={<span className="text-xs text-muted-foreground">Não vai para o VIOS</span>}>
                <Campo rotulo="Classificação" className="sm:w-80">
                  <select className={campo} value={esocial} onChange={(evento) => trocarEsocial(evento.target.value as ClassificacaoEsocial)}>
                    {CLASSIFICACOES_ESOCIAL.map((classificacao) => (
                      <option key={classificacao} value={classificacao}>
                        {classificacao}
                      </option>
                    ))}
                  </select>
                </Campo>
                {faltaTarefaEsocial ? (
                  <Aviso tom="erro">
                    {esocial} pede a tarefa {TAREFA_ESOCIAL}, mas esse tipo de tarefa não está na lista do VIOS para Trabalhista. Avise a controladoria.
                  </Aviso>
                ) : pedeTarefaEsocial(esocial) ? (
                  <p className="text-xs text-muted-foreground">
                    {esocial} pede também a tarefa {TAREFA_ESOCIAL}: ela está na lista abaixo. Confira o responsável e escolha a data.
                  </p>
                ) : null}
              </Secao>
            ) : null}

            <Secao
              titulo="Tarefas no VIOS"
              id="tarefas-titulo"
              acao={
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
              }
            >
              <ol className="-mx-4 divide-y divide-[#e6eef0] border-t border-[#e6eef0]">
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
                    <li key={linha.chave} aria-label={`Tarefa ${indice + 1}`} className="space-y-4 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">Tarefa {indice + 1}</span>
                        {linha.esocial ? <Selo tom="marca">eSocial</Selo> : null}
                        {linha.ia ? <SeloIa /> : null}
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                          {linha.esocial ? (
                            <span className="text-xs text-muted-foreground">Pedida pela classificação eSocial ({esocial})</span>
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

                      <div className="space-y-1.5">
                        <span className="block text-xs font-medium text-muted-foreground">Tarefa</span>
                        {linha.esocial ? (
                          <p className={cn(campo, "flex items-center bg-[#f7fbfc] text-foreground")}>{linha.tarefa}</p>
                        ) : (
                          <ComboboxBusca
                            opcoes={catalogo.tarefas[linha.etiqueta]}
                            valor={linha.tarefa}
                            onChange={(nome) => {
                              alterar(linha.chave, { tarefa: nome });
                              if (nome && linha.etiqueta === "COMPROMISSO") setHorarioDe(linha.chave);
                            }}
                            placeholder="Digite para buscar a tarefa…"
                            rotulo={`Tarefa ${indice + 1}`}
                          />
                        )}
                      </div>

                      {prazo ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-[minmax(150px,200px)_minmax(0,1fr)] sm:items-end">
                            <Campo rotulo="Data fatal">
                              <input
                                type="date"
                                className={campo}
                                value={linha.dataFatal}
                                onChange={(evento) => alterar(linha.chave, { dataFatal: evento.target.value, diasPrazo: null, contagemPrazo: null })}
                              />
                            </Campo>
                            <div className="space-y-1.5">
                              <span className="block text-xs font-medium text-muted-foreground">
                                Ou dias após a publicação{publicacao.dataPublicacao ? ` (${formatarData(publicacao.dataPublicacao)})` : ""}
                                {linha.diasPrazo && linha.contagemPrazo ? (
                                  <span className="font-semibold text-[#183f50]">
                                    {" "}
                                    · {linha.diasPrazo} {ROTULO_CONTAGEM[linha.contagemPrazo]}
                                  </span>
                                ) : null}
                              </span>
                              <div className="flex flex-wrap gap-1" role="group" aria-label="Prazo em dias">
                                {DIAS_PRAZO.map((dias) => (
                                  <Button
                                    key={dias}
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    aria-pressed={linha.diasPrazo === dias}
                                    disabled={!publicacao.dataPublicacao}
                                    className={cn(
                                      "min-w-9 tabular-nums",
                                      linha.diasPrazo === dias && "border-[#285f7a] bg-[#347796] text-white hover:bg-[#285f7a] hover:text-white"
                                    )}
                                    onClick={() => publicacao.dataPublicacao && setContagemDe({ chave: linha.chave, dias, aberto: true })}
                                  >
                                    {dias}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                          {cadeia ? (
                            <dl className="grid overflow-hidden rounded-md border border-[#e6eef0] text-xs sm:grid-cols-4">
                              <div className="bg-[#e8f8f8] px-3 py-2">
                                <dt className="font-medium text-[#285f7a]">{cadeia.protocolar ? "Enviar" : "Tarefa"} · vai para o VIOS</dt>
                                <dd className="mt-0.5 font-mono text-sm font-semibold text-[#183f50]">{formatarData(cadeia.enviar)}</dd>
                              </div>
                              {cadeia.revisar ? (
                                <div className="border-t border-[#e6eef0] px-3 py-2 sm:border-l sm:border-t-0">
                                  <dt className="text-muted-foreground">Revisar</dt>
                                  <dd className="mt-0.5 font-mono text-sm text-foreground">{formatarData(cadeia.revisar)}</dd>
                                </div>
                              ) : null}
                              {cadeia.protocolar ? (
                                <div className="border-t border-[#e6eef0] px-3 py-2 sm:border-l sm:border-t-0">
                                  <dt className="text-muted-foreground">Protocolar</dt>
                                  <dd className="mt-0.5 font-mono text-sm text-foreground">{formatarData(cadeia.protocolar)}</dd>
                                </div>
                              ) : null}
                              <div className="border-t border-[#e6eef0] px-3 py-2 sm:border-l sm:border-t-0">
                                <dt className="text-muted-foreground">Fatal</dt>
                                <dd className="mt-0.5 font-mono text-sm font-semibold text-red-700">{formatarData(cadeia.fatal)}</dd>
                              </div>
                            </dl>
                          ) : (
                            <p className="text-xs text-muted-foreground">Escolha a data fatal ou um atalho de dias para ver Enviar, Revisar e Protocolar.</p>
                          )}
                          {tarefaId && !cadeiaFluxo ? (
                            <p className="text-xs text-muted-foreground">
                              O VIOS não cria Revisar nem Protocolar para esta tarefa: ela vai com a data do protocolo (1 dia útil antes da fatal).
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-end gap-3">
                          <Campo rotulo="Data no VIOS" className="w-full sm:w-56">
                            <input type="date" className={campo} value={linha.data} onChange={(evento) => alterar(linha.chave, { data: evento.target.value })} />
                          </Campo>
                          {linha.etiqueta === "COMPROMISSO" ? (
                            <Campo rotulo="Horário" className="w-36">
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

                      <div className="grid gap-3 md:grid-cols-2">
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
                          <span className="block text-xs font-medium text-muted-foreground">{prazo ? "Revisor (obrigatório no Prazo)" : "Revisor (opcional)"}</span>
                          <ComboboxBusca
                            opcoes={catalogo.usuarios}
                            valor={linha.revisor}
                            onChange={(nome) => alterar(linha.chave, { revisor: nome })}
                            placeholder={prazo ? "Digite para buscar o revisor…" : "Sem revisor"}
                            rotulo={`Revisor da tarefa ${indice + 1}`}
                            permitirVazio
                            invalido={prazo && !linha.revisor}
                          />
                          {prazo && detalhe.revisorSugerido && linha.revisor === detalhe.revisorSugerido ? (
                            <span className="block text-xs text-muted-foreground">Auxiliar da pasta no VIOS.</span>
                          ) : null}
                        </div>
                      </div>

                      {fluxo ? (
                        <FluxoNoVios fluxo={fluxo} responsavel={linha.responsavel} revisor={linha.revisor} datas={datasDoFluxo} />
                      ) : tarefaId && !detalhe.fluxosErro ? (
                        <p className="text-xs text-muted-foreground">O VIOS não cria outras tarefas junto com esta.</p>
                      ) : null}

                      <Campo rotulo="Observação (vai na descrição da tarefa)">
                        <Textarea
                          value={linha.observacao}
                          onChange={(evento) => alterar(linha.chave, { observacao: evento.target.value })}
                          maxLength={2000}
                          rows={2}
                        />
                      </Campo>
                    </li>
                  );
                })}
              </ol>
            </Secao>

            <Secao titulo="Observação para a controladoria" id="observacao-titulo">
              <Textarea
                aria-labelledby="observacao-titulo"
                value={observacao}
                onChange={(evento) => setObservacao(evento.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Opcional"
              />
            </Secao>

            {erro ? (
              <div className="px-4 pb-4">
                <Aviso tom="erro">{erro}</Aviso>
              </div>
            ) : null}

            <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-b-lg border-t border-[#e6eef0] bg-white px-4 py-3 shadow-[0_-8px_16px_-12px_rgba(16,41,58,0.18)]">
              <p className="min-w-0 flex-1 text-xs text-muted-foreground" aria-live="polite">
                {completo
                  ? `${linhas.length} ${linhas.length === 1 ? "tarefa pronta" : "tarefas prontas"} para a conferência.`
                  : faltaTarefaEsocial
                    ? `Falta o tipo ${TAREFA_ESOCIAL} no VIOS.`
                    : `Complete ${incompletas.join(", ")}: tarefa, data${linhas.some((linha) => linha.etiqueta === "PRAZO") ? ", revisor" : ""} e responsável.`}
              </p>
              <Button onClick={enviar} disabled={enviando || !completo}>
                {enviando ? <LoaderCircle className="animate-spin" /> : <Send />}
                Enviar para conferência
              </Button>
            </div>
          </>
        )}
      </Painel>

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

      <ModalContagem
        aberto={Boolean(contagemDe?.aberto)}
        dias={contagemDe?.dias ?? null}
        dataPublicacao={publicacao.dataPublicacao}
        contaPrazo={contaPrazo}
        onEscolher={(contagemPrazo, dataFatal) => {
          if (contagemDe) alterar(contagemDe.chave, { diasPrazo: contagemDe.dias, contagemPrazo, dataFatal });
          setContagemDe((atual) => atual && { ...atual, aberto: false });
        }}
        onFechar={() => setContagemDe((atual) => atual && { ...atual, aberto: false })}
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

interface GrupoFila {
  nome: string;
  publicacoes: PublicacaoResumo[];
  riscos: number;
}

/** Agrupa a fila por grupo do cliente; grupos e publicações com demanda de risco primeiro. */
function agruparFila(publicacoes: PublicacaoResumo[]): GrupoFila[] {
  const grupos = new Map<string, PublicacaoResumo[]>();
  for (const publicacao of publicacoes) {
    const nome = publicacao.grupoCliente?.trim() || "Sem grupo";
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
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");

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
  const filtradas = useMemo(() => {
    const termo = chaveNome(busca);
    if (!termo) return publicacoes ?? [];
    const digitos = termo.replace(/\D/g, "");
    return (publicacoes ?? []).filter(
      (publicacao) =>
        (digitos.length >= 4 && (publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal).replace(/\D/g, "").includes(digitos)) ||
        [publicacao.cliente, publicacao.grupoCliente, publicacao.pastaCi].some((texto) => chaveNome(texto).includes(termo))
    );
  }, [publicacoes, busca]);
  const grupos = useMemo(() => agruparFila(filtradas), [filtradas]);
  const riscos = (publicacoes ?? []).filter((publicacao) => publicacao.demandaRisco).length;
  const devolvidas = (publicacoes ?? []).filter((publicacao) => publicacao.devolucaoMotivo || publicacao.devolvidoEm).length;

  function transferida(destino: string) {
    // O destino pode ser outra área do próprio usuário: recarrega a fila e as contagens.
    setSelecionada(null);
    setAviso(`Publicação transferida para ${destino}.`);
    void carregar(escritorio);
  }

  function concluida(id: string) {
    const restantes = (publicacoes ?? []).filter((p) => p.id !== id);
    setPublicacoes(restantes);
    setSelecionada(agruparFila(restantes)[0]?.publicacoes[0]?.id ?? null);
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
            </p>
            {areas ? (
              <p className="mt-0.5 text-xs">
                {areas.length ? `Suas áreas: ${areas.join(", ")}.` : "Nenhuma área marcada para você. Peça à controladoria para liberar as suas."}
              </p>
            ) : null}
          </>
        }
      >
        <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Processo, cliente ou CI" aria-label="Buscar publicação" />
        <select aria-label="Escritório" className={cn(campo, "w-full sm:w-60")} value={escritorio} onChange={(evento) => setEscritorio(evento.target.value)}>
          <option value="">Todos os escritórios ({total})</option>
          {escritorios.map(([nome, quantidade]) => (
            <option key={nome} value={nome}>
              {nome} ({quantidade})
            </option>
          ))}
        </select>
      </BarraAba>

      {aviso ? <Aviso tom="sucesso">{aviso}</Aviso> : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {/* No desktop, lista e publicação rolam cada uma no seu painel (o main do app não deixa usar sticky). */}
      <div className="grid gap-4 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[30rem] lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <Painel aria-label="Publicações a vistar" className={cn("lg:flex lg:h-full lg:flex-col", selecionada && "hidden lg:flex")}>
          {publicacoes === null ? (
            <Carregando rotulo="Carregando a fila" />
          ) : publicacoes.length === 0 ? (
            <Vazio icone={CircleCheck} titulo="Nada para vistar">
              As publicações do dia aparecem aqui depois da captura e da triagem.
            </Vazio>
          ) : filtradas.length === 0 ? (
            <Vazio icone={Search} titulo="Nenhuma publicação com essa busca" />
          ) : (
            <div className="max-h-[70vh] overflow-auto lg:max-h-none lg:flex-1">
              {grupos.map((grupo) => (
                <section key={grupo.nome} aria-label={grupo.nome}>
                  <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2 text-xs font-semibold text-[#285f7a]">
                    <span className="truncate">{grupo.nome}</span>
                    <span className="font-normal tabular-nums text-muted-foreground">{grupo.publicacoes.length}</span>
                    {grupo.riscos ? (
                      <Selo tom="perigo" className="ml-auto">
                        {grupo.riscos} de risco
                      </Selo>
                    ) : null}
                  </h3>
                  <ul className="divide-y divide-[#eef3f5]">
                    {grupo.publicacoes.map((publicacao) => (
                      <li key={publicacao.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelecionada(publicacao.id);
                            setAviso("");
                          }}
                          aria-current={publicacao.id === selecionada ? "true" : undefined}
                          className={cn(linhaLista(publicacao.id === selecionada), "space-y-1")}
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

        <div className={cn("min-w-0 lg:h-full lg:overflow-y-auto lg:pr-1", !selecionada && "hidden lg:block")}>
          {selecionada ? (
            <EditorVistagem
              key={selecionada}
              id={selecionada}
              onConcluida={concluida}
              onTransferida={transferida}
              onVoltar={() => setSelecionada(null)}
            />
          ) : (
            <Painel>
              <Vazio icone={FileText} titulo="Escolha uma publicação na lista">
                Leia o teor, use a sugestão da IA quando houver e vincule as tarefas do VIOS.
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
