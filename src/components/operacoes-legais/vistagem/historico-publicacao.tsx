"use client";

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowRightLeft,
  Bot,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Copy,
  FileSearch,
  FileText,
  FolderOpen,
  FolderPlus,
  History,
  Hourglass,
  Inbox,
  ListChecks,
  PencilLine,
  ScanSearch,
  ShieldAlert,
  Signature,
  TriangleAlert,
  Undo2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { chaveNome } from "@/lib/vistagem/agendamento";
import { nomeCurto } from "@/lib/vistagem/como-fica-no-vios";
import { agruparPorDia, dataHoraDoMomento, horaDoMomento, tituloDoDia } from "@/lib/vistagem/datas-do-historico";
import {
  SITUACAO_ATUAL,
  type ContextoDoHistorico,
  type EventoHistorico,
  type HistoricoPublicacao,
  type TarefaResumida,
  type TipoEvento,
} from "@/lib/vistagem/historico";
import { AvatarPessoa } from "./combobox-busca";
import { DialogoAcao } from "./dialogo-acao";
import { LogoGrupo, SeloArea } from "./marcas";
import { Selo } from "./ui";

const TOM = {
  neutro: "bg-slate-100 text-slate-600 ring-slate-200",
  marca: "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/40",
  alerta: "bg-amber-50 text-amber-700 ring-amber-200",
  perigo: "bg-red-50 text-red-700 ring-red-200",
  sucesso: "bg-emerald-50 text-emerald-700 ring-emerald-200",
} as const;

const VISUAL: Record<TipoEvento, { icone: LucideIcon; tom: keyof typeof TOM }> = {
  chegada: { icone: Inbox, tom: "neutro" },
  triagem: { icone: ScanSearch, tom: "neutro" },
  pendencia: { icone: Wrench, tom: "neutro" },
  duplicidade: { icone: Copy, tom: "neutro" },
  transferencia: { icone: ArrowRightLeft, tom: "alerta" },
  vistagem: { icone: Signature, tom: "marca" },
  devolucao: { icone: Undo2, tom: "alerta" },
  revistagem: { icone: Signature, tom: "marca" },
  reabertura: { icone: PencilLine, tom: "alerta" },
  inconsistencia: { icone: TriangleAlert, tom: "alerta" },
  ajuste: { icone: PencilLine, tom: "marca" },
  conferencia: { icone: ClipboardCheck, tom: "marca" },
  central: { icone: FolderPlus, tom: "sucesso" },
  central_erro: { icone: CircleAlert, tom: "perigo" },
  robo_envio: { icone: Bot, tom: "neutro" },
  robo_andamento: { icone: Bot, tom: "marca" },
  robo_espera: { icone: Hourglass, tom: "alerta" },
  robo_ok: { icone: CircleCheck, tom: "sucesso" },
  robo_simulado: { icone: FileSearch, tom: "neutro" },
  robo_erro: { icone: CircleAlert, tom: "perigo" },
  check: { icone: ListChecks, tom: "sucesso" },
};

/** Passos que o sistema faz sozinho: sem pessoa, aparecem como "Automático". */
const AUTOMATICOS = new Set<TipoEvento>(["chegada", "triagem", "central", "central_erro", "robo_envio", "robo_andamento", "robo_espera", "robo_ok", "robo_simulado", "robo_erro"]);

/** Cor do tipo da tarefa como no VIOS, só quando o nome diz (Revisar amarelo, Protocolar vermelho). */
function corDaTarefa(nome: string): string {
  const texto = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/\brevis/.test(texto)) return "bg-[#e2cc3e]";
  if (/\bprotocol/.test(texto)) return "bg-[#f0316a]";
  return "bg-[#c5d6dc]";
}

/** AAAA-MM-DD → DD/MM/AAAA. */
const dataCurta = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function Pessoa({ nome, fotos, tamanho = "size-5" }: { nome: string; fotos: Record<string, string>; tamanho?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={nome}>
      <AvatarPessoa nome={nome} foto={fotos[chaveNome(nome)] ?? null} className={tamanho} />
      <span className="truncate font-medium text-foreground">{nomeCurto(nome)}</span>
    </span>
  );
}

/** Etiqueta pequena com ícone (data da publicação, linha do arquivo, pasta). */
function Dado({ icone: Icone, children }: { icone: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[#f2f6f7] px-2 py-1 text-xs text-foreground/80">
      <Icone className="size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

function Tarefas({ tarefas, fotos }: { tarefas: TarefaResumida[]; fotos: Record<string, string> }) {
  return (
    <ul className="divide-y divide-[#eef3f5] rounded-md border border-[#e6eef0]" aria-label="Tarefas da vistagem">
      {tarefas.map((tarefa, indice) => (
        <li key={`${tarefa.tarefa}-${indice}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-xs">
          <span className="flex min-w-0 flex-1 basis-40 items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", corDaTarefa(tarefa.tarefa))} aria-hidden />
            <span className="truncate text-sm font-medium text-foreground" title={tarefa.tarefa}>
              {tarefa.tarefa}
            </span>
          </span>
          {tarefa.data ? (
            <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden />
              {dataCurta(tarefa.data)}
            </span>
          ) : null}
          {tarefa.responsavel ? <Pessoa nome={tarefa.responsavel} fotos={fotos} /> : null}
        </li>
      ))}
    </ul>
  );
}

function Evento({ evento, fotos, ultimo }: { evento: EventoHistorico; fotos: Record<string, string>; ultimo: boolean }) {
  const { icone: Icone, tom } = VISUAL[evento.tipo] ?? VISUAL.chegada;
  const temArea = Boolean(evento.area || evento.pasta);
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* Linha que liga um passo ao próximo. */}
      {!ultimo ? <span className="absolute top-9 bottom-0 left-4 w-px bg-[#e1ecee]" aria-hidden /> : null}
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full ring-1", TOM[tom])} aria-hidden>
        <Icone className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold leading-snug text-[#10293a]">{evento.titulo}</p>
          <time dateTime={evento.em} title={dataHoraDoMomento(evento.em)} className="shrink-0 pt-px text-xs tabular-nums text-muted-foreground">
            {horaDoMomento(evento.em)}
          </time>
        </div>

        {evento.por ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>por</span>
            <Pessoa nome={evento.por} fotos={fotos} />
          </p>
        ) : AUTOMATICOS.has(evento.tipo) ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bot className="size-3.5" aria-hidden />
            Automático
          </p>
        ) : null}

        {evento.tipo === "chegada" && evento.detalhes.length ? (
          <div className="flex flex-wrap gap-1.5">
            {evento.detalhes.map((detalhe, indice) => (
              <Dado key={indice} icone={detalhe.startsWith("Linha") ? FileText : CalendarDays}>
                {detalhe}
              </Dado>
            ))}
          </div>
        ) : null}

        {evento.areaDe && evento.area ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <SeloArea area={evento.areaDe} className="opacity-70" />
            <ArrowRight className="size-3.5 text-muted-foreground" aria-label="para" />
            <SeloArea area={evento.area} />
          </div>
        ) : temArea ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {evento.area ? <SeloArea area={evento.area} /> : null}
            {evento.pasta ? (
              <Dado icone={FolderOpen}>
                Pasta CI {evento.pasta.ci}
                {evento.pasta.vinculo ? <span className="text-muted-foreground"> · {evento.pasta.vinculo}</span> : null}
              </Dado>
            ) : null}
          </div>
        ) : null}

        {evento.tipo !== "chegada" && evento.detalhes.length ? (
          <div className="space-y-1 rounded-md bg-[#f7fbfc] px-2.5 py-1.5 text-xs leading-relaxed text-foreground/80">
            {evento.detalhes.map((detalhe, indice) => (
              <p key={indice} className="break-words whitespace-pre-wrap">
                {detalhe}
              </p>
            ))}
          </div>
        ) : null}

        {evento.mudancas?.length ? (
          <ul className="space-y-1 rounded-md bg-[#f7fbfc] px-2.5 py-1.5 text-xs">
            {evento.mudancas.map((mudanca, indice) => (
              <li key={indice} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium text-foreground">{mudanca.campo}</span>
                <span className="text-muted-foreground line-through decoration-muted-foreground/50">{mudanca.de}</span>
                <ArrowRight className="size-3 text-muted-foreground" aria-label="para" />
                <span className="font-medium text-[#285f7a]">{mudanca.para}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {evento.tarefas?.length ? <Tarefas tarefas={evento.tarefas} fotos={fotos} /> : null}
      </div>
    </li>
  );
}

/** De quem é a publicação: logo e nome do grupo, cliente, área e risco. */
function Contexto({ contexto }: { contexto: ContextoDoHistorico }) {
  const titulo = contexto.grupo ?? contexto.cliente ?? "Sem grupo";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[#dce9eb] bg-[#f7fbfc] px-3.5 py-3">
      <LogoGrupo grupo={contexto.grupo} tamanho="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground" title={titulo}>
          {titulo}
        </p>
        {contexto.cliente && contexto.cliente !== titulo ? (
          <p className="truncate text-xs text-muted-foreground" title={contexto.cliente}>
            {contexto.cliente}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {contexto.area ? <SeloArea area={contexto.area} /> : null}
        {contexto.risco ? (
          <Selo tom="perigo" icone={ShieldAlert}>
            Demanda de risco
          </Selo>
        ) : null}
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando o histórico">
      <div className="h-16 animate-pulse rounded-lg bg-[#f2f6f7]" />
      {[0, 1, 2].map((linha) => (
        <div key={linha} className="flex gap-3">
          <span className="size-8 shrink-0 animate-pulse rounded-full bg-[#eef3f5]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-[#eef3f5]" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-[#f2f6f7]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Botão "Histórico" da faixa da publicação: abre o que aconteceu com ela, em ordem (triagem, transferência de área,
 * vistagem, devolução, ajustes, conferência, robô), por dia, com a foto de quem fez e a área com o ícone. Carrega na
 * hora de abrir, para vir sempre o mais recente.
 */
export function BotaoHistorico({ publicacaoId, processo, className }: { publicacaoId: string; processo: string; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [historico, setHistorico] = useState<HistoricoPublicacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [abertoEm, setAbertoEm] = useState(0);

  async function abrir() {
    setAberto(true);
    setAbertoEm(Date.now());
    setHistorico(null);
    setErro("");
    setCarregando(true);
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/publicacoes/${publicacaoId}/historico`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar o histórico.");
      setHistorico(corpo.historico as HistoricoPublicacao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o histórico.");
    } finally {
      setCarregando(false);
    }
  }

  const fotos = historico?.fotos ?? {};
  const dias = historico ? agruparPorDia(historico.eventos, (evento) => evento.em) : [];

  return (
    <>
      <Button type="button" size="sm" variant="outline" className={className} onClick={() => void abrir()}>
        <History />
        Histórico
      </Button>
      <DialogoAcao
        aberto={aberto}
        onFechar={() => setAberto(false)}
        ocupado={false}
        icone={History}
        titulo="Histórico da publicação"
        className="sm:max-w-2xl"
        descricao={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="tabular-nums">{processo}</span>
            {historico ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f8f8] px-2 py-0.5 text-xs font-medium text-[#285f7a]">
                <span className="size-1.5 rounded-full bg-[#47cdd0]" aria-hidden />
                Agora: {SITUACAO_ATUAL[historico.status]}
              </span>
            ) : null}
          </span>
        }
        aviso="Transferência e devolução: o ORQESTRAI guarda a última de cada."
        rodape={
          <Button type="button" variant="outline" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        }
      >
        {carregando ? (
          <Esqueleto />
        ) : erro ? (
          <p className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {erro}
          </p>
        ) : historico ? (
          <>
            {historico.contexto ? <Contexto contexto={historico.contexto} /> : null}
            {dias.map(([dia, doDia]) => (
              <section key={dia} aria-label={tituloDoDia(dia, abertoEm)} className="space-y-3">
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#285f7a]">
                  {tituloDoDia(dia, abertoEm)}
                  <span className="h-px flex-1 bg-[#eef3f5]" aria-hidden />
                </h3>
                <ol aria-label={`Acontecimentos de ${tituloDoDia(dia, abertoEm)}`}>
                  {doDia.map((evento, indice) => (
                    <Evento key={`${evento.tipo}-${evento.em}-${indice}`} evento={evento} fotos={fotos} ultimo={indice === doDia.length - 1} />
                  ))}
                </ol>
              </section>
            ))}
          </>
        ) : null}
      </DialogoAcao>
    </>
  );
}
