"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, LoaderCircle, Plus, Send, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { avisosDaData } from "@/lib/vistagem/agendamento";
import type { PublicacaoResumo, VistagemDetalhe } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { DadosPasta, DadosPublicacao, formatarData, formatarDataHora } from "./publicacao-ui";

type Etiqueta = "PRAZO" | "PROVIDENCIA";

interface Linha {
  chave: number;
  etiqueta: Etiqueta;
  tarefa: string;
  data: string;
  responsavel: string;
  revisor: string;
  observacao: string;
}

let proximaChave = 1;
function novaLinha(responsavel = "", base?: Partial<Linha>): Linha {
  return { chave: proximaChave++, etiqueta: "PRAZO", tarefa: "", data: "", responsavel, revisor: "", observacao: "", ...base };
}

const campo = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]";

function EditorVistagem({ id, onConcluida, onVoltar }: { id: string; onConcluida: (id: string) => void; onVoltar: () => void }) {
  const [detalhe, setDetalhe] = useState<VistagemDetalhe | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setDetalhe(null);
    setErro("");
    authFetch(`/api/operacoes-legais/vistagem/juridico/${id}`)
      .then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar a publicação.");
        if (cancelado) return;
        const dados = corpo as VistagemDetalhe;
        setDetalhe(dados);
        setObservacao(dados.publicacao.observacaoVistagem ?? "");
        setLinhas(
          dados.agendamentos.length
            ? dados.agendamentos.map((item) =>
                novaLinha(item.responsavel, {
                  etiqueta: item.etiqueta,
                  tarefa: item.tarefa,
                  data: item.data,
                  revisor: item.revisor ?? "",
                  observacao: item.observacao ?? "",
                })
              )
            : [novaLinha(dados.responsavelSugerido ?? "")]
        );
      })
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : "Falha ao carregar a publicação."));
    return () => {
      cancelado = true;
    };
  }, [id]);

  function alterar(chave: number, mudanca: Partial<Linha>) {
    setLinhas((atuais) => atuais.map((linha) => (linha.chave === chave ? { ...linha, ...mudanca } : linha)));
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
          agendamentos: linhas.map(({ etiqueta, tarefa, data, responsavel, revisor, observacao: obs }) => ({
            etiqueta,
            tarefa,
            data,
            responsavel,
            revisor: revisor || null,
            observacao: obs || null,
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
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
    ) : (
      <div className="flex justify-center p-10"><LoaderCircle className="size-5 animate-spin text-slate-400" aria-label="Carregando" /></div>
    );
  }

  const { publicacao, catalogo } = detalhe;
  const completo = linhas.every((linha) => linha.tarefa && linha.data && linha.responsavel);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="lg:hidden" onClick={onVoltar}>
        <ArrowLeft />
        Voltar à lista
      </Button>

      {publicacao.devolucaoMotivo ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          <p className="font-medium">Devolvida pela controladoria em {formatarDataHora(publicacao.devolvidoEm)}</p>
          <p className="whitespace-pre-wrap">{publicacao.devolucaoMotivo}</p>
        </div>
      ) : null}

      <section className="space-y-2 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium text-slate-900">{publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}</span>
          {publicacao.tribunal ? (
            <span className="rounded-full border border-[#3e84a8]/25 px-2 py-0.5 text-xs text-[#315f73]">{publicacao.tribunal}</span>
          ) : null}
        </div>
        <DadosPasta publicacao={{ ...publicacao, pendencia: null }} />
        <DadosPublicacao publicacao={publicacao} />
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#dce9eb] bg-slate-50/60 p-3 font-sans text-sm leading-relaxed text-slate-800">
          {publicacao.teor}
        </pre>
      </section>

      <section aria-labelledby="tarefas-titulo" className="space-y-3 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="tarefas-titulo" className="text-sm font-semibold text-slate-900">Tarefas no VIOS</h3>
          {catalogo ? <span className="text-xs text-slate-500">Lista do VIOS para {catalogo.area}</span> : null}
        </div>

        {!catalogo ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Não há lista de tarefas do VIOS para a área desta pasta. Avise a controladoria.
          </p>
        ) : (
          <>
            {linhas.map((linha, indice) => {
              const opcoes = catalogo.tarefas[linha.etiqueta];
              const avisos = linha.data ? avisosDaData(linha.data, detalhe.hoje) : [];
              return (
                <fieldset key={linha.chave} className="space-y-3 rounded-md border border-[#dce9eb] p-3">
                  <legend className="px-1 text-xs font-semibold uppercase text-slate-500">Tarefa {indice + 1}</legend>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg border border-[#dce9eb] p-1" role="group" aria-label="Tipo de tarefa">
                      {(["PRAZO", "PROVIDENCIA"] as Etiqueta[]).map((valor) => (
                        <Button
                          key={valor}
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-pressed={linha.etiqueta === valor}
                          className={cn(linha.etiqueta === valor && "bg-[#183f50] text-white hover:bg-[#183f50] hover:text-white")}
                          onClick={() => alterar(linha.chave, { etiqueta: valor, tarefa: "" })}
                        >
                          {valor === "PRAZO" ? "Prazo" : "Providência"}
                        </Button>
                      ))}
                    </div>
                    {linhas.length > 1 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-red-700"
                        onClick={() => setLinhas((atuais) => atuais.filter((item) => item.chave !== linha.chave))}
                        aria-label={`Remover tarefa ${indice + 1}`}
                      >
                        <Trash2 />
                        Remover
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(150px,1fr)]">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Tarefa
                      <select className={campo} value={linha.tarefa} onChange={(evento) => alterar(linha.chave, { tarefa: evento.target.value })}>
                        <option value="">Escolha a tarefa…</option>
                        {opcoes.map((opcao) => (
                          <option key={opcao.id} value={opcao.nome}>
                            {opcao.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Data no VIOS
                      <input
                        type="date"
                        className={campo}
                        value={linha.data}
                        onChange={(evento) => alterar(linha.chave, { data: evento.target.value })}
                      />
                    </label>
                  </div>
                  {avisos.length ? (
                    <p className="flex items-center gap-1 text-xs text-amber-800">
                      <TriangleAlert className="size-3.5" />
                      {avisos.join(" ")}
                    </p>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Responsável
                      <select className={campo} value={linha.responsavel} onChange={(evento) => alterar(linha.chave, { responsavel: evento.target.value })}>
                        <option value="">Escolha o responsável…</option>
                        {catalogo.usuarios.map((usuario) => (
                          <option key={usuario.id} value={usuario.nome}>
                            {usuario.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Revisor (opcional)
                      <select className={campo} value={linha.revisor} onChange={(evento) => alterar(linha.chave, { revisor: evento.target.value })}>
                        <option value="">Sem revisor</option>
                        {catalogo.usuarios.map((usuario) => (
                          <option key={usuario.id} value={usuario.nome}>
                            {usuario.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-1 text-xs font-medium text-slate-600">
                    Observação (vai na descrição da tarefa)
                    <Textarea
                      value={linha.observacao}
                      onChange={(evento) => alterar(linha.chave, { observacao: evento.target.value })}
                      maxLength={2000}
                      rows={2}
                    />
                  </label>
                </fieldset>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLinhas((atuais) => [...atuais, novaLinha(detalhe.responsavelSugerido ?? "")])}
              disabled={linhas.length >= 10}
            >
              <Plus />
              Adicionar tarefa
            </Button>

            <label className="block space-y-1 text-xs font-medium text-slate-600">
              Observação para a controladoria (opcional)
              <Textarea value={observacao} onChange={(evento) => setObservacao(evento.target.value)} maxLength={2000} rows={2} />
            </label>

            {erro ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}

            <div className="flex justify-end">
              <Button onClick={enviar} disabled={enviando || !completo}>
                {enviando ? <LoaderCircle className="animate-spin" /> : <Send />}
                Enviar para conferência
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Juridico() {
  const [escritorio, setEscritorio] = useState("");
  const [publicacoes, setPublicacoes] = useState<PublicacaoResumo[] | null>(null);
  const [porEscritorio, setPorEscritorio] = useState<Record<string, number>>({});
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async (filtro: string) => {
    setPublicacoes(null);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/juridico${filtro ? `?escritorio=${encodeURIComponent(filtro)}` : ""}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar a fila.");
      setPublicacoes(corpo.publicacoes);
      setPorEscritorio(corpo.porEscritorio);
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

  function concluida(id: string) {
    const restantes = (publicacoes ?? []).filter((p) => p.id !== id);
    setPublicacoes(restantes);
    setSelecionada(restantes[0]?.id ?? null);
    setAviso("Vistagem enviada para a conferência da controladoria.");
    setPorEscritorio((atual) => {
      const p = (publicacoes ?? []).find((item) => item.id === id);
      const chave = p?.escritorioResponsavel ?? "Sem escritório";
      return { ...atual, [chave]: Math.max(0, (atual[chave] ?? 1) - 1) };
    });
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Vistar publicações</h2>
          <p className="text-sm text-slate-600">Vincule a cada publicação as tarefas do VIOS, com data, responsável e observação.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Escritório
          <select className={cn(campo, "w-60")} value={escritorio} onChange={(evento) => setEscritorio(evento.target.value)}>
            <option value="">Todos ({total})</option>
            {escritorios.map(([nome, quantidade]) => (
              <option key={nome} value={nome}>
                {nome} ({quantidade})
              </option>
            ))}
          </select>
        </label>
      </section>

      {aviso ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{aviso}</p> : null}
      {erro ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <nav aria-label="Publicações a vistar" className={cn("rounded-lg border border-[#dce9eb] bg-white shadow-sm", selecionada && "hidden lg:block")}>
          {publicacoes === null ? (
            <div className="flex justify-center p-6"><LoaderCircle className="size-5 animate-spin text-slate-400" aria-label="Carregando" /></div>
          ) : publicacoes.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-600">Nenhuma publicação para vistar.</p>
          ) : (
            <ul className="max-h-[75vh] divide-y divide-[#dce9eb] overflow-auto">
              {publicacoes.map((publicacao) => (
                <li key={publicacao.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelecionada(publicacao.id);
                      setAviso("");
                    }}
                    aria-current={publicacao.id === selecionada ? "true" : undefined}
                    className={cn("w-full space-y-1 px-4 py-3 text-left hover:bg-[#47cdd0]/5", publicacao.id === selecionada && "bg-[#47cdd0]/10")}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-medium text-slate-900">{publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}</span>
                      {publicacao.demandaRisco ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-1.5 text-[11px] font-medium text-red-700">Risco</span>
                      ) : null}
                      {publicacao.devolucaoMotivo ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 text-[11px] font-medium text-amber-800">Devolvida</span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-slate-700">{publicacao.grupoCliente ?? publicacao.cliente ?? "—"}</span>
                    <span className="block text-xs text-slate-500">
                      {publicacao.escritorioResponsavel} · {publicacao.tribunal} · publ. {formatarData(publicacao.dataPublicacao)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className={cn(!selecionada && "hidden lg:block")}>
          {selecionada ? (
            <EditorVistagem key={selecionada} id={selecionada} onConcluida={concluida} onVoltar={() => setSelecionada(null)} />
          ) : (
            <p className="rounded-lg border border-dashed border-[#dce9eb] bg-white p-10 text-center text-sm text-slate-500">
              Escolha uma publicação na lista.
            </p>
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
