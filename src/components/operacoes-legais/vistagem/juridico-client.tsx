"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import {
  ETIQUETAS_AGENDAMENTO,
  ROTULO_ETIQUETA,
  atalhosDePrazo,
  avisosDaData,
  chaveDoCaminho,
  chaveNome,
  horaFinalPadrao,
  horaValida,
  separarNomes,
  type EtiquetaAgendamento,
} from "@/lib/vistagem/agendamento";
import { cienciaDosAgendamentos } from "@/lib/vistagem/ciencia-agendamentos";
import {
  CONTAGENS_PRAZO,
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
import { CADEIA_PADRAO, cadeiaDoFluxo } from "@/lib/vistagem/fluxo-vios";
import { fluxoPrevisto } from "@/lib/vistagem/fluxo-previsto";
import { fatalSugerida, type SugestaoIa } from "@/lib/vistagem/sugestao-ia";
import { ESCRITORIOS } from "@/lib/vistagem/triagem";
import type { DataDoFluxo, PublicacaoResumo, ResolucaoPendencia, TarefaPrevista, VistagemDetalhe } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { CampoData, CampoHora } from "./campo-data";
import { ESTILO_CLASSE, ICONE_CLASSE } from "./tarefas-conferencia";
import { AvatarPessoa, ComboboxBusca, type OpcaoBusca } from "./combobox-busca";
import { FaixaDoProcesso, NA_FAIXA } from "./faixa-processo";
import { CalendarioDoFluxo, ItemDaLegenda, NumeroDoMarco, tomDaTarefaDoFluxo, type MarcoDoCalendario, type TomDoMarco } from "./calendario-fluxo";
import { nomeCurto as nomeCurtoDaPessoa, partesDaData } from "@/lib/vistagem/como-fica-no-vios";
import { FichaPasta } from "./ficha-pasta";
import { FiltroData, dataNaLista } from "./filtro-data";
import { FichaProcesso, ResumoDaFicha, SinteseDoProcesso } from "./ficha-processo";
import { CartaoInconsistencia } from "./inconsistencias-ui";
import { AgendadasJuridico } from "./juridico-agendadas";
import { LeitorPublicacao } from "./leitor-publicacao";
import { IconeArea, IconeTribunal, LogoGrupo } from "./marcas";
import { descricaoDoTribunal } from "@/lib/vistagem/tribunais";
import { camposDaPublicacao, combinaCampos } from "@/lib/vistagem/busca";
import { contarPor, formatarData, formatarDataHora, tribunalDe } from "./publicacao-ui";
import { ReguaDatas } from "./regua-datas";
import { IconeOpcao, Seletor, SeletorBusca } from "./seletor";
import { CartaoSugestaoIa, SeloIa, type EstadoSugestao } from "./sugestao-ia-ui";
import { Aviso, Busca, Carregando, Painel, Selo, Vazio, campoClasse, linhaLista } from "./ui";

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
  /** Compromisso: Hora final no VIOS (HH:MM); começa 1 hora depois da inicial e acompanha até a pessoa mudar. */
  horaFim: string;
  responsavel: string;
  revisor: string;
  observacao: string;
  /** Inserir E-social pedida pela classificação eSocial: tarefa fixa, sai quando a classificação muda. */
  esocial: boolean;
  /** Veio da sugestão da IA. */
  ia: boolean;
  /** Datas do Fluxo do VIOS que a pessoa mudou, pela chave do caminho (chaveDoCaminho). */
  fluxoDatas: Record<string, DataDoFluxo>;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Parte do cartão da tarefa ("O que", "Prazo", "Quem"): título pequeno com ícone e os campos embaixo. */
function BlocoTarefa({ titulo, icone: Icone, acao, children }: { titulo: string; icone: LucideIcon; acao?: ReactNode; children: ReactNode }) {
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
        lançamento, para {ciencia.responsaveis.map((pessoa) => pessoa.nome).join(", ")}
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
    hora: "",
    horaFim: "",
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

function linhaCompleta(linha: Linha): boolean {
  if (!linha.tarefa || !linha.responsavel) return false;
  if (linha.etiqueta === "PRAZO") return Boolean(linha.dataFatal && linha.revisor);
  return Boolean(linha.data) && (linha.etiqueta !== "COMPROMISSO" || (horaValida(linha.hora) && horaFinalValida(linha)));
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

/** Quem fica na tarefa, com foto: "Leticia Zamarion Julio, Samuel Willian Silva" vira avatares com o nome curto. */
function PessoasDaTarefa({ nomes, foto }: { nomes: string | null | undefined; foto: (nome: string) => string | null }) {
  const lista = separarNomes(nomes ?? "");
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

/** Data curta da agenda: "qua, 12/11". */
function diaDaAgenda(iso: string): string {
  const partes = partesDaData(iso);
  return `${partes.semana}, ${partes.dia}/${iso.slice(5, 7)}`;
}

function FluxoNoVios({
  previstas,
  principal,
  fatal,
  hoje,
  ehDiaUtil,
  onMudarData,
  foto,
}: {
  previstas: TarefaPrevista[];
  /** A tarefa pedida: "Enviar no VIOS" (Prazo) ou "Tarefa no VIOS", com a data que vai para o VIOS, a classe e quem fica. */
  principal: { rotulo: string; nome: string; data: string | null; etiqueta: Etiqueta; responsaveis: string };
  /** Foto de cada pessoa (as mesmas dos campos Responsável e Revisor). */
  foto: (nome: string) => string | null;
  /** Data fatal do Prazo (só para situar no calendário). */
  fatal: string | null;
  hoje: string;
  ehDiaUtil: (iso: string) => boolean;
  onMudarData: (caminho: string[], data: string | null) => void;
}) {
  // Aberto por padrão: o calendário é para ser visto; a pessoa recolhe se quiser.
  const [aberto, setAberto] = useState(true);
  const junto = previstas.filter((tarefa) => tarefa.quando === "criacao");
  const aoConcluir = previstas.filter((tarefa) => tarefa.quando === "conclusao");
  const alteradas = junto.filter((tarefa) => tarefa.editada).length;
  const resumo = [
    junto.length ? `cria junto ${plural(junto.length, "tarefa", "tarefas")}` : null,
    alteradas ? `${plural(alteradas, "data alterada", "datas alteradas")}` : null,
    aoConcluir.length ? `ao concluir, ${aoConcluir.map((tarefa) => tarefa.nome).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Agenda em ordem de data (a pedida antes das do fluxo no mesmo dia; a fatal por último), numerada: o mesmo
  // número marca o dia no calendário.
  type Item =
    | { tipo: "principal"; chave: string; data: string }
    | { tipo: "fluxo"; chave: string; data: string; tarefa: TarefaPrevista }
    | { tipo: "fatal"; chave: string; data: string };
  const peso = { principal: 0, fluxo: 1, fatal: 2 } as const;
  const comData: Item[] = [
    ...(principal.data ? [{ tipo: "principal" as const, chave: "principal", data: principal.data }] : []),
    ...junto
      .filter((tarefa) => tarefa.data)
      .map((tarefa) => ({ tipo: "fluxo" as const, chave: tarefa.caminho.join(" › "), data: tarefa.data as string, tarefa })),
    ...(fatal ? [{ tipo: "fatal" as const, chave: "fatal", data: fatal }] : []),
  ].sort((a, b) => a.data.localeCompare(b.data) || peso[a.tipo] - peso[b.tipo]);
  const semData = junto.filter((tarefa) => !tarefa.data);
  // Cores do VIOS: a pedida pela classe (Prazo verde, Providência azul); no fluxo, Revisar amarelo e Protocolar vermelho.
  const tomDaPedida = TOM_DA_ETIQUETA[principal.etiqueta];
  const tomDe = (item: Item): TomDoMarco =>
    item.tipo === "principal" ? tomDaPedida : item.tipo === "fatal" ? "fatal" : tomDaTarefaDoFluxo(item.tarefa.nome, tomDaPedida);
  const editadaDe = (item: Item) => item.tipo === "fluxo" && item.tarefa.editada;
  const nomeDe = (item: Item) => (item.tipo === "principal" ? `${principal.rotulo}: ${principal.nome}` : item.tipo === "fatal" ? "Data fatal" : item.tarefa.nome);
  const marcos: MarcoDoCalendario[] = comData.map((item, indice) => ({
    chave: item.chave,
    numero: indice + 1,
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
    ) : tarefa.data && tarefa.dataVios && tarefa.data !== tarefa.dataVios ? (
      <span className="text-muted-foreground">acompanha a anterior (VIOS: {formatarData(tarefa.dataVios)})</span>
    ) : null;

  return (
    <details open={aberto} onToggle={(evento) => setAberto(evento.currentTarget.open)} className="group rounded-md border border-[#e6eef0] bg-[#f7fbfc] text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-muted-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
        <Workflow className="size-3.5 shrink-0 text-[#285f7a]" aria-hidden />
        <span className="font-medium text-[#285f7a]">Fluxo das tarefas</span>
        <span className={cn("truncate", alteradas && "text-[#285f7a]")}>{resumo}</span>
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

        {comData.length || semData.length ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">
              O robô coloca os responsáveis. Para priorizar uma tarefa do fluxo, mude a data: o robô grava no VIOS depois de lançar.
            </p>
            <ol className="divide-y divide-[#e6eef0] overflow-hidden rounded-md border border-[#e6eef0] bg-white">
              {comData.map((item, indice) => (
                <li
                  key={item.chave}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5"
                  style={item.tipo === "fluxo" && item.tarefa.nivel > 1 ? { paddingLeft: `${0.625 + (item.tarefa.nivel - 1) * 0.75}rem` } : undefined}
                >
                  <NumeroDoMarco numero={indice + 1} tom={tomDe(item)} editada={editadaDe(item)} />
                  {/* A que nasce de outra do fluxo fica recuada, com a seta (sem barra lateral). */}
                  {item.tipo === "fluxo" && item.tarefa.nivel > 1 ? <CornerDownRight className="size-3.5 shrink-0 text-[#9fb8c2]" aria-hidden /> : null}
                  <span className={cn("min-w-0 flex-1 basis-40 font-medium", item.tipo === "fatal" ? "text-[#b42318]" : "text-foreground")}>
                    {nomeDe(item)}
                  </span>
                  {item.tipo === "fluxo" ? (
                    <>
                      {campoDoFluxo(item.tarefa)}
                      <PessoasDaTarefa nomes={item.tarefa.responsaveis} foto={foto} />
                      {extrasDoFluxo(item.tarefa)}
                    </>
                  ) : (
                    <>
                      <span
                        className="w-[8.5rem] text-right tabular-nums text-muted-foreground"
                        title={item.tipo === "principal" ? "Muda no campo de data da tarefa, acima." : "Muda no campo Data fatal, acima."}
                      >
                        {diaDaAgenda(item.data)}
                      </span>
                      {item.tipo === "principal" ? <PessoasDaTarefa nomes={principal.responsaveis} foto={foto} /> : null}
                    </>
                  )}
                </li>
              ))}
              {semData.map((tarefa) => (
                <li key={tarefa.caminho.join(" › ")} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5">
                  <span className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#eef3f5] text-[10px] text-muted-foreground" aria-hidden>
                    –
                  </span>
                  <span className="min-w-0 flex-1 basis-40 font-medium text-foreground">{tarefa.nome}</span>
                  {campoDoFluxo(tarefa)}
                  <PessoasDaTarefa nomes={tarefa.responsaveis} foto={foto} />
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
interface PessoasDoCampo {
  opcoes: OpcaoBusca[];
  ampliar: { todas: OpcaoBusca[]; area: string } | null;
  foto: (nome: string) => string | null;
}

/** Um ou mais responsáveis; a fila do robô recebe os nomes separados por vírgula. */
function CampoResponsaveis({
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
  onConcluida: (id: string) => void;
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
                  horaFim: item.horaFim ?? horaFinalPadrao(item.hora),
                  responsavel: item.responsavel,
                  revisor: item.etiqueta === "PROVIDENCIA" ? "" : item.revisor ?? "",
                  observacao: item.observacao ?? "",
                  esocial: tarefaEsocialId !== null && item.tarefaId === tarefaEsocialId,
                  fluxoDatas: Object.fromEntries(item.fluxoDatas.map((datada) => [chaveDoCaminho(datada.caminho), datada])),
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
  }, [id, recarga, consultaPrevia]);

  const ehDiaUtil = useMemo(() => criarCalendario(detalhe?.feriados ?? []), [detalhe?.feriados]);
  // A fatal conta só dias úteis fora do recesso forense; Enviar/Revisar/Protocolar seguem o expediente.
  const contaPrazo = useMemo(() => criarCalendarioDePrazo(detalhe?.feriados ?? []), [detalhe?.feriados]);
  // Responsável e Revisor: só quem é da área da publicação, com foto; a última linha da lista abre todas as pessoas.
  const pessoasDoCampo = useMemo((): PessoasDoCampo => {
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
  }, [detalhe]);

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
        return { ...linha, ...mudanca, ...horaFimAcompanha, ...(outroTipo && !mudanca.fluxoDatas ? { fluxoDatas: {} } : {}) };
      })
    );
  }

  /** Data de uma tarefa do Fluxo do VIOS mudada pela pessoa; null volta à data do VIOS. */
  function mudarDataDoFluxo(linha: Linha, caminho: string[], data: string | null) {
    const chave = chaveDoCaminho(caminho);
    const fluxoDatas = { ...linha.fluxoDatas };
    if (data) fluxoDatas[chave] = { caminho, data };
    else delete fluxoDatas[chave];
    alterar(linha.chave, { fluxoDatas });
  }

  /** Mais uma tarefa, já com o responsável e o revisor sugeridos da pasta (no topo e no fim da lista). */
  function adicionarTarefa() {
    setLinhas((atuais) =>
      atuais.length >= 10
        ? atuais
        : [...atuais, novaLinha({ responsavel: detalhe?.responsavelSugerido ?? "", revisor: detalhe?.revisorSugerido ?? "" })]
    );
  }

  function trocarEtiqueta(linha: Linha, etiqueta: Etiqueta) {
    // No Prazo o revisor é obrigatório: sugere o auxiliar da pasta se ainda estiver vazio. Providência não tem revisor.
    alterar(linha.chave, {
      etiqueta,
      tarefa: "",
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
          horaFim: horaFinalPadrao(tarefa.hora),
          responsavel: opcao.responsaveis?.length ? opcao.responsaveis.join(", ") : detalhe.responsavelSugerido ?? "",
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

  /** "Usar N dias" no leitor: põe o prazo citado na primeira tarefa de Prazo (ou cria uma). */
  function usarDias(dias: number, contagem: ContagemPrazo | null) {
    const dataPublicacao = detalhe?.publicacao.dataPublicacao;
    if (!dataPublicacao) return;
    setLinhas((atuais) => {
      const alvo = atuais.find((linha) => linha.etiqueta === "PRAZO" && !linha.esocial);
      const contagemPrazo = contagem ?? alvo?.contagemPrazo ?? "uteis";
      const mudanca = { diasPrazo: dias, contagemPrazo, dataFatal: fatalPorContagem(dataPublicacao, dias, contagemPrazo, contaPrazo) };
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
            data: linha.etiqueta === "PRAZO" ? "" : linha.data,
            dataFatal: linha.etiqueta === "PRAZO" ? linha.dataFatal : null,
            diasPrazo: linha.etiqueta === "PRAZO" ? linha.diasPrazo : null,
            contagemPrazo: linha.etiqueta === "PRAZO" && linha.diasPrazo ? linha.contagemPrazo : null,
            hora: linha.etiqueta === "COMPROMISSO" ? linha.hora : null,
            horaFim: linha.etiqueta === "COMPROMISSO" ? linha.horaFim || null : null,
            responsavel: linha.responsavel,
            revisor: linha.etiqueta === "PROVIDENCIA" ? null : linha.revisor || null,
            observacao: linha.observacao || null,
            fluxoDatas: Object.values(linha.fluxoDatas),
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
    // O bloco de cima continua visível: na controladoria, trocar o escritório resolve uma área sem lista de tarefas.
    return (
      <div className="space-y-3">
        {antesDasTarefas}
        {erro ? <Aviso tom="erro">{erro}</Aviso> : <Painel><Carregando rotulo="Carregando a publicação" /></Painel>}
      </div>
    );
  }

  const { publicacao, catalogo } = detalhe;
  // Sem o tipo Inserir E-social no VIOS, Acordo homologado e Homologação de cálculo não podem ser enviados.
  const faltaTarefaEsocial = Boolean(detalhe.esocial && pedeTarefaEsocial(esocial) && !detalhe.esocial.tarefa);
  const completo = linhas.every(linhaCompleta) && !faltaTarefaEsocial;
  const incompletas = linhas.filter((linha) => !linhaCompleta(linha)).length;
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
            {/* Faixa azul-marinho: o processo aberto fica marcado no topo da coluna. */}
            <FaixaDoProcesso
              numero={publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}
              tribunal={publicacao.tribunal}
              tituloId="publicacao-titulo"
              risco={Boolean(publicacao.demandaRisco)}
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
              <LeitorPublicacao publicacao={publicacao} partesNoCabecalho onUsarDias={catalogo && publicacao.dataPublicacao ? usarDias : undefined} />
            </div>
          </Painel>
        </div>

        <div className="min-h-0 space-y-3 @4xl:h-full @4xl:overflow-y-auto @4xl:pr-1">
          {antesDasTarefas}
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
                {/* Cabeçalho do bloco: o que é, quantas tarefas vão, o eSocial (Trabalhista) e o botão de incluir outra. */}
                <div className="space-y-3 rounded-t-lg border-b border-[#e6eef0] bg-[#fafcfc] px-4 py-3">
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
                    const fluxo = tarefaId ? detalhe.fluxos[tarefaId] ?? null : null;
                    // Sem tarefa escolhida (ou sem o fluxo carregado) mostra o fluxo padrão; o servidor recalcula ao gravar.
                    const cadeiaFluxo = !tarefaId || detalhe.fluxosErro ? CADEIA_PADRAO : cadeiaDoFluxo(fluxo);
                    const cadeia = prazo && linha.dataFatal ? datasDoPrazo(linha.dataFatal, ehDiaUtil, cadeiaFluxo) : null;
                    // O VIOS data o fluxo a partir da data que recebe (no Prazo, o Enviar) e do dia do lançamento.
                    const previstas = fluxo
                      ? fluxoPrevisto(
                          { data: (prazo ? cadeia?.enviar : linha.data) ?? "", responsavel: linha.responsavel, revisor: linha.revisor || null },
                          fluxo,
                          ehDiaUtil,
                          { hoje: detalhe.hoje, datas: Object.values(linha.fluxoDatas) }
                        )
                      : [];
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
                    const IconeClasse = ICONE_CLASSE[linha.etiqueta];
                    const pronta = linhaCompleta(linha);
                    return (
                      <li
                        key={linha.chave}
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
                                        ...(fixos.length
                                          ? { responsavel: fixos.join(", ") }
                                          : eraDoTipo
                                            ? { responsavel: detalhe.responsavelSugerido ?? "" }
                                            : {}),
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

                          <BlocoTarefa titulo={prazo ? "Prazo" : linha.etiqueta === "COMPROMISSO" ? "Data e horário" : "Data"} icone={CalendarDays}>
                            {prazo ? (
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
                                        className={cn(
                                          "h-10 min-w-8 px-1.5 tabular-nums",
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
                                  {/* Úteis ou corridos e a fatal andam juntos: se faltar espaço, descem os dois. */}
                                  <div className="flex items-end gap-2">
                                    <div className="space-y-1.5">
                                    <span className="block text-xs font-medium text-muted-foreground">Contagem</span>
                                    <ContagemDoPrazo
                                      rotulo={`Contagem do prazo da tarefa ${indice + 1}`}
                                      valor={linha.contagemPrazo ?? "uteis"}
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
                                        onChange={(data) => alterar(linha.chave, { dataFatal: data, diasPrazo: null })}
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
                                    ]}
                                  />
                                ) : null}
                                {tarefaId && !cadeiaFluxo ? (
                                  <p className="text-xs text-muted-foreground">
                                    O VIOS não cria Revisar nem Protocolar para esta tarefa: ela vai com a data do protocolo (1 dia útil antes da fatal).
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
                              </div>
                            )}
                            {avisos.length ? (
                              <p className="flex items-center gap-1.5 text-xs text-amber-800">
                                <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                                {avisos.join(" ")}
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

                          <BlocoTarefa titulo="Observação" icone={MessageSquareText} acao={<span className="text-[11px] font-normal text-muted-foreground">opcional · vai na descrição da tarefa no VIOS</span>}>
                            <Textarea
                              aria-label={`Observação da tarefa ${indice + 1}`}
                              value={linha.observacao}
                              onChange={(evento) => alterar(linha.chave, { observacao: evento.target.value })}
                              maxLength={2000}
                              rows={2}
                              placeholder="O que fazer e por quê"
                              className="bg-white"
                            />
                          </BlocoTarefa>

                          {fluxo && previstas.length ? (
                            <FluxoNoVios
                              previstas={previstas}
                              principal={{
                                rotulo: prazo && cadeia?.protocolar ? "Enviar no VIOS" : "Tarefa no VIOS",
                                nome: linha.tarefa,
                                data: (prazo ? cadeia?.enviar : linha.data) || null,
                                etiqueta: linha.etiqueta,
                                responsaveis: linha.responsavel,
                              }}
                              fatal={prazo ? linha.dataFatal || null : null}
                              foto={pessoasDoCampo.foto}
                              hoje={detalhe.hoje}
                              ehDiaUtil={ehDiaUtil}
                              onMudarData={(caminho, data) => mudarDataDoFluxo(linha, caminho, data)}
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
                        : `Complete ${incompletas === 1 ? "a tarefa marcada" : `as ${incompletas} tarefas marcadas`}: tarefa, data${linhas.some((linha) => linha.etiqueta === "PRAZO") ? ", revisor" : ""} e responsável.`}
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
  /** A vistar (a fila) ou Agendadas (o que já foi vistado e onde está cada tarefa). */
  const [visao, setVisao] = useState<"fila" | "agendadas">("fila");
  const [escritorio, setEscritorio] = useState("");
  const [publicacoes, setPublicacoes] = useState<PublicacaoResumo[] | null>(null);
  const [porEscritorio, setPorEscritorio] = useState<Record<string, number>>({});
  /** Áreas do usuário do jurídico; null é a controladoria (todas). */
  const [areas, setAreas] = useState<string[] | null>(null);
  /** Quem não vista demanda de risco (Usuários › acesso) não recebe as de risco: o filtro sai. */
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
  /** Dia em que a publicação chegou no Orquestra (AAAA-MM-DD); vazio é "Todas as datas". */
  const [dataImportacao, setDataImportacao] = useState("");
  /** A fila abre sempre aberta, estreita; o botão à esquerda do número do processo recolhe. */
  const [filaRecolhida, setFilaRecolhida] = useState(false);
  /** Na fila, cada grupo vem recolhido (menos o da publicação aberta); aqui ficam os que a pessoa inverteu. */
  const [gruposAlternados, setGruposAlternados] = useState<Set<string>>(() => new Set());

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
  const importacoesDaFila = useMemo(() => (publicacoes ?? []).map((publicacao) => publicacao.dataImportacao), [publicacoes]);
  const importacaoAtiva = dataNaLista(dataImportacao, importacoesDaFila);
  // O que a busca olha em cada publicação (inclui as partes do texto): montado uma vez por carga, não a cada letra.
  const camposDeBusca = useMemo(() => new Map((publicacoes ?? []).map((publicacao) => [publicacao.id, camposDaPublicacao(publicacao)])), [publicacoes]);
  const filtradas = useMemo(() => {
    return (publicacoes ?? []).filter((publicacao) => {
      if (importacaoAtiva && publicacao.dataImportacao !== importacaoAtiva) return false;
      if (grupoAtivo && (publicacao.grupoCliente?.trim() || SEM_GRUPO) !== grupoAtivo) return false;
      if (tribunalAtivo && tribunalDe(publicacao) !== tribunalAtivo) return false;
      if (risco === "risco" && !publicacao.demandaRisco) return false;
      if (risco === "normal" && publicacao.demandaRisco) return false;
      return combinaCampos(camposDeBusca.get(publicacao.id) ?? [], busca);
    });
  }, [publicacoes, busca, grupoAtivo, tribunalAtivo, risco, importacaoAtiva, camposDeBusca]);
  const filtrosAtivos = Boolean(busca.trim() || grupoAtivo || tribunalAtivo || risco || importacaoAtiva);
  const grupos = useMemo(() => agruparFila(filtradas), [filtradas]);
  // Mesma ordem da lista: é por ela que o editor anda para a anterior e a próxima.
  const ordem = useMemo(() => grupos.flatMap((item) => item.publicacoes.map((publicacao) => publicacao.id)), [grupos]);
  const aberta = selecionada && ordem.includes(selecionada) ? selecionada : ordem[0] ?? null;
  const grupoDe = (id: string | null) => (id ? grupos.find((item) => item.publicacoes.some((publicacao) => publicacao.id === id))?.nome ?? null : null);
  const grupoDaAberta = grupoDe(aberta);
  const grupoAberto = (nome: string) => (nome === grupoDaAberta) !== gruposAlternados.has(nome);
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

  function abrir(id: string) {
    setSelecionada(id);
    setListaNoCelular(false);
    setAviso("");
    // O grupo da publicação aberta fica aberto na fila, mesmo que a pessoa o tenha recolhido antes.
    const grupoNovo = grupoDe(id);
    if (grupoNovo && gruposAlternados.has(grupoNovo)) {
      setGruposAlternados((atual) => {
        const proximo = new Set(atual);
        proximo.delete(grupoNovo);
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

  function limparFiltros() {
    setBusca("");
    setGrupo("");
    setTribunal("");
    setRisco("");
    setDataImportacao("");
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
      const chave = p?.escritorioResponsavel ?? "Sem área";
      return { ...atual, [chave]: Math.max(0, (atual[chave] ?? 1) - 1) };
    });
  }

  return (
    <div className="space-y-4">
      {/* Uma linha só: "A vistar / Agendadas" à esquerda e os filtros do tamanho do conteúdo (sem nada escolhido,
          só o ícone e o nome do filtro). Em tela estreita, os filtros descem de linha. */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Visão do jurídico"
          value={visao}
          options={[
            { value: "fila", label: `A vistar${publicacoes ? ` ${publicacoes.length}` : ""}` },
            { value: "agendadas", label: "Vistado" },
          ]}
          onChange={setVisao}
        />
        <Busca
          className="sm:w-52"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Processo, cliente ou CI"
          aria-label="Buscar publicação"
        />
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
            {veRisco ? <FiltroDemanda valor={risco} riscos={riscos} normais={(publicacoes?.length ?? 0) - riscos} onChange={setRisco} /> : null}
            {filtrosAtivos && publicacoes ? (
              <Button type="button" variant="ghost" size="sm" className="text-[#347796]" onClick={limparFiltros} title="Mostrar todas de novo">
                <X />
                Limpar ({filtradas.length} de {publicacoes.length})
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {areas && areas.length === 0 ? (
        <Aviso tom="alerta">Nenhuma área marcada para você. Peça à controladoria para liberar as suas.</Aviso>
      ) : null}

      {aviso ? <Aviso tom="sucesso">{aviso}</Aviso> : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {visao === "agendadas" ? (
        <AgendadasJuridico key={escritorio} escritorio={escritorio} busca={busca} />
      ) : (
        /* No desktop, lista e publicação rolam cada uma no seu painel (o main do app não deixa usar sticky). */
        <div
          className={cn(
            "grid gap-4 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[30rem]",
            filaRecolhida ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(230px,270px)_minmax(0,1fr)]"
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
                    <h3 className="sticky top-0 z-10 border-b border-[#e6eef0] bg-[#f7fbfc] text-xs font-semibold text-[#285f7a]">
                      <button
                        type="button"
                        aria-expanded={grupoAberto(bloco.nome)}
                        onClick={() => alternarGrupo(bloco.nome)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-[#eef6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]/50"
                      >
                        <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", grupoAberto(bloco.nome) && "rotate-90")} aria-hidden />
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
                    <ul className={cn("divide-y divide-[#eef3f5]", !grupoAberto(bloco.nome) && "hidden")}>
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
                              {publicacao.devolucaoMotivo || publicacao.devolvidoEm ? <Selo tom="alerta">Devolvida</Selo> : null}
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
