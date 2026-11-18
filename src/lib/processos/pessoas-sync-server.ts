import "server-only";

import { randomUUID } from "node:crypto";
import { getSioeClient } from "@/lib/sioe-sync-server";
import { ProcessosError } from "./errors";
import { chaveDoContato, chaveDoEndereco, chaveNome, digitosDoDocumento, escolherPessoaVios, lerPessoaVios, type PessoaVios } from "./pessoas";
import { unificarPessoas } from "./pessoas-server";
import { db, emLotes, falhou, type Ator } from "./server";
import { lerRecorte } from "./sincronizacao";
import type { Contato, Endereco, ResultadoCargaPessoas } from "./types";

/**
 * Carga de pessoas: liga cada pessoa do cadastro à pessoa do VIOS (tabela `pessoas` do SIOE, espelho
 * diário de Cadastros > Pessoas), unifica as que são o mesmo cadastro de lá e traz o que o VIOS já sabe
 * (CPF/CNPJ, tipo, categoria, grupo, endereço, telefone, e-mail). Também importa os clientes dos grupos
 * do recorte. Não apaga nada do que foi digitado aqui: só preenche o que está vazio e acrescenta
 * endereço e contato que a pessoa ainda não tem.
 */

const COLUNAS_SIOE = "id, ci, nome, cpf_cnpj, tipo, nome_fantasia_apelido, categoria, grupo_cliente, etiquetas, logradouro, nro, complemento, bairro, cidade, uf, cep, telefone, telefone_vios, email, email_vios, email_cobranca, site";

async function carregarPessoasDoVios(): Promise<PessoaVios[]> {
  const sioe = getSioeClient();
  const { count, error: erroContagem } = await sioe.from("pessoas").select("ci", { count: "exact", head: true });
  if (erroContagem) throw new ProcessosError(`Falha ao consultar as pessoas no SIOE: ${erroContagem.message}`, 502);
  const paginas = Array.from({ length: Math.ceil((count ?? 0) / 1000) }, (_, i) => i * 1000);
  const pessoas: PessoaVios[] = [];
  for (const grupo of emLotes(paginas, 5)) {
    const lotes = await Promise.all(
      grupo.map(async (inicio) => {
        const { data, error } = await sioe.from("pessoas").select(COLUNAS_SIOE).order("ci").range(inicio, inicio + 999);
        if (error) throw new ProcessosError(`Falha ao carregar as pessoas do SIOE: ${error.message}`, 502);
        return (data ?? []) as Record<string, unknown>[];
      })
    );
    for (const lote of lotes) for (const linha of lote) {
      const pessoa = lerPessoaVios(linha);
      if (pessoa) pessoas.push(pessoa);
    }
  }
  return pessoas;
}

interface Nossa {
  id: string;
  nome: string;
  nome_chave: string | null;
  documento: string | null;
  tipo: string | null;
  nome_fantasia: string | null;
  categoria: string | null;
  grupo_cliente: string | null;
  etiquetas: string[] | null;
  oab: string | null;
  observacao: string | null;
  vios_ci: string | null;
  enderecos: number;
  contatos: number;
}

async function carregarNossas(): Promise<Nossa[]> {
  const pessoas: Nossa[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await db()
      .from("proc_pessoas")
      .select("id, nome, nome_chave, documento, tipo, nome_fantasia, categoria, grupo_cliente, etiquetas, oab, observacao, vios_ci, enderecos:proc_pessoa_enderecos(count), contatos:proc_pessoa_contatos(count)")
      .order("created_at")
      .range(inicio, inicio + 999);
    if (error) falhou("carregar as pessoas", error);
    for (const linha of (data ?? []) as unknown as (Omit<Nossa, "enderecos" | "contatos"> & { enderecos: { count: number }[]; contatos: { count: number }[] })[]) {
      pessoas.push({ ...linha, enderecos: linha.enderecos?.[0]?.count ?? 0, contatos: linha.contatos?.[0]?.count ?? 0 });
    }
    if (!data || data.length < 1000) break;
  }
  return pessoas;
}

/** pessoa nossa → a pessoa-cliente (do VIOS) dos processos em que ela aparece com o nome do cliente. */
async function clientesDosProcessos(porSioeId: Map<string, PessoaVios>): Promise<Map<string, PessoaVios>> {
  const banco = db();
  const partes: { pessoa_id: string; processo: { ci: string | null; cliente: string | null } | null }[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await banco.from("proc_partes").select("pessoa_id, processo:proc_processos(ci, cliente)").order("id").range(inicio, inicio + 999);
    if (error) falhou("carregar as partes", error);
    for (const linha of (data ?? []) as unknown as { pessoa_id: string; processo: unknown }[]) {
      const processo = (Array.isArray(linha.processo) ? linha.processo[0] : linha.processo) as { ci: string | null; cliente: string | null } | null;
      partes.push({ pessoa_id: linha.pessoa_id, processo });
    }
    if (!data || data.length < 1000) break;
  }
  const cis = [...new Set(partes.map((parte) => parte.processo?.ci).filter((ci): ci is string => Boolean(ci)))];
  const clienteDoCi = new Map<string, string>();
  const sioe = getSioeClient();
  for (const lote of emLotes(cis, 200)) {
    const { data, error } = await sioe.from("processos_completo").select("ci, pessoa_id").in("ci", lote);
    if (error) throw new ProcessosError(`Falha ao consultar os clientes dos processos no SIOE: ${error.message}`, 502);
    for (const linha of data ?? []) if (linha.pessoa_id) clienteDoCi.set(String(linha.ci), String(linha.pessoa_id));
  }
  return new Map(
    partes
      .map((parte): [string, PessoaVios] | null => {
        const cliente = parte.processo?.ci ? porSioeId.get(clienteDoCi.get(parte.processo.ci) ?? "") : undefined;
        return cliente ? [parte.pessoa_id, cliente] : null;
      })
      .filter((item): item is [string, PessoaVios] => item !== null)
  );
}

/** O que o VIOS sabe e o cadastro daqui ainda não: espelha tipo/categoria/grupo/etiquetas, completa documento e fantasia. */
function patchDoVios(nossa: Nossa, vios: PessoaVios, agora: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (nossa.vios_ci !== vios.ci) patch.vios_ci = vios.ci;
  if (!nossa.documento && vios.documento) patch.documento = vios.documento;
  if (!nossa.nome_fantasia && vios.nomeFantasia) patch.nome_fantasia = vios.nomeFantasia;
  if (vios.tipo && nossa.tipo !== vios.tipo) patch.tipo = vios.tipo;
  if ((nossa.categoria ?? null) !== vios.categoria) patch.categoria = vios.categoria;
  if ((nossa.grupo_cliente ?? null) !== vios.grupoCliente) patch.grupo_cliente = vios.grupoCliente;
  if ((nossa.etiquetas ?? []).join("|") !== vios.etiquetas.join("|")) patch.etiquetas = vios.etiquetas;
  if (nossa.nome_chave !== chaveNome(nossa.nome)) patch.nome_chave = chaveNome(nossa.nome);
  if (Object.keys(patch).length) patch.vios_sincronizado_em = agora;
  return patch;
}

async function registrar(dados: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("proc_sync_execucoes").insert({ origem: "pessoas", arquivo: "pessoas (SIOE)", ...dados, concluido_em: new Date().toISOString() });
  if (error) console.error("[processos] registrar a carga de pessoas:", error.message);
}

export async function sincronizarPessoasComVios(ator?: Ator): Promise<ResultadoCargaPessoas> {
  const iniciadoEm = new Date().toISOString();
  const base = { iniciado_em: iniciadoEm, executado_por: ator?.authUserId ?? null, executado_por_nome: ator?.nome ?? null };
  try {
    const banco = db();
    const agora = new Date().toISOString();
    const doVios = await carregarPessoasDoVios();
    const porNome = new Map<string, PessoaVios[]>();
    const porCi = new Map<string, PessoaVios>();
    const porSioeId = new Map<string, PessoaVios>();
    for (const pessoa of doVios) {
      porCi.set(pessoa.ci, pessoa);
      if (pessoa.sioeId) porSioeId.set(pessoa.sioeId, pessoa);
      const chave = chaveNome(pessoa.nome);
      porNome.set(chave, [...(porNome.get(chave) ?? []), pessoa]);
    }

    let nossas = await carregarNossas();
    const clientes = await clientesDosProcessos(porSioeId);
    const donaDoCi = new Map<string, string>();
    for (const pessoa of nossas) if (pessoa.vios_ci) donaDoCi.set(pessoa.vios_ci, pessoa.id);

    // 1) Liga ao VIOS quem ainda não tem CI; quem cai num CI que já tem dona é a mesma pessoa.
    let ligadas = 0;
    let homonimas = 0;
    const absorver = new Map<string, Nossa[]>();
    for (const pessoa of nossas) {
      if (pessoa.vios_ci) continue;
      const chave = chaveNome(pessoa.nome);
      const cliente = clientes.get(pessoa.id);
      const escolha = cliente && chaveNome(cliente.nome) === chave ? ({ situacao: "achada", pessoa: cliente } as const) : escolherPessoaVios(porNome.get(chave) ?? [], pessoa.documento);
      if (escolha.situacao === "homonimos") homonimas += 1;
      if (escolha.situacao !== "achada") continue;
      const dona = donaDoCi.get(escolha.pessoa.ci);
      if (dona) {
        absorver.set(dona, [...(absorver.get(dona) ?? []), pessoa]);
        continue;
      }
      const { error } = await banco.from("proc_pessoas").update(patchDoVios(pessoa, escolha.pessoa, agora)).eq("id", pessoa.id);
      if (error) falhou(`ligar ${pessoa.nome} ao VIOS`, error);
      pessoa.vios_ci = escolha.pessoa.ci;
      donaDoCi.set(escolha.pessoa.ci, pessoa.id);
      ligadas += 1;
    }

    // 2) Unifica. Semente da carga de processos (só o nome, sem nada digitado) vai em lote; o resto, uma a uma.
    let unificadas = 0;
    for (const [destinoId, origens] of absorver) {
      const simples = origens.filter((pessoa) => !pessoa.documento && !pessoa.oab && !pessoa.observacao && !pessoa.enderecos && !pessoa.contatos);
      const comDados = origens.filter((pessoa) => !simples.includes(pessoa));
      for (const lote of emLotes(simples, 100)) {
        const ids = lote.map((pessoa) => pessoa.id);
        const { error: erroPartes } = await banco.from("proc_partes").update({ pessoa_id: destinoId }).in("pessoa_id", ids);
        if (erroPartes) falhou("passar os processos para a pessoa que fica", erroPartes);
        // Vínculos em que a semente aparece não existem ainda (nasceram só com o nome); a exclusão os levaria junto.
        const { error: erroExcluir } = await banco.from("proc_pessoas").delete().in("id", ids);
        if (erroExcluir) falhou("remover as pessoas repetidas", erroExcluir);
        const { error: erroRegistro } = await banco.from("proc_pessoas_unificacoes").insert(
          lote.map((pessoa) => ({ destino_id: destinoId, origem_nome: pessoa.nome, partes_movidas: 1, automatica: true, autor_id: ator?.authUserId ?? null, autor_nome: ator?.nome ?? null }))
        );
        if (erroRegistro) falhou("registrar as unificações", erroRegistro);
        unificadas += lote.length;
      }
      for (const pessoa of comDados) {
        await unificarPessoas(destinoId, pessoa.id, ator ?? null, true);
        unificadas += 1;
      }
    }

    // 3) Mesmo CPF/CNPJ em duas pessoas daqui: é a mesma (salvo se forem cadastros diferentes no VIOS).
    if (unificadas) nossas = await carregarNossas();
    const porDocumento = new Map<string, Nossa[]>();
    for (const pessoa of nossas) {
      const digitos = digitosDoDocumento(pessoa.documento);
      if (digitos.length >= 11) porDocumento.set(digitos, [...(porDocumento.get(digitos) ?? []), pessoa]);
    }
    for (const lista of porDocumento.values()) {
      if (lista.length < 2 || new Set(lista.map((pessoa) => pessoa.vios_ci).filter(Boolean)).size > 1) continue;
      const destino = lista.find((pessoa) => pessoa.vios_ci) ?? lista[0];
      for (const pessoa of lista) {
        if (pessoa.id === destino.id) continue;
        await unificarPessoas(destino.id, pessoa.id, ator ?? null, true);
        unificadas += 1;
      }
    }

    // 4) Atualiza quem já está ligado: campos do VIOS e o endereço/contato de lá que ainda não tem.
    nossas = await carregarNossas();
    let atualizadas = 0;
    const ligadasAgora = nossas.filter((pessoa) => pessoa.vios_ci && porCi.has(pessoa.vios_ci));
    const tem = new Map<string, { enderecos: Set<string>; contatos: Set<string> }>();
    for (const lote of emLotes(ligadasAgora.map((pessoa) => pessoa.id), 200)) {
      const [enderecos, contatos] = await Promise.all([
        banco.from("proc_pessoa_enderecos").select("pessoa_id, endereco, cep").in("pessoa_id", lote).limit(20000),
        banco.from("proc_pessoa_contatos").select("pessoa_id, tipo, valor").in("pessoa_id", lote).limit(20000),
      ]);
      if (enderecos.error) falhou("consultar os endereços", enderecos.error);
      if (contatos.error) falhou("consultar os contatos", contatos.error);
      const de = (id: string) => tem.get(id) ?? tem.set(id, { enderecos: new Set(), contatos: new Set() }).get(id)!;
      for (const item of enderecos.data ?? []) de(item.pessoa_id as string).enderecos.add(chaveDoEndereco(item as unknown as Pick<Endereco, "endereco" | "cep">));
      for (const item of contatos.data ?? []) de(item.pessoa_id as string).contatos.add(chaveDoContato(item as unknown as Pick<Contato, "tipo" | "valor">));
    }
    const novosEnderecos: Record<string, unknown>[] = [];
    const novosContatos: Record<string, unknown>[] = [];
    for (const pessoa of ligadasAgora) {
      const vios = porCi.get(pessoa.vios_ci as string) as PessoaVios;
      const patch = patchDoVios(pessoa, vios, agora);
      if (Object.keys(patch).length) {
        const { error } = await banco.from("proc_pessoas").update(patch).eq("id", pessoa.id);
        if (error) falhou(`atualizar ${pessoa.nome} pelo VIOS`, error);
        atualizadas += 1;
      }
      const meus = tem.get(pessoa.id) ?? { enderecos: new Set<string>(), contatos: new Set<string>() };
      if (vios.endereco && !meus.enderecos.has(chaveDoEndereco(vios.endereco))) {
        novosEnderecos.push({ pessoa_id: pessoa.id, endereco: vios.endereco.endereco, cidade: vios.endereco.cidade, uf: vios.endereco.uf, cep: vios.endereco.cep, origem: "vios" });
      }
      for (const contato of vios.contatos) {
        if (meus.contatos.has(chaveDoContato(contato))) continue;
        meus.contatos.add(chaveDoContato(contato));
        novosContatos.push({ pessoa_id: pessoa.id, tipo: contato.tipo, valor: contato.valor, whatsapp: false, origem: "vios" });
      }
    }

    // 5) Clientes dos grupos do recorte que ainda não estão no cadastro.
    const recorte = lerRecorte();
    const grupos = new Set((recorte.grupos ?? []).map((grupo) => chaveNome(grupo)));
    const importar = doVios.filter((pessoa) => pessoa.grupoCliente && grupos.has(chaveNome(pessoa.grupoCliente)) && !donaDoCi.has(pessoa.ci));
    const novas = importar.map((pessoa) => {
      const id = randomUUID();
      if (pessoa.endereco) novosEnderecos.push({ pessoa_id: id, endereco: pessoa.endereco.endereco, cidade: pessoa.endereco.cidade, uf: pessoa.endereco.uf, cep: pessoa.endereco.cep, origem: "vios" });
      for (const contato of pessoa.contatos) novosContatos.push({ pessoa_id: id, tipo: contato.tipo, valor: contato.valor, whatsapp: false, origem: "vios" });
      return {
        id,
        nome: pessoa.nome,
        nome_chave: chaveNome(pessoa.nome),
        documento: pessoa.documento,
        tipo: pessoa.tipo,
        nome_fantasia: pessoa.nomeFantasia,
        categoria: pessoa.categoria,
        grupo_cliente: pessoa.grupoCliente,
        etiquetas: pessoa.etiquetas,
        vios_ci: pessoa.ci,
        origem: "vios",
        vios_sincronizado_em: agora,
      };
    });
    for (const lote of emLotes(novas, 500)) {
      const { error } = await banco.from("proc_pessoas").insert(lote);
      if (error) falhou("importar os clientes do recorte", error);
    }
    for (const lote of emLotes(novosEnderecos, 500)) {
      const { error } = await banco.from("proc_pessoa_enderecos").insert(lote);
      if (error) falhou("gravar os endereços do VIOS", error);
    }
    for (const lote of emLotes(novosContatos, 500)) {
      const { error } = await banco.from("proc_pessoa_contatos").insert(lote);
      if (error) falhou("gravar os contatos do VIOS", error);
    }

    const avisos = homonimas ? [`${homonimas} pessoa(s) têm homônimos no VIOS e ficaram sem ligação: indique o CPF/CNPJ na ficha para ligar.`] : [];
    const total = nossas.length + novas.length;
    await registrar({ ...base, status: "ok", lidos: doVios.length, no_recorte: total, criados: novas.length, atualizados: ligadas, confirmados: unificadas, erro: avisos.join(" ") || null });
    return { noVios: doVios.length, pessoas: total, ligadas, unificadas, importadas: novas.length, homonimas, atualizadas, avisos };
  } catch (erro) {
    await registrar({ ...base, status: "erro", erro: erro instanceof Error ? erro.message : "Erro desconhecido" });
    throw erro;
  }
}
