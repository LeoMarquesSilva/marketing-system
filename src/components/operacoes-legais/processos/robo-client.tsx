"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  FileText,
  Hourglass,
  ListOrdered,
  LoaderCircle,
  Paperclip,
  RefreshCw,
  ScanText,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RespostaDoPainel } from "@/lib/processos/painel-robo-server";
import type { EstadoDosAutos, PedidoAberto, ProcessoNoPainel } from "@/lib/processos/painel-robo";
import { ROTULO_SISTEMA, type SistemaTribunal } from "@/lib/processos/tribunais";
import { cn } from "@/lib/utils";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Aviso, CabecalhoLista, Carregando, Indicador, Indicadores, Painel, PainelTopo, Selo, Vazio, type TomSelo } from "../vistagem/ui";
import { AcessoProcessos } from "./acesso-processos";
import { mensagemDeErro, processosApi } from "./processos-api";

export function RoboClient() {
  return (
    <AcessoProcessos>
      <Robo />
    </AcessoProcessos>
  );
}

/* ------------------------------------------------------------ vocabulário */

/**
 * Os estados dos autos de um processo, na ordem do caminho: do que já está pronto ao que ainda nem foi pedido.
 * A cor é de estado (verde pronto, âmbar depende de alguém, vermelho falhou, cinza parado) e nunca vem sozinha:
 * cada uma tem ícone e rótulo na legenda.
 */
const ESTADOS: { chave: EstadoDosAutos; rotulo: string; explicacao: string; cor: string; icone: LucideIcon }[] = [
  { chave: "lido", rotulo: "Lidos pela IA", explicacao: "Autos baixados e lidos: as sugestões já estão na ficha.", cor: "#0f9f6e", icone: Sparkles },
  { chave: "a_ler", rotulo: "Baixados, a ler", explicacao: "Autos baixados, com leitura da IA pendente ou em andamento.", cor: "#5b5891", icone: ScanText },
  { chave: "leitura_falhou", rotulo: "Leitura falhou", explicacao: "Autos baixados, mas a IA não conseguiu ler nenhum documento.", cor: "#c2410c", icone: FileText },
  { chave: "na_fila", rotulo: "Na fila do robô", explicacao: "Pedido feito: esperando a vez ou baixando agora.", cor: "#3e84a8", icone: Hourglass },
  { chave: "aguardando_pessoa", rotulo: "Esperando uma pessoa", explicacao: "O robô parou num login, código do tribunal, CAPTCHA ou segredo de justiça.", cor: "#d97706", icone: UserRound },
  { chave: "falhou", rotulo: "Download falhou", explicacao: "O último pedido ao robô terminou em erro e ainda não há autos.", cor: "#dc2626", icone: CircleAlert },
  { chave: "nunca_pedido", rotulo: "Nunca pedidos", explicacao: "Há robô para o tribunal, mas ninguém pediu os autos ainda.", cor: "#b6c4cc", icone: CircleDashed },
  { chave: "sem_robo", rotulo: "Sem robô", explicacao: "Ainda não há robô para o tribunal ou falta o número CNJ: o PDF é anexado à mão na ficha.", cor: "#64748b", icone: Paperclip },
];
const ESTADO = Object.fromEntries(ESTADOS.map((item) => [item.chave, item])) as Record<EstadoDosAutos, (typeof ESTADOS)[number]>;
/** Estados em que pedir (de novo) ao robô faz sentido. */
const PEDIVEIS: EstadoDosAutos[] = ["falhou", "nunca_pedido"];

const COR = { baixado: "#3e84a8", erro: "#dc2626", aberto: "#b6c4cc", pendente: "#d97706", aprovada: "#0f9f6e", recusada: "#94a3b8" };

const ESPERA: Record<string, string> = { login: "login do tribunal", segundo_fator: "código de verificação", captcha: "CAPTCHA", segredo_justica: "segredo de justiça" };

const STATUS_PEDIDO: Record<string, { tom: TomSelo; rotulo: string }> = {
  pendente: { tom: "neutro", rotulo: "Na fila" },
  em_andamento: { tom: "marca", rotulo: "Baixando" },
  aguardando_pessoa: { tom: "alerta", rotulo: "Esperando uma pessoa" },
};

/* ----------------------------------------------------------------- textos */

const numero = (valor: number) => valor.toLocaleString("pt-BR");
const plural = (quantidade: number, um: string, varios: string) => `${numero(quantidade)} ${quantidade === 1 ? um : varios}`;
const sistemaDe = (sistema: string | null) => (sistema ? (ROTULO_SISTEMA[sistema as SistemaTribunal] ?? sistema).replace(/\s*\(.*\)$/, "") : null);

function hora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function diaMes(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

/** "16:40" se for hoje; "25/11 09:10" se cair em outro dia. */
function quando(iso: string, agora: number): string {
  const mesmoDia = new Date(iso).toDateString() === new Date(agora).toDateString();
  return mesmoDia ? hora(iso) : `${diaMes(iso)} ${hora(iso)}`;
}

function duracao(minutos: number): string {
  if (minutos < 1) return `${Math.max(5, Math.round((minutos * 60) / 5) * 5)} s`;
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);
  if (horas < 24) return resto ? `${horas} h ${resto} min` : `${horas} h`;
  const dias = Math.floor(horas / 24);
  return `${dias} dia${dias === 1 ? "" : "s"}${horas % 24 ? ` ${horas % 24} h` : ""}`;
}

const ha = (iso: string, agora: number) => `há ${duracao(Math.max(0, (agora - Date.parse(iso)) / 60_000))}`;

/* ------------------------------------------------------------------ peças */

interface Fatia {
  chave: string;
  rotulo: string;
  valor: number;
  cor: string;
}

/**
 * Barra de partes de um todo: uma fatia por estado, com 2 px de fundo entre elas. O número aparece dentro quando
 * cabe; quem não cabe está na legenda, que sempre acompanha a barra. Com `onEscolher`, a fatia é filtro.
 */
function BarraDePartes({ fatias, altura = "h-9", escolhida, onEscolher, rotulo }: { fatias: Fatia[]; altura?: string; escolhida?: string | null; onEscolher?: (chave: string) => void; rotulo: string }) {
  const total = fatias.reduce((soma, fatia) => soma + fatia.valor, 0);
  const visiveis = fatias.filter((fatia) => fatia.valor > 0);
  if (!total) return <div className={cn("rounded bg-[#eef3f5]", altura)} role="img" aria-label={`${rotulo}: sem dados`} />;
  return (
    <div className={cn("flex w-full gap-0.5", altura)} role="group" aria-label={rotulo}>
      {visiveis.map((fatia, indice) => {
        const parte = fatia.valor / total;
        const dica = `${fatia.rotulo}: ${numero(fatia.valor)} (${Math.round(parte * 100)}%)`;
        const classe = cn(
          "flex min-w-1.5 items-center justify-center overflow-hidden text-xs font-semibold tabular-nums text-white transition-opacity duration-150",
          indice === 0 && "rounded-l",
          indice === visiveis.length - 1 && "rounded-r",
          escolhida && escolhida !== fatia.chave && "opacity-35"
        );
        const estilo = { flexGrow: fatia.valor, flexBasis: 0, backgroundColor: fatia.cor };
        const dentro = parte >= 0.07 ? <span className="px-1 [text-shadow:0_1px_1px_rgba(0,0,0,0.25)]">{numero(fatia.valor)}</span> : null;
        return onEscolher ? (
          <button
            key={fatia.chave}
            type="button"
            title={dica}
            aria-label={dica}
            aria-pressed={escolhida === fatia.chave}
            onClick={() => onEscolher(fatia.chave)}
            className={cn(classe, "hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10293a] focus-visible:ring-offset-1")}
            style={estilo}
          >
            {dentro}
          </button>
        ) : (
          <div key={fatia.chave} title={dica} className={classe} style={estilo}>
            {dentro}
          </div>
        );
      })}
    </div>
  );
}

function Legenda({ itens }: { itens: { rotulo: string; cor: string; valor?: number }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {itens.map((item) => (
        <li key={item.rotulo} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: item.cor }} aria-hidden />
          {item.rotulo}
          {item.valor !== undefined ? <span className="font-medium tabular-nums text-foreground">{numero(item.valor)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Um número com rótulo, para as faixas internas (leitura da IA). */
function Dado({ rotulo, valor, apoio }: { rotulo: string; valor: ReactNode; apoio?: ReactNode }) {
  return (
    <div className="min-w-0 bg-white px-4 py-3">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#10293a]">{valor}</p>
      {apoio ? <p className="text-xs text-muted-foreground">{apoio}</p> : null}
    </div>
  );
}

/** Downloads por dia: colunas empilhadas (baixados embaixo, erros em cima), com o total só no pico e em hoje. */
function GraficoPorDia({ dias }: { dias: RespostaDoPainel["porDia"] }) {
  const maximo = Math.max(1, ...dias.map((dia) => dia.concluidos + dia.erros));
  const pico = dias.reduce((melhor, dia, indice) => (dia.concluidos + dia.erros > dias[melhor].concluidos + dias[melhor].erros ? indice : melhor), 0);
  const ALTURA = 112;
  return (
    <div>
      <div className="flex items-end gap-1.5 border-b border-[#dce9eb]" style={{ height: ALTURA + 18 }}>
        {dias.map((dia, indice) => {
          const total = dia.concluidos + dia.erros;
          const rotulo = `${dia.dia.slice(8)}/${dia.dia.slice(5, 7)}`;
          const dica = `${rotulo}: ${plural(dia.concluidos, "baixado", "baixados")}, ${plural(dia.erros, "erro", "erros")}`;
          const mostrarTotal = total > 0 && (indice === pico || indice === dias.length - 1);
          return (
            <div key={dia.dia} title={dica} aria-label={dica} role="img" className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 hover:bg-[#f6fafb]" style={{ height: ALTURA + 18 }}>
              <span className={cn("text-[11px] font-medium tabular-nums text-[#10293a]", !mostrarTotal && "opacity-0 group-hover:opacity-100")}>{total || ""}</span>
              {dia.erros ? <span className="w-full max-w-7 rounded-t-[3px]" style={{ height: Math.max(3, (dia.erros / maximo) * ALTURA), backgroundColor: COR.erro }} /> : null}
              {dia.concluidos ? (
                <span className={cn("w-full max-w-7", !dia.erros && "rounded-t-[3px]")} style={{ height: Math.max(3, (dia.concluidos / maximo) * ALTURA), backgroundColor: COR.baixado }} />
              ) : null}
              {!total ? <span className="h-px w-full max-w-7 bg-[#c9d6dc]" /> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {dias.map((dia, indice) => (
          <span key={dia.dia} className={cn("min-w-0 flex-1 text-center text-[11px] tabular-nums text-muted-foreground", indice % 2 !== (dias.length - 1) % 2 && "invisible sm:visible")}>
            {dia.dia.slice(8)}/{dia.dia.slice(5, 7)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- tela */

const COLUNAS_FILA = "lg:grid lg:grid-cols-[3rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_8rem_8rem_5.5rem] lg:items-center lg:gap-4";
const COLUNAS_PROCESSO = "lg:grid lg:grid-cols-[5rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,2fr)_9rem_6rem] lg:items-center lg:gap-4";
const LIMITE_LISTA = 40;

function Robo() {
  const [painel, setPainel] = useState<RespostaDoPainel | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [soAtivos, setSoAtivos] = useState(true);
  const [estado, setEstado] = useState<EstadoDosAutos | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [tudo, setTudo] = useState(false);
  const [confirmar, setConfirmar] = useState<{ refazer: boolean; ids: string[] } | null>(null);
  const [ocupado, setOcupado] = useState("");

  useEffect(() => {
    let ativo = true;
    processosApi.get<RespostaDoPainel>("/autos/painel").then(
      (resposta) => {
        if (!ativo) return;
        setPainel(resposta);
        setErro("");
      },
      (falha: unknown) => {
        if (ativo) setErro(mensagemDeErro(falha));
      }
    );
    return () => {
      ativo = false;
    };
  }, [tentativa]);

  // Com fila ou leitura em andamento, a tela se recarrega a cada 20 s; parada, a cada 2 min.
  const trabalhando = Boolean(painel && (painel.abertos.length > 0 || painel.leitura.lendo > 0));
  useEffect(() => {
    const relogio = window.setInterval(() => setTentativa((atual) => atual + 1), trabalhando ? 20_000 : 120_000);
    return () => window.clearInterval(relogio);
  }, [trabalhando]);

  const processos = useMemo(() => (painel?.processos ?? []).filter((processo) => !soAtivos || processo.ativo), [painel, soAtivos]);
  const porEstado = useMemo(() => {
    const contagem = Object.fromEntries(ESTADOS.map((item) => [item.chave, 0])) as Record<EstadoDosAutos, number>;
    for (const processo of processos) contagem[processo.estado] += 1;
    return contagem;
  }, [processos]);
  // Processos cujo pedido mais recente terminou em erro (com ou sem autos de antes), agrupados pelo motivo.
  const errosPorMotivo = useMemo(() => {
    const grupos = new Map<string, { motivo: string; quantidade: number; ultimoEm: string }>();
    for (const processo of processos) {
      const pedido = processo.ultimoPedido;
      if (pedido?.status !== "erro") continue;
      const chave = pedido.erro ?? "Erro sem descrição";
      const grupo = grupos.get(chave) ?? { motivo: chave, quantidade: 0, ultimoEm: pedido.em };
      grupo.quantidade += 1;
      if (pedido.em > grupo.ultimoEm) grupo.ultimoEm = pedido.em;
      grupos.set(chave, grupo);
    }
    return [...grupos.values()].sort((a, b) => b.quantidade - a.quantidade || b.ultimoEm.localeCompare(a.ultimoEm));
  }, [processos]);
  const daLista = useMemo(() => {
    const ordem = (processo: ProcessoNoPainel) => processo.ultimoPedido?.em ?? "";
    const comErro = (processo: ProcessoNoPainel) => processo.ultimoPedido?.status === "erro" && (motivo === "" || (processo.ultimoPedido.erro ?? "Erro sem descrição") === motivo);
    return processos.filter((processo) => (motivo !== null ? comErro(processo) : !estado || processo.estado === estado)).sort((a, b) => ordem(b).localeCompare(ordem(a)) || (a.ci ?? "").localeCompare(b.ci ?? "", "pt-BR", { numeric: true }));
  }, [processos, estado, motivo]);

  if (!painel) {
    return erro ? (
      <Aviso tom="erro" acao={<Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => setTentativa((atual) => atual + 1)}><RefreshCw /> Tentar de novo</Button>}>
        {erro}
      </Aviso>
    ) : (
      <Carregando rotulo="Carregando o painel do robô" />
    );
  }

  const agora = Date.parse(painel.geradoEm);
  const { fila, projecao, leitura, sugestoes } = painel;
  const comAutos = porEstado.lido + porEstado.a_ler + porEstado.leitura_falhou;
  const total = processos.length;
  const naoRodaram = porEstado.nunca_pedido + porEstado.sem_robo + porEstado.falhou;
  const filaTotal = fila.pendentes + fila.baixando;
  const escopo = soAtivos ? "processos ativos" : "processos";

  async function pedir(ids: string[]) {
    setOcupado("pedir");
    setErro("");
    setFeito("");
    try {
      const { resultado } = await processosApi.post<{ resultado: { pedidos: number; emAndamento: number; semRobo: number } }>("/autos/atualizar", { ids });
      setFeito(
        [
          `${plural(resultado.pedidos, "processo entrou", "processos entraram")} na fila do robô.`,
          resultado.emAndamento ? `${plural(resultado.emAndamento, "já estava", "já estavam")} na fila.` : "",
          resultado.semRobo ? `${plural(resultado.semRobo, "ficou", "ficaram")} de fora: sem robô para o tribunal ou em segredo de justiça.` : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
      setConfirmar(null);
      setTentativa((atual) => atual + 1);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setOcupado("");
    }
  }

  async function cancelar(pedido: PedidoAberto) {
    setOcupado(pedido.id);
    setErro("");
    try {
      await processosApi.post(`/autos/pedidos/${pedido.id}`, { acao: "cancelar" });
      setTentativa((atual) => atual + 1);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setOcupado("");
    }
  }

  const previsao = projecao.parada ? "Parada" : projecao.fimEm ? quando(projecao.fimEm, agora) : filaTotal ? "Sem base" : "Fila vazia";
  const visiveis = tudo ? daLista : daLista.slice(0, LIMITE_LISTA);
  const pediveis = motivo !== null || (estado && PEDIVEIS.includes(estado)) ? daLista : [];
  const comErro = errosPorMotivo.reduce((soma, item) => soma + item.quantidade, 0);
  /** Filtra a lista de processos (por estado, ou pelos que falharam: "" = todos, texto = um motivo) e leva até ela. */
  const filtrar = (novoEstado: EstadoDosAutos | null, novoMotivo: string | null = null, rolar = false) => {
    setEstado(novoEstado);
    setMotivo(novoMotivo);
    setTudo(false);
    if (rolar) document.getElementById("robo-lista")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-4">
      {/* Robôs: quem está baixando e quando deu o último sinal */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2">
          {painel.robos.length ? (
            painel.robos.map((robo) => {
              const minutos = (agora - Date.parse(robo.ultimoSinalEm)) / 60_000;
              const vivo = robo.baixando > 0 || minutos <= 20;
              return (
                <li key={robo.nome} className="flex items-center gap-2 text-sm" title={`${numero(robo.concluidos)} baixados e ${numero(robo.erros)} erros no total`}>
                  <span className="relative flex size-2.5">
                    {robo.baixando ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /> : null}
                    <span className={cn("relative inline-flex size-2.5 rounded-full", robo.baixando ? "bg-emerald-500" : vivo ? "bg-[#3e84a8]" : "bg-slate-300")} />
                  </span>
                  <Bot className="size-4 text-[#3e84a8]" aria-hidden />
                  <span className="font-medium text-foreground">{robo.nome}</span>
                  <span className="text-muted-foreground">{robo.baixando ? `baixando ${robo.baixando} agora` : `último sinal ${ha(robo.ultimoSinalEm, agora)}`}</span>
                </li>
              );
            })
          ) : (
            <li className="text-sm text-muted-foreground">Nenhum robô atendeu pedidos ainda.</li>
          )}
        </ul>
        <span className="text-xs text-muted-foreground">
          {painel.fonte === "jusbr" ? "Pedidos vão primeiro ao Jus.br" : "Pedidos vão ao robô de cada tribunal"} · atualizado às {hora(painel.geradoEm)}
        </span>
        <Button size="sm" variant="outline" onClick={() => setTentativa((atual) => atual + 1)}>
          <RefreshCw /> Atualizar
        </Button>
      </div>

      <Indicadores>
        <Indicador icone={ListOrdered} rotulo="Na fila agora" valor={numero(fila.pendentes)} tom={projecao.parada ? "alerta" : "neutro"}>
          {fila.baixando ? `${plural(fila.baixando, "baixando", "baixando")} agora` : "nenhum download em andamento"}
          {fila.aguardandoPessoa ? ` · ${plural(fila.aguardandoPessoa, "esperando uma pessoa", "esperando uma pessoa")}` : ""}
        </Indicador>
        <Indicador icone={CalendarClock} rotulo="Previsão de término da fila" valor={previsao} tom={projecao.parada ? "perigo" : "neutro"}>
          {projecao.parada
            ? "há pedido esperando e nenhum robô deu sinal"
            : projecao.minutosPorPedido !== null
              ? `≈ ${duracao(projecao.minutosPorPedido)} por processo${projecao.emParalelo > 1 ? `, ${projecao.emParalelo} robôs ao mesmo tempo` : ""}`
              : "ainda sem downloads para medir o ritmo"}
        </Indicador>
        <Indicador icone={CircleCheck} rotulo="Autos baixados" valor={`${numero(comAutos)} de ${numero(total)}`} tom="sucesso">
          {total ? `${Math.round((comAutos / total) * 100)}% dos ${escopo}` : "nenhum processo"} · {plural(naoRodaram, "ainda sem autos", "ainda sem autos")}
        </Indicador>
        <Indicador icone={Sparkles} rotulo="Sugestões da IA a conferir" valor={numero(sugestoes.pendentes)} tom={sugestoes.pendentes ? "alerta" : "neutro"}>
          em {plural(sugestoes.processosComPendentes, "processo", "processos")} ·{" "}
          <Link href="/operacoes-legais/processos/saneamento" className="font-medium text-[#285f7a] underline-offset-2 hover:underline">
            abrir o saneamento
          </Link>
        </Indicador>
      </Indicadores>

      {feito ? <Aviso tom="sucesso">{feito}</Aviso> : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {projecao.parada ? (
        <Aviso tom="alerta" titulo="A fila está parada">
          Há {plural(fila.pendentes, "pedido", "pedidos")} esperando desde {fila.maisAntigoEm ? quando(fila.maisAntigoEm, agora) : "antes"} e nenhum robô deu sinal nos últimos 20 minutos. Confira se o robô está ligado.
        </Aviso>
      ) : null}
      {!painel.iaConfigurada ? <Aviso tom="alerta">A leitura pela IA está desligada neste servidor (falta a chave da OpenAI): os autos são baixados, mas não são lidos.</Aviso> : null}

      {/* A fila, item a item, com a previsão de cada um */}
      <Painel aria-labelledby="robo-fila">
        <PainelTopo
          id="robo-fila"
          titulo={`Fila do robô (${numero(painel.abertos.length)})`}
          descricao={
            projecao.fimEm
              ? `Deve terminar por volta de ${quando(projecao.fimEm, agora)}, daqui a ${duracao((Date.parse(projecao.fimEm) - agora) / 60_000)}. Estimativa pelo tempo médio dos últimos ${projecao.amostra} downloads.`
              : "Pedidos esperando a vez, baixando agora ou parados à espera de uma pessoa."
          }
        />
        {painel.abertos.length ? (
          <>
            <CabecalhoLista className={`hidden ${COLUNAS_FILA}`}>
              <span>Vez</span>
              <span>Processo</span>
              <span>Grupo do cliente</span>
              <span>Tribunal</span>
              <span>Situação</span>
              <span>Pedido</span>
              <span>Previsão</span>
              <span />
            </CabecalhoLista>
            <ul className="divide-y divide-[#e6eef0]">
              {painel.abertos.map((pedido) => {
                const selo = STATUS_PEDIDO[pedido.status] ?? { tom: "neutro" as TomSelo, rotulo: pedido.status };
                return (
                  <li key={pedido.id} className={`space-y-1 px-4 py-2.5 text-sm lg:space-y-0 ${COLUNAS_FILA}`}>
                    <span className="block tabular-nums text-muted-foreground">{pedido.posicao ? `${pedido.posicao}º` : pedido.status === "em_andamento" ? <LoaderCircle className="size-4 animate-spin text-[#3e84a8]" aria-label="Baixando" /> : "—"}</span>
                    <Link href={`/operacoes-legais/processos/${pedido.processoId}`} className="block truncate font-medium tabular-nums text-[#285f7a] underline-offset-2 hover:underline">
                      {pedido.cnj}
                    </Link>
                    <span className="block truncate text-foreground" title={pedido.grupoCliente ?? undefined}>
                      {pedido.grupoCliente ?? <span className="text-muted-foreground">—</span>}
                    </span>
                    <span className="block truncate text-foreground">
                      {pedido.tribunal} · {sistemaDe(pedido.sistema)}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Selo tom={selo.tom}>{selo.rotulo}</Selo>
                      {pedido.motivoEspera ? <span className="text-xs text-muted-foreground">{ESPERA[pedido.motivoEspera] ?? pedido.motivoEspera}</span> : null}
                      {pedido.robo && pedido.status !== "pendente" ? <span className="text-xs text-muted-foreground">{pedido.robo}</span> : null}
                      {pedido.iniciadoEm ? <span className="text-xs tabular-nums text-muted-foreground">· {ha(pedido.iniciadoEm, agora)}</span> : null}
                    </span>
                    <span className="block text-xs tabular-nums text-muted-foreground" title={new Date(pedido.criadoEm).toLocaleString("pt-BR")}>
                      {ha(pedido.criadoEm, agora)}
                    </span>
                    <span className="block tabular-nums text-foreground">
                      {pedido.previsaoEm ? (
                        `≈ ${quando(pedido.previsaoEm, agora)}`
                      ) : pedido.status === "aguardando_pessoa" ? (
                        <span className="text-xs text-muted-foreground">depende da pessoa</span>
                      ) : pedido.status === "em_andamento" && !projecao.parada ? (
                        <span className="text-xs text-muted-foreground">a qualquer momento</span>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="block lg:text-right">
                      <Button size="xs" variant="ghost" disabled={Boolean(ocupado)} onClick={() => void cancelar(pedido)}>
                        {ocupado === pedido.id ? <LoaderCircle className="animate-spin" /> : <X />} Cancelar
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <Vazio icone={ListOrdered} titulo="A fila está vazia">
            Nenhum pedido esperando. Hoje o robô baixou {plural(painel.hoje.concluidos, "processo", "processos")}
            {painel.hoje.erros ? ` e teve ${plural(painel.hoje.erros, "erro", "erros")}` : ""}.
          </Vazio>
        )}
      </Painel>

      {/* Cobertura: onde estão os autos de cada processo */}
      <Painel aria-labelledby="robo-cobertura">
        <PainelTopo id="robo-cobertura" titulo="Autos dos processos" descricao={`Onde estão os autos de cada um dos ${numero(total)} ${escopo}. Clique numa parte para ver os processos.`}>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-[#347796]"
              checked={soAtivos}
              onChange={(evento) => {
                setSoAtivos(evento.target.checked);
                filtrar(null);
              }}
            />
            Só processos ativos
          </label>
        </PainelTopo>
        <div className="space-y-3 px-4 py-4">
          <BarraDePartes
            rotulo="Processos por estado dos autos"
            fatias={ESTADOS.map((item) => ({ chave: item.chave, rotulo: item.rotulo, valor: porEstado[item.chave], cor: item.cor }))}
            escolhida={motivo === null ? estado : null}
            onEscolher={(chave) => filtrar(estado === chave && motivo === null ? null : (chave as EstadoDosAutos))}
          />
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {ESTADOS.filter((item) => porEstado[item.chave] > 0 || item.chave === "lido" || item.chave === "nunca_pedido").map((item) => {
              const Icone = item.icone;
              const ativo = motivo === null && estado === item.chave;
              return (
                <li key={item.chave}>
                  <button
                    type="button"
                    aria-pressed={ativo}
                    title={item.explicacao}
                    onClick={() => filtrar(ativo ? null : item.chave)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                      ativo ? "border-[#347796] bg-[#e8f8f8]" : "border-[#e6eef0] bg-white hover:bg-[#f6fafb]"
                    )}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md text-white" style={{ backgroundColor: item.cor }}>
                      <Icone className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-muted-foreground">{item.rotulo}</span>
                      <span className="block text-base font-semibold leading-5 tabular-nums text-[#10293a]">
                        {numero(porEstado[item.chave])}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">{total ? `${Math.round((porEstado[item.chave] / total) * 100)}%` : ""}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div id="robo-lista" className="flex scroll-mt-4 flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#e6eef0] bg-[#f7fbfc] px-4 py-2.5">
          <p className="min-w-0 flex-1 text-sm text-foreground">
            <span className="font-medium">{motivo !== null ? "Último pedido falhou" : estado ? ESTADO[estado].rotulo : "Todos os estados"}</span>
            <span className="text-muted-foreground">
              {" "}
              · {plural(daLista.length, "processo", "processos")}
              {motivo ? ` · ${motivo}` : motivo === null && estado ? ` · ${ESTADO[estado].explicacao}` : ""}
            </span>
          </p>
          {estado || motivo !== null ? (
            <Button size="xs" variant="ghost" onClick={() => filtrar(null)}>
              <X /> Limpar filtro
            </Button>
          ) : null}
          {pediveis.length ? (
            <Button size="sm" onClick={() => setConfirmar({ refazer: motivo !== null || estado === "falhou", ids: pediveis.map((processo) => processo.id) })}>
              <Send /> {motivo !== null || estado === "falhou" ? "Pedir de novo" : "Pedir ao robô"} ({numero(Math.min(pediveis.length, 500))})
            </Button>
          ) : null}
        </div>
        {daLista.length ? (
          <>
            <CabecalhoLista className={`hidden ${COLUNAS_PROCESSO}`}>
              <span>CI</span>
              <span>Processo</span>
              <span>Tribunal</span>
              <span>Estado dos autos</span>
              <span>Autos</span>
              <span className="lg:text-right">Sugestões</span>
            </CabecalhoLista>
            <ul className="divide-y divide-[#e6eef0]">
              {visiveis.map((processo) => {
                const item = ESTADO[processo.estado];
                const Icone = item.icone;
                const pedido = processo.ultimoPedido;
                return (
                  <li key={processo.id} className={`space-y-1 px-4 py-2.5 text-sm lg:space-y-0 ${COLUNAS_PROCESSO}`}>
                    <span className="block tabular-nums text-muted-foreground">{processo.ci ?? "—"}</span>
                    <Link href={`/operacoes-legais/processos/${processo.id}`} className="block truncate font-medium tabular-nums text-[#285f7a] underline-offset-2 hover:underline">
                      {processo.cnj ?? "sem número CNJ"}
                    </Link>
                    <span className="block truncate text-foreground">{[processo.tribunal, sistemaDe(processo.sistema)].filter(Boolean).join(" · ") || "—"}</span>
                    <span className="flex min-w-0 items-start gap-2">
                      <Icone className="mt-0.5 size-4 shrink-0" style={{ color: item.cor }} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-foreground">
                          {item.rotulo}
                          {pedido ? <span className="text-xs text-muted-foreground"> · {quando(pedido.em, agora)}{pedido.tentativas > 1 ? ` · ${pedido.tentativas} tentativas` : ""}</span> : null}
                        </span>
                        {pedido?.erro ? (
                          <span className="block break-words text-xs text-red-700">
                            {processo.estado === "falhou" ? "" : "A última atualização falhou: "}
                            {pedido.erro}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {processo.documentos ? `${plural(processo.documentos, "documento", "documentos")} · ${numero(processo.paginas)} pág.` : "—"}
                    </span>
                    <span className="block tabular-nums lg:text-right">{processo.sugestoesPendentes ? <Selo tom="alerta">{numero(processo.sugestoesPendentes)} a conferir</Selo> : <span className="text-muted-foreground">—</span>}</span>
                  </li>
                );
              })}
            </ul>
            {daLista.length > visiveis.length ? (
              <div className="border-t border-[#e6eef0] px-4 py-2.5 text-center">
                <Button size="sm" variant="ghost" onClick={() => setTudo(true)}>
                  Mostrar os outros {numero(daLista.length - visiveis.length)}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <Vazio icone={CircleCheck} titulo="Nenhum processo neste estado" />
        )}
      </Painel>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Atividade por dia */}
        <Painel aria-labelledby="robo-dias">
          <PainelTopo id="robo-dias" titulo="Downloads por dia" descricao={`Últimos ${painel.porDia.length} dias. Hoje: ${plural(painel.hoje.concluidos, "baixado", "baixados")}, ${plural(painel.hoje.erros, "erro", "erros")}.`} />
          <div className="space-y-3 px-4 py-4">
            <GraficoPorDia dias={painel.porDia} />
            <Legenda itens={[{ rotulo: "Baixados", cor: COR.baixado, valor: painel.porDia.reduce((soma, dia) => soma + dia.concluidos, 0) }, { rotulo: "Erros", cor: COR.erro, valor: painel.porDia.reduce((soma, dia) => soma + dia.erros, 0) }]} />
          </div>
        </Painel>

        {/* Por tribunal e sistema */}
        <Painel aria-labelledby="robo-tribunais">
          <PainelTopo id="robo-tribunais" titulo="Por tribunal e sistema" descricao="Todos os pedidos já feitos ao robô, por onde ele buscou os autos." />
          {painel.porTribunal.length ? (
            <div className="space-y-3 px-4 py-4">
              <ul className="space-y-2.5">
                {painel.porTribunal.map((linha) => {
                  const soma = linha.concluidos + linha.erros + linha.abertos;
                  const maior = Math.max(...painel.porTribunal.map((outra) => outra.concluidos + outra.erros + outra.abertos));
                  return (
                    <li key={`${linha.tribunal}|${linha.sistema}`} className="grid grid-cols-[9rem_minmax(0,1fr)_7.5rem] items-center gap-3 text-sm">
                      <span className="truncate text-foreground">
                        {linha.tribunal} <span className="text-muted-foreground">· {sistemaDe(linha.sistema)}</span>
                      </span>
                      <span className="block" style={{ width: `${Math.max(6, (soma / maior) * 100)}%` }}>
                        <BarraDePartes
                          altura="h-4"
                          rotulo={`${linha.tribunal} ${linha.sistema}`}
                          fatias={[
                            { chave: "ok", rotulo: "Baixados", valor: linha.concluidos, cor: COR.baixado },
                            { chave: "erro", rotulo: "Erros", valor: linha.erros, cor: COR.erro },
                            { chave: "aberto", rotulo: "Na fila", valor: linha.abertos, cor: COR.aberto },
                          ]}
                        />
                      </span>
                      <span className="text-right text-xs tabular-nums text-muted-foreground">
                        <span className="font-medium text-foreground">{numero(linha.concluidos)}</span> ok · {numero(linha.erros)} erro{linha.erros === 1 ? "" : "s"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Legenda itens={[{ rotulo: "Baixados", cor: COR.baixado }, { rotulo: "Erros", cor: COR.erro }, { rotulo: "Na fila", cor: COR.aberto }]} />
            </div>
          ) : (
            <Vazio icone={Bot} titulo="Nenhum pedido ao robô ainda" />
          )}
        </Painel>

        {/* Erros que ainda valem, por motivo */}
        <Painel aria-labelledby="robo-erros">
          <PainelTopo
            id="robo-erros"
            titulo={`Por que os downloads falharam (${numero(comErro)})`}
            descricao={`Os ${escopo} cujo pedido mais recente terminou em erro. Um pedido novo que dá certo tira o processo daqui. Clique num motivo para ver os processos.`}
          >
            {comErro ? (
              <Button size="sm" variant="outline" onClick={() => filtrar(null, "", true)}>
                Ver {comErro === 1 ? "o processo" : `os ${numero(comErro)} processos`}
              </Button>
            ) : null}
          </PainelTopo>
          {errosPorMotivo.length ? (
            <ul className="divide-y divide-[#e6eef0]">
              {errosPorMotivo.slice(0, 8).map((item) => (
                <li key={item.motivo}>
                  <button
                    type="button"
                    aria-pressed={motivo === item.motivo}
                    onClick={() => (motivo === item.motivo ? filtrar(null) : filtrar(null, item.motivo, true))}
                    className={cn(
                      "grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]",
                      motivo === item.motivo ? "bg-[#e8f8f8]" : "hover:bg-[#f6fafb]"
                    )}
                  >
                    <span className="text-right text-base font-semibold tabular-nums text-[#10293a]">{numero(item.quantidade)}</span>
                    <span className="min-w-0">
                      <span className="block break-words text-foreground">{item.motivo}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="h-1.5 rounded-full" style={{ width: `${Math.max(4, (item.quantidade / errosPorMotivo[0].quantidade) * 60)}%`, backgroundColor: COR.erro }} aria-hidden />
                        <span className="text-xs text-muted-foreground">último em {quando(item.ultimoEm, agora)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {errosPorMotivo.length > 8 ? <li className="px-4 py-2 text-xs text-muted-foreground">e mais {plural(errosPorMotivo.length - 8, "motivo", "motivos")}</li> : null}
            </ul>
          ) : (
            <Vazio icone={CircleCheck} titulo="Nenhum processo parado por erro" />
          )}
        </Painel>

        {/* Leitura pela IA */}
        <Painel aria-labelledby="robo-ia">
          <PainelTopo id="robo-ia" titulo="Leitura pela IA" descricao="O que a IA já leu dos autos baixados e o que ela propôs para o cadastro." />
          <div className="grid grid-cols-2 gap-px bg-[#e6eef0] sm:grid-cols-4">
            <Dado
              rotulo="Documentos lidos"
              valor={`${numero(leitura.lidos)} de ${numero(leitura.documentos)}`}
              apoio={leitura.lendo || leitura.aLer ? `${numero(leitura.lendo)} lendo · ${numero(leitura.aLer)} a ler` : leitura.comErro ? `${plural(leitura.comErro, "falhou", "falharam")}` : "nenhum pendente"}
            />
            <Dado rotulo="Páginas lidas" valor={numero(leitura.paginasLidas)} apoio={`de ${numero(leitura.paginas)} baixadas`} />
            <Dado rotulo="Páginas sem texto" valor={numero(leitura.paginasSemTexto)} apoio="digitalizadas, a IA não lê" />
            <Dado rotulo="Custo da leitura" valor={`US$ ${leitura.custoUs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} apoio="desde o início" />
          </div>
          <div className="space-y-2 border-t border-[#e6eef0] px-4 py-4">
            <p className="text-xs font-medium text-muted-foreground">Sugestões da IA: {numero(sugestoes.pendentes + sugestoes.aprovadas + sugestoes.recusadas)} no total</p>
            <BarraDePartes
              altura="h-6"
              rotulo="Sugestões da IA por decisão"
              fatias={[
                { chave: "aprovada", rotulo: "Aprovadas", valor: sugestoes.aprovadas, cor: COR.aprovada },
                { chave: "recusada", rotulo: "Recusadas", valor: sugestoes.recusadas, cor: COR.recusada },
                { chave: "pendente", rotulo: "A conferir", valor: sugestoes.pendentes, cor: COR.pendente },
              ]}
            />
            <Legenda
              itens={[
                { rotulo: "Aprovadas", cor: COR.aprovada, valor: sugestoes.aprovadas },
                { rotulo: "Recusadas", cor: COR.recusada, valor: sugestoes.recusadas },
                { rotulo: "A conferir", cor: COR.pendente, valor: sugestoes.pendentes },
              ]}
            />
          </div>
        </Painel>
      </div>

      <DialogoAcao
        aberto={Boolean(confirmar)}
        onFechar={() => setConfirmar(null)}
        ocupado={ocupado === "pedir"}
        icone={Send}
        titulo={confirmar?.refazer ? "Pedir de novo ao robô" : "Pedir os autos ao robô"}
        descricao="Cada processo entra na fila e o robô baixa os autos um a um. A IA lê assim que o download termina."
        rodape={
          <>
            <Button variant="outline" onClick={() => setConfirmar(null)} disabled={ocupado === "pedir"}>
              Cancelar
            </Button>
            <Button onClick={() => confirmar && void pedir(confirmar.ids.slice(0, 500))} disabled={ocupado === "pedir"}>
              {ocupado === "pedir" ? <LoaderCircle className="animate-spin" /> : <Send />} Colocar na fila
            </Button>
          </>
        }
      >
        {confirmar ? (
          <div className="space-y-3 text-sm text-foreground">
            <p>
              {plural(Math.min(confirmar.ids.length, 500), "processo vai", "processos vão")} para a fila do robô ({confirmar.refazer ? "o último pedido falhou" : "nunca pedidos"}, {escopo}).
            </p>
            {projecao.minutosPorPedido !== null ? (
              <p className="text-muted-foreground">
                No ritmo atual (≈ {duracao(projecao.minutosPorPedido)} por processo), isso acrescenta cerca de {duracao((Math.min(confirmar.ids.length, 500) * projecao.minutosPorPedido) / projecao.emParalelo)} de fila.
              </p>
            ) : null}
            {confirmar.ids.length > 500 ? <Aviso tom="info">Entram 500 por vez. Repita o pedido para os demais.</Aviso> : null}
            <p className="text-xs text-muted-foreground">Processo em segredo de justiça ou de tribunal sem robô fica de fora e é contado no retorno.</p>
          </div>
        ) : null}
      </DialogoAcao>
    </div>
  );
}
