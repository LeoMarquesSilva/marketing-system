"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudDownload, FileSpreadsheet, LoaderCircle, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { ArquivoKurierResumo, PublicacaoResumo, SincronizacaoResultado } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { DadosPasta, DadosPublicacao, StatusPublicacao, TeorPublicacao, formatarData, formatarDataHora } from "./publicacao-ui";

type Filtro = "todas" | "juridico_vistar" | "triagem_pendente" | "duplicidade" | "descartada" | "captada";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "juridico_vistar", rotulo: "Jurídico vistar" },
  { valor: "triagem_pendente", rotulo: "Pendências" },
  { valor: "duplicidade", rotulo: "Duplicidades" },
  { valor: "descartada", rotulo: "Descartadas" },
  { valor: "captada", rotulo: "Aguardando triagem" },
];

function resumoTriagem(triagem: SincronizacaoResultado["triagem"]): string {
  if (!triagem) return "";
  if (triagem.erro) return ` Triagem com o SIOE falhou: ${triagem.erro}`;
  if (!triagem.triadas) return "";
  return ` Triagem: ${triagem.juridico} para o jurídico, ${triagem.pendentes} pendente(s) na controladoria.`;
}

function SituacaoArquivo({ arquivo }: { arquivo: ArquivoKurierResumo }) {
  const estilo = {
    processado: "border-emerald-200 bg-emerald-50 text-emerald-800",
    processando: "border-amber-200 bg-amber-50 text-amber-800",
    erro: "border-red-200 bg-red-50 text-red-700",
  }[arquivo.status];
  const rotulo = { processado: "Importado", processando: "Importando", erro: "Erro" }[arquivo.status];
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", estilo)} title={arquivo.erro ?? undefined}>
      {rotulo}
    </span>
  );
}

function resumoSincronizacao(resultado: SincronizacaoResultado): string {
  const erros = resultado.resultados.filter((item) => item.situacao === "erro");
  if (erros.length) return `${erros.length} arquivo(s) com erro: ${erros.map((item) => `${item.nome} (${item.mensagem})`).join("; ")}`;
  const triagem = resumoTriagem(resultado.triagem);
  if (resultado.importados) return `${resultado.importados} arquivo(s) novo(s) importado(s).${triagem}`;
  if (resultado.verificados === 0) return `O arquivo de hoje ainda não chegou na pasta da Kurier.${triagem}`;
  return `O arquivo de hoje já estava importado.${triagem}`;
}

function Captura() {
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

  const arquivoAtual = arquivos?.find((arquivo) => arquivo.id === selecionado) ?? null;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Publicações da Kurier</h2>
          <p className="text-sm text-slate-600">
            O arquivo do dia é buscado sozinho na pasta do SharePoint entre 7h e 8h, com nova tentativa entre 9h e 10h (dias úteis), e triado com a base de processos do SIOE. Pendências vão para a aba Controladoria; duplicidades, para a aba Duplicidades.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={sincronizar} disabled={ocupado !== null}>
            {ocupado === "sincronizar" ? <LoaderCircle className="animate-spin" /> : <CloudDownload />}
            Buscar no SharePoint
          </Button>
          <Button variant="outline" onClick={() => inputArquivo.current?.click()} disabled={ocupado !== null}>
            {ocupado === "enviar" ? <LoaderCircle className="animate-spin" /> : <Upload />}
            Enviar xlsx
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
        </div>
      </section>

      {aviso ? (
        <p
          role="status"
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            aviso.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          {aviso.texto}
        </p>
      ) : null}

      <section aria-labelledby="arquivos-titulo" className="rounded-lg border border-[#dce9eb] bg-white shadow-sm">
        <h2 id="arquivos-titulo" className="border-b border-[#dce9eb] px-4 py-3 text-sm font-semibold text-slate-900">
          Arquivos recebidos
        </h2>
        {arquivos === null ? (
          <div className="flex justify-center p-6"><LoaderCircle className="size-5 animate-spin text-slate-400" aria-label="Carregando" /></div>
        ) : erroLista ? (
          <p className="p-4 text-sm text-red-700">{erroLista}</p>
        ) : arquivos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-slate-600">
            <FileSpreadsheet className="size-6 text-slate-400" />
            Nenhum arquivo importado ainda. Use “Buscar no SharePoint” ou envie o xlsx do dia.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Dia</th>
                  <th className="px-2 py-2 font-medium">Recebido</th>
                  <th className="px-2 py-2 text-right font-medium">Linhas</th>
                  <th className="px-2 py-2 text-right font-medium">Captadas</th>
                  <th className="px-2 py-2 text-right font-medium">Duplicidades</th>
                  <th className="px-2 py-2 text-right font-medium">Descartadas</th>
                  <th className="px-4 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dce9eb]">
                {arquivos.map((arquivo) => (
                  <tr
                    key={arquivo.id}
                    className={cn("cursor-pointer hover:bg-[#47cdd0]/5", arquivo.id === selecionado && "bg-[#47cdd0]/10")}
                    onClick={() => setSelecionado(arquivo.id)}
                  >
                    <td className="px-4 py-2">
                      <button type="button" className="text-left font-medium text-slate-900" aria-current={arquivo.id === selecionado ? "true" : undefined}>
                        {formatarData(arquivo.dataArquivo)}
                        {arquivo.lote > 1 ? <span className="ml-1 text-xs text-slate-500">lote {arquivo.lote}</span> : null}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-slate-600">
                      {formatarDataHora(arquivo.recebidoEm)} · {arquivo.origem === "sharepoint" ? "SharePoint" : "envio manual"}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{arquivo.totalLinhas}</td>
                    <td className="px-2 py-2 text-right font-mono">{arquivo.totalCaptadas}</td>
                    <td className="px-2 py-2 text-right font-mono">{arquivo.totalDuplicidades}</td>
                    <td className="px-2 py-2 text-right font-mono">{arquivo.totalDescartadas}</td>
                    <td className="px-4 py-2"><SituacaoArquivo arquivo={arquivo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {arquivoAtual ? (
        <section aria-labelledby="publicacoes-titulo" className="rounded-lg border border-[#dce9eb] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#dce9eb] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 id="publicacoes-titulo" className="text-sm font-semibold text-slate-900">
              Publicações de {formatarData(arquivoAtual.dataArquivo)}
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="inline-flex flex-wrap rounded-lg border border-[#dce9eb] bg-white p-1" role="group" aria-label="Filtrar por situação">
                {FILTROS.filter((item) => item.valor !== "captada" || contagem.captada > 0).map((item) => (
                  <Button
                    key={item.valor}
                    variant="ghost"
                    size="sm"
                    aria-pressed={filtro === item.valor}
                    className={cn(filtro === item.valor && "bg-[#183f50] text-white hover:bg-[#183f50] hover:text-white")}
                    onClick={() => setFiltro(item.valor)}
                  >
                    {item.rotulo} <span className="font-mono text-xs opacity-80">{contagem[item.valor]}</span>
                  </Button>
                ))}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                  placeholder="Processo, CI, grupo, escritório ou intimado"
                  className="pl-9 sm:w-64"
                  aria-label="Buscar publicação"
                />
              </div>
            </div>
          </div>

          {porEscritorio.length ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-[#dce9eb] px-4 py-2 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Para o jurídico:</span>
              {porEscritorio.map(([escritorio, total]) => (
                <span key={escritorio} className="rounded-full border border-[#3e84a8]/25 px-2 py-0.5">
                  {escritorio} <span className="font-mono">{total}</span>
                </span>
              ))}
            </div>
          ) : null}

          {arquivoAtual.status === "erro" ? (
            <p className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{arquivoAtual.erro}</p>
          ) : null}

          {publicacoes === null ? (
            <div className="flex justify-center p-6"><LoaderCircle className="size-5 animate-spin text-slate-400" aria-label="Carregando" /></div>
          ) : visiveis.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-600">Nenhuma publicação com esse filtro.</p>
          ) : (
            <ul className="divide-y divide-[#dce9eb]">
              {visiveis.map((publicacao) => (
                <li key={publicacao.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium text-slate-900">
                      {publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}
                    </span>
                    {publicacao.tribunal ? (
                      <span className="rounded-full border border-[#3e84a8]/25 px-2 py-0.5 text-xs text-[#315f73]">{publicacao.tribunal}</span>
                    ) : null}
                    <StatusPublicacao status={publicacao.status} />
                    <span className="ml-auto text-xs text-slate-500">linha {publicacao.linhaArquivo}</span>
                  </div>
                  <DadosPasta publicacao={publicacao} />
                  <DadosPublicacao publicacao={publicacao} />
                  <TeorPublicacao key={publicacao.id} publicacao={publicacao} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
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
