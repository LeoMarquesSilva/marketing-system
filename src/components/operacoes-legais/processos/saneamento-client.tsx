"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleDashed, FolderSearch, ListChecks, RefreshCw, SearchX, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ITENS_SANEAMENTO } from "@/lib/processos/preenchimento";
import type { ProcessoResumo } from "@/lib/processos/types";
import { LogoGrupo } from "../vistagem/marcas";
import { SeletorBusca, type OpcaoSeletor } from "../vistagem/seletor";
import { Aviso, BarraAba, Busca, CabecalhoLista, Carregando, Indicador, Indicadores, Painel, Selo, Vazio, linhaLista } from "../vistagem/ui";
import { AcessoProcessos } from "./acesso-processos";
import { BarraPreenchimento } from "./preenchimento-ui";
import { mensagemDeErro, processosApi } from "./processos-api";

const COLUNAS = "lg:grid lg:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.6fr)] lg:items-center lg:gap-4";
const PASSO = 100;

export function SaneamentoClient() {
  return (
    <AcessoProcessos>
      <Saneamento />
    </AcessoProcessos>
  );
}

/** O que falta em cada processo para fechar a lista de campos da equipe, do menos preenchido para o mais. */
function Saneamento() {
  const [processos, setProcessos] = useState<ProcessoResumo[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const [item, setItem] = useState("");
  // "Mostrar mais" vale só para o filtro em que foi clicado: mudou o filtro, a lista volta ao começo.
  const [pagina, setPagina] = useState({ filtro: "", linhas: PASSO });

  // Cada "Tentar de novo" soma um e refaz a busca.
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    processosApi.get<{ processos: ProcessoResumo[] }>().then(
      (resposta) => {
        if (!ativo) return;
        setProcessos(resposta.processos);
        setErro("");
      },
      (falha: unknown) => {
        if (ativo) setErro(mensagemDeErro(falha));
      }
    );
    return () => {
      ativo = false;
    };
  }, [tentativa]);

  const todos = useMemo(() => processos ?? [], [processos]);

  /** Quantos processos ainda não têm cada item: é por onde a equipe decide o que atacar primeiro. */
  const faltas = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const processo of todos) for (const rotulo of processo.faltando) contagem.set(rotulo, (contagem.get(rotulo) ?? 0) + 1);
    return contagem;
  }, [todos]);

  const opcoesItem: OpcaoSeletor[] = ITENS_SANEAMENTO.filter((opcao) => faltas.has(opcao.rotulo)).map((opcao) => ({ valor: opcao.rotulo, rotulo: opcao.rotulo, contagem: faltas.get(opcao.rotulo) }));
  const opcoesGrupo: OpcaoSeletor[] = [...new Set(todos.map((processo) => processo.grupoCliente).filter((valor): valor is string => Boolean(valor)))].sort((a, b) => a.localeCompare(b, "pt-BR")).map((valor) => ({ valor, rotulo: valor }));

  const filtrados = useMemo(() => {
    const digitos = busca.replace(/\D/g, "");
    const termo = busca.trim().toLowerCase();
    return todos
      .filter((processo) => {
        if (grupo && processo.grupoCliente !== grupo) return false;
        if (item && !processo.faltando.includes(item)) return false;
        if (!termo) return true;
        if (digitos.length >= 4 && ((processo.cnj ?? "").replace(/\D/g, "").includes(digitos) || (processo.ci ?? "").includes(digitos))) return true;
        return [processo.parteAtiva, processo.partePassiva].some((campo) => campo?.toLowerCase().includes(termo));
      })
      .sort((a, b) => a.percentual - b.percentual || (b.ci ?? "").localeCompare(a.ci ?? ""));
  }, [todos, busca, grupo, item]);

  const filtro = [busca, grupo, item].join("\u0001");
  const visiveis = pagina.filtro === filtro ? pagina.linhas : PASSO;

  if (!processos && !erro) return <Carregando rotulo="Calculando o saneamento" />;

  const media = todos.length ? Math.round(todos.reduce((soma, processo) => soma + processo.percentual, 0) / todos.length) : 0;
  const completos = todos.filter((processo) => processo.percentual >= 100).length;
  const maisFalta = [...faltas.entries()].sort((a, b) => b[1] - a[1])[0];
  const totalFaltas = todos.reduce((soma, processo) => soma + processo.faltando.length, 0);

  return (
    <div className="space-y-4">
      <Indicadores>
        <Indicador icone={ListChecks} rotulo="Preenchimento médio" valor={`${media}%`} tom={media >= 80 ? "sucesso" : media < 50 ? "alerta" : "neutro"}>
          em {todos.length} processo{todos.length === 1 ? "" : "s"}
        </Indicador>
        <Indicador icone={CircleCheck} rotulo="Cadastros completos" valor={completos} tom={completos ? "sucesso" : "neutro"}>
          de {todos.length}
        </Indicador>
        <Indicador icone={CircleDashed} rotulo="Informações a preencher" valor={totalFaltas} tom={totalFaltas ? "alerta" : "sucesso"}>
          somando todos os processos
        </Indicador>
        <Indicador icone={Target} rotulo="Item que mais falta" valor={maisFalta ? maisFalta[1] : 0}>
          <span className="line-clamp-2">{maisFalta ? maisFalta[0] : "Nada pendente"}</span>
        </Indicador>
      </Indicadores>

      {erro ? (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => setTentativa((atual) => atual + 1)}>
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
            {item ? " sem este item" : ""}
          </span>
        }
      >
        <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="CNJ, CI ou parte" aria-label="Buscar processo" />
        <SeletorBusca valor={grupo} onChange={setGrupo} opcoes={opcoesGrupo} todos={{ rotulo: "Todos os grupos" }} rotulo="Grupo do cliente" className="sm:w-52" />
        <SeletorBusca valor={item} onChange={setItem} opcoes={opcoesItem} todos={{ rotulo: "Qualquer item faltando" }} rotulo="Item que falta" buscaPlaceholder="Buscar item…" className="sm:w-80" />
      </BarraAba>

      <Painel>
        {!todos.length ? (
          <Vazio icone={FolderSearch} titulo="Nenhum processo no cadastro ainda">
            <Button asChild variant="link" className="h-auto p-0">
              <Link href="/operacoes-legais/processos/importacao">Trazer os processos do VIOS</Link>
            </Button>
          </Vazio>
        ) : !filtrados.length ? (
          <Vazio icone={SearchX} titulo="Nenhum processo com esses filtros" />
        ) : (
          <>
            <CabecalhoLista className={`hidden ${COLUNAS}`}>
              <span>Processo</span>
              <span>Preenchido</span>
              <span>O que falta</span>
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
                          CI {processo.ci ?? "—"} · {processo.partePassiva ?? processo.parteAtiva ?? "partes não informadas"}
                        </p>
                      </div>
                    </div>
                    <BarraPreenchimento feitos={processo.feitos} total={processo.total} percentual={processo.percentual} />
                    <div className="flex min-w-0 flex-wrap gap-1">
                      {processo.faltando.length ? (
                        <>
                          {processo.faltando.slice(0, 4).map((rotulo) => (
                            <Selo key={rotulo} tom={rotulo === item ? "alerta" : "neutro"}>
                              {rotulo}
                            </Selo>
                          ))}
                          {processo.faltando.length > 4 ? <Selo tom="neutro">+{processo.faltando.length - 4}</Selo> : null}
                        </>
                      ) : (
                        <Selo tom="sucesso" icone={CircleCheck}>
                          Completo
                        </Selo>
                      )}
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
