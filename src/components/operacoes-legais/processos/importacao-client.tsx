"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CloudUpload, Database, FileSpreadsheet, Gavel, History, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rotuloDoCampo } from "@/lib/processos/campos";
import type { EnvioVios, SituacaoImportacao } from "@/lib/processos/types";
import { Aviso, CabecalhoLista, Carregando, Indicador, Indicadores, Painel, PainelTopo, Selo, Vazio, type TomSelo } from "../vistagem/ui";
import { AcessoProcessos } from "./acesso-processos";
import { formatarDataHora, mensagemDeErro, processosApi } from "./processos-api";

interface ResultadoSync {
  lidos: number;
  noRecorte: number;
  criados: number;
  atualizados: number;
  confirmados: number;
  partesIncluidas: number;
  colunasIgnoradas: string[];
  avisos: string[];
}

const SELO_ENVIO: Record<EnvioVios["status"], { tom: TomSelo; rotulo: string }> = {
  pendente: { tom: "alerta", rotulo: "Na fila" },
  enviado: { tom: "marca", rotulo: "Enviado ao robô" },
  confirmado: { tom: "sucesso", rotulo: "Confirmado" },
  erro: { tom: "perigo", rotulo: "Erro" },
  cancelado: { tom: "neutro", rotulo: "Cancelado" },
};

const COLUNAS_EXECUCAO = "lg:grid lg:grid-cols-[10rem_8rem_minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center lg:gap-4";
const COLUNAS_ENVIO = "lg:grid lg:grid-cols-[7rem_minmax(0,0.8fr)_minmax(0,1.6fr)_9rem_10rem] lg:items-center lg:gap-4";

export function ImportacaoClient() {
  return (
    <AcessoProcessos>
      <Importacao />
    </AcessoProcessos>
  );
}

function lista(valores: string[] | null): string {
  return valores ? valores.join(", ") : "todos";
}

/** De onde os processos vêm, a carga manual (sincronizar agora ou CSV do VIOS) e a fila de gravação no VIOS. */
function Importacao() {
  const [situacao, setSituacao] = useState<SituacaoImportacao | null>(null);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<ResultadoSync | null>(null);
  const [ocupado, setOcupado] = useState<"sync" | "csv" | "">("");
  const arquivoRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      setSituacao(await processosApi.get<SituacaoImportacao>("/importacao"));
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function executar(tipo: "sync" | "csv", arquivo?: File) {
    setOcupado(tipo);
    setErro("");
    setResultado(null);
    try {
      const resposta = arquivo
        ? await processosApi.enviarArquivo<{ resultado: ResultadoSync; situacao: SituacaoImportacao }>("/importacao", arquivo)
        : await processosApi.post<{ resultado: ResultadoSync; situacao: SituacaoImportacao }>("/importacao");
      setResultado(resposta.resultado);
      setSituacao(resposta.situacao);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      void carregar();
    } finally {
      setOcupado("");
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  }

  if (!situacao) {
    return erro ? (
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
    ) : (
      <Carregando rotulo="Carregando a importação" />
    );
  }

  const ultima = situacao.execucoes[0] ?? null;
  const abertos = situacao.envios.filter((envio) => envio.status === "pendente" || envio.status === "enviado" || envio.status === "erro");

  return (
    <div className="space-y-4">
      <Indicadores>
        <Indicador icone={Gavel} rotulo="Processos no cadastro" valor={situacao.totalProcessos}>
          <Link href="/operacoes-legais/processos" className="text-[#347796] underline-offset-4 hover:underline">
            Abrir a lista
          </Link>
        </Indicador>
        <Indicador icone={History} rotulo="Última importação" valor={ultima ? formatarDataHora(ultima.iniciadoEm).slice(0, 10) : "—"} tom={ultima?.status === "erro" ? "perigo" : "neutro"}>
          {ultima ? `${formatarDataHora(ultima.iniciadoEm).slice(11)} · ${ultima.status === "erro" ? "com erro" : `${ultima.criados} novos, ${ultima.atualizados} atualizados`}` : "Nenhuma ainda"}
        </Indicador>
        <Indicador icone={CloudUpload} rotulo="Alterações a gravar no VIOS" valor={abertos.length} tom={abertos.length ? "alerta" : "neutro"}>
          {situacao.gravacaoSimulada ? "gravação simulada" : "gravação real"}
        </Indicador>
        <Indicador icone={Database} rotulo="Recorte da carga" valor={situacao.recorte.grupos ? situacao.recorte.grupos.length : "∞"}>
          <span className="line-clamp-2">
            {lista(situacao.recorte.areas)} · {lista(situacao.recorte.grupos)}
          </span>
        </Indicador>
      </Indicadores>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {resultado ? (
        <Aviso tom={resultado.avisos.length ? "alerta" : "sucesso"} titulo={`Importação concluída: ${resultado.noRecorte} processo${resultado.noRecorte === 1 ? "" : "s"} no recorte`}>
          {resultado.criados} novo{resultado.criados === 1 ? "" : "s"}, {resultado.atualizados} atualizado{resultado.atualizados === 1 ? "" : "s"} pelo VIOS, {resultado.partesIncluidas} parte
          {resultado.partesIncluidas === 1 ? "" : "s"} incluída{resultado.partesIncluidas === 1 ? "" : "s"}
          {resultado.confirmados ? `, ${resultado.confirmados} alteração(ões) confirmada(s) no VIOS` : ""}.
          {resultado.colunasIgnoradas.length ? `\nColunas do arquivo que o importador não conhece: ${resultado.colunasIgnoradas.join(", ")}.` : ""}
          {resultado.avisos.length ? `\n${resultado.avisos.join("\n")}` : ""}
        </Aviso>
      ) : null}

      <Painel>
        <PainelTopo titulo="Trazer os processos do VIOS" descricao="A rotina diária roda às 9h. Aqui você adianta a carga ou envia o relatório exportado na hora." />
        <div className="grid gap-px bg-[#e6eef0] md:grid-cols-2">
          <div className="space-y-3 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#e8f8f8] text-[#3e84a8]">
                <RefreshCw className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Sincronizar agora</p>
                <p className="text-sm text-muted-foreground">Lê o “Processos Lista” do SharePoint da Controladoria e completa com o SIOE (fase, matéria, sistema, etiquetas e encerrados).</p>
              </div>
            </div>
            <Button onClick={() => void executar("sync")} disabled={Boolean(ocupado)}>
              {ocupado === "sync" ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Sincronizar
            </Button>
          </div>
          <div className="space-y-3 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#e8f8f8] text-[#3e84a8]">
                <FileSpreadsheet className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Enviar o CSV do VIOS</p>
                <p className="text-sm text-muted-foreground">Em Processos, no VIOS: Relatório “CSV”, limite 9999999, Pesquisar e baixar. Só entram os processos do recorte.</p>
              </div>
            </div>
            <input
              ref={arquivoRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Arquivo CSV exportado do VIOS"
              onChange={(evento) => {
                const arquivo = evento.target.files?.[0];
                if (arquivo) void executar("csv", arquivo);
              }}
            />
            <Button variant="outline" onClick={() => arquivoRef.current?.click()} disabled={Boolean(ocupado)}>
              {ocupado === "csv" ? <LoaderCircle className="animate-spin" /> : <Upload />} Escolher o arquivo
            </Button>
          </div>
        </div>
      </Painel>

      <Painel>
        <PainelTopo titulo="Últimas importações" />
        {situacao.execucoes.length ? (
          <>
            <CabecalhoLista className={`hidden ${COLUNAS_EXECUCAO}`}>
              <span>Quando</span>
              <span>Origem</span>
              <span>Resultado</span>
              <span>Observação</span>
            </CabecalhoLista>
            <ul className="divide-y divide-[#e6eef0]">
              {situacao.execucoes.map((execucao) => (
                <li key={execucao.id} className={`space-y-1 px-4 py-3 text-sm lg:space-y-0 ${COLUNAS_EXECUCAO}`}>
                  <span className="block tabular-nums text-foreground">{formatarDataHora(execucao.iniciadoEm)}</span>
                  <span className="block">
                    <Selo tom={execucao.origem === "csv" ? "marca" : "neutro"}>{execucao.origem === "csv" ? "CSV enviado" : "Rotina"}</Selo>
                  </span>
                  <span className="block text-foreground">
                    {execucao.status === "erro" ? (
                      <Selo tom="perigo">Erro</Selo>
                    ) : (
                      `${execucao.noRecorte} no recorte · ${execucao.criados} novos · ${execucao.atualizados} atualizados${execucao.confirmados ? ` · ${execucao.confirmados} confirmados` : ""}`
                    )}
                  </span>
                  <span className="block min-w-0 break-words text-xs text-muted-foreground">
                    {[execucao.autor, execucao.arquivo, execucao.erro, execucao.colunasIgnoradas.length ? `colunas ignoradas: ${execucao.colunasIgnoradas.join(", ")}` : null].filter(Boolean).join(" · ") || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Vazio icone={History} titulo="Nenhuma importação ainda" className="py-8">
            Use um dos botões acima para a primeira carga.
          </Vazio>
        )}
      </Painel>

      <Painel>
        <PainelTopo
          titulo="Fila de gravação no VIOS"
          descricao={
            situacao.gravacaoSimulada
              ? "Modo simulado: cada edição de campo do VIOS fica registrada aqui, mas o VIOS ainda não é alterado. A gravação real liga quando o robô souber editar o cadastro."
              : "O robô grava no VIOS as alterações desta fila."
          }
        />
        {situacao.envios.length ? (
          <>
            <CabecalhoLista className={`hidden ${COLUNAS_ENVIO}`}>
              <span>Pasta</span>
              <span>Campo</span>
              <span>De → para</span>
              <span>Situação</span>
              <span>Quem e quando</span>
            </CabecalhoLista>
            <ul className="divide-y divide-[#e6eef0]">
              {situacao.envios.map((envio) => (
                <li key={envio.id} className={`space-y-1 px-4 py-3 text-sm lg:space-y-0 ${COLUNAS_ENVIO}`}>
                  <Link href={`/operacoes-legais/processos/${envio.processoId}`} className="block font-semibold tabular-nums text-[#347796] underline-offset-4 hover:underline">
                    CI {envio.ci ?? "—"}
                  </Link>
                  <span className="block text-foreground">{rotuloDoCampo(envio.campo)}</span>
                  <span className="block min-w-0 break-words text-xs text-muted-foreground">
                    <span className="line-through">{(envio.valorVios || "vazio").slice(0, 160)}</span> → <span className="text-foreground">{(envio.valorNovo || "vazio").slice(0, 160)}</span>
                    {envio.erro ? <span className="block text-red-700">{envio.erro}</span> : null}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    <Selo tom={SELO_ENVIO[envio.status].tom}>{SELO_ENVIO[envio.status].rotulo}</Selo>
                    {envio.simulado && envio.status === "pendente" ? <Selo tom="neutro">Simulado</Selo> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {envio.autor ?? "—"}
                    <span className="block tabular-nums">{formatarDataHora(envio.quando)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Vazio icone={CloudUpload} titulo="Fila vazia" className="py-8">
            Quando alguém editar aqui um campo que existe no VIOS, a alteração aparece nesta lista.
          </Vazio>
        )}
      </Painel>
    </div>
  );
}
