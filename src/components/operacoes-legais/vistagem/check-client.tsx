"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  CalendarClock,
  CircleCheck,
  ClipboardCheck,
  Eye,
  FileText,
  Hourglass,
  Info,
  Landmark,
  Layers,
  ListChecks,
  LoaderCircle,
  PanelLeftOpen,
  RefreshCw,
  SearchX,
  Tags,
  ShieldAlert,
  TriangleAlert,
  UserRound,
  Workflow,
  X,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { chaveNome } from "@/lib/vistagem/agendamento";
import { camposDaConferencia, combinaCampos } from "@/lib/vistagem/busca";
import {
  TIPOS_DE_AGENDAMENTO,
  compararTarefa,
  descricaoSugerida,
  situacaoDoCheck,
  subtipoSugerido,
  tiposDoItem,
  type SituacaoCheck,
  type TipoDeAgendamento,
} from "@/lib/vistagem/check";
import { SUBTIPOS_AGENDAMENTO_EM_USO, TIPOS_INCONSISTENCIA_AGENDAMENTO } from "@/lib/vistagem/inconsistencias";
import { descricaoDoTribunal } from "@/lib/vistagem/tribunais";
import type { AgendamentoResumo, CheckResposta, ConferenciaItem } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { AvatarPessoa } from "./combobox-busca";
import { ContextoDoProcesso, DialogoAcao, EscolhaEmCartoes, type OpcaoEmCartao } from "./dialogo-acao";
import { AutoriaNaFaixa, BOTAO_FAIXA, BOTAO_FAIXA_PRINCIPAL, FaixaDoProcesso, SetasDaFila, type NavegacaoNaFila } from "./faixa-processo";
import { FilaPorArea, agruparPorArea, areaDaPublicacao, ordemDaFila } from "./fila-por-area";
import { FiltroData, dataNaLista } from "./filtro-data";
import { CartaoInconsistencia } from "./inconsistencias-ui";
import { IconeArea, IconeTribunal, LogoGrupo } from "./marcas";
import { PublicacaoNaVistagem } from "./publicacao-na-vistagem";
import { SeloEsocial, contarPor, tribunalDe } from "./publicacao-ui";
import { IconeOpcao, Seletor } from "./seletor";
import { CartoesCheck, SeloSituacao } from "./tarefas-check";
import { ICONE_CLASSE } from "./tarefas-conferencia";
import { Aviso, BarraAba, Busca, Campo, Carregando, Painel, Secao, Selo, Vazio, linhaLista } from "./ui";

type Aba = "aChecar" | "revisar" | "checadas";

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "aChecar", rotulo: "A checar" },
  { valor: "revisar", rotulo: "Em revisão" },
  { valor: "checadas", rotulo: "Checadas" },
];

/** Retorno de uma ação da tela. */
type Retorno = { tom: "sucesso" | "erro"; texto: string };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const processoDe = (item: ConferenciaItem) => item.publicacao.numeroProcesso ?? item.publicacao.numeroProcessoOriginal;

const hojeDoNavegador = () => new Date().toISOString().slice(0, 10);

/** Filtro "Pedido × VIOS": ícone, nome e o que quer dizer, na mesma ordem de gravidade dos cartões. */
const FILTRO_SITUACAO: { valor: SituacaoCheck; rotulo: string; descricao: string; icone: LucideIcon; cor: string }[] = [
  { valor: "diverge", rotulo: "Com divergência", descricao: "Data, horário ou responsável diferente", icone: TriangleAlert, cor: "bg-amber-50 text-amber-800 ring-amber-200" },
  { valor: "conferir", rotulo: "Conferir no VIOS", descricao: "O robô não devolveu algum dado", icone: Info, cor: "" },
  { valor: "confere", rotulo: "Conferem", descricao: "O que o robô devolveu bate com o pedido", icone: CircleCheck, cor: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
];

/** Subtipos da inconsistência de agendamento em cartões: o que cada um quer dizer, em uma linha. */
const SUBTIPO: Record<string, { rotulo: string; descricao: string; icone: LucideIcon }> = {
  "DATA / HORÁRIO - (P/A)": { rotulo: "Data / horário", descricao: "Data ou horário no VIOS diferente do pedido.", icone: CalendarClock },
  "FORA DO FLUXO - (P/A)": { rotulo: "Fora do fluxo", descricao: "Tarefa ou fluxo no VIOS diferente do esperado.", icone: Workflow },
  "RESPONSÁVEL - (P/A)": { rotulo: "Responsável", descricao: "Pessoa na tarefa diferente da pedida.", icone: UserRound },
  "DESCRIÇÃO - (P/A)": { rotulo: "Descrição", descricao: "Texto da tarefa no VIOS errado ou incompleto.", icone: FileText },
};

const OPCOES_SUBTIPO: OpcaoEmCartao[] = SUBTIPOS_AGENDAMENTO_EM_USO.map((valor) => ({
  valor,
  rotulo: SUBTIPO[valor]?.rotulo ?? valor,
  descricao: SUBTIPO[valor]?.descricao ?? valor,
  icone: SUBTIPO[valor]?.icone ?? TriangleAlert,
}));

const ROTULO_TIPO: Record<string, string> = { AGENDAMENTO: "Agendamento", ANÁLISE: "Análise" };

/* ------------------------------------------------------------ publicação aberta */

/** Cada tarefa com a situação no check, para o modal do check (o que a pessoa está confirmando). */
function ResumoDasTarefas({ agendamentos }: { agendamentos: AgendamentoResumo[] }) {
  return (
    <ol className="divide-y divide-[#eef3f5] overflow-hidden rounded-lg border border-[#dce9eb]">
      {agendamentos.map((agendamento, indice) => {
        const Icone = ICONE_CLASSE[agendamento.etiqueta];
        const comparacao = compararTarefa(agendamento);
        return (
          <li key={agendamento.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#e8f8f8] text-[#285f7a] ring-1 ring-[#47cdd0]/25" aria-hidden>
              <Icone className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground" title={agendamento.tarefa}>
                {agendamentos.length > 1 ? <span className="tabular-nums text-muted-foreground">{indice + 1}. </span> : null}
                {agendamento.tarefa}
              </span>
              {comparacao.divergencias.length ? (
                <span className="block text-xs text-amber-800">{comparacao.divergencias.map((divergencia) => divergencia.texto).join("; ")}</span>
              ) : null}
            </span>
            <SeloSituacao situacao={comparacao.situacao} />
          </li>
        );
      })}
    </ol>
  );
}

function ItemCheck({
  item,
  aba,
  fotos,
  hoje,
  navegacao,
  onAbrir,
  onVoltar,
  onConcluido,
}: {
  item: ConferenciaItem;
  aba: Aba;
  fotos: Record<string, string>;
  hoje: string;
  navegacao: NavegacaoNaFila | null;
  onAbrir: (id: string) => void;
  onVoltar: () => void;
  onConcluido: (id: string, mensagem: string) => void;
}) {
  const [modo, setModo] = useState<"nenhum" | "ok" | "erro">("nenhum");
  const [nota, setNota] = useState("");
  const [tipo, setTipo] = useState("");
  const [subtipo, setSubtipo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const { publicacao } = item;
  const processo = processoDe(item);
  const base = `check-${publicacao.id}`;
  const checada = aba === "checadas";
  const comparacoes = useMemo(() => item.agendamentos.map((agendamento) => compararTarefa(agendamento)), [item.agendamentos]);
  const divergencias = comparacoes.flatMap((comparacao, indice) =>
    comparacao.divergencias.map((divergencia) => ({ ...divergencia, tarefa: indice + 1, nome: item.agendamentos[indice].tarefa }))
  );
  const aConferir = comparacoes.filter((comparacao) => comparacao.situacao === "conferir").length;

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
      onConcluido(publicacao.id, acao === "ok" ? "Check registrado." : "Inconsistência registrada; a publicação ficou em revisão.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setOcupado(false);
    }
  }

  /** Abre o registro do erro já com o tipo, o subtipo e o texto da divergência (todas, ou só as de uma tarefa). */
  function apontarErro(soEsta?: AgendamentoResumo) {
    const alvo = soEsta ? [soEsta] : item.agendamentos;
    const campos = alvo.flatMap((agendamento) => compararTarefa(agendamento).divergencias.map((divergencia) => divergencia.campo));
    if (campos.length) {
      if (!tipo) setTipo("AGENDAMENTO");
      if (!subtipo) setSubtipo(subtipoSugerido(campos) ?? "");
      if (!descricao.trim()) setDescricao(descricaoSugerida(item.agendamentos, soEsta ? [soEsta.id] : undefined));
    }
    setErro("");
    setModo("erro");
  }

  function fechar() {
    setModo("nenhum");
    setErro("");
  }

  const spinner = <LoaderCircle className="animate-spin" />;
  const contexto = (
    <ContextoDoProcesso
      grupo={publicacao.grupoCliente}
      cliente={publicacao.cliente}
      area={publicacao.escritorioResponsavel}
      processo={processo}
      pessoa={item.conferidoPor}
      papel="Conferida por"
      fotos={fotos}
    />
  );

  return (
    // No desktop ocupa a altura da tela, como a vistagem: publicação e tarefas rolam cada uma no seu lugar.
    <Painel aria-labelledby={`${base}-titulo`} className="@container lg:flex lg:h-full lg:flex-col">
      <Button variant="ghost" size="sm" className="m-2 self-start lg:hidden" onClick={onVoltar}>
        <ArrowLeft />
        Voltar à lista
      </Button>
      {/* Mesmo topo da Conferência: número (pesquisa no tribunal e copia), quem vistou, conferiu e checou, as ações e as setas. */}
      <FaixaDoProcesso
        numero={processo}
        tribunal={publicacao.tribunal}
        tituloId={`${base}-titulo`}
        selos={
          <>
            <SeloEsocial publicacao={publicacao} />
            <AutoriaNaFaixa papel="Vistada por" nome={item.vistadoPor} quando={publicacao.vistadoEm} fotos={fotos} />
            {/* Devolvida e vistada de novo: quem analisou primeiro fica em "Vistada por"; depois, quem devolveu e quem vistou de novo. */}
            {item.revistadoPor ? (
              <>
                <AutoriaNaFaixa papel="Devolvida por" nome={item.devolvidoPor} quando={publicacao.devolvidoEm} fotos={fotos} />
                <AutoriaNaFaixa papel="Vistada de novo por" nome={item.revistadoPor} quando={publicacao.revistadoEm} fotos={fotos} />
              </>
            ) : null}
            <AutoriaNaFaixa papel="Conferida por" nome={item.conferidoPor} quando={publicacao.conferidoEm} fotos={fotos} />
            {checada ? <AutoriaNaFaixa papel="Checada por" nome={item.checadoPor ?? null} quando={publicacao.checadoEm} fotos={fotos} /> : null}
          </>
        }
      >
        {!checada ? (
          <div className="flex flex-wrap items-center gap-2" data-tour="ck-acoes">
            <Button size="sm" variant="outline" className={BOTAO_FAIXA} onClick={() => apontarErro()} disabled={ocupado}>
              <TriangleAlert />
              Encontrei erro
            </Button>
            <Button size="sm" className={BOTAO_FAIXA_PRINCIPAL} onClick={() => setModo("ok")} disabled={ocupado}>
              <CircleCheck />
              {aba === "revisar" ? "Corrigido: dar check" : "Check OK"}
            </Button>
          </div>
        ) : null}
        {navegacao ? <SetasDaFila navegacao={navegacao} onAbrir={onAbrir} separada={!checada} /> : null}
      </FaixaDoProcesso>

      {erro && modo === "nenhum" ? (
        <Secao className="shrink-0">
          <Aviso tom="erro">{erro}</Aviso>
        </Secao>
      ) : null}

      {/* Com espaço, a publicação fica à esquerda e o pedido × VIOS à direita, cada um rolando sozinho. */}
      <div className="grid lg:min-h-0 lg:flex-1 @max-4xl:overflow-y-auto @4xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @4xl:grid-rows-[minmax(0,1fr)] @4xl:divide-x @4xl:divide-[#e6eef0]">
        <section data-tour="ck-publicacao" aria-label="Publicação" className="min-w-0 overflow-y-auto max-lg:max-h-[75dvh]">
          <PublicacaoNaVistagem publicacao={publicacao} agendamentos={item.agendamentos} auxiliar={item.auxiliar ?? null} fotos={fotos} hoje={hoje} />
        </section>

        {/* A coluna inteira tem o fundo das tarefas, até o fim da tela. */}
        <div className="min-w-0 border-t border-[#e6eef0] bg-[#f2f6f7] @4xl:overflow-y-auto @4xl:border-t-0 max-lg:@4xl:max-h-[75dvh]">
          {divergencias.length && !checada ? (
            <div className="px-3 pt-3" data-tour="ck-divergencias">
              <Aviso
                tom="alerta"
                titulo={`${plural(divergencias.length, "divergência", "divergências")} entre o pedido e o VIOS`}
                acao={
                  <Button size="xs" variant="outline" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100" onClick={() => apontarErro()}>
                    Apontar erro
                  </Button>
                }
              >
                <ul className="space-y-0.5 text-xs">
                  {divergencias.map((divergencia, indice) => (
                    <li key={indice}>
                      {item.agendamentos.length > 1 ? <span className="font-semibold">Tarefa {divergencia.tarefa}: </span> : null}
                      {divergencia.texto}
                    </li>
                  ))}
                </ul>
              </Aviso>
            </div>
          ) : null}

          {publicacao.observacaoVistagem ? (
            <Secao titulo="Observação do jurídico" id={`${base}-observacao`}>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{publicacao.observacaoVistagem}</p>
            </Secao>
          ) : null}

          {checada && publicacao.checkNota ? (
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

          <section data-tour="ck-comparacao" aria-labelledby={`${base}-tarefas`} className="border-t border-[#e6eef0] first:border-t-0">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-4">
              <h3 id={`${base}-tarefas`} className="text-xs font-semibold uppercase tracking-normal text-[#285f7a]">
                Pedido × no VIOS
              </h3>
              <span className="text-xs text-muted-foreground">
                {[
                  plural(item.agendamentos.length, "tarefa", "tarefas"),
                  comparacoes.some((comparacao) => comparacao.situacao === "diverge")
                    ? `${comparacoes.filter((comparacao) => comparacao.situacao === "diverge").length} diverge`
                    : null,
                  aConferir ? `${aConferir} a conferir no VIOS` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <CartoesCheck agendamentos={item.agendamentos} fotos={fotos} hoje={hoje} onApontar={checada ? undefined : (agendamento) => apontarErro(agendamento)} />
          </section>
        </div>
      </div>

      <DialogoAcao
        aberto={modo === "ok"}
        onFechar={fechar}
        ocupado={ocupado}
        icone={CircleCheck}
        titulo={aba === "revisar" ? "Corrigido: dar check" : "Check OK"}
        descricao="Confirme que a esteira e o agendamento no VIOS estão corretos."
        aviso="O check fica registrado com o seu nome."
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
        {contexto}
        {divergencias.length ? (
          <Aviso tom="alerta" titulo="Há divergência entre o pedido e o VIOS">
            Dê o check só depois de corrigir no VIOS, ou se a diferença não procede (explique na observação).
          </Aviso>
        ) : null}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">O que você está confirmando</p>
          <ResumoDasTarefas agendamentos={item.agendamentos} />
        </div>
        <Campo rotulo="Observação do check (opcional)">
          <Textarea value={nota} onChange={(evento) => setNota(evento.target.value)} rows={3} maxLength={2000} />
        </Campo>
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      </DialogoAcao>

      <DialogoAcao
        aberto={modo === "erro"}
        onFechar={fechar}
        ocupado={ocupado}
        icone={TriangleAlert}
        tom="alerta"
        titulo="Encontrei erro"
        descricao="O erro vira inconsistência de agendamento e a publicação fica em revisão até o novo check."
        aviso={!tipo || !subtipo || !descricao.trim() ? "Escolha o tipo e o subtipo e diga o que está errado." : null}
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
        {contexto}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Tipo</p>
          <Segmented
            label="Tipo da inconsistência"
            value={tipo}
            options={TIPOS_INCONSISTENCIA_AGENDAMENTO.map((valor) => ({ value: valor as string, label: ROTULO_TIPO[valor] ?? valor }))}
            onChange={setTipo}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Subtipo</p>
          <EscolhaEmCartoes rotulo="Subtipo da inconsistência" opcoes={OPCOES_SUBTIPO} valor={subtipo} onChange={setSubtipo} desabilitado={ocupado} />
        </div>
        <Campo rotulo="O que está errado" dica={divergencias.length ? "Começa com as divergências encontradas: revise antes de registrar." : undefined}>
          <Textarea value={descricao} onChange={(evento) => setDescricao(evento.target.value)} rows={4} maxLength={2000} />
        </Campo>
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      </DialogoAcao>
    </Painel>
  );
}

/* ------------------------------------------------------------ fila */

/** Linha da fila: processo, risco, situação do check e inconsistências; cliente com logo; quem conferiu (ou checou), com foto. */
function LinhaDoCheck({
  item,
  situacao,
  checada,
  aberta,
  fotos,
  onAbrir,
}: {
  item: ConferenciaItem;
  situacao: SituacaoCheck;
  checada: boolean;
  aberta: boolean;
  fotos: Record<string, string>;
  onAbrir: () => void;
}) {
  const { publicacao } = item;
  const abertas = item.inconsistencias.filter((inconsistencia) => !inconsistencia.excluidaEm).length;
  const pessoa = checada ? (item.checadoPor ?? null) : item.conferidoPor;
  return (
    <button type="button" onClick={onAbrir} aria-current={aberta ? "true" : undefined} className={cn(linhaLista(aberta), "space-y-1")}>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold tabular-nums text-foreground">{processoDe(item)}</span>
        {publicacao.demandaRisco ? (
          <Selo tom="perigo" icone={ShieldAlert}>
            Risco
          </Selo>
        ) : null}
        <SeloSituacao situacao={situacao} />
        {abertas ? <Selo tom="alerta">{plural(abertas, "inconsistência", "inconsistências")}</Selo> : null}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
        {publicacao.grupoCliente ? <LogoGrupo grupo={publicacao.grupoCliente} tamanho="xs" /> : null}
        <span className="truncate">{publicacao.cliente ?? publicacao.grupoCliente ?? "—"}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {pessoa ? <AvatarPessoa nome={pessoa} foto={fotos[chaveNome(pessoa)]} className="size-4 [&_[data-slot=avatar-fallback]]:text-[7px]" /> : null}
        <span className="truncate">
          {[pessoa ? `${checada ? "checada" : "conferida"} por ${pessoa}` : null, plural(item.agendamentos.length, "tarefa", "tarefas")].filter(Boolean).join(" · ")}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------ tela */

const VAZIO: Record<Aba, { titulo: string; texto: string }> = {
  aChecar: { titulo: "Nenhum agendamento aguardando check.", texto: "O que o robô gravar no VIOS aparece aqui para conferir." },
  revisar: { titulo: "Nada em revisão.", texto: "Publicações com erro apontado no check ficam aqui até o novo check." },
  checadas: { titulo: "Nenhuma publicação checada ainda.", texto: "As publicações com check registrado aparecem aqui." },
};

/** Ícone de cada tipo de agendamento no filtro. */
const ICONE_DO_TIPO: Record<TipoDeAgendamento, LucideIcon> = {
  CIENCIA_NF: Eye,
  PRAZO: Hourglass,
  PROVIDENCIA: ClipboardCheck,
  COMPROMISSO: CalendarClock,
};

function Check() {
  const [aba, setAba] = useState<Aba>("aChecar");
  const [dados, setDados] = useState<CheckResposta | null>(null);
  const [erro, setErro] = useState("");
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [busca, setBusca] = useState("");
  /** Data da publicação (AAAA-MM-DD); vazio é "Todas as datas". */
  const [dataPublicacao, setDataPublicacao] = useState("");
  /** Data da divulgação no diário (AAAA-MM-DD); vazio é "Todas as datas". */
  const [dataImportacao, setDataImportacao] = useState("");
  /** Área (escritório); vazio é "Todas as áreas". */
  const [area, setArea] = useState("");
  /** Tribunal; vazio é "Todos os tribunais". */
  const [tribunal, setTribunal] = useState("");
  /** Pedido × VIOS; vazio é "Todas as situações". */
  const [situacao, setSituacao] = useState("");
  /** Ciência NF, Prazo, Providência ou Compromisso; vazio é "Todos os tipos". */
  const [tipoAgendamento, setTipoAgendamento] = useState("");
  /** Publicação escolhida; sem escolha (ou fora dos filtros), abre a primeira da fila. */
  const [selecionada, setSelecionada] = useState<string | null>(null);
  /** A fila abre recolhida, como na vistagem: a publicação ocupa a largura toda. */
  const [filaRecolhida, setFilaRecolhida] = useState(true);
  /** No celular a fila e a publicação não cabem juntas: mostra a fila só quando pedida. */
  const [listaNoCelular, setListaNoCelular] = useState(false);
  const rolagemDaFila = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/check");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar o check.");
      setDados(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o check.");
      setDados({ aChecar: [], revisar: [], checadas: [], fotos: {}, hoje: hojeDoNavegador() });
    }
  }, []);

  /** Traz antes o andamento do robô, para entrar aqui o que acabou de ser gravado no VIOS. */
  const sincronizarECarregar = useCallback(async () => {
    await authFetch("/api/operacoes-legais/vistagem/envios", { method: "POST" }).catch(() => null);
    await carregar();
  }, [carregar]);

  useEffect(() => {
    void sincronizarECarregar();
  }, [sincronizarECarregar]);

  async function atualizar() {
    setAtualizando(true);
    await sincronizarECarregar();
    setAtualizando(false);
  }

  const todas = useMemo(() => [...(dados?.aChecar ?? []), ...(dados?.revisar ?? []), ...(dados?.checadas ?? [])], [dados]);
  // O que a busca olha em cada publicação (inclui as partes do texto): montado uma vez por carga, não a cada letra.
  const camposDeBusca = useMemo(
    () => new Map(todas.map((item) => [item.publicacao.id, [...camposDaConferencia(item), item.checadoPor ?? ""]])),
    [todas]
  );
  // Pedido × VIOS de cada publicação: também uma vez por carga.
  const situacoes = useMemo(() => new Map(todas.map((item) => [item.publicacao.id, situacaoDoCheck(item)])), [todas]);
  const situacaoDe = (item: ConferenciaItem): SituacaoCheck => situacoes.get(item.publicacao.id) ?? "conferir";
  // Tipos de agendamento de cada publicação (Ciência NF, Prazo, Providência, Compromisso): também uma vez por carga.
  const tiposPorItem = useMemo(() => new Map(todas.map((item) => [item.publicacao.id, tiposDoItem(item)])), [todas]);
  const tiposDe = (item: ConferenciaItem): TipoDeAgendamento[] => tiposPorItem.get(item.publicacao.id) ?? [];

  const lista = dados?.[aba];
  const datasDaLista = (lista ?? []).map((item) => item.publicacao.dataPublicacao);
  const dataAtiva = dataNaLista(dataPublicacao, datasDaLista);
  const importacoesDaLista = (lista ?? []).map((item) => item.publicacao.dataImportacao);
  const importacaoAtiva = dataNaLista(dataImportacao, importacoesDaLista);
  // Área e tribunal escolhidos que sumiram da lista (outra aba, já checadas) deixam de filtrar.
  const areasDaLista = contarPor(lista ?? [], areaDaPublicacao);
  const areaAtiva = areasDaLista.some(([nome]) => nome === area) ? area : "";
  const daArea = (lista ?? []).filter((item) => !areaAtiva || areaDaPublicacao(item) === areaAtiva);
  const tribunaisDaLista = contarPor(daArea, (item) => tribunalDe(item.publicacao));
  const tribunalAtivo = tribunaisDaLista.some(([nome]) => nome === tribunal) ? tribunal : "";
  const situacoesDaLista = new Map(contarPor(lista ?? [], situacaoDe));
  const tiposDaLista = new Map(TIPOS_DE_AGENDAMENTO.map((tipo) => [tipo.valor, (lista ?? []).filter((item) => tiposDe(item).includes(tipo.valor)).length]));
  const filtrada = daArea.filter(
    (item) =>
      combinaCampos(camposDeBusca.get(item.publicacao.id) ?? [], busca) &&
      (!tribunalAtivo || tribunalDe(item.publicacao) === tribunalAtivo) &&
      (!situacao || situacaoDe(item) === situacao) &&
      (!tipoAgendamento || tiposDe(item).includes(tipoAgendamento as TipoDeAgendamento)) &&
      (!dataAtiva || item.publicacao.dataPublicacao === dataAtiva) &&
      (!importacaoAtiva || item.publicacao.dataImportacao === importacaoAtiva)
  );
  const grupos = agruparPorArea(filtrada);

  function limparFiltros() {
    setBusca("");
    setArea("");
    setTribunal("");
    setSituacao("");
    setTipoAgendamento("");
    setDataPublicacao("");
    setDataImportacao("");
  }

  // Mesma ordem da fila (área › tribunal): é por ela que as setas andam para a anterior e a próxima.
  const ordem = ordemDaFila(grupos);
  const ids = ordem.map((item) => item.publicacao.id);
  // Buscar não troca o processo aberto: os resultados aparecem na fila e a pessoa escolhe. Os outros filtros, sim.
  const buscando = busca.trim() !== "";
  const fixaNaBusca = buscando && selecionada ? ((lista ?? []).find((item) => item.publicacao.id === selecionada) ?? null) : null;
  const indiceAberta = selecionada && ids.includes(selecionada) ? ids.indexOf(selecionada) : fixaNaBusca ? -1 : ids.length ? 0 : -1;
  const aberta = indiceAberta >= 0 ? ordem[indiceAberta] : fixaNaBusca;
  // Aberta fora dos resultados: sem setas (elas andam pelos resultados).
  const navegacao: NavegacaoNaFila | null =
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

  function mudarAba(nova: Aba) {
    setAba(nova);
    setSelecionada(null);
  }

  const idAberta = aberta?.publicacao.id ?? null;
  useEffect(() => {
    // Ao andar pelas setas, a fila acompanha a publicação aberta.
    rolagemDaFila.current?.querySelector("[aria-current=true]")?.scrollIntoView({ block: "nearest" });
  }, [idAberta, filaAberta]);

  function abrir(id: string) {
    setSelecionada(id);
    setListaNoCelular(false);
  }

  function concluido(id: string, mensagem: string) {
    // Segue para a próxima da fila (ou a anterior, se era a última).
    const posicao = ids.indexOf(id);
    if (posicao >= 0) setSelecionada(ids[posicao + 1] ?? ids[posicao - 1] ?? null);
    setRetorno({ tom: "sucesso", texto: mensagem });
    setDados((atual) =>
      atual
        ? {
            ...atual,
            aChecar: atual.aChecar.filter((item) => item.publicacao.id !== id),
            revisar: atual.revisar.filter((item) => item.publicacao.id !== id),
          }
        : atual
    );
    void carregar();
  }

  const fotos = dados?.fotos ?? {};

  return (
    <div className="space-y-4">
      <BarraAba
        resumo={
          // Linha de cima: a lista (A checar, Em revisão, Checadas), o filtro do pedido × VIOS e o Atualizar. Embaixo,
          // os mesmos filtros da Conferência.
          <div className="flex flex-wrap items-center gap-2" data-tour="ck-listas">
            <Segmented
              label="Situação do check"
              value={aba}
              options={ABAS.map((item) => ({ value: item.valor, label: dados ? `${item.rotulo} ${dados[item.valor].length}` : item.rotulo }))}
              onChange={mudarAba}
            />
            <Seletor
              rotulo="Pedido × VIOS"
              className="sm:w-56"
              valor={situacao}
              onChange={setSituacao}
              todos={{ rotulo: "Todas as situações", contagem: lista?.length, icone: <IconeOpcao icone={ListChecks} /> }}
              opcoes={FILTRO_SITUACAO.map((opcao) => ({
                valor: opcao.valor,
                rotulo: opcao.rotulo,
                descricao: opcao.descricao,
                contagem: situacoesDaLista.get(opcao.valor) ?? 0,
                icone: <IconeOpcao icone={opcao.icone} className={opcao.cor || undefined} />,
              }))}
            />
            <Button variant="outline" onClick={atualizar} disabled={atualizando || !dados} title="Traz o andamento do robô e recarrega a lista">
              {atualizando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Atualizar
            </Button>
          </div>
        }
      >
        {!filaAberta ? (
          <Button type="button" variant="outline" className="hidden lg:inline-flex" onClick={() => setFilaRecolhida(false)} data-tour="ck-fila">
            <PanelLeftOpen />
            Mostrar fila
          </Button>
        ) : null}
        <Busca data-tour="ck-busca"
          value={busca}
          onChange={(evento) => mudarBusca(evento.target.value)}
          onKeyDown={(evento) => {
            // Enter abre o primeiro resultado; Esc limpa a busca.
            if (evento.key === "Enter" && ids[0]) abrir(ids[0]);
            if (evento.key === "Escape") mudarBusca("");
          }}
          placeholder="Buscar processo, cliente, parte, pessoa ou CI"
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
          opcoes={tribunaisDaLista.map(([nome, quantidade]) => ({
            valor: nome,
            rotulo: nome,
            descricao: descricaoDoTribunal(nome),
            contagem: quantidade,
            icone: <IconeTribunal sigla={nome} />,
          }))}
        />
        <Seletor
          rotulo="Tipo de agendamento"
          className="sm:w-56"
          valor={tipoAgendamento}
          onChange={setTipoAgendamento}
          todos={{ rotulo: "Todos os tipos", contagem: lista?.length, icone: <IconeOpcao icone={Tags} /> }}
          opcoes={TIPOS_DE_AGENDAMENTO.map((tipo) => ({
            valor: tipo.valor,
            rotulo: tipo.rotulo,
            descricao: tipo.descricao,
            contagem: tiposDaLista.get(tipo.valor) ?? 0,
            icone: <IconeOpcao icone={ICONE_DO_TIPO[tipo.valor]} />,
          }))}
        />
        <FiltroData rotulo="Data Publicação" datas={datasDaLista} valor={dataAtiva} onChange={setDataPublicacao} />
        <FiltroData rotulo="Data da importação" datas={importacoesDaLista} valor={importacaoAtiva} onChange={setDataImportacao} />
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
        <Painel data-tour="ck-vazio">
          <Vazio icone={aba === "checadas" ? CircleCheck : ListChecks} titulo={VAZIO[aba].titulo}>
            {VAZIO[aba].texto}
          </Vazio>
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
        // Um processo por vez, como na Conferência: a fila (por área e, no Trabalhista, por tribunal) fica recolhida
        // e as setas da faixa andam entre as publicações. No desktop, fila e publicação rolam cada uma no seu painel.
        <div
          className={cn(
            // A linha tem a altura da grade (e não a do conteúdo): é o que deixa publicação e tarefas rolarem por dentro.
            "grid gap-4 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[30rem] lg:grid-rows-[minmax(0,1fr)]",
            filaAberta ? "lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]" : "lg:grid-cols-1"
          )}
        >
          <FilaPorArea
            grupos={grupos}
            total={ordem.length}
            busca={busca}
            abertaForaDosResultados={Boolean(aberta) && indiceAberta < 0}
            onLimparBusca={() => mudarBusca("")}
            onRecolher={() => setFilaRecolhida(true)}
            rotulo={buscando ? "Resultados da busca" : `Publicações: ${ABAS.find((item) => item.valor === aba)?.rotulo.toLowerCase()}`}
            rolagem={rolagemDaFila}
            className={cn(aberta && !listaNoCelular && "hidden lg:flex", !filaAberta && "lg:hidden")}
            linha={(item) => (
              <LinhaDoCheck
                item={item}
                situacao={situacaoDe(item)}
                checada={aba === "checadas"}
                aberta={item.publicacao.id === aberta?.publicacao.id}
                fotos={fotos}
                onAbrir={() => abrir(item.publicacao.id)}
              />
            )}
          />

          <div className={cn("min-w-0 lg:h-full lg:min-h-0", (!aberta || listaNoCelular) && "hidden lg:block")}>
            {aberta ? (
              <ItemCheck
                key={aberta.publicacao.id}
                item={aberta}
                aba={aba}
                fotos={fotos}
                hoje={dados?.hoje ?? hojeDoNavegador()}
                navegacao={navegacao}
                onAbrir={abrir}
                onVoltar={() => setListaNoCelular(true)}
                onConcluido={concluido}
              />
            ) : null}
          </div>
        </div>
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
