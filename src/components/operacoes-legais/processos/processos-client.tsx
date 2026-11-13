"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, CloudUpload, Download, FolderSearch, Gavel, ListChecks, LoaderCircle, RefreshCw, SearchX, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProcessoResumo } from "@/lib/processos/types";
import { LogoGrupo } from "../vistagem/marcas";
import { Seletor, SeletorBusca, type OpcaoSeletor } from "../vistagem/seletor";
import { Aviso, BarraAba, Busca, CabecalhoLista, Carregando, Indicador, Indicadores, Painel, Selo, Vazio, linhaLista } from "../vistagem/ui";
import { AcessoProcessos } from "./acesso-processos";
import { BarraPreenchimento } from "./preenchimento-ui";
import { mensagemDeErro, processosApi } from "./processos-api";

const COLUNAS = "lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_9rem] lg:items-center lg:gap-4";
const PASSO = 100;

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function opcoesDe(processos: ProcessoResumo[], valor: (processo: ProcessoResumo) => string | null): OpcaoSeletor[] {
  const contagem = new Map<string, number>();
  for (const processo of processos) {
    const item = valor(processo);
    if (item) contagem.set(item, (contagem.get(item) ?? 0) + 1);
  }
  return [...contagem.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([item, total]) => ({ valor: item, rotulo: item, contagem: total }));
}

function tomDaSituacao(situacao: string | null): "sucesso" | "neutro" {
  return situacao && /^ativo/i.test(situacao) ? "sucesso" : "neutro";
}

export function ProcessosClient() {
  return (
    <AcessoProcessos>
      <Lista />
    </AcessoProcessos>
  );
}

function Lista() {
  const [processos, setProcessos] = useState<ProcessoResumo[] | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const [situacao, setSituacao] = useState("");
  const [fase, setFase] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [uf, setUf] = useState("");
  // "Mostrar mais" vale só para o filtro em que foi clicado: mudou o filtro, a lista volta ao começo.
  const [pagina, setPagina] = useState({ filtro: "", linhas: PASSO });
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await processosApi.get<{ processos: ProcessoResumo[] }>();
      setProcessos(resposta.processos);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const todos = useMemo(() => processos ?? [], [processos]);
  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    const digitos = busca.replace(/\D/g, "");
    return todos.filter((processo) => {
      if (grupo && processo.grupoCliente !== grupo) return false;
      if (situacao && processo.situacao !== situacao) return false;
      if (fase && processo.fase !== fase) return false;
      if (responsavel && processo.advogadoResponsavel !== responsavel) return false;
      if (uf && processo.uf !== uf) return false;
      if (!termo) return true;
      if (digitos.length >= 4 && ((processo.cnj ?? "").replace(/\D/g, "").includes(digitos) || (processo.ci ?? "").includes(digitos))) return true;
      return [processo.parteAtiva, processo.partePassiva, processo.cliente, processo.acao, processo.comarca].some((campo) => campo && semAcento(campo).includes(termo));
    });
  }, [todos, busca, grupo, situacao, fase, responsavel, uf]);

  const filtro = [busca, grupo, situacao, fase, responsavel, uf].join("\u0001");
  const visiveis = pagina.filtro === filtro ? pagina.linhas : PASSO;

  const filtrando = Boolean(busca || grupo || situacao || fase || responsavel || uf);
  const ativos = todos.filter((processo) => /^ativo/i.test(processo.situacao ?? "")).length;
  const media = todos.length ? Math.round(todos.reduce((soma, processo) => soma + processo.percentual, 0) / todos.length) : 0;
  const completos = todos.filter((processo) => processo.percentual >= 100).length;
  const pendentesVios = todos.reduce((soma, processo) => soma + processo.pendentesVios, 0);

  function limpar() {
    setBusca("");
    setGrupo("");
    setSituacao("");
    setFase("");
    setResponsavel("");
    setUf("");
  }

  async function exportar() {
    setExportando(true);
    setErro("");
    try {
      await processosApi.baixarPlanilha(filtrando ? filtrados.map((processo) => processo.id) : null);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setExportando(false);
    }
  }

  if (carregando && !processos) return <Carregando rotulo="Carregando os processos" />;

  return (
    <div className="space-y-4">
      <Indicadores>
        <Indicador icone={Gavel} rotulo="Processos no cadastro" valor={todos.length}>
          {ativos} ativo{ativos === 1 ? "" : "s"}
        </Indicador>
        <Indicador icone={ListChecks} rotulo="Cadastro preenchido (média)" valor={`${media}%`} tom={media >= 80 ? "sucesso" : media < 50 ? "alerta" : "neutro"}>
          da lista de campos da equipe
        </Indicador>
        <Indicador icone={CircleCheck} rotulo="Cadastros completos" valor={completos} tom={completos ? "sucesso" : "neutro"}>
          de {todos.length}
        </Indicador>
        <Indicador icone={CloudUpload} rotulo="Alterações a gravar no VIOS" valor={pendentesVios} tom={pendentesVios ? "alerta" : "neutro"}>
          campos editados aqui
        </Indicador>
      </Indicadores>

      {erro ? (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => void carregar()}>
              <RefreshCw /> Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : null}

      <BarraAba
        resumo={
          <span>
            <strong className="font-semibold text-foreground tabular-nums">{filtrados.length}</strong> {filtrados.length === 1 ? "processo" : "processos"}
            {filtrando ? ` de ${todos.length}` : ""}
          </span>
        }
      >
        <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="CNJ, CI, parte ou ação" aria-label="Buscar processo" className="sm:w-72" />
        <SeletorBusca valor={grupo} onChange={setGrupo} opcoes={opcoesDe(todos, (processo) => processo.grupoCliente)} todos={{ rotulo: "Todos os grupos" }} rotulo="Grupo do cliente" className="sm:w-52" />
        <Seletor valor={situacao} onChange={setSituacao} opcoes={opcoesDe(todos, (processo) => processo.situacao)} todos={{ rotulo: "Todas as situações" }} rotulo="Situação" className="sm:w-48" />
        <Seletor valor={fase} onChange={setFase} opcoes={opcoesDe(todos, (processo) => processo.fase)} todos={{ rotulo: "Todas as fases" }} rotulo="Fase" className="sm:w-44" />
        <Seletor valor={responsavel} onChange={setResponsavel} opcoes={opcoesDe(todos, (processo) => processo.advogadoResponsavel)} todos={{ rotulo: "Todos os responsáveis" }} rotulo="Advogado responsável" className="sm:w-56" />
        <Seletor valor={uf} onChange={setUf} opcoes={opcoesDe(todos, (processo) => processo.uf)} todos={{ rotulo: "Todas as UFs" }} rotulo="UF" className="sm:w-36" />
        <Button variant="outline" onClick={() => void exportar()} disabled={exportando || !filtrados.length}>
          {exportando ? <LoaderCircle className="animate-spin" /> : <Download />} Planilha
        </Button>
      </BarraAba>

      <Painel>
        {!todos.length ? (
          <Vazio icone={FolderSearch} titulo="Nenhum processo no cadastro ainda">
            <p>Traga os processos do VIOS pela tela de importação: a carga usa o SIOE e o relatório de processos.</p>
            <Button asChild className="mt-3">
              <Link href="/operacoes-legais/processos/importacao">
                <Upload /> Abrir a importação
              </Link>
            </Button>
          </Vazio>
        ) : !filtrados.length ? (
          <Vazio icone={SearchX} titulo="Nenhum processo com esses filtros">
            <Button variant="link" className="h-auto p-0" onClick={limpar}>
              Limpar os filtros
            </Button>
          </Vazio>
        ) : (
          <>
            <CabecalhoLista className={`hidden ${COLUNAS}`}>
              <span>Processo</span>
              <span>Partes</span>
              <span>Ação e fase</span>
              <span>Responsável</span>
              <span>Cadastro</span>
            </CabecalhoLista>
            <ul className="divide-y divide-[#e6eef0]">
              {filtrados.slice(0, visiveis).map((processo) => (
                <li key={processo.id}>
                  <Link href={`/operacoes-legais/processos/${processo.id}`} className={`${linhaLista()} block space-y-2 lg:space-y-0 ${COLUNAS}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <LogoGrupo grupo={processo.grupoCliente} tamanho="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tabular-nums text-[#10293a]">{processo.cnj ?? "Sem número CNJ"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          CI {processo.ci ?? "—"}
                          {processo.uf ? ` · ${processo.uf}` : ""}
                          {processo.comarca ? ` · ${processo.comarca}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="truncate text-foreground" title={processo.parteAtiva ?? undefined}>
                        {processo.parteAtiva ?? <span className="text-muted-foreground">Polo ativo não informado</span>}
                      </p>
                      <p className="truncate text-muted-foreground" title={processo.partePassiva ?? undefined}>
                        <span className="text-xs">×</span> {processo.partePassiva ?? "Polo passivo não informado"}
                      </p>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm text-foreground" title={processo.acao ?? undefined}>
                        {processo.acao ?? "—"}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {processo.fase ? <Selo tom="marca">{processo.fase}</Selo> : null}
                        {processo.situacao ? <Selo tom={tomDaSituacao(processo.situacao)}>{processo.situacao}</Selo> : null}
                      </div>
                    </div>
                    <p className="truncate text-sm text-foreground" title={processo.advogadoResponsavel ?? undefined}>
                      {processo.advogadoResponsavel ?? <span className="text-muted-foreground">Sem responsável</span>}
                    </p>
                    <div className="min-w-0 space-y-1">
                      <BarraPreenchimento feitos={processo.feitos} total={processo.total} percentual={processo.percentual} />
                      {processo.pendentesVios ? (
                        <Selo tom="alerta" icone={CloudUpload}>
                          {processo.pendentesVios} a gravar no VIOS
                        </Selo>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {filtrados.length > visiveis ? (
              <div className="border-t border-[#e6eef0] p-3 text-center">
                <Button variant="outline" onClick={() => setPagina({ filtro, linhas: visiveis + PASSO })}>
                  Mostrar mais {Math.min(PASSO, filtrados.length - visiveis)} de {filtrados.length - visiveis}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Painel>
    </div>
  );
}
