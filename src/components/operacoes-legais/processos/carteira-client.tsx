"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, FileSpreadsheet, FolderSearch, LoaderCircle, Percent, Receipt, RefreshCw, Scale, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROTULO_SITUACAO_CITACAO, SITUACOES_PEDIDO, formatarData, formatarReal, type LinhaCarteira, type SituacaoCitacao } from "@/lib/processos/rec-credito";
import { LogoGrupo } from "../vistagem/marcas";
import { Seletor, SeletorBusca, type OpcaoSeletor } from "../vistagem/seletor";
import { Aviso, BarraAba, Busca, Carregando, Indicador, Indicadores, Painel, Selo, Vazio, type TomSelo } from "../vistagem/ui";
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
const real = (valor: number | null) => (valor === null ? "—" : formatarReal(valor));
const situacaoPedido = (valor: string) => SITUACOES_PEDIDO.find((item) => item.valor === valor)?.rotulo ?? valor;

/** Carteira de Recuperação de Crédito: o crédito de cada processo atualizado pelo TJSP e o que já foi recuperado. */
function Carteira() {
  const [dados, setDados] = useState<{ linhas: LinhaCarteira[]; indicesAte: string | null } | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const [situacao, setSituacao] = useState("");
  const [baixando, setBaixando] = useState(false);
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

  const filtradas = useMemo(() => {
    const digitos = busca.replace(/\D/g, "");
    const termo = busca.trim().toLowerCase();
    return todas.filter((linha) => {
      if (grupo && linha.grupoCliente !== grupo) return false;
      if (situacao === "ativos" && linha.encerrado) return false;
      if (situacao === "encerrados" && !linha.encerrado) return false;
      if (!termo) return true;
      if (digitos.length >= 4 && ((linha.cnj ?? "").replace(/\D/g, "").includes(digitos) || (linha.ci ?? "").includes(digitos))) return true;
      return [linha.devedor, linha.cliente].some((campo) => campo?.toLowerCase().includes(termo));
    });
  }, [todas, busca, grupo, situacao]);

  if (!dados && !erro) return <Carregando rotulo="Calculando a carteira" />;

  const soma = (valor: (linha: LinhaCarteira) => number | null) => filtradas.reduce((total, linha) => total + (valor(linha) ?? 0), 0);
  const atualizado = soma((linha) => linha.valorAtualizado);
  const recuperado = soma((linha) => linha.valorRecuperado);
  const guias = soma((linha) => linha.guiasPagas);
  const comCalculo = filtradas.filter((linha) => linha.valorAtualizado !== null).length;
  const recuperadoComCalculo = filtradas.filter((linha) => linha.valorAtualizado !== null).reduce((total, linha) => total + linha.valorRecuperado, 0);
  const savingGeral = atualizado > 0 ? (recuperadoComCalculo / atualizado) * 100 : null;
  const ativos = filtradas.filter((linha) => !linha.encerrado).length;

  async function baixar() {
    setBaixando(true);
    try {
      const filtrado = Boolean(busca || grupo || situacao);
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
                  {[
                    "Processo",
                    "Situação",
                    "Tipo do crédito",
                    "Valor original",
                    "No ajuizamento",
                    "Atualizado",
                    "Citação",
                    "Endereços pleiteados",
                    "Passos e pedidos de execução",
                    "Guias pagas",
                    "Recuperado",
                    "Saving",
                    "Duração",
                    "Próximos passos",
                  ].map((titulo) => (
                    <th key={titulo} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                      {titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6eef0] align-top">
                {filtradas.map((linha) => (
                  <tr key={linha.id} className="hover:bg-[#f6fafb]">
                    <td className="min-w-[16rem] px-3 py-2.5">
                      <Link href={`/operacoes-legais/processos/${linha.id}`} className="flex min-w-0 items-start gap-2.5 hover:underline">
                        <LogoGrupo grupo={linha.grupoCliente} tamanho="md" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold tabular-nums text-[#10293a]">{linha.cnj ?? "Sem número CNJ"}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            CI {linha.ci ?? "—"} · {linha.devedor ?? "devedor não informado"}
                          </span>
                        </span>
                      </Link>
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
