"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, FileText, Handshake, ListChecks, LoaderCircle, PencilLine, Plus, RotateCcw, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PERIODICIDADES,
  POSICOES,
  ROTULO_SITUACAO_ACORDO,
  gerarParcelas,
  planoDoFormulario,
  resumoDoAcordo,
  rotuloDaParcela,
  type Acordo,
  type Parcela,
  type SituacaoDoAcordo,
} from "@/lib/processos/acordos";
import { diaEmBrasilia, formatarData, formatarReal, lerValor } from "@/lib/processos/rec-credito";
import { CampoData } from "../vistagem/campo-data";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Seletor } from "../vistagem/seletor";
import { Aviso, Campo, Painel, PainelTopo, Selo, Vazio, type TomSelo } from "../vistagem/ui";
import { abrirAutos, mensagemDeErro, processosApi } from "./processos-api";

export const TOM_SITUACAO_ACORDO: Record<SituacaoDoAcordo, TomSelo> = { em_dia: "marca", em_atraso: "alerta", cumprido: "sucesso", descumprido: "perigo", cancelado: "neutro" };

type Formulario = Record<string, string>;
type Resposta = { acordos: Acordo[] };

const valorTexto = (valor: number | null) => (valor === null ? "" : valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

const NOVO: Formulario = { posicao: "recebe", periodicidade: "mensal", quantidade: "", celebradoEm: "", homologadoEm: "", valorTotal: "", entradaValor: "", entradaVencimento: "", valorParcela: "", primeiroVencimento: "", multaPercentual: "", observacao: "" };

function formularioDoAcordo(acordo: Acordo): Formulario {
  return {
    posicao: acordo.posicao,
    celebradoEm: acordo.celebradoEm ?? "",
    homologadoEm: acordo.homologadoEm ?? "",
    valorTotal: valorTexto(acordo.valorTotal),
    multaPercentual: acordo.multaPercentual === null ? "" : String(acordo.multaPercentual).replace(".", ","),
    observacao: acordo.observacao ?? "",
  };
}

/** Corpo para a API: texto vazio vira nulo. */
const corpo = (formulario: Formulario) => Object.fromEntries(Object.entries(formulario).map(([chave, valor]) => [chave, valor.trim() || null]));

/**
 * Acordos do processo (qualquer área): quem paga, valor, parcelas e o cumprimento. O controle das parcelas
 * (pagar, desfazer, editar, incluir) e a situação (descumprido, cancelado) ficam no modal de cada acordo.
 */
export function PainelAcordos({
  processoId,
  atualizacao = 0,
  onFeito,
  onErro,
}: {
  processoId: string;
  /** Muda quando algo de fora (uma sugestão aprovada) mexeu nos acordos: o painel recarrega. */
  atualizacao?: number;
  onFeito: (mensagem: string) => void;
  onErro: (mensagem: string) => void;
}) {
  const [acordos, setAcordos] = useState<Acordo[] | null>(null);
  const [falha, setFalha] = useState("");
  const [novo, setNovo] = useState<Formulario | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroDialogo, setErroDialogo] = useState("");
  const hoje = diaEmBrasilia(new Date());

  const carregar = useCallback(async () => {
    try {
      const resposta = await processosApi.get<Resposta>(`/${processoId}/acordos`);
      setAcordos(resposta.acordos);
      setFalha("");
    } catch (erro) {
      setFalha(mensagemDeErro(erro));
    }
  }, [processoId]);

  useEffect(() => {
    void carregar();
  }, [carregar, atualizacao]);

  async function criar() {
    if (!novo) return;
    setSalvando(true);
    setErroDialogo("");
    try {
      const resposta = await processosApi.post<Resposta>(`/${processoId}/acordos`, { dados: corpo(novo) });
      setAcordos(resposta.acordos);
      setNovo(null);
      onFeito("Acordo incluído com as parcelas.");
    } catch (erro) {
      setErroDialogo(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  const emControle = acordos?.find((acordo) => acordo.id === aberto) ?? null;

  return (
    <Painel>
      <PainelTopo titulo="Acordos" descricao="Acordos do processo, as parcelas e o cumprimento. Em Rec. Crédito, a parcela paga ao cliente conta como valor recuperado.">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setErroDialogo("");
            setNovo({ ...NOVO });
          }}
        >
          <Plus /> Novo acordo
        </Button>
      </PainelTopo>

      {falha && !acordos ? (
        <div className="p-4">
          <Aviso tom="erro" acao={<Button size="sm" variant="outline" className="-my-1" onClick={() => void carregar()}>Tentar de novo</Button>}>
            {falha}
          </Aviso>
        </div>
      ) : !acordos ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden /> Carregando os acordos
        </p>
      ) : !acordos.length ? (
        <Vazio icone={Handshake} titulo="Nenhum acordo neste processo">
          Inclua à mão ou aprove o acordo que a leitura dos autos encontrar.
        </Vazio>
      ) : (
        <ul className="divide-y divide-[#e6eef0]">
          {acordos.map((acordo) => (
            <CartaoDoAcordo key={acordo.id} acordo={acordo} hoje={hoje} onAbrir={() => setAberto(acordo.id)} onErro={onErro} />
          ))}
        </ul>
      )}

      {novo ? (
        <FormularioNovoAcordo
          formulario={novo}
          salvando={salvando}
          erro={erroDialogo}
          onMudar={(chave, valor) => setNovo((atual) => (atual ? { ...atual, [chave]: valor } : atual))}
          onFechar={() => setNovo(null)}
          onSalvar={() => void criar()}
        />
      ) : null}

      {emControle ? (
        <ControleDoAcordo
          acordo={emControle}
          hoje={hoje}
          onFechar={() => setAberto(null)}
          onAcordos={(lista, mensagem) => {
            setAcordos(lista);
            if (!lista.some((acordo) => acordo.id === aberto)) setAberto(null);
            onFeito(mensagem);
          }}
          onErro={onErro}
        />
      ) : null}
    </Painel>
  );
}

function BarraDeParcelas({ pagas, total }: { pagas: number; total: number }) {
  const percentual = total ? Math.round((pagas / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[#e6eef0]" role="progressbar" aria-valuenow={pagas} aria-valuemin={0} aria-valuemax={total} aria-label="Parcelas pagas">
        <div className={`h-full rounded-full ${percentual >= 100 ? "bg-emerald-500" : "bg-[#3e84a8]"}`} style={{ width: `${percentual}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {pagas} de {total} paga{total === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function Fonte({ item, onErro }: { item: { origem: string; documentoId: string | null; pagina: number | null }; onErro: (mensagem: string) => void }) {
  if (item.origem !== "autos" || !item.documentoId) return null;
  return (
    <button type="button" className="text-xs text-[#285f7a] underline-offset-2 hover:underline" onClick={() => void abrirAutos(item.documentoId!, item.pagina).catch((erro: unknown) => onErro(mensagemDeErro(erro)))}>
      <FileText className="mr-1 inline size-3" aria-hidden />
      autos{item.pagina ? `, p. ${item.pagina}` : ""}
    </button>
  );
}

function CartaoDoAcordo({ acordo, hoje, onAbrir, onErro }: { acordo: Acordo; hoje: string; onAbrir: () => void; onErro: (mensagem: string) => void }) {
  const resumo = resumoDoAcordo(acordo, hoje);
  const quando = acordo.homologadoEm ? `Homologado em ${formatarData(acordo.homologadoEm)}` : acordo.celebradoEm ? `Celebrado em ${formatarData(acordo.celebradoEm)}` : "Sem data";
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
      <Handshake className="mt-0.5 size-4 shrink-0 text-[#3e84a8]" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold tabular-nums text-[#10293a]">{formatarReal(acordo.valorTotal)}</p>
          <Selo tom={TOM_SITUACAO_ACORDO[resumo.situacao]}>{ROTULO_SITUACAO_ACORDO[resumo.situacao]}</Selo>
          <span className="text-xs text-muted-foreground">{acordo.posicao === "recebe" ? "o cliente recebe" : "o cliente paga"}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {quando}
          {acordo.multaPercentual ? ` · multa de ${acordo.multaPercentual.toLocaleString("pt-BR")}% no atraso` : ""}
          {acordo.situacao === "descumprido" && acordo.descumpridoEm ? ` · descumprido em ${formatarData(acordo.descumpridoEm)}` : ""} <Fonte item={acordo} onErro={onErro} />
        </p>
        <BarraDeParcelas pagas={resumo.pagas} total={resumo.parcelas} />
        <p className="text-xs tabular-nums text-muted-foreground">
          Pago {formatarReal(resumo.valorPago)} · saldo {formatarReal(resumo.saldo)}
          {resumo.proxima && resumo.situacao !== "cancelado" ? ` · próxima: ${rotuloDaParcela(resumo.proxima.numero).toLowerCase()}, ${formatarData(resumo.proxima.vencimento)}` : ""}
        </p>
        {resumo.vencidas && (resumo.situacao === "em_atraso" || resumo.situacao === "descumprido") ? (
          <p className="flex items-center gap-1 text-xs font-medium text-amber-700">
            <TriangleAlert className="size-3.5" aria-hidden /> {resumo.vencidas} parcela{resumo.vencidas === 1 ? "" : "s"} vencida{resumo.vencidas === 1 ? "" : "s"} sem pagamento, há {resumo.diasDeAtraso} dia{resumo.diasDeAtraso === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
      <Button size="sm" variant="outline" onClick={onAbrir}>
        <ListChecks /> Controlar parcelas
      </Button>
    </li>
  );
}

function FormularioNovoAcordo({
  formulario,
  salvando,
  erro,
  onMudar,
  onFechar,
  onSalvar,
}: {
  formulario: Formulario;
  salvando: boolean;
  erro: string;
  onMudar: (chave: string, valor: string) => void;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  // Prévia das parcelas pelo mesmo cálculo do servidor.
  const previa = useMemo(() => {
    const total = lerValor(formulario.valorTotal);
    if (!total || !Number.isFinite(total) || total <= 0) return { parcelas: [], problema: "" };
    try {
      return { parcelas: gerarParcelas(planoDoFormulario(corpo(formulario), total)), problema: "" };
    } catch (falha) {
      return { parcelas: [], problema: mensagemDeErro(falha) };
    }
  }, [formulario]);
  const soma = previa.parcelas.reduce((total, parcela) => total + Math.round(parcela.valor * 100), 0) / 100;
  const total = lerValor(formulario.valorTotal);
  const naoFecha = previa.parcelas.length > 0 && total !== null && Number.isFinite(total) && Math.abs(soma - total) >= 0.01;
  const texto = (chave: string, rotulo: string, opcoes: { valor?: boolean; largo?: boolean; dica?: string } = {}) => (
    <Campo rotulo={rotulo} dica={opcoes.dica} className={opcoes.largo ? "sm:col-span-2" : undefined}>
      <Input value={formulario[chave] ?? ""} onChange={(evento) => onMudar(chave, evento.target.value)} inputMode={opcoes.valor ? "decimal" : undefined} placeholder={opcoes.valor ? "0,00" : undefined} />
    </Campo>
  );
  const data = (chave: string, rotulo: string) => (
    <Campo rotulo={rotulo}>
      <CampoData valor={formulario[chave] ?? ""} onChange={(valor) => onMudar(chave, valor)} rotulo={rotulo} permitirVazio />
    </Campo>
  );
  return (
    <DialogoAcao
      aberto
      onFechar={onFechar}
      ocupado={salvando}
      icone={Handshake}
      titulo="Novo acordo"
      descricao="As parcelas são geradas pelo plano abaixo e podem ser ajustadas uma a uma depois, no controle de parcelas."
      className="sm:max-w-3xl"
      aviso={!previa.parcelas.length ? "Informe o valor total e as parcelas (ou a entrada, se for pagamento único)." : naoFecha ? `As parcelas somam ${formatarReal(soma)}, diferente do total.` : undefined}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={onSalvar} disabled={salvando || !previa.parcelas.length}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null} Incluir acordo
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Quem paga *">
          <Seletor valor={formulario.posicao} onChange={(valor) => onMudar("posicao", valor)} opcoes={POSICOES} rotulo="Quem paga" />
        </Campo>
        {texto("valorTotal", "Valor total (R$) *", { valor: true })}
        {data("celebradoEm", "Celebrado em")}
        {data("homologadoEm", "Homologado em")}
        {texto("entradaValor", "Entrada ou pagamento único (R$)", { valor: true })}
        {data("entradaVencimento", "Vencimento da entrada")}
        {texto("quantidade", "Número de parcelas (sem a entrada)", { dica: "0 quando é pagamento único." })}
        {texto("valorParcela", "Valor de cada parcela (R$)", { valor: true, dica: "Vazio: o saldo dividido igual." })}
        {data("primeiroVencimento", "Vencimento da 1ª parcela")}
        <Campo rotulo="Periodicidade">
          <Seletor valor={formulario.periodicidade} onChange={(valor) => onMudar("periodicidade", valor)} opcoes={PERIODICIDADES} rotulo="Periodicidade" />
        </Campo>
        {texto("multaPercentual", "Multa por atraso (%)")}
        <Campo rotulo="Condições e observações" className="sm:col-span-2">
          <Textarea value={formulario.observacao ?? ""} onChange={(evento) => onMudar("observacao", evento.target.value)} rows={2} />
        </Campo>
      </div>
      {previa.problema ? <Aviso tom="alerta">{previa.problema}</Aviso> : null}
      {previa.parcelas.length ? (
        <div className="max-h-48 overflow-y-auto rounded-md border border-[#e6eef0]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#f7fbfc] text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Parcela</th>
                <th className="px-3 py-1.5 text-left font-medium">Vencimento</th>
                <th className="px-3 py-1.5 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6eef0] tabular-nums">
              {previa.parcelas.map((parcela) => (
                <tr key={parcela.numero}>
                  <td className="px-3 py-1">{rotuloDaParcela(parcela.numero)}</td>
                  <td className="px-3 py-1">{formatarData(parcela.vencimento)}</td>
                  <td className="px-3 py-1 text-right">{formatarReal(parcela.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </DialogoAcao>
  );
}

type Acao =
  | { tipo: "pagar"; parcela: Parcela; formulario: Formulario }
  | { tipo: "parcela"; parcela: Parcela | null; formulario: Formulario }
  | { tipo: "excluirParcela"; parcela: Parcela }
  | { tipo: "dados"; formulario: Formulario }
  | { tipo: "descumprir"; formulario: Formulario }
  | { tipo: "excluir" };

function situacaoDaParcela(parcela: Parcela, hoje: string): { rotulo: string; tom: TomSelo } {
  if (parcela.pagoEm) return { rotulo: `Paga em ${formatarData(parcela.pagoEm)}`, tom: "sucesso" };
  if (parcela.vencimento < hoje) return { rotulo: "Vencida", tom: "perigo" };
  if (parcela.vencimento === hoje) return { rotulo: "Vence hoje", tom: "alerta" };
  return { rotulo: "Em aberto", tom: "neutro" };
}

/** Modal de controle de um acordo: as parcelas uma a uma e a situação do acordo. */
function ControleDoAcordo({
  acordo,
  hoje,
  onFechar,
  onAcordos,
  onErro,
}: {
  acordo: Acordo;
  hoje: string;
  onFechar: () => void;
  onAcordos: (acordos: Acordo[], mensagem: string) => void;
  onErro: (mensagem: string) => void;
}) {
  const [acao, setAcao] = useState<Acao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const resumo = resumoDoAcordo(acordo, hoje);

  async function executar(pedido: () => Promise<Resposta>, mensagem: string) {
    setOcupado(true);
    setErro("");
    try {
      const resposta = await pedido();
      setAcao(null);
      onAcordos(resposta.acordos, mensagem);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  const dadosDaParcela = (parcela: Parcela, mudancas: Formulario = {}) => ({
    vencimento: parcela.vencimento,
    valor: parcela.valor,
    pagoEm: parcela.pagoEm,
    valorPago: parcela.valorPago,
    observacao: parcela.observacao,
    ...corpo(mudancas),
  });

  function confirmar() {
    if (!acao) return;
    switch (acao.tipo) {
      case "pagar":
        return executar(
          () => processosApi.put(`/acordo-parcelas/${acao.parcela.id}`, { dados: dadosDaParcela(acao.parcela, acao.formulario) }),
          `${rotuloDaParcela(acao.parcela.numero)} marcada como paga.`
        );
      case "parcela":
        return acao.parcela
          ? executar(() => processosApi.put(`/acordo-parcelas/${acao.parcela!.id}`, { dados: corpo(acao.formulario) }), `${rotuloDaParcela(acao.parcela.numero)} salva.`)
          : executar(() => processosApi.post(`/acordos/${acordo.id}/parcelas`, { dados: corpo(acao.formulario) }), "Parcela incluída.");
      case "excluirParcela":
        return executar(() => processosApi.del(`/acordo-parcelas/${acao.parcela.id}`), `${rotuloDaParcela(acao.parcela.numero)} excluída.`);
      case "dados":
        return executar(() => processosApi.put(`/acordos/${acordo.id}`, { dados: corpo(acao.formulario) }), "Acordo salvo.");
      case "descumprir":
        return executar(() => processosApi.patch(`/acordos/${acordo.id}`, { dados: { situacao: "descumprido", data: acao.formulario.data || null } }), "Acordo marcado como descumprido.");
      case "excluir":
        return executar(() => processosApi.del(`/acordos/${acordo.id}`), "Acordo excluído.");
    }
  }

  const mudarSituacao = (situacao: "vigente" | "cancelado") =>
    void executar(() => processosApi.patch(`/acordos/${acordo.id}`, { dados: { situacao } }), situacao === "cancelado" ? "Acordo cancelado." : "Acordo de volta a vigente.");

  const mudar = (chave: string, valor: string) => setAcao((atual) => (atual && "formulario" in atual ? ({ ...atual, formulario: { ...atual.formulario, [chave]: valor } } as Acao) : atual));
  const parcelasNumeradas = acordo.parcelas.filter((parcela) => parcela.numero > 0).length;

  return (
    <DialogoAcao
      aberto
      onFechar={onFechar}
      ocupado={ocupado}
      icone={Handshake}
      titulo={`Acordo de ${formatarReal(acordo.valorTotal)}`}
      descricao={
        <span className="flex flex-wrap items-center gap-2">
          <Selo tom={TOM_SITUACAO_ACORDO[resumo.situacao]}>{ROTULO_SITUACAO_ACORDO[resumo.situacao]}</Selo>
          <span>
            {acordo.posicao === "recebe" ? "O cliente recebe" : "O cliente paga"} · pago {formatarReal(resumo.valorPago)} · saldo {formatarReal(resumo.saldo)}
          </span>
        </span>
      }
      className="sm:max-w-4xl"
      rodape={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setAcao({ tipo: "dados", formulario: formularioDoAcordo(acordo) })} disabled={ocupado}>
              <PencilLine /> Dados do acordo
            </Button>
            {acordo.situacao === "vigente" ? (
              <>
                <Button size="sm" variant="outline" className="text-red-700" onClick={() => setAcao({ tipo: "descumprir", formulario: { data: hoje } })} disabled={ocupado}>
                  <TriangleAlert /> Descumprido
                </Button>
                <Button size="sm" variant="outline" onClick={() => mudarSituacao("cancelado")} disabled={ocupado}>
                  <Ban /> Cancelar acordo
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => mudarSituacao("vigente")} disabled={ocupado}>
                <RotateCcw /> Voltar a vigente
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-red-700 hover:text-red-800" onClick={() => setAcao({ tipo: "excluir" })} disabled={ocupado}>
              <Trash2 /> Excluir
            </Button>
          </div>
          <Button onClick={onFechar} disabled={ocupado}>
            Fechar
          </Button>
        </div>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {resumo.vencidas && resumo.situacao === "em_atraso" ? (
        <Aviso tom="alerta">
          {resumo.vencidas} parcela{resumo.vencidas === 1 ? "" : "s"} vencida{resumo.vencidas === 1 ? "" : "s"} sem pagamento, a mais antiga há {resumo.diasDeAtraso} dia{resumo.diasDeAtraso === 1 ? "" : "s"}. Se o acordo foi descumprido, marque em “Descumprido” para voltar a cobrar o crédito.
        </Aviso>
      ) : null}
      {acordo.observacao ? <p className="whitespace-pre-wrap text-xs text-muted-foreground">{acordo.observacao}</p> : null}

      <div className="overflow-x-auto rounded-md border border-[#e6eef0]">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-[#f7fbfc] text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Parcela</th>
              <th className="px-3 py-2 text-left font-medium">Vencimento</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-left font-medium">Situação</th>
              <th className="px-3 py-2 text-right font-medium">Valor pago</th>
              <th className="px-3 py-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6eef0]">
            {acordo.parcelas.map((parcela) => {
              const situacao = situacaoDaParcela(parcela, hoje);
              return (
                <tr key={parcela.id}>
                  <td className="px-3 py-2">
                    {rotuloDaParcela(parcela.numero, parcelasNumeradas)}
                    {parcela.observacao ? <span className="block text-[11px] text-muted-foreground">{parcela.observacao}</span> : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatarData(parcela.vencimento)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatarReal(parcela.valor)}</td>
                  <td className="px-3 py-2">
                    <Selo tom={situacao.tom}>{situacao.rotulo}</Selo> <Fonte item={parcela} onErro={onErro} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{parcela.valorPago ? formatarReal(parcela.valorPago) : "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {parcela.pagoEm ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void executar(() => processosApi.put(`/acordo-parcelas/${parcela.id}`, { dados: { ...dadosDaParcela(parcela), pagoEm: null, valorPago: null } }), `${rotuloDaParcela(parcela.numero)}: pagamento desfeito.`)}
                          disabled={ocupado}
                        >
                          <Undo2 /> Desfazer
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setAcao({ tipo: "pagar", parcela, formulario: { pagoEm: hoje, valorPago: valorTexto(parcela.valor) } })} disabled={ocupado}>
                          <CheckCircle2 /> Paga
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`Editar ${rotuloDaParcela(parcela.numero).toLowerCase()}`}
                        onClick={() =>
                          setAcao({
                            tipo: "parcela",
                            parcela,
                            formulario: { vencimento: parcela.vencimento, valor: valorTexto(parcela.valor), pagoEm: parcela.pagoEm ?? "", valorPago: valorTexto(parcela.valorPago), observacao: parcela.observacao ?? "" },
                          })
                        }
                        disabled={ocupado}
                      >
                        <PencilLine />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-red-700 hover:text-red-800" aria-label={`Excluir ${rotuloDaParcela(parcela.numero).toLowerCase()}`} onClick={() => setAcao({ tipo: "excluirParcela", parcela })} disabled={ocupado}>
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <Button size="sm" variant="outline" onClick={() => setAcao({ tipo: "parcela", parcela: null, formulario: { vencimento: "", valor: "", pagoEm: "", valorPago: "", observacao: "" } })} disabled={ocupado}>
          <Plus /> Incluir parcela
        </Button>
      </div>

      {acao ? <SubAcao acao={acao} ocupado={ocupado} erro={erro} onMudar={mudar} onFechar={() => setAcao(null)} onConfirmar={() => void confirmar()} /> : null}
    </DialogoAcao>
  );
}

/** Os formulários curtos do controle: pagar, editar/incluir parcela, dados do acordo, descumprir e exclusões. */
function SubAcao({
  acao,
  ocupado,
  erro,
  onMudar,
  onFechar,
  onConfirmar,
}: {
  acao: Acao;
  ocupado: boolean;
  erro: string;
  onMudar: (chave: string, valor: string) => void;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  const formulario = "formulario" in acao ? acao.formulario : {};
  const valor = (chave: string, rotulo: string) => (
    <Campo rotulo={rotulo}>
      <Input value={formulario[chave] ?? ""} onChange={(evento) => onMudar(chave, evento.target.value)} inputMode="decimal" placeholder="0,00" />
    </Campo>
  );
  const data = (chave: string, rotulo: string, vazio = true) => (
    <Campo rotulo={rotulo}>
      <CampoData valor={formulario[chave] ?? ""} onChange={(novo) => onMudar(chave, novo)} rotulo={rotulo} permitirVazio={vazio} />
    </Campo>
  );
  const destrutiva = acao.tipo === "excluir" || acao.tipo === "excluirParcela";
  const titulo = {
    pagar: () => `Marcar ${acao.tipo === "pagar" ? rotuloDaParcela(acao.parcela.numero).toLowerCase() : ""} como paga`,
    parcela: () => (acao.tipo === "parcela" && acao.parcela ? `Editar ${rotuloDaParcela(acao.parcela.numero).toLowerCase()}` : "Incluir parcela"),
    excluirParcela: () => `Excluir ${acao.tipo === "excluirParcela" ? rotuloDaParcela(acao.parcela.numero).toLowerCase() : ""}`,
    dados: () => "Dados do acordo",
    descumprir: () => "Acordo descumprido",
    excluir: () => "Excluir o acordo",
  }[acao.tipo]();
  const descricao = {
    pagar: "A data e o valor que de fato foram pagos.",
    parcela: "Vencimento e valor; com a data de pagamento, a parcela fica paga.",
    excluirParcela: "A exclusão fica no histórico do processo.",
    dados: "As parcelas mudam no controle de parcelas.",
    descumprir: "O acordo deixa de valer e o crédito volta a ser cobrado. Fica no histórico do processo.",
    excluir: "Apaga o acordo e todas as parcelas. Use “Cancelar acordo” para guardar o histórico das parcelas.",
  }[acao.tipo];
  return (
    <DialogoAcao
      aberto
      onFechar={onFechar}
      ocupado={ocupado}
      icone={destrutiva ? Trash2 : acao.tipo === "descumprir" ? TriangleAlert : PencilLine}
      tom={destrutiva || acao.tipo === "descumprir" ? "perigo" : "marca"}
      titulo={titulo}
      descricao={descricao}
      className={acao.tipo === "dados" || acao.tipo === "parcela" ? "sm:max-w-2xl" : undefined}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={ocupado}>
            Voltar
          </Button>
          <Button variant={destrutiva ? "destructive" : "default"} onClick={onConfirmar} disabled={ocupado}>
            {ocupado ? <LoaderCircle className="animate-spin" /> : null} {destrutiva ? "Excluir" : acao.tipo === "descumprir" ? "Marcar descumprido" : "Salvar"}
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {acao.tipo === "pagar" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {data("pagoEm", "Pago em", false)}
          {valor("valorPago", "Valor pago (R$)")}
        </div>
      ) : acao.tipo === "parcela" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {data("vencimento", "Vencimento *", false)}
          {valor("valor", "Valor (R$) *")}
          {data("pagoEm", "Pago em")}
          {valor("valorPago", "Valor pago (R$)")}
          <Campo rotulo="Observação" className="sm:col-span-2">
            <Input value={formulario.observacao ?? ""} onChange={(evento) => onMudar("observacao", evento.target.value)} />
          </Campo>
        </div>
      ) : acao.tipo === "dados" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Quem paga *">
            <Seletor valor={formulario.posicao} onChange={(novo) => onMudar("posicao", novo)} opcoes={POSICOES} rotulo="Quem paga" />
          </Campo>
          {valor("valorTotal", "Valor total (R$) *")}
          {data("celebradoEm", "Celebrado em")}
          {data("homologadoEm", "Homologado em")}
          <Campo rotulo="Multa por atraso (%)">
            <Input value={formulario.multaPercentual ?? ""} onChange={(evento) => onMudar("multaPercentual", evento.target.value)} inputMode="decimal" />
          </Campo>
          <Campo rotulo="Condições e observações" className="sm:col-span-2">
            <Textarea value={formulario.observacao ?? ""} onChange={(evento) => onMudar("observacao", evento.target.value)} rows={2} />
          </Campo>
        </div>
      ) : acao.tipo === "descumprir" ? (
        data("data", "Descumprido em", false)
      ) : (
        <span />
      )}
    </DialogoAcao>
  );
}
