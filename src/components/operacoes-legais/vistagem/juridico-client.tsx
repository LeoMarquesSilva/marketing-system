"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  ClipboardList,
  CornerDownRight,
  FileCheck2,
  FileText,
  ListPlus,
  MessageSquareText,
  Pencil,
  Users,
  Workflow,
  Landmark,
  Layers,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { avisarContagensVistagem } from "@/hooks/use-vistagem-contagens";
import { cn } from "@/lib/utils";
import {
  ETIQUETAS_AGENDAMENTO,
  ROTULO_ETIQUETA,
  atalhosDePrazo,
  avisosDaData,
  chaveDoCaminho,
  chaveNome,
  contagemPadraoDaPublicacao,
  horaFinalPadrao,
  horaValida,
  mesmasPessoas,
  nomesDasPessoas,
  dataPadraoDaTarefa,
  observacaoObrigatoria,
  pedeDataLimite,
  revisorFicaNaTarefa,
  separarNomes,
  type EtiquetaAgendamento,
  type OrigemPrazo,
} from "@/lib/vistagem/agendamento";
import { reabertaParaAlterar } from "@/lib/vistagem/alterar-vistagem";
import { cienciaDosAgendamentos, cienciaQueFica, ehCienciaDosAgendamentos } from "@/lib/vistagem/ciencia-agendamentos";
import {
  CONTAGENS_PRAZO,
  ROTULO_CONTAGEM,
  criarCalendario,
  criarCalendarioDePrazo,
  dataDaTarefaSemPrazo,
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
import { CADEIA_PADRAO, cadeiaDoFluxo, semPrazoProprio } from "@/lib/vistagem/fluxo-vios";
import { ROTULO_AJUSTE, emOrdemDeArvore, fluxoDoPrazo, fluxoPrevisto } from "@/lib/vistagem/fluxo-previsto";
import { fataisDoFluxo, prazoLegalDaTarefa } from "@/lib/vistagem/prazo-legal";
import { fatalSugerida, sugestaoNaListaAtual, type SugestaoIa } from "@/lib/vistagem/sugestao-ia";
import { ESCRITORIOS } from "@/lib/vistagem/triagem";
import { vaiParaCentral } from "@/lib/vistagem/central";
import type { DataDoFluxo, PublicacaoResumo, ResolucaoPendencia, ResultadoCentral, TarefaPrevista, VistagemDetalhe } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { SeloAberturaDePasta } from "./abertura-pasta";
import { CampoData, CampoHora } from "./campo-data";
import { ESTILO_CLASSE, ICONE_CLASSE } from "./tarefas-conferencia";
import { AvatarPessoa, ComboboxBusca, type OpcaoBusca } from "./combobox-busca";
import { BOTAO_FAIXA, FaixaDoProcesso, NA_FAIXA } from "./faixa-processo";
import { BotaoHistorico } from "./historico-publicacao";
import { CalendarioDoFluxo, ItemDaLegenda, NumeroDoMarco, tomDaTarefaDoFluxo, type MarcoDoCalendario, type TomDoMarco } from "./calendario-fluxo";
import { nomeCurto as nomeCurtoDaPessoa, partesDaData } from "@/lib/vistagem/como-fica-no-vios";
import { FichaPasta } from "./ficha-pasta";
import { FiltroData, dataNaLista, hojeLocal } from "./filtro-data";
import { FichaProcesso, ResumoDaFicha, SinteseDoProcesso } from "./ficha-processo";
import { CartaoInconsistencia } from "./inconsistencias-ui";
import { AgendadasJuridico } from "./juridico-agendadas";
import { LeitorPublicacao } from "./leitor-publicacao";
import { IconeArea, IconeTribunal, LogoGrupo } from "./marcas";
import { descricaoDoTribunal } from "@/lib/vistagem/tribunais";
import { camposDaPublicacao, combinaCampos } from "@/lib/vistagem/busca";
import { contarPor, formatarData, formatarDataHora, tribunalDe } from "./publicacao-ui";
import { ReguaDatas, diaDaSemana, relativoAHoje } from "./regua-datas";
import { IconeOpcao, Seletor, SeletorBusca } from "./seletor";
import { CartaoSugestaoIa, SeloIa, type EstadoSugestao } from "./sugestao-ia-ui";
import { Aviso, Busca, Carregando, ICONE_ETIQUETA_DESTAQUE, Painel, Selo, SelosDeEtiqueta, Vazio, campoClasse, linhaLista } from "./ui";
import { etiquetasEmDestaque } from "@/lib/vistagem/etiquetas";

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
  /** Prazo: de onde vieram os dias ou a fatal (a Conferência mostra). */
  origemPrazo: OrigemPrazo | null;
  /** Compromisso: horário HH:MM (Hora tarefa no VIOS). */
  hora: string;
  /** Compromisso: Hora final no VIOS (HH:MM); começa 1 hora depois da inicial e acompanha até a pessoa mudar. */
  horaFim: string;
  /** SESSÃO DE JULGAMENTO: data limite no VIOS (AAAA-MM-DD). Vazia = a mesma data para conclusão, e acompanha quando ela muda. */
  dataLimite: string;
  responsavel: string;
  revisor: string;
  observacao: string;
  /** Inserir E-social pedida pela classificação eSocial: tarefa fixa, sai quando a classificação muda. */
  esocial: boolean;
  /** Veio da sugestão da IA. */
  ia: boolean;
  /** Datas e responsáveis do Fluxo do VIOS que a pessoa mudou, pela chave do caminho (chaveDoCaminho). */
  fluxoDatas: Record<string, DataDoFluxo>;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Parte do cartão da tarefa ("O que", "Prazo", "Quem"): título pequeno com ícone e os campos embaixo. */
export function BlocoTarefa({ titulo, icone: Icone, acao, children }: { titulo: string; icone: LucideIcon; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold uppercase text-[#285f7a]">
        <Icone className="size-3.5 shrink-0" aria-hidden />
        {titulo}
        {acao ? <span className="normal-case">{acao}</span> : null}
      </h3>
      {children}
    </section>
  );
}

/**
 * Aviso de que o Orquestra acrescenta a 1. CIÊNCIA DOS AGENDAMENTOS: nenhuma tarefa é ela e o fluxo do VIOS de
 * nenhuma a cria. Mostra para quem vai (Reestruturação: o revisor no lugar do estagiário); o servidor decide ao gravar.
 */
function CienciaDoOrquestra({
  linhas,
  catalogo,
  detalhe,
}: {
  linhas: Linha[];
  catalogo: NonNullable<VistagemDetalhe["catalogo"]>;
  detalhe: VistagemDetalhe;
}) {
  if (detalhe.fluxosErro) return null;
  const estagiarios = new Set(detalhe.estagiarios.map(chaveNome));
  const ciencia = cienciaDosAgendamentos(
    linhas.map((linha) => ({
      tarefa: linha.tarefa,
      tarefaId: catalogo.tarefas[linha.etiqueta].find((opcao) => opcao.nome === linha.tarefa)?.id ?? null,
      responsaveis: separarNomes(linha.responsavel).map((nome) => ({ id: null, nome })),
      revisor: linha.revisor.trim() ? { id: null, nome: linha.revisor.trim() } : null,
    })),
    {
      fluxoDe: (tarefaId) => detalhe.fluxos[tarefaId] ?? null,
      area: detalhe.publicacao.escritorioResponsavel ?? catalogo.area,
      ehEstagiario: (pessoa) => estagiarios.has(chaveNome(pessoa.nome)),
    }
  );
  if (!ciencia) return null;
  const varias = linhas.filter((linha) => linha.tarefa).length > 1;
  return (
    <div className="px-4 pb-3">
      <Aviso tom="info" titulo="O Orquestra cria também a 1. CIÊNCIA DOS AGENDAMENTOS">
        O fluxo do VIOS {varias ? "destas tarefas" : "desta tarefa"} não cria a Ciência dos Agendamentos: ela vai junto, com a data do
        lançamento (vistada a partir das 18h, no dia útil seguinte), para {ciencia.responsaveis.map((pessoa) => pessoa.nome).join(", ")}
        {ciencia.revisorNoLugarDe.length ? ` (na Reestruturação, o revisor no lugar de ${ciencia.revisorNoLugarDe.join(", ")}, estagiário)` : ""}.
      </Aviso>
    </div>
  );
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
    origemPrazo: null,
    hora: "",
    horaFim: "",
    dataLimite: "",
    responsavel: "",
    revisor: "",
    observacao: "",
    esocial: false,
    ia: false,
    fluxoDatas: {},
    ...base,
  };
}

const campo = campoClasse;

/**
 * `semFatal`: tarefa de Prazo sem prazo próprio no VIOS (a SENTENÇA), que leva a data dela em vez da fatal.
 * `pedeObservacao`: tipo em que a Observação é obrigatória (CIÊNCIA NF).
 * `pedeLimite`: tipo com data limite própria (SESSÃO DE JULGAMENTO), que não pode ficar antes da data.
 */
function linhaCompleta(linha: Linha, semFatal: boolean, pedeObservacao = false, pedeLimite = false): boolean {
  if (!linha.tarefa || !linha.responsavel) return false;
  if (pedeObservacao && !linha.observacao.trim()) return false;
  if (pedeLimite && !dataLimiteValida(linha)) return false;
  if (linha.etiqueta === "PRAZO") return Boolean((semFatal ? linha.data : linha.dataFatal) && linha.revisor);
  return Boolean(linha.data) && (linha.etiqueta !== "COMPROMISSO" || (horaValida(linha.hora) && horaFinalValida(linha)));
}

/** Data limite vazia (vai a mesma data) ou a data para conclusão ou depois. */
function dataLimiteValida(linha: Pick<Linha, "data" | "dataLimite">): boolean {
  return !linha.dataLimite || !linha.data || linha.dataLimite >= linha.data;
}

/** Hora final vazia (vai 1 hora depois) ou depois da inicial. */
function horaFinalValida(linha: Pick<Linha, "hora" | "horaFim">): boolean {
  return !linha.horaFim || (horaValida(linha.horaFim) && linha.horaFim > linha.hora);
}

/** Pergunta data e horário ao escolher um Compromisso (audiência, perícia, sessão…). Montar com key da linha. */
function ModalHorario({
  linha,
  hoje,
  ehDiaUtil,
  onConfirmar,
  onFechar,
}: {
  linha: Linha | null;
  hoje: string;
  ehDiaUtil: (iso: string) => boolean;
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
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">Data</span>
              <CampoData rotulo="Data do compromisso" valor={data} onChange={setData} ehDiaUtil={ehDiaUtil} invalido={!data} />
            </div>
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">Horário</span>
              <CampoHora rotulo="Horário do compromisso" valor={hora} onChange={setHora} invalido={Boolean(hora) && !horaValida(hora)} autoFocus />
            </div>
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

/** Úteis ou corridos, no visual do Segmented e na altura dos atalhos de dias e da data fatal. */
function ContagemDoPrazo({ rotulo, valor, onChange }: { rotulo: string; valor: ContagemPrazo; onChange: (contagem: ContagemPrazo) => void }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex h-10 shrink-0 rounded-md border border-input bg-white p-0.5">
      {CONTAGENS_PRAZO.map((contagem) => {
        const marcado = valor === contagem;
        return (
          <button
            key={contagem}
            type="button"
            role="radio"
            aria-checked={marcado}
            onClick={() => onChange(contagem)}
            className={cn(
              "inline-flex items-center justify-center rounded-[5px] px-2.5 text-xs transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
              marcado ? "bg-[#347796] font-medium text-white" : "text-muted-foreground hover:bg-[#47cdd0]/10 hover:text-foreground"
            )}
          >
            {contagem === "uteis" ? "Úteis" : "Corridos"}
          </button>
        );
      })}
    </div>
  );
}

/**
 * O que o fluxo automático do VIOS cria junto com a tarefa, com a data de cada uma (pela regra do VIOS) e quem o
 * robô coloca nela. A pessoa pode mudar a data (ex.: o VIOS dá 5 dias e ela prioriza em 2): o robô grava no VIOS
 * depois de lançar, e as tarefas que nascem desta acompanham a nova data.
 */
/** Classe da tarefa pedida → cor do VIOS no calendário. */
const TOM_DA_ETIQUETA: Record<Etiqueta, TomDoMarco> = { PRAZO: "prazo", PROVIDENCIA: "providencia", COMPROMISSO: "compromisso" };

/**
 * Quem fica na tarefa, com foto: "Leticia Zamarion Julio, Samuel Willian Silva" (ou "… + Samuel Willian Silva", do
 * 3. PROTOCOLAR) vira avatares com o nome curto.
 */
function PessoasDaTarefa({ nomes, foto }: { nomes: string | null | undefined; foto: (nome: string) => string | null }) {
  const lista = nomesDasPessoas(nomes);
  if (!lista.length) return null;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {lista.map((nome) => (
        <span key={nome} className="inline-flex min-w-0 items-center gap-1" title={nome}>
          <AvatarPessoa nome={nome} foto={foto(nome)} className="size-5" />
          <span className="truncate text-foreground/80">{nomeCurtoDaPessoa(nome)}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * Quem fica numa tarefa do fluxo, com o botão para trocar: abre a busca de pessoas (as mesmas do Responsável). A
 * escolha vai para o robô no lugar da regra dele; "voltar ao padrão" devolve a regra. Escolher as mesmas pessoas da
 * regra não conta como mudança.
 */
function ResponsaveisDoFluxo({
  tarefa,
  pessoas,
  onMudar,
}: {
  tarefa: TarefaPrevista;
  pessoas: PessoasDoCampo;
  onMudar: (nomes: string[] | null) => void;
}) {
  // Valor do campo enquanto o modal está aberto (null: fechado).
  const [editando, setEditando] = useState<string | null>(null);
  const escolhidos = tarefa.responsaveisEscolhidos ?? null;
  const padrao = tarefa.responsaveisPadrao ?? tarefa.responsaveis;
  const conhecidas = new Set((pessoas.ampliar?.todas ?? pessoas.opcoes).map((opcao) => chaveNome(opcao.nome)));
  // Ao abrir, começa com quem já fica; "padrão do VIOS", "Estagiário da pasta"… não são pessoas da lista e ficam de fora.
  const pessoasDe = (texto: string) => nomesDasPessoas(texto).filter((nome) => conhecidas.has(chaveNome(nome)));
  const nomes = editando === null ? [] : separarNomes(editando);
  const rotulo = `Responsáveis de ${tarefa.caminho.join(" › ")}`;
  const aplicar = () => {
    if (!nomes.length) return;
    onMudar(mesmasPessoas(nomes, pessoasDe(padrao)) && pessoasDe(padrao).length === nomesDasPessoas(padrao).length ? null : nomes);
    setEditando(null);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setEditando((escolhidos ?? pessoasDe(tarefa.responsaveis)).join(", "))}
        title={escolhidos ? `Escolhido na vistagem. Pela regra do robô: ${padrao}` : "Trocar quem fica nesta tarefa"}
        aria-label={`Trocar os responsáveis de ${tarefa.caminho.join(" › ")}`}
        className={cn(
          "group/pessoas inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[#47cdd0]/10",
          escolhidos && "bg-[#eef6f8] ring-1 ring-[#347796]/35"
        )}
      >
        {nomesDasPessoas(tarefa.responsaveis).length ? (
          <PessoasDaTarefa nomes={tarefa.responsaveis} foto={pessoas.foto} />
        ) : (
          <span className="text-muted-foreground">escolher responsável</span>
        )}
        <Pencil className="size-3 shrink-0 text-muted-foreground opacity-60 group-hover/pessoas:opacity-100" aria-hidden />
      </button>
      {escolhidos ? (
        <button type="button" className="font-medium text-[#347796] underline-offset-4 hover:underline" onClick={() => onMudar(null)}>
          voltar ao padrão
        </button>
      ) : null}
      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Responsáveis de {tarefa.nome}</DialogTitle>
            <DialogDescription>
              Pela regra do robô fica com {padrao}. Os escolhidos aqui o robô põe no VIOS depois de lançar.
            </DialogDescription>
          </DialogHeader>
          {/* Altura para a lista de pessoas abrir dentro do modal. */}
          <div className="min-h-[19rem]">
            <CampoResponsaveis pessoas={pessoas} valor={editando ?? ""} onChange={setEditando} rotulo={rotulo} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!nomes.length} onClick={aplicar}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Data curta da agenda: "qua, 12/11". */
function diaDaAgenda(iso: string): string {
  const partes = partesDaData(iso);
  return `${partes.semana}, ${partes.dia}/${iso.slice(5, 7)}`;
}

export function FluxoNoVios({
  previstas,
  principal,
  fatais,
  hoje,
  ehDiaUtil,
  onMudarData,
  onMudarResponsaveis,
  pessoas,
  classeDe,
}: {
  previstas: TarefaPrevista[];
  /** Classe da tarefa do fluxo na lista do VIOS da área (Prazo, Providência…), pelo nome; null quando não está lá. */
  classeDe: (nome: string) => Etiqueta | null;
  /** A tarefa pedida, com a data que vai para o VIOS (no Prazo, o Enviar), a classe e quem fica. */
  principal: { nome: string; data: string | null; etiqueta: Etiqueta; responsaveis: string };
  /** As pessoas e as fotos dos campos Responsável e Revisor (para trocar quem fica numa tarefa do fluxo). */
  pessoas: PessoasDoCampo;
  /** Data fatal do Prazo ou, na tarefa sem prazo próprio, a de cada prazo que ela cria (só para situar no calendário). */
  fatais: { rotulo: string; data: string; dica: string }[];
  hoje: string;
  ehDiaUtil: (iso: string) => boolean;
  onMudarData: (caminho: string[], data: string | null) => void;
  /** null volta à regra do robô. */
  onMudarResponsaveis: (caminho: string[], nomes: string[] | null) => void;
}) {
  // Aberto por padrão: o calendário é para ser visto; a pessoa recolhe se quiser.
  const [aberto, setAberto] = useState(true);
  const foto = pessoas.foto;
  const junto = previstas.filter((tarefa) => tarefa.quando === "criacao");
  const aoConcluir = previstas.filter((tarefa) => tarefa.quando === "conclusao");
  const alteradas = junto.filter((tarefa) => tarefa.editada).length;
  const repetidas = junto.filter((tarefa) => tarefa.repetida).length;
  const pessoasTrocadas = junto.filter((tarefa) => tarefa.responsaveisEscolhidos && !tarefa.repetida).length;
  const resumo = [
    junto.length ? `cria junto ${plural(junto.length, "tarefa", "tarefas")}` : null,
    alteradas ? `${plural(alteradas, "data alterada", "datas alteradas")}` : null,
    pessoasTrocadas ? `${plural(pessoasTrocadas, "responsável alterado", "responsáveis alterados")}` : null,
    repetidas ? `${plural(repetidas, "Ciência repetida", "Ciências repetidas")} (o robô cancela)` : null,
    aoConcluir.length ? `ao concluir, ${aoConcluir.map((tarefa) => tarefa.nome).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Agenda em árvore, como o VIOS cria: a pedida no topo e, embaixo de cada tarefa, as que ela cria (Embargos ›
  // Revisar › Protocolar), mesmo fora da ordem das datas; a fatal por último. Numerada nessa ordem: o mesmo número
  // marca o dia no calendário. Sem data ou repetida (o robô cancela), fica sem número.
  type Item =
    | { tipo: "principal"; chave: string; data: string }
    | { tipo: "fluxo"; chave: string; data: string | null; tarefa: TarefaPrevista }
    | { tipo: "fatal"; chave: string; data: string; rotulo: string; dica: string };
  const itens: Item[] = [
    ...(principal.data ? [{ tipo: "principal" as const, chave: "principal", data: principal.data }] : []),
    ...emOrdemDeArvore(junto).map((tarefa) => ({ tipo: "fluxo" as const, chave: tarefa.caminho.join(" › "), data: tarefa.data, tarefa })),
    ...fatais.map((fatal) => ({ tipo: "fatal" as const, chave: `fatal ${fatal.rotulo}`, ...fatal })),
  ];
  const numerado = (item: Item): item is Item & { data: string } => Boolean(item.data) && !(item.tipo === "fluxo" && item.tarefa.repetida);
  const numeros = new Map<string, number>();
  for (const item of itens) if (numerado(item)) numeros.set(item.chave, numeros.size + 1);
  // Cores do VIOS: a pedida pela classe (Prazo verde, Providência azul-claro); no fluxo, Revisar amarelo, Protocolar
  // vermelho e as outras pela classe do tipo delas no VIOS (etiquetas): uma Providência criada por um Prazo fica
  // azul-claro. Sem a classe lida, vale a da lista de tarefas da área pelo nome.
  const tomDaPedida = TOM_DA_ETIQUETA[principal.etiqueta];
  const tomDoFluxo = (tarefa: TarefaPrevista) => {
    const classe = tarefa.classe ?? classeDe(tarefa.nome);
    return tomDaTarefaDoFluxo(tarefa.nome, tomDaPedida, classe ? TOM_DA_ETIQUETA[classe] : null);
  };
  const tomDe = (item: Item): TomDoMarco =>
    item.tipo === "principal" ? tomDaPedida : item.tipo === "fatal" ? "fatal" : tomDoFluxo(item.tarefa);
  const editadaDe = (item: Item) => item.tipo === "fluxo" && item.tarefa.editada;
  // Só o nome da tarefa (sem "Enviar no VIOS:"): a cor e o número já dizem que é a pedida.
  const nomeDe = (item: Item) => (item.tipo === "principal" ? principal.nome : item.tipo === "fatal" ? item.rotulo : item.tarefa.nome);
  const marcos: MarcoDoCalendario[] = itens.filter(numerado).map((item) => ({
    chave: item.chave,
    numero: numeros.get(item.chave) ?? 0,
    rotulo: nomeDe(item),
    data: item.data,
    tom: tomDe(item),
    editada: editadaDe(item),
  }));
  const tons = [...new Set(marcos.map((marco) => marco.tom))];
  const algumaEditada = marcos.some((marco) => marco.editada);

  const campoDoFluxo = (tarefa: TarefaPrevista) => (
    <CampoData
      compacto
      rotulo={`Data de ${tarefa.caminho.join(" › ")}`}
      valor={tarefa.data ?? ""}
      min={hoje}
      ehDiaUtil={ehDiaUtil}
      destacado={tarefa.editada}
      permitirVazio
      dica={tarefa.data ? undefined : "O VIOS data esta tarefa sozinho; escolha uma data só se precisar."}
      onChange={(data) => onMudarData(tarefa.caminho, data || null)}
      className="w-[8.5rem]"
    />
  );
  const extrasDoFluxo = (tarefa: TarefaPrevista) =>
    tarefa.editada ? (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {tarefa.dataVios ? <span className="text-muted-foreground">VIOS: {formatarData(tarefa.dataVios)}</span> : null}
        <button type="button" className="font-medium text-[#347796] underline-offset-4 hover:underline" onClick={() => onMudarData(tarefa.caminho, null)}>
          voltar à do VIOS
        </button>
      </span>
    ) : tarefa.ajustada ? (
      <span className="text-muted-foreground">
        {ROTULO_AJUSTE[tarefa.ajustada]}
        {tarefa.dataVios ? ` (VIOS: ${formatarData(tarefa.dataVios)})` : ""}
      </span>
    ) : tarefa.data && tarefa.dataVios && tarefa.data !== tarefa.dataVios ? (
      <span className="text-muted-foreground">acompanha a anterior (VIOS: {formatarData(tarefa.dataVios)})</span>
    ) : null;

  return (
    <details data-tour="vj-fluxo" open={aberto} onToggle={(evento) => setAberto(evento.currentTarget.open)} className="group rounded-md border border-[#e6eef0] bg-[#f7fbfc] text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-muted-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
        <Workflow className="size-3.5 shrink-0 text-[#285f7a]" aria-hidden />
        <span className="font-medium text-[#285f7a]">Fluxo das tarefas</span>
        <span className={cn("truncate", (alteradas || pessoasTrocadas) && "text-[#285f7a]")}>{resumo}</span>
      </summary>
      <div className="space-y-3 border-t border-[#e6eef0] px-3 py-3">
        {marcos.length ? (
          <CalendarioDoFluxo
            marcos={marcos}
            hoje={hoje}
            ehDiaUtil={ehDiaUtil}
            rotulo={`Calendário do fluxo de ${principal.nome}`}
            legenda={
              <>
                {tons.map((tom) => (
                  <ItemDaLegenda key={tom} tom={tom} />
                ))}
                {algumaEditada ? <ItemDaLegenda editada /> : null}
              </>
            }
          />
        ) : null}

        {itens.length ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">
              Para priorizar uma tarefa do fluxo, mude a data; para outra pessoa fazer, clique em quem fica. O robô grava no VIOS depois de
              lançar.
            </p>
            <ol className="divide-y divide-[#e6eef0] overflow-hidden rounded-md border border-[#e6eef0] bg-white">
              {itens.map((item) => (
                <li
                  key={item.chave}
                  className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5", item.tipo === "fluxo" && item.tarefa.repetida && "bg-[#fafbfb]")}
                  style={item.tipo === "fluxo" && item.tarefa.nivel > 1 ? { paddingLeft: `${0.625 + (item.tarefa.nivel - 1) * 1.25}rem` } : undefined}
                >
                  {numerado(item) ? (
                    <NumeroDoMarco numero={numeros.get(item.chave) ?? 0} tom={tomDe(item)} editada={editadaDe(item)} />
                  ) : (
                    <span className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#eef3f5] text-[10px] text-muted-foreground" aria-hidden>
                      –
                    </span>
                  )}
                  {/* Cada tarefa do fluxo fica embaixo da que a cria, recuada pelo nível e com a seta. */}
                  {item.tipo === "fluxo" ? <CornerDownRight className="size-3.5 shrink-0 text-[#9fb8c2]" aria-hidden /> : null}
                  <span
                    className={cn(
                      "min-w-0 flex-1 basis-40 font-medium",
                      item.tipo === "fatal"
                        ? "text-[#b42318]"
                        : item.tipo === "fluxo" && item.tarefa.repetida
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                    )}
                  >
                    {nomeDe(item)}
                  </span>
                  {item.tipo === "fluxo" && item.tarefa.repetida ? (
                    <span className="text-muted-foreground">repetida: o robô cancela no VIOS (Duplicidade); fica a da primeira tarefa</span>
                  ) : item.tipo === "fluxo" ? (
                    <>
                      {campoDoFluxo(item.tarefa)}
                      <ResponsaveisDoFluxo
                        tarefa={item.tarefa}
                        pessoas={pessoas}
                        onMudar={(nomes) => onMudarResponsaveis(item.tarefa.caminho, nomes)}
                      />
                      {extrasDoFluxo(item.tarefa)}
                    </>
                  ) : (
                    <>
                      <span
                        className="w-[8.5rem] text-right tabular-nums text-muted-foreground"
                        title={item.tipo === "fatal" ? item.dica : "Muda no campo de data da tarefa, acima."}
                      >
                        {diaDaAgenda(item.data)}
                      </span>
                      {item.tipo === "principal" ? <PessoasDaTarefa nomes={principal.responsaveis} foto={foto} /> : null}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {aoConcluir.length ? (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Ao concluir esta tarefa, o VIOS cria:</span>{" "}
            {aoConcluir.map((tarefa) => tarefa.nome).join(", ")} (com o responsável padrão do VIOS).
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

/**
 * Opções de Responsável e Revisor: as pessoas da área da publicação, com foto, e a lista inteira do VIOS para a
 * exceção (`ampliar`, null quando não há filtro). Quem já está escolhido vale mesmo fora da área.
 */
export interface PessoasDoCampo {
  opcoes: OpcaoBusca[];
  ampliar: { todas: OpcaoBusca[]; area: string } | null;
  foto: (nome: string) => string | null;
}

/** Responsável e Revisor: só quem é da área da publicação, com foto; a última linha da lista abre todas as pessoas. */
export function pessoasDoDetalhe(detalhe: VistagemDetalhe | null): PessoasDoCampo {
  const fotos = detalhe?.fotos ?? {};
  const filtro = detalhe?.pessoasDaArea ?? null;
  const daArea = filtro ? new Set(filtro.nomes.map(chaveNome)) : null;
  const todas = (detalhe?.catalogo?.usuarios ?? []).map((usuario): OpcaoBusca => {
    const chave = chaveNome(usuario.nome);
    // Na lista inteira, quem é de fora da área mostra a área dele ao lado do nome.
    return { ...usuario, foto: fotos[chave] ?? null, detalhe: daArea && !daArea.has(chave) ? detalhe?.areaDasPessoas?.[chave] ?? null : null };
  });
  const opcoes = daArea ? todas.filter((opcao) => daArea.has(chaveNome(opcao.nome))) : todas;
  return {
    opcoes,
    ampliar: filtro && opcoes.length < todas.length ? { todas, area: filtro.area } : null,
    foto: (nome) => fotos[chaveNome(nome)] ?? null,
  };
}

/**
 * Classe de cada tipo de tarefa na lista do VIOS da área, pelo nome original: dá a cor das tarefas do fluxo (nome que
 * aparece em mais de uma classe fica sem, e a tarefa usa a cor da pedida).
 */
export function classeNoCatalogo(catalogo: VistagemDetalhe["catalogo"] | undefined): (nome: string) => Etiqueta | null {
  const classes = new Map<string, Set<Etiqueta>>();
  for (const etiqueta of ETIQUETAS_AGENDAMENTO) {
    for (const tarefa of catalogo?.tarefas[etiqueta] ?? []) {
      const chave = chaveNome(tarefa.nomeVios ?? tarefa.nome);
      classes.set(chave, (classes.get(chave) ?? new Set<Etiqueta>()).add(etiqueta));
    }
  }
  return (nome) => {
    const daTarefa = classes.get(chaveNome(nome));
    return daTarefa?.size === 1 ? [...daTarefa][0] : null;
  };
}

/**
 * Data e/ou responsáveis de uma tarefa do Fluxo do VIOS mudados pela pessoa; null volta à data do VIOS ou à regra do
 * robô. O que não vem na mudança fica como estava.
 */
export function comMudancaNoFluxo(
  fluxoDatas: Record<string, DataDoFluxo>,
  caminho: string[],
  mudanca: { data?: string | null; responsaveis?: string[] | null }
): Record<string, DataDoFluxo> {
  const chave = chaveDoCaminho(caminho);
  const atual = fluxoDatas[chave];
  const data = (mudanca.data !== undefined ? mudanca.data : atual?.data) || null;
  const responsaveis = mudanca.responsaveis !== undefined ? mudanca.responsaveis : atual?.responsaveis ?? null;
  const novas = { ...fluxoDatas };
  if (data || responsaveis?.length) {
    novas[chave] = { caminho, ...(data ? { data } : {}), ...(responsaveis?.length ? { responsaveis } : {}) };
  } else delete novas[chave];
  return novas;
}

/** Um ou mais responsáveis; a fila do robô recebe os nomes separados por vírgula. */
export function CampoResponsaveis({
  pessoas,
  valor,
  onChange,
  rotulo,
  dica,
}: {
  pessoas: PessoasDoCampo;
  valor: string;
  onChange: (valor: string) => void;
  rotulo: string;
  dica?: string | null;
}) {
  const nomes = separarNomes(valor);
  const escolhidos = new Set(nomes.map(chaveNome));
  const livres = (lista: OpcaoBusca[]) => lista.filter((opcao) => !escolhidos.has(chaveNome(opcao.nome)));
  return (
    <div className="space-y-1.5">
      {/* Os escolhidos ficam dentro do campo: com uma pessoa, ele tem a altura do Revisor ao lado. */}
      <ComboboxBusca
        antes={
          nomes.length ? (
            <ul className="contents" aria-label={rotulo}>
              {nomes.map((nome) => (
                <li key={nome} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-[#dce9eb] bg-[#f7fbfc] pl-1 pr-0.5 text-sm text-foreground">
                  <AvatarPessoa nome={nome} foto={pessoas.foto(nome)} className="size-5" />
                  <span className="truncate">{nome}</span>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-[#47cdd0]/15 hover:text-foreground"
                    aria-label={`Tirar ${nome}`}
                    onMouseDown={(evento) => evento.preventDefault()}
                    onClick={() => onChange(nomes.filter((item) => item !== nome).join(", "))}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null
        }
        opcoes={livres(pessoas.opcoes)}
        ampliar={pessoas.ampliar ? { ...pessoas.ampliar, todas: livres(pessoas.ampliar.todas) } : null}
        pessoas
        valor=""
        onChange={(nome) => nome && onChange([...nomes, nome].join(", "))}
        placeholder={nomes.length ? "Adicionar outro…" : "Digite para buscar…"}
        rotulo={nomes.length ? `Adicionar responsável à ${rotulo.toLowerCase()}` : rotulo}
        invalido={!nomes.length}
      />
      {dica ? <span className="block text-xs text-muted-foreground">{dica}</span> : null}
    </div>
  );
}

/** Vistagem de uma publicação: leitura ao lado e tarefas para o VIOS. Usada na fila do Jurídico e na Controladoria ("Agendar aqui"). */
export function EditorVistagem({
  id,
  navegacao,
  onAbrir,
  onConcluida,
  onTransferida,
  onVoltar,
  resolucao = null,
  antesDasTarefas = null,
  fila = null,
}: {
  id: string;
  navegacao: Navegacao | null;
  onAbrir: (id: string) => void;
  /** `central`: a publicação não tem pasta e virou pedido de abertura na Central do SharePoint. */
  onConcluida: (id: string, central: ResultadoCentral | null) => void;
  onTransferida: (destino: string) => void;
  onVoltar: () => void;
  /** "Agendar Direto" da controladoria: a pendência ainda na triagem, com escritório, grupo, risco e CI escolhidos. */
  resolucao?: ResolucaoPendencia | null;
  /** Bloco no topo da coluna das tarefas (na controladoria: escritório, grupo e risco da pendência). */
  antesDasTarefas?: ReactNode;
  /** Botão de mostrar/recolher a fila, à esquerda do número do processo (só no desktop: no celular há "Voltar à lista"). */
  fila?: { aberta: boolean; onAlternar: () => void } | null;
}) {
  // A lista de tarefas depende do escritório e da pasta: na prévia eles vão na consulta.
  const consultaPrevia = resolucao?.escritorio
    ? `?${new URLSearchParams({ escritorio: resolucao.escritorio, ...(resolucao.ci ? { ci: resolucao.ci } : {}) })}`
    : "";
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
    authFetch(`/api/operacoes-legais/vistagem/juridico/${id}${consultaPrevia}`)
      .then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar a publicação.");
        if (cancelado) return;
        const dados = corpo as VistagemDetalhe;
        setDetalhe(dados);
        const classificacao = classificacaoEsocial(dados.publicacao.publicacaoEsocial) ?? ESOCIAL_PADRAO;
        const tarefaEsocialId = dados.esocial?.tarefa && pedeTarefaEsocial(classificacao) ? dados.esocial.tarefa.id : null;
        setEsocial(classificacao);
        const contagemInicial = contagemPadraoDaPublicacao(dados.publicacao.escritorioResponsavel ?? dados.catalogo?.area, dados.publicacao.etiquetas);
        setLinhas(
          dados.agendamentos.length
            ? dados.agendamentos.map((item) => {
                const semPrazo = item.etiqueta === "PRAZO" && semPrazoProprio(dados.fluxos[item.tarefaId ?? ""]);
                return novaLinha({
                  etiqueta: item.etiqueta,
                  // a lista mostra o tipo junto quando o VIOS tem dois com o mesmo nome
                  tarefa: dados.catalogo?.tarefas[item.etiqueta].find((opcao) => opcao.id === item.tarefaId)?.nome ?? item.tarefa,
                  data: item.etiqueta === "PRAZO" && !semPrazo ? "" : item.data,
                  dataFatal: semPrazo ? "" : item.dataFatal ?? "",
                  diasPrazo: semPrazo ? null : item.diasPrazo,
                  origemPrazo: semPrazo ? null : item.origemPrazo ?? null,
                  contagemPrazo: item.contagemPrazo ?? contagemInicial,
                  hora: item.hora ?? "",
                  horaFim: item.horaFim ?? horaFinalPadrao(item.hora),
                  dataLimite: item.dataLimite && item.dataLimite !== item.data ? item.dataLimite : "",
                  responsavel: item.responsavel,
                  revisor: item.etiqueta === "PROVIDENCIA" ? "" : item.revisor ?? "",
                  observacao: item.observacao ?? "",
                  esocial: tarefaEsocialId !== null && item.tarefaId === tarefaEsocialId,
                  fluxoDatas: Object.fromEntries(item.fluxoDatas.map((datada) => [chaveDoCaminho(datada.caminho), datada])),
                });
              })
            : [novaLinha({ responsavel: dados.responsavelSugerido ?? "", revisor: dados.revisorSugerido ?? "", contagemPrazo: contagemInicial })]
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
  }, [id, recarga, consultaPrevia]);

  const ehDiaUtil = useMemo(() => criarCalendario(detalhe?.feriados ?? []), [detalhe?.feriados]);
  // A fatal conta só dias úteis fora do recesso forense; Enviar/Revisar/Protocolar seguem o expediente.
  const contaPrazo = useMemo(() => criarCalendarioDePrazo(detalhe?.feriados ?? []), [detalhe?.feriados]);
  /**
   * Uma Ciência dos Agendamentos só por vistagem: fica a da primeira tarefa incluída (ela mesma, ou a mais perto dela
   * no fluxo do VIOS); as outras o robô cancela no VIOS depois de lançar (tipo Duplicidade).
   */
  const cienciaFica = useMemo(() => {
    const catalogo = detalhe?.catalogo;
    if (!detalhe || !catalogo) return null;
    return cienciaQueFica(
      linhas
        .filter((linha) => linha.tarefa)
        .map((linha) => {
          const opcao = catalogo.tarefas[linha.etiqueta].find((item) => item.nome === linha.tarefa);
          return { chave: linha.chave, nome: opcao?.nomeVios ?? linha.tarefa, fluxo: opcao ? detalhe.fluxos[opcao.id] ?? null : null };
        })
    );
  }, [detalhe, linhas]);
  const cienciaFicaEm = (chave: number, caminho: string[] | null) =>
    !cienciaFica ||
    (cienciaFica.chave === chave &&
      (caminho === null ? cienciaFica.caminho === null : cienciaFica.caminho !== null && chaveDoCaminho(cienciaFica.caminho) === chaveDoCaminho(caminho)));
  /** Úteis ou Corridos já marcado no Prazo: Corridos na Insolvência e nas pastas RC-Insolvência, Úteis nas outras. */
  const contagemPadrao = contagemPadraoDaPublicacao(detalhe?.publicacao.escritorioResponsavel ?? detalhe?.catalogo?.area, detalhe?.publicacao.etiquetas);
  /** Área da publicação: nas audiências do Trabalhista o revisor fica na tarefa (`revisorFicaNaTarefa`). */
  const areaDaPublicacao = detalhe?.publicacao.escritorioResponsavel ?? detalhe?.catalogo?.area ?? null;
  const pessoasDoCampo = useMemo(() => pessoasDoDetalhe(detalhe), [detalhe]);
  const classeDaTarefa = useMemo(() => classeNoCatalogo(detalhe?.catalogo), [detalhe?.catalogo]);

  /** Tarefa de Prazo sem prazo próprio no VIOS (a SENTENÇA): não pede fatal, e as do fluxo contam da data dela. */
  function semFatal(linha: Pick<Linha, "etiqueta" | "tarefa">): boolean {
    if (linha.etiqueta !== "PRAZO" || !detalhe?.catalogo) return false;
    const id = detalhe.catalogo.tarefas.PRAZO.find((opcao) => opcao.nome === linha.tarefa)?.id;
    return Boolean(id && semPrazoProprio(detalhe.fluxos[id]));
  }

  /** O tipo pede Observação (CIÊNCIA NF), pelo nome como está no VIOS: a lista pode mostrar "(tipo 316)" no fim. */
  function pedeObservacao(linha: Pick<Linha, "etiqueta" | "tarefa">): boolean {
    const opcao = detalhe?.catalogo?.tarefas[linha.etiqueta].find((item) => item.nome === linha.tarefa);
    return observacaoObrigatoria(opcao ? opcao.nomeVios ?? opcao.nome : linha.tarefa);
  }

  /** O tipo tem data limite própria (SESSÃO DE JULGAMENTO), pelo nome como está no VIOS. */
  function pedeLimite(linha: Pick<Linha, "etiqueta" | "tarefa">): boolean {
    const opcao = detalhe?.catalogo?.tarefas[linha.etiqueta].find((item) => item.nome === linha.tarefa);
    return pedeDataLimite(opcao ? opcao.nomeVios ?? opcao.nome : linha.tarefa);
  }

  function linhaPronta(linha: Linha): boolean {
    return linhaCompleta(linha, semFatal(linha), pedeObservacao(linha), pedeLimite(linha));
  }

  function dataSemFatal(): string {
    return detalhe ? dataDaTarefaSemPrazo(detalhe.publicacao.dataPublicacao, detalhe.hoje, ehDiaUtil) : "";
  }

  function alterar(chave: number, mudanca: Partial<Linha>) {
    setLinhas((atuais) =>
      atuais.map((linha) => {
        if (linha.chave !== chave) return linha;
        // Outro tipo de tarefa tem outro fluxo: as datas mudadas no fluxo anterior não valem mais.
        const outroTipo = (mudanca.tarefa !== undefined && mudanca.tarefa !== linha.tarefa) || (mudanca.etiqueta !== undefined && mudanca.etiqueta !== linha.etiqueta);
        // A hora final acompanha a inicial (1 hora depois) enquanto a pessoa não mudar a final.
        const horaFimAcompanha =
          mudanca.hora !== undefined && mudanca.horaFim === undefined && (!linha.horaFim || linha.horaFim === horaFinalPadrao(linha.hora))
            ? { horaFim: horaFinalPadrao(mudanca.hora) }
            : {};
        // A data limite igual à data acompanha a data; a escolhida pela pessoa fica.
        const limiteAcompanha = mudanca.data !== undefined && mudanca.dataLimite === undefined && linha.dataLimite === linha.data ? { dataLimite: "" } : {};
        return { ...linha, ...mudanca, ...horaFimAcompanha, ...limiteAcompanha, ...(outroTipo && !mudanca.fluxoDatas ? { fluxoDatas: {} } : {}) };
      })
    );
  }

  function mudarNoFluxo(linha: Linha, caminho: string[], mudanca: { data?: string | null; responsaveis?: string[] | null }) {
    alterar(linha.chave, { fluxoDatas: comMudancaNoFluxo(linha.fluxoDatas, caminho, mudanca) });
  }

  /** Mais uma tarefa, já com o responsável e o revisor sugeridos da pasta (no topo e no fim da lista). */
  function adicionarTarefa() {
    setLinhas((atuais) =>
      atuais.length >= 10
        ? atuais
        : [...atuais, novaLinha({ responsavel: detalhe?.responsavelSugerido ?? "", revisor: detalhe?.revisorSugerido ?? "", contagemPrazo: contagemPadrao })]
    );
  }

  /**
   * Ao escolher a tarefa de Prazo, já marca os dias do prazo legal do recurso (Apelação 15, Recurso Ordinário
   * trabalhista 8…). Não passa por cima de dias escolhidos à mão, lidos da publicação ou de uma fatal digitada; só troca
   * os que vieram da tarefa anterior. A SENTENÇA não tem prazo próprio: já vem com a data dela, sem dias nem fatal.
   */
  function diasDaTarefa(linha: Linha, nome: string): Partial<Linha> {
    const dataPublicacao = detalhe?.publicacao.dataPublicacao;
    const catalogo = detalhe?.catalogo;
    if (linha.etiqueta !== "PRAZO") return {};
    if (semFatal({ etiqueta: "PRAZO", tarefa: nome })) return { data: dataSemFatal(), dataFatal: "", diasPrazo: null, origemPrazo: null };
    const saindo = semFatal(linha) ? { data: "" } : {};
    if (!dataPublicacao || !catalogo) return saindo;
    const legal = (nomeTarefa: string) => {
      const opcao = nomeTarefa ? catalogo.tarefas.PRAZO.find((item) => item.nome === nomeTarefa) : undefined;
      return opcao ? prazoLegalDaTarefa(opcao.nomeVios ?? opcao.nome, catalogo.area) : null;
    };
    const novo = legal(nome);
    const anterior = legal(linha.tarefa);
    const vazio = linha.diasPrazo === null && !linha.dataFatal;
    const daTarefaAnterior = anterior !== null && linha.diasPrazo === anterior;
    if (!vazio && !daTarefaAnterior) return saindo;
    if (novo === null) return daTarefaAnterior ? { ...saindo, diasPrazo: null, dataFatal: "", origemPrazo: null } : saindo;
    const contagemPrazo = linha.contagemPrazo ?? contagemPadrao;
    return { ...saindo, diasPrazo: novo, contagemPrazo, dataFatal: fatalPorContagem(dataPublicacao, novo, contagemPrazo, contaPrazo), origemPrazo: "tarefa" };
  }

  /** Data que o tipo já traz (CIÊNCIA NF: dia útil seguinte), pelo nome como está no VIOS. */
  function dataPadrao(etiqueta: Etiqueta, tarefa: string): string | null {
    if (!detalhe || !tarefa || etiqueta === "PRAZO") return null;
    const opcao = detalhe.catalogo?.tarefas[etiqueta].find((item) => item.nome === tarefa);
    return dataPadraoDaTarefa(opcao ? opcao.nomeVios ?? opcao.nome : tarefa, detalhe.hoje, ehDiaUtil);
  }

  /**
   * Ao escolher a tarefa, já põe a data que o tipo traz (CIÊNCIA NF: dia útil seguinte, pedido de 11/11/2026). Não passa
   * por cima de data escolhida à mão; só troca a que veio do tipo anterior, e a tira ao trocar para um tipo sem data.
   */
  function dataDoTipo(linha: Linha, nome: string): Partial<Linha> {
    const anterior = dataPadrao(linha.etiqueta, linha.tarefa);
    const veioDoTipo = anterior !== null && linha.data === anterior;
    if (linha.data && !veioDoTipo) return {};
    const nova = dataPadrao(linha.etiqueta, nome);
    if (nova) return { data: nova };
    return veioDoTipo ? { data: "" } : {};
  }

  function trocarEtiqueta(linha: Linha, etiqueta: Etiqueta) {
    // No Prazo o revisor é obrigatório: sugere o auxiliar da pasta se ainda estiver vazio. Providência não tem revisor.
    alterar(linha.chave, {
      etiqueta,
      tarefa: "",
      ...(semFatal(linha) ? { data: "" } : dataDoTipo(linha, "")),
      revisor:
        etiqueta === "PROVIDENCIA" ? "" : etiqueta === "PRAZO" && !linha.revisor ? detalhe?.revisorSugerido ?? "" : linha.revisor,
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
    // Tipo recriado no VIOS depois da sugestão (CIÊNCIA NF 316 → 796): vale o de mesmo nome da lista atual.
    const sugeridas = sugestaoNaListaAtual(sugestao, catalogo.tarefas).tarefas.flatMap((tarefa) => {
      const opcao = catalogo.tarefas[tarefa.classe].find((item) => item.id === tarefa.tarefaId);
      if (!opcao) return [];
      const prazo = tarefa.classe === "PRAZO";
      const semPrazo = semFatal({ etiqueta: tarefa.classe, tarefa: opcao.nome });
      return [
        novaLinha({
          etiqueta: tarefa.classe,
          tarefa: opcao.nome,
          dataFatal: prazo && !semPrazo ? fatalSugerida(tarefa, publicacao.dataPublicacao, contaPrazo) ?? "" : "",
          diasPrazo: prazo && !semPrazo ? tarefa.dias : null,
          contagemPrazo: prazo && !semPrazo && tarefa.dias ? tarefa.contagem : null,
          origemPrazo: prazo && !semPrazo ? "sugestao_ia" : null,
          data: semPrazo ? dataSemFatal() : tarefa.classe === "COMPROMISSO" ? tarefa.data ?? "" : dataPadrao(tarefa.classe, opcao.nome) ?? "",
          hora: tarefa.hora ?? "",
          horaFim: horaFinalPadrao(tarefa.hora),
          dataLimite: "",
          responsavel: opcao.responsaveis?.length ? opcao.responsaveis.join(", ") : detalhe.responsavelSugerido ?? "",
          revisor: prazo || revisorFicaNaTarefa(opcao.nome, areaDaPublicacao) ? detalhe.revisorSugerido ?? "" : "",
          observacao: tarefa.motivo,
          ia: true,
        }),
      ];
    });
    if (!sugeridas.length) {
      // Antes não acontecia nada: avisa e deixa a pessoa escolher à mão.
      setErro("Nenhuma tarefa da sugestão está na lista atual do VIOS desta pasta. Escolha as tarefas à mão.");
      return;
    }
    setErro("");
    const classificacao = detalhe.esocial ? sugestao.esocial : esocial;
    setAntesDaSugestao({ linhas, esocial });
    setEsocial(classificacao);
    setLinhas(detalhe.esocial ? linhasComEsocial(sugeridas, classificacao) : sugeridas);
    setEstadoSugestao("usada");
  }

  /** "Usar N dias" no leitor: põe o prazo citado na primeira tarefa de Prazo (ou cria uma). */
  function usarDias(dias: number, contagem: ContagemPrazo | null) {
    const dataPublicacao = detalhe?.publicacao.dataPublicacao;
    if (!dataPublicacao) return;
    setLinhas((atuais) => {
      const alvo = atuais.find((linha) => linha.etiqueta === "PRAZO" && !linha.esocial && !semFatal(linha));
      const contagemPrazo = contagem ?? alvo?.contagemPrazo ?? contagemPadrao;
      const mudanca = { diasPrazo: dias, contagemPrazo, dataFatal: fatalPorContagem(dataPublicacao, dias, contagemPrazo, contaPrazo), origemPrazo: "publicacao" as const };
      if (alvo) return atuais.map((linha) => (linha === alvo ? { ...linha, ...mudanca } : linha));
      if (atuais.length >= 10) return atuais;
      return [...atuais, novaLinha({ ...mudanca, responsavel: detalhe?.responsavelSugerido ?? "", revisor: detalhe?.revisorSugerido ?? "" })];
    });
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
          resolucao,
          agendamentos: linhas.map((linha) => ({
            etiqueta: linha.etiqueta,
            tarefa: linha.tarefa,
            tarefaId: detalhe?.catalogo?.tarefas[linha.etiqueta].find((opcao) => opcao.nome === linha.tarefa)?.id ?? null,
            data: linha.etiqueta === "PRAZO" && !semFatal(linha) ? "" : linha.data,
            dataFatal: linha.etiqueta === "PRAZO" && !semFatal(linha) ? linha.dataFatal : null,
            diasPrazo: linha.etiqueta === "PRAZO" && !semFatal(linha) ? linha.diasPrazo : null,
            contagemPrazo: linha.etiqueta === "PRAZO" && !semFatal(linha) && linha.diasPrazo ? linha.contagemPrazo : null,
            origemPrazo: linha.etiqueta === "PRAZO" && !semFatal(linha) ? linha.origemPrazo : null,
            hora: linha.etiqueta === "COMPROMISSO" ? linha.hora : null,
            horaFim: linha.etiqueta === "COMPROMISSO" ? linha.horaFim || null : null,
            dataLimite: pedeLimite(linha) ? linha.dataLimite || linha.data || null : null,
            responsavel: linha.responsavel,
            revisor: linha.etiqueta === "PROVIDENCIA" ? null : linha.revisor || null,
            observacao: linha.observacao || null,
            fluxoDatas: Object.values(linha.fluxoDatas),
          })),
        }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao enviar.");
      onConcluida(id, corpo.central ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  if (!detalhe) {
    // O bloco de cima continua visível: na controladoria, trocar o escritório resolve uma área sem lista de tarefas.
    return (
      <div className="space-y-3">
        {antesDasTarefas}
        {erro ? (
          <Aviso tom="erro">{erro}</Aviso>
        ) : (
          <Painel className={cn(fila?.aberta && "lg:rounded-l-none lg:border-l-0")}>
            <Carregando rotulo="Carregando a publicação" />
          </Painel>
        )}
      </div>
    );
  }

  const { publicacao, catalogo } = detalhe;
  // Sem pasta no VIOS: passa pela conferência e, validada, vira pedido de abertura de pasta na Central do SharePoint.
  const abertura = vaiParaCentral(publicacao);
  // Sem o tipo Inserir E-social no VIOS, Acordo homologado e Homologação de cálculo não podem ser enviados.
  const faltaTarefaEsocial = Boolean(detalhe.esocial && pedeTarefaEsocial(esocial) && !detalhe.esocial.tarefa);
  const completo = linhas.every(linhaPronta) && !faltaTarefaEsocial;
  const incompletas = linhas.filter((linha) => !linhaPronta(linha)).length;
  const faltaObservacao = linhas.some((linha) => pedeObservacao(linha) && !linha.observacao.trim());
  const devolucoes = detalhe.inconsistencias.filter((item) => item.origem === "juridico");
  // Régua da publicação: divulgação → publicação → 1º dia do prazo e, quando já há Prazo, a fatal mais próxima.
  const fatais = linhas.flatMap((linha) => (linha.etiqueta === "PRAZO" && linha.dataFatal ? [linha.dataFatal] : [])).sort();
  const marcosDaPublicacao = [
    { rotulo: "Divulgação", data: publicacao.dataDivulgacao, dica: "Disponibilização no diário." },
    {
      rotulo: "Publicação",
      data: publicacao.dataPublicacao,
      tom: "marca" as const,
      dica: "Considera-se publicada no 1º dia útil após a disponibilização.",
    },
    {
      rotulo: "Início do prazo",
      data: publicacao.dataPublicacao ? somarDiasUteis(publicacao.dataPublicacao, 1, contaPrazo) : null,
      dica: "1º dia útil após a publicação: os dias do prazo contam a partir daqui.",
    },
    { rotulo: fatais.length > 1 ? "1ª fatal" : "Fatal", data: fatais[0] ?? null, tom: "perigo" as const },
  ];

  return (
    // Com espaço (fila recolhida ou tela larga), publicação e vistagem ficam lado a lado e rolam cada uma no seu lugar.
    <div className="@container h-full">
      <div className="grid gap-4 @4xl:h-full @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-3 @4xl:h-full">
          <Button variant="ghost" size="sm" className="self-start lg:hidden" onClick={onVoltar}>
            <ArrowLeft />
            Voltar à lista
          </Button>

          {publicacao.status === "juridico_vistar" && reabertaParaAlterar({ reabertaEm: publicacao.reabertaEm ?? null, devolvidoEm: publicacao.devolvidoEm }) ? (
            <Aviso tom="info" titulo={`Vistagem reaberta para alterar em ${formatarDataHora(publicacao.reabertaEm ?? null)}`}>
              As tarefas estão como foram vistadas. Altere o que precisar e vista de novo: a publicação volta para a Conferência.
            </Aviso>
          ) : null}

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

          <Painel
            aria-labelledby="publicacao-titulo"
            data-tour="vj-publicacao"
            // Com a fila aberta ao lado, o painel encosta nela: uma borda só entre os dois, sem o canto arredondado.
            className={cn("flex min-h-0 flex-col @4xl:flex-1", fila?.aberta && "lg:rounded-l-none lg:border-l-0")}
          >
            {/* Faixa azul-marinho: o processo aberto fica marcado no topo da coluna. */}
            <FaixaDoProcesso
              numero={publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}
              tribunal={publicacao.tribunal}
              tituloId="publicacao-titulo"
              risco={Boolean(publicacao.demandaRisco)}
              // O selo "Demanda de risco" já está na ficha da pasta, logo abaixo; a faixa fica só vermelha.
              seloDeRisco={false}
              antes={
                fila ? (
                  // Só no desktop: no celular a lista abre por "Voltar à lista".
                  <div className="-ml-1.5 hidden items-center border-r border-white/20 pr-2 lg:flex">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className={NA_FAIXA}
                      aria-pressed={fila.aberta}
                      onClick={fila.onAlternar}
                      aria-label={fila.aberta ? "Recolher a fila" : "Mostrar a fila"}
                      title={fila.aberta ? "Recolher a fila" : "Mostrar a fila"}
                    >
                      {fila.aberta ? <PanelLeftClose /> : <PanelLeftOpen />}
                    </Button>
                  </div>
                ) : null
              }
            >
              {/* Só nas transferidas de outra área: o que aconteceu com a publicação antes de chegar a esta. */}
              {publicacao.transferidoDe && !resolucao ? (
                <BotaoHistorico
                  publicacaoId={publicacao.id}
                  processo={publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}
                  className={cn(BOTAO_FAIXA, navegacao && "mr-1")}
                />
              ) : null}
              {navegacao ? (
                <>
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
                  <span className="min-w-14 text-center text-xs tabular-nums text-white/75">
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
                </>
              ) : null}
            </FaixaDoProcesso>
            {/* Ficha, datas e texto rolam juntos: o espaço da coluna fica para a leitura. Sem a altura fixa do
                desktop (tela menor ou zoom do navegador), param em 75% da tela, como na conferência. */}
            <div className="min-h-0 flex-1 overflow-y-auto max-lg:max-h-[75dvh]">
              <div className="space-y-4 px-4 py-3">
                <FichaPasta
                  publicacao={publicacao}
                  auxiliar={detalhe.revisorSugerido}
                  fotos={detalhe.fotos}
                  acao={
                    // Na prévia da controladoria a área é escolhida no topo do modal.
                    resolucao ? undefined : (
                      <Button type="button" variant="outline" size="sm" onClick={() => setTransferindo(true)} title="A área ou a pasta não é desta fila">
                        <ArrowRightLeft />
                        Transferir área
                      </Button>
                    )
                  }
                  resumo={<ResumoDaFicha publicacao={publicacao} auxiliar={detalhe.revisorSugerido} fotos={detalhe.fotos} />}
                  // A síntese já começa curta e fica à vista com a ficha aberta ou recolhida.
                  extra={
                    publicacao.pastaCi ? (
                      <SinteseDoProcesso
                        key={publicacao.id}
                        sintese={detalhe.sintese}
                        erro={detalhe.sinteseErro}
                        pedidas={detalhe.sintesesPedidas}
                        materiaVazia={detalhe.materiaVazia}
                        materiaAtual={detalhe.materiaAtual}
                        materias={detalhe.materiasVios}
                        sistemaVazio={detalhe.sistemaVazio}
                        sistemaAtual={detalhe.sistemaAtual}
                        sistemas={detalhe.sistemasVios}
                        // Na prévia da controladoria a pasta ainda não está gravada: a síntese fica só para leitura.
                        publicacaoId={resolucao ? null : publicacao.id}
                      />
                    ) : null
                  }
                >
                  <FichaProcesso publicacao={publicacao} />
                </FichaPasta>
                <ReguaDatas rotulo="Datas da publicação" hoje={detalhe.hoje} marcos={marcosDaPublicacao} />
              </div>
              <div data-tour="vj-leitura">
                <LeitorPublicacao publicacao={publicacao} partesNoCabecalho onUsarDias={catalogo && publicacao.dataPublicacao ? usarDias : undefined} />
              </div>
            </div>
          </Painel>
        </div>

        <div className="min-h-0 space-y-3 @4xl:h-full @4xl:overflow-y-auto @4xl:pr-1">
          {antesDasTarefas}
          {estadoSugestao && catalogo ? (
            <div data-tour="vj-sugestao-ia">
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
            </div>
          ) : null}

          {/* sem overflow-hidden: o rodapé com o botão de enviar fica preso no fim da coluna */}
          <Painel aria-labelledby="tarefas-titulo" className="overflow-visible" data-tour="vj-tarefas-painel">
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
                {/* Cabeçalho do bloco: o que é, quantas tarefas vão, o eSocial (Trabalhista) e o botão de incluir outra. */}
                <div className="space-y-3 rounded-t-lg border-b border-[#e6eef0] bg-[#fafcfc] px-4 py-3" data-tour="vj-tarefas">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e8f8f8] text-[#285f7a] ring-1 ring-[#47cdd0]/30" aria-hidden>
                      <ListPlus className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 id="tarefas-titulo" className="text-sm font-semibold text-foreground">
                        Incluir tarefas
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {plural(linhas.length, "tarefa", "tarefas")} · vão para a conferência da controladoria e depois para o VIOS
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={adicionarTarefa} disabled={linhas.length >= 10}>
                      <Plus />
                      Adicionar tarefa
                    </Button>
                  </div>
                  {detalhe.esocial ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-[#e6eef0] bg-white px-3 py-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-[#285f7a]">
                        <FileCheck2 className="size-3.5" aria-hidden />
                        Publicação eSocial
                      </span>
                      <Seletor
                        rotulo="Classificação eSocial"
                        className="min-w-0 flex-1 sm:max-w-72"
                        valor={esocial}
                        onChange={(valor) => trocarEsocial(valor as ClassificacaoEsocial)}
                        opcoes={CLASSIFICACOES_ESOCIAL.map((classificacao) => ({
                          valor: classificacao,
                          rotulo: classificacao,
                          descricao: classificacao === "Não Identificado" ? "Sem tarefa de eSocial" : `Inclui a tarefa ${TAREFA_ESOCIAL}`,
                          icone: <IconeOpcao icone={classificacao === "Não Identificado" ? CircleHelp : FileCheck2} />,
                        }))}
                      />
                    </div>
                  ) : null}
                  {faltaTarefaEsocial ? (
                    <Aviso tom="erro">
                      {esocial} pede a tarefa {TAREFA_ESOCIAL}, mas esse tipo de tarefa não está na lista do VIOS para Trabalhista. Avise a controladoria.
                    </Aviso>
                  ) : null}
                </div>

                {/* Cada tarefa num cartão próprio, sobre o fundo da coluna: fica claro onde uma termina e a outra começa. */}
                <ol className="space-y-3 bg-[#f2f6f7] p-3">
                  {linhas.map((linha, indice) => {
                    const prazo = linha.etiqueta === "PRAZO";
                    const tarefaId = catalogo.tarefas[linha.etiqueta].find((opcao) => opcao.nome === linha.tarefa)?.id ?? null;
                    // Regra da insolvência: só antecipa o Enviar com prazo marcado de 10 dias ou mais (como o servidor ao gravar).
                    const fluxo = tarefaId
                      ? fluxoDoPrazo(
                          detalhe.fluxos[tarefaId] ?? null,
                          { dataFatal: linha.dataFatal || null, diasPrazo: linha.diasPrazo },
                          { dataPublicacao: detalhe.publicacao.dataPublicacao, contagem: contagemPadrao, ehDiaDePrazo: contaPrazo }
                        )
                      : null;
                    // Prazo com fatal; a SENTENÇA é de Prazo (exige revisor), mas leva só a data dela.
                    const comFatal = prazo && !semFatal(linha);
                    // Sem tarefa escolhida (ou sem o fluxo carregado) mostra o fluxo padrão; o servidor recalcula ao gravar.
                    const cadeiaFluxo = !tarefaId || detalhe.fluxosErro ? CADEIA_PADRAO : cadeiaDoFluxo(fluxo);
                    // Nunca antes de hoje: prazo curto aperta a cadeia (Enviar hoje, Protocolar 1 dia útil antes da fatal).
                    const cadeia = comFatal && linha.dataFatal ? datasDoPrazo(linha.dataFatal, ehDiaUtil, cadeiaFluxo, detalhe.hoje) : null;
                    // O VIOS data o fluxo a partir da data que recebe (no Prazo, o Enviar) e do dia do lançamento.
                    const previstas = fluxo
                      ? fluxoPrevisto(
                          { data: (comFatal ? cadeia?.enviar : linha.data) ?? "", responsavel: linha.responsavel, revisor: linha.revisor || null },
                          fluxo,
                          ehDiaUtil,
                          {
                            hoje: detalhe.hoje,
                            datas: Object.values(linha.fluxoDatas),
                            // Regra da insolvência: o VIOS cria o Protocolar 2 dias depois do Enviar antecipado; ele fica 1 dia útil antes da fatal.
                            apertada: cadeia?.ajustada
                              ? { revisar: cadeia.revisar, protocolar: cadeia.protocolar }
                              : cadeia && cadeiaFluxo?.antecipada
                                ? { revisar: null, protocolar: cadeia.protocolar, motivo: "antecipada" }
                                : null,
                          }
                        ).map((tarefa) =>
                          // Uma Ciência só por vistagem: fica a da primeira tarefa; as outras o robô cancela.
                          tarefa.quando === "criacao" && ehCienciaDosAgendamentos(tarefa.nome) && !cienciaFicaEm(linha.chave, tarefa.caminho)
                            ? { ...tarefa, repetida: true }
                            : tarefa
                        )
                      : [];
                    const cienciaPedidaRepetida = ehCienciaDosAgendamentos(linha.tarefa) && !cienciaFicaEm(linha.chave, null);
                    const avisos = comFatal
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
                    const IconeClasse = ICONE_CLASSE[linha.etiqueta];
                    const pronta = linhaPronta(linha);
                    const observacaoPedida = pedeObservacao(linha);
                    const limitePedido = pedeLimite(linha);
                    return (
                      <li
                        key={linha.chave}
                        data-tour={indice === 0 ? "vj-tarefa" : undefined}
                        aria-label={`Tarefa ${indice + 1} de ${linhas.length}`}
                        className="overflow-hidden rounded-lg border border-[#d3e2e6] bg-white shadow-[0_1px_3px_rgba(16,41,58,0.08)]"
                      >
                        {/* Topo do cartão: classe com ícone, "Tarefa 1 de 2", o nome escolhido e se já está pronta. */}
                        <header className="flex items-center gap-3 border-b border-[#eef3f5] bg-[#fafcfc] px-4 py-2.5">
                          <span className={cn("grid size-9 shrink-0 place-items-center rounded-md ring-1", ESTILO_CLASSE[linha.etiqueta])} aria-hidden>
                            <IconeClasse className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tabular-nums text-[#285f7a]">
                              Tarefa {indice + 1} de {linhas.length} · {ROTULO_ETIQUETA[linha.etiqueta]}
                            </p>
                            <p className={cn("truncate text-sm font-semibold", linha.tarefa ? "text-foreground" : "font-normal text-muted-foreground")}>
                              {linha.tarefa || "Escolha a tarefa"}
                            </p>
                          </div>
                          {linha.ia ? <SeloIa /> : null}
                          {pronta ? (
                            <Selo tom="sucesso" icone={CircleCheck}>
                              Pronta
                            </Selo>
                          ) : (
                            <Selo tom="alerta">Falta preencher</Selo>
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
                        </header>

                        <div className="space-y-4 px-4 py-4">
                          <BlocoTarefa titulo="O que" icone={ClipboardList}>
                            {/* A classe fica à esquerda, na mesma linha da tarefa. */}
                            <div className="flex flex-wrap items-center gap-2">
                              {linha.esocial ? (
                                <Selo tom="marca">eSocial</Selo>
                              ) : (
                                <Segmented
                                  label={`Classe da tarefa ${indice + 1}`}
                                  value={linha.etiqueta}
                                  options={ETIQUETAS_AGENDAMENTO.map((valor) => ({ value: valor, label: ROTULO_ETIQUETA[valor], icon: ICONE_CLASSE[valor] }))}
                                  onChange={(valor) => trocarEtiqueta(linha, valor)}
                                />
                              )}
                              <div className="min-w-[14rem] flex-1">
                                {linha.esocial ? (
                                  <p className={cn(campo, "flex items-center bg-[#f7fbfc] text-foreground")} aria-label={`Tarefa ${indice + 1}`}>
                                    {linha.tarefa}
                                  </p>
                                ) : (
                                  <ComboboxBusca
                                    titulo={`Tarefas de ${ROTULO_ETIQUETA[linha.etiqueta]} no VIOS`}
                                    icone={<IconeClasse className="size-4 text-[#3e84a8]" aria-hidden />}
                                    opcoes={catalogo.tarefas[linha.etiqueta]}
                                    valor={linha.tarefa}
                                    onChange={(nome) => {
                                      const lista = catalogo.tarefas[linha.etiqueta];
                                      const fixos = lista.find((item) => item.nome === nome)?.responsaveis ?? [];
                                      const anteriores = lista.find((item) => item.nome === linha.tarefa)?.responsaveis ?? [];
                                      const eraDoTipo = anteriores.length > 0 && linha.responsavel === anteriores.join(", ");
                                      alterar(linha.chave, {
                                        tarefa: nome,
                                        ...diasDaTarefa(linha, nome),
                                        ...dataDoTipo(linha, nome),
                                        ...(fixos.length
                                          ? { responsavel: fixos.join(", ") }
                                          : eraDoTipo
                                            ? { responsavel: detalhe.responsavelSugerido ?? "" }
                                            : {}),
                                        ...(revisorFicaNaTarefa(nome, areaDaPublicacao) && !linha.revisor ? { revisor: detalhe.revisorSugerido ?? "" } : {}),
                                      });
                                      if (nome && linha.etiqueta === "COMPROMISSO") setHorarioDe(linha.chave);
                                    }}
                                    placeholder="Tarefa: digite para buscar…"
                                    rotulo={`Tarefa ${indice + 1}`}
                                  />
                                )}
                              </div>
                            </div>
                          </BlocoTarefa>

                          <BlocoTarefa titulo={comFatal ? "Prazo" : linha.etiqueta === "COMPROMISSO" ? "Data e horário" : "Data"} icone={CalendarDays}>
                            {comFatal ? (
                              <div className="space-y-2">
                                {/* 1ª linha: os dias do prazo e, ao lado, úteis ou corridos e a data fatal; embaixo, a linha do tempo do VIOS. */}
                                <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                                  <div className="space-y-1.5">
                                  <span className="block text-xs font-medium text-muted-foreground">Dias</span>
                                  <div className="flex flex-wrap items-center gap-0.5" role="group" aria-label={`Prazo em dias da tarefa ${indice + 1}`}>
                                    {atalhosDePrazo(catalogo.area).map((dias) => (
                                      <Button
                                        key={dias}
                                        type="button"
                                        size="xs"
                                        variant="outline"
                                        aria-pressed={linha.diasPrazo === dias}
                                        disabled={!publicacao.dataPublicacao}
                                        title={linha.diasPrazo === dias ? "Clique de novo para tirar os dias e a data fatal" : undefined}
                                        className={cn(
                                          "h-10 min-w-8 px-1.5 tabular-nums",
                                          linha.diasPrazo === dias && "border-[#285f7a] bg-[#347796] text-white hover:bg-[#285f7a] hover:text-white"
                                        )}
                                        onClick={() =>
                                          publicacao.dataPublicacao &&
                                          // Clicar de novo no dia marcado desmarca: sai também a fatal que ele tinha calculado.
                                          alterar(
                                            linha.chave,
                                            linha.diasPrazo === dias
                                              ? { diasPrazo: null, dataFatal: "", origemPrazo: null }
                                              : {
                                                  diasPrazo: dias,
                                                  origemPrazo: "atalho",
                                                  dataFatal: fatalPorContagem(publicacao.dataPublicacao, dias, linha.contagemPrazo ?? contagemPadrao, contaPrazo),
                                                }
                                          )
                                        }
                                      >
                                        {dias}
                                      </Button>
                                    ))}
                                  </div>
                                  </div>
                                  {/* Úteis ou corridos e a fatal andam juntos: se faltar espaço, descem os dois. */}
                                  <div className="flex items-end gap-2">
                                    <div className="space-y-1.5">
                                    <span className="block text-xs font-medium text-muted-foreground">Contagem</span>
                                    <ContagemDoPrazo
                                      rotulo={`Contagem do prazo da tarefa ${indice + 1}`}
                                      valor={linha.contagemPrazo ?? contagemPadrao}
                                      onChange={(contagem) =>
                                        alterar(linha.chave, {
                                          contagemPrazo: contagem,
                                          ...(linha.diasPrazo && publicacao.dataPublicacao
                                            ? { dataFatal: fatalPorContagem(publicacao.dataPublicacao, linha.diasPrazo, contagem, contaPrazo) }
                                            : {}),
                                        })
                                      }
                                    />
                                    </div>
                                    <div className="w-[11rem] space-y-1.5">
                                      <span className="block text-xs font-medium text-muted-foreground">Data fatal</span>
                                      <CampoData
                                        rotulo={`Data fatal da tarefa ${indice + 1}`}
                                        valor={linha.dataFatal}
                                        ehDiaUtil={contaPrazo}
                                        onChange={(data) => alterar(linha.chave, { dataFatal: data, diasPrazo: null, origemPrazo: data ? "calendario" : null })}
                                      />
                                    </div>
                                  </div>
                                </div>
                                {cadeia ? (
                                  <ReguaDatas
                                    compacta
                                    rotulo={`Datas da tarefa ${indice + 1}`}
                                    hoje={detalhe.hoje}
                                    className="rounded-md border border-[#e6eef0] bg-[#f7fbfc] px-3 py-1.5"
                                    marcos={[
                                      {
                                        rotulo: cadeia.protocolar ? "Enviar no VIOS" : "Tarefa no VIOS",
                                        rotuloCurto: cadeia.protocolar ? "Enviar" : "Tarefa",
                                        data: cadeia.enviar,
                                        tom: "marca",
                                        dica: "Data da tarefa que vai para o VIOS.",
                                      },
                                      { rotulo: "Revisar", rotuloCurto: "Rev.", data: cadeia.revisar },
                                      { rotulo: "Protocolar", rotuloCurto: "Prot.", data: cadeia.protocolar },
                                      { rotulo: "Data fatal", rotuloCurto: "Fatal", data: linha.dataFatal, tom: "perigo" },
                                    ]}
                                  />
                                ) : null}
                                {tarefaId && !cadeiaFluxo ? (
                                  <p className="text-xs text-muted-foreground">
                                    O VIOS não cria Revisar nem Protocolar para esta tarefa: ela vai com a data do protocolo (1 dia útil antes da fatal).
                                  </p>
                                ) : null}
                                {cadeiaFluxo?.antecipada && cadeia && !cadeia.ajustada ? (
                                  <p className="text-xs text-muted-foreground">
                                    Regra da insolvência: o Enviar e o Revisar vão {cadeiaFluxo.antecipada} dias úteis antes; o Protocolar e a fatal não
                                    mudam (o robô grava o Protocolar no VIOS).
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-end gap-3">
                                <div className="w-[11rem] space-y-1.5">
                                  <span className="block text-xs font-medium text-muted-foreground">Data no VIOS</span>
                                  <CampoData
                                    rotulo={`Data da tarefa ${indice + 1} no VIOS`}
                                    valor={linha.data}
                                    ehDiaUtil={ehDiaUtil}
                                    onChange={(data) => alterar(linha.chave, { data })}
                                  />
                                </div>
                                {prazo ? (
                                  <p className="min-w-[14rem] flex-1 text-xs text-muted-foreground">
                                    Sem prazo próprio no VIOS: a data já vem preenchida, e as tarefas do fluxo contam a partir dela.
                                  </p>
                                ) : null}
                                {linha.etiqueta === "COMPROMISSO" ? (
                                  <div className="w-32 space-y-1.5">
                                    <span className="block text-xs font-medium text-muted-foreground">Horário</span>
                                    <CampoHora
                                      rotulo={`Horário da tarefa ${indice + 1}`}
                                      valor={linha.hora}
                                      onChange={(hora) => alterar(linha.chave, { hora })}
                                      invalido={!horaValida(linha.hora)}
                                    />
                                  </div>
                                ) : null}
                                {linha.etiqueta === "COMPROMISSO" ? (
                                  // Vai para a Hora final no VIOS; começa 1 hora depois do horário e acompanha quando ele muda.
                                  <div className="w-32 space-y-1.5" title="Vai para a Hora final no VIOS. Começa 1 hora depois do horário.">
                                    <span className="block text-xs font-medium text-muted-foreground">Hora final</span>
                                    <CampoHora
                                      rotulo={`Hora final da tarefa ${indice + 1}`}
                                      valor={linha.horaFim}
                                      onChange={(horaFim) => alterar(linha.chave, { horaFim })}
                                      invalido={!horaFinalValida(linha)}
                                    />
                                  </div>
                                ) : null}
                                {limitePedido ? (
                                  // SESSÃO DE JULGAMENTO: a sessão é num dia e o prazo da tarefa pode ir além. Começa igual à data.
                                  <div className="w-[11rem] space-y-1.5" title="Vai para a Data limite no VIOS. Começa igual à data e pode ir além dela.">
                                    <span className="block text-xs font-medium text-muted-foreground">Data limite</span>
                                    <CampoData
                                      rotulo={`Data limite da tarefa ${indice + 1} no VIOS`}
                                      valor={linha.dataLimite || linha.data}
                                      min={linha.data || undefined}
                                      ehDiaUtil={ehDiaUtil}
                                      destacado={Boolean(linha.dataLimite && linha.dataLimite !== linha.data)}
                                      invalido={!dataLimiteValida(linha)}
                                      onChange={(dataLimite) => alterar(linha.chave, { dataLimite })}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            )}
                            {avisos.length ? (
                              <p className="flex items-center gap-1.5 text-xs text-amber-800">
                                <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                                {avisos.join(" ")}
                              </p>
                            ) : null}
                            {cadeia?.ajustada ? (
                              <p className="flex items-center gap-1.5 text-xs text-amber-800">
                                <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                                Prazo curto: o Enviar vai hoje e o Revisar e o Protocolar ficam antes da fatal (o robô grava no VIOS).
                              </p>
                            ) : null}
                            {cienciaPedidaRepetida ? (
                              <p className="flex items-center gap-1.5 text-xs text-amber-800">
                                <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                                O fluxo de uma tarefa incluída antes já cria a 1. CIÊNCIA DOS AGENDAMENTOS: esta fica repetida e o robô a cancela no VIOS. Tire esta tarefa.
                              </p>
                            ) : null}
                          </BlocoTarefa>

                          <BlocoTarefa titulo="Quem" icone={Users}>
                            {/* Providência não tem revisor (nenhum tipo cria 2. REVISAR no VIOS): só o responsável. */}
                            <div className={cn("grid gap-3", linha.etiqueta !== "PROVIDENCIA" && "@md:grid-cols-2")}>
                              <div className="space-y-1.5">
                                <span className="block text-xs font-medium text-muted-foreground">Responsável</span>
                                <CampoResponsaveis
                                  pessoas={pessoasDoCampo}
                                  valor={linha.responsavel}
                                  onChange={(valor) => alterar(linha.chave, { responsavel: valor })}
                                  rotulo={`Responsável da tarefa ${indice + 1}`}
                                  dica={
                                    (catalogo.tarefas[linha.etiqueta].find((item) => item.nome === linha.tarefa)?.responsaveis ?? []).join(", ") === linha.responsavel &&
                                    linha.responsavel
                                      ? "Responsáveis fixos deste tipo no VIOS."
                                      : null
                                  }
                                />
                              </div>
                              {linha.etiqueta === "PROVIDENCIA" ? null : (
                              <div className="space-y-1.5">
                                <span className="block text-xs font-medium text-muted-foreground">
                                  {prazo ? "Revisor (obrigatório)" : "Revisor (opcional)"}
                                  {prazo && detalhe.revisorSugerido && linha.revisor === detalhe.revisorSugerido ? (
                                    <span className="font-normal"> · auxiliar da pasta</span>
                                  ) : null}
                                  {revisorFicaNaTarefa(linha.tarefa, areaDaPublicacao) ? <span className="font-normal"> · fica na tarefa, com o responsável</span> : null}
                                </span>
                                <ComboboxBusca
                                  opcoes={pessoasDoCampo.opcoes}
                                  ampliar={pessoasDoCampo.ampliar}
                                  pessoas
                                  valor={linha.revisor}
                                  onChange={(nome) => alterar(linha.chave, { revisor: nome })}
                                  placeholder={prazo ? "Digite para buscar o revisor…" : "Sem revisor"}
                                  rotulo={`Revisor da tarefa ${indice + 1}`}
                                  permitirVazio
                                  invalido={prazo && !linha.revisor}
                                />
                              </div>
                              )}
                            </div>
                          </BlocoTarefa>

                          <BlocoTarefa
                            titulo="Observação"
                            icone={MessageSquareText}
                            acao={
                              observacaoPedida ? (
                                <span className="text-[11px] font-normal text-muted-foreground">
                                  <span className="font-semibold text-red-700">obrigatória</span> · vai como justificativa da CIÊNCIA NF no VIOS
                                </span>
                              ) : (
                                <span className="text-[11px] font-normal text-muted-foreground">opcional · vai na descrição da tarefa no VIOS</span>
                              )
                            }
                          >
                            <Textarea
                              aria-label={`Observação da tarefa ${indice + 1}`}
                              aria-required={observacaoPedida}
                              aria-invalid={observacaoPedida && !linha.observacao.trim()}
                              value={linha.observacao}
                              onChange={(evento) => alterar(linha.chave, { observacao: evento.target.value })}
                              maxLength={2000}
                              rows={2}
                              placeholder={observacaoPedida ? "Por que não há o que agendar" : "O que fazer e por quê"}
                              className={cn("bg-white", observacaoPedida && !linha.observacao.trim() && "border-red-400")}
                            />
                          </BlocoTarefa>

                          {fluxo && previstas.length ? (
                            <FluxoNoVios
                              previstas={previstas}
                              principal={{
                                nome: linha.tarefa,
                                data: (comFatal ? cadeia?.enviar : linha.data) || null,
                                etiqueta: linha.etiqueta,
                                responsaveis: linha.responsavel,
                              }}
                              fatais={
                                comFatal
                                  ? linha.dataFatal
                                    ? [{ rotulo: "Data fatal", data: linha.dataFatal, dica: "Muda no campo Data fatal, acima." }]
                                    : []
                                  : prazo
                                    ? fataisDoFluxo(fluxo, detalhe.publicacao.dataPublicacao, catalogo.area, contagemPadrao, contaPrazo).map((fatal) => ({
                                        rotulo: `Data fatal · ${fatal.nome}`,
                                        data: fatal.data,
                                        dica: `${fatal.dias} ${ROTULO_CONTAGEM[contagemPadrao]} após a publicação (prazo legal). Só para conferir: não vai para o VIOS.`,
                                      }))
                                    : []
                              }
                              pessoas={pessoasDoCampo}
                              hoje={detalhe.hoje}
                              ehDiaUtil={ehDiaUtil}
                              onMudarData={(caminho, data) => mudarNoFluxo(linha, caminho, { data })}
                              onMudarResponsaveis={(caminho, nomes) => mudarNoFluxo(linha, caminho, { responsaveis: nomes })}
                              classeDe={classeDaTarefa}
                            />
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                  {linhas.length < 10 ? (
                    <li>
                      {/* Mais uma tarefa no fim da lista, onde a pessoa está, sem voltar ao topo. */}
                      <button
                        type="button"
                        onClick={adicionarTarefa}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#b9d3dd] bg-white/60 px-4 py-3 text-sm font-medium text-[#347796] transition-colors hover:border-[#47cdd0] hover:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30"
                      >
                        <Plus className="size-4" aria-hidden />
                        Adicionar outra tarefa
                      </button>
                    </li>
                  ) : null}
                </ol>

                <CienciaDoOrquestra linhas={linhas} catalogo={catalogo} detalhe={detalhe} />

                {abertura ? (
                  <div className="px-4 pb-3">
                    <Aviso tom="info" titulo="Sem pasta no VIOS">
                      Ao enviar, as tarefas vão para a conferência da controladoria. Depois de validadas, não vão para o robô: viram um pedido de abertura de pasta na Central do SharePoint, e a controladoria agenda depois de abrir a pasta.
                    </Aviso>
                  </div>
                ) : null}

                {erro ? (
                  <div className="px-4 pb-3">
                    <Aviso tom="erro">{erro}</Aviso>
                  </div>
                ) : null}

                <div data-tour="vj-enviar" className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-b-lg border-t border-[#e6eef0] bg-white px-4 py-3 shadow-[0_-8px_16px_-12px_rgba(16,41,58,0.18)]">
                  <p className="min-w-0 flex-1 text-xs text-muted-foreground" aria-live="polite">
                    {completo
                      ? `${linhas.length} ${linhas.length === 1 ? "tarefa pronta" : "tarefas prontas"} para a conferência.`
                      : faltaTarefaEsocial
                        ? `Falta o tipo ${TAREFA_ESOCIAL} no VIOS.`
                        : `Complete ${incompletas === 1 ? "a tarefa marcada" : `as ${incompletas} tarefas marcadas`}: tarefa, data${linhas.some((linha) => linha.etiqueta === "PRAZO") ? ", revisor" : ""}${faltaObservacao ? ", observação" : ""} e responsável.`}
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
        ehDiaUtil={ehDiaUtil}
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
          <div className="space-y-1 text-xs font-medium text-muted-foreground">
            Área de destino
            <Seletor
              rotulo="Área de destino"
              placeholder="Escolha a área…"
              valor={destino}
              onChange={setDestino}
              opcoes={ESCRITORIOS.filter((escritorio) => escritorio !== escritorioAtual).map((escritorio) => ({
                valor: escritorio,
                rotulo: escritorio,
                icone: <IconeArea area={escritorio} />,
              }))}
            />
          </div>
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

/** Filtro do tamanho do conteúdo (cresce até um limite quando há algo escolhido); no celular, a largura toda. */
const FILTRO_COMPACTO = "w-full sm:w-auto sm:max-w-56";

/** O campo do filtro sem nada escolhido: só o ícone e o nome, em cinza (sem "Todos os…" e sem a contagem). */
function CampoVazio({ icone, texto }: { icone: ReactNode; texto: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
      {icone}
      <span className="truncate">{texto}</span>
    </span>
  );
}

/** Vazio mostra todas; clicar de novo no filtro escolhido volta a mostrar todas. */
type FiltroRisco = "" | "risco" | "normal";

interface GrupoFila {
  /** Dia do recebimento + grupo: o mesmo grupo pode aparecer em dois dias. */
  chave: string;
  /** Dia do recebimento (AAAA-MM-DD), ou null quando a publicação não tem. */
  dia: string | null;
  nome: string;
  publicacoes: PublicacaoResumo[];
  riscos: number;
}

/**
 * Demanda de risco × normal: dois botões que ligam e desligam. Nenhum ligado mostra todas; clicar no ligado
 * desliga (sem o botão "Todas").
 */
function FiltroDemanda({
  valor,
  riscos,
  normais,
  onChange,
}: {
  valor: FiltroRisco;
  riscos: number;
  normais: number;
  onChange: (valor: FiltroRisco) => void;
}) {
  const opcoes = [
    { valor: "risco" as const, rotulo: "Demanda de risco", curto: "Risco", contagem: riscos, icone: ShieldAlert, ligado: "bg-[#8f1d26] text-white" },
    { valor: "normal" as const, rotulo: "Demanda normal", curto: "Normal", contagem: normais, icone: ShieldCheck, ligado: "bg-[#347796] text-white" },
  ];
  return (
    <div role="group" aria-label="Tipo de demanda" className="inline-flex shrink-0 rounded-md border border-input bg-white p-0.5">
      {opcoes.map((opcao) => {
        const ativo = valor === opcao.valor;
        const Icone = opcao.icone;
        return (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={ativo}
            title={ativo ? "Clique de novo para mostrar todas" : `Mostrar só ${opcao.rotulo.toLowerCase()}`}
            onClick={() => onChange(ativo ? "" : opcao.valor)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2.5 text-sm transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
              ativo ? cn(opcao.ligado, "font-medium") : "text-muted-foreground hover:bg-[#47cdd0]/10 hover:text-foreground"
            )}
          >
            <Icone className={cn("size-4", !ativo && opcao.valor === "risco" && "text-[#8f1d26]")} aria-hidden />
            {/* Nome inteiro só em tela bem larga; no resto, "Risco" e "Normal" (o nome inteiro fica na dica). */}
            <span className="hidden 2xl:inline">{opcao.rotulo}</span>
            <span className="2xl:hidden" aria-hidden>
              {opcao.curto}
            </span>
            <span className="sr-only 2xl:hidden">{opcao.rotulo}</span>
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                ativo ? "bg-white/20 text-white" : "bg-[#eef3f5] text-foreground/70"
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

/** Dia do recebimento para ordenar; sem data vai para o fim. */
const recebimento = (publicacao: PublicacaoResumo) => publicacao.dataImportacao ?? "9999-12-31";

/**
 * Agrupa a fila por dia do recebimento e, dentro do dia, por grupo do cliente: a mais antiga primeiro, com ou sem
 * risco (a normal de ontem vem antes da de risco de hoje). No mesmo dia, grupos e publicações de risco vêm antes.
 */
function agruparFila(publicacoes: PublicacaoResumo[]): GrupoFila[] {
  const grupos = new Map<string, GrupoFila>();
  for (const publicacao of publicacoes) {
    const nome = publicacao.grupoCliente?.trim() || SEM_GRUPO;
    const chave = `${recebimento(publicacao)}|${nome}`;
    const grupo = grupos.get(chave) ?? { chave, dia: publicacao.dataImportacao, nome, publicacoes: [], riscos: 0 };
    grupo.publicacoes.push(publicacao);
    if (publicacao.demandaRisco) grupo.riscos += 1;
    grupos.set(chave, grupo);
  }
  return [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      publicacoes: grupo.publicacoes.sort(
        (a, b) => Number(Boolean(b.demandaRisco)) - Number(Boolean(a.demandaRisco)) || (a.dataPublicacao ?? "").localeCompare(b.dataPublicacao ?? "")
      ),
    }))
    .sort(
      (a, b) =>
        (a.dia ?? "9999-12-31").localeCompare(b.dia ?? "9999-12-31") ||
        Number(b.riscos > 0) - Number(a.riscos > 0) ||
        a.nome.localeCompare(b.nome, "pt-BR")
    );
}

/** Chave do dia na fila (para recolher), com as publicações sem data juntas. */
const chaveDoDia = (dia: string | null) => dia ?? "sem-data";

/** "Recebidas hoje · qui, 06/11", "Recebidas ontem · qua, 05/11", "Recebidas qui, 30/10". */
function rotuloDoDia(dia: string | null, hoje: string): string {
  if (!dia) return "Sem data de recebimento";
  const data = `${diaDaSemana(dia)}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  const relativo = relativoAHoje(dia, hoje);
  return relativo === "hoje" || relativo === "ontem" ? `Recebidas ${relativo} · ${data}` : `Recebidas ${data} · ${relativo}`;
}

function Juridico() {
  /** A vistar (a fila) ou Agendadas (o que já foi vistado e onde está cada tarefa). */
  const [visao, setVisao] = useState<"fila" | "agendadas">("fila");
  const [escritorio, setEscritorio] = useState("");
  const [publicacoes, setPublicacoes] = useState<PublicacaoResumo[] | null>(null);
  const [porEscritorio, setPorEscritorio] = useState<Record<string, number>>({});
  /** Áreas do usuário do jurídico; null é a controladoria (todas). */
  const [areas, setAreas] = useState<string[] | null>(null);
  /** Quem não vista demanda de risco (Configurações › Quem acessa a Vistagem) não recebe as de risco: o filtro sai. */
  const [veRisco, setVeRisco] = useState(true);
  /** Publicação escolhida; sem escolha (ou fora dos filtros), abre a primeira da fila. */
  const [selecionada, setSelecionada] = useState<string | null>(null);
  /** No celular a lista e a publicação não cabem juntas: mostra a lista só quando pedida. */
  const [listaNoCelular, setListaNoCelular] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const [risco, setRisco] = useState<FiltroRisco>("");
  /** Tribunal; vazio é "Todos os tribunais". */
  const [tribunal, setTribunal] = useState("");
  /** Etiqueta da pasta no VIOS (ex.: RC-Insolvência); vazio é "Todas as etiquetas". */
  const [etiqueta, setEtiqueta] = useState("");
  /** Dia em que a publicação chegou no Orquestra (AAAA-MM-DD); vazio é "Todas as datas". */
  const [dataImportacao, setDataImportacao] = useState("");
  /** A fila abre sempre recolhida (a publicação ocupa a tela); o botão à esquerda do número do processo mostra. */
  const [filaRecolhida, setFilaRecolhida] = useState(true);
  /** Na fila, cada grupo vem recolhido (menos o da publicação aberta); aqui ficam os que a pessoa inverteu. */
  const [gruposAlternados, setGruposAlternados] = useState<Set<string>>(() => new Set());
  /** Com mais de um dia na fila, cada dia também vem recolhido (menos o da publicação aberta); os invertidos ficam aqui. */
  const [diasAlternados, setDiasAlternados] = useState<Set<string>>(() => new Set());

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
      setVeRisco(corpo.veRisco !== false);
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
  // Grupo escolhido que sumiu da fila (outra área) deixa de filtrar.
  const grupoAtivo = gruposDaFila.some(([nome]) => nome === grupo) ? grupo : "";
  const tribunaisDaFila = useMemo(() => contarPor(publicacoes ?? [], tribunalDe), [publicacoes]);
  const tribunalAtivo = tribunaisDaFila.some(([nome]) => nome === tribunal) ? tribunal : "";
  // Etiquetas das pastas da fila, com as de selo (RC-Insolvência) primeiro.
  const etiquetasDaFila = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const publicacao of publicacoes ?? []) for (const nome of publicacao.etiquetas ?? []) contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    const emDestaque = (nome: string) => Number(etiquetasEmDestaque([nome]).length > 0);
    return [...contagem.entries()].sort((a, b) => emDestaque(b[0]) - emDestaque(a[0]) || a[0].localeCompare(b[0], "pt-BR"));
  }, [publicacoes]);
  const etiquetaAtiva = etiquetasDaFila.some(([nome]) => nome === etiqueta) ? etiqueta : "";
  const importacoesDaFila = useMemo(() => (publicacoes ?? []).map((publicacao) => publicacao.dataImportacao), [publicacoes]);
  const importacaoAtiva = dataNaLista(dataImportacao, importacoesDaFila);
  // O que a busca olha em cada publicação (inclui as partes do texto): montado uma vez por carga, não a cada letra.
  const camposDeBusca = useMemo(() => new Map((publicacoes ?? []).map((publicacao) => [publicacao.id, camposDaPublicacao(publicacao)])), [publicacoes]);
  const filtradas = useMemo(() => {
    return (publicacoes ?? []).filter((publicacao) => {
      if (importacaoAtiva && publicacao.dataImportacao !== importacaoAtiva) return false;
      if (grupoAtivo && (publicacao.grupoCliente?.trim() || SEM_GRUPO) !== grupoAtivo) return false;
      if (tribunalAtivo && tribunalDe(publicacao) !== tribunalAtivo) return false;
      if (etiquetaAtiva && !(publicacao.etiquetas ?? []).includes(etiquetaAtiva)) return false;
      if (risco === "risco" && !publicacao.demandaRisco) return false;
      if (risco === "normal" && publicacao.demandaRisco) return false;
      return combinaCampos(camposDeBusca.get(publicacao.id) ?? [], busca);
    });
  }, [publicacoes, busca, grupoAtivo, tribunalAtivo, etiquetaAtiva, risco, importacaoAtiva, camposDeBusca]);
  const filtrosAtivos = Boolean(busca.trim() || grupoAtivo || tribunalAtivo || etiquetaAtiva || risco || importacaoAtiva);
  const grupos = useMemo(() => agruparFila(filtradas), [filtradas]);
  // Mesma ordem da lista: é por ela que o editor anda para a anterior e a próxima.
  const ordem = useMemo(() => grupos.flatMap((item) => item.publicacoes.map((publicacao) => publicacao.id)), [grupos]);
  const aberta = selecionada && ordem.includes(selecionada) ? selecionada : ordem[0] ?? null;
  const grupoDe = (id: string | null) => (id ? grupos.find((item) => item.publicacoes.some((publicacao) => publicacao.id === id))?.chave ?? null : null);
  const grupoDaAberta = grupoDe(aberta);
  const grupoAberto = (chave: string) => (chave === grupoDaAberta) !== gruposAlternados.has(chave);
  // Com mais de um dia na fila, cada dia ganha um cabeçalho por cima dos grupos, que recolhe o dia inteiro.
  const variosDias = new Set(grupos.map((item) => item.dia)).size > 1;
  const [hoje] = useState(hojeLocal);
  const diaDe = (id: string | null) => {
    const bloco = id ? grupos.find((item) => item.publicacoes.some((publicacao) => publicacao.id === id)) : undefined;
    return bloco ? chaveDoDia(bloco.dia) : null;
  };
  const diaDaAberta = diaDe(aberta);
  const diaAberto = (dia: string | null) => !variosDias || (chaveDoDia(dia) === diaDaAberta) !== diasAlternados.has(chaveDoDia(dia));
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

  /** Vistagem reaberta no Vistado: volta para "A vistar" sem filtros que a escondam, com ela aberta. */
  function reaberta(id: string) {
    setVisao("fila");
    setGrupo("");
    setRisco("");
    setTribunal("");
    setDataImportacao("");
    setAviso("Vistagem reaberta: altere o que precisar e vista de novo para ela voltar à Conferência.");
    void carregar(escritorio).then(() => setSelecionada(id));
  }

  function abrir(id: string) {
    setSelecionada(id);
    setListaNoCelular(false);
    setAviso("");
    // O grupo e o dia da publicação aberta ficam abertos na fila, mesmo que a pessoa os tenha recolhido antes.
    const grupoNovo = grupoDe(id);
    if (grupoNovo && gruposAlternados.has(grupoNovo)) {
      setGruposAlternados((atual) => {
        const proximo = new Set(atual);
        proximo.delete(grupoNovo);
        return proximo;
      });
    }
    const diaNovo = diaDe(id);
    if (diaNovo && diasAlternados.has(diaNovo)) {
      setDiasAlternados((atual) => {
        const proximo = new Set(atual);
        proximo.delete(diaNovo);
        return proximo;
      });
    }
  }

  function alternarGrupo(nome: string) {
    setGruposAlternados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(nome)) proximo.delete(nome);
      else proximo.add(nome);
      return proximo;
    });
  }

  function alternarDia(dia: string | null) {
    const chave = chaveDoDia(dia);
    setDiasAlternados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  }

  function limparFiltros() {
    setBusca("");
    setGrupo("");
    setTribunal("");
    setEtiqueta("");
    setRisco("");
    setDataImportacao("");
  }

  function transferida(destino: string) {
    // O destino pode ser outra área do próprio usuário: recarrega a fila e as contagens.
    setSelecionada(null);
    setAviso(`Publicação transferida para ${destino}.`);
    void carregar(escritorio);
  }

  function concluida(id: string, central: ResultadoCentral | null) {
    // Segue para a próxima da fila (ou a anterior, se era a última).
    const posicao = ordem.indexOf(id);
    setSelecionada(ordem[posicao + 1] ?? ordem[posicao - 1] ?? null);
    setPublicacoes((publicacoes ?? []).filter((p) => p.id !== id));
    avisarContagensVistagem();
    setAviso(
      !central
        ? "Vistagem enviada para a conferência da controladoria."
        : central.itemId
          ? `Sem pasta no VIOS: pedido de abertura de pasta criado na Central do SharePoint (item ${central.itemId}).`
          : "Vistagem salva. A Central do SharePoint não respondeu: a controladoria vê o pedido na Conferência e o sistema tenta de novo."
    );
    setPorEscritorio((atual) => {
      const p = (publicacoes ?? []).find((item) => item.id === id);
      const chave = p?.escritorioResponsavel ?? "Sem área";
      return { ...atual, [chave]: Math.max(0, (atual[chave] ?? 1) - 1) };
    });
  }

  return (
    <div className="space-y-4">
      {/* Uma linha só: "A vistar / Vistado", Risco / Normal (só para quem vista os dois), área, recebimento,
          grupo, tribunal, etiqueta da pasta e a busca, do tamanho do conteúdo (sem nada escolhido, só o ícone e o nome do filtro).
          Em tela estreita, os filtros descem de linha. */}
      <div className="flex flex-wrap items-center gap-2" data-tour="vj-filtros">
        <div data-tour="vj-visao">
        <Segmented
          label="Visão do jurídico"
          value={visao}
          options={[
            { value: "fila", label: `A vistar${publicacoes ? ` ${publicacoes.length}` : ""}` },
            { value: "agendadas", label: "Vistado" },
          ]}
          onChange={setVisao}
        />
        </div>
        {visao === "fila" && veRisco ? (
          <FiltroDemanda valor={risco} riscos={riscos} normais={(publicacoes?.length ?? 0) - riscos} onChange={setRisco} />
        ) : null}
        <Seletor
          rotulo="Área"
          className={FILTRO_COMPACTO}
          valor={escritorio}
          onChange={setEscritorio}
          todos={{ rotulo: "Todas as áreas", contagem: total, icone: <IconeOpcao icone={Layers} /> }}
          rotuloVazio={<CampoVazio icone={<IconeOpcao icone={Layers} />} texto="Área" />}
          opcoes={escritorios.map(([nome, quantidade]) => ({ valor: nome, rotulo: nome, contagem: quantidade, icone: <IconeArea area={nome} /> }))}
        />
        {visao === "fila" ? (
          <>
            <FiltroData
              rotulo="Data do recebimento"
              rotuloCurto="Recebimento"
              className={FILTRO_COMPACTO}
              datas={importacoesDaFila}
              valor={importacaoAtiva}
              onChange={setDataImportacao}
            />
            <SeletorBusca
              rotulo="Grupo do cliente"
              className={FILTRO_COMPACTO}
              buscaPlaceholder="Buscar grupo…"
              valor={grupoAtivo}
              onChange={setGrupo}
              todos={{ rotulo: "Todos os grupos", contagem: publicacoes?.length, icone: <IconeOpcao icone={Building2} /> }}
              rotuloVazio={<CampoVazio icone={<IconeOpcao icone={Building2} />} texto="Grupo" />}
              opcoes={gruposDaFila.map(([nome, quantidade]) => ({
                valor: nome,
                rotulo: nome,
                contagem: quantidade,
                icone: <LogoGrupo grupo={nome === SEM_GRUPO ? null : nome} tamanho="xs" />,
              }))}
            />
            <Seletor
              rotulo="Tribunal"
              className={FILTRO_COMPACTO}
              valor={tribunalAtivo}
              onChange={setTribunal}
              todos={{ rotulo: "Todos os tribunais", contagem: publicacoes?.length, icone: <IconeOpcao icone={Landmark} /> }}
              rotuloVazio={<CampoVazio icone={<IconeOpcao icone={Landmark} />} texto="Tribunal" />}
              opcoes={tribunaisDaFila.map(([nome, quantidade]) => ({ valor: nome, rotulo: nome, descricao: descricaoDoTribunal(nome), contagem: quantidade, icone: <IconeTribunal sigla={nome} /> }))}
            />
            <SeletorBusca
              rotulo="Etiqueta da pasta"
              className={FILTRO_COMPACTO}
              buscaPlaceholder="Buscar etiqueta…"
              valor={etiquetaAtiva}
              onChange={setEtiqueta}
              todos={{ rotulo: "Todas as etiquetas", contagem: publicacoes?.length, icone: <IconeOpcao icone={Tag} /> }}
              rotuloVazio={<CampoVazio icone={<IconeOpcao icone={Tag} />} texto="Etiqueta" />}
              opcoes={etiquetasDaFila.map(([nome, quantidade]) => ({
                valor: nome,
                rotulo: nome,
                contagem: quantidade,
                icone: <IconeOpcao icone={Tag} className={etiquetasEmDestaque([nome]).length ? ICONE_ETIQUETA_DESTAQUE : undefined} />,
              }))}
            />
          </>
        ) : null}
        <Busca
          className="sm:w-52"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Processo, cliente ou CI"
          aria-label="Buscar publicação"
        />
        {visao === "fila" && filtrosAtivos && publicacoes ? (
          <Button type="button" variant="ghost" size="sm" className="text-[#347796]" onClick={limparFiltros} title="Mostrar todas de novo">
            <X />
            Limpar ({filtradas.length} de {publicacoes.length})
          </Button>
        ) : null}
      </div>

      {areas && areas.length === 0 ? (
        <Aviso tom="alerta">Nenhuma área marcada para você. Peça à controladoria para liberar as suas.</Aviso>
      ) : null}

      {aviso ? <Aviso tom="sucesso">{aviso}</Aviso> : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {visao === "agendadas" ? (
        <AgendadasJuridico key={escritorio} escritorio={escritorio} busca={busca} onReaberta={reaberta} />
      ) : (
        /* No desktop, lista e publicação rolam cada uma no seu painel (o main do app não deixa usar sticky). */
        <div
          className={cn(
            "grid gap-4 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[30rem]",
            // Fila aberta: fila e publicação ficam coladas, sem o espaço entre as colunas.
            filaRecolhida ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(230px,270px)_minmax(0,1fr)] lg:gap-x-0"
          )}
        >
          <Painel
            aria-label="Publicações a vistar"
            data-fila-vistagem
            data-tour="vj-fila"
            className={cn("lg:flex lg:h-full lg:flex-col lg:rounded-r-none", aberta && !listaNoCelular && "hidden lg:flex", filaRecolhida && "lg:hidden")}
          >
            <div className="hidden items-center gap-2 border-b border-[#e6eef0] px-4 py-2 lg:flex">
              <span className="flex-1 text-xs font-medium text-muted-foreground">
                Fila <span className="tabular-nums">· {filtradas.length}</span>
              </span>
              {/* Com uma publicação aberta, quem recolhe a fila é o botão da faixa do processo (um botão só). */}
              {aberta ? null : (
                <Button type="button" size="icon-xs" variant="ghost" onClick={() => setFilaRecolhida(true)} aria-label="Recolher a fila" title="Recolher a fila">
                  <PanelLeftClose />
                </Button>
              )}
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
                {grupos.map((bloco, indice) => (
                  <Fragment key={bloco.chave}>
                  {variosDias && (indice === 0 || grupos[indice - 1].dia !== bloco.dia) ? (
                    <h3 className="border-b border-[#c9dde6] bg-[#e9f2f6] text-[11px] font-semibold text-[#183f50]">
                      <button
                        type="button"
                        aria-expanded={diaAberto(bloco.dia)}
                        onClick={() => alternarDia(bloco.dia)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#dfecf2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]/50"
                      >
                        <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", diaAberto(bloco.dia) && "rotate-90")} aria-hidden />
                        <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{rotuloDoDia(bloco.dia, hoje)}</span>
                        <span className="ml-auto font-normal tabular-nums text-[#285f7a]">
                          {grupos.filter((item) => item.dia === bloco.dia).reduce((soma, item) => soma + item.publicacoes.length, 0)}
                        </span>
                      </button>
                    </h3>
                  ) : null}
                  <section aria-label={bloco.nome} className={cn(!diaAberto(bloco.dia) && "hidden")}>
                    <h3 className="sticky top-0 z-10 border-b border-[#e6eef0] bg-[#f7fbfc] text-xs font-semibold text-[#285f7a]">
                      <button
                        type="button"
                        aria-expanded={grupoAberto(bloco.chave)}
                        onClick={() => alternarGrupo(bloco.chave)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-[#eef6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]/50"
                      >
                        <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", grupoAberto(bloco.chave) && "rotate-90")} aria-hidden />
                        <LogoGrupo grupo={bloco.nome === SEM_GRUPO ? null : bloco.nome} tamanho="xs" />
                        <span className="truncate">{bloco.nome}</span>
                        <span className="font-normal tabular-nums text-muted-foreground">{bloco.publicacoes.length}</span>
                        {bloco.riscos ? (
                          <Selo tom="perigo" className="ml-auto">
                            {bloco.riscos} de risco
                          </Selo>
                        ) : null}
                      </button>
                    </h3>
                    <ul className={cn("divide-y divide-[#eef3f5]", !grupoAberto(bloco.chave) && "hidden")}>
                      {bloco.publicacoes.map((publicacao) => (
                        <li key={publicacao.id}>
                          <button
                            type="button"
                            onClick={() => abrir(publicacao.id)}
                            aria-current={publicacao.id === aberta ? "true" : undefined}
                            className={cn(linhaLista(publicacao.id === aberta), "space-y-1")}
                          >
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="tabular-nums text-xs font-semibold text-foreground">{publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}</span>
                              {publicacao.demandaRisco ? (
                                <Selo tom="perigo" icone={ShieldAlert}>
                                  Risco
                                </Selo>
                              ) : null}
                              <SelosDeEtiqueta etiquetas={publicacao.etiquetas} />
                              <SeloAberturaDePasta publicacao={publicacao} />
                              {publicacao.devolucaoMotivo || publicacao.devolvidoEm ? <Selo tom="alerta">Devolvida</Selo> : null}
                              {reabertaParaAlterar({ reabertaEm: publicacao.reabertaEm ?? null, devolvidoEm: publicacao.devolvidoEm }) ? <Selo tom="marca">Reaberta</Selo> : null}
                              {publicacao.transferidoDe ? <Selo tom="marca">Transferida</Selo> : null}
                            </span>
                            <span className="block truncate text-sm text-foreground">{publicacao.cliente ?? "—"}</span>
                            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                              {publicacao.escritorioResponsavel ? <IconeArea area={publicacao.escritorioResponsavel} tamanho="xs" /> : null}
                              <span className="truncate">
                                {[publicacao.escritorioResponsavel, publicacao.tribunal, `publ. ${formatarData(publicacao.dataPublicacao)}`].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                  </Fragment>
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
                fila={{ aberta: !filaRecolhida, onAlternar: () => setFilaRecolhida((atual) => !atual) }}
              />
            ) : (
              <Painel data-tour="vj-vazio" className={cn(!filaRecolhida && "lg:rounded-l-none lg:border-l-0")}>
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
      )}
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
