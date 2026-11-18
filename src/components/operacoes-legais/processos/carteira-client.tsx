"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Banknote, FileSpreadsheet, FolderSearch, LoaderCircle, Percent, Receipt, RefreshCw, Scale, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ROTULO_ROBO_AGORA,
  ROTULO_SITUACAO_CITACAO,
  SITUACOES_DA_ATUALIZACAO,
  SITUACOES_PEDIDO,
  diaEmBrasilia,
  formatarData,
  formatarMomento,
  formatarReal,
  situacaoDaAtualizacao,
  type AtualizacaoDosAutos,
  type LinhaCarteira,
  type SituacaoCitacao,
} from "@/lib/processos/rec-credito";
import { ROTULO_SITUACAO_ACORDO, rotuloDaParcela } from "@/lib/processos/acordos";
import { LogoGrupo } from "../vistagem/marcas";
import { Seletor, SeletorBusca, type OpcaoSeletor } from "../vistagem/seletor";
import { Aviso, BarraAba, Busca, Carregando, Indicador, Indicadores, Painel, Selo, Vazio, type TomSelo } from "../vistagem/ui";
import { TOM_SITUACAO_ACORDO } from "./acordos-painel";
import { AcessoProcessos } from "./acesso-processos";
import { mensagemDeErro, processosApi } from "./processos-api";

export function CarteiraClient() {
  return (
    <AcessoProcessos>
      <Carteira />
    </AcessoProcessos>
  );
}

const TOM_CITACAO: Record<SituacaoCitacao, TomSelo> = { positiva: "sucesso", negativa: "perigo", pendente: "alerta", sem_tentativa: "neutro" };
const SITUACOES: OpcaoSeletor[] = [
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "encerrados", rotulo: "Encerrados" },
];
const ATUALIZACOES: OpcaoSeletor[] = SITUACOES_DA_ATUALIZACAO.map((item) => ({ valor: item.valor, rotulo: item.rotulo }));
type Valor = string | number | null;
/** Ordem da coluna Acordo: o que pede atenção primeiro (descumprido, em atraso), depois em dia, cumprido, cancelado. */
const ORDEM_ACORDO: Record<string, string> = { descumprido: "0", em_atraso: "1", em_dia: "2", cumprido: "3", cancelado: "4" };
const FILTROS_ACORDO: OpcaoSeletor[] = [
  { valor: "com", rotulo: "Com acordo" },
  { valor: "atencao", rotulo: "Acordo em atraso ou descumprido" },
  { valor: "sem", rotulo: "Sem acordo" },
];
/** Colunas da tabela e o valor pelo qual cada uma ordena a lista. */
const COLUNAS: { titulo: string; valor: (linha: LinhaCarteira) => Valor }[] = [
  { titulo: "Processo", valor: (linha) => linha.cnj ?? linha.ci },
  { titulo: "Robô e IA", valor: (linha) => linha.autos.roboEm },
  { titulo: "Situação", valor: (linha) => `${linha.encerrado ? "1" : "0"} ${linha.fase ?? ""}` },
  { titulo: "Tipo do crédito", valor: (linha) => linha.tiposCredito.join(", ") || null },
  { titulo: "Valor original", valor: (linha) => linha.valorOriginal },
  { titulo: "No ajuizamento", valor: (linha) => linha.valorNoAjuizamento },
  { titulo: "Atualizado", valor: (linha) => linha.valorAtualizado },
  { titulo: "Citação", valor: (linha) => ROTULO_SITUACAO_CITACAO[linha.citacao] },
  { titulo: "Endereços pleiteados", valor: (linha) => linha.enderecosTentados.length || null },
  { titulo: "Passos e pedidos de execução", valor: (linha) => linha.pedidos.length || null },
  { titulo: "Acordo", valor: (linha) => (linha.acordo ? `${ORDEM_ACORDO[linha.acordo.resumo.situacao]} ${String(linha.acordo.resumo.diasDeAtraso).padStart(5, "0")}` : null) },
  { titulo: "Guias pagas", valor: (linha) => linha.guiasPagas || null },
  { titulo: "Recuperado", valor: (linha) => linha.valorRecuperado || null },
  { titulo: "Saving", valor: (linha) => linha.saving },
  { titulo: "Duração", valor: (linha) => linha.duracao?.meses ?? null },
  { titulo: "Próximos passos", valor: (linha) => linha.proximosPassos },
];

/** Vazios sempre no fim, nos dois sentidos. */
function compararValores(a: Valor, b: Valor, sentido: 1 | -1): number {
  if (a === null || a === "") return b === null || b === "" ? 0 : 1;
  if (b === null || b === "") return -1;
  const resultado = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "pt-BR", { numeric: true });
  return resultado * sentido;
}

const real = (valor: number | null) => (valor === null ? "—" : formatarReal(valor));
const situacaoPedido = (valor: string) => SITUACOES_PEDIDO.find((item) => item.valor === valor)?.rotulo ?? valor;

/** Carteira de Recuperação de Crédito: o crédito de cada processo atualizado pelo TJSP e o que já foi recuperado. */
function Carteira() {
  const [dados, setDados] = useState<{ linhas: LinhaCarteira[]; indicesAte: string | null } | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const [situacao, setSituacao] = useState("");
  const [atualizacao, setAtualizacao] = useState("");
  const [filtroAcordo, setFiltroAcordo] = useState("");
  const [ordem, setOrdem] = useState<{ coluna: string; sentido: 1 | -1 } | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [feito, setFeito] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    processosApi.get<{ linhas: LinhaCarteira[]; indicesAte: string | null }>("/carteira").then(
      (resposta) => {
        if (!ativo) return;
        setDados(resposta);
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

  const todas = useMemo(() => dados?.linhas ?? [], [dados]);
  const opcoesGrupo: OpcaoSeletor[] = [...new Set(todas.map((linha) => linha.grupoCliente).filter((valor): valor is string => Boolean(valor)))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((valor) => ({ valor, rotulo: valor, contagem: todas.filter((linha) => linha.grupoCliente === valor).length }));

  const hoje = diaEmBrasilia(new Date());
  // Enquanto o robô ou a IA trabalham em algum processo, a carteira se recarrega sozinha a cada 30 s.
  const trabalhando = todas.some((linha) => situacaoDaAtualizacao(linha.autos, hoje) === "em_andamento");
  useEffect(() => {
    if (!trabalhando) return;
    const relogio = window.setInterval(() => setTentativa((atual) => atual + 1), 30_000);
    return () => window.clearInterval(relogio);
  }, [trabalhando]);
  const filtradas = useMemo(() => {
    const digitos = busca.replace(/\D/g, "");
    const termo = busca.trim().toLowerCase();
    return todas.filter((linha) => {
      if (grupo && linha.grupoCliente !== grupo) return false;
      if (situacao === "ativos" && linha.encerrado) return false;
      if (situacao === "encerrados" && !linha.encerrado) return false;
      if (atualizacao && situacaoDaAtualizacao(linha.autos, hoje) !== atualizacao) return false;
      if (filtroAcordo === "com" && !linha.acordo) return false;
      if (filtroAcordo === "sem" && linha.acordo) return false;
      if (filtroAcordo === "atencao" && !(linha.acordo && ["em_atraso", "descumprido"].includes(linha.acordo.resumo.situacao))) return false;
      if (!termo) return true;
      if (digitos.length >= 4 && ((linha.cnj ?? "").replace(/\D/g, "").includes(digitos) || (linha.ci ?? "").includes(digitos))) return true;
      return [linha.devedor, linha.cliente].some((campo) => campo?.toLowerCase().includes(termo));
    });
  }, [todas, busca, grupo, situacao, atualizacao, filtroAcordo, hoje]);

  const ordenadas = useMemo(() => {
    const coluna = ordem ? COLUNAS.find((item) => item.titulo === ordem.coluna) : null;
    if (!coluna || !ordem) return filtradas;
    return [...filtradas].sort((a, b) => compararValores(coluna.valor(a), coluna.valor(b), ordem.sentido));
  }, [filtradas, ordem]);

  /** 1º clique: crescente; 2º: decrescente; 3º: volta à ordem original. */
  const ordenarPor = (titulo: string) =>
    setOrdem((atual) => (atual?.coluna !== titulo ? { coluna: titulo, sentido: 1 } : atual.sentido === 1 ? { coluna: titulo, sentido: -1 } : null));

  if (!dados && !erro) return <Carregando rotulo="Calculando a carteira" />;

  const soma = (valor: (linha: LinhaCarteira) => number | null) => filtradas.reduce((total, linha) => total + (valor(linha) ?? 0), 0);
  const atualizado = soma((linha) => linha.valorAtualizado);
  const recuperado = soma((linha) => linha.valorRecuperado);
  const guias = soma((linha) => linha.guiasPagas);
  const comCalculo = filtradas.filter((linha) => linha.valorAtualizado !== null).length;
  const recuperadoComCalculo = filtradas.filter((linha) => linha.valorAtualizado !== null).reduce((total, linha) => total + linha.valorRecuperado, 0);
  const savingGeral = atualizado > 0 ? (recuperadoComCalculo / atualizado) * 100 : null;
  const ativos = filtradas.filter((linha) => !linha.encerrado).length;

  /** Pede ao robô a atualização dos autos dos processos filtrados (só o que entrou desde o último download). */
  async function atualizarAutos() {
    setAtualizando(true);
    setErro("");
    setFeito("");
    try {
      const { resultado } = await processosApi.post<{ resultado: { pedidos: number; emAndamento: number; semRobo: number } }>("/autos/atualizar", { ids: filtradas.map((linha) => linha.id) });
      setFeito(
        [
          `${resultado.pedidos} processo${resultado.pedidos === 1 ? "" : "s"} na fila do robô para atualizar os autos.`,
          resultado.emAndamento ? `${resultado.emAndamento} já estava${resultado.emAndamento === 1 ? "" : "m"} na fila.` : "",
          resultado.semRobo ? `${resultado.semRobo} sem robô para o tribunal (ou em segredo de justiça): anexe o PDF na ficha.` : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
      setTentativa((atual) => atual + 1);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setAtualizando(false);
    }
  }

  async function baixar() {
    setBaixando(true);
    try {
      const filtrado = Boolean(busca || grupo || situacao || atualizacao || filtroAcordo);
      await processosApi.baixarCarteira(filtrado ? filtradas.map((linha) => linha.id) : null);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Indicadores>
        <Indicador icone={Scale} rotulo="Crédito atualizado (TJSP)" valor={formatarReal(atualizado)}>
          {comCalculo} de {filtradas.length} processo{filtradas.length === 1 ? "" : "s"} com títulos lançados
        </Indicador>
        <Indicador icone={Banknote} rotulo="Valor recuperado" valor={formatarReal(recuperado)} tom={recuperado > 0 ? "sucesso" : "neutro"}>
          valores levantados
        </Indicador>
        <Indicador icone={Percent} rotulo="Saving" valor={savingGeral === null ? "—" : `${savingGeral.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}>
          recuperado ÷ crédito atualizado
        </Indicador>
        <Indicador icone={Receipt} rotulo="Guias pagas" valor={formatarReal(guias)}>
          {ativos} ativo{ativos === 1 ? "" : "s"} · {filtradas.length - ativos} encerrado{filtradas.length - ativos === 1 ? "" : "s"}
        </Indicador>
      </Indicadores>

      {feito ? <Aviso tom="sucesso">{feito}</Aviso> : null}
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
            <strong className="font-semibold text-foreground tabular-nums">{filtradas.length}</strong> {filtradas.length === 1 ? "processo" : "processos"}
            {dados?.indicesAte ? ` · índices do TJSP até ${dados.indicesAte.slice(5, 7)}/${dados.indicesAte.slice(0, 4)}` : ""}
          </span>
        }
      >
        <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="CNJ, CI, devedor ou cliente" aria-label="Buscar processo" />
        <SeletorBusca valor={grupo} onChange={setGrupo} opcoes={opcoesGrupo} todos={{ rotulo: "Todos os grupos" }} rotulo="Grupo do cliente" className="sm:w-52" />
        <Seletor valor={situacao} onChange={setSituacao} opcoes={SITUACOES} todos={{ rotulo: "Ativos e encerrados" }} rotulo="Situação" className="sm:w-48" />
        <Seletor valor={atualizacao} onChange={setAtualizacao} opcoes={ATUALIZACOES} todos={{ rotulo: "Toda atualização" }} rotulo="Atualização dos autos" className="sm:w-56" />
        <Seletor valor={filtroAcordo} onChange={setFiltroAcordo} opcoes={FILTROS_ACORDO} todos={{ rotulo: "Com e sem acordo" }} rotulo="Acordo" className="sm:w-56" />
        <Button
          variant="outline"
          onClick={() => void atualizarAutos()}
          disabled={atualizando || !filtradas.length}
          title="Pede ao robô os autos dos processos filtrados: só o que entrou desde o último download, e a IA lê só o novo"
        >
          {atualizando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Atualizar autos ({filtradas.length})
        </Button>
        <Button variant="outline" onClick={() => void baixar()} disabled={baixando || !filtradas.length}>
          {baixando ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />} Excel
        </Button>
      </BarraAba>

      <Painel>
        {!todas.length ? (
          <Vazio icone={FolderSearch} titulo="Nenhum processo de Recuperação de Crédito no cadastro" />
        ) : !filtradas.length ? (
          <Vazio icone={SearchX} titulo="Nenhum processo com esses filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[110rem] text-left text-sm">
              <thead className="border-b border-[#e6eef0] bg-[#f7fbfc] text-xs font-medium text-muted-foreground">
                <tr>
                  {COLUNAS.map(({ titulo }) => {
                    const ativa = ordem?.coluna === titulo ? ordem : null;
                    const Seta = !ativa ? ArrowUpDown : ativa.sentido === 1 ? ArrowUp : ArrowDown;
                    return (
                      <th key={titulo} scope="col" className="whitespace-nowrap px-3 py-2 font-medium" aria-sort={!ativa ? "none" : ativa.sentido === 1 ? "ascending" : "descending"}>
                        <button type="button" onClick={() => ordenarPor(titulo)} className={`inline-flex items-center gap-1 hover:text-[#10293a] ${ativa ? "text-[#10293a]" : ""}`}>
                          {titulo}
                          <Seta className={`size-3.5 ${ativa ? "" : "opacity-40"}`} aria-hidden />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6eef0] align-top">
                {ordenadas.map((linha) => (
                  <tr key={linha.id} className="hover:bg-[#f6fafb]">
                    <td className="min-w-[16rem] px-3 py-2.5">
                      <Link href={`/operacoes-legais/processos/${linha.id}?de=carteira`} className="flex min-w-0 items-start gap-2.5 hover:underline">
                        <LogoGrupo grupo={linha.grupoCliente} tamanho="md" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold tabular-nums text-[#10293a]">{linha.cnj ?? "Sem número CNJ"}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            CI {linha.ci ?? "—"} · {linha.devedor ?? "devedor não informado"}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      <AtualizacaoDosAutosNaLinha autos={linha.autos} hoje={hoje} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Selo tom={linha.encerrado ? "neutro" : "marca"}>{linha.encerrado ? "Encerrado" : "Ativo"}</Selo>
                      {linha.fase ? <p className="mt-1 text-xs text-muted-foreground">{linha.fase}</p> : null}
                    </td>
                    <td className="px-3 py-2.5">
                      {linha.tiposCredito.length ? linha.tiposCredito.join(", ") : <span className="text-muted-foreground">—</span>}
                      {linha.quantidadeTitulos ? <p className="text-xs text-muted-foreground">{linha.quantidadeTitulos} título{linha.quantidadeTitulos === 1 ? "" : "s"}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{real(linha.valorOriginal)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                      {real(linha.valorNoAjuizamento)}
                      {linha.dataDistribuicao ? <p className="text-xs text-muted-foreground">{formatarData(linha.dataDistribuicao)}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium tabular-nums text-[#10293a]">
                      {real(linha.valorAtualizado)}
                      {linha.avisos.length ? (
                        <p className="max-w-[14rem] whitespace-normal text-xs font-normal text-amber-700" title={linha.avisos.join("\n")}>
                          {linha.avisos[0]}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Selo tom={TOM_CITACAO[linha.citacao]}>{ROTULO_SITUACAO_CITACAO[linha.citacao]}</Selo>
                      {linha.tentativasCitacao ? <p className="mt-1 text-xs text-muted-foreground">{linha.tentativasCitacao} tentativa{linha.tentativasCitacao === 1 ? "" : "s"}</p> : null}
                    </td>
                    <td className="min-w-[14rem] max-w-[20rem] px-3 py-2.5 text-xs">
                      {linha.enderecosTentados.length ? (
                        <ul className="space-y-1">
                          {linha.enderecosTentados.map((endereco) => (
                            <li key={endereco} className="line-clamp-2">
                              {endereco}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="min-w-[16rem] max-w-[22rem] px-3 py-2.5 text-xs">
                      {linha.pedidos.length ? (
                        <ul className="space-y-1">
                          {linha.pedidos.map((pedido, indice) => (
                            <li key={indice}>
                              <span className="font-medium text-[#10293a]">{pedido.tipo}</span>
                              {pedido.data ? ` (${formatarData(pedido.data)})` : ""}: {situacaoPedido(pedido.situacao)}
                              {pedido.resultado ? <span className="text-muted-foreground"> · {pedido.resultado}</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      {linha.acordo ? (
                        <div className="space-y-1">
                          <Selo tom={TOM_SITUACAO_ACORDO[linha.acordo.resumo.situacao]}>{ROTULO_SITUACAO_ACORDO[linha.acordo.resumo.situacao]}</Selo>
                          <p className="tabular-nums text-muted-foreground">
                            {formatarReal(linha.acordo.valorTotal)} · {linha.acordo.resumo.pagas} de {linha.acordo.resumo.parcelas} paga{linha.acordo.resumo.parcelas === 1 ? "" : "s"}
                          </p>
                          {linha.acordo.resumo.vencidas && linha.acordo.resumo.situacao !== "cancelado" ? (
                            <p className="tabular-nums text-amber-700">
                              {linha.acordo.resumo.vencidas} vencida{linha.acordo.resumo.vencidas === 1 ? "" : "s"} · {linha.acordo.resumo.diasDeAtraso} dia{linha.acordo.resumo.diasDeAtraso === 1 ? "" : "s"} de atraso
                            </p>
                          ) : linha.acordo.resumo.proxima && linha.acordo.resumo.situacao === "em_dia" ? (
                            <p className="tabular-nums text-muted-foreground">
                              próxima: {rotuloDaParcela(linha.acordo.resumo.proxima.numero).toLowerCase()}, {formatarData(linha.acordo.resumo.proxima.vencimento)}
                            </p>
                          ) : null}
                          {linha.acordo.quantidade > 1 ? <p className="text-muted-foreground">{linha.acordo.quantidade} acordos no processo</p> : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{linha.guiasPagas ? formatarReal(linha.guiasPagas) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{linha.valorRecuperado ? formatarReal(linha.valorRecuperado) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{linha.saving === null ? "—" : `${linha.saving.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {linha.duracao ? linha.duracao.rotulo : "—"}
                      {linha.duracao?.desde === "cadastro" ? <p className="text-xs text-muted-foreground">desde o cadastro</p> : null}
                    </td>
                    <td className="min-w-[16rem] max-w-[22rem] px-3 py-2.5 text-xs">
                      {linha.proximosPassos ? <p className="line-clamp-4 whitespace-pre-wrap">{linha.proximosPassos}</p> : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </div>
  );
}

const TOM_ROBO_AGORA: Record<NonNullable<AtualizacaoDosAutos["roboAgora"]>, TomSelo> = { na_fila: "alerta", baixando: "marca", aguardando_pessoa: "alerta", erro: "perigo" };

/** Quando o robô conferiu o tribunal e quando a IA leu: verde se foi hoje, cinza se antes, âmbar se nunca. */
function AtualizacaoDosAutosNaLinha({ autos, hoje }: { autos: AtualizacaoDosAutos; hoje: string }) {
  const cor = (iso: string | null) => (!iso ? "text-amber-700" : diaEmBrasilia(iso) === hoje ? "text-emerald-700" : "text-muted-foreground");
  const ia = autos.iaEm ? formatarMomento(autos.iaEm) : autos.documentos ? "não lida" : "sem autos";
  const extras = [autos.iaPendentes ? `${autos.iaPendentes} por ler` : "", autos.iaErros ? `${autos.iaErros} com erro` : "", autos.iaSemTexto ? `${autos.iaSemTexto} sem texto` : ""].filter(Boolean);
  return (
    <div className="space-y-1">
      {autos.roboAgora ? (
        <Selo tom={TOM_ROBO_AGORA[autos.roboAgora]} titulo={autos.roboErro ?? undefined}>
          {ROTULO_ROBO_AGORA[autos.roboAgora]}
        </Selo>
      ) : null}
      <p className={cor(autos.roboEm)}>
        <span className="font-medium">Robô</span> <span className="tabular-nums">{autos.roboEm ? formatarMomento(autos.roboEm) : "nunca baixou"}</span>
      </p>
      <p className={cor(autos.iaEm)}>
        <span className="font-medium">IA</span> <span className="tabular-nums">{ia}</span>
        {extras.length ? <span className="text-amber-700"> · {extras.join(" · ")}</span> : null}
      </p>
    </div>
  );
}
