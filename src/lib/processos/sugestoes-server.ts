import "server-only";

import type { AcordoSugerido } from "./acordos-leitura";
import { criarAcordo, registrarDescumprimentoLido, registrarPagamentoLido } from "./acordos-server";
import { COLUNAS_SUGESTAO, carregarAutos, descartarSeConcluido, paraSugestao } from "./autos-server";
import type { AutosDoProcesso, PessoaSugerida, Sugestao, ValorDeCampo } from "./autos-types";
import { ProcessosError } from "./errors";
import { criarParte, salvarParte } from "./partes-server";
import { atualizarProcesso, detalharProcesso } from "./processos-server";
import type { ItemSugerido } from "./rec-credito-leitura";
import { incluirItem } from "./rec-credito-server";
import type { ItemTrabalhistaSugerido } from "./trabalhista-leitura";
import { alterarItemTrabalhista, incluirItemTrabalhista } from "./trabalhista-server";
import { db, falhou, type Ator } from "./server";
import { aplicarNaParte, entradaDaPessoa } from "./sugestoes";
import { campoPorChave, textoDoValor } from "./campos";
import type { OrigemAlteracao, ProcessoDetalhe } from "./types";

/** No histórico: "ia" para o que veio dos autos; "datajud", "jusbr" ou "cnj" para a capa das fontes oficiais. */
function origemDaSugestao(sugestao: Sugestao): OrigemAlteracao {
  return sugestao.fonte === "datajud" || sugestao.fonte === "cnj" || sugestao.fonte === "jusbr" ? sugestao.fonte : "ia";
}

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
 * com a fonte dela como origem no histórico. `editado` é o que a pessoa ajustou antes de aprovar: o valor
 * do campo ou a parte inteira. Os campos `junto` (a data do último andamento) vão na mesma gravação.
 */
async function gravar(sugestao: Sugestao & { processoId: string }, editado: { valor?: unknown; parte?: unknown }, ator: Ator): Promise<{ processo: ProcessoDetalhe; gravado: unknown }> {
  const { processoId } = sugestao;
  if (sugestao.tipo === "campo") {
    const proposto = sugestao.valor as ValorDeCampo;
    const valor = editado.valor !== undefined ? editado.valor : proposto.valor;
    if (valor === null || valor === "") throw new ProcessosError("Informe o valor a gravar ou recuse a sugestão.", 400);
    const campos = { ...(proposto.junto ?? {}), [sugestao.campo as string]: valor };
    return { processo: await atualizarProcesso(processoId, campos, ator, origemDaSugestao(sugestao)), gravado: { valor, ...(proposto.junto ? { junto: proposto.junto } : {}) } };
  }
  if (sugestao.tipo === "rec_credito") {
    const proposto = sugestao.valor as ItemSugerido;
    const dados = editado.valor && typeof editado.valor === "object" && !Array.isArray(editado.valor) ? (editado.valor as Record<string, unknown>) : proposto.dados;
    await incluirItem(processoId, proposto.item, dados, ator, { documentoId: sugestao.documentoId, pagina: sugestao.pagina });
    return { processo: await detalharProcesso(processoId), gravado: dados };
  }
  if (sugestao.tipo === "acordo") {
    const proposto = sugestao.valor as AcordoSugerido;
    const dados = editado.valor && typeof editado.valor === "object" && !Array.isArray(editado.valor) ? (editado.valor as Record<string, unknown>) : proposto.dados;
    const dosAutos = { documentoId: sugestao.documentoId, pagina: sugestao.pagina };
    if (proposto.item === "acordo") await criarAcordo(processoId, dados, ator, dosAutos);
    else if (proposto.item === "pagamento") await registrarPagamentoLido(processoId, dados, ator, dosAutos);
    else await registrarDescumprimentoLido(processoId, dados, ator);
    return { processo: await detalharProcesso(processoId), gravado: dados };
  }
  if (sugestao.tipo === "trabalhista") {
    const proposto = sugestao.valor as ItemTrabalhistaSugerido;
    const dados = editado.valor && typeof editado.valor === "object" && !Array.isArray(editado.valor) ? (editado.valor as Record<string, unknown>) : proposto.dados;
    // Pedido que já está na ficha: a sugestão completa o que faltava nele (valor, resultado de uma decisão).
    if (proposto.item === "pedido" && proposto.existenteId) await alterarItemTrabalhista("pedido", proposto.existenteId, dados, ator);
    else await incluirItemTrabalhista(processoId, proposto.item, dados, ator, { documentoId: sugestao.documentoId, pagina: sugestao.pagina });
    return { processo: await detalharProcesso(processoId), gravado: dados };
  }
  const atual = await detalharProcesso(processoId);
  if (sugestao.tipo === "parte_nova") {
    const entrada = editado.parte ?? entradaDaPessoa(sugestao.valor as PessoaSugerida, atual.partes);
    return { processo: await criarParte(processoId, entrada, ator, "ia", `Incluída pela sugestão: ${sugestao.resumo}`), gravado: entrada };
  }
  const parte = atual.partes.find((item) => item.id === sugestao.parteId);
  if (!parte) throw new ProcessosError("A parte desta sugestão não está mais no processo. Recuse a sugestão.", 409);
  const entrada = editado.parte ?? aplicarNaParte(parte, sugestao.tipo, sugestao.valor);
  return { processo: await salvarParte(parte.id, entrada, ator, "ia", sugestao.resumo), gravado: entrada };
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
  // Era a última sugestão a conferir neste PDF: ele sai do armazenamento (ficam a página e o trecho).
  if (sugestao.documentoId) await descartarSeConcluido(sugestao.documentoId);
  return { processo, autos: await carregarAutos(sugestao.processoId) };
}

/**
 * Tira da fila as sugestões pendentes que o cadastro já tem (o mesmo valor chegou depois por outra via, como a
 * importação do VIOS): campo com o mesmo valor, CPF/CNPJ ou OAB de parte que já tem o mesmo número.
 */
export async function limparSugestoesJaNoCadastro(processoId: string): Promise<number> {
  const { data, error } = await db().from("proc_sugestoes").select("id, tipo, campo, parte_id, valor").eq("processo_id", processoId).eq("situacao", "pendente").in("tipo", ["campo", "parte_documento", "parte_oab"]);
  if (error) falhou("carregar as sugestões", error);
  if (!data?.length) return 0;
  const processo = await detalharProcesso(processoId);
  const digitos = (texto: unknown) => String(texto ?? "").replace(/\D/g, "");
  const iguais = data.filter((sugestao) => {
    if (sugestao.tipo === "campo" && sugestao.campo) {
      const item = campoPorChave(sugestao.campo as string);
      const proposto = (sugestao.valor as ValorDeCampo).valor;
      const atual = processo.valores[sugestao.campo as string];
      return Boolean(item) && textoDoValor(item, atual) !== "" && textoDoValor(item, atual) === textoDoValor(item, proposto);
    }
    const parte = processo.partes.find((item) => item.id === sugestao.parte_id);
    if (!parte) return false;
    if (sugestao.tipo === "parte_documento") return digitos(parte.documento) !== "" && digitos(parte.documento) === digitos((sugestao.valor as { documento: string }).documento);
    return digitos(parte.oab) !== "" && digitos(parte.oab) === digitos((sugestao.valor as { oab: string }).oab);
  });
  if (!iguais.length) return 0;
  const { error: erro } = await db().from("proc_sugestoes").delete().in("id", iguais.map((item) => item.id as string)).eq("situacao", "pendente");
  if (erro) falhou("tirar as sugestões que o cadastro já tem", erro);
  return iguais.length;
}
