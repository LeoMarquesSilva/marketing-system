"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, CheckCheck, CopyCheck, CopyX, FileSearch, Files, LoaderCircle, Undo2, X } from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import type { DuplicidadeItem, DuplicidadeResultado, PublicacaoResumo } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { DadosPublicacao, TeorPublicacao, formatarData, formatarDataHora } from "./publicacao-ui";
import { Aviso, BarraAba, Carregando, Indicador, Indicadores, Painel, Selo, Vazio } from "./ui";

type Situacao = "pendentes" | "revisadas";

interface Grupo {
  chave: string;
  principal: PublicacaoResumo | null;
  dataArquivo: string | null;
  copias: DuplicidadeItem[];
}

/** Agrupa as cópias pela publicação principal: um bloco por despacho. */
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
      <Selo tom="sucesso" icone={Check}>
        Mesmo Id do documento: {comuns.slice(0, 3).join(", ")}
      </Selo>
    );
  }
  if (divergem) return <Selo tom="alerta">Ids de documento diferentes — confira</Selo>;
  return null;
}

function ResultadoRevisao({ item }: { item: DuplicidadeItem }) {
  const confirmada = item.duplicidade.duplicidadeResultado === "confirmada";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      <Selo tom={confirmada ? "alerta" : "sucesso"}>{confirmada ? "Duplicidade confirmada" : "Não era duplicidade"}</Selo>
      <span>
        {item.revisadaPor ? `${item.revisadaPor} · ` : ""}
        {formatarDataHora(item.revisadaEm)}
      </span>
    </span>
  );
}

/** Título curto de cada coluna do comparativo (mesmo tom do `Secao`). */
function TituloColuna({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-normal text-[#285f7a]">{children}</h3>;
}

function plural(n: number, singular: string, varios: string): string {
  return `${n} ${n === 1 ? singular : varios}`;
}

function Duplicidades() {
  const [situacao, setSituacao] = useState<Situacao>("pendentes");
  const [itens, setItens] = useState<DuplicidadeItem[] | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erroGrupo, setErroGrupo] = useState<{ chave: string; texto: string } | null>(null);
  const [feito, setFeito] = useState("");

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

  const resumo = useMemo(() => {
    let mesmoId = 0;
    let idsDiferentes = 0;
    for (const grupo of grupos) {
      const { comuns, divergem } = idsEmComum(grupo);
      if (comuns.length) mesmoId += 1;
      else if (divergem) idsDiferentes += 1;
    }
    const confirmadas = (itens ?? []).filter((item) => item.duplicidade.duplicidadeResultado === "confirmada").length;
    return { mesmoId, idsDiferentes, confirmadas, naoEram: (itens ?? []).length - confirmadas };
  }, [grupos, itens]);

  function trocarSituacao(valor: Situacao) {
    setFeito("");
    setErroGrupo(null);
    setSituacao(valor);
  }

  async function revisar(chave: string, copias: DuplicidadeItem[], resultado: DuplicidadeResultado) {
    setSalvando(chave);
    setErroGrupo(null);
    setFeito("");
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
      setFeito(
        resultado === "confirmada"
          ? `${plural(feitas.length, "cópia confirmada", "cópias confirmadas")} como duplicidade.`
          : `${plural(feitas.length, "cópia marcada", "cópias marcadas")} como não duplicidade; ${feitas.length === 1 ? "ela volta" : "elas voltam"} para a triagem.`
      );
    } catch (e) {
      setErroGrupo({ chave, texto: e instanceof Error ? e.message : "Falha ao salvar." });
    } finally {
      setItens((atuais) => (atuais ?? []).filter((atual) => !feitas.includes(atual.duplicidade.id)));
      setSalvando(null);
    }
  }

  const pendentes = situacao === "pendentes";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BarraAba resumo="Cada bloco é um despacho com as cópias enviadas a cada parte intimada. Confirme todas de uma vez ou devolva uma cópia para a fila.">
          <Segmented
            label="Situação da conferência"
            value={situacao}
            options={(["pendentes", "revisadas"] as Situacao[]).map((valor) => ({
              value: valor,
              label: `${valor === "pendentes" ? "A conferir" : "Conferidas"}${valor === situacao && itens ? ` ${grupos.length}` : ""}`,
            }))}
            onChange={trocarSituacao}
          />
        </BarraAba>

        {feito ? (
          <Aviso
            tom="sucesso"
            acao={
              <Button variant="ghost" size="icon-xs" className="-my-1 text-current" aria-label="Fechar aviso" onClick={() => setFeito("")}>
                <X />
              </Button>
            }
          >
            {feito}
          </Aviso>
        ) : null}
      </div>

      {itens === null ? (
        <Painel>
          <Carregando rotulo="Carregando duplicidades" />
        </Painel>
      ) : erro ? (
        <Aviso
          tom="erro"
          titulo="Não foi possível carregar as duplicidades"
          acao={
            <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => void carregar(situacao)}>
              Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : (
        <>
          {pendentes ? (
            <Indicadores className="sm:grid-cols-3 lg:grid-cols-3">
              <Indicador icone={Files} rotulo="Despachos a conferir" valor={grupos.length} tom={grupos.length ? "alerta" : "neutro"}>
                {plural(itens.length, "cópia marcada como duplicidade", "cópias marcadas como duplicidade")}
              </Indicador>
              <Indicador icone={CopyCheck} rotulo="Mesmo Id do documento" valor={resumo.mesmoId}>
                A cópia repete o documento da principal
              </Indicador>
              <Indicador icone={FileSearch} rotulo="Ids diferentes" valor={resumo.idsDiferentes} tom={resumo.idsDiferentes ? "alerta" : "neutro"}>
                Confira o texto antes de confirmar
              </Indicador>
            </Indicadores>
          ) : (
            <Indicadores className="sm:grid-cols-3 lg:grid-cols-3">
              <Indicador icone={Files} rotulo="Despachos conferidos" valor={grupos.length}>
                {plural(itens.length, "cópia revisada", "cópias revisadas")}
              </Indicador>
              <Indicador icone={CopyCheck} rotulo="Duplicidade confirmada" valor={resumo.confirmadas}>
                Mantidas como cópia da principal
              </Indicador>
              <Indicador icone={Undo2} rotulo="Não era duplicidade" valor={resumo.naoEram}>
                Cópias devolvidas para a triagem
              </Indicador>
            </Indicadores>
          )}

          {grupos.length === 0 ? (
            <Painel>
              <Vazio icone={CopyX} titulo={pendentes ? "Nenhuma duplicidade para conferir." : "Nenhuma duplicidade conferida ainda."} />
            </Painel>
          ) : (
            <ul className="space-y-4">
              {grupos.map((grupo) => {
                const referencia = grupo.principal ?? grupo.copias[0].duplicidade;
                const tituloId = `grupo-${grupo.chave}`;
                return (
                  <li key={grupo.chave}>
                    <Painel aria-labelledby={tituloId}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-3">
                        <h2 id={tituloId} className="tabular-nums text-sm font-semibold text-foreground">
                          {referencia.numeroProcesso ?? referencia.numeroProcessoOriginal}
                        </h2>
                        {referencia.tribunal ? <Selo>{referencia.tribunal}</Selo> : null}
                        <span className="text-xs text-muted-foreground">
                          publicação {formatarData(referencia.dataPublicacao)} · arquivo de {formatarData(grupo.dataArquivo)}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                          <Selo>{grupo.copias.length + 1} envios</Selo>
                          <SeloIds grupo={grupo} />
                        </span>
                      </div>

                      <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-[#e6eef0]">
                        <section aria-label="Publicação principal" className="min-w-0 space-y-3 px-4 py-4">
                          <TituloColuna>
                            Publicação principal
                            {grupo.principal?.linhaArquivo ? (
                              <span className="ml-1 font-normal normal-case text-muted-foreground">· linha {grupo.principal.linhaArquivo}</span>
                            ) : null}
                          </TituloColuna>
                          {grupo.principal ? (
                            <>
                              <DadosPublicacao publicacao={grupo.principal} />
                              <TeorPublicacao publicacao={grupo.principal} />
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">Publicação principal não encontrada.</p>
                          )}
                        </section>

                        <section
                          aria-label="Marcadas como duplicidade"
                          className="min-w-0 border-t border-[#e6eef0] px-4 py-4 lg:border-t-0"
                        >
                          <TituloColuna>
                            Marcadas como duplicidade{" "}
                            <span className="tabular-nums font-normal normal-case text-muted-foreground">{grupo.copias.length}</span>
                          </TituloColuna>
                          <ul className="mt-1 divide-y divide-[#eef3f5]">
                            {grupo.copias.map((item) => (
                              <li key={item.duplicidade.id} className="space-y-2.5 py-3 last:pb-0">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">linha {item.duplicidade.linhaArquivo}</span>
                                  <span>· {item.duplicidade.duplicidadeCriterio === "id_documento" ? "pelo Id do documento" : "pelo texto"}</span>
                                  {!pendentes ? <ResultadoRevisao item={item} /> : null}
                                  {pendentes ? (
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
                              </li>
                            ))}
                          </ul>
                        </section>
                      </div>

                      {pendentes || erroGrupo?.chave === grupo.chave ? (
                        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-[#e6eef0] bg-[#f7fbfc] px-4 py-3">
                          {erroGrupo?.chave === grupo.chave ? (
                            <p role="alert" className="mr-auto text-sm text-red-700">
                              {erroGrupo.texto}
                            </p>
                          ) : null}
                          {pendentes ? (
                            <Button onClick={() => revisar(grupo.chave, grupo.copias, "confirmada")} disabled={salvando !== null}>
                              {salvando === grupo.chave ? <LoaderCircle className="animate-spin" /> : grupo.copias.length > 1 ? <CheckCheck /> : <Check />}
                              {grupo.copias.length > 1 ? `Confirmar todas (${grupo.copias.length})` : "Confirmar duplicidade"}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </Painel>
                  </li>
                );
              })}
            </ul>
          )}
        </>
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
