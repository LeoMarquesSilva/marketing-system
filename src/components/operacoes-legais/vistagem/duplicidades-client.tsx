"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, CopyX, LoaderCircle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { DuplicidadeItem, DuplicidadeResultado, PublicacaoResumo } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { DadosPublicacao, TeorPublicacao, formatarData, formatarDataHora } from "./publicacao-ui";

type Situacao = "pendentes" | "revisadas";

interface Grupo {
  chave: string;
  principal: PublicacaoResumo | null;
  dataArquivo: string | null;
  copias: DuplicidadeItem[];
}

/** Agrupa as cópias pela publicação principal: um cartão por despacho. */
function agrupar(itens: DuplicidadeItem[]): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const item of itens) {
    const chave = item.principal?.id ?? item.duplicidade.duplicidadeDe ?? item.duplicidade.id;
    const grupo = grupos.get(chave) ?? { chave, principal: item.principal, dataArquivo: item.dataArquivo, copias: [] };
    grupo.copias.push(item);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()];
}

/** Id(s) de documento do PJe presentes na principal e em todas as cópias. */
function idsEmComum(grupo: Grupo): { comuns: string[]; divergem: boolean } {
  const principal = grupo.principal?.documentoIds ?? [];
  const copias = grupo.copias.map((item) => item.duplicidade.documentoIds);
  const comuns = principal.filter((id) => copias.every((ids) => ids.includes(id)));
  const divergem = comuns.length === 0 && principal.length > 0 && copias.some((ids) => ids.length > 0);
  return { comuns, divergem };
}

function SeloIds({ grupo }: { grupo: Grupo }) {
  const { comuns, divergem } = idsEmComum(grupo);
  if (comuns.length) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
        <Check className="size-3" />
        Mesmo Id do documento: {comuns.slice(0, 3).join(", ")}
      </span>
    );
  }
  if (divergem) {
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
        Ids de documento diferentes — confira
      </span>
    );
  }
  return null;
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
  const [erroGrupo, setErroGrupo] = useState<{ chave: string; texto: string } | null>(null);

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

  const grupos = useMemo(() => agrupar(itens ?? []), [itens]);

  async function revisar(chave: string, copias: DuplicidadeItem[], resultado: DuplicidadeResultado) {
    setSalvando(chave);
    setErroGrupo(null);
    const feitas: string[] = [];
    try {
      for (const item of copias) {
        const resposta = await authFetch(`/api/operacoes-legais/vistagem/duplicidades/${item.duplicidade.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultado }),
        });
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao salvar.");
        feitas.push(item.duplicidade.id);
      }
    } catch (e) {
      setErroGrupo({ chave, texto: e instanceof Error ? e.message : "Falha ao salvar." });
    } finally {
      setItens((atuais) => (atuais ?? []).filter((atual) => !feitas.includes(atual.duplicidade.id)));
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Conferência de duplicidades</h2>
          <p className="text-sm text-slate-600">
            Cada cartão é um despacho com as cópias enviadas para cada parte intimada. Confirme todas de uma vez ou devolva uma cópia para a fila.
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
              {valor === situacao && itens ? <span className="font-mono text-xs opacity-80">{grupos.length}</span> : null}
            </Button>
          ))}
        </div>
      </section>

      {itens === null ? (
        <div className="flex justify-center p-8"><LoaderCircle className="size-5 animate-spin text-slate-400" aria-label="Carregando" /></div>
      ) : erro ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-[#dce9eb] bg-white p-10 text-center text-sm text-slate-600">
          <CopyX className="size-6 text-slate-400" />
          {situacao === "pendentes" ? "Nenhuma duplicidade para conferir." : "Nenhuma duplicidade conferida ainda."}
        </div>
      ) : (
        <ul className="space-y-4">
          {grupos.map((grupo) => {
            const referencia = grupo.principal ?? grupo.copias[0].duplicidade;
            return (
              <li key={grupo.chave} className="rounded-lg border border-[#dce9eb] bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-b border-[#dce9eb] px-4 py-3">
                  <span className="font-mono text-sm font-medium text-slate-900">
                    {referencia.numeroProcesso ?? referencia.numeroProcessoOriginal}
                  </span>
                  {referencia.tribunal ? (
                    <span className="rounded-full border border-[#3e84a8]/25 px-2 py-0.5 text-xs text-[#315f73]">{referencia.tribunal}</span>
                  ) : null}
                  <span className="text-xs text-slate-500">
                    publicação {formatarData(referencia.dataPublicacao)} · arquivo de {formatarData(grupo.dataArquivo)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {grupo.copias.length + 1} envios
                  </span>
                  <SeloIds grupo={grupo} />
                </div>

                <div className="grid gap-4 p-4 lg:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-slate-500">
                      Publicação principal
                      {grupo.principal?.linhaArquivo ? <span className="ml-1 font-normal normal-case">· linha {grupo.principal.linhaArquivo}</span> : null}
                    </h4>
                    {grupo.principal ? (
                      <>
                        <DadosPublicacao publicacao={grupo.principal} />
                        <TeorPublicacao publicacao={grupo.principal} />
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">Publicação principal não encontrada.</p>
                    )}
                  </div>

                  <div className="min-w-0 space-y-3">
                    <h4 className="text-xs font-semibold uppercase text-slate-500">
                      Marcadas como duplicidade <span className="font-mono normal-case">{grupo.copias.length}</span>
                    </h4>
                    {grupo.copias.map((item) => (
                      <div key={item.duplicidade.id} className="space-y-2 rounded-md border border-[#dce9eb] p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>linha {item.duplicidade.linhaArquivo}</span>
                          <span>
                            · {item.duplicidade.duplicidadeCriterio === "id_documento" ? "pelo Id do documento" : "pelo texto"}
                          </span>
                          {situacao === "revisadas" ? <ResultadoRevisao item={item} /> : null}
                          {situacao === "pendentes" ? (
                            <Button
                              size="xs"
                              variant="outline"
                              className="ml-auto"
                              disabled={salvando !== null}
                              onClick={() => revisar(grupo.chave, [item], "nao_duplicidade")}
                            >
                              <Undo2 />
                              Não é duplicidade
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="outline"
                              className="ml-auto"
                              disabled={salvando !== null}
                              onClick={() =>
                                revisar(
                                  grupo.chave,
                                  [item],
                                  item.duplicidade.duplicidadeResultado === "confirmada" ? "nao_duplicidade" : "confirmada"
                                )
                              }
                            >
                              <Undo2 />
                              {item.duplicidade.duplicidadeResultado === "confirmada" ? "Mudar para: não é duplicidade" : "Mudar para: duplicidade"}
                            </Button>
                          )}
                        </div>
                        <DadosPublicacao publicacao={item.duplicidade} />
                        <TeorPublicacao publicacao={item.duplicidade} />
                      </div>
                    ))}
                  </div>
                </div>

                {situacao === "pendentes" || erroGrupo?.chave === grupo.chave ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#dce9eb] px-4 py-3">
                    {situacao === "pendentes" ? (
                      <Button size="sm" onClick={() => revisar(grupo.chave, grupo.copias, "confirmada")} disabled={salvando !== null}>
                        {salvando === grupo.chave ? <LoaderCircle className="animate-spin" /> : grupo.copias.length > 1 ? <CheckCheck /> : <Check />}
                        {grupo.copias.length > 1 ? `Confirmar todas (${grupo.copias.length})` : "Confirmar duplicidade"}
                      </Button>
                    ) : null}
                    {erroGrupo?.chave === grupo.chave ? <span className="text-sm text-red-700">{erroGrupo.texto}</span> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
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
