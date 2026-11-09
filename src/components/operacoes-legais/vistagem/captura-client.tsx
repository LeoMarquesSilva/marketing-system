"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  CalendarClock,
  ChevronRight,
  ClipboardPaste,
  CloudDownload,
  Copy,
  FileSpreadsheet,
  Inbox,
  Landmark,
  Layers,
  LoaderCircle,
  Rows3,
  SearchX,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { ArquivoDoDia } from "@/lib/vistagem/alerta-arquivo";
import { camposDaPublicacao, combinaCampos } from "@/lib/vistagem/busca";
import { descricaoDoTribunal } from "@/lib/vistagem/tribunais";
import type { ArquivoKurierResumo, PublicacaoResumo, SincronizacaoResultado } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { SeloAberturaDePasta } from "./abertura-pasta";
import { FaixaArquivoDoDia, useArquivoDoDia } from "./aviso-arquivo-do-dia";
import { DetalheCaptura, SITUACAO_CAPTURA, SITUACOES_CAPTURA, SeloSituacaoCaptura, detalheDaSituacao, situacaoNaCaptura, type SituacaoCaptura } from "./captura-detalhe";
import { ColarPublicacoes, type ResultadoColagem } from "./colar-publicacoes";
import { IconeArea, IconeTribunal, LogoGrupo } from "./marcas";
import { contarPor, formatarData, formatarDataHora, tribunalDe } from "./publicacao-ui";
import { IconeOpcao, Seletor } from "./seletor";
import { Aviso, BarraAba, Busca, Carregando, Painel, PainelTopo, Selo, Vazio, linhaLista, type TomSelo } from "./ui";

type Filtro = "todas" | SituacaoCaptura;

const ORIGEM: Record<ArquivoKurierResumo["origem"], { rotulo: string; icone: LucideIcon }> = {
  sharepoint: { rotulo: "SharePoint", icone: CloudDownload },
  upload: { rotulo: "envio manual", icone: Upload },
  colado: { rotulo: "colado (e-mail/Teams)", icone: ClipboardPaste },
};

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaDaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()] ?? "";

/** Hoje no calendário de quem está usando (AAAA-MM-DD), para a régua de datas do detalhe. */
function hojeLocal(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

/** Publicações coladas não são o arquivo da Kurier: não contam para "Arquivo de hoje". */
function daKurier(arquivo: ArquivoKurierResumo): boolean {
  return arquivo.origem !== "colado";
}

function resumoColagem(resultado: ResultadoColagem): string {
  if (!resultado.novo) return "Essas publicações já tinham sido coladas; nada foi duplicado.";
  const { arquivo } = resultado;
  const duplicidades = arquivo.totalDuplicidades ? ` ${arquivo.totalDuplicidades} duplicidade(s) para conferir em Duplicidades.` : "";
  const ignorados = resultado.ignorados.length ? ` ${resultado.ignorados.length} trecho(s) do texto não reconhecido(s).` : "";
  return `${arquivo.nomeArquivo}.${resumoTriagem(resultado.triagem)}${duplicidades}${ignorados}`;
}

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
  const deHoje = arquivos.filter((arquivo) => daKurier(arquivo) && arquivo.dataArquivo === situacao.hoje);
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
  const deHoje = (arquivos ?? []).filter((arquivo) => daKurier(arquivo) && arquivo.dataArquivo === situacao.hoje);
  if (situacao.chegou) {
    const importado = deHoje.find((arquivo) => arquivo.status === "processado");
    return {
      valor: "Chegou",
      tom: "sucesso",
      detalhe: importado ? `Recebido ${formatarDataHora(importado.recebidoEm)} · ${ORIGEM[importado.origem].rotulo}` : formatarData(situacao.hoje),
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

/** Número do arquivo em pílula, com ícone: linhas, captadas, duplicidades, descartadas. */
function Pilula({ icone: Icone, valor, singular, plural, tom = "neutro" }: { icone: LucideIcon; valor: number; singular: string; plural: string; tom?: "neutro" | "alerta" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset",
        tom === "alerta" && valor ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-[#f2f6f7] text-muted-foreground ring-[#e6eef0]"
      )}
    >
      <Icone className="size-3 shrink-0" aria-hidden />
      <span className="font-semibold tabular-nums text-foreground">{valor}</span> {valor === 1 ? singular : plural}
    </span>
  );
}

const TOM_HOJE: Record<"neutro" | "alerta" | "perigo" | "sucesso", string> = {
  neutro: "bg-[#f2f6f7] text-[#285f7a] ring-[#dce9eb]",
  alerta: "bg-amber-50 text-amber-800 ring-amber-200",
  perigo: "bg-red-50 text-red-700 ring-red-200",
  sucesso: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

/** O arquivo de hoje chegou? Em destaque no topo, no lugar do card de números. */
function ArquivoDeHoje({ estado }: { estado: { valor: string; tom: keyof typeof TOM_HOJE; detalhe: string } }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg ring-1", TOM_HOJE[estado.tom])} aria-hidden>
        <CalendarClock className="size-5" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[11px] font-semibold uppercase text-[#285f7a]">Arquivo de hoje</p>
        <p className="text-base font-semibold text-foreground">{estado.valor}</p>
        <p className="truncate text-xs text-muted-foreground">{estado.detalhe}</p>
      </div>
    </div>
  );
}

function Captura() {
  const situacaoDoDia = useArquivoDoDia();
  const [arquivos, setArquivos] = useState<ArquivoKurierResumo[] | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [publicacoes, setPublicacoes] = useState<PublicacaoResumo[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState("");
  const [tribunal, setTribunal] = useState("");
  /** Publicação aberta no detalhe (modal). */
  const [aberta, setAberta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<"sincronizar" | "enviar" | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [colando, setColando] = useState(false);
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

  function importouColagem(resultado: ResultadoColagem) {
    setColando(false);
    setAviso({ tipo: resultado.triagem?.erro ? "erro" : "ok", texto: resumoColagem(resultado) });
    void carregarArquivos(resultado.arquivo.id);
  }

  // O que a busca olha em cada publicação (inclui as partes do texto): montado uma vez por carga, não a cada letra.
  const camposDeBusca = useMemo(() => new Map((publicacoes ?? []).map((p) => [p.id, camposDaPublicacao(p)])), [publicacoes]);
  // Área e tribunal: só os que existem no arquivo; escolha que sumiu (outro arquivo) deixa de filtrar.
  const areasDoArquivo = useMemo(() => contarPor(publicacoes ?? [], (p) => p.escritorioResponsavel ?? "Sem área"), [publicacoes]);
  const areaAtiva = areasDoArquivo.some(([nome]) => nome === area) ? area : "";
  const tribunaisDoArquivo = useMemo(() => contarPor(publicacoes ?? [], tribunalDe), [publicacoes]);
  const tribunalAtivo = tribunaisDoArquivo.some(([nome]) => nome === tribunal) ? tribunal : "";

  // Busca, área e tribunal valem antes da situação: as contagens dos botões de situação já respeitam os três.
  const filtradas = useMemo(
    () =>
      (publicacoes ?? []).filter(
        (p) =>
          (!areaAtiva || (p.escritorioResponsavel ?? "Sem área") === areaAtiva) &&
          (!tribunalAtivo || tribunalDe(p) === tribunalAtivo) &&
          combinaCampos(camposDeBusca.get(p.id) ?? [], busca)
      ),
    [publicacoes, areaAtiva, tribunalAtivo, busca, camposDeBusca]
  );
  const contagem = useMemo(() => {
    const total: Record<Filtro, number> = { todas: filtradas.length, juridico: 0, pendente: 0, duplicidade: 0, descartada: 0, captada: 0 };
    for (const p of filtradas) total[situacaoNaCaptura(p.status)] += 1;
    return total;
  }, [filtradas]);
  const visiveis = useMemo(() => (filtro === "todas" ? filtradas : filtradas.filter((p) => situacaoNaCaptura(p.status) === filtro)), [filtradas, filtro]);
  const porId = useMemo(() => new Map((publicacoes ?? []).map((p) => [p.id, p])), [publicacoes]);

  const situacaoHoje = useMemo(() => situacaoAtualizada(situacaoDoDia, arquivos), [situacaoDoDia, arquivos]);
  const hoje = estadoDeHoje(situacaoHoje, arquivos);
  const arquivoAtual = arquivos?.find((arquivo) => arquivo.id === selecionado) ?? null;
  const filtrando = filtro !== "todas" || busca.trim() !== "" || Boolean(areaAtiva) || Boolean(tribunalAtivo);

  // Detalhe: anda pelas publicações da lista (na ordem do arquivo).
  const idsVisiveis = visiveis.map((p) => p.id);
  const indiceAberta = aberta ? idsVisiveis.indexOf(aberta) : -1;
  const publicacaoAberta = aberta ? (porId.get(aberta) ?? null) : null;
  const navegacao =
    indiceAberta >= 0
      ? { posicao: indiceAberta + 1, total: idsVisiveis.length, anterior: idsVisiveis[indiceAberta - 1] ?? null, proxima: idsVisiveis[indiceAberta + 1] ?? null }
      : null;

  function limparFiltros() {
    setFiltro("todas");
    setBusca("");
    setArea("");
    setTribunal("");
  }

  return (
    <div className="space-y-4">
      <FaixaArquivoDoDia situacao={situacaoHoje} naCaptura />
      <ColarPublicacoes aberto={colando} onFechar={() => setColando(false)} onImportado={importouColagem} />

      <div className="space-y-3">
        {/* O que se confere primeiro: o arquivo de hoje chegou? O como funciona fica na dica, sem ocupar a tela. */}
        <BarraAba
          resumo={
            <div data-tour="vg-gestao-hoje"
              title="O arquivo do dia é buscado sozinho no SharePoint entre 7h e 8h (nova tentativa entre 9h e 10h, em dias úteis) e triado com o SIOE. Pendências seguem para a Triagem Manual; duplicidades, para Duplicidades. Publicações que chegam por e-mail ou Teams entram por “Colar publicações”."
            >
              <ArquivoDeHoje estado={hoje} />
            </div>
          }
        >
          <Button data-tour="vg-gestao-colar"
            variant="outline"
            onClick={() => {
              setAviso(null);
              setColando(true);
            }}
            disabled={ocupado !== null}
          >
            <ClipboardPaste />
            Colar publicações
          </Button>
          <Button variant="outline" onClick={() => inputArquivo.current?.click()} disabled={ocupado !== null}>
            {ocupado === "enviar" ? <LoaderCircle className="animate-spin" /> : <Upload />}
            Enviar xlsx
          </Button>
          <Button onClick={sincronizar} disabled={ocupado !== null} data-tour="vg-gestao-buscar">
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

      <div className={cn("grid gap-4", arquivos?.length && "xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:items-start")}>
        <Painel aria-labelledby="arquivos-titulo" data-tour="vg-gestao-arquivos">
          <PainelTopo
            id="arquivos-titulo"
            titulo={
              <>
                Arquivos recebidos
                {arquivos?.length ? <span className="ml-2 font-normal tabular-nums text-muted-foreground">{arquivos.length}</span> : null}
              </>
            }
            descricao="Escolha um dia para ver para onde foi cada publicação"
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
            <ul className="max-h-[22rem] divide-y divide-[#eef3f5] overflow-y-auto xl:max-h-[calc(100dvh-16rem)]">
              {arquivos.map((arquivo) => {
                const ativo = arquivo.id === selecionado;
                const Origem = ORIGEM[arquivo.origem].icone;
                return (
                  <li key={arquivo.id}>
                    <button
                      type="button"
                      className={cn(linhaLista(ativo), "flex items-start gap-3")}
                      aria-current={ativo ? "true" : undefined}
                      onClick={() => setSelecionado(arquivo.id)}
                    >
                      <span
                        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-[#e8f8f8] text-[#285f7a] ring-1 ring-[#47cdd0]/25"
                        title={ORIGEM[arquivo.origem].rotulo}
                        aria-hidden
                      >
                        <Origem className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold tabular-nums text-foreground">{formatarData(arquivo.dataArquivo)}</span>
                          <span className="text-xs text-muted-foreground">{diaDaSemana(arquivo.dataArquivo)}</span>
                          {arquivo.lote > 1 ? <span className="text-xs text-muted-foreground">· lote {arquivo.lote}</span> : null}
                          <span className="ml-auto">
                            <SituacaoArquivo arquivo={arquivo} />
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          Recebido {formatarDataHora(arquivo.recebidoEm)} · {ORIGEM[arquivo.origem].rotulo}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          <Pilula icone={Rows3} valor={arquivo.totalLinhas} singular="linha" plural="linhas" />
                          <Pilula icone={Inbox} valor={arquivo.totalCaptadas} singular="captada" plural="captadas" />
                          <Pilula icone={Copy} valor={arquivo.totalDuplicidades} singular="dupl." plural="dupl." tom="alerta" />
                          <Pilula icone={Ban} valor={arquivo.totalDescartadas} singular="desc." plural="desc." />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>

        {arquivoAtual ? (
          <Painel aria-labelledby="publicacoes-titulo" className="min-w-0" data-tour="vg-gestao-publicacoes">
            {/* Cabeçalho do arquivo: o dia, de onde veio e o que chegou nele (os números do próprio arquivo). */}
            <div className="space-y-3 border-b border-[#e6eef0] px-4 py-3">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <h2 id="publicacoes-titulo" className="flex flex-wrap items-center gap-x-2 text-base font-semibold text-foreground">
                    Publicações de {formatarData(arquivoAtual.dataArquivo)}
                    <span className="text-sm font-normal text-muted-foreground">{diaDaSemana(arquivoAtual.dataArquivo)}</span>
                    {arquivoAtual.lote > 1 ? <span className="text-sm font-normal text-muted-foreground">· lote {arquivoAtual.lote}</span> : null}
                    <SituacaoArquivo arquivo={arquivoAtual} />
                  </h2>
                  <p className="truncate text-xs text-muted-foreground" title={arquivoAtual.nomeArquivo}>
                    {arquivoAtual.nomeArquivo} · recebido {formatarDataHora(arquivoAtual.recebidoEm)} · {ORIGEM[arquivoAtual.origem].rotulo}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
                <span className="font-semibold uppercase text-[#285f7a]">Chegou no arquivo</span>
                <Pilula icone={Rows3} valor={arquivoAtual.totalLinhas} singular="linha" plural="linhas" />
                <Pilula icone={Inbox} valor={arquivoAtual.totalCaptadas} singular="captada" plural="captadas" />
                <Pilula icone={Copy} valor={arquivoAtual.totalDuplicidades} singular="duplicidade" plural="duplicidades" tom="alerta" />
                <Pilula icone={Ban} valor={arquivoAtual.totalDescartadas} singular="descartada" plural="descartadas" />
                {publicacoes ? (
                  <span className="ml-1">
                    · <span className="font-semibold tabular-nums text-foreground">{publicacoes.length}</span> no sistema hoje
                  </span>
                ) : null}
              </div>
            </div>

            {arquivoAtual.status === "erro" ? (
              <div className="px-4 pt-3">
                <Aviso tom="erro" titulo="A importação deste arquivo falhou">
                  {arquivoAtual.erro}
                </Aviso>
              </div>
            ) : null}

            {/* Para onde foi cada publicação: os botões filtram a lista e já contam com a busca, a área e o tribunal. */}
            <div className="space-y-3 border-b border-[#e6eef0] bg-[#fafcfc] px-4 py-3" data-tour="vg-gestao-filtros">
              <div role="radiogroup" aria-label="Filtrar por situação" className="flex flex-wrap gap-1.5">
                {(["todas", ...SITUACOES_CAPTURA] as Filtro[])
                  .filter((valor) => valor !== "captada" || contagem.captada > 0 || filtro === "captada")
                  .map((valor) => {
                    const info = valor === "todas" ? { rotulo: "Todas", icone: Layers } : SITUACAO_CAPTURA[valor];
                    const marcado = filtro === valor;
                    const Icone = info.icone;
                    return (
                      <button
                        key={valor}
                        type="button"
                        role="radio"
                        aria-checked={marcado}
                        onClick={() => setFiltro(valor)}
                        className={cn(
                          "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors duration-150",
                          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30",
                          marcado
                            ? "border-[#347796] bg-[#347796] font-medium text-white"
                            : "border-[#dce9eb] bg-white text-muted-foreground hover:border-[#3e84a8]/40 hover:text-foreground",
                          !marcado && valor !== "todas" && contagem[valor] === 0 && "opacity-60"
                        )}
                      >
                        <Icone className="size-4" aria-hidden />
                        {info.rotulo}
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                            marcado ? "bg-white/20 text-white" : "bg-[#eef4f6] text-[#285f7a]"
                          )}
                        >
                          {contagem[valor]}
                        </span>
                      </button>
                    );
                  })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Busca
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                  placeholder="Processo, CI, grupo, parte ou intimado"
                  aria-label="Buscar publicação"
                  className="sm:w-72"
                />
                <Seletor
                  rotulo="Área"
                  className="sm:w-56"
                  valor={areaAtiva}
                  onChange={setArea}
                  todos={{ rotulo: "Todas as áreas", contagem: publicacoes?.length, icone: <IconeOpcao icone={Layers} /> }}
                  opcoes={areasDoArquivo.map(([nome, quantidade]) => ({
                    valor: nome,
                    rotulo: nome,
                    contagem: quantidade,
                    icone: nome === "Sem área" ? <IconeOpcao icone={Layers} /> : <IconeArea area={nome} />,
                  }))}
                />
                <Seletor
                  rotulo="Tribunal"
                  className="sm:w-52"
                  valor={tribunalAtivo}
                  onChange={setTribunal}
                  todos={{ rotulo: "Todos os tribunais", contagem: publicacoes?.length, icone: <IconeOpcao icone={Landmark} /> }}
                  opcoes={tribunaisDoArquivo.map(([nome, quantidade]) => ({
                    valor: nome,
                    rotulo: nome,
                    descricao: descricaoDoTribunal(nome),
                    contagem: quantidade,
                    icone: <IconeTribunal sigla={nome} />,
                  }))}
                />
                {filtrando ? (
                  <Button variant="link" size="sm" className="h-auto px-1" onClick={limparFiltros}>
                    Limpar filtros
                  </Button>
                ) : null}
              </div>
            </div>

            {publicacoes === null ? (
              <Carregando rotulo="Carregando publicações" />
            ) : publicacoes.length === 0 ? (
              <Vazio icone={FileSpreadsheet} titulo="Nenhuma publicação deste arquivo no sistema" />
            ) : visiveis.length === 0 ? (
              <Vazio icone={SearchX} titulo="Nenhuma publicação com esses filtros">
                <Button variant="link" className="h-auto p-0" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              </Vazio>
            ) : (
              <>
                <p className="border-b border-[#eef3f5] px-4 py-2 text-xs tabular-nums text-muted-foreground" aria-live="polite">
                  {filtrando ? `${visiveis.length} de ${publicacoes.length}` : publicacoes.length} {publicacoes.length === 1 ? "publicação" : "publicações"} · na ordem do arquivo · clique para ver o detalhe
                </p>
                <ul className="divide-y divide-[#eef3f5]">
                  {visiveis.map((publicacao, indice) => {
                    const principal = publicacao.duplicidadeDe ? (porId.get(publicacao.duplicidadeDe) ?? null) : null;
                    const detalhe = detalheDaSituacao(publicacao, principal);
                    return (
                      <li key={publicacao.id} data-tour={indice === 0 ? "vg-gestao-lista" : undefined}>
                        <button
                          type="button"
                          onClick={() => setAberta(publicacao.id)}
                          className={cn(linhaLista(publicacao.id === aberta), "flex items-center gap-3")}
                        >
                          <LogoGrupo grupo={publicacao.grupoCliente} tamanho="sm" />
                          <span className="min-w-0 flex-1 space-y-0.5">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-sm font-semibold tabular-nums text-foreground">
                                {publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}
                              </span>
                              {publicacao.tribunal ? (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={descricaoDoTribunal(publicacao.tribunal) ?? undefined}>
                                  <IconeTribunal sigla={publicacao.tribunal} />
                                  {publicacao.tribunal}
                                </span>
                              ) : null}
                              {publicacao.demandaRisco ? (
                                <Selo tom="perigo" icone={ShieldAlert}>
                                  Risco
                                </Selo>
                              ) : null}
                              <SeloAberturaDePasta publicacao={publicacao} />
                            </span>
                            <span className="block truncate text-sm text-foreground">
                              {publicacao.grupoCliente ?? publicacao.cliente ?? "Sem grupo"}
                              {publicacao.grupoCliente && publicacao.cliente && publicacao.cliente !== publicacao.grupoCliente ? (
                                <span className="text-muted-foreground"> · {publicacao.cliente}</span>
                              ) : null}
                            </span>
                            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                              {publicacao.escritorioResponsavel ? <IconeArea area={publicacao.escritorioResponsavel} /> : null}
                              <span className="truncate">
                                {[publicacao.escritorioResponsavel, publicacao.djenOrgao, publicacao.dataPublicacao ? `publ. ${formatarData(publicacao.dataPublicacao)}` : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                          </span>
                          <span className="hidden max-w-[16rem] shrink-0 flex-col items-end gap-1 text-right sm:flex">
                            <SeloSituacaoCaptura status={publicacao.status} />
                            {detalhe ? <span className="line-clamp-2 text-xs text-muted-foreground">{detalhe}</span> : null}
                          </span>
                          <span className="hidden w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground md:block">
                            {publicacao.linhaArquivo ? `linha ${publicacao.linhaArquivo}` : ""}
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Painel>
        ) : null}
      </div>

      <DetalheCaptura
        publicacao={publicacaoAberta}
        principal={publicacaoAberta?.duplicidadeDe ? (porId.get(publicacaoAberta.duplicidadeDe) ?? null) : null}
        hoje={hojeLocal()}
        navegacao={navegacao}
        onAbrir={setAberta}
        onFechar={() => setAberta(null)}
      />
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
