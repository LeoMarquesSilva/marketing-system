"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { CircleCheck, ExternalLink, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { ROTULO_ETIQUETA } from "@/lib/vistagem/agendamento";
import { ROTULO_CONTAGEM } from "@/lib/vistagem/dias-uteis";
import { SUBTIPOS_INCONSISTENCIA_AGENDAMENTO, TIPOS_INCONSISTENCIA_AGENDAMENTO } from "@/lib/vistagem/inconsistencias";
import type { TarefaNoVios } from "@/lib/vistagem/fila-vios";
import type { CheckResposta, ConferenciaItem } from "@/lib/vistagem/types";
import { linkTarefaVios } from "@/lib/vistagem/vios-links";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { CartaoInconsistencia } from "./inconsistencias-ui";
import { DadosPasta, DadosPublicacao, SeloEsocial, TeorPublicacao, formatarData, formatarDataHora } from "./publicacao-ui";

type Aba = "aChecar" | "revisar" | "checadas";

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "aChecar", rotulo: "A checar" },
  { valor: "revisar", rotulo: "Em revisão" },
  { valor: "checadas", rotulo: "Checadas" },
];

const campo = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";

/** Como a tarefa ficou no VIOS: a pedida e as que o fluxo criou, com a data e a hora agendadas. */
function AgendadoNoVios({ tarefas, dataPedida, horaPedida }: { tarefas: TarefaNoVios[]; dataPedida: string; horaPedida: string | null }) {
  return (
    <div className="rounded-md border border-[#dce9eb] bg-[#f6fbfb] px-3 py-2 text-xs">
      <p className="mb-1 font-medium text-slate-700">Agendado no VIOS</p>
      <ul className="space-y-1">
        {tarefas.map((tarefa) => {
          const diverge = tarefa.principal && ((tarefa.data && tarefa.data !== dataPedida) || (horaPedida && tarefa.hora !== horaPedida));
          return (
            <li key={tarefa.ci} className="flex flex-wrap items-baseline gap-x-2 text-slate-700">
              <span className={cn("font-medium", tarefa.principal ? "text-slate-900" : "text-slate-600")}>{tarefa.tipo ?? "Tarefa"}</span>
              <span className={cn("font-mono", diverge ? "font-semibold text-amber-800" : "text-[#183f50]")}>
                {formatarData(tarefa.data)}
                {tarefa.hora ? ` ${tarefa.hora}` : ""}
              </span>
              {tarefa.dataLimite && tarefa.dataLimite !== tarefa.data ? <span className="text-slate-500">limite {formatarData(tarefa.dataLimite)}</span> : null}
              {tarefa.responsaveis ? <span className="text-slate-500">· {tarefa.responsaveis}</span> : null}
              <a
                href={linkTarefaVios(tarefa.ci)}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir a tarefa no VIOS (nova aba)"
                className="font-mono text-[#347796] hover:text-[#285f7a] hover:underline"
              >
                CI {tarefa.ci}
              </a>
              {diverge ? (
                <span className="inline-flex items-center gap-1 text-amber-800">
                  <TriangleAlert className="size-3" aria-hidden />
                  pedido {formatarData(dataPedida)}
                  {horaPedida ? ` ${horaPedida}` : ""}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CartaoCheck({ item, aba, onConcluido }: { item: ConferenciaItem; aba: Aba; onConcluido: (mensagem: string) => void }) {
  const [modo, setModo] = useState<"nenhum" | "ok" | "erro">("nenhum");
  const [nota, setNota] = useState("");
  const [tipo, setTipo] = useState("");
  const [subtipo, setSubtipo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const { publicacao } = item;

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
      onConcluido(acao === "ok" ? "Check registrado." : "Inconsistência registrada; a publicação ficou em revisão.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
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
          <SeloEsocial publicacao={publicacao} />
          <span className="text-xs text-slate-500">
            vistada {item.vistadoPor ? `por ${item.vistadoPor} ` : ""}em {formatarDataHora(publicacao.vistadoEm)} · conferida{" "}
            {item.conferidoPor ? `por ${item.conferidoPor} ` : ""}em {formatarDataHora(publicacao.conferidoEm)}
          </span>
        </div>
        <DadosPasta publicacao={{ ...publicacao, pendencia: null }} />
        <DadosPublicacao publicacao={publicacao} />
        <TeorPublicacao publicacao={publicacao} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Tarefa no VIOS</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Responsável</th>
              <th className="px-3 py-2 font-medium">CI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dce9eb]">
            {item.agendamentos.map((agendamento) => (
              <Fragment key={agendamento.id}>
                <tr className="align-top">
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-900">{agendamento.tarefa}</span>
                    <span className="ml-1 text-xs text-slate-500">({ROTULO_ETIQUETA[agendamento.etiqueta]})</span>
                    {agendamento.observacao ? <span className="mt-1 block whitespace-pre-wrap text-xs text-slate-600">{agendamento.observacao}</span> : null}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {formatarData(agendamento.data)}
                    {agendamento.hora ? <span className="block">às {agendamento.hora}</span> : null}
                    {agendamento.dataFatal ? (
                      <span className="block font-sans text-xs text-slate-500">
                        enviar · fatal {formatarData(agendamento.dataFatal)}
                        {agendamento.diasPrazo && agendamento.contagemPrazo
                          ? ` · ${agendamento.diasPrazo} ${ROTULO_CONTAGEM[agendamento.contagemPrazo]}`
                          : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {agendamento.responsavel}
                    {agendamento.revisor ? <span className="block text-xs text-slate-500">Revisor: {agendamento.revisor}</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    {agendamento.viosTarefaId ? (
                      <a
                        href={linkTarefaVios(agendamento.viosTarefaId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir a tarefa no VIOS (nova aba)"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#347796] hover:text-[#285f7a] hover:underline"
                      >
                        <span className="font-mono tabular-nums">CI {agendamento.viosTarefaId}</span>
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
                {agendamento.viosTarefas?.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 pb-3 pt-0">
                      <AgendadoNoVios tarefas={agendamento.viosTarefas} dataPedida={agendamento.data} horaPedida={agendamento.hora} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {item.inconsistencias.length ? (
        <div className="space-y-2 border-t border-[#dce9eb] px-4 py-3">
          {item.inconsistencias.map((inconsistencia) => (
            <CartaoInconsistencia key={inconsistencia.id} inconsistencia={inconsistencia} acao={null} />
          ))}
        </div>
      ) : null}

      {aba === "checadas" ? (
        <p className="border-t border-[#dce9eb] px-4 py-3 text-sm text-emerald-800">
          <CircleCheck className="mr-1 inline size-4" />
          Checada em {formatarDataHora(publicacao.checadoEm)}
          {publicacao.checkNota ? <span className="mt-1 block whitespace-pre-wrap text-slate-700">{publicacao.checkNota}</span> : null}
        </p>
      ) : (
        <div className="space-y-3 border-t border-[#dce9eb] px-4 py-3">
          {modo === "ok" ? (
            <div className="space-y-2">
              <label className="block space-y-1 text-xs font-medium text-slate-600">
                Observação do check (opcional)
                <Textarea value={nota} onChange={(evento) => setNota(evento.target.value)} rows={2} maxLength={2000} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => enviar("ok")} disabled={ocupado}>
                  {ocupado ? <LoaderCircle className="animate-spin" /> : <CircleCheck />}
                  Confirmar check
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setModo("nenhum")} disabled={ocupado}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : modo === "erro" ? (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Tipo
                  <select className={campo} value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
                    <option value="">Escolha…</option>
                    {TIPOS_INCONSISTENCIA_AGENDAMENTO.map((valor) => (
                      <option key={valor} value={valor}>
                        {valor}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Subtipo
                  <select className={campo} value={subtipo} onChange={(evento) => setSubtipo(evento.target.value)}>
                    <option value="">Escolha…</option>
                    {SUBTIPOS_INCONSISTENCIA_AGENDAMENTO.map((valor) => (
                      <option key={valor} value={valor}>
                        {valor}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-xs font-medium text-slate-600">
                O que está errado
                <Textarea value={descricao} onChange={(evento) => setDescricao(evento.target.value)} rows={2} maxLength={2000} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => enviar("erro")} disabled={ocupado || !tipo || !subtipo || !descricao.trim()}>
                  {ocupado ? <LoaderCircle className="animate-spin" /> : <TriangleAlert />}
                  Registrar e colocar em revisão
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setModo("nenhum")} disabled={ocupado}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setModo("ok")}>
                <CircleCheck />
                {aba === "revisar" ? "Corrigido: dar check" : "Check OK"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setModo("erro")}>
                <TriangleAlert />
                Encontrei erro
              </Button>
            </div>
          )}
          {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
        </div>
      )}
    </li>
  );
}

function Check() {
  const [aba, setAba] = useState<Aba>("aChecar");
  const [dados, setDados] = useState<CheckResposta | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

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

  const lista = dados?.[aba];

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Check dos agendamentos</h2>
          <p className="text-sm text-slate-600">
            Confira no VIOS se a esteira e o agendamento estão corretos. Erro encontrado vira inconsistência e a publicação fica em revisão.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-[#dce9eb] bg-white p-1" role="group" aria-label="Situação do check">
          {ABAS.map((item) => (
            <Button
              key={item.valor}
              variant="ghost"
              size="sm"
              aria-pressed={aba === item.valor}
              className={cn(aba === item.valor && "bg-[#183f50] text-white hover:bg-[#183f50] hover:text-white")}
              onClick={() => setAba(item.valor)}
            >
              {item.rotulo} <span className="font-mono text-xs opacity-80">{dados?.[item.valor].length ?? ""}</span>
            </Button>
          ))}
        </div>
      </section>

      {aviso ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{aviso}</p> : null}
      {erro ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}

      {lista === undefined ? (
        <div className="flex justify-center p-8"><LoaderCircle className="size-5 animate-spin text-slate-400" aria-label="Carregando" /></div>
      ) : lista.length === 0 ? (
        <p className="rounded-lg border border-[#dce9eb] bg-white p-8 text-center text-sm text-slate-600">
          {aba === "aChecar" ? "Nenhum agendamento aguardando check." : aba === "revisar" ? "Nada em revisão." : "Nenhuma publicação checada ainda."}
        </p>
      ) : (
        <ul className="space-y-4">
          {lista.map((item) => (
            <CartaoCheck
              key={item.publicacao.id}
              item={item}
              aba={aba}
              onConcluido={(mensagem) => {
                setAviso(mensagem);
                void carregar();
              }}
            />
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
