import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ProcessosError } from "./errors";
import { agruparDuplicadas, chaveDoContato, chaveDoEndereco, chaveNome, digitosDoDocumento, rotuloDoVinculo, tipoPeloDocumento, TIPOS_VINCULO } from "./pessoas";
import { db, emLotes, falhou, type Ator } from "./server";
import { TIPOS_CONTATO, type Contato, type Endereco, type GrupoDePessoas, type OrigemDado, type PessoaDetalhe, type PessoaEntrada, type PessoaResumo, type ProcessoDaPessoa, type ResumoPessoas, type VinculoPessoa } from "./types";

type Linha = Record<string, unknown>;

const UUID = /^[0-9a-f-]{36}$/i;
const COLUNAS_RESUMO = "id, nome, documento, tipo, categoria, grupo_cliente, vios_ci, oab, origem";
const COM_CONTAGENS = `${COLUNAS_RESUMO}, partes:proc_partes(count), enderecos:proc_pessoa_enderecos(count), contatos:proc_pessoa_contatos(count)`;

function contagem(valor: unknown): number {
  const item = Array.isArray(valor) ? valor[0] : valor;
  return Number((item as { count?: number } | null)?.count ?? 0);
}

function paraResumo(linha: Linha): PessoaResumo {
  return {
    id: linha.id as string,
    nome: linha.nome as string,
    documento: (linha.documento as string | null) ?? null,
    tipo: (linha.tipo as PessoaResumo["tipo"]) ?? null,
    categoria: (linha.categoria as string | null) ?? null,
    grupoCliente: (linha.grupo_cliente as string | null) ?? null,
    viosCi: (linha.vios_ci as string | null) ?? null,
    oab: (linha.oab as string | null) ?? null,
    origem: linha.origem as OrigemDado,
    processos: contagem(linha.partes),
    enderecos: contagem(linha.enderecos),
    contatos: contagem(linha.contatos),
  };
}

/** Tira a chave de comparação, que só serve para agrupar. */
function semChave(pessoa: PessoaResumo & { nomeChave: string }): PessoaResumo {
  const copia: PessoaResumo & { nomeChave?: string } = { ...pessoa };
  delete copia.nomeChave;
  return copia;
}

/* ---------------------------------------------------------------- lista */

export interface FiltroPessoas {
  busca?: string;
  tipo?: string;
  /** "sem_documento", "sem_vios" ou "com_processo". */
  situacao?: string;
  pagina?: number;
}

export const PESSOAS_POR_PAGINA = 60;

export async function listarPessoas(filtro: FiltroPessoas): Promise<{ pessoas: PessoaResumo[]; total: number }> {
  const pagina = Math.max(0, Math.floor(filtro.pagina ?? 0));
  // inner join só quando o filtro pede quem tem processo.
  const selecao = filtro.situacao === "com_processo" ? COM_CONTAGENS.replace("partes:proc_partes(count)", "partes:proc_partes!inner(count)") : COM_CONTAGENS;
  let consulta = db().from("proc_pessoas").select(selecao, { count: "exact" });
  const busca = (filtro.busca ?? "").trim();
  if (busca) {
    const digitos = busca.replace(/\D/g, "");
    const chave = chaveNome(busca);
    // Só dígitos e pontuação: é documento; senão, nome.
    if (digitos.length >= 3 && !/[a-zA-ZÀ-ú]/.test(busca)) consulta = consulta.like("documento_digitos", `%${digitos}%`);
    else if (chave) consulta = consulta.like("nome_chave", `%${chave.replace(/[%_]/g, "")}%`);
  }
  if (filtro.tipo === "fisica" || filtro.tipo === "juridica") consulta = consulta.eq("tipo", filtro.tipo);
  if (filtro.situacao === "sem_documento") consulta = consulta.is("documento_digitos", null);
  if (filtro.situacao === "sem_vios") consulta = consulta.is("vios_ci", null);
  const { data, error, count } = await consulta.order("nome_chave").range(pagina * PESSOAS_POR_PAGINA, (pagina + 1) * PESSOAS_POR_PAGINA - 1);
  if (error) falhou("carregar as pessoas", error);
  return { pessoas: ((data ?? []) as unknown as Linha[]).map(paraResumo), total: count ?? 0 };
}

async function carregarTodasParaComparar(): Promise<Linha[]> {
  const linhas: Linha[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await db().from("proc_pessoas").select(COM_CONTAGENS).order("nome_chave").range(inicio, inicio + 999);
    if (error) falhou("carregar as pessoas", error);
    linhas.push(...((data ?? []) as unknown as Linha[]));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

/** Grupos de pessoas que parecem a mesma, para a tela de unificação. */
export async function listarDuplicadas(): Promise<GrupoDePessoas[]> {
  const pessoas = (await carregarTodasParaComparar()).map(paraResumo);
  const grupos = agruparDuplicadas(pessoas.map((pessoa) => ({ ...pessoa, nomeChave: chaveNome(pessoa.nome) })));
  return grupos
    .map((grupo) => ({ motivo: grupo.motivo, pessoas: grupo.pessoas.map(semChave) }))
    .sort((a, b) => (a.motivo === b.motivo ? b.pessoas.length - a.pessoas.length : a.motivo === "documento" ? -1 : 1));
}

export async function resumoDasPessoas(): Promise<ResumoPessoas> {
  const banco = db();
  const [total, comDocumento, ligadas, carga, grupos] = await Promise.all([
    banco.from("proc_pessoas").select("id", { count: "exact", head: true }),
    banco.from("proc_pessoas").select("id", { count: "exact", head: true }).not("documento_digitos", "is", null),
    banco.from("proc_pessoas").select("id", { count: "exact", head: true }).not("vios_ci", "is", null),
    banco.from("proc_sync_execucoes").select("iniciado_em, status, no_recorte, criados, atualizados, confirmados, erro").eq("origem", "pessoas").order("iniciado_em", { ascending: false }).limit(1),
    listarDuplicadas(),
  ]);
  if (total.error) falhou("contar as pessoas", total.error);
  const ultima = carga.data?.[0];
  return {
    total: total.count ?? 0,
    comDocumento: comDocumento.count ?? 0,
    ligadasAoVios: ligadas.count ?? 0,
    gruposDuplicados: grupos.length,
    ultimaCarga: ultima
      ? {
          quando: ultima.iniciado_em as string,
          resumo: `${ultima.atualizados} ligadas ao VIOS, ${ultima.confirmados} unificadas, ${ultima.criados} importadas`,
          erro: ultima.status === "erro" ? ((ultima.erro as string | null) ?? "Falhou") : null,
        }
      : null,
  };
}

/* ---------------------------------------------------------------- ficha */

function paraEndereco(item: Linha): Endereco {
  return {
    id: item.id as string,
    endereco: item.endereco as string,
    cidade: (item.cidade as string | null) ?? null,
    uf: (item.uf as string | null) ?? null,
    cep: (item.cep as string | null) ?? null,
    observacao: (item.observacao as string | null) ?? null,
    origem: item.origem as OrigemDado,
  };
}

function paraContato(item: Linha): Contato {
  return {
    id: item.id as string,
    tipo: item.tipo as Contato["tipo"],
    valor: item.valor as string,
    whatsapp: item.whatsapp === true,
    observacao: (item.observacao as string | null) ?? null,
    origem: item.origem as OrigemDado,
  };
}

export async function detalharPessoa(id: string): Promise<PessoaDetalhe> {
  if (!UUID.test(id)) throw new ProcessosError("Pessoa não encontrada.", 404);
  const banco = db();
  const { data: linha, error } = await banco
    .from("proc_pessoas")
    .select(`${COM_CONTAGENS}, nome_fantasia, observacao, etiquetas, nome_chave, documento_digitos, vios_sincronizado_em`)
    .eq("id", id)
    .maybeSingle();
  if (error) falhou("carregar a pessoa", error);
  if (!linha) throw new ProcessosError("Pessoa não encontrada.", 404);
  const pessoa = linha as unknown as Linha;

  const [enderecos, contatos, vinculosDe, vinculosPara, partes, unificacoes] = await Promise.all([
    banco.from("proc_pessoa_enderecos").select("id, endereco, cidade, uf, cep, observacao, origem").eq("pessoa_id", id).order("created_at"),
    banco.from("proc_pessoa_contatos").select("id, tipo, valor, whatsapp, observacao, origem").eq("pessoa_id", id).order("created_at"),
    banco.from("proc_pessoa_vinculos").select("id, tipo, observacao, relacionada_id").eq("pessoa_id", id),
    banco.from("proc_pessoa_vinculos").select("id, tipo, observacao, pessoa_id").eq("relacionada_id", id),
    banco.from("proc_partes").select("id, polo, papel, vinculo, devedor, processo:proc_processos(id, ci, cnj, acao, situacao)").eq("pessoa_id", id).limit(2000),
    banco.from("proc_pessoas_unificacoes").select("id, origem_nome, origem_documento, automatica, autor_nome, criado_em").eq("destino_id", id).order("criado_em", { ascending: false }).limit(50),
  ]);
  for (const resultado of [enderecos, contatos, vinculosDe, vinculosPara, partes, unificacoes]) if (resultado.error) falhou("carregar a ficha da pessoa", resultado.error);

  const outras = [...new Set([...(vinculosDe.data ?? []).map((item) => item.relacionada_id as string), ...(vinculosPara.data ?? []).map((item) => item.pessoa_id as string)])];
  const nomes = new Map<string, { nome: string; documento: string | null }>();
  for (const lote of emLotes(outras, 200)) {
    const { data, error: erroNomes } = await banco.from("proc_pessoas").select("id, nome, documento").in("id", lote);
    if (erroNomes) falhou("carregar os vínculos", erroNomes);
    for (const item of data ?? []) nomes.set(item.id as string, { nome: item.nome as string, documento: (item.documento as string | null) ?? null });
  }
  const vinculo = (item: Linha, direcao: VinculoPessoa["direcao"], outraId: string): VinculoPessoa => ({
    id: item.id as string,
    tipo: item.tipo as string,
    observacao: (item.observacao as string | null) ?? null,
    direcao,
    outraId,
    outraNome: nomes.get(outraId)?.nome ?? "Pessoa removida",
    outraDocumento: nomes.get(outraId)?.documento ?? null,
  });

  // Parecidas: mesmo documento ou mesmo nome; quem tem documento ou CI do VIOS diferente é só homônimo.
  const chave = (pessoa.nome_chave as string | null) ?? chaveNome(pessoa.nome as string);
  const digitos = (pessoa.documento_digitos as string | null) ?? "";
  const filtros = [`nome_chave.eq.${chave.replace(/[,()]/g, " ")}`];
  if (digitos) filtros.push(`documento_digitos.eq.${digitos}`);
  const { data: candidatas, error: erroParecidas } = await banco.from("proc_pessoas").select(COM_CONTAGENS).or(filtros.join(",")).neq("id", id).limit(50);
  if (erroParecidas) falhou("procurar pessoas parecidas", erroParecidas);
  const eu = paraResumo(pessoa);
  const comparaveis = [eu, ...((candidatas ?? []) as unknown as Linha[]).map(paraResumo)].map((item) => ({ ...item, nomeChave: chaveNome(item.nome) }));
  const meuGrupo = agruparDuplicadas(comparaveis).find((grupo) => grupo.pessoas.some((item) => item.id === id));
  const parecidas = (meuGrupo?.pessoas ?? []).filter((item) => item.id !== id).map(semChave);

  return {
    ...eu,
    nomeFantasia: (pessoa.nome_fantasia as string | null) ?? null,
    observacao: (pessoa.observacao as string | null) ?? null,
    etiquetas: (pessoa.etiquetas as string[] | null) ?? [],
    listaEnderecos: ((enderecos.data ?? []) as Linha[]).map(paraEndereco),
    listaContatos: ((contatos.data ?? []) as Linha[]).map(paraContato),
    vinculos: [
      ...((vinculosDe.data ?? []) as Linha[]).map((item) => vinculo(item, "de", item.relacionada_id as string)),
      ...((vinculosPara.data ?? []) as Linha[]).map((item) => vinculo(item, "para", item.pessoa_id as string)),
    ],
    listaProcessos: ((partes.data ?? []) as unknown as Linha[])
      .map((item): ProcessoDaPessoa | null => {
        const processo = (Array.isArray(item.processo) ? item.processo[0] : item.processo) as Linha | null;
        if (!processo) return null;
        return {
          parteId: item.id as string,
          processoId: processo.id as string,
          ci: (processo.ci as string | null) ?? null,
          cnj: (processo.cnj as string | null) ?? null,
          acao: (processo.acao as string | null) ?? null,
          situacao: (processo.situacao as string | null) ?? null,
          polo: item.polo as ProcessoDaPessoa["polo"],
          papel: item.papel as ProcessoDaPessoa["papel"],
          vinculo: (item.vinculo as string | null) ?? null,
          devedor: item.devedor === true,
        };
      })
      .filter((item): item is ProcessoDaPessoa => item !== null)
      .sort((a, b) => (b.ci ?? "").localeCompare(a.ci ?? "")),
    parecidas,
    unificacoes: (unificacoes.data ?? []).map((item) => ({
      id: item.id as string,
      nome: item.origem_nome as string,
      documento: (item.origem_documento as string | null) ?? null,
      automatica: item.automatica === true,
      autor: (item.autor_nome as string | null) ?? null,
      quando: item.criado_em as string,
    })),
    viosSincronizadoEm: (pessoa.vios_sincronizado_em as string | null) ?? null,
  };
}

/* --------------------------------------------------------------- edição */

const textoOpcional = z
  .string()
  .max(2000)
  .nullish()
  .transform((valor) => valor?.trim() || null);
const origem = z.enum(["manual", "vios", "ia"]).optional();

export const esquemaEnderecos = z
  .array(z.object({ endereco: z.string().trim().min(3).max(500), cidade: textoOpcional, uf: textoOpcional, cep: textoOpcional, observacao: textoOpcional, origem }))
  .max(50)
  .default([]);
export const esquemaContatos = z
  .array(
    z.object({
      tipo: z.enum(TIPOS_CONTATO.map((item) => item.valor) as [string, ...string[]]),
      valor: z.string().trim().min(3).max(300),
      whatsapp: z.boolean().default(false),
      observacao: textoOpcional,
      origem,
    })
  )
  .max(50)
  .default([]);

const esquemaPessoa = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(300),
  documento: textoOpcional,
  tipo: z.enum(["fisica", "juridica"]).nullish().transform((valor) => valor ?? null),
  nomeFantasia: textoOpcional,
  oab: textoOpcional,
  observacao: textoOpcional,
  enderecos: esquemaEnderecos,
  contatos: esquemaContatos,
});

function validarPessoa(entrada: unknown): PessoaEntrada {
  const lido = esquemaPessoa.safeParse(entrada);
  if (!lido.success) throw new ProcessosError(lido.error.issues[0]?.message ?? "Dados da pessoa inválidos.", 400);
  return lido.data as PessoaEntrada;
}

/** Outra pessoa com o mesmo CPF/CNPJ (ignorando pontuação). */
export async function buscarPorDocumento(documento: string | null, excetoId?: string): Promise<{ id: string; nome: string } | null> {
  const digitos = digitosDoDocumento(documento);
  if (digitos.length < 11) return null;
  let consulta = db().from("proc_pessoas").select("id, nome").eq("documento_digitos", digitos).order("created_at").limit(1);
  if (excetoId) consulta = consulta.neq("id", excetoId);
  const { data, error } = await consulta;
  if (error) falhou("procurar o documento", error);
  return data?.[0] ? { id: data[0].id as string, nome: data[0].nome as string } : null;
}

/**
 * Troca os endereços e contatos da pessoa pelos que vieram da tela, mantendo a origem (VIOS, IA) do que
 * não mudou. created_at crescente guarda a ordem em que a pessoa digitou.
 */
export async function gravarEnderecosEContatos(pessoaId: string, dados: { enderecos: Endereco[]; contatos: Contato[] }): Promise<void> {
  const banco = db();
  const apagados = await Promise.all([banco.from("proc_pessoa_enderecos").delete().eq("pessoa_id", pessoaId), banco.from("proc_pessoa_contatos").delete().eq("pessoa_id", pessoaId)]);
  for (const resultado of apagados) if (resultado.error) falhou("atualizar os contatos", resultado.error);
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
        origem: item.origem ?? "manual",
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
        origem: item.origem ?? "manual",
        created_at: new Date(base + i).toISOString(),
      }))
    );
    if (error) falhou("salvar os contatos", error);
  }
}

/** Acrescenta à pessoa só os endereços e contatos que ela ainda não tem. */
export async function acrescentarEnderecosEContatos(pessoaId: string, dados: { enderecos: Endereco[]; contatos: Contato[] }): Promise<void> {
  if (!dados.enderecos.length && !dados.contatos.length) return;
  const banco = db();
  const [enderecos, contatos] = await Promise.all([
    banco.from("proc_pessoa_enderecos").select("endereco, cep").eq("pessoa_id", pessoaId),
    banco.from("proc_pessoa_contatos").select("tipo, valor").eq("pessoa_id", pessoaId),
  ]);
  if (enderecos.error) falhou("consultar os endereços", enderecos.error);
  if (contatos.error) falhou("consultar os contatos", contatos.error);
  const temEndereco = new Set((enderecos.data ?? []).map((item) => chaveDoEndereco(item as Pick<Endereco, "endereco" | "cep">)));
  const temContato = new Set((contatos.data ?? []).map((item) => chaveDoContato(item as Pick<Contato, "tipo" | "valor">)));
  const novosEnderecos = dados.enderecos.filter((item) => !temEndereco.has(chaveDoEndereco(item)) && temEndereco.add(chaveDoEndereco(item)));
  const novosContatos = dados.contatos.filter((item) => !temContato.has(chaveDoContato(item)) && temContato.add(chaveDoContato(item)));
  if (novosEnderecos.length) {
    const { error } = await banco.from("proc_pessoa_enderecos").insert(
      novosEnderecos.map((item) => ({ pessoa_id: pessoaId, endereco: item.endereco, cidade: item.cidade, uf: item.uf?.toUpperCase().slice(0, 2) ?? null, cep: item.cep, observacao: item.observacao, origem: item.origem ?? "manual" }))
    );
    if (error) falhou("salvar os endereços", error);
  }
  if (novosContatos.length) {
    const { error } = await banco.from("proc_pessoa_contatos").insert(
      novosContatos.map((item) => ({ pessoa_id: pessoaId, tipo: item.tipo, valor: item.valor, whatsapp: item.whatsapp, observacao: item.observacao, origem: item.origem ?? "manual" }))
    );
    if (error) falhou("salvar os contatos", error);
  }
}

export async function criarPessoa(entrada: unknown): Promise<PessoaDetalhe> {
  const dados = validarPessoa(entrada);
  const repetida = await buscarPorDocumento(dados.documento);
  if (repetida) throw new ProcessosError(`Já existe uma pessoa com este CPF/CNPJ: ${repetida.nome}.`, 409);
  const id = randomUUID();
  const { error } = await db()
    .from("proc_pessoas")
    .insert({
      id,
      nome: dados.nome,
      nome_chave: chaveNome(dados.nome),
      documento: dados.documento,
      tipo: dados.tipo ?? tipoPeloDocumento(dados.documento),
      nome_fantasia: dados.nomeFantasia,
      oab: dados.oab,
      observacao: dados.observacao,
      origem: "manual",
    });
  if (error) falhou("salvar a pessoa", error);
  await gravarEnderecosEContatos(id, dados);
  return detalharPessoa(id);
}

export async function salvarPessoa(id: string, entrada: unknown): Promise<PessoaDetalhe> {
  const dados = validarPessoa(entrada);
  await detalharPessoaMinima(id);
  const repetida = await buscarPorDocumento(dados.documento, id);
  if (repetida) throw new ProcessosError(`Já existe outra pessoa com este CPF/CNPJ: ${repetida.nome}. Se for a mesma, unifique as duas.`, 409);
  const { error } = await db()
    .from("proc_pessoas")
    .update({
      nome: dados.nome,
      nome_chave: chaveNome(dados.nome),
      documento: dados.documento,
      tipo: dados.tipo ?? tipoPeloDocumento(dados.documento),
      nome_fantasia: dados.nomeFantasia,
      oab: dados.oab,
      observacao: dados.observacao,
    })
    .eq("id", id);
  if (error) falhou("salvar a pessoa", error);
  await gravarEnderecosEContatos(id, dados);
  return detalharPessoa(id);
}

const COLUNAS_COMPLETAS = "id, nome, documento, documento_digitos, tipo, nome_fantasia, oab, observacao, categoria, grupo_cliente, etiquetas, vios_ci, origem";

async function detalharPessoaMinima(id: string): Promise<Linha> {
  if (!UUID.test(id)) throw new ProcessosError("Pessoa não encontrada.", 404);
  const { data, error } = await db().from("proc_pessoas").select(COLUNAS_COMPLETAS).eq("id", id).maybeSingle();
  if (error) falhou("carregar a pessoa", error);
  if (!data) throw new ProcessosError("Pessoa não encontrada.", 404);
  return data as unknown as Linha;
}

/* ------------------------------------------------------------ unificação */

/**
 * Junta `origemId` em `destinoId`: as partes dos processos, os endereços, os contatos e os vínculos
 * passam para o destino, que também herda o que estava vazio nele (documento, OAB, CI do VIOS…). A
 * origem deixa de existir e fica registrada em proc_pessoas_unificacoes. Não junta pessoas com
 * documentos ou CIs do VIOS diferentes: aí são pessoas diferentes.
 */
export async function unificarPessoas(destinoId: string, origemId: string, ator: Ator | null, automatica = false): Promise<{ partesMovidas: number }> {
  if (destinoId === origemId) throw new ProcessosError("Escolha duas pessoas diferentes.", 400);
  const banco = db();
  const [destino, origemPessoa] = await Promise.all([detalharPessoaMinima(destinoId), detalharPessoaMinima(origemId)]);
  const docs = [destino.documento_digitos, origemPessoa.documento_digitos].filter(Boolean);
  if (docs.length === 2 && docs[0] !== docs[1]) throw new ProcessosError("As duas pessoas têm CPF/CNPJ diferentes: não são a mesma.", 409);
  const cis = [destino.vios_ci, origemPessoa.vios_ci].filter(Boolean);
  if (cis.length === 2 && cis[0] !== cis[1]) throw new ProcessosError("As duas pessoas são cadastros diferentes no VIOS: não são a mesma.", 409);

  const { data: movidas, error: erroPartes } = await banco.from("proc_partes").update({ pessoa_id: destinoId }).eq("pessoa_id", origemId).select("id");
  if (erroPartes) falhou("passar os processos para a pessoa que fica", erroPartes);

  const [enderecos, contatos, vinculosDe, vinculosPara] = await Promise.all([
    banco.from("proc_pessoa_enderecos").select("endereco, cidade, uf, cep, observacao, origem").eq("pessoa_id", origemId),
    banco.from("proc_pessoa_contatos").select("tipo, valor, whatsapp, observacao, origem").eq("pessoa_id", origemId),
    banco.from("proc_pessoa_vinculos").select("relacionada_id, tipo, observacao, origem").eq("pessoa_id", origemId),
    banco.from("proc_pessoa_vinculos").select("pessoa_id, tipo, observacao, origem").eq("relacionada_id", origemId),
  ]);
  for (const resultado of [enderecos, contatos, vinculosDe, vinculosPara]) if (resultado.error) falhou("ler os dados da pessoa absorvida", resultado.error);
  await acrescentarEnderecosEContatos(destinoId, { enderecos: (enderecos.data ?? []) as unknown as Endereco[], contatos: (contatos.data ?? []) as unknown as Contato[] });
  const vinculos = [
    ...(vinculosDe.data ?? []).map((item) => ({ pessoa_id: destinoId, relacionada_id: item.relacionada_id as string, tipo: item.tipo, observacao: item.observacao, origem: item.origem })),
    ...(vinculosPara.data ?? []).map((item) => ({ pessoa_id: item.pessoa_id as string, relacionada_id: destinoId, tipo: item.tipo, observacao: item.observacao, origem: item.origem })),
  ].filter((item) => item.pessoa_id !== item.relacionada_id);
  if (vinculos.length) {
    const { error } = await banco.from("proc_pessoa_vinculos").upsert(vinculos, { onConflict: "pessoa_id,relacionada_id,tipo", ignoreDuplicates: true });
    if (error) falhou("passar os vínculos", error);
  }

  // A origem sai antes de o destino herdar o CI do VIOS (o índice é único).
  const { error: erroExcluir } = await banco.from("proc_pessoas").delete().eq("id", origemId);
  if (erroExcluir) falhou("remover a pessoa absorvida", erroExcluir);

  const herdar: Linha = {};
  for (const coluna of ["documento", "tipo", "nome_fantasia", "oab", "categoria", "grupo_cliente", "vios_ci"]) {
    if (!destino[coluna] && origemPessoa[coluna]) herdar[coluna] = origemPessoa[coluna];
  }
  if (!(destino.etiquetas as string[] | null)?.length && (origemPessoa.etiquetas as string[] | null)?.length) herdar.etiquetas = origemPessoa.etiquetas;
  if (origemPessoa.observacao && origemPessoa.observacao !== destino.observacao) herdar.observacao = [destino.observacao, origemPessoa.observacao].filter(Boolean).join("\n");
  if (Object.keys(herdar).length) {
    const { error } = await banco.from("proc_pessoas").update(herdar).eq("id", destinoId);
    if (error) falhou("completar a pessoa que fica", error);
  }
  const { error: erroRegistro } = await banco.from("proc_pessoas_unificacoes").insert({
    destino_id: destinoId,
    origem_nome: origemPessoa.nome,
    origem_documento: origemPessoa.documento ?? null,
    origem_vios_ci: origemPessoa.vios_ci ?? null,
    partes_movidas: movidas?.length ?? 0,
    automatica,
    autor_id: ator?.authUserId ?? null,
    autor_nome: ator?.nome ?? null,
  });
  if (erroRegistro) falhou("registrar a unificação", erroRegistro);
  return { partesMovidas: movidas?.length ?? 0 };
}

/** Unifica um grupo inteiro na pessoa escolhida. */
export async function unificarGrupo(destinoId: string, origens: unknown, ator: Ator): Promise<PessoaDetalhe> {
  const ids = Array.isArray(origens) ? [...new Set(origens.filter((id): id is string => typeof id === "string" && UUID.test(id) && id !== destinoId))] : [];
  if (!ids.length) throw new ProcessosError("Indique as pessoas a unificar.", 400);
  if (ids.length > 200) throw new ProcessosError("Muitas pessoas de uma vez: unifique em partes.", 400);
  for (const origemId of ids) await unificarPessoas(destinoId, origemId, ator);
  return detalharPessoa(destinoId);
}

/* --------------------------------------------------------------- vínculos */

const TIPOS = new Set<string>(TIPOS_VINCULO.map((item) => item.valor));

/** `pessoaId` é sócia, fiadora, advogada… de `relacionadaId`. Repetir o mesmo vínculo não duplica. */
export async function registrarVinculo(pessoaId: string, relacionadaId: string, tipo: string, origemDoDado: OrigemDado = "manual", observacao: string | null = null): Promise<void> {
  if (pessoaId === relacionadaId || !TIPOS.has(tipo)) return;
  const { error } = await db()
    .from("proc_pessoa_vinculos")
    .upsert({ pessoa_id: pessoaId, relacionada_id: relacionadaId, tipo, observacao, origem: origemDoDado }, { onConflict: "pessoa_id,relacionada_id,tipo", ignoreDuplicates: true });
  if (error) falhou("registrar o vínculo", error);
}

export async function adicionarVinculo(pessoaId: string, entrada: Record<string, unknown>): Promise<PessoaDetalhe> {
  const outra = String(entrada.outraId ?? "");
  const tipo = String(entrada.tipo ?? "");
  if (!UUID.test(outra) || outra === pessoaId) throw new ProcessosError("Escolha a outra pessoa do vínculo.", 400);
  if (!TIPOS.has(tipo)) throw new ProcessosError("Tipo de vínculo inválido.", 400);
  await Promise.all([detalharPessoaMinima(pessoaId), detalharPessoaMinima(outra)]);
  const observacao = typeof entrada.observacao === "string" ? entrada.observacao.trim().slice(0, 500) || null : null;
  // "de": esta pessoa é <tipo> da outra; "para": a outra é <tipo> desta.
  if (entrada.direcao === "para") await registrarVinculo(outra, pessoaId, tipo, "manual", observacao);
  else await registrarVinculo(pessoaId, outra, tipo, "manual", observacao);
  return detalharPessoa(pessoaId);
}

export async function removerVinculo(pessoaId: string, vinculoId: string): Promise<PessoaDetalhe> {
  if (!UUID.test(vinculoId)) throw new ProcessosError("Vínculo não encontrado.", 404);
  const { error } = await db().from("proc_pessoa_vinculos").delete().eq("id", vinculoId).or(`pessoa_id.eq.${pessoaId},relacionada_id.eq.${pessoaId}`);
  if (error) falhou("remover o vínculo", error);
  return detalharPessoa(pessoaId);
}

export { rotuloDoVinculo };
