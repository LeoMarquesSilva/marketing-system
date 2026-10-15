"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, LoaderCircle, Plus, Send, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { avisosDaData } from "@/lib/vistagem/agendamento";
import {
  DIAS_PRAZO,
  criarCalendario,
  criarCalendarioDePrazo,
  datasDoPrazo,
  fatalPorDias,
  noRecessoForense,
  somarDiasUteis,
} from "@/lib/vistagem/dias-uteis";
import { CADEIA_PADRAO, PESSOA_FIXA_PROTOCOLAR, cadeiaDoFluxo, type FluxoDaTarefa, type TarefaDoFluxo } from "@/lib/vistagem/fluxo-vios";
import type { PublicacaoResumo, VistagemDetalhe } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { ComboboxBusca } from "./combobox-busca";
import { CartaoInconsistencia } from "./inconsistencias-ui";
import { DadosPasta, DadosPublicacao, formatarData, formatarDataHora } from "./publicacao-ui";

type Etiqueta = "PRAZO" | "PROVIDENCIA";

interface Linha {
  chave: number;
  etiqueta: Etiqueta;
  tarefa: string;
  /** Providência: data da tarefa no VIOS. */
  data: string;
  /** Prazo: data fatal (o VIOS recebe o Enviar, calculado pelo fluxo da tarefa). */
  dataFatal: string;
  diasPrazo: number | null;
  responsavel: string;
  revisor: string;
  observacao: string;
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
    responsavel: "",
    revisor: "",
    observacao: "",
    ...base,
  };
}

const campo = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]";

function linhaCompleta(linha: Linha): boolean {
  if (!linha.tarefa || !linha.responsavel) return false;
  return linha.etiqueta === "PRAZO" ? Boolean(linha.dataFatal && linha.revisor) : Boolean(linha.data);
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
    <div className="space-y-2 rounded-md border border-[#dce9eb] bg-[#f6fbfb] p-3 text-xs">
      {fluxo.criacao.length ? (
        <div className="space-y-1">
          <p className="font-medium text-slate-700">O VIOS cria junto (o robô coloca os responsáveis):</p>
          <ul className="space-y-1.5">
            {fluxo.criacao.map((tarefa) => {
              const data = dataDe(tarefa);
              return (
                <li key={tarefa.id} className="text-slate-700">
                  <span className="font-medium text-slate-900">{tarefa.nome}</span>
                  {tarefa.prazo ? <span className="text-slate-500"> · {tarefa.prazo}</span> : null}
                  {data ? <span className="font-mono"> · {formatarData(data)}</span> : null}
                  <span> → {quem(tarefa)}</span>
                  {tarefa.tambemCria.length ? (
                    <span className="block pl-3 text-slate-500">cria também: {tarefa.tambemCria.join(", ")}</span>
                  ) : null}
                  {tarefa.aoConcluir.length ? (
                    <span className="block pl-3 text-slate-500">ao concluir, cria: {tarefa.aoConcluir.join(", ")}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {fluxo.conclusao.length ? (
        <p className="text-slate-600">
          <span className="font-medium text-slate-700">Ao concluir esta tarefa, o VIOS cria:</span>{" "}
          {fluxo.conclusao.map((tarefa) => tarefa.nome).join(", ")} (com o responsável padrão do VIOS).
        </p>
      ) : null}
    </div>
  );
}

function EditorVistagem({ id, onConcluida, onVoltar }: { id: string; onConcluida: (id: string) => void; onVoltar: () => void }) {
  const [detalhe, setDetalhe] = useState<VistagemDetalhe | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recarga, setRecarga] = useState(0);

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
                novaLinha({
                  etiqueta: item.etiqueta,
                  tarefa: item.tarefa,
                  data: item.etiqueta === "PRAZO" ? "" : item.data,
                  dataFatal: item.dataFatal ?? "",
                  diasPrazo: item.diasPrazo,
                  responsavel: item.responsavel,
                  revisor: item.revisor ?? "",
                  observacao: item.observacao ?? "",
                })
              )
            : [novaLinha({ responsavel: dados.responsavelSugerido ?? "", revisor: dados.revisorSugerido ?? "" })]
        );
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

  async function enviar() {
    setEnviando(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/juridico/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observacao,
          agendamentos: linhas.map((linha) => ({
            etiqueta: linha.etiqueta,
            tarefa: linha.tarefa,
            data: linha.etiqueta === "PRAZO" ? "" : linha.data,
            dataFatal: linha.etiqueta === "PRAZO" ? linha.dataFatal : null,
            diasPrazo: linha.etiqueta === "PRAZO" ? linha.diasPrazo : null,
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
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
    ) : (
      <div className="flex justify-center p-10"><LoaderCircle className="size-5 animate-spin text-slate-400" aria-label="Carregando" /></div>
    );
  }

  const { publicacao, catalogo } = detalhe;
  const completo = linhas.every(linhaCompleta);
  const devolucoes = detalhe.inconsistencias.filter((item) => item.origem === "juridico");

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="lg:hidden" onClick={onVoltar}>
        <ArrowLeft />
        Voltar à lista
      </Button>

      {devolucoes.length ? (
        <div className="space-y-2" role="status">
          <p className="text-sm font-medium text-amber-900">Devolvida pela controladoria em {formatarDataHora(publicacao.devolvidoEm)}</p>
          {devolucoes.map((item) => (
            <CartaoInconsistencia key={item.id} inconsistencia={item} acao="contestar" onAlterada={() => setRecarga((valor) => valor + 1)} />
          ))}
        </div>
      ) : publicacao.devolucaoMotivo ? (
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

        {detalhe.fluxosErro ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            O fluxo de tarefas do VIOS não carregou ({detalhe.fluxosErro}). As datas do Prazo usam o fluxo padrão e o envio pode ser recusado.
          </p>
        ) : null}

        {!catalogo ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {detalhe.catalogoErro ?? "Não há lista de tarefas do VIOS para a área desta pasta."} Avise a controladoria.
          </p>
        ) : (
          <>
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
                          onClick={() => trocarEtiqueta(linha, valor)}
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

                  <div className="space-y-1 text-xs font-medium text-slate-600">
                    Tarefa
                    <ComboboxBusca
                      opcoes={catalogo.tarefas[linha.etiqueta]}
                      valor={linha.tarefa}
                      onChange={(nome) => alterar(linha.chave, { tarefa: nome })}
                      placeholder="Digite para buscar a tarefa…"
                      rotulo={`Tarefa ${indice + 1}`}
                    />
                  </div>

                  {prazo ? (
                    <div className="space-y-2 rounded-md bg-slate-50/70 p-3">
                      <div className="grid gap-3 sm:grid-cols-[minmax(150px,200px)_minmax(0,1fr)] sm:items-end">
                        <label className="space-y-1 text-xs font-medium text-slate-600">
                          Data fatal
                          <input
                            type="date"
                            className={campo}
                            value={linha.dataFatal}
                            onChange={(evento) => alterar(linha.chave, { dataFatal: evento.target.value, diasPrazo: null })}
                          />
                        </label>
                        <div className="space-y-1">
                          <span className="block text-xs font-medium text-slate-600">
                            Dias úteis após a publicação{publicacao.dataPublicacao ? ` (${formatarData(publicacao.dataPublicacao)})` : ""}
                          </span>
                          <div className="flex flex-wrap gap-1" role="group" aria-label="Prazo em dias úteis">
                            {DIAS_PRAZO.map((dias) => (
                              <Button
                                key={dias}
                                type="button"
                                size="xs"
                                variant="outline"
                                aria-pressed={linha.diasPrazo === dias}
                                disabled={!publicacao.dataPublicacao}
                                className={cn(linha.diasPrazo === dias && "border-[#183f50] bg-[#183f50] text-white hover:bg-[#183f50] hover:text-white")}
                                onClick={() =>
                                  publicacao.dataPublicacao &&
                                  alterar(linha.chave, { diasPrazo: dias, dataFatal: fatalPorDias(publicacao.dataPublicacao, dias, contaPrazo) })
                                }
                              >
                                {dias}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {cadeia ? (
                        <dl className="grid gap-2 text-xs sm:grid-cols-4">
                          <div>
                            <dt className="font-medium text-[#285f7a]">{cadeia.protocolar ? "Enviar" : "Tarefa"} (vai para o VIOS)</dt>
                            <dd className="font-mono font-semibold text-[#183f50]">{formatarData(cadeia.enviar)}</dd>
                          </div>
                          {cadeia.revisar ? (
                            <div>
                              <dt className="text-slate-500">Revisar</dt>
                              <dd className="font-mono text-slate-800">{formatarData(cadeia.revisar)}</dd>
                            </div>
                          ) : null}
                          {cadeia.protocolar ? (
                            <div>
                              <dt className="text-slate-500">Protocolar</dt>
                              <dd className="font-mono text-slate-800">{formatarData(cadeia.protocolar)}</dd>
                            </div>
                          ) : null}
                          <div>
                            <dt className="text-slate-500">Fatal</dt>
                            <dd className="font-mono text-slate-800">{formatarData(cadeia.fatal)}</dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="text-xs text-slate-500">Escolha a data fatal ou um atalho de dias para ver Enviar, Revisar e Protocolar.</p>
                      )}
                      {tarefaId && !cadeiaFluxo ? (
                        <p className="text-xs text-slate-600">
                          O VIOS não cria Revisar nem Protocolar para esta tarefa: ela vai com a data do protocolo (1 dia útil antes da fatal).
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <label className="block space-y-1 text-xs font-medium text-slate-600 sm:w-56">
                      Data no VIOS
                      <input type="date" className={campo} value={linha.data} onChange={(evento) => alterar(linha.chave, { data: evento.target.value })} />
                    </label>
                  )}
                  {avisos.length ? (
                    <p className="flex items-center gap-1 text-xs text-amber-800">
                      <TriangleAlert className="size-3.5" />
                      {avisos.join(" ")}
                    </p>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1 text-xs font-medium text-slate-600">
                      Responsável
                      <ComboboxBusca
                        opcoes={catalogo.usuarios}
                        valor={linha.responsavel}
                        onChange={(nome) => alterar(linha.chave, { responsavel: nome })}
                        placeholder="Digite para buscar…"
                        rotulo={`Responsável da tarefa ${indice + 1}`}
                      />
                    </div>
                    <div className="space-y-1 text-xs font-medium text-slate-600">
                      {prazo ? "Revisor (obrigatório no Prazo)" : "Revisor (opcional)"}
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
                        <span className="block font-normal text-slate-500">Auxiliar da pasta no VIOS.</span>
                      ) : null}
                    </div>
                  </div>

                  {fluxo ? (
                    <FluxoNoVios fluxo={fluxo} responsavel={linha.responsavel} revisor={linha.revisor} datas={datasDoFluxo} />
                  ) : tarefaId && !detalhe.fluxosErro ? (
                    <p className="text-xs text-slate-500">O VIOS não cria outras tarefas junto com esta.</p>
                  ) : null}

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
  const grupos = useMemo(() => agruparFila(publicacoes ?? []), [publicacoes]);

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
            <div className="max-h-[75vh] overflow-auto">
              {grupos.map((grupo) => (
                <section key={grupo.nome} aria-label={grupo.nome}>
                  <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#dce9eb] bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
                    <span className="truncate">{grupo.nome}</span>
                    <span className="font-mono font-normal text-slate-500">{grupo.publicacoes.length}</span>
                    {grupo.riscos ? (
                      <span className="ml-auto rounded-full border border-red-200 bg-red-50 px-1.5 text-[11px] font-medium text-red-700">
                        {grupo.riscos} de risco
                      </span>
                    ) : null}
                  </h3>
                  <ul className="divide-y divide-[#dce9eb]">
                    {grupo.publicacoes.map((publicacao) => (
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
                          <span className="block text-xs text-slate-700">{publicacao.cliente ?? "—"}</span>
                          <span className="block text-xs text-slate-500">
                            {publicacao.escritorioResponsavel} · {publicacao.tribunal} · publ. {formatarData(publicacao.dataPublicacao)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
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
