import "server-only";

import {
  POSICOES,
  SITUACOES_DECLARADAS,
  colunasDaParcela,
  colunasDoAcordo,
  descreverAcordo,
  gerarParcelas,
  planoDoFormulario,
  rotuloDaParcela,
  type Acordo,
  type PosicaoAcordo,
} from "./acordos";
import { ProcessosError } from "./errors";
import { registrarNoHistorico } from "./processos-server";
import { dataObrigatoria, formatarData, formatarReal, umaDas } from "./rec-credito";
import { db, falhou, type Ator } from "./server";
import { COLUNAS_ACORDO, COLUNAS_PARCELA, carregarAcordos, texto, type Linha } from "./acordos-dados";

export { acordosPorProcesso, carregarAcordos } from "./acordos-dados";

const ROTULO_HISTORICO = "Acordo";

async function acordoExistente(acordoId: string): Promise<Linha> {
  const { data, error } = await db().from("proc_acordos").select(COLUNAS_ACORDO).eq("id", acordoId).maybeSingle();
  if (error) falhou("carregar o acordo", error);
  if (!data) throw new ProcessosError("Acordo não encontrado.", 404);
  return data as unknown as Linha;
}

async function parcelaExistente(parcelaId: string): Promise<Linha> {
  const { data, error } = await db().from("proc_acordo_parcelas").select(COLUNAS_PARCELA).eq("id", parcelaId).maybeSingle();
  if (error) falhou("carregar a parcela", error);
  if (!data) throw new ProcessosError("Parcela não encontrada.", 404);
  return data as unknown as Linha;
}

const historico = (processoId: string, texto: string, ator: Ator, ia = false) => registrarNoHistorico(processoId, ROTULO_HISTORICO, null, texto, ator, ia ? "ia" : "manual");

/**
 * Acordo novo com as parcelas geradas pelo plano (entrada, quantidade, primeiro vencimento, periodicidade).
 * `dosAutos`: veio de uma sugestão da leitura aprovada (documento e página de onde saiu).
 */
export async function criarAcordo(
  processoId: string,
  dados: Record<string, unknown>,
  ator: Ator,
  dosAutos?: { documentoId: string | null; pagina: number | null }
): Promise<Acordo[]> {
  const colunas = colunasDoAcordo(dados);
  const plano = gerarParcelas(planoDoFormulario(dados, colunas.valor_total as number));
  const { data: processo, error: erroProcesso } = await db().from("proc_processos").select("id").eq("id", processoId).maybeSingle();
  if (erroProcesso) falhou("carregar o processo", erroProcesso);
  if (!processo) throw new ProcessosError("Processo não encontrado.", 404);
  const origem = { origem: dosAutos ? "autos" : "manual", documento_id: dosAutos?.documentoId ?? null, pagina: dosAutos?.pagina ?? null };
  const { data: criado, error } = await db()
    .from("proc_acordos")
    .insert({ processo_id: processoId, ...colunas, ...origem, criado_por: ator.authUserId, criado_por_nome: ator.nome })
    .select("id")
    .single();
  if (error || !criado) falhou("incluir o acordo", error);
  const acordoId = (criado as Linha).id as string;
  if (plano.length) {
    const { error: erroParcelas } = await db()
      .from("proc_acordo_parcelas")
      .insert(plano.map((parcela) => ({ acordo_id: acordoId, processo_id: processoId, ...parcela, ...origem })));
    if (erroParcelas) {
      await db().from("proc_acordos").delete().eq("id", acordoId);
      falhou("incluir as parcelas do acordo", erroParcelas);
    }
  }
  const descricao = descreverAcordo(
    { valorTotal: colunas.valor_total as number, celebradoEm: colunas.celebrado_em as string | null, homologadoEm: colunas.homologado_em as string | null, posicao: colunas.posicao as PosicaoAcordo },
    plano.length
  );
  await historico(processoId, `Incluído: ${descricao}`, ator, Boolean(dosAutos));
  return carregarAcordos(processoId);
}

/** Dados do acordo (as parcelas mudam pelo controle de parcelas). */
export async function alterarAcordo(acordoId: string, dados: Record<string, unknown>, ator: Ator): Promise<Acordo[]> {
  const atual = await acordoExistente(acordoId);
  const colunas = colunasDoAcordo(dados);
  const { error } = await db().from("proc_acordos").update({ ...colunas, updated_at: new Date().toISOString() }).eq("id", acordoId);
  if (error) falhou("salvar o acordo", error);
  const processoId = atual.processo_id as string;
  const posicao = POSICOES.find((item) => item.valor === colunas.posicao)?.rotulo.toLowerCase();
  await historico(processoId, `Alterado: acordo de ${formatarReal(colunas.valor_total as number)}, ${posicao}`, ator);
  return carregarAcordos(processoId);
}

/** Declara o acordo descumprido (com a data), cancelado ou de volta a vigente. */
export async function mudarSituacaoDoAcordo(acordoId: string, dados: Record<string, unknown>, ator: Ator, ia = false): Promise<Acordo[]> {
  const atual = await acordoExistente(acordoId);
  const situacao = umaDas(dados.situacao, SITUACOES_DECLARADAS, "a situação do acordo");
  const descumpridoEm = situacao === "descumprido" ? dataObrigatoria(dados.data, "a data do descumprimento") : null;
  const { error } = await db().from("proc_acordos").update({ situacao, descumprido_em: descumpridoEm, updated_at: new Date().toISOString() }).eq("id", acordoId);
  if (error) falhou("mudar a situação do acordo", error);
  const processoId = atual.processo_id as string;
  const rotulo = SITUACOES_DECLARADAS.find((item) => item.valor === situacao)?.rotulo ?? situacao;
  await historico(processoId, `Acordo de ${formatarReal(Number(atual.valor_total))}: ${rotulo.toLowerCase()}${descumpridoEm ? ` em ${formatarData(descumpridoEm)}` : ""}`, ator, ia);
  return carregarAcordos(processoId);
}

export async function excluirAcordo(acordoId: string, ator: Ator): Promise<Acordo[]> {
  const atual = await acordoExistente(acordoId);
  const { error } = await db().from("proc_acordos").delete().eq("id", acordoId);
  if (error) falhou("excluir o acordo", error);
  const processoId = atual.processo_id as string;
  await historico(processoId, `Excluído: acordo de ${formatarReal(Number(atual.valor_total))}`, ator);
  return carregarAcordos(processoId);
}

/** Parcela nova no fim do acordo (o número seguinte ao maior). */
export async function incluirParcela(acordoId: string, dados: Record<string, unknown>, ator: Ator): Promise<Acordo[]> {
  const acordo = await acordoExistente(acordoId);
  const colunas = colunasDaParcela(dados);
  const { data: ultimas, error: erroUltima } = await db().from("proc_acordo_parcelas").select("numero").eq("acordo_id", acordoId).order("numero", { ascending: false }).limit(1);
  if (erroUltima) falhou("carregar as parcelas", erroUltima);
  const proximo = ultimas?.length ? Number(ultimas[0].numero) + 1 : 1;
  const processoId = acordo.processo_id as string;
  const { error } = await db().from("proc_acordo_parcelas").insert({ acordo_id: acordoId, processo_id: processoId, numero: proximo, ...colunas });
  if (error) falhou("incluir a parcela", error);
  await historico(processoId, `Parcela ${proximo} incluída: ${formatarReal(colunas.valor as number)}, vencimento ${formatarData(colunas.vencimento as string)}`, ator);
  return carregarAcordos(processoId);
}

/** Vencimento, valor, pagamento e observação da parcela (o formulário manda tudo). */
export async function alterarParcela(parcelaId: string, dados: Record<string, unknown>, ator: Ator): Promise<Acordo[]> {
  const atual = await parcelaExistente(parcelaId);
  const colunas = colunasDaParcela(dados);
  const { error } = await db().from("proc_acordo_parcelas").update({ ...colunas, updated_at: new Date().toISOString() }).eq("id", parcelaId);
  if (error) falhou("salvar a parcela", error);
  const processoId = atual.processo_id as string;
  const rotulo = rotuloDaParcela(Number(atual.numero));
  const antes = texto(atual.pago_em);
  const agora = colunas.pago_em as string | null;
  const mudanca =
    agora && !antes
      ? `${rotulo} paga em ${formatarData(agora)}: ${formatarReal(colunas.valor_pago as number)}`
      : !agora && antes
        ? `${rotulo}: pagamento desfeito`
        : `${rotulo} alterada: ${formatarReal(colunas.valor as number)}, vencimento ${formatarData(colunas.vencimento as string)}${agora ? `, paga em ${formatarData(agora)}` : ""}`;
  await historico(processoId, mudanca, ator);
  return carregarAcordos(processoId);
}

export async function excluirParcela(parcelaId: string, ator: Ator): Promise<Acordo[]> {
  const atual = await parcelaExistente(parcelaId);
  const { error } = await db().from("proc_acordo_parcelas").delete().eq("id", parcelaId);
  if (error) falhou("excluir a parcela", error);
  const processoId = atual.processo_id as string;
  await historico(processoId, `${rotuloDaParcela(Number(atual.numero))} excluída (${formatarReal(Number(atual.valor))})`, ator);
  return carregarAcordos(processoId);
}

/* ---------------------------------------------- sugestões da leitura */

/** O acordo a que um pagamento ou descumprimento lido nos autos se refere: o mais recente que não foi cancelado. */
async function acordoAlvo(processoId: string): Promise<Acordo> {
  const acordos = (await carregarAcordos(processoId)).filter((acordo) => acordo.situacao !== "cancelado");
  const alvo = acordos.sort((a, b) => (b.homologadoEm ?? b.celebradoEm ?? "").localeCompare(a.homologadoEm ?? a.celebradoEm ?? ""))[0];
  if (!alvo) throw new ProcessosError("O processo ainda não tem acordo na ficha: aprove (ou inclua) o acordo antes do pagamento.", 409);
  return alvo;
}

/**
 * Pagamento lido nos autos: marca paga a parcela do número informado; sem número, a primeira em aberto (a de
 * vencimento mais antigo). Sem parcela em aberto, inclui uma parcela já paga.
 */
export async function registrarPagamentoLido(
  processoId: string,
  dados: Record<string, unknown>,
  ator: Ator,
  dosAutos: { documentoId: string | null; pagina: number | null }
): Promise<Acordo[]> {
  const acordo = await acordoAlvo(processoId);
  const pagoEm = dataObrigatoria(dados.data, "a data do pagamento");
  const valor = Number(dados.valor);
  if (!(valor > 0)) throw new ProcessosError("Informe o valor pago.", 400);
  const numeroLido = dados.parcelaNumero === null || dados.parcelaNumero === undefined || dados.parcelaNumero === "" ? null : Number(dados.parcelaNumero);
  const abertas = acordo.parcelas.filter((parcela) => !parcela.pagoEm).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const alvo = (numeroLido !== null ? abertas.find((parcela) => parcela.numero === numeroLido) : null) ?? abertas[0];
  const origem = { origem: "autos", documento_id: dosAutos.documentoId, pagina: dosAutos.pagina };
  if (alvo) {
    const { error } = await db()
      .from("proc_acordo_parcelas")
      .update({ pago_em: pagoEm, valor_pago: Math.round(valor * 100) / 100, ...origem, updated_at: new Date().toISOString() })
      .eq("id", alvo.id);
    if (error) falhou("registrar o pagamento", error);
    await historico(processoId, `${rotuloDaParcela(alvo.numero)} paga em ${formatarData(pagoEm)}: ${formatarReal(valor)}`, ator, true);
  } else {
    const proximo = Math.max(0, ...acordo.parcelas.map((parcela) => parcela.numero)) + 1;
    const { error } = await db()
      .from("proc_acordo_parcelas")
      .insert({ acordo_id: acordo.id, processo_id: processoId, numero: proximo, vencimento: pagoEm, valor, pago_em: pagoEm, valor_pago: valor, ...origem });
    if (error) falhou("registrar o pagamento", error);
    await historico(processoId, `Pagamento do acordo em ${formatarData(pagoEm)}: ${formatarReal(valor)} (parcela ${proximo} incluída)`, ator, true);
  }
  return carregarAcordos(processoId);
}

/** Descumprimento lido nos autos: o acordo vigente mais recente passa a descumprido na data lida. */
export async function registrarDescumprimentoLido(processoId: string, dados: Record<string, unknown>, ator: Ator): Promise<Acordo[]> {
  const acordo = await acordoAlvo(processoId);
  return mudarSituacaoDoAcordo(acordo.id, { situacao: "descumprido", data: dados.data }, ator, true);
}
