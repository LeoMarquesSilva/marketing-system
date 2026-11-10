import "server-only";

import { COLUNAS_SUGESTAO, carregarAutos, paraSugestao } from "./autos-server";
import type { AutosDoProcesso, PessoaSugerida, Sugestao } from "./autos-types";
import { ProcessosError } from "./errors";
import { criarParte, salvarParte } from "./partes-server";
import { atualizarProcesso, detalharProcesso } from "./processos-server";
import { db, falhou, type Ator } from "./server";
import { aplicarNaParte, entradaDaPessoa } from "./sugestoes";
import type { ProcessoDetalhe } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function carregarSugestao(id: string): Promise<Sugestao & { processoId: string }> {
  if (!UUID.test(id)) throw new ProcessosError("Sugestão não encontrada.", 404);
  const { data, error } = await db().from("proc_sugestoes").select(COLUNAS_SUGESTAO).eq("id", id).maybeSingle();
  if (error) falhou("carregar a sugestão", error);
  if (!data) throw new ProcessosError("Sugestão não encontrada.", 404);
  return { ...paraSugestao(data as Record<string, unknown>), processoId: data.processo_id as string };
}

/**
 * Grava a sugestão no cadastro pelo mesmo caminho da tela (atualizarProcesso, criarParte, salvarParte),
 * com origem "ia" no histórico. `editado` é o que a pessoa ajustou antes de aprovar: o valor do campo
 * ou a parte inteira.
 */
async function gravar(sugestao: Sugestao & { processoId: string }, editado: { valor?: unknown; parte?: unknown }, ator: Ator): Promise<{ processo: ProcessoDetalhe; gravado: unknown }> {
  const { processoId } = sugestao;
  if (sugestao.tipo === "campo") {
    const valor = editado.valor !== undefined ? editado.valor : (sugestao.valor as { valor: string | number }).valor;
    if (valor === null || valor === "") throw new ProcessosError("Informe o valor a gravar ou recuse a sugestão.", 400);
    return { processo: await atualizarProcesso(processoId, { [sugestao.campo as string]: valor }, ator, "ia"), gravado: { valor } };
  }
  const atual = await detalharProcesso(processoId);
  if (sugestao.tipo === "parte_nova") {
    const entrada = editado.parte ?? entradaDaPessoa(sugestao.valor as PessoaSugerida, atual.partes);
    return { processo: await criarParte(processoId, entrada, ator, "ia"), gravado: entrada };
  }
  const parte = atual.partes.find((item) => item.id === sugestao.parteId);
  if (!parte) throw new ProcessosError("A parte desta sugestão não está mais no processo. Recuse a sugestão.", 409);
  const entrada = editado.parte ?? aplicarNaParte(parte, sugestao.tipo, sugestao.valor);
  return { processo: await salvarParte(parte.id, entrada, ator, "ia"), gravado: entrada };
}

/**
 * A decisão da pessoa sobre uma sugestão da IA: aprovar (como veio ou editada) ou recusar.
 * É o único ponto em que algo lido pela IA chega ao cadastro.
 */
export async function decidirSugestao(id: string, entrada: Record<string, unknown>, ator: Ator): Promise<{ processo: ProcessoDetalhe; autos: AutosDoProcesso }> {
  const sugestao = await carregarSugestao(id);
  if (sugestao.situacao !== "pendente") throw new ProcessosError("Esta sugestão já foi decidida.", 409);
  const acao = entrada.acao;
  if (acao !== "aprovar" && acao !== "recusar") throw new ProcessosError("Ação desconhecida para a sugestão.", 400);

  // Marca primeiro, com a condição "ainda pendente": dois cliques não gravam duas vezes.
  const decisao = { decidido_por: ator.authUserId, decidido_por_nome: ator.nome, decidido_em: new Date().toISOString() };
  const { data: marcada, error: erroMarcar } = await db()
    .from("proc_sugestoes")
    .update({ situacao: acao === "aprovar" ? "aprovada" : "recusada", ...decisao })
    .eq("id", id)
    .eq("situacao", "pendente")
    .select("id");
  if (erroMarcar) falhou("registrar a decisão", erroMarcar);
  if (!marcada?.length) throw new ProcessosError("Esta sugestão já foi decidida.", 409);

  let processo: ProcessoDetalhe;
  if (acao === "aprovar") {
    try {
      const resultado = await gravar(sugestao, { valor: entrada.valor, parte: entrada.parte }, ator);
      processo = resultado.processo;
      const { error } = await db().from("proc_sugestoes").update({ valor_gravado: resultado.gravado }).eq("id", id);
      if (error) console.error("[processos] registrar o valor gravado da sugestão:", error.message);
    } catch (erro) {
      // A gravação não aconteceu: a sugestão volta a ficar pendente.
      await db().from("proc_sugestoes").update({ situacao: "pendente", decidido_por: null, decidido_por_nome: null, decidido_em: null }).eq("id", id);
      throw erro;
    }
  } else {
    processo = await detalharProcesso(sugestao.processoId);
  }
  return { processo, autos: await carregarAutos(sugestao.processoId) };
}
