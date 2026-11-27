"use client";

import { useCallback, useEffect, useState } from "react";
import { Calculator, CalendarOff, FileText, Gavel, LoaderCircle, PencilLine, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ESPECIES_AFASTAMENTO,
  RESULTADOS_PEDIDO,
  ROTULO_DO_ITEM_TRABALHISTA,
  SITUACOES_PRESCRICAO,
  formatarReais,
  resultadoFinal,
  type Afastamento,
  type PedidoTrabalhista,
  type ResultadoPedido,
  type TipoItemTrabalhista,
} from "@/lib/processos/trabalhista";
import type { TrabalhistaDoProcesso } from "@/lib/processos/trabalhista-server";
import type { ProcessoDetalhe } from "@/lib/processos/types";
import { cn } from "@/lib/utils";
import { CampoData } from "../vistagem/campo-data";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Seletor } from "../vistagem/seletor";
import { Aviso, Campo, Carregando, Painel, PainelTopo, Secao, Selo, type TomSelo } from "../vistagem/ui";
import { mensagemDeErro, processosApi } from "./processos-api";

type Formulario = Record<string, string>;

const br = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const rotulo = (lista: readonly { valor: string; rotulo: string }[], valor: string | null) => lista.find((item) => item.valor === valor)?.rotulo ?? valor ?? "";
const TOM_RESULTADO: Record<ResultadoPedido, TomSelo> = { deferido: "perigo", em_parte: "alerta", indeferido: "sucesso", nao_julgado: "neutro" };
const valorNoFormulario = (valor: number | null) => (valor === null ? "" : valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function formularioDoAfastamento(item?: Afastamento): Formulario {
  return item ? { inicio: item.inicio, fim: item.fim ?? "", especie: item.especie, observacao: item.observacao ?? "" } : { especie: "auxilio_doenca" };
}

function formularioDoPedido(item?: PedidoTrabalhista): Formulario {
  return item
    ? {
        pedido: item.pedido,
        valor_pedido: valorNoFormulario(item.valorPedido),
        resultado_sentenca: item.resultadoSentenca ?? "",
        resultado_acordao: item.resultadoAcordao ?? "",
        resultado_rr: item.resultadoRr ?? "",
        detalhe: item.detalhe ?? "",
        prescricao: item.prescricao ?? "",
        prescricao_marco: item.prescricaoMarco ?? "",
      }
    : {};
}

type Edicao = { tipo: TipoItemTrabalhista; id: string | null; formulario: Formulario } | { tipo: TipoItemTrabalhista; id: string; excluir: true; descricao: string };

/**
 * Saneamento trabalhista na ficha: o cálculo do risco (adicional mês a mês, sem os afastamentos, mais reflexos), os
 * afastamentos pelo INSS e os pedidos da inicial com o resultado em cada decisão. Os campos simples (contrato,
 * laudo, decisões, risco) ficam nos grupos de campos da ficha.
 */
export function PainelTrabalhista({
  processo,
  atualizacao = 0,
  onFeito,
  onErro,
  onProcesso,
}: {
  processo: ProcessoDetalhe;
  atualizacao?: number;
  onFeito: (mensagem: string) => void;
  onErro: (mensagem: string) => void;
  onProcesso: (processo: ProcessoDetalhe) => void;
}) {
  const [dados, setDados] = useState<TrabalhistaDoProcesso | null>(null);
  const [falha, setFalha] = useState("");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erroDialogo, setErroDialogo] = useState("");

  const carregar = useCallback(async () => {
    try {
      const resposta = await processosApi.get<{ trabalhista: TrabalhistaDoProcesso }>(`/${processo.id}/trabalhista`);
      setDados(resposta.trabalhista);
      setFalha("");
    } catch (erro) {
      setFalha(mensagemDeErro(erro));
    }
  }, [processo.id]);

  // Recarrega quando a ficha muda (um campo do contrato ou das decisões entra no cálculo) ou uma sugestão é aprovada.
  const versaoDosValores = JSON.stringify([processo.valores.periodo_calculo_inicio, processo.valores.periodo_calculo_fim, processo.valores.data_admissao, processo.valores.data_termino, processo.valores.ultimo_dia_trabalhado, processo.valores.tipo_termino, processo.valores.laudo_agente, processo.valores.laudo_grau, processo.valores.adicional_grau, processo.valores.adicional_base, processo.valores.salario, processo.valores.risco_reflexos_percentual, processo.valores.data_distribuicao, processo.valores.prescricao_quinquenal, processo.valores.prescricao_quinquenal_marco, processo.valores.prescricao_bienal, processo.valores.prescricao_intercorrente]);
  useEffect(() => {
    void carregar();
  }, [carregar, atualizacao, versaoDosValores]);

  function abrir(tipo: TipoItemTrabalhista, item?: Afastamento | PedidoTrabalhista) {
    setErroDialogo("");
    setEdicao({ tipo, id: item?.id ?? null, formulario: tipo === "afastamento" ? formularioDoAfastamento(item as Afastamento | undefined) : formularioDoPedido(item as PedidoTrabalhista | undefined) });
  }

  async function salvar() {
    if (!edicao) return;
    setSalvando(true);
    setErroDialogo("");
    try {
      let resposta: { trabalhista: TrabalhistaDoProcesso };
      const nome = ROTULO_DO_ITEM_TRABALHISTA[edicao.tipo];
      let mensagem: string;
      if ("excluir" in edicao) {
        resposta = await processosApi.del(`/trabalhista/${edicao.tipo}/${edicao.id}`);
        mensagem = `${nome} excluído.`;
      } else {
        const corpo = Object.fromEntries(Object.entries(edicao.formulario).map(([chave, valor]) => [chave, valor.trim() || null]));
        resposta = edicao.id ? await processosApi.put(`/trabalhista/${edicao.tipo}/${edicao.id}`, { dados: corpo }) : await processosApi.post(`/${processo.id}/trabalhista`, { tipo: edicao.tipo, dados: corpo });
        mensagem = `${nome} ${edicao.id ? "salvo" : "incluído"}.`;
      }
      setDados(resposta.trabalhista);
      setEdicao(null);
      onFeito(mensagem);
    } catch (erro) {
      setErroDialogo(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  async function aplicarCalculo() {
    setAplicando(true);
    onErro("");
    try {
      const resposta = await processosApi.post<{ processo: ProcessoDetalhe; trabalhista: TrabalhistaDoProcesso }>(`/${processo.id}/trabalhista`, { acao: "aplicar_calculo" });
      setDados(resposta.trabalhista);
      onProcesso(resposta.processo);
      onFeito("Risco calculado gravado na ficha.");
    } catch (erro) {
      onErro(mensagemDeErro(erro));
    } finally {
      setAplicando(false);
    }
  }

  if (falha && !dados) {
    return (
      <Painel>
        <PainelTopo titulo="Saneamento trabalhista" />
        <div className="p-4">
          <Aviso tom="erro" acao={<Button size="sm" variant="outline" className="-my-1" onClick={() => void carregar()}>Tentar de novo</Button>}>
            {falha}
          </Aviso>
        </div>
      </Painel>
    );
  }
  if (!dados) {
    return (
      <Painel>
        <PainelTopo titulo="Saneamento trabalhista" />
        <Carregando />
      </Painel>
    );
  }

  const { calculo, parametros } = dados;
  const naFicha = typeof processo.valores.risco_total === "number" ? processo.valores.risco_total : null;
  const igualNaFicha = calculo && naFicha !== null && Math.abs(naFicha - calculo.total) < 0.01;

  return (
    <Painel>
      <PainelTopo titulo="Saneamento trabalhista" descricao="Cálculo do risco, afastamentos pelo INSS e pedidos com o resultado em cada decisão. O cliente é a reclamada." />

      <Secao titulo="Cálculo do risco" id="trab-calculo">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Período</dt>
            <dd className="tabular-nums">{parametros.inicio && parametros.fim ? `${br(parametros.inicio)} a ${br(parametros.fim)}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Adicional</dt>
            <dd>{parametros.percentual !== null ? `${parametros.percentual}% sobre ${parametros.base === "salario_minimo" ? "o salário-mínimo de cada mês" : "o salário contratual"}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Afastamentos descontados</dt>
            <dd className="tabular-nums">{calculo ? `${calculo.diasAfastado} dia${calculo.diasAfastado === 1 ? "" : "s"}` : `${dados.afastamentos.length} lançado${dados.afastamentos.length === 1 ? "" : "s"}`}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Reflexos</dt>
            <dd className="tabular-nums">{parametros.reflexosPercentual}%</dd>
          </div>
        </dl>
        <div className="rounded-md border border-[#e6eef0] bg-[#f7fbfc] px-3 py-2 text-xs">
          <p className="font-medium text-[#285f7a]">Prescrição</p>
          <p className="text-muted-foreground">
            {parametros.prescricao.marco
              ? `Quinquenal: parcelas anteriores a ${br(parametros.prescricao.marco)} ${parametros.prescricao.origemMarco === "ficha" ? "(marco da ficha)" : "(5 anos antes da distribuição)"}${parametros.limitadoPelaPrescricao ? ", e o cálculo começa nessa data" : parametros.prescricao.aplicaNoCalculo ? "" : ", sem efeito no cálculo"}.`
              : "Sem data de distribuição: não dá para fixar o marco da prescrição quinquenal."}
            {parametros.prescricao.bienalLimite ? ` Bienal: ação até ${br(parametros.prescricao.bienalLimite)}.` : ""}
          </p>
          {parametros.prescricao.avisos.map((aviso) => (
            <p key={aviso} className="text-amber-800">
              {aviso}
            </p>
          ))}
        </div>
        {parametros.faltando.length ? (
          <Aviso tom="alerta" titulo="Falta para calcular">
            {parametros.faltando.join("; ")}. Preencha em Contrato de trabalho e em Laudo e decisões.
          </Aviso>
        ) : null}
        {dados.erroCalculo ? <Aviso tom="erro">{dados.erroCalculo}</Aviso> : null}
        {calculo ? (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["Valor", calculo.principal],
                [`Reflexos (${calculo.reflexosPercentual}%)`, calculo.reflexos],
                ["Total", calculo.total],
              ].map(([titulo, valor]) => (
                <div key={String(titulo)} className="rounded-md border border-[#dce9eb] bg-[#f7fbfc] px-3 py-2">
                  <p className="text-xs text-muted-foreground">{titulo}</p>
                  <p className="text-base font-semibold tabular-nums text-[#10293a]">{formatarReais(Number(valor))}</p>
                </div>
              ))}
            </div>
            {calculo.avisos.map((aviso) => (
              <p key={aviso} className="text-xs text-amber-800">
                {aviso}
              </p>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => void aplicarCalculo()} disabled={aplicando || Boolean(igualNaFicha)} title="Grava valor, reflexos e total no grupo Risco trabalhista (fica no histórico; dá para ajustar depois)">
                {aplicando ? <LoaderCircle className="animate-spin" /> : <Save />} {igualNaFicha ? "Já está na ficha" : "Gravar na ficha"}
              </Button>
              {naFicha !== null && !igualNaFicha ? <span className="text-xs text-muted-foreground">Hoje na ficha: {formatarReais(naFicha)}</span> : null}
            </div>
            <details className="rounded-md border border-[#e6eef0]">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-[#285f7a]">
                <Calculator className="mr-1 inline size-3.5" aria-hidden /> Memória do cálculo ({calculo.meses.length} meses)
              </summary>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#f7fbfc] text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Mês</th>
                      <th className="px-3 py-1.5 text-right font-medium">Dias</th>
                      <th className="px-3 py-1.5 text-right font-medium">Base</th>
                      <th className="px-3 py-1.5 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef3f5] tabular-nums">
                    {calculo.meses.map((mes) => (
                      <tr key={mes.mes}>
                        <td className="px-3 py-1">{`${mes.mes.slice(5)}/${mes.mes.slice(0, 4)}`}</td>
                        <td className="px-3 py-1 text-right">{mes.fracao === 1 ? "mês inteiro" : mes.dias}</td>
                        <td className="px-3 py-1 text-right">{formatarReais(mes.base)}</td>
                        <td className="px-3 py-1 text-right">{formatarReais(mes.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <p className="text-xs text-muted-foreground">Valores nominais, sem correção monetária nem juros. Mês quebrado vale dias ÷ 30.</p>
          </>
        ) : null}
      </Secao>

      <Secao
        titulo="Afastamentos pelo INSS"
        id="trab-afastamentos"
        acao={
          <Button size="xs" variant="outline" onClick={() => abrir("afastamento")}>
            <Plus /> Incluir
          </Button>
        }
      >
        {dados.afastamentos.length ? (
          <ul className="divide-y divide-[#eef3f5] rounded-md border border-[#e6eef0]">
            {dados.afastamentos.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-3 py-2">
                <CalendarOff className="mt-0.5 size-4 shrink-0 text-[#3e84a8]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium tabular-nums">
                    {br(item.inicio)} a {item.fim ? br(item.fim) : "sem data de alta"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rotulo(ESPECIES_AFASTAMENTO, item.especie)}
                    {item.observacao ? ` · ${item.observacao}` : ""}
                    {item.origem === "autos" ? ` · dos autos${item.pagina ? `, p. ${item.pagina}` : ""}` : ""}
                  </p>
                </div>
                <AcoesDoItem onEditar={() => abrir("afastamento", item)} onExcluir={() => setEdicao({ tipo: "afastamento", id: item.id, excluir: true, descricao: `Afastamento de ${br(item.inicio)}` })} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum afastamento lançado.</p>
        )}
      </Secao>

      <Secao
        titulo="Pedidos e decisões"
        id="trab-pedidos"
        acao={
          <Button size="xs" variant="outline" onClick={() => abrir("pedido")}>
            <Plus /> Incluir
          </Button>
        }
      >
        {dados.pedidos.length ? (
          <div className="overflow-x-auto rounded-md border border-[#e6eef0]">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-[#f7fbfc] text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Pedido</th>
                  <th className="px-3 py-2 text-right font-medium">Valor pedido</th>
                  <th className="px-3 py-2 font-medium">Sentença</th>
                  <th className="px-3 py-2 font-medium">Acórdão</th>
                  <th className="px-3 py-2 font-medium">RR</th>
                  <th className="px-3 py-2 font-medium">Prescrição</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3f5]">
                {dados.pedidos.map((item) => {
                  const final = resultadoFinal(item);
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-3 py-2">
                        <p className="flex items-center gap-1.5 font-medium">
                          <Gavel className="size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
                          {item.pedido}
                        </p>
                        {item.detalhe ? <p className="text-xs text-muted-foreground">{item.detalhe}</p> : null}
                        {item.origem === "autos" ? (
                          <p className="text-[11px] text-muted-foreground">
                            <FileText className="mr-0.5 inline size-3" aria-hidden /> dos autos{item.pagina ? `, p. ${item.pagina}` : ""}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.valorPedido !== null ? formatarReais(item.valorPedido) : "—"}</td>
                      {([item.resultadoSentenca, item.resultadoAcordao, item.resultadoRr] as const).map((resultado, indice) => (
                        <td key={indice} className="px-3 py-2">
                          {resultado ? (
                            <Selo tom={TOM_RESULTADO[resultado]} className={cn(final === resultado && "font-semibold")}>
                              {rotulo(RESULTADOS_PEDIDO, resultado)}
                            </Selo>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-xs">
                        {item.prescricao ? (
                          <>
                            <Selo tom={item.prescricao === "acolhida" || item.prescricao === "acolhida_em_parte" ? "sucesso" : item.prescricao === "rejeitada" ? "perigo" : "neutro"}>{rotulo(SITUACOES_PRESCRICAO, item.prescricao)}</Selo>
                            {item.prescricaoMarco ? <p className="mt-0.5 text-muted-foreground">antes de {br(item.prescricaoMarco)}</p> : null}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <AcoesDoItem onEditar={() => abrir("pedido", item)} onExcluir={() => setEdicao({ tipo: "pedido", id: item.id, excluir: true, descricao: item.pedido })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum pedido lançado. A leitura dos autos pela IA propõe os pedidos da inicial e o resultado de cada decisão.</p>
        )}
      </Secao>

      {edicao ? (
        "excluir" in edicao ? (
          <DialogoAcao
            aberto
            onFechar={() => setEdicao(null)}
            ocupado={salvando}
            icone={Trash2}
            tom="perigo"
            titulo={`Excluir ${ROTULO_DO_ITEM_TRABALHISTA[edicao.tipo].toLowerCase()}`}
            descricao={`${edicao.descricao}. A exclusão fica no histórico do processo.`}
            rodape={
              <>
                <Button variant="outline" onClick={() => setEdicao(null)} disabled={salvando}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={() => void salvar()} disabled={salvando}>
                  {salvando ? <LoaderCircle className="animate-spin" /> : null} Excluir
                </Button>
              </>
            }
          >
            {erroDialogo ? <Aviso tom="erro">{erroDialogo}</Aviso> : <span />}
          </DialogoAcao>
        ) : (
          <FormularioTrabalhista
            edicao={edicao}
            salvando={salvando}
            erro={erroDialogo}
            onMudar={(chave, valor) => setEdicao((atual) => (atual && !("excluir" in atual) ? { ...atual, formulario: { ...atual.formulario, [chave]: valor } } : atual))}
            onFechar={() => setEdicao(null)}
            onSalvar={() => void salvar()}
          />
        )
      ) : null}
    </Painel>
  );
}

function AcoesDoItem({ onEditar, onExcluir }: { onEditar: () => void; onExcluir: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button size="icon-xs" variant="ghost" onClick={onEditar} title="Editar" aria-label="Editar">
        <PencilLine />
      </Button>
      <Button size="icon-xs" variant="ghost" onClick={onExcluir} title="Excluir" aria-label="Excluir">
        <Trash2 />
      </Button>
    </div>
  );
}

function FormularioTrabalhista({
  edicao,
  salvando,
  erro,
  onMudar,
  onFechar,
  onSalvar,
}: {
  edicao: { tipo: TipoItemTrabalhista; id: string | null; formulario: Formulario };
  salvando: boolean;
  erro: string;
  onMudar: (chave: string, valor: string) => void;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  const f = edicao.formulario;
  const nome = ROTULO_DO_ITEM_TRABALHISTA[edicao.tipo].toLowerCase();
  const faltando = edicao.tipo === "afastamento" ? (f.inicio ? [] : ["início"]) : f.pedido?.trim() ? [] : ["pedido"];
  const resultado = (chave: string, titulo: string) => (
    <Campo rotulo={titulo}>
      <Seletor valor={f[chave] ?? ""} onChange={(valor) => onMudar(chave, valor)} opcoes={RESULTADOS_PEDIDO} todos={{ rotulo: "Sem decisão" }} rotulo={titulo} />
    </Campo>
  );
  return (
    <DialogoAcao
      aberto
      onFechar={onFechar}
      ocupado={salvando}
      icone={edicao.id ? PencilLine : Plus}
      titulo={edicao.id ? `Editar ${nome}` : `Incluir ${nome}`}
      descricao="Lançamento à mão: fica no histórico do processo com o seu nome."
      className="sm:max-w-2xl"
      aviso={faltando.length ? `Falta: ${faltando.join(", ")}.` : undefined}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={onSalvar} disabled={salvando || faltando.length > 0}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null} Salvar
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {edicao.tipo === "afastamento" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Início *">
            <CampoData valor={f.inicio ?? ""} onChange={(valor) => onMudar("inicio", valor)} rotulo="Início do afastamento" />
          </Campo>
          <Campo rotulo="Fim (alta)" dica="Vazio: ainda afastado (vale até o fim do período de cálculo).">
            <CampoData valor={f.fim ?? ""} onChange={(valor) => onMudar("fim", valor)} rotulo="Fim do afastamento" permitirVazio />
          </Campo>
          <Campo rotulo="Espécie">
            <Seletor valor={f.especie ?? ""} onChange={(valor) => onMudar("especie", valor)} opcoes={ESPECIES_AFASTAMENTO} rotulo="Espécie do benefício" />
          </Campo>
          <Campo rotulo="Observação" className="sm:col-span-2">
            <Textarea value={f.observacao ?? ""} onChange={(evento) => onMudar("observacao", evento.target.value)} rows={2} />
          </Campo>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Pedido *" className="sm:col-span-2">
            <Input value={f.pedido ?? ""} onChange={(evento) => onMudar("pedido", evento.target.value)} placeholder="Ex.: Adicional de insalubridade" />
          </Campo>
          <Campo rotulo="Valor pedido (R$)">
            <Input value={f.valor_pedido ?? ""} onChange={(evento) => onMudar("valor_pedido", evento.target.value)} inputMode="decimal" placeholder="0,00" />
          </Campo>
          {resultado("resultado_sentenca", "Sentença")}
          {resultado("resultado_acordao", "Acórdão (TRT)")}
          {resultado("resultado_rr", "Recurso de revista (TST)")}
          <Campo rotulo="Prescrição do pedido">
            <Seletor valor={f.prescricao ?? ""} onChange={(valor) => onMudar("prescricao", valor)} opcoes={SITUACOES_PRESCRICAO} todos={{ rotulo: "Não informada" }} rotulo="Prescrição do pedido" />
          </Campo>
          <Campo rotulo="Prescritas as parcelas anteriores a">
            <CampoData valor={f.prescricao_marco ?? ""} onChange={(valor) => onMudar("prescricao_marco", valor)} rotulo="Marco da prescrição do pedido" permitirVazio />
          </Campo>
          <Campo rotulo="Limites da condenação" className="sm:col-span-2" dica="Período, grau, base de cálculo, reflexos deferidos.">
            <Textarea value={f.detalhe ?? ""} onChange={(evento) => onMudar("detalhe", evento.target.value)} rows={2} />
          </Campo>
        </div>
      )}
    </DialogoAcao>
  );
}
