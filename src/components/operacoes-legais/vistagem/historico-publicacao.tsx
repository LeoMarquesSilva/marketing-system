"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  Bot,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Copy,
  FileSearch,
  FolderPlus,
  History,
  Hourglass,
  Inbox,
  ListChecks,
  LoaderCircle,
  PencilLine,
  ScanSearch,
  Signature,
  TriangleAlert,
  Undo2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { SITUACAO_ATUAL, type EventoHistorico, type HistoricoPublicacao, type TipoEvento } from "@/lib/vistagem/historico";
import { DialogoAcao } from "./dialogo-acao";

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

const quando = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function Evento({ evento, ultimo }: { evento: EventoHistorico; ultimo: boolean }) {
  const { icone: Icone, tom } = VISUAL[evento.tipo];
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* Linha que liga um evento ao próximo. */}
      {!ultimo ? <span className="absolute top-9 bottom-0 left-[17px] w-px bg-[#e1ecee]" aria-hidden /> : null}
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full ring-1", TOM[tom])} aria-hidden>
        <Icone className="size-4" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-semibold leading-snug text-[#10293a]">{evento.titulo}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="tabular-nums">{quando.format(new Date(evento.em))}</span>
          {evento.por ? <> · por <span className="font-medium text-foreground/80">{evento.por}</span></> : null}
        </p>
        {evento.detalhes.length ? (
          <div className="mt-1.5 space-y-1 rounded-md bg-[#f7fbfc] px-2.5 py-1.5 text-xs leading-relaxed text-foreground/80">
            {evento.detalhes.map((detalhe, indice) => (
              <p key={indice} className="break-words whitespace-pre-wrap">
                {detalhe}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Botão "Histórico" da faixa da publicação: abre o que aconteceu com ela, em ordem (triagem, transferência de área,
 * vistagem, devolução, ajustes, conferência, robô). Carrega na hora de abrir, para vir sempre o mais recente.
 */
export function BotaoHistorico({ publicacaoId, processo, className }: { publicacaoId: string; processo: string; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [historico, setHistorico] = useState<HistoricoPublicacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function abrir() {
    setAberto(true);
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
        descricao={
          <>
            <span className="tabular-nums">{processo}</span>
            {historico ? <> · agora: {SITUACAO_ATUAL[historico.status]}</> : null}
          </>
        }
        aviso="Transferência e devolução: o Orquestra guarda a última de cada."
        rodape={
          <Button type="button" variant="outline" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        }
      >
        {carregando ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Carregando o histórico…
          </p>
        ) : erro ? (
          <p className="text-sm text-red-700">{erro}</p>
        ) : historico ? (
          <ol aria-label="Acontecimentos da publicação">
            {historico.eventos.map((evento, indice) => (
              <Evento key={`${evento.tipo}-${evento.em}-${indice}`} evento={evento} ultimo={indice === historico.eventos.length - 1} />
            ))}
          </ol>
        ) : null}
      </DialogoAcao>
    </>
  );
}
