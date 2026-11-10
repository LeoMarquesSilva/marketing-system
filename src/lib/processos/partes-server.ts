import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ProcessosError } from "./errors";
import { detalharProcesso, registrarNoHistorico } from "./processos-server";
import { db, falhou, type Ator } from "./server";
import { PAPEIS, POLOS, TIPOS_CONTATO, rotuloDoPapel, type ParteEntrada, type ProcessoDetalhe } from "./types";

const textoOpcional = z
  .string()
  .max(2000)
  .nullish()
  .transform((valor) => valor?.trim() || null);

const esquemaParte = z.object({
  polo: z.enum(POLOS.map((item) => item.valor) as [string, ...string[]]),
  papel: z.enum(PAPEIS.map((item) => item.valor) as [string, ...string[]]),
  vinculo: textoOpcional,
  devedor: z.boolean().default(false),
  referenteA: z.string().uuid().nullish().transform((valor) => valor ?? null),
  nome: z.string().trim().min(2, "Informe o nome.").max(300),
  documento: textoOpcional,
  oab: textoOpcional,
  observacao: textoOpcional,
  enderecos: z
    .array(z.object({ endereco: z.string().trim().min(3).max(500), cidade: textoOpcional, uf: textoOpcional, cep: textoOpcional, observacao: textoOpcional }))
    .max(50)
    .default([]),
  contatos: z
    .array(
      z.object({
        tipo: z.enum(TIPOS_CONTATO.map((item) => item.valor) as [string, ...string[]]),
        valor: z.string().trim().min(3).max(300),
        whatsapp: z.boolean().default(false),
        observacao: textoOpcional,
      })
    )
    .max(50)
    .default([]),
});

function validar(entrada: unknown): ParteEntrada {
  const lido = esquemaParte.safeParse(entrada);
  if (!lido.success) throw new ProcessosError(lido.error.issues[0]?.message ?? "Dados da parte inválidos.", 400);
  // Só a parte pode ser o devedor; sócio, fiador e advogado se ligam a ela.
  return { ...lido.data, devedor: lido.data.papel === "parte" && lido.data.devedor } as ParteEntrada;
}

async function gravarEnderecosEContatos(pessoaId: string, dados: ParteEntrada): Promise<void> {
  const banco = db();
  const apagados = await Promise.all([
    banco.from("proc_pessoa_enderecos").delete().eq("pessoa_id", pessoaId),
    banco.from("proc_pessoa_contatos").delete().eq("pessoa_id", pessoaId),
  ]);
  for (const resultado of apagados) if (resultado.error) falhou("atualizar os contatos", resultado.error);
  // created_at crescente mantém a ordem em que a pessoa digitou.
  const base = Date.now();
  if (dados.enderecos.length) {
    const { error } = await banco.from("proc_pessoa_enderecos").insert(
      dados.enderecos.map((item, i) => ({
        pessoa_id: pessoaId,
        endereco: item.endereco,
        cidade: item.cidade,
        uf: item.uf?.toUpperCase().slice(0, 2) ?? null,
        cep: item.cep,
        observacao: item.observacao,
        created_at: new Date(base + i).toISOString(),
      }))
    );
    if (error) falhou("salvar os endereços", error);
  }
  if (dados.contatos.length) {
    const { error } = await banco.from("proc_pessoa_contatos").insert(
      dados.contatos.map((item, i) => ({
        pessoa_id: pessoaId,
        tipo: item.tipo,
        valor: item.valor,
        whatsapp: item.tipo === "celular" || item.tipo === "telefone" ? item.whatsapp : false,
        observacao: item.observacao,
        created_at: new Date(base + i).toISOString(),
      }))
    );
    if (error) falhou("salvar os contatos", error);
  }
}

async function conferirReferencia(processoId: string, referenteA: string | null, propriaParte?: string): Promise<void> {
  if (!referenteA) return;
  if (referenteA === propriaParte) throw new ProcessosError("A parte não pode se referir a ela mesma.", 400);
  const { data, error } = await db().from("proc_partes").select("id").eq("id", referenteA).eq("processo_id", processoId).maybeSingle();
  if (error) falhou("conferir a parte de referência", error);
  if (!data) throw new ProcessosError("A parte de referência não é deste processo.", 400);
}

export async function criarParte(processoId: string, entrada: unknown, ator: Ator): Promise<ProcessoDetalhe> {
  const dados = validar(entrada);
  // Confere o processo (404 se não existir) antes de criar a pessoa.
  await detalharProcesso(processoId);
  await conferirReferencia(processoId, dados.referenteA);
  const pessoaId = randomUUID();
  const { error: erroPessoa } = await db().from("proc_pessoas").insert({ id: pessoaId, nome: dados.nome, documento: dados.documento, oab: dados.oab, observacao: dados.observacao });
  if (erroPessoa) falhou("salvar a pessoa", erroPessoa);
  const { error: erroParte } = await db().from("proc_partes").insert({
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
    await db().from("proc_pessoas").delete().eq("id", pessoaId);
    falhou("salvar a parte", erroParte);
  }
  await gravarEnderecosEContatos(pessoaId, dados);
  await registrarNoHistorico(processoId, "partes", null, `Incluída: ${dados.nome} (${rotuloDoPapel(dados.papel)})`, ator);
  return detalharProcesso(processoId);
}

async function carregarParte(parteId: string): Promise<{ id: string; processo_id: string; pessoa_id: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(parteId)) throw new ProcessosError("Parte não encontrada.", 404);
  const { data, error } = await db().from("proc_partes").select("id, processo_id, pessoa_id").eq("id", parteId).maybeSingle();
  if (error) falhou("carregar a parte", error);
  if (!data) throw new ProcessosError("Parte não encontrada.", 404);
  return data as { id: string; processo_id: string; pessoa_id: string };
}

export async function salvarParte(parteId: string, entrada: unknown, ator: Ator): Promise<ProcessoDetalhe> {
  const dados = validar(entrada);
  const parte = await carregarParte(parteId);
  await conferirReferencia(parte.processo_id, dados.referenteA, parteId);
  const { error: erroParte } = await db()
    .from("proc_partes")
    .update({ polo: dados.polo, papel: dados.papel, vinculo: dados.vinculo, devedor: dados.devedor, referente_a: dados.referenteA })
    .eq("id", parteId);
  if (erroParte) falhou("salvar a parte", erroParte);
  const { error: erroPessoa } = await db()
    .from("proc_pessoas")
    .update({ nome: dados.nome, documento: dados.documento, oab: dados.oab, observacao: dados.observacao })
    .eq("id", parte.pessoa_id);
  if (erroPessoa) falhou("salvar a pessoa", erroPessoa);
  await gravarEnderecosEContatos(parte.pessoa_id, dados);
  await registrarNoHistorico(parte.processo_id, "partes", null, `Atualizada: ${dados.nome} (${rotuloDoPapel(dados.papel)})`, ator);
  return detalharProcesso(parte.processo_id);
}

export async function excluirParte(parteId: string, ator: Ator): Promise<ProcessoDetalhe> {
  const parte = await carregarParte(parteId);
  const { data: pessoa } = await db().from("proc_pessoas").select("nome").eq("id", parte.pessoa_id).maybeSingle();
  const { error } = await db().from("proc_partes").delete().eq("id", parteId);
  if (error) falhou("excluir a parte", error);
  // A pessoa sai junto quando não participa de outro processo.
  const { count } = await db().from("proc_partes").select("id", { count: "exact", head: true }).eq("pessoa_id", parte.pessoa_id);
  if (!count) await db().from("proc_pessoas").delete().eq("id", parte.pessoa_id);
  await registrarNoHistorico(parte.processo_id, "partes", (pessoa?.nome as string | undefined) ?? null, "Excluída", ator);
  return detalharProcesso(parte.processo_id);
}
