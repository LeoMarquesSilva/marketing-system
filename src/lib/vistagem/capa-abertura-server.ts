import "server-only";

import { chaveNome, paraDataVios, usuarioPorSigla } from "./agendamento";
import {
  aliasDoDataJud,
  CAMPOS_DA_CAPA,
  capaDoDjen,
  capaParaOVios,
  ciDaPastaAberta,
  ehChaveDaCapa,
  lerCapaDoEsaj,
  lerCnj,
  listasDasPastas,
  montarCapa,
  pastaDaCapaAberta,
  situacaoDaAberturaReal,
  problemasParaOVios,
  resumoDaCapa,
  tarefasDaAbertura,
  TAREFA_DA_PASTA_NOVA,
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
  type PedidoDeAbertura,
  type StatusDaFonte,
} from "./capa-abertura";
import { VistagemError } from "./errors";
import { buscarPastasVios } from "./pastas-vios";
import {
  aberturasDaPublicacao,
  carregarCatalogoProcessos,
  carregarMateriasVios,
  carregarSistemasVios,
  enfileirarAberturaDePasta,
  tipoDeTarefaPorNome,
  type CatalogoArea,
} from "./sama";
import { lerConfiguracoes } from "./configuracoes-server";
import { criarCalendario } from "./dias-uteis";
import { carregarFeriados } from "./feriados";
import { admin, falhou, hojeEmSaoPaulo } from "./server";
import { buscarPastasDoGrupo, buscarPastasPorCnj, carregarTodasAsPastas } from "./sioe";
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
  // Só as pastas do grupo no SIOE (não as ~35 mil): o filtro abaixo é o mesmo de antes.
  const pastas = (await buscarPastasDoGrupo(grupo)).filter(
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

let listasEmCache: { origem: Awaited<ReturnType<typeof carregarTodasAsPastas>>; listas: ReturnType<typeof listasDasPastas> } | null = null;

/**
 * Clientes, ações e etiquetas das ~35 mil pastas. Montar leva uns 400 ms de CPU: fica guardado enquanto o cache das
 * pastas (30 min) devolver a mesma lista.
 */
async function listasDoProcessoCompleto(): Promise<ReturnType<typeof listasDasPastas>> {
  const pastas = await carregarTodasAsPastas();
  if (listasEmCache?.origem !== pastas) listasEmCache = { origem: pastas, listas: listasDasPastas(pastas) };
  return listasEmCache.listas;
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

/** Guarda no mapa (o mais novo no fim) e tira o mais antigo quando passa do limite. */
function guardarNoLimite<T>(mapa: Map<string, T>, chave: string, valor: T, limite = 300): void {
  mapa.delete(chave);
  mapa.set(chave, valor);
  if (mapa.size > limite) {
    const maisAntigo = mapa.keys().next().value;
    if (maisAntigo !== undefined) mapa.delete(maisAntigo);
  }
}

type FontesDoProcesso = {
  em: number;
  djen: Awaited<ReturnType<typeof buscarNoDjen>>;
  esaj: Awaited<ReturnType<typeof buscarNoEsaj>> | null;
};

/** DJEN e e-SAJ de cada processo, guardados nesta instância por 30 min: reabrir a capa não busca de novo. */
const FONTES_MS = 30 * 60 * 1000;
const fontesEmCache = new Map<string, FontesDoProcesso>();

async function fontesDoProcesso(digitos: string, url: string | null, fresco: boolean): Promise<FontesDoProcesso> {
  const guardado = fontesEmCache.get(digitos);
  if (!fresco && guardado && Date.now() - guardado.em < FONTES_MS) return guardado;
  const [djen, esaj] = await Promise.all([buscarNoDjen(digitos), url ? buscarNoEsaj(url) : Promise.resolve(null)]);
  const fontes: FontesDoProcesso = { em: Date.now(), djen, esaj };
  // Sem resposta de nenhuma das duas (fora do ar, sem tempo): a próxima abertura tenta de novo.
  if (djen.status.ok || esaj?.status.ok) guardarNoLimite(fontesEmCache, digitos, fontes);
  return fontes;
}

/**
 * As listas do VIOS da capa (usuários, matérias, sistemas, clientes, ações e etiquetas). São iguais para toda
 * publicação e as de clientes, ações e etiquetas saem das ~35 mil pastas do SIOE: a tela pede à parte, uma vez, e o
 * navegador guarda.
 */
export async function listasDaCapa(): Promise<ListasDoVios> {
  const [usuarios, materias, sistemas, doProcessoCompleto] = await Promise.all([
    usuariosDoVios(),
    carregarMateriasVios().catch(() => []),
    carregarSistemasVios().catch(() => []),
    // Clientes, ações e etiquetas como o VIOS grava (Processos Completo, no SIOE). Sem elas, os campos ficam em texto livre.
    listasDoProcessoCompleto().catch((erro: unknown) => {
      console.error("[vistagem] listas do Processos Completo", mensagem(erro));
      return { clientes: [], acoes: [], etiquetas: [] };
    }),
  ]);
  return {
    usuarios: usuarios.map((usuario) => usuario.nome).sort((a, b) => a.localeCompare(b, "pt-BR")),
    // O VIOS repete nomes de matéria (ids diferentes): na sugestão, cada nome uma vez.
    materias: [...new Set(materias.map((materia) => materia.nome))],
    sistemas: [...new Set(sistemas.map((sistema) => sistema.nome))],
    ...doProcessoCompleto,
  };
}

/** A capa sem as listas do VIOS (a tela junta com `listasDaCapa`). */
export type CapaSemListas = Omit<CapaParaAbertura, "listas">;

/**
 * Capa para a abertura de uma publicação (prévia): DJEN, e-SAJ, triagem, pastas do grupo e as edições da controladoria,
 * sem as listas do VIOS. `fresco` ("Buscar de novo") consulta o DJEN e o e-SAJ mesmo que estejam guardados.
 */
export async function capaSemListas(id: string, { fresco = false }: { fresco?: boolean } = {}): Promise<CapaSemListas> {
  const { linha: data, podeEditar } = await lerPublicacaoDaCapa(id);
  const numero = (data.numero_processo ?? data.numero_processo_original) as string;
  const cnj = lerCnj(numero);
  if (!cnj) throw new VistagemError("Número de processo inválido para buscar a capa.", 422);
  const sugestao = data.sugestao_triagem;
  const area = data.escritorio_responsavel ?? sugestao?.escritorio ?? null;
  const grupo = data.grupo_cliente ?? sugestao?.grupo ?? null;
  const [{ djen, esaj }, usuarios] = await Promise.all([fontesDoProcesso(cnj.digitos, urlDoEsaj(cnj), fresco), usuariosDoVios()]);
  const par = await parDasPastasDoGrupo(grupo, area, usuarios).catch((erro: unknown) => {
    console.error("[vistagem] par das pastas do grupo", mensagem(erro));
    return null;
  });
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
    geradaEm: new Date().toISOString(),
  };
}

/** Capa completa, com as listas do VIOS, consultando as fontes na hora (o pedido ao robô usa esta). */
export async function capaParaAbertura(id: string): Promise<CapaParaAbertura> {
  const [capa, listas] = await Promise.all([capaSemListas(id, { fresco: true }), listasDaCapa()]);
  return { ...capa, listas };
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

export const SEM_PROCESSO_NO_DATAJUD = "processo ainda não está no DataJud";
const FORA_DO_DATAJUD = "tribunal fora do DataJud";

/**
 * Por quantos segundos a resposta do DataJud vale: achou (ou tribunal fora dele), 12 h; processo ainda não indexado,
 * 2 h (o CNJ indexa com atraso); falha ou sobrecarga, 0 (a próxima abertura tenta de novo).
 */
export function validadeDoDataJud(resultado: CapaDoDataJud): number {
  if (resultado.achou || resultado.erro === FORA_DO_DATAJUD) return 12 * 60 * 60;
  if (resultado.erro === SEM_PROCESSO_NO_DATAJUD) return 2 * 60 * 60;
  return 0;
}

/** O DataJud de cada processo, guardado nesta instância pela validade acima (a consulta leva de 15 s a 1 min). */
const dataJudEmCache = new Map<string, { ate: number; resultado: CapaDoDataJud & { ms: number } }>();

/**
 * O processo no DataJud (complemento: sistema, ajuizamento e assuntos). Falha e demora não travam nada. `fresco`
 * ("Buscar de novo") consulta mesmo que esteja guardado.
 */
export async function capaNoDataJud(numero: string, { fresco = false }: { fresco?: boolean } = {}): Promise<CapaDoDataJud & { ms: number }> {
  const chave = lerCnj(numero)?.digitos ?? numero;
  const guardado = dataJudEmCache.get(chave);
  if (!fresco && guardado && guardado.ate > Date.now()) return guardado.resultado;
  const resultado = await consultarDataJud(numero);
  const validade = validadeDoDataJud(resultado);
  if (validade) guardarNoLimite(dataJudEmCache, chave, { ate: Date.now() + validade * 1000, resultado });
  return resultado;
}

async function consultarDataJud(numero: string): Promise<CapaDoDataJud & { ms: number }> {
  const cnj = lerCnj(numero);
  const alias = aliasDoDataJud(cnj);
  const inicio = Date.now();
  const vazio = { achou: false, sistema: null, ajuizamento: null, assuntos: [], classe: null };
  if (!cnj || !alias) return { ...vazio, erro: FORA_DO_DATAJUD, ms: 0 };
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
    if (!g) return { ...vazio, erro: SEM_PROCESSO_NO_DATAJUD, ms: Date.now() - inicio };
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

/** O que a tela da abertura precisa: os pedidos ao robô, se a abertura de verdade está ligada e a pasta aberta. */
export interface AberturaDaPublicacao {
  pedidos: PedidoDeAbertura[];
  /** Configurações › Robô: abertura de pasta de verdade. */
  aberturaReal: boolean;
  /**
   * Depois da abertura de verdade: a CI nova. `naTriagem`: a publicação está na Triagem Manual, com a CI, esperando a
   * responsável conferir e liberar; `liberada`: já saiu da triagem com essa CI.
   */
  pastaAberta: { ci: string; naTriagem: boolean; liberada: boolean } | null;
}

/** Grupo do cliente pelas pastas que ele já tem no VIOS (o mais frequente), ou o que a triagem sugeriu. */
async function grupoDoCliente(cliente: string | null, sugerido: string | null): Promise<string | null> {
  if (cliente) {
    const listas = await listasDoProcessoCompleto().catch(() => null);
    const achado = listas?.clientes.find((item) => chaveNome(item.nome) === chaveNome(cliente));
    if (achado?.grupo) return achado.grupo;
  }
  return sugerido;
}

/**
 * Fase 3: depois que o robô abriu a pasta de verdade, a publicação continua na Triagem Manual, agora com a CI nova
 * (pedido do usuário, 16/11/2026: a responsável confere a pasta no VIOS e libera, em vez de ir direto para a
 * vistagem). A pasta vai montada da capa entre as candidatas, porque o SIOE só a copia de madrugada; o "Liberar para o
 * jurídico" da triagem acha a CI ali. Repetir não faz mal: só grava com a publicação ainda pendente.
 */
async function registrarPastaAberta(id: string, pedido: PedidoDeAbertura): Promise<AberturaDaPublicacao["pastaAberta"]> {
  const ci = ciDaPastaAberta(pedido);
  if (!ci || !pedido.capa) return null;
  const { data: publicacao, error } = await admin()
    .from("vistagem_publicacoes")
    .select("status, pasta_ci, sugestao_triagem")
    .eq("id", id)
    .maybeSingle();
  if (error) falhou("carregar a publicação", error);
  if (!publicacao) return null;
  if (publicacao.status !== "triagem_pendente") return { ci, naTriagem: false, liberada: publicacao.pasta_ci === ci };
  if (publicacao.pasta_ci !== ci) {
    const sugestao = publicacao.sugestao_triagem as SugestaoTriagem | null;
    const pasta = pastaDaCapaAberta(ci, pedido.capa, await grupoDoCliente(pedido.capa.cliente, sugestao?.grupo ?? null));
    const { error: erroPasta } = await admin()
      .from("vistagem_publicacoes")
      .update({ pasta_ci: ci, pastas_candidatas: [pasta] })
      .eq("id", id)
      .eq("status", "triagem_pendente");
    if (erroPasta) falhou("gravar a pasta aberta na publicação", erroPasta);
  }
  return { ci, naTriagem: true, liberada: false };
}

/**
 * Os pedidos de abertura da publicação ao robô (o mais novo primeiro). Se a última abertura de verdade terminou, a
 * publicação fica com a CI nova, na Triagem Manual, para a responsável conferir e liberar.
 */
export async function pedidosDeAbertura(id: string): Promise<AberturaDaPublicacao> {
  const [pedidos, configuracoes] = await Promise.all([aberturasDaPublicacao(id), lerConfiguracoes()]);
  const real = pedidos.find((pedido) => !pedido.simulado);
  const pastaAberta = real ? await registrarPastaAberta(id, real) : null;
  return { pedidos, aberturaReal: configuracoes.aberturaPastaReal, pastaAberta };
}

/**
 * Pede ao robô a abertura da pasta com a capa como está (fontes + edições da controladoria): simulação (Fase 2) ou,
 * com a chave de Configurações ligada, de verdade, direto (Fase 3, `situacaoDaAberturaReal`). Recusa se faltar
 * obrigatório do VIOS, se a publicação já tiver pasta (aqui ou no SIOE) ou se já houver pedido na fila. O robô ainda
 * confere no VIOS, antes de gravar, que o número não tem pasta, e só grava se o VIOS aceitar a capa inteira.
 */
export async function pedirAberturaDaPasta(
  id: string,
  authUserId: string,
  modo: "simular" | "abrir" = "simular",
  { conferidoNoVios = false }: { conferidoNoVios?: boolean } = {}
): Promise<AberturaDaPublicacao> {
  const { data: publicacao, error } = await admin().from("vistagem_publicacoes").select("pendencia, pasta_ci").eq("id", id).maybeSingle();
  if (error) falhou("carregar a publicação", error);
  if (!publicacao) throw new VistagemError("Publicação não encontrada.", 404);
  if (publicacao.pendencia !== "sem_pasta" || publicacao.pasta_ci) throw new VistagemError("Esta publicação já tem pasta.", 409);

  const capa = await capaParaAbertura(id);
  const campos = montarCapa(capa.dados, { ajustes: capa.ajustes, listas: capa.listas });
  const { faltando } = resumoDaCapa(campos);
  if (faltando.length) throw new VistagemError(`Preencha os obrigatórios do VIOS: ${faltando.map((campo) => campo.campo).join(", ")}.`, 422);
  const paraOVios = capaParaOVios(campos);
  const problemas = problemasParaOVios(paraOVios);
  if (problemas.length) throw new VistagemError(`${problemas.join("; ")}.`, 422);

  const cnj = lerCnj(capa.dados.numero);
  const noSioe = cnj ? (await buscarPastasPorCnj([cnj.digitos])).get(cnj.digitos) ?? [] : [];
  if (noSioe.length) throw new VistagemError(`O processo já tem pasta no VIOS: CI ${noSioe.map((pasta) => pasta.ci).join(", ")}.`, 409);

  const anteriores = await aberturasDaPublicacao(id);
  if (anteriores.some((pedido) => ["pendente", "enviado", "processando"].includes(pedido.status))) {
    throw new VistagemError("Já há um pedido de abertura desta publicação na fila do robô.", 409);
  }
  if (modo === "abrir") {
    if (!(await lerConfiguracoes()).aberturaPastaReal) {
      throw new VistagemError("A abertura de verdade está desligada (Vistagem › Configurações › Robô: abertura de pasta).", 409);
    }
    const situacao = situacaoDaAberturaReal(anteriores, { conferidoNoVios });
    if (!situacao.pode) throw new VistagemError(situacao.motivo, 409);
  }
  const [{ data: usuario }, tipo, feriados] = await Promise.all([
    admin().from("users").select("name").eq("auth_id", authUserId).maybeSingle(),
    tipoDeTarefaPorNome(TAREFA_DA_PASTA_NOVA),
    carregarFeriados().catch(() => [] as string[]),
  ]);
  const hoje = hojeEmSaoPaulo();
  await enfileirarAberturaDePasta({
    publicacaoId: id,
    capa: paraOVios,
    autor: (usuario?.name as string | null) ?? "Controladoria",
    data: paraDataVios(hoje),
    simular: modo !== "abrir",
    // A pasta nova já leva a ATUALIZAÇÃO DE CADASTRO, para o dia útil seguinte (pedido de 17/11/2026).
    tarefas: tarefasDaAbertura(tipo, hoje, criarCalendario(feriados)),
  });
  return pedidosDeAbertura(id);
}
