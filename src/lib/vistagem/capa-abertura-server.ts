import "server-only";

import { chaveNome, usuarioPorSigla } from "./agendamento";
import {
  aliasDoDataJud,
  CAMPOS_DA_CAPA,
  capaDoDjen,
  ehChaveDaCapa,
  lerCapaDoEsaj,
  lerCnj,
  urlDoEsaj,
  type AjustesDaCapa,
  type CapaDoDataJud,
  type CapaDoDjen,
  type CapaDoEsaj,
  type CapaParaAbertura,
  type ComunicacaoDjen,
  type DefinicaoDoCampo,
  type ListasDoVios,
  type ParDaPasta,
  type StatusDaFonte,
} from "./capa-abertura";
import { VistagemError } from "./errors";
import { buscarPastasVios } from "./pastas-vios";
import { carregarCatalogoProcessos, carregarMateriasVios, carregarSistemasVios, type CatalogoArea } from "./sama";
import { admin, falhou } from "./server";
import { carregarTodasAsPastas } from "./sioe";
import { escritorioDaAreaDoProcesso, pastaAtiva } from "./triagem";
import type { SugestaoTriagem } from "./sugestao-triagem";

/** Chave pública do DataJud, publicada pelo CNJ em datajud-wiki.cnj.jus.br/api-publica/acesso (pode mudar: DATAJUD_API_KEY). */
const CHAVE_PUBLICA_DATAJUD = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

async function comPrazo<T>(ms: number, tarefa: (sinal: AbortSignal) => Promise<T>): Promise<T> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), ms);
  try {
    return await tarefa(controle.signal);
  } finally {
    clearTimeout(relogio);
  }
}

const mensagem = (erro: unknown) => (erro instanceof Error ? (erro.name === "AbortError" ? "sem resposta a tempo" : erro.message) : String(erro));

/** Comunicações do processo na API pública do DJEN (até 100, as mais recentes primeiro). */
async function buscarNoDjen(digitos: string): Promise<{ capa: CapaDoDjen | null; status: StatusDaFonte }> {
  const inicio = Date.now();
  try {
    const itens = await comPrazo(15_000, async (signal) => {
      const resposta = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=${digitos}&itensPorPagina=100`, { signal, cache: "no-store" });
      if (!resposta.ok) throw new Error(`DJEN respondeu ${resposta.status}`);
      return ((await resposta.json()) as { items?: ComunicacaoDjen[] }).items ?? [];
    });
    return { capa: itens.length ? capaDoDjen(itens) : null, status: { ok: itens.length > 0, ms: Date.now() - inicio, erro: itens.length ? null : "nenhuma comunicação" } };
  } catch (erro) {
    return { capa: null, status: { ok: false, ms: Date.now() - inicio, erro: mensagem(erro) } };
  }
}

/** Capa do processo na consulta pública do e-SAJ (só TJSP). */
async function buscarNoEsaj(url: string): Promise<{ capa: CapaDoEsaj | null; status: StatusDaFonte }> {
  const inicio = Date.now();
  try {
    const html = await comPrazo(15_000, async (signal) => {
      const resposta = await fetch(url, { signal, cache: "no-store", headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" } });
      if (!resposta.ok) throw new Error(`e-SAJ respondeu ${resposta.status}`);
      return resposta.text();
    });
    const capa = lerCapaDoEsaj(html);
    return { capa, status: { ok: Boolean(capa), ms: Date.now() - inicio, erro: capa ? null : "processo não encontrado (eproc ou segredo de justiça?)" } };
  } catch (erro) {
    return { capa: null, status: { ok: false, ms: Date.now() - inicio, erro: mensagem(erro) } };
  }
}

/**
 * Par responsável + auxiliar mais comum nas pastas vivas do grupo, na mesma área (regra da skill vios-novas-demandas).
 * O responsável vem do SIOE; o auxiliar, da sigla do "Processos Lista", trocada pelo nome do VIOS.
 */
async function parDasPastasDoGrupo(grupo: string | null, area: string | null, usuarios: CatalogoArea["usuarios"]): Promise<ParDaPasta | null> {
  if (!grupo || !area) return null;
  const pastas = (await carregarTodasAsPastas()).filter(
    (pasta) => chaveNome(pasta.grupoCliente) === chaveNome(grupo) && escritorioDaAreaDoProcesso(pasta.area) === area && pastaAtiva(pasta)
  );
  if (!pastas.length) return null;
  const vios = await buscarPastasVios(pastas.map((pasta) => pasta.ci));
  const contagem = new Map<string, ParDaPasta>();
  for (const pasta of pastas) {
    const responsavel = pasta.advogadoResponsavel?.trim() || null;
    const sigla = vios.get(pasta.ci)?.auxiliarSigla ?? null;
    const auxiliar = sigla ? usuarioPorSigla(sigla, usuarios)?.nome ?? sigla : null;
    if (!responsavel && !auxiliar) continue;
    const chave = `${chaveNome(responsavel)}|${chaveNome(auxiliar)}`;
    const atual = contagem.get(chave) ?? { responsavel, auxiliar, pastas: 0 };
    atual.pastas++;
    contagem.set(chave, atual);
  }
  return [...contagem.values()].sort((a, b) => b.pastas - a.pastas)[0] ?? null;
}

/** Usuários do VIOS sem repetir: a mesma pessoa aparece em várias áreas do catálogo (e a sigla tem de achar uma só). */
async function usuariosDoVios(): Promise<CatalogoArea["usuarios"]> {
  const catalogo = await carregarCatalogoProcessos().catch(() => [] as CatalogoArea[]);
  return [...new Map(catalogo.flatMap((item) => item.usuarios).map((usuario) => [chaveNome(usuario.nome), usuario])).values()];
}

const COLUNAS_DA_CAPA = "numero_processo, numero_processo_original, escritorio_responsavel, grupo_cliente, demanda_risco, sugestao_triagem";

type LinhaDaCapa = {
  numero_processo: string | null;
  numero_processo_original: string | null;
  escritorio_responsavel: string | null;
  grupo_cliente: string | null;
  demanda_risco: boolean | null;
  sugestao_triagem: SugestaoTriagem | null;
  capa_ajustes?: AjustesDaCapa | null;
};

/** A publicação com as edições da capa. Sem a coluna no banco (SQL ainda não rodada), abre sem edição. */
async function lerPublicacaoDaCapa(id: string): Promise<{ linha: LinhaDaCapa; podeEditar: boolean }> {
  const comAjustes = await admin().from("vistagem_publicacoes").select(`${COLUNAS_DA_CAPA}, capa_ajustes`).eq("id", id).maybeSingle();
  const semColuna = comAjustes.error?.code === "42703";
  const { data, error } = semColuna ? await admin().from("vistagem_publicacoes").select(COLUNAS_DA_CAPA).eq("id", id).maybeSingle() : comAjustes;
  if (error) falhou("carregar a publicação", error);
  if (!data) throw new VistagemError("Publicação não encontrada.", 404);
  return { linha: data as LinhaDaCapa, podeEditar: !semColuna };
}

/** Capa para a abertura de uma publicação (prévia): DJEN, e-SAJ, triagem, pastas do grupo e as edições da controladoria. */
export async function capaParaAbertura(id: string): Promise<CapaParaAbertura> {
  const { linha: data, podeEditar } = await lerPublicacaoDaCapa(id);
  const numero = (data.numero_processo ?? data.numero_processo_original) as string;
  const cnj = lerCnj(numero);
  if (!cnj) throw new VistagemError("Número de processo inválido para buscar a capa.", 422);
  const sugestao = data.sugestao_triagem;
  const area = data.escritorio_responsavel ?? sugestao?.escritorio ?? null;
  const grupo = data.grupo_cliente ?? sugestao?.grupo ?? null;
  const url = urlDoEsaj(cnj);
  const [djen, esaj, usuarios, materias, sistemas] = await Promise.all([
    buscarNoDjen(cnj.digitos),
    url ? buscarNoEsaj(url) : Promise.resolve(null),
    usuariosDoVios(),
    carregarMateriasVios().catch(() => []),
    carregarSistemasVios().catch(() => []),
  ]);
  const par = await parDasPastasDoGrupo(grupo, area, usuarios).catch((erro: unknown) => {
    console.error("[vistagem] par das pastas do grupo", mensagem(erro));
    return null;
  });
  const listas: ListasDoVios = {
    usuarios: usuarios.map((usuario) => usuario.nome).sort((a, b) => a.localeCompare(b, "pt-BR")),
    // O VIOS repete nomes de matéria (ids diferentes): na sugestão, cada nome uma vez.
    materias: [...new Set(materias.map((materia) => materia.nome))],
    sistemas: [...new Set(sistemas.map((sistema) => sistema.nome))],
  };
  return {
    dados: {
      numero,
      djen: djen.capa,
      esaj: esaj?.capa ?? null,
      datajud: null,
      area,
      grupo,
      cliente: sugestao?.cliente ?? sugestao?.referencia?.cliente ?? null,
      par,
      demandaRisco: Boolean(data.demanda_risco ?? sugestao?.demandaRisco),
    },
    fontes: { djen: djen.status, esaj: esaj?.status ?? null },
    ajustes: data.capa_ajustes ?? {},
    podeEditar,
    listas,
    geradaEm: new Date().toISOString(),
  };
}

/**
 * Edição de um campo da capa pela controladoria (lápis): grava por cima das fontes, com quem e quando.
 * `desfazer` apaga a edição e o campo volta ao valor das fontes. Só na publicação sem pasta, antes de ter CI.
 */
export async function editarCampoDaCapa(
  id: string,
  entrada: { chave?: unknown; valor?: unknown; desfazer?: unknown },
  authUserId: string
): Promise<AjustesDaCapa> {
  if (!ehChaveDaCapa(entrada.chave)) throw new VistagemError("Campo da capa desconhecido.", 400);
  const chave = entrada.chave;
  const desfazer = entrada.desfazer === true;
  if (!desfazer && typeof entrada.valor !== "string") throw new VistagemError("Informe o valor do campo.", 400);
  const valor = desfazer ? null : (entrada.valor as string).trim();
  if (valor && valor.length > 2000) throw new VistagemError("Valor longo demais (até 2.000 caracteres).", 400);
  const definicao: DefinicaoDoCampo = CAMPOS_DA_CAPA[chave];
  if (valor && definicao.opcoes && !definicao.opcoes.includes(valor)) throw new VistagemError(`Escolha ${definicao.rotulo} na lista.`, 400);

  const db = admin();
  const { data, error } = await db.from("vistagem_publicacoes").select("pendencia, pasta_ci, capa_ajustes").eq("id", id).maybeSingle();
  if (error?.code === "42703") throw new VistagemError("A edição da capa ainda não está ligada no banco (falta rodar a SQL da coluna capa_ajustes).", 503);
  if (error) falhou("carregar a publicação", error);
  if (!data) throw new VistagemError("Publicação não encontrada.", 404);
  if (data.pendencia !== "sem_pasta" || data.pasta_ci) throw new VistagemError("A capa só se edita na publicação sem pasta.", 409);

  const ajustes: AjustesDaCapa = { ...((data.capa_ajustes as AjustesDaCapa | null) ?? {}) };
  if (desfazer) delete ajustes[chave];
  else {
    const { data: usuario } = await db.from("users").select("name").eq("auth_id", authUserId).maybeSingle();
    ajustes[chave] = { valor: valor || null, por: authUserId, porNome: (usuario?.name as string | null) ?? null, em: new Date().toISOString() };
  }
  const { error: erroUpdate } = await db.from("vistagem_publicacoes").update({ capa_ajustes: ajustes }).eq("id", id);
  if (erroUpdate) falhou("gravar a edição da capa", erroUpdate);
  return ajustes;
}

type FonteDataJud = {
  sistema?: { nome?: string } | null;
  dataAjuizamento?: string | null;
  classe?: { nome?: string } | null;
  grau?: string | null;
  assuntos?: ({ nome?: string } | { nome?: string }[])[] | null;
};

/** O processo no DataJud (complemento: sistema, ajuizamento e assuntos). Falha e demora não travam nada. */
export async function capaNoDataJud(numero: string): Promise<CapaDoDataJud & { ms: number }> {
  const cnj = lerCnj(numero);
  const alias = aliasDoDataJud(cnj);
  const inicio = Date.now();
  const vazio = { achou: false, sistema: null, ajuizamento: null, assuntos: [], classe: null };
  if (!cnj || !alias) return { ...vazio, erro: "tribunal fora do DataJud", ms: 0 };
  try {
    const graus = await comPrazo(75_000, async (signal) => {
      const resposta = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`, {
        method: "POST",
        signal,
        cache: "no-store",
        headers: { Authorization: `APIKey ${process.env.DATAJUD_API_KEY?.trim() || CHAVE_PUBLICA_DATAJUD}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: { match: { numeroProcesso: cnj.digitos } }, size: 5, _source: { excludes: ["movimentos"] } }),
      });
      if (resposta.status === 429) throw new Error("DataJud sobrecarregado (429)");
      if (!resposta.ok) throw new Error(`DataJud respondeu ${resposta.status}`);
      const corpo = (await resposta.json()) as { hits?: { hits?: { _source: FonteDataJud }[] } };
      return (corpo.hits?.hits ?? []).map((hit) => hit._source);
    });
    const g = graus.find((item) => item.grau === "G1") ?? graus[0];
    if (!g) return { ...vazio, erro: "processo ainda não está no DataJud", ms: Date.now() - inicio };
    return {
      achou: true,
      erro: null,
      sistema: g.sistema?.nome ?? null,
      ajuizamento: g.dataAjuizamento ?? null,
      classe: g.classe?.nome ?? null,
      assuntos: (g.assuntos ?? []).flat().map((assunto) => assunto?.nome?.trim()).filter((nome): nome is string => Boolean(nome)),
      ms: Date.now() - inicio,
    };
  } catch (erro) {
    return { ...vazio, erro: mensagem(erro), ms: Date.now() - inicio };
  }
}

/** Número do processo da publicação (para a rota do DataJud). */
export async function numeroDaPublicacao(id: string): Promise<string> {
  const { data, error } = await admin().from("vistagem_publicacoes").select("numero_processo, numero_processo_original").eq("id", id).maybeSingle();
  if (error) falhou("carregar a publicação", error);
  if (!data) throw new VistagemError("Publicação não encontrada.", 404);
  return (data.numero_processo ?? data.numero_processo_original) as string;
}
