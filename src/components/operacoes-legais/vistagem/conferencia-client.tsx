"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, CircleAlert, ExternalLink, LoaderCircle, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { AgendamentoResumo, ConferenciaItem, ConferenciaResposta, EnvioStatus } from "@/lib/vistagem/types";
import { linkTarefaVios } from "@/lib/vistagem/vios-links";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { DadosPasta, DadosPublicacao, TeorPublicacao, formatarData, formatarDataHora } from "./publicacao-ui";

type Aba = "conferir" | "enviadas";

interface Integracao {
  nome: string;
  ok: boolean;
  detalhe: string;
}

const ENVIO: Record<EnvioStatus, { rotulo: string; classe: string }> = {
  nao_enviado: { rotulo: "Não enviada", classe: "border-slate-200 bg-slate-50 text-slate-600" },
  pendente: { rotulo: "Na fila do robô", classe: "border-[#47cdd0]/35 bg-[#e8f8f8] text-[#285f7a]" },
  enviado: { rotulo: "Com o robô", classe: "border-[#47cdd0]/35 bg-[#e8f8f8] text-[#285f7a]" },
  processando: { rotulo: "Agendando no VIOS", classe: "border-[#47cdd0]/35 bg-[#e8f8f8] text-[#285f7a]" },
  concluido: { rotulo: "Agendada", classe: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  erro: { rotulo: "Erro no robô", classe: "border-red-200 bg-red-50 text-red-700" },
};

function TabelaTarefas({ agendamentos, comEnvio }: { agendamentos: AgendamentoResumo[]; comEnvio: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Tipo</th>
            <th className="px-3 py-2 font-medium">Tarefa</th>
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2 font-medium">Responsável</th>
            <th className="px-3 py-2 font-medium">Revisor</th>
            {comEnvio ? <th className="px-3 py-2 font-medium">Robô</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#dce9eb]">
          {agendamentos.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="px-3 py-2">{item.etiqueta === "PRAZO" ? "Prazo" : "Providência"}</td>
              <td className="px-3 py-2">
                <span className="font-medium text-slate-900">{item.tarefa}</span>
                {item.observacao ? <span className="mt-1 block whitespace-pre-wrap text-xs text-slate-600">{item.observacao}</span> : null}
              </td>
              <td className="px-3 py-2 font-mono">{formatarData(item.data)}</td>
              <td className="px-3 py-2">{item.responsavel}</td>
              <td className="px-3 py-2">{item.revisor ?? "—"}</td>
              {comEnvio ? (
                <td className="px-3 py-2">
                  {item.envioStatus === "concluido" && item.envioSimulado ? (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Simulada: preenchida no VIOS, não gravada
                    </span>
                  ) : (
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", ENVIO[item.envioStatus].classe)}>
                      {ENVIO[item.envioStatus].rotulo}
                      {item.envioSimulado ? " (simulação)" : ""}
                    </span>
                  )}
                  {item.viosTarefaId ? (
                    <a
                      href={linkTarefaVios(item.viosTarefaId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir a tarefa no VIOS (nova aba)"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#347796] hover:text-[#285f7a] hover:underline"
                    >
                      <span className="font-mono tabular-nums">CI {item.viosTarefaId}</span>
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : null}
                  {item.envioErro ? <span className="mt-1 block text-xs text-red-700">{item.envioErro}</span> : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CartaoConferencia({
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
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const { publicacao } = item;

  async function agir(acao: "validar" | "devolver" | "reenviar") {
    setOcupado(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/conferencia/${publicacao.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, motivo }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha na conferência.");
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

  return (
    <li className="rounded-lg border border-[#dce9eb] bg-white shadow-sm">
      <div className="space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium text-slate-900">{publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}</span>
          {publicacao.tribunal ? (
            <span className="rounded-full border border-[#3e84a8]/25 px-2 py-0.5 text-xs text-[#315f73]">{publicacao.tribunal}</span>
          ) : null}
          <span className="text-xs text-slate-500">
            vistada {item.vistadoPor ? `por ${item.vistadoPor} ` : ""}em {formatarDataHora(publicacao.vistadoEm)}
            {comEnvio && publicacao.conferidoEm ? ` · conferida ${item.conferidoPor ? `por ${item.conferidoPor} ` : ""}em ${formatarDataHora(publicacao.conferidoEm)}` : ""}
          </span>
        </div>
        <DadosPasta publicacao={{ ...publicacao, pendencia: null }} />
        <DadosPublicacao publicacao={publicacao} />
        {publicacao.observacaoVistagem ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">Observação do jurídico: </span>
            {publicacao.observacaoVistagem}
          </p>
        ) : null}
        <TeorPublicacao publicacao={publicacao} />
      </div>
      <TabelaTarefas agendamentos={item.agendamentos} comEnvio={comEnvio} />
      {comEnvio && modoReal && item.agendamentos.some((a) => a.envioSimulado && (a.envioStatus === "concluido" || a.envioStatus === "erro")) ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#dce9eb] px-4 py-3">
          <Button size="sm" onClick={() => agir("reenviar")} disabled={ocupado}>
            {ocupado ? <LoaderCircle className="animate-spin" /> : <Bot />}
            Reenviar gravando no VIOS
          </Button>
          {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
        </div>
      ) : null}
      {!comEnvio ? (
        <div className="space-y-2 border-t border-[#dce9eb] px-4 py-3">
          {devolvendo ? (
            <div className="space-y-2">
              <label className="block space-y-1 text-xs font-medium text-slate-600">
                Motivo da devolução (o jurídico vê este texto)
                <Textarea value={motivo} onChange={(evento) => setMotivo(evento.target.value)} rows={2} maxLength={2000} autoFocus />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => agir("devolver")} disabled={ocupado || !motivo.trim()}>
                  {ocupado ? <LoaderCircle className="animate-spin" /> : <Undo2 />}
                  Devolver ao jurídico
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDevolvendo(false)} disabled={ocupado}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => agir("validar")} disabled={ocupado}>
                {ocupado ? <LoaderCircle className="animate-spin" /> : <Check />}
                Validar e enviar ao robô
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDevolvendo(true)} disabled={ocupado}>
                <Undo2 />
                Devolver ao jurídico
              </Button>
            </div>
          )}
          {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

function Conferencia() {
  const [aba, setAba] = useState<Aba>("conferir");
  const [dados, setDados] = useState<ConferenciaResposta | null>(null);
  const [integracoes, setIntegracoes] = useState<Integracao[] | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [atualizando, setAtualizando] = useState(false);

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
    setAviso("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/envios", { method: "POST" });
      const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao atualizar.");
      setAviso(`${corpo.consultadas} tarefa(s) consultada(s): ${corpo.concluidas} concluída(s) pelo robô, ${corpo.erros} com erro.`);
      await carregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setAtualizando(false);
    }
  }

  function concluido(id: string, mensagem: string) {
    setAviso(mensagem);
    void carregar();
    setDados((atual) => (atual ? { ...atual, aConferir: atual.aConferir.filter((item) => item.publicacao.id !== id) } : atual));
  }

  const lista = aba === "conferir" ? dados?.aConferir : dados?.enviadas;

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">Conferência da vistagem</h2>
            <p className="text-sm text-slate-600">Valide para mandar as tarefas ao robô de agendamento do VIOS, ou devolva ao jurídico com o motivo.</p>
          </div>
          <div className="inline-flex rounded-lg border border-[#dce9eb] bg-white p-1" role="group" aria-label="Situação">
            {(["conferir", "enviadas"] as Aba[]).map((valor) => (
              <Button
                key={valor}
                variant="ghost"
                size="sm"
                aria-pressed={aba === valor}
                className={cn(aba === valor && "bg-[#183f50] text-white hover:bg-[#183f50] hover:text-white")}
                onClick={() => setAba(valor)}
              >
                {valor === "conferir" ? "A conferir" : "Enviadas ao robô"}
                <span className="font-mono text-xs opacity-80">{valor === "conferir" ? dados?.aConferir.length ?? "" : dados?.enviadas.length ?? ""}</span>
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {dados?.envioSimulado ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
              <Bot className="size-3" />
              Modo simulação: o robô preenche no VIOS sem gravar
            </span>
          ) : null}
          {(integracoes ?? []).map((item) => (
            <span
              key={item.nome}
              title={item.detalhe}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                item.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              {item.ok ? <Check className="size-3" /> : <CircleAlert className="size-3" />}
              {item.nome}
            </span>
          ))}
        </div>
      </section>

      {aviso ? <p role="status" className="rounded-md border border-[#dce9eb] bg-white px-3 py-2 text-sm text-slate-700">{aviso}</p> : null}
      {erro ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}

      {aba === "enviadas" ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={atualizarEnvios} disabled={atualizando}>
            {atualizando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            Atualizar status do robô
          </Button>
        </div>
      ) : null}

      {lista === undefined ? (
        <div className="flex justify-center p-8"><LoaderCircle className="size-5 animate-spin text-slate-400" aria-label="Carregando" /></div>
      ) : lista.length === 0 ? (
        <p className="rounded-lg border border-[#dce9eb] bg-white p-8 text-center text-sm text-slate-600">
          {aba === "conferir" ? "Nenhuma vistagem para conferir." : "Nenhuma tarefa enviada ao robô ainda."}
        </p>
      ) : (
        <ul className="space-y-4">
          {lista.map((item) => (
            <CartaoConferencia
              key={item.publicacao.id}
              item={item}
              comEnvio={aba === "enviadas"}
              modoReal={!dados?.envioSimulado}
              onConcluido={concluido}
            />
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
