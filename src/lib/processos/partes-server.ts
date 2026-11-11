import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ProcessosError } from "./errors";
import { chaveNome, tipoPeloDocumento } from "./pessoas";
import { acrescentarEnderecosEContatos, buscarPorDocumento, esquemaContatos, esquemaEnderecos, gravarEnderecosEContatos, registrarVinculo, unificarPessoas } from "./pessoas-server";
import { detalharProcesso, registrarNoHistorico } from "./processos-server";
import { db, falhou, type Ator } from "./server";
import { PAPEIS, POLOS, rotuloDoPapel, type ParteEntrada, type ProcessoDetalhe } from "./types";

const textoOpcional = z
  .string()
  .max(2000)
  .nullish()
  .transform((valor) => valor?.trim() || null);

const esquemaParte = z.object({
  pessoaId: z.string().uuid().nullish().transform((valor) => valor ?? null),
  polo: z.enum(POLOS.map((item) => item.valor) as [string, ...string[]]),
  papel: z.enum(PAPEIS.map((item) => item.valor) as [string, ...string[]]),
  vinculo: textoOpcional,
  devedor: z.boolean().default(false),
  referenteA: z.string().uuid().nullish().transform((valor) => valor ?? null),
  nome: z.string().trim().min(2, "Informe o nome.").max(300),
  documento: textoOpcional,
  oab: textoOpcional,
  observacao: textoOpcional,
  enderecos: esquemaEnderecos,
  contatos: esquemaContatos,
});

function validar(entrada: unknown): ParteEntrada {
  const lido = esquemaParte.safeParse(entrada);
  if (!lido.success) throw new ProcessosError(lido.error.issues[0]?.message ?? "Dados da parte inválidos.", 400);
  // Só a parte pode ser o devedor; sócio, fiador e advogado se ligam a ela.
  return { ...lido.data, devedor: lido.data.papel === "parte" && lido.data.devedor } as ParteEntrada;
}

/** A parte de referência (de quem esta pessoa é sócia, fiadora, advogada) tem de ser do mesmo processo. Devolve a pessoa dela. */
async function conferirReferencia(processoId: string, referenteA: string | null, propriaParte?: string): Promise<string | null> {
  if (!referenteA) return null;
  if (referenteA === propriaParte) throw new ProcessosError("A parte não pode se referir a ela mesma.", 400);
  const { data, error } = await db().from("proc_partes").select("id, pessoa_id").eq("id", referenteA).eq("processo_id", processoId).maybeSingle();
  if (error) falhou("conferir a parte de referência", error);
  if (!data) throw new ProcessosError("A parte de referência não é deste processo.", 400);
  return data.pessoa_id as string;
}

/** O que se sabe da pessoa pela tela da parte: preenche só o que ainda está vazio no cadastro. */
async function completarPessoa(pessoaId: string, dados: ParteEntrada): Promise<void> {
  const { data, error } = await db().from("proc_pessoas").select("documento, oab, observacao, tipo").eq("id", pessoaId).maybeSingle();
  if (error) falhou("carregar a pessoa", error);
  if (!data) throw new ProcessosError("A pessoa escolhida não existe mais.", 404);
  const patch: Record<string, unknown> = {};
  if (!data.documento && dados.documento) patch.documento = dados.documento;
  if (!data.oab && dados.oab) patch.oab = dados.oab;
  if (!data.observacao && dados.observacao) patch.observacao = dados.observacao;
  if (!data.tipo && tipoPeloDocumento(dados.documento)) patch.tipo = tipoPeloDocumento(dados.documento);
  if (Object.keys(patch).length) {
    const { error: erroPatch } = await db().from("proc_pessoas").update(patch).eq("id", pessoaId);
    if (erroPatch) falhou("completar a pessoa", erroPatch);
  }
  await acrescentarEnderecosEContatos(pessoaId, dados);
}

/**
 * Inclui alguém no processo. A pessoa é reaproveitada quando a tela indicou uma já cadastrada
 * (`pessoaId`) ou quando o CPF/CNPJ bate com o de alguém do cadastro; só então, sem nenhuma das duas,
 * nasce uma pessoa nova. É o que mantém o cadastro de pessoas sem repetição.
 */
export async function criarParte(processoId: string, entrada: unknown, ator: Ator): Promise<ProcessoDetalhe> {
  const dados = validar(entrada);
  // Confere o processo (404 se não existir) antes de mexer em pessoas.
  await detalharProcesso(processoId);
  const pessoaDeReferencia = await conferirReferencia(processoId, dados.referenteA);

  const existente = dados.pessoaId ?? (await buscarPorDocumento(dados.documento))?.id ?? null;
  let pessoaId = existente;
  if (existente) {
    await completarPessoa(existente, dados);
  } else {
    pessoaId = randomUUID();
    const { error } = await db()
      .from("proc_pessoas")
      .insert({ id: pessoaId, nome: dados.nome, nome_chave: chaveNome(dados.nome), documento: dados.documento, tipo: tipoPeloDocumento(dados.documento), oab: dados.oab, observacao: dados.observacao, origem: "manual" });
    if (error) falhou("salvar a pessoa", error);
  }
  const { error: erroParte } = await db()
    .from("proc_partes")
    .insert({
      processo_id: processoId,
      pessoa_id: pessoaId,
      polo: dados.polo,
      papel: dados.papel,
      vinculo: dados.vinculo,
      devedor: dados.devedor,
      referente_a: dados.referenteA,
      origem: "manual",
      ordem: Math.floor(Date.now() / 1000),
    });
  if (erroParte) {
    if (!existente) await db().from("proc_pessoas").delete().eq("id", pessoaId as string);
    falhou("salvar a parte", erroParte);
  }
  if (!existente) await gravarEnderecosEContatos(pessoaId as string, dados);
  if (pessoaDeReferencia && dados.papel !== "parte") await registrarVinculo(pessoaId as string, pessoaDeReferencia, dados.papel);
  await registrarNoHistorico(processoId, "partes", null, `Incluída: ${dados.nome} (${rotuloDoPapel(dados.papel)})${existente ? ", pessoa já cadastrada" : ""}`, ator);
  return detalharProcesso(processoId);
}

async function carregarParte(parteId: string): Promise<{ id: string; processo_id: string; pessoa_id: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(parteId)) throw new ProcessosError("Parte não encontrada.", 404);
  const { data, error } = await db().from("proc_partes").select("id, processo_id, pessoa_id").eq("id", parteId).maybeSingle();
  if (error) falhou("carregar a parte", error);
  if (!data) throw new ProcessosError("Parte não encontrada.", 404);
  return data as { id: string; processo_id: string; pessoa_id: string };
}

/**
 * Salva a parte e a pessoa dela. Os dados da pessoa (documento, endereços, contatos) valem para todos
 * os processos em que ela aparece. Se o CPF/CNPJ digitado já é de outra pessoa do cadastro, as duas são
 * a mesma: a desta parte é absorvida pela que já tinha o documento.
 */
export async function salvarParte(parteId: string, entrada: unknown, ator: Ator): Promise<ProcessoDetalhe> {
  const dados = validar(entrada);
  const parte = await carregarParte(parteId);
  const pessoaDeReferencia = await conferirReferencia(parte.processo_id, dados.referenteA, parteId);
  const { error: erroParte } = await db()
    .from("proc_partes")
    .update({ polo: dados.polo, papel: dados.papel, vinculo: dados.vinculo, devedor: dados.devedor, referente_a: dados.referenteA })
    .eq("id", parteId);
  if (erroParte) falhou("salvar a parte", erroParte);

  let pessoaId = parte.pessoa_id;
  const dona = await buscarPorDocumento(dados.documento, pessoaId);
  if (dona) {
    await unificarPessoas(dona.id, pessoaId, ator);
    pessoaId = dona.id;
    await completarPessoa(pessoaId, dados);
  } else {
    const { error: erroPessoa } = await db()
      .from("proc_pessoas")
      .update({ nome: dados.nome, nome_chave: chaveNome(dados.nome), documento: dados.documento, oab: dados.oab, observacao: dados.observacao, ...(tipoPeloDocumento(dados.documento) ? { tipo: tipoPeloDocumento(dados.documento) } : {}) })
      .eq("id", pessoaId);
    if (erroPessoa) falhou("salvar a pessoa", erroPessoa);
    await gravarEnderecosEContatos(pessoaId, dados);
  }
  if (pessoaDeReferencia && dados.papel !== "parte") await registrarVinculo(pessoaId, pessoaDeReferencia, dados.papel);
  await registrarNoHistorico(parte.processo_id, "partes", null, `Atualizada: ${dados.nome} (${rotuloDoPapel(dados.papel)})${dona ? `, unificada com ${dona.nome}` : ""}`, ator);
  return detalharProcesso(parte.processo_id);
}

/** Tira a pessoa deste processo. Ela continua no cadastro se aparece em outro; sozinha e sem dados, sai junto. */
export async function excluirParte(parteId: string, ator: Ator): Promise<ProcessoDetalhe> {
  const parte = await carregarParte(parteId);
  const { data: pessoa } = await db().from("proc_pessoas").select("nome, vios_ci").eq("id", parte.pessoa_id).maybeSingle();
  const { error } = await db().from("proc_partes").delete().eq("id", parteId);
  if (error) falhou("excluir a parte", error);
  const { count } = await db().from("proc_partes").select("id", { count: "exact", head: true }).eq("pessoa_id", parte.pessoa_id);
  // Pessoa que veio do VIOS fica no cadastro mesmo sem processo: é um cadastro de lá.
  if (!count && !pessoa?.vios_ci) await db().from("proc_pessoas").delete().eq("id", parte.pessoa_id);
  await registrarNoHistorico(parte.processo_id, "partes", (pessoa?.nome as string | undefined) ?? null, "Excluída", ator);
  return detalharProcesso(parte.processo_id);
}
