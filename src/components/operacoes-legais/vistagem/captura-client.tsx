"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, ClipboardList, CloudDownload, FileSpreadsheet, Inbox, LoaderCircle, Scale, SearchX, Upload, X } from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { ArquivoDoDia } from "@/lib/vistagem/alerta-arquivo";
import type { ArquivoKurierResumo, PublicacaoResumo, SincronizacaoResultado } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { FaixaArquivoDoDia, useArquivoDoDia } from "./aviso-arquivo-do-dia";
import { DadosPasta, DadosPublicacao, StatusPublicacao, TeorPublicacao, formatarData, formatarDataHora } from "./publicacao-ui";
import {
  Aviso,
  BarraAba,
  Busca,
  CabecalhoLista,
  Carregando,
  Indicador,
  Indicadores,
  Painel,
  PainelTopo,
  Selo,
  Vazio,
  linhaLista,
  type TomSelo,
} from "./ui";

type Filtro = "todas" | "juridico_vistar" | "triagem_pendente" | "duplicidade" | "descartada" | "captada";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "juridico_vistar", rotulo: "Jurídico vistar" },
  { valor: "triagem_pendente", rotulo: "Pendências" },
  { valor: "duplicidade", rotulo: "Duplicidades" },
  { valor: "descartada", rotulo: "Descartadas" },
  { valor: "captada", rotulo: "Aguardando triagem" },
];

const ORIGEM: Record<ArquivoKurierResumo["origem"], string> = { sharepoint: "SharePoint", upload: "envio manual" };

const SITUACAO_ARQUIVO: Record<ArquivoKurierResumo["status"], { rotulo: string; tom: TomSelo }> = {
  processado: { rotulo: "Importado", tom: "sucesso" },
  processando: { rotulo: "Importando", tom: "alerta" },
  erro: { rotulo: "Erro", tom: "perigo" },
};

function resumoTriagem(triagem: SincronizacaoResultado["triagem"]): string {
  if (!triagem) return "";
  if (triagem.erro) return ` Triagem com o SIOE falhou: ${triagem.erro}`;
  if (!triagem.triadas) return "";
  const descartadas = triagem.descartadas ? `, ${triagem.descartadas} ex-cliente(s) sem o escritório descartada(s)` : "";
  return ` Triagem: ${triagem.juridico} para o jurídico, ${triagem.pendentes} pendente(s) na controladoria${descartadas}.`;
}

function resumoSincronizacao(resultado: SincronizacaoResultado): string {
  const erros = resultado.resultados.filter((item) => item.situacao === "erro");
  if (erros.length) return `${erros.length} arquivo(s) com erro: ${erros.map((item) => `${item.nome} (${item.mensagem})`).join("; ")}`;
  const triagem = resumoTriagem(resultado.triagem);
  if (resultado.importados) return `${resultado.importados} arquivo(s) novo(s) importado(s).${triagem}`;
  if (resultado.verificados === 0) return `O arquivo de hoje ainda não chegou na pasta da Kurier.${triagem}`;
  return `O arquivo de hoje já estava importado.${triagem}`;
}

/**
 * A consulta do arquivo do dia roda uma vez ao abrir a aba; depois de buscar no SharePoint ou
 * enviar o xlsx, a lista de arquivos (recarregada) diz se o de hoje já chegou.
 */
function situacaoAtualizada(situacao: ArquivoDoDia | null | undefined, arquivos: ArquivoKurierResumo[] | null) {
  if (!situacao || !arquivos) return situacao;
  const deHoje = arquivos.filter((arquivo) => arquivo.dataArquivo === situacao.hoje);
  if (!deHoje.length) return situacao;
  const chegou = deHoje.some((arquivo) => arquivo.status === "processado");
  const processando = deHoje.some((arquivo) => arquivo.status === "processando");
  const falha = deHoje.find((arquivo) => arquivo.status === "erro");
  return {
    ...situacao,
    chegou,
    erro: chegou ? null : falha ? (falha.erro ?? "erro na importação") : situacao.erro,
    atrasado: situacao.atrasado && !chegou && !processando,
  };
}

function estadoDeHoje(
  situacao: ArquivoDoDia | null | undefined,
  arquivos: ArquivoKurierResumo[] | null
): { valor: string; tom: "neutro" | "alerta" | "perigo" | "sucesso"; detalhe: string } {
  if (situacao === undefined) return { valor: "—", tom: "neutro", detalhe: "Verificando…" };
  if (situacao === null) return { valor: "—", tom: "neutro", detalhe: "Não foi possível verificar" };
  const deHoje = (arquivos ?? []).filter((arquivo) => arquivo.dataArquivo === situacao.hoje);
  if (situacao.chegou) {
    const importado = deHoje.find((arquivo) => arquivo.status === "processado");
    return {
      valor: "Chegou",
      tom: "sucesso",
      detalhe: importado ? `Recebido ${formatarDataHora(importado.recebidoEm)} · ${ORIGEM[importado.origem]}` : formatarData(situacao.hoje),
    };
  }
  const processando = deHoje.find((arquivo) => arquivo.status === "processando");
  if (processando) return { valor: "Importando", tom: "alerta", detalhe: `Recebido ${formatarDataHora(processando.recebidoEm)}` };
  if (situacao.erro) return { valor: "Com erro", tom: "perigo", detalhe: "A importação falhou; reenvie o .xlsx" };
  if (!situacao.diaUtil) return { valor: "Sem arquivo", tom: "neutro", detalhe: "Hoje não é dia útil" };
  if (situacao.atrasado) return { valor: "Não chegou", tom: "perigo", detalhe: "Confira a Kurier ou envie o .xlsx" };
  return { valor: "Aguardando", tom: "neutro", detalhe: "A busca automática roda entre 7h e 8h" };
}

function SituacaoArquivo({ arquivo }: { arquivo: ArquivoKurierResumo }) {
  const { rotulo, tom } = SITUACAO_ARQUIVO[arquivo.status];
  return (
    <span className="shrink-0" title={arquivo.erro ?? undefined}>
      <Selo tom={tom}>{rotulo}</Selo>
    </span>
  );
}

function Contagem({ valor, singular, plural }: { valor: number; singular: string; plural: string }) {
  return (
    <span>
      <span className="font-mono text-foreground">{valor}</span> {valor === 1 ? singular : plural}
    </span>
  );
}

function Captura() {
  const situacaoDoDia = useArquivoDoDia();
  const [arquivos, setArquivos] = useState<ArquivoKurierResumo[] | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [publicacoes, setPublicacoes] = useState<PublicacaoResumo[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState<"sincronizar" | "enviar" | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [erroLista, setErroLista] = useState("");
  const inputArquivo = useRef<HTMLInputElement>(null);

  const carregarArquivos = useCallback(async (selecionar?: string) => {
    setErroLista("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/arquivos");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar os arquivos.");
      setArquivos(corpo.arquivos);
      setSelecionado((atual) => selecionar ?? atual ?? corpo.arquivos[0]?.id ?? null);
    } catch (e) {
      setErroLista(e instanceof Error ? e.message : "Falha ao carregar os arquivos.");
      setArquivos([]);
    }
  }, []);

  useEffect(() => {
    void carregarArquivos();
  }, [carregarArquivos]);

  useEffect(() => {
    if (!selecionado) return;
    let cancelado = false;
    setPublicacoes(null);
    authFetch(`/api/operacoes-legais/vistagem/arquivos/${selecionado}/publicacoes`)
      .then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar as publicações.");
        if (!cancelado) setPublicacoes(corpo.publicacoes);
      })
      .catch((e) => {
        if (!cancelado) {
          setPublicacoes([]);
          setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao carregar as publicações." });
        }
      });
    return () => {
      cancelado = true;
    };
  }, [selecionado]);

  async function sincronizar() {
    setOcupado("sincronizar");
    setAviso(null);
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/sincronizar", { method: "POST" });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao buscar no SharePoint.");
      const resultado = corpo as SincronizacaoResultado;
      const falhou = resultado.resultados.some((item) => item.situacao === "erro") || Boolean(resultado.triagem?.erro);
      setAviso({ tipo: falhou ? "erro" : "ok", texto: resumoSincronizacao(resultado) });
      await carregarArquivos();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao buscar no SharePoint." });
    } finally {
      setOcupado(null);
    }
  }

  async function enviar(arquivo: File) {
    setOcupado("enviar");
    setAviso(null);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      const resposta = await authFetch("/api/operacoes-legais/vistagem/arquivos", { method: "POST", body: form });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao importar o arquivo.");
      setAviso({
        tipo: "ok",
        texto: corpo.novo
          ? `${arquivo.name} importado.${resumoTriagem(corpo.triagem)}`
          : `${arquivo.name} já tinha sido importado; nada foi duplicado.`,
      });
      await carregarArquivos(corpo.arquivo.id);
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao importar o arquivo." });
    } finally {
      setOcupado(null);
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
  }

  const contagem = useMemo(() => {
    const total: Record<Filtro, number> = { todas: 0, juridico_vistar: 0, triagem_pendente: 0, duplicidade: 0, descartada: 0, captada: 0 };
    for (const p of publicacoes ?? []) {
      total.todas += 1;
      if (p.status in total) total[p.status as Filtro] += 1;
    }
    return total;
  }, [publicacoes]);

  const visiveis = useMemo(() => {
    const termo = busca.replace(/\D/g, "");
    const texto = busca.trim().toLowerCase();
    return (publicacoes ?? []).filter((p) => {
      if (filtro !== "todas" && p.status !== filtro) return false;
      if (!texto) return true;
      if (termo.length >= 4 && (p.numeroProcesso ?? p.numeroProcessoOriginal).replace(/\D/g, "").includes(termo)) return true;
      return [p.tribunal, p.djenOrgao, p.escritorioResponsavel, p.grupoCliente, p.cliente, p.pastaCi, ...p.djenIntimados].some((campo) =>
        campo?.toLowerCase().includes(texto)
      );
    });
  }, [publicacoes, filtro, busca]);

  const porEscritorio = useMemo(() => {
    const total = new Map<string, number>();
    for (const p of publicacoes ?? []) {
      if (p.status === "juridico_vistar" && p.escritorioResponsavel) {
        total.set(p.escritorioResponsavel, (total.get(p.escritorioResponsavel) ?? 0) + 1);
      }
    }
    return [...total.entries()].sort((a, b) => b[1] - a[1]);
  }, [publicacoes]);

  const situacaoHoje = useMemo(() => situacaoAtualizada(situacaoDoDia, arquivos), [situacaoDoDia, arquivos]);
  const hoje = estadoDeHoje(situacaoHoje, arquivos);
  const arquivoAtual = arquivos?.find((arquivo) => arquivo.id === selecionado) ?? null;
  const publicacoesProntas = Boolean(arquivoAtual && publicacoes);
  const semArquivo = arquivos === null ? "Carregando…" : "Nenhum arquivo importado";
  const filtrando = filtro !== "todas" || busca.trim() !== "";

  return (
    <div className="space-y-6">
      <FaixaArquivoDoDia situacao={situacaoHoje} naCaptura />

      <div className="space-y-3">
        <BarraAba resumo="O arquivo do dia é buscado sozinho no SharePoint entre 7h e 8h (nova tentativa entre 9h e 10h, em dias úteis) e triado com o SIOE. Pendências seguem para a Controladoria; duplicidades, para Duplicidades.">
          <Button variant="outline" onClick={() => inputArquivo.current?.click()} disabled={ocupado !== null}>
            {ocupado === "enviar" ? <LoaderCircle className="animate-spin" /> : <Upload />}
            Enviar xlsx
          </Button>
          <Button onClick={sincronizar} disabled={ocupado !== null}>
            {ocupado === "sincronizar" ? <LoaderCircle className="animate-spin" /> : <CloudDownload />}
            Buscar no SharePoint
          </Button>
          <input
            ref={inputArquivo}
            type="file"
            accept=".xlsx"
            className="hidden"
            aria-label="Arquivo xlsx da Kurier"
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              if (arquivo) void enviar(arquivo);
            }}
          />
        </BarraAba>

        {aviso ? (
          <Aviso
            tom={aviso.tipo === "ok" ? "sucesso" : "erro"}
            acao={
              <Button variant="ghost" size="icon-xs" className="-my-1 text-current" aria-label="Fechar aviso" onClick={() => setAviso(null)}>
                <X />
              </Button>
            }
          >
            {aviso.texto}
          </Aviso>
        ) : null}
      </div>

      <Indicadores>
        <Indicador icone={CalendarClock} rotulo="Arquivo de hoje" valor={hoje.valor} tom={hoje.tom}>
          {hoje.detalhe}
        </Indicador>
        <Indicador
          icone={Inbox}
          rotulo={arquivoAtual ? `Captadas em ${formatarData(arquivoAtual.dataArquivo).slice(0, 5)}` : "Captadas"}
          valor={arquivoAtual ? arquivoAtual.totalCaptadas : "—"}
        >
          {arquivoAtual
            ? `${arquivoAtual.totalLinhas} linhas · ${arquivoAtual.totalDuplicidades} duplicidades · ${arquivoAtual.totalDescartadas} descartadas`
            : semArquivo}
        </Indicador>
        <Indicador icone={Scale} rotulo="Para o jurídico" valor={publicacoesProntas ? contagem.juridico_vistar : "—"}>
          {!arquivoAtual
            ? semArquivo
            : !publicacoesProntas
              ? "Carregando…"
              : porEscritorio.length
                ? porEscritorio.map(([escritorio, total]) => `${escritorio} ${total}`).join(" · ")
                : "Nenhuma liberada neste arquivo"}
        </Indicador>
        <Indicador
          icone={ClipboardList}
          rotulo="Pendências"
          valor={publicacoesProntas ? contagem.triagem_pendente : "—"}
          tom={publicacoesProntas && contagem.triagem_pendente ? "alerta" : "neutro"}
        >
          {!arquivoAtual
            ? semArquivo
            : !publicacoesProntas
              ? "Carregando…"
              : contagem.captada
                ? `${contagem.captada} aguardando triagem`
                : contagem.triagem_pendente
                  ? "Resolva na aba Controladoria"
                  : "Nada pendente neste arquivo"}
        </Indicador>
      </Indicadores>

      <div className={cn("grid gap-6", arquivoAtual && "xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:items-start")}>
        <Painel aria-labelledby="arquivos-titulo">
          <PainelTopo
            id="arquivos-titulo"
            titulo={
              <>
                Arquivos recebidos
                {arquivos?.length ? <span className="ml-2 font-normal tabular-nums text-muted-foreground">{arquivos.length}</span> : null}
              </>
            }
            descricao="Escolha um dia para ver as publicações"
          />
          {arquivos === null ? (
            <Carregando rotulo="Carregando arquivos" />
          ) : erroLista ? (
            <div className="p-4">
              <Aviso tom="erro" titulo="Não foi possível carregar os arquivos">
                {erroLista}
              </Aviso>
            </div>
          ) : arquivos.length === 0 ? (
            <Vazio icone={FileSpreadsheet} titulo="Nenhum arquivo importado ainda">
              Use “Buscar no SharePoint” ou envie o xlsx do dia.
            </Vazio>
          ) : (
            <ul className="max-h-[22rem] divide-y divide-[#eef3f5] overflow-y-auto xl:max-h-[44rem]">
              {arquivos.map((arquivo) => {
                const ativo = arquivo.id === selecionado;
                return (
                  <li key={arquivo.id}>
                    <button
                      type="button"
                      className={linhaLista(ativo)}
                      aria-current={ativo ? "true" : undefined}
                      onClick={() => setSelecionado(arquivo.id)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {formatarData(arquivo.dataArquivo)}
                          {arquivo.lote > 1 ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">lote {arquivo.lote}</span> : null}
                        </span>
                        <SituacaoArquivo arquivo={arquivo} />
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Recebido {formatarDataHora(arquivo.recebidoEm)} · {ORIGEM[arquivo.origem]}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <Contagem valor={arquivo.totalLinhas} singular="linha" plural="linhas" />
                        <Contagem valor={arquivo.totalCaptadas} singular="captada" plural="captadas" />
                        <Contagem valor={arquivo.totalDuplicidades} singular="duplicidade" plural="duplicidades" />
                        <Contagem valor={arquivo.totalDescartadas} singular="descartada" plural="descartadas" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>

        {arquivoAtual ? (
          <section aria-labelledby="publicacoes-titulo" className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="mr-auto min-w-0">
                <h2 id="publicacoes-titulo" className="text-base font-semibold text-foreground">
                  Publicações de {formatarData(arquivoAtual.dataArquivo)}
                  {arquivoAtual.lote > 1 ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">lote {arquivoAtual.lote}</span> : null}
                </h2>
                <p className="truncate text-xs text-muted-foreground" title={arquivoAtual.nomeArquivo}>
                  {arquivoAtual.nomeArquivo}
                </p>
              </div>
              <Busca
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Processo, CI, grupo, escritório ou intimado"
                aria-label="Buscar publicação"
                className="sm:w-72"
              />
            </div>

            <Segmented
              label="Filtrar por situação"
              value={filtro}
              options={FILTROS.filter((item) => item.valor !== "captada" || contagem.captada > 0 || filtro === "captada").map((item) => ({
                value: item.valor,
                label: `${item.rotulo} ${contagem[item.valor]}`,
              }))}
              onChange={setFiltro}
            />

            {arquivoAtual.status === "erro" ? (
              <Aviso tom="erro" titulo="A importação deste arquivo falhou">
                {arquivoAtual.erro}
              </Aviso>
            ) : null}

            <Painel>
              {publicacoes === null ? (
                <Carregando rotulo="Carregando publicações" />
              ) : publicacoes.length === 0 ? (
                <Vazio icone={FileSpreadsheet} titulo="Nenhuma publicação neste arquivo" />
              ) : visiveis.length === 0 ? (
                <Vazio icone={SearchX} titulo="Nenhuma publicação com esse filtro">
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => {
                      setFiltro("todas");
                      setBusca("");
                    }}
                  >
                    Limpar filtros
                  </Button>
                </Vazio>
              ) : (
                <>
                  <CabecalhoLista className="tabular-nums" aria-live="polite">
                    {filtrando
                      ? `${visiveis.length} de ${publicacoes.length} ${publicacoes.length === 1 ? "publicação" : "publicações"}`
                      : `${publicacoes.length} ${publicacoes.length === 1 ? "publicação" : "publicações"}`}
                  </CabecalhoLista>
                  <ul className="divide-y divide-[#eef3f5]">
                    {visiveis.map((publicacao) => (
                      <li key={publicacao.id} className="space-y-2.5 px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}
                          </span>
                          {publicacao.tribunal ? <Selo>{publicacao.tribunal}</Selo> : null}
                          <StatusPublicacao status={publicacao.status} />
                          {publicacao.linhaArquivo ? (
                            <span className="ml-auto text-xs tabular-nums text-muted-foreground">linha {publicacao.linhaArquivo}</span>
                          ) : null}
                        </div>
                        <DadosPasta publicacao={publicacao} />
                        <DadosPublicacao publicacao={publicacao} />
                        <TeorPublicacao key={publicacao.id} publicacao={publicacao} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Painel>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function CapturaClient() {
  return (
    <AcessoOperacoesLegais>
      <Captura />
    </AcessoOperacoesLegais>
  );
}
