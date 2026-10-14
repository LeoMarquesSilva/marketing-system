"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, LoaderCircle, RefreshCw, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { ESCRITORIOS, type PastaSioe } from "@/lib/vistagem/triagem";
import type { PendenciasControladoria, PublicacaoResumo, ResolucaoPendencia, TriagemResumo } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { DadosPasta, DadosPublicacao, PENDENCIAS, TeorPublicacao, formatarData } from "./publicacao-ui";

function LinhaPasta({ pasta, acao }: { pasta: PastaSioe; acao?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#dce9eb] p-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p>
          <span className="font-mono font-medium text-slate-900">CI {pasta.ci}</span>
          {pasta.vinculo ? <span className="ml-2">{pasta.vinculo}</span> : null}
          {pasta.situacao ? <span className="ml-2 text-slate-500">· {pasta.situacao}</span> : null}
        </p>
        <p>
          <span className="font-medium text-slate-800">{pasta.grupoCliente || "sem grupo"}</span>
          {pasta.cliente ? ` · ${pasta.cliente}` : ""}
        </p>
        <p>
          {pasta.area || "sem área"}
          {pasta.advogadoResponsavel ? ` · Resp.: ${pasta.advogadoResponsavel}` : ""}
        </p>
      </div>
      {acao}
    </div>
  );
}

function Resolucao({ publicacao, onResolvida }: { publicacao: PublicacaoResumo; onResolvida: (id: string) => void }) {
  const [ci, setCi] = useState("");
  const [previa, setPrevia] = useState<{ pasta: PastaSioe; escritorioSugerido: string | null } | null>(null);
  const [escritorio, setEscritorio] = useState("");
  const [grupo, setGrupo] = useState(publicacao.grupoCliente ?? "");
  const [demandaRisco, setDemandaRisco] = useState(Boolean(publicacao.demandaRisco));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(entrada: ResolucaoPendencia) {
    setOcupado(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/pendencias/${publicacao.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entrada),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao resolver.");
      onResolvida(publicacao.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao resolver.");
    } finally {
      setOcupado(false);
    }
  }

  async function buscarCi() {
    setOcupado(true);
    setErro("");
    setPrevia(null);
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/sioe/pasta?ci=${encodeURIComponent(ci)}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "CI não encontrada.");
      setPrevia(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "CI não encontrada.");
    } finally {
      setOcupado(false);
    }
  }

  const candidatas = publicacao.pastasCandidatas;

  return (
    <div className="space-y-3 border-t border-[#dce9eb] px-4 py-3">
      {candidatas.length > 1 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-slate-500">Escolha a pasta</p>
          {candidatas.map((pasta) => (
            <LinhaPasta
              key={pasta.ci}
              pasta={pasta}
              acao={
                <Button size="sm" onClick={() => enviar({ ci: pasta.ci })} disabled={ocupado}>
                  <Check />
                  Usar esta pasta
                </Button>
              }
            />
          ))}
        </div>
      ) : null}

      {!publicacao.pastaCi && candidatas.length <= 1 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-slate-500">Pasta no VIOS</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={ci}
              onChange={(evento) => setCi(evento.target.value)}
              placeholder="CI da pasta (se existir)"
              inputMode="numeric"
              className="sm:w-56"
              aria-label="CI da pasta"
              onKeyDown={(evento) => {
                if (evento.key === "Enter" && ci.trim()) void buscarCi();
              }}
            />
            <Button variant="outline" onClick={buscarCi} disabled={ocupado || !ci.trim()}>
              <Search />
              Buscar no SIOE
            </Button>
          </div>
          {previa ? (
            <LinhaPasta
              pasta={previa.pasta}
              acao={
                <Button size="sm" onClick={() => enviar({ ci: previa.pasta.ci })} disabled={ocupado}>
                  <Check />
                  Usar · {previa.escritorioSugerido ?? "definir escritório"}
                </Button>
              }
            />
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-slate-500">
          {publicacao.pastaCi || candidatas.length > 1 ? "Ou informe os dados" : "Sem pasta: informe os dados"}
        </p>
        <div className="grid gap-2 sm:grid-cols-[minmax(160px,220px)_minmax(160px,1fr)_auto_auto] sm:items-center">
          <select
            value={escritorio}
            onChange={(evento) => setEscritorio(evento.target.value)}
            className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            aria-label="Escritório responsável"
          >
            <option value="">Escritório responsável</option>
            {ESCRITORIOS.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
          <Input value={grupo} onChange={(evento) => setGrupo(evento.target.value)} placeholder="Grupo do cliente" aria-label="Grupo do cliente" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={demandaRisco} onChange={(evento) => setDemandaRisco(evento.target.checked)} className="size-4" />
            Demanda de risco
          </label>
          <Button
            onClick={() => enviar({ escritorio, grupo, demandaRisco, ci: publicacao.pastaCi ?? undefined })}
            disabled={ocupado || !escritorio || !grupo.trim()}
          >
            {ocupado ? <LoaderCircle className="animate-spin" /> : <Send />}
            Liberar para o jurídico
          </Button>
        </div>
      </div>
      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
    </div>
  );
}

function CabecalhoPublicacao({ publicacao }: { publicacao: PublicacaoResumo }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
      <span className="font-mono text-sm font-medium text-slate-900">{publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}</span>
      {publicacao.tribunal ? (
        <span className="rounded-full border border-[#3e84a8]/25 px-2 py-0.5 text-xs text-[#315f73]">{publicacao.tribunal}</span>
      ) : null}
      <span className="text-xs text-slate-500">publicação {formatarData(publicacao.dataPublicacao)}</span>
      {publicacao.pendencia ? (
        <span className="ml-auto rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800">
          {PENDENCIAS[publicacao.pendencia]}
        </span>
      ) : null}
    </div>
  );
}

function Controladoria() {
  const [dados, setDados] = useState<PendenciasControladoria | null>(null);
  const [erro, setErro] = useState("");
  const [triando, setTriando] = useState(false);
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/controladoria");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar as pendências.");
      setDados(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as pendências.");
      setDados({ pendentes: [], exClientes: [] });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function rodarTriagem() {
    setTriando(true);
    setAviso("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/triagem", { method: "POST" });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha na triagem.");
      const resumo = corpo as TriagemResumo;
      setAviso(
        resumo.triadas
          ? `${resumo.triadas} publicação(ões) triada(s): ${resumo.juridico} para o jurídico, ${resumo.pendentes} ainda pendente(s).`
          : "Nada novo para triar."
      );
      await carregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Falha na triagem.");
    } finally {
      setTriando(false);
    }
  }

  function removerResolvida(id: string) {
    setDados((atual) => (atual ? { ...atual, pendentes: atual.pendentes.filter((p) => p.id !== id) } : atual));
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Esteira da controladoria</h2>
          <p className="text-sm text-slate-600">
            Publicações que a triagem com o SIOE não conseguiu mandar sozinha para uma área, e as de ex-clientes, que a controladoria vista.
          </p>
        </div>
        <Button variant="outline" onClick={rodarTriagem} disabled={triando}>
          {triando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
          Rodar triagem agora
        </Button>
      </section>

      {aviso ? <p role="status" className="rounded-md border border-[#dce9eb] bg-white px-3 py-2 text-sm text-slate-700">{aviso}</p> : null}

      {dados === null ? (
        <div className="flex justify-center p-8"><LoaderCircle className="size-5 animate-spin text-slate-400" aria-label="Carregando" /></div>
      ) : erro ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      ) : (
        <>
          <section aria-labelledby="pendentes-titulo" className="space-y-3">
            <h2 id="pendentes-titulo" className="text-sm font-semibold text-slate-900">
              Para resolver <span className="font-mono text-xs text-slate-500">{dados.pendentes.length}</span>
            </h2>
            {dados.pendentes.length === 0 ? (
              <p className="rounded-lg border border-[#dce9eb] bg-white p-6 text-center text-sm text-slate-600">Nenhuma pendência de triagem.</p>
            ) : (
              <ul className="space-y-4">
                {dados.pendentes.map((publicacao) => (
                  <li key={publicacao.id} className="rounded-lg border border-[#dce9eb] bg-white shadow-sm">
                    <CabecalhoPublicacao publicacao={publicacao} />
                    <div className="space-y-2 px-4 py-3">
                      <DadosPasta publicacao={{ ...publicacao, pendencia: null }} />
                      <DadosPublicacao publicacao={publicacao} />
                      <TeorPublicacao publicacao={publicacao} />
                    </div>
                    <Resolucao publicacao={publicacao} onResolvida={removerResolvida} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="ex-clientes-titulo" className="space-y-3">
            <h2 id="ex-clientes-titulo" className="text-sm font-semibold text-slate-900">
              Ex-clientes — vistagem da controladoria <span className="font-mono text-xs text-slate-500">{dados.exClientes.length}</span>
            </h2>
            {dados.exClientes.length === 0 ? (
              <p className="rounded-lg border border-[#dce9eb] bg-white p-6 text-center text-sm text-slate-600">Nenhuma publicação de ex-cliente.</p>
            ) : (
              <ul className="divide-y divide-[#dce9eb] rounded-lg border border-[#dce9eb] bg-white shadow-sm">
                {dados.exClientes.map((publicacao) => (
                  <li key={publicacao.id} className={cn("space-y-2 px-4 py-3")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium text-slate-900">
                        {publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}
                      </span>
                      {publicacao.tribunal ? (
                        <span className="rounded-full border border-[#3e84a8]/25 px-2 py-0.5 text-xs text-[#315f73]">{publicacao.tribunal}</span>
                      ) : null}
                      <span className="text-xs text-slate-500">publicação {formatarData(publicacao.dataPublicacao)}</span>
                    </div>
                    <DadosPasta publicacao={{ ...publicacao, pendencia: null }} />
                    <DadosPublicacao publicacao={publicacao} />
                    <TeorPublicacao publicacao={publicacao} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export function ControladoriaClient() {
  return (
    <AcessoOperacoesLegais>
      <Controladoria />
    </AcessoOperacoesLegais>
  );
}
