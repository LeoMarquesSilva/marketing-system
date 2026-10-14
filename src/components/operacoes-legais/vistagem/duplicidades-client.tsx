"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CopyX, LoaderCircle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { DuplicidadeItem, DuplicidadeResultado, PublicacaoResumo } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { DadosPublicacao, TeorPublicacao, formatarData, formatarDataHora } from "./publicacao-ui";

type Situacao = "pendentes" | "revisadas";

function Lado({ titulo, publicacao }: { titulo: string; publicacao: PublicacaoResumo | null }) {
  return (
    <div className="min-w-0 space-y-2">
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        {titulo}
        {publicacao?.linhaArquivo ? <span className="ml-1 font-normal normal-case">· linha {publicacao.linhaArquivo}</span> : null}
      </h4>
      {publicacao ? (
        <>
          <DadosPublicacao publicacao={publicacao} />
          <TeorPublicacao publicacao={publicacao} />
        </>
      ) : (
        <p className="text-sm text-slate-500">Publicação principal não encontrada.</p>
      )}
    </div>
  );
}

function ResultadoRevisao({ item }: { item: DuplicidadeItem }) {
  const confirmada = item.duplicidade.duplicidadeResultado === "confirmada";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        confirmada ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      )}
    >
      {confirmada ? "Duplicidade confirmada" : "Não era duplicidade"}
      {item.revisadaPor ? ` · ${item.revisadaPor}` : ""} · {formatarDataHora(item.revisadaEm)}
    </span>
  );
}

function Duplicidades() {
  const [situacao, setSituacao] = useState<Situacao>("pendentes");
  const [itens, setItens] = useState<DuplicidadeItem[] | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erroItem, setErroItem] = useState<{ id: string; texto: string } | null>(null);

  const carregar = useCallback(async (alvo: Situacao) => {
    setItens(null);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/duplicidades?situacao=${alvo}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar as duplicidades.");
      setItens(corpo.duplicidades);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as duplicidades.");
      setItens([]);
    }
  }, []);

  useEffect(() => {
    void carregar(situacao);
  }, [carregar, situacao]);

  async function revisar(item: DuplicidadeItem, resultado: DuplicidadeResultado) {
    const id = item.duplicidade.id;
    setSalvando(id);
    setErroItem(null);
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/duplicidades/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultado }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao salvar.");
      setItens((atuais) => (atuais ?? []).filter((atual) => atual.duplicidade.id !== id));
    } catch (e) {
      setErroItem({ id, texto: e instanceof Error ? e.message : "Falha ao salvar." });
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Conferência de duplicidades</h2>
          <p className="text-sm text-slate-600">
            Mesmo despacho enviado mais de uma vez (uma cópia por parte intimada). Confirme ou devolva para a fila de vistagem.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-[#dce9eb] bg-white p-1" role="group" aria-label="Situação da conferência">
          {(["pendentes", "revisadas"] as Situacao[]).map((valor) => (
            <Button
              key={valor}
              variant="ghost"
              size="sm"
              aria-pressed={situacao === valor}
              className={cn(situacao === valor && "bg-[#183f50] text-white hover:bg-[#183f50] hover:text-white")}
              onClick={() => setSituacao(valor)}
            >
              {valor === "pendentes" ? "A conferir" : "Conferidas"}
              {valor === situacao && itens ? <span className="font-mono text-xs opacity-80">{itens.length}</span> : null}
            </Button>
          ))}
        </div>
      </section>

      {itens === null ? (
        <div className="flex justify-center p-8"><LoaderCircle className="size-5 animate-spin text-slate-400" aria-label="Carregando" /></div>
      ) : erro ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-[#dce9eb] bg-white p-10 text-center text-sm text-slate-600">
          <CopyX className="size-6 text-slate-400" />
          {situacao === "pendentes" ? "Nenhuma duplicidade para conferir." : "Nenhuma duplicidade conferida ainda."}
        </div>
      ) : (
        <ul className="space-y-4">
          {itens.map((item) => (
            <li key={item.duplicidade.id} className="rounded-lg border border-[#dce9eb] bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#dce9eb] px-4 py-3">
                <span className="font-mono text-sm font-medium text-slate-900">
                  {item.duplicidade.numeroProcesso ?? item.duplicidade.numeroProcessoOriginal}
                </span>
                {item.duplicidade.tribunal ? (
                  <span className="rounded-full border border-[#3e84a8]/25 px-2 py-0.5 text-xs text-[#315f73]">{item.duplicidade.tribunal}</span>
                ) : null}
                <span className="text-xs text-slate-500">
                  publicação {formatarData(item.duplicidade.dataPublicacao)} · arquivo de {formatarData(item.dataArquivo)}
                </span>
                {situacao === "revisadas" ? <span className="sm:ml-auto"><ResultadoRevisao item={item} /></span> : null}
              </div>
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                <Lado titulo="Publicação principal" publicacao={item.principal} />
                <Lado titulo="Marcada como duplicidade" publicacao={item.duplicidade} />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[#dce9eb] px-4 py-3">
                {situacao === "pendentes" ? (
                  <>
                    <Button size="sm" onClick={() => revisar(item, "confirmada")} disabled={salvando !== null}>
                      {salvando === item.duplicidade.id ? <LoaderCircle className="animate-spin" /> : <Check />}
                      Confirmar duplicidade
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => revisar(item, "nao_duplicidade")} disabled={salvando !== null}>
                      <Undo2 />
                      Não é duplicidade
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={salvando !== null}
                    onClick={() =>
                      revisar(item, item.duplicidade.duplicidadeResultado === "confirmada" ? "nao_duplicidade" : "confirmada")
                    }
                  >
                    <Undo2 />
                    {item.duplicidade.duplicidadeResultado === "confirmada" ? "Mudar para: não é duplicidade" : "Mudar para: duplicidade"}
                  </Button>
                )}
                {erroItem?.id === item.duplicidade.id ? <span className="text-sm text-red-700">{erroItem.texto}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DuplicidadesClient() {
  return (
    <AcessoOperacoesLegais>
      <Duplicidades />
    </AcessoOperacoesLegais>
  );
}
