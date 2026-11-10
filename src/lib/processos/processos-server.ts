import "server-only";

import { COLUNAS_CREDITO, COLUNAS_PROCESSO, campoPorChave, coagirValor, textoDoValor, type ValorCampo, type Valores } from "./campos";
import { ProcessosError } from "./errors";
import { ITENS_SANEAMENTO, calcularPreenchimento } from "./preenchimento";
import { db, emLotes, falhou, gravacaoSimulada, type Ator } from "./server";
import type { Alteracao, Contato, Endereco, EnvioVios, OrigemAlteracao, Parte, ProcessoDetalhe, ProcessoResumo, StatusEnvio } from "./types";

const ENVIOS_ABERTOS: StatusEnvio[] = ["pendente", "enviado", "erro"];

const SELECAO_PARTES =
  "id, polo, papel, vinculo, devedor, referente_a, origem, ordem, created_at, pessoa:proc_pessoas(id, nome, documento, oab, observacao, enderecos:proc_pessoa_enderecos(id, endereco, cidade, uf, cep, observacao, origem, created_at), contatos:proc_pessoa_contatos(id, tipo, valor, whatsapp, observacao, origem, created_at))";

const SELECAO_PROCESSO = `id, ${COLUNAS_PROCESSO.join(", ")}, itens_nao_aplicaveis, sincronizado_em, vios_editado_em, credito:proc_credito(${COLUNAS_CREDITO.join(", ")}), partes:proc_partes(${SELECAO_PARTES})`;

type Linha = Record<string, unknown>;

function um<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

function porCriacao(a: Linha, b: Linha): number {
  return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
}

function paraParte(linha: Linha): Parte | null {
  const pessoa = um(linha.pessoa as Linha | Linha[] | null);
  if (!pessoa) return null;
  const enderecos = ((pessoa.enderecos as Linha[] | null) ?? []).slice().sort(porCriacao);
  const contatos = ((pessoa.contatos as Linha[] | null) ?? []).slice().sort(porCriacao);
  return {
    id: linha.id as string,
    polo: linha.polo as Parte["polo"],
    papel: linha.papel as Parte["papel"],
    vinculo: (linha.vinculo as string | null) ?? null,
    devedor: linha.devedor === true,
    referenteA: (linha.referente_a as string | null) ?? null,
    origem: linha.origem as Parte["origem"],
    pessoaId: pessoa.id as string,
    nome: pessoa.nome as string,
    documento: (pessoa.documento as string | null) ?? null,
    oab: (pessoa.oab as string | null) ?? null,
    observacao: (pessoa.observacao as string | null) ?? null,
    enderecos: enderecos.map(
      (item): Endereco => ({
        id: item.id as string,
        endereco: item.endereco as string,
        cidade: (item.cidade as string | null) ?? null,
        uf: (item.uf as string | null) ?? null,
        cep: (item.cep as string | null) ?? null,
        observacao: (item.observacao as string | null) ?? null,
        origem: item.origem as Endereco["origem"],
      })
    ),
    contatos: contatos.map(
      (item): Contato => ({
        id: item.id as string,
        tipo: item.tipo as Contato["tipo"],
        valor: item.valor as string,
        whatsapp: item.whatsapp === true,
        observacao: (item.observacao as string | null) ?? null,
        origem: item.origem as Contato["origem"],
      })
    ),
  };
}

const ORDEM_POLO: Record<string, number> = { ativo: 0, passivo: 1, terceiro: 2 };

function partesDaLinha(linha: Linha): Parte[] {
  const brutas = ((linha.partes as Linha[] | null) ?? []).slice().sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0) || porCriacao(a, b));
  const partes = brutas.map(paraParte).filter((parte): parte is Parte => parte !== null);
  return partes.sort((a, b) => (ORDEM_POLO[a.polo] ?? 9) - (ORDEM_POLO[b.polo] ?? 9));
}

function valoresDaLinha(linha: Linha): Valores {
  const valores: Valores = {};
  for (const coluna of COLUNAS_PROCESSO) valores[coluna] = (linha[coluna] as ValorCampo | undefined) ?? null;
  const credito = um(linha.credito as Linha | Linha[] | null);
  for (const coluna of COLUNAS_CREDITO) valores[coluna] = (credito?.[coluna] as ValorCampo | undefined) ?? null;
  return valores;
}

function texto(valor: ValorCampo | undefined): string | null {
  return typeof valor === "string" && valor ? valor : null;
}

/** Todos os processos do cadastro, com o preenchimento do saneamento e os envios em aberto. */
export async function listarProcessos(): Promise<ProcessoResumo[]> {
  const linhas: Linha[] = [];
  for (let inicio = 0; ; inicio += 500) {
    const { data, error } = await db().from("proc_processos").select(SELECAO_PROCESSO).order("ci", { ascending: false }).range(inicio, inicio + 499);
    if (error) falhou("carregar os processos", error);
    linhas.push(...((data ?? []) as unknown as Linha[]));
    if (!data || data.length < 500) break;
  }
  const pendentes = new Map<string, number>();
  const { data: envios, error: erroEnvios } = await db().from("proc_vios_envios").select("processo_id").in("status", ENVIOS_ABERTOS).limit(10000);
  if (erroEnvios) falhou("carregar a fila do VIOS", erroEnvios);
  for (const envio of envios ?? []) pendentes.set(envio.processo_id as string, (pendentes.get(envio.processo_id as string) ?? 0) + 1);

  return linhas.map((linha) => {
    const valores = valoresDaLinha(linha);
    const partes = partesDaLinha(linha);
    const preenchimento = calcularPreenchimento(valores, partes, (linha.itens_nao_aplicaveis as string[] | null) ?? []);
    // As partes ficam em proc_partes; os campos de texto do processo só vêm preenchidos de algumas cargas.
    const nomesDoPolo = (polo: Parte["polo"]) => partes.filter((parte) => parte.papel === "parte" && parte.polo === polo).map((parte) => parte.nome).join("; ") || null;
    return {
      id: linha.id as string,
      ci: texto(valores.ci),
      cnj: texto(valores.cnj),
      grupoCliente: texto(valores.grupo_cliente),
      cliente: texto(valores.cliente),
      area: texto(valores.area),
      acao: texto(valores.acao),
      fase: texto(valores.fase),
      situacao: texto(valores.situacao),
      uf: texto(valores.uf),
      comarca: texto(valores.comarca_tribunal),
      advogadoResponsavel: texto(valores.advogado_responsavel),
      parteAtiva: nomesDoPolo("ativo") ?? texto(valores.parte_ativa),
      partePassiva: nomesDoPolo("passivo") ?? texto(valores.parte_passiva),
      valorAcao: typeof valores.valor_acao === "number" ? valores.valor_acao : null,
      etiquetas: Array.isArray(valores.etiquetas) ? valores.etiquetas : [],
      pendentesVios: pendentes.get(linha.id as string) ?? 0,
      feitos: preenchimento.feitos,
      total: preenchimento.total,
      percentual: preenchimento.percentual,
      faltando: preenchimento.itens.filter((item) => item.estado === "falta").map((item) => item.rotulo),
    };
  });
}

function paraEnvio(linha: Linha): EnvioVios {
  return {
    id: linha.id as string,
    processoId: linha.processo_id as string,
    ci: (linha.ci as string | null) ?? null,
    campo: linha.campo as string,
    valorVios: (linha.valor_vios as string | null) ?? null,
    valorNovo: (linha.valor_novo as string | null) ?? null,
    status: linha.status as StatusEnvio,
    simulado: linha.simulado === true,
    erro: (linha.erro as string | null) ?? null,
    autor: (linha.criado_por_nome as string | null) ?? null,
    quando: linha.atualizado_em as string,
  };
}

const COLUNAS_ENVIO = "id, processo_id, ci, campo, valor_vios, valor_novo, status, simulado, erro, criado_por_nome, atualizado_em";

async function carregarLinha(id: string): Promise<Linha> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ProcessosError("Processo não encontrado.", 404);
  const { data, error } = await db().from("proc_processos").select(SELECAO_PROCESSO).eq("id", id).maybeSingle();
  if (error) falhou("carregar o processo", error);
  if (!data) throw new ProcessosError("Processo não encontrado.", 404);
  return data as unknown as Linha;
}

export async function detalharProcesso(id: string): Promise<ProcessoDetalhe> {
  const linha = await carregarLinha(id);
  const [historico, envios] = await Promise.all([
    db().from("proc_alteracoes").select("id, campo, valor_anterior, valor_novo, origem, autor_nome, criado_em").eq("processo_id", id).order("criado_em", { ascending: false }).limit(200),
    db().from("proc_vios_envios").select(COLUNAS_ENVIO).eq("processo_id", id).order("atualizado_em", { ascending: false }).limit(100),
  ]);
  if (historico.error) falhou("carregar o histórico", historico.error);
  if (envios.error) falhou("carregar a fila do VIOS", envios.error);
  const valores = valoresDaLinha(linha);
  const partes = partesDaLinha(linha);
  const naoAplicaveis = (linha.itens_nao_aplicaveis as string[] | null) ?? [];
  return {
    id,
    valores,
    partes,
    historico: (historico.data ?? []).map(
      (item): Alteracao => ({
        id: item.id as string,
        campo: item.campo as string,
        anterior: (item.valor_anterior as string | null) ?? null,
        novo: (item.valor_novo as string | null) ?? null,
        origem: item.origem as Alteracao["origem"],
        autor: (item.autor_nome as string | null) ?? null,
        quando: item.criado_em as string,
      })
    ),
    envios: ((envios.data ?? []) as Linha[]).map(paraEnvio),
    preenchimento: calcularPreenchimento(valores, partes, naoAplicaveis),
    naoAplicaveis,
    sincronizadoEm: (linha.sincronizado_em as string | null) ?? null,
    viosEditadoEm: (linha.vios_editado_em as string | null) ?? null,
    gravacaoSimulada: gravacaoSimulada(),
  };
}

/** Processos com partes, para a planilha. */
export async function carregarParaPlanilha(ids: string[] | null): Promise<{ valores: Valores; partes: Parte[] }[]> {
  const linhas: Linha[] = [];
  if (ids) {
    for (const lote of emLotes(ids, 100)) {
      const { data, error } = await db().from("proc_processos").select(SELECAO_PROCESSO).in("id", lote);
      if (error) falhou("carregar os processos", error);
      linhas.push(...((data ?? []) as unknown as Linha[]));
    }
  } else {
    for (let inicio = 0; ; inicio += 500) {
      const { data, error } = await db().from("proc_processos").select(SELECAO_PROCESSO).order("ci").range(inicio, inicio + 499);
      if (error) falhou("carregar os processos", error);
      linhas.push(...((data ?? []) as unknown as Linha[]));
      if (!data || data.length < 500) break;
    }
  }
  return linhas.map((linha) => ({ valores: valoresDaLinha(linha), partes: partesDaLinha(linha) }));
}

/**
 * Uma linha no histórico do processo que não é troca de campo simples (partes, itens do saneamento, autos).
 * `origem` é "ia" quando a gravação veio de uma sugestão aprovada; o autor continua sendo quem aprovou.
 */
export async function registrarNoHistorico(processoId: string, campo: string, anterior: string | null, novo: string | null, ator: Ator, origem: OrigemAlteracao = "manual"): Promise<void> {
  const { error } = await db()
    .from("proc_alteracoes")
    .insert({ processo_id: processoId, campo, valor_anterior: anterior, valor_novo: novo, origem, autor_id: ator.authUserId, autor_nome: ator.nome });
  if (error) falhou("registrar o histórico", error);
}

/**
 * Edição do cadastro pela tela ou por sugestão da IA aprovada (`origem` "ia"). Cada campo alterado vira
 * uma linha no histórico; campo que existe no VIOS entra na fila de gravação (um envio em aberto por
 * campo: editar de novo atualiza o mesmo envio, voltar ao valor do VIOS cancela).
 */
export async function atualizarProcesso(id: string, entrada: Record<string, unknown>, ator: Ator, origem: OrigemAlteracao = "manual"): Promise<ProcessoDetalhe> {
  const linha = await carregarLinha(id);
  const atuais = valoresDaLinha(linha);
  const patchProcesso: Valores = {};
  const patchCredito: Valores = {};
  const mudancas: { campo: string; anterior: string; novo: string; vios: boolean }[] = [];

  for (const [chave, bruto] of Object.entries(entrada)) {
    const item = campoPorChave(chave);
    if (!item) throw new ProcessosError(`Campo desconhecido: ${chave}.`, 400);
    if (!item.editavel) throw new ProcessosError(`O campo "${item.rotulo}" não pode ser editado aqui.`, 400);
    const valor = coagirValor(item, bruto);
    if (valor === undefined) throw new ProcessosError(`Valor inválido para "${item.rotulo}".`, 400);
    const anterior = textoDoValor(item, atuais[chave]);
    const novo = textoDoValor(item, valor);
    if (anterior === novo) continue;
    (item.tabela === "credito" ? patchCredito : patchProcesso)[chave] = valor;
    mudancas.push({ campo: chave, anterior, novo, vios: item.origem === "vios" });
  }
  if (!mudancas.length) return detalharProcesso(id);

  if (Object.keys(patchProcesso).length) {
    const { error } = await db().from("proc_processos").update(patchProcesso).eq("id", id);
    if (error) falhou("salvar o processo", error);
  }
  if (Object.keys(patchCredito).length) {
    const { error } = await db().from("proc_credito").upsert({ processo_id: id, ...patchCredito }, { onConflict: "processo_id" });
    if (error) falhou("salvar os dados do crédito", error);
  }
  const { error: erroHistorico } = await db()
    .from("proc_alteracoes")
    .insert(
      mudancas.map((mudanca) => ({
        processo_id: id,
        campo: mudanca.campo,
        valor_anterior: mudanca.anterior || null,
        valor_novo: mudanca.novo || null,
        origem,
        autor_id: ator.authUserId,
        autor_nome: ator.nome,
      }))
    );
  if (erroHistorico) falhou("registrar o histórico", erroHistorico);

  const paraVios = mudancas.filter((mudanca) => mudanca.vios);
  if (paraVios.length) {
    const { data: abertos, error } = await db()
      .from("proc_vios_envios")
      .select("id, campo, valor_vios")
      .eq("processo_id", id)
      .in("status", ENVIOS_ABERTOS)
      .in(
        "campo",
        paraVios.map((mudanca) => mudanca.campo)
      );
    if (error) falhou("consultar a fila do VIOS", error);
    const abertoPorCampo = new Map((abertos ?? []).map((envio) => [envio.campo as string, envio]));
    const agora = new Date().toISOString();
    for (const mudanca of paraVios) {
      const aberto = abertoPorCampo.get(mudanca.campo);
      if (aberto) {
        const voltou = ((aberto.valor_vios as string | null) ?? "") === mudanca.novo;
        const { error: erroEnvio } = await db()
          .from("proc_vios_envios")
          .update(voltou ? { status: "cancelado", atualizado_em: agora } : { valor_novo: mudanca.novo || null, status: "pendente", erro: null, atualizado_em: agora })
          .eq("id", aberto.id as string);
        if (erroEnvio) falhou("atualizar a fila do VIOS", erroEnvio);
      } else {
        const { error: erroEnvio } = await db()
          .from("proc_vios_envios")
          .insert({
            processo_id: id,
            ci: texto(atuais.ci),
            campo: mudanca.campo,
            valor_vios: mudanca.anterior || null,
            valor_novo: mudanca.novo || null,
            simulado: gravacaoSimulada(),
            criado_por: ator.authUserId,
            criado_por_nome: ator.nome,
          });
        if (erroEnvio) falhou("colocar a alteração na fila do VIOS", erroEnvio);
      }
    }
  }
  return detalharProcesso(id);
}

const CHAVES_SANEAMENTO = new Set(ITENS_SANEAMENTO.map((item) => item.chave));

/** Marca (ou desmarca) um item do saneamento como "não se aplica" neste processo. */
export async function marcarNaoAplicavel(id: string, chave: string, naoSeAplica: boolean, ator: Ator): Promise<ProcessoDetalhe> {
  if (!CHAVES_SANEAMENTO.has(chave)) throw new ProcessosError("Item de saneamento desconhecido.", 400);
  const linha = await carregarLinha(id);
  const atuais = new Set((linha.itens_nao_aplicaveis as string[] | null) ?? []);
  if (atuais.has(chave) === naoSeAplica) return detalharProcesso(id);
  if (naoSeAplica) atuais.add(chave);
  else atuais.delete(chave);
  const { error } = await db().from("proc_processos").update({ itens_nao_aplicaveis: [...atuais] }).eq("id", id);
  if (error) falhou("salvar o saneamento", error);
  const rotulo = ITENS_SANEAMENTO.find((item) => item.chave === chave)?.rotulo ?? chave;
  await registrarNoHistorico(id, "saneamento", null, `${rotulo}: ${naoSeAplica ? "não se aplica" : "volta a contar"}`, ator);
  return detalharProcesso(id);
}

/** Fila de gravação no VIOS (as mais recentes primeiro). */
export async function listarEnvios(limite = 200): Promise<EnvioVios[]> {
  const { data, error } = await db().from("proc_vios_envios").select(COLUNAS_ENVIO).order("atualizado_em", { ascending: false }).limit(limite);
  if (error) falhou("carregar a fila do VIOS", error);
  return ((data ?? []) as Linha[]).map(paraEnvio);
}
