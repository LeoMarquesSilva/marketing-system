import "server-only";

import {
  ETIQUETAS_AGENDAMENTO,
  areaDoCatalogo,
  chaveDoCaminho,
  nomesDasPessoas,
  pessoasDaArea,
  responsavelSugerido,
  responsaveisNaArea,
  tarefasPermitidas,
  usuarioPorSigla,
  validarAgendamentos,
  type AgendamentoEntrada,
  type AgendamentoValidado,
  type EtiquetaAgendamento,
  type OpcaoTarefa,
  type OpcaoVios,
} from "./agendamento";
import { openAIKey } from "@/lib/openai-keys";
import { enviarDoPrazo, mudancasNaTarefa, podeEditarNaConferencia, type CamposDaTarefa } from "./ajuste-conferencia";
import { registrarNoBkpSemFalhar } from "./bkp-sioe-server";
import { vaiParaCentral } from "./central";
import { enviarParaCentral } from "./central-server";
import { cienciaDosAgendamentos, cienciaQueFica, ehCienciaDosAgendamentos, ehReestruturacao } from "./ciencia-agendamentos";
import { criarCalendario, criarCalendarioDePrazo, type ContagemPrazo } from "./dias-uteis";
import { RESPONSAVEL_ESOCIAL, pedeEsocial, tarefaEsocialDaLista, validarEsocial } from "./esocial";
import { areaComSugestaoIa, fatalSugerida, resultadoDaSugestao, sugestaoNaListaAtual, type ResultadoSugestao, type SugestaoIa } from "./sugestao-ia";
import { carregarFeriados } from "./feriados";
import { lerConfiguracoes } from "./configuracoes-server";
import { arvoreDaArea, cadeiaDoFluxo, montarFluxo, semPrazoProprio, type FluxoDaTarefa, type TipoNaArvore } from "./fluxo-vios";
import { caminhosDoFluxo, fluxoParaOVios, fluxoPrevisto, prazoApertado } from "./fluxo-previsto";
import { buscarPastasVios } from "./pastas-vios";
import { pessoasPorNome, type PessoasPorNome } from "./pessoas-server";
import { VistagemError } from "./errors";
import { validarInconsistencia, type InconsistenciaEntrada } from "./inconsistencias";
import { linhasParaFila, modoDaPublicacao, type TarefaNoVios } from "./fila-vios";
import { LIMITE_TRECHO_SINTESE, materiasDaLista, precisaDeMateria } from "./dados-processo";
import { buscarPastaPorCi, buscarSinteseDaPasta, pastaSemMateria } from "./sioe";
import { ESCRITORIOS, type PastaSioe } from "./triagem";
import {
  carregarArvoreVios,
  carregarCatalogoProcessos,
  carregarMateriasVios,
  catalogoDaArea,
  consultarFilaSama,
  enfileirarNoSama,
  enfileirarSintese,
  envioSimulado,
  modoAgendamento,
  sinteseSimulada,
  sintesesDaPasta,
  type CatalogoArea,
} from "./sama";
import { COLUNAS_PUBLICACAO, admin, falhou, hojeEmSaoPaulo, publicacaoResumo, resolverPendencia, type PublicacaoRow } from "./server";
import type {
  AgendadasJuridicoResposta,
  AgendamentoResumo,
  AjusteNaTarefa,
  CatalogoVistagem,
  ConferenciaItem,
  ConferenciaResposta,
  CheckResposta,
  DataDoFluxo,
  DjenParte,
  EnvioStatus,
  InconsistenciaItem,
  InconsistenciaResumo,
  MateriaVios,
  PublicacaoResumo,
  ResolucaoPendencia,
  ResultadoCentral,
  SintesePedida,
  SugestaoNaVistagem,
  VistagemDetalhe,
} from "./types";

const COLUNAS_AGENDAMENTO =
  "id, publicacao_id, ordem, etiqueta, tarefa, tarefa_id, data, data_fatal, dias_prazo, contagem_prazo, hora, hora_fim, responsavel, revisor, observacao, fluxo_datas, ajustes, envio_status, envio_simulado, sama_agendamento_id, vios_tarefa_id, vios_tarefas, envio_erro, enviado_em";

type AgendamentoRow = {
  id: string; publicacao_id: string; ordem: number; etiqueta: EtiquetaAgendamento; tarefa: string; tarefa_id: string | null;
  data: string; data_fatal: string | null; dias_prazo: number | null; contagem_prazo: ContagemPrazo | null; hora: string | null;
  hora_fim: string | null; responsavel: string; revisor: string | null;
  observacao: string | null; fluxo_datas: DataDoFluxo[] | null; ajustes: AjusteNaTarefa[] | null; envio_status: EnvioStatus;
  envio_simulado: boolean | null; sama_agendamento_id: string | null; vios_tarefa_id: string | null;
  vios_tarefas: TarefaNoVios[] | null; envio_erro: string | null; enviado_em: string | null;
};

function agendamentoResumo(row: AgendamentoRow): AgendamentoResumo {
  return {
    id: row.id,
    ordem: row.ordem,
    etiqueta: row.etiqueta,
    tarefa: row.tarefa,
    tarefaId: row.tarefa_id,
    data: row.data,
    dataFatal: row.data_fatal,
    diasPrazo: row.dias_prazo,
    contagemPrazo: row.contagem_prazo,
    hora: row.hora,
    horaFim: row.hora_fim ?? null,
    responsavel: row.responsavel,
    revisor: row.revisor,
    observacao: row.observacao,
    fluxoDatas: row.fluxo_datas ?? [],
    ajustes: row.ajustes ?? [],
    viosTarefas: row.vios_tarefas,
    envioStatus: row.envio_status,
    envioSimulado: row.envio_simulado,
    viosTarefaId: row.vios_tarefa_id,
    envioErro: row.envio_erro,
    enviadoEm: row.enviado_em,
  };
}

export type PublicacaoComArea = PublicacaoRow & {
  area_processo: string | null;
  devolucoes: number;
  sugestao_ia: SugestaoIa | null;
  djen_partes: DjenParte[] | null;
};

export const COLUNAS_PUBLICACAO_COM_AREA = `${COLUNAS_PUBLICACAO}, area_processo, devolucoes, sugestao_ia, djen_partes`;

export async function carregarPublicacao(id: string): Promise<PublicacaoComArea> {
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .select(COLUNAS_PUBLICACAO_COM_AREA)
    .eq("id", id)
    .maybeSingle();
  if (error) falhou("carregar a publicação", error);
  if (!data) throw new VistagemError("Publicação não encontrada.", 404);
  return data as PublicacaoComArea;
}

async function agendamentosPorPublicacao(ids: string[]): Promise<Map<string, AgendamentoResumo[]>> {
  const mapa = new Map<string, AgendamentoResumo[]>();
  if (!ids.length) return mapa;
  const { data, error } = await admin()
    .from("vistagem_agendamentos")
    .select(COLUNAS_AGENDAMENTO)
    .in("publicacao_id", ids)
    .order("ordem", { ascending: true });
  if (error) falhou("carregar as tarefas vinculadas", error);
  for (const row of (data ?? []) as AgendamentoRow[]) {
    const lista = mapa.get(row.publicacao_id) ?? [];
    lista.push(agendamentoResumo(row));
    mapa.set(row.publicacao_id, lista);
  }
  return mapa;
}

/** Fluxo do VIOS de cada tarefa da lista (só as que criam algo junto ou depois). */
function fluxosDoCatalogo(catalogo: CatalogoVistagem, arvore: Map<number, TipoNaArvore>): Record<string, FluxoDaTarefa> {
  const fluxos: Record<string, FluxoDaTarefa> = {};
  for (const tarefa of ETIQUETAS_AGENDAMENTO.flatMap((etiqueta) => catalogo.tarefas[etiqueta])) {
    const fluxo = montarFluxo(tarefa.id, arvore);
    if (fluxo) fluxos[tarefa.id] = fluxo;
  }
  return fluxos;
}

/** Responsáveis fixos do tipo com o nome igual ao da lista de usuários do VIOS da área (os que não estão nela saem). */
function comResponsaveisDaArea(tarefas: OpcaoTarefa[], usuarios: OpcaoVios[]): OpcaoTarefa[] {
  return tarefas.map((tarefa) => {
    if (!tarefa.responsaveis?.length) return tarefa;
    const responsaveis = responsaveisNaArea(tarefa.responsaveis, usuarios);
    return responsaveis.length ? { ...tarefa, responsaveis } : { id: tarefa.id, nome: tarefa.nome, ...(tarefa.nomeVios ? { nomeVios: tarefa.nomeVios } : {}) };
  });
}

function catalogoDaPublicacao(areas: CatalogoArea[], publicacao: Pick<PublicacaoComArea, "area_processo" | "escritorio_responsavel">): CatalogoArea | null {
  return catalogoDaArea(areas, areaDoCatalogo(publicacao.area_processo, publicacao.escritorio_responsavel, areas.map((item) => item.area)));
}

/** A árvore do VIOS como vale para a pasta da publicação: só os tipos da lista de tarefas da área dela. */
function arvoreDaPublicacao(
  arvore: Map<number, TipoNaArvore>,
  areas: CatalogoArea[],
  publicacao: Pick<PublicacaoComArea, "area_processo" | "escritorio_responsavel">
): Map<number, TipoNaArvore> {
  return arvoreDaArea(arvore, catalogoDaPublicacao(areas, publicacao)?.etapas.map((etapa) => etapa.id) ?? null);
}

export function catalogoParaPublicacao(
  areas: CatalogoArea[],
  publicacao: Pick<PublicacaoComArea, "area_processo" | "escritorio_responsavel">
): CatalogoVistagem | null {
  const catalogo = catalogoDaPublicacao(areas, publicacao);
  if (!catalogo) return null;
  return {
    area: catalogo.area,
    atualizadoEm: catalogo.atualizadoEm,
    tarefas: {
      PRAZO: comResponsaveisDaArea(tarefasPermitidas(catalogo.etapas, "PRAZO"), catalogo.usuarios),
      PROVIDENCIA: comResponsaveisDaArea(tarefasPermitidas(catalogo.etapas, "PROVIDENCIA"), catalogo.usuarios),
      COMPROMISSO: comResponsaveisDaArea(tarefasPermitidas(catalogo.etapas, "COMPROMISSO"), catalogo.usuarios),
    },
    usuarios: catalogo.usuarios,
  };
}

// ---------------------------------------------------------------------------
// Jurídico
// ---------------------------------------------------------------------------

/** Áreas (escritórios) do usuário do jurídico; null é a controladoria, que vê todas. */
export type AreasVistagem = string[] | null;

/**
 * O jurídico só abre e grava publicações das suas áreas e, se não vista demanda de risco (Configurações › Quem acessa),
 * só as sem risco.
 */
export function garantirArea(
  publicacao: { escritorio_responsavel: string | null; demanda_risco: boolean | null },
  areas: AreasVistagem,
  veRisco = true
): void {
  if (areas && !areas.includes(publicacao.escritorio_responsavel ?? "")) {
    throw new VistagemError("Esta publicação não é de uma área sua.", 403);
  }
  if (!veRisco && publicacao.demanda_risco) {
    throw new VistagemError("Esta publicação é de demanda de risco: fica com quem vista as de risco.", 403);
  }
}

/**
 * Publicações a vistar, por escritório (ou todas as do usuário), com a contagem de cada escritório.
 * Quem não vista demanda de risco não as vê (nem na contagem).
 */
export async function listarFilaJuridico(
  escritorio: string | null,
  areas: AreasVistagem = null,
  veRisco = true
): Promise<{ publicacoes: PublicacaoResumo[]; porEscritorio: Record<string, number> }> {
  if (areas && (!areas.length || (escritorio && !areas.includes(escritorio)))) return { publicacoes: [], porEscritorio: {} };
  const db = admin();
  let consulta = db
    .from("vistagem_publicacoes")
    .select(COLUNAS_PUBLICACAO)
    .eq("status", "juridico_vistar")
    .order("data_publicacao", { ascending: true })
    .order("linha_arquivo", { ascending: true })
    .limit(500);
  let contagemConsulta = db.from("vistagem_publicacoes").select("escritorio_responsavel").eq("status", "juridico_vistar").limit(5000);
  if (escritorio) consulta = consulta.eq("escritorio_responsavel", escritorio);
  else if (areas) consulta = consulta.in("escritorio_responsavel", areas);
  if (areas) contagemConsulta = contagemConsulta.in("escritorio_responsavel", areas);
  if (!veRisco) {
    consulta = consulta.not("demanda_risco", "is", true);
    contagemConsulta = contagemConsulta.not("demanda_risco", "is", true);
  }
  const [{ data, error }, contagem] = await Promise.all([consulta, contagemConsulta]);
  if (error) falhou("carregar a fila do jurídico", error);
  if (contagem.error) falhou("contar a fila do jurídico", contagem.error);
  const porEscritorio: Record<string, number> = {};
  for (const row of contagem.data ?? []) {
    const chave = (row.escritorio_responsavel as string | null) ?? "Sem área";
    porEscritorio[chave] = (porEscritorio[chave] ?? 0) + 1;
  }
  return { publicacoes: ((data ?? []) as PublicacaoRow[]).map((row) => publicacaoResumo(row, 600)), porEscritorio };
}

/**
 * "Agendar Direto" da controladoria: a pendência ainda está na triagem e a vistagem usa o escritório (e a pasta,
 * se houver) escolhidos ali, sem gravar nada até o envio.
 */
export interface PreviaPendencia {
  escritorio: string;
  ci?: string | null;
}

async function comPrevia(publicacao: PublicacaoComArea, previa: PreviaPendencia, areasDoUsuario: AreasVistagem): Promise<PublicacaoComArea> {
  if (areasDoUsuario !== null) throw new VistagemError("Só a controladoria agenda direto da triagem.", 403);
  if (publicacao.status !== "triagem_pendente") throw new VistagemError("Esta publicação não está mais pendente na controladoria. Atualize a lista.", 409);
  if (!(ESCRITORIOS as readonly string[]).includes(previa.escritorio)) throw new VistagemError("Escolha o escritório responsável.");
  const ci = previa.ci?.replace(/\D/g, "") || publicacao.pasta_ci || "";
  const pasta = ci ? (publicacao.pastas_candidatas ?? []).find((candidata) => candidata.ci === ci) ?? (await buscarPastaPorCi(ci)) : null;
  if (ci && !pasta) throw new VistagemError(`CI ${ci} não encontrada no VIOS.`, 404);
  return {
    ...publicacao,
    escritorio_responsavel: previa.escritorio,
    ...(pasta ? dadosDaPasta(pasta) : {}),
  };
}

/** Campos da pasta escolhida, para a vistagem sugerir responsável, revisor e a lista de tarefas da área do processo. */
function dadosDaPasta(pasta: PastaSioe): Partial<PublicacaoComArea> {
  return {
    pasta_ci: pasta.ci,
    pasta_vinculo: pasta.vinculo,
    area_processo: pasta.area,
    advogado_responsavel: pasta.advogadoResponsavel,
    cliente: pasta.cliente,
    grupo_cliente: pasta.grupoCliente,
    situacao_processo: pasta.situacao,
  };
}

/** Publicação com o teor completo, as tarefas já vinculadas e a lista travada da área. */
export async function obterVistagem(
  id: string,
  areasDoUsuario: AreasVistagem = null,
  previa: PreviaPendencia | null = null,
  veRisco = true
): Promise<VistagemDetalhe> {
  const [carregada, agendamentos] = await Promise.all([carregarPublicacao(id), agendamentosPorPublicacao([id])]);
  const publicacao = previa ? await comPrevia(carregada, previa, areasDoUsuario) : carregada;
  if (!previa) garantirArea(publicacao, areasDoUsuario, veRisco);
  let catalogoErro: string | null = null;
  const areas = await carregarCatalogoProcessos().catch((erro: unknown) => {
    catalogoErro = erro instanceof Error ? erro.message : String(erro);
    return [] as CatalogoArea[];
  });
  const catalogo = areas.length ? catalogoParaPublicacao(areas, publicacao) : null;
  if (!catalogo && !catalogoErro) {
    catalogoErro = `Não há lista de tarefas do VIOS para a área "${publicacao.area_processo ?? publicacao.escritorio_responsavel ?? "sem área"}" desta pasta.`;
  }
  let fluxosErro: string | null = null;
  let sinteseErro: string | null = null;
  const [inconsistencias, feriados, pastaVios, arvore, sintese, sintesesPedidas, estagiarios, materiaVazia] = await Promise.all([
    inconsistenciasPorPublicacao([id]),
    carregarFeriados().catch(() => [] as string[]),
    publicacao.pasta_ci ? buscarPastasVios([publicacao.pasta_ci]) : Promise.resolve(new Map<string, { vinculo: string | null; auxiliarSigla: string | null }>()),
    carregarArvoreVios().catch((erro: unknown) => {
      fluxosErro = erro instanceof Error ? erro.message : String(erro);
      return null;
    }),
    publicacao.pasta_ci
      ? buscarSinteseDaPasta(publicacao.pasta_ci).catch((erro: unknown) => {
          sinteseErro = erro instanceof Error ? erro.message : String(erro);
          return null;
        })
      : Promise.resolve(null),
    // Só a lista do que já foi pedido ao robô: se a fila do SAMA não responder, o modal abre sem ela.
    publicacao.pasta_ci && !previa
      ? sintesesDaPasta(publicacao.pasta_ci).catch((erro: unknown): SintesePedida[] => {
          console.error("[vistagem] sínteses pedidas", erro instanceof Error ? erro.message : erro);
          return [];
        })
      : Promise.resolve([] as SintesePedida[]),
    catalogo && ehReestruturacao(publicacao.escritorio_responsavel ?? catalogo.area) ? estagiariosNoVios() : Promise.resolve(new Set<string>()),
    // Só decide se a síntese pede a Matéria: sem resposta do SIOE, segue sem pedir, e quem recusa é o VIOS.
    publicacao.pasta_ci && !previa
      ? pastaSemMateria(publicacao.pasta_ci).catch((erro: unknown) => {
          console.error("[vistagem] matéria da pasta", erro instanceof Error ? erro.message : erro);
          return false;
        })
      : Promise.resolve(false),
  ]);
  const materiasVios = materiaVazia
    ? await carregarMateriasVios().catch((erro: unknown) => {
        console.error("[vistagem] matérias do VIOS", erro instanceof Error ? erro.message : erro);
        return [] as MateriaVios[];
      })
    : [];
  const auxiliar = publicacao.pasta_ci ? pastaVios.get(publicacao.pasta_ci)?.auxiliarSigla ?? null : null;
  const responsavel = catalogo ? responsavelSugerido(publicacao.advogado_responsavel, catalogo.usuarios)?.nome ?? null : null;
  const revisor = catalogo ? usuarioPorSigla(auxiliar, catalogo.usuarios)?.nome ?? null : null;
  // Foto e área são enfeite e atalho: se a consulta falhar, a tela mostra as iniciais e a lista inteira do VIOS.
  const pessoas = await pessoasPorNome([publicacao.advogado_responsavel, ...(catalogo?.usuarios.map((usuario) => usuario.nome) ?? [])]).catch(
    (erro: unknown): PessoasPorNome => {
      console.error("[vistagem] fotos e áreas das pessoas", erro instanceof Error ? erro.message : erro);
      return { fotos: {}, areas: {}, rotulos: {} };
    }
  );
  return {
    publicacao: publicacaoResumo(publicacao, null),
    agendamentos: agendamentos.get(id) ?? [],
    inconsistencias: inconsistencias.get(id) ?? [],
    sintese,
    sinteseErro,
    sintesesPedidas,
    materiaVazia,
    materiasVios,
    catalogo,
    catalogoErro,
    responsavelSugerido: responsavel,
    revisorSugerido: revisor,
    fotos: pessoas.fotos,
    // Responsável e Revisor mostram as pessoas da área da fila e do processo; o servidor aceita qualquer usuário do VIOS.
    pessoasDaArea: catalogo
      ? pessoasDaArea(catalogo.usuarios, pessoas.areas, [publicacao.escritorio_responsavel, catalogo.area], [responsavel, revisor])
      : null,
    areaDasPessoas: pessoas.rotulos,
    feriados,
    fluxos: catalogo && arvore ? fluxosDoCatalogo(catalogo, arvoreDaPublicacao(arvore, areas, publicacao)) : {},
    fluxosErro,
    estagiarios: catalogo ? catalogo.usuarios.filter((usuario) => estagiarios.has(String(usuario.id))).map((usuario) => usuario.nome) : [],
    esocial:
      catalogo && pedeEsocial(catalogo.area)
        ? {
            tarefa: tarefaEsocialDaLista(catalogo.tarefas.PROVIDENCIA),
            responsavelSugerido: responsavelSugerido(RESPONSAVEL_ESOCIAL, catalogo.usuarios)?.nome ?? null,
          }
        : null,
    // Tipo recriado no VIOS depois da sugestão (CIÊNCIA NF 316 → 796): vale o de mesmo nome da lista atual.
    sugestaoIa: publicacao.sugestao_ia && catalogo ? sugestaoNaListaAtual(publicacao.sugestao_ia, catalogo.tarefas) : publicacao.sugestao_ia,
    // Na prévia da controladoria a publicação ainda não está na fila do jurídico: a IA gera depois, se for o caso.
    sugestaoIaDisponivel:
      !previa && Boolean(catalogo && areaComSugestaoIa(catalogo.area) && openAIKey("analisePublicacao")) && (await lerConfiguracoes()).iaSugestaoTarefa,
    hoje: hojeEmSaoPaulo(),
  };
}

/**
 * Usuários do VIOS (ids) com cargo de estagiário no RH do Orquestra (hr_employees ativos, vios_ci). Se o RH não
 * responder, a Ciência dos Agendamentos fica com quem faz o Enviar, como nas outras áreas.
 */
async function estagiariosNoVios(): Promise<Set<string>> {
  const { data, error } = await admin()
    .from("hr_employees")
    .select("vios_ci")
    .eq("is_active", true)
    .ilike("position", "estagi%")
    .not("vios_ci", "is", null);
  if (error) {
    console.error("[vistagem] estagiários no RH", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((row: { vios_ci: string | number }) => String(row.vios_ci)));
}

/**
 * A "1. CIÊNCIA DOS AGENDAMENTOS" que o Orquestra acrescenta quando nenhuma tarefa é ela e o fluxo do VIOS de nenhuma
 * a cria: Providência no dia, para quem faz o Enviar da primeira tarefa (Reestruturação: estagiário → revisor).
 */
async function cienciaParaGravar(
  itens: AgendamentoValidado[],
  contexto: { arvore: Map<number, TipoNaArvore>; catalogo: CatalogoVistagem; area: string | null }
): Promise<AgendamentoValidado | null> {
  const estagiarios = ehReestruturacao(contexto.area) ? await estagiariosNoVios() : new Set<string>();
  const ciencia = cienciaDosAgendamentos(
    itens.map((item) => {
      const ids = item.responsavelId.split(",");
      return {
        tarefa: item.tarefa,
        tarefaId: item.tarefaId,
        responsaveis: item.responsavel.split(", ").map((nome, indice) => ({ id: ids[indice] ?? null, nome })),
        revisor: item.revisor ? { id: item.revisorId, nome: item.revisor } : null,
      };
    }),
    {
      fluxoDe: (tarefaId) => montarFluxo(tarefaId, contexto.arvore),
      area: contexto.area,
      ehEstagiario: (pessoa) => Boolean(pessoa.id && estagiarios.has(pessoa.id)),
    }
  );
  if (!ciencia) return null;
  const tipo = contexto.catalogo.tarefas.PROVIDENCIA.find((opcao) => ehCienciaDosAgendamentos(opcao.nomeVios ?? opcao.nome));
  if (!tipo) {
    console.error("[vistagem] a área não tem 1. CIÊNCIA DOS AGENDAMENTOS nas Providências:", contexto.catalogo.area);
    return null;
  }
  return {
    etiqueta: "PROVIDENCIA",
    tarefa: tipo.nomeVios ?? tipo.nome,
    tarefaId: tipo.id,
    data: hojeEmSaoPaulo(),
    dataFatal: null,
    diasPrazo: null,
    contagemPrazo: null,
    hora: null,
    horaFim: null,
    responsavel: ciencia.responsaveis.map((pessoa) => pessoa.nome).join(", "),
    responsavelId: ciencia.responsaveis.map((pessoa) => pessoa.id ?? "").join(","),
    revisor: null,
    revisorId: null,
    observacao: null,
    fluxoDatas: [],
  };
}

/** O jurídico grava as tarefas da publicação e manda para a conferência da controladoria. */
export async function salvarVistagem(
  id: string,
  entrada: {
    agendamentos: AgendamentoEntrada[];
    observacao: string | null;
    publicacaoEsocial?: string | null;
    sugestaoUsada?: boolean;
    /** "Agendar Direto" da controladoria: resolve a pendência (escritório, grupo, risco, CI) junto com a vistagem. */
    resolucao?: ResolucaoPendencia | null;
  },
  authUserId: string,
  areas: AreasVistagem = null,
  veRisco = true
): Promise<{ central: ResultadoCentral | null }> {
  const carregada = await carregarPublicacao(id);
  const resolucao = entrada.resolucao ?? null;
  // Direto da triagem: valida tudo com o escritório e a pasta escolhidos e só então tira a pendência da controladoria.
  const publicacao = resolucao ? await comPrevia(carregada, { escritorio: resolucao.escritorio ?? "", ci: resolucao.ci }, areas) : carregada;
  if (!resolucao) {
    garantirArea(publicacao, areas, veRisco);
    if (publicacao.status !== "juridico_vistar") throw new VistagemError("Esta publicação não está aguardando vistagem.", 409);
  }
  const catalogos = await carregarCatalogoProcessos();
  const catalogo = catalogoParaPublicacao(catalogos, publicacao);
  if (!catalogo) throw new VistagemError("Não há lista de tarefas do VIOS para a área desta pasta. Avise a controladoria.", 422);

  // A data do Prazo depende do fluxo do VIOS (dias do 3. PROTOCOLAR): sem ele, não grava.
  const [feriados, arvoreInteira] = await Promise.all([carregarFeriados(), carregarArvoreVios()]);
  const arvore = arvoreDaPublicacao(arvoreInteira, catalogos, publicacao);
  const validacao = validarAgendamentos(entrada.agendamentos, {
    tarefas: catalogo.tarefas,
    usuarios: catalogo.usuarios,
    ehDiaUtil: criarCalendario(feriados),
    cadeiaDaTarefa: (tarefaId) => cadeiaDoFluxo(montarFluxo(tarefaId, arvore)),
    caminhosDaTarefa: (tarefaId) => caminhosDoFluxo(montarFluxo(tarefaId, arvore)),
    semPrazoProprio: (tarefaId) => semPrazoProprio(montarFluxo(tarefaId, arvore)),
    hoje: hojeEmSaoPaulo(),
  });
  if (!validacao.ok) throw new VistagemError(validacao.erros.join(" "));
  // Trabalhista: classificação eSocial (só na publicação, não vai para o VIOS) e, se pedir, a tarefa Inserir E-social.
  const esocial = validarEsocial({
    areaDoCatalogo: catalogo.area,
    classificacao: entrada.publicacaoEsocial,
    providencias: catalogo.tarefas.PROVIDENCIA,
    itens: validacao.itens,
  });
  if (!esocial.ok) throw new VistagemError(esocial.erro);
  // Ciência dos Agendamentos em todo agendamento: se o fluxo do VIOS das tarefas não cria, o Orquestra cria.
  const ciencia = await cienciaParaGravar(validacao.itens, {
    arvore,
    catalogo,
    area: publicacao.escritorio_responsavel ?? catalogo.area,
  });
  const itensParaGravar = ciencia ? [...validacao.itens, ciencia] : validacao.itens;
  // Mede o acerto da IA: o jurídico usou a sugestão como veio, alterou ou não usou.
  const resultadoIa = publicacao.sugestao_ia
    ? resultadoDaSugestao({
        usou: entrada.sugestaoUsada === true,
        sugestao: sugestaoNaListaAtual(publicacao.sugestao_ia, catalogo.tarefas),
        itens: validacao.itens,
        esocial: esocial.valor,
        tarefaEsocialId: tarefaEsocialDaLista(catalogo.tarefas.PROVIDENCIA)?.id ?? null,
        dataPublicacao: publicacao.data_publicacao,
        ehDiaDePrazo: criarCalendarioDePrazo(feriados),
      })
    : null;

  // Tarefas válidas: a pendência sai da triagem (vai para "juridico_vistar") e a vistagem segue como a do jurídico.
  if (resolucao) await resolverPendencia(id, resolucao, authUserId);

  const db = admin();
  const { error: erroApagar } = await db.from("vistagem_agendamentos").delete().eq("publicacao_id", id).eq("envio_status", "nao_enviado");
  if (erroApagar) falhou("substituir as tarefas da publicação", erroApagar);
  const { error: erroInserir } = await db.from("vistagem_agendamentos").insert(
    itensParaGravar.map((item, indice) => ({
      publicacao_id: id,
      ordem: indice + 1,
      etiqueta: item.etiqueta,
      tarefa: item.tarefa,
      tarefa_id: item.tarefaId,
      data: item.data,
      data_fatal: item.dataFatal,
      dias_prazo: item.diasPrazo,
      contagem_prazo: item.contagemPrazo,
      hora: item.hora,
      hora_fim: item.horaFim,
      responsavel: item.responsavel,
      responsavel_id: item.responsavelId,
      revisor: item.revisor,
      revisor_id: item.revisorId,
      observacao: item.observacao,
      fluxo_datas: item.fluxoDatas.length ? item.fluxoDatas : null,
      criado_por: authUserId,
    }))
  );
  if (erroInserir) falhou("gravar as tarefas da publicação", erroInserir);

  // Depois de uma devolução, "vistado por" continua com quem analisou primeiro (é quem errou); a nova vistagem
  // fica em revistado_por/em. Na primeira vistagem, grava quem vistou.
  const agora = new Date().toISOString();
  const revistagem = Boolean(publicacao.vistado_por && (publicacao.devolucoes ?? 0) > 0);
  const quemVistou = revistagem
    ? { revistado_por: authUserId, revistado_em: agora }
    : { vistado_por: authUserId, vistado_em: agora, revistado_por: null, revistado_em: null };
  // Sem pasta no VIOS não há onde o robô agendar: a vistagem vira pedido de abertura de pasta na Central do SharePoint.
  const abertura = vaiParaCentral({ pastaCi: publicacao.pasta_ci, pendencia: publicacao.pendencia });
  const { data: atualizada, error } = await db
    .from("vistagem_publicacoes")
    .update({
      status: abertura ? "abertura_pasta" : "controladoria_vistar",
      observacao_vistagem: entrada.observacao?.trim() || null,
      publicacao_esocial: esocial.valor,
      sugestao_ia_resultado: resultadoIa,
      ...quemVistou,
    })
    .eq("id", id)
    .eq("status", "juridico_vistar")
    .select("id")
    .maybeSingle();
  if (error) falhou("enviar a vistagem para a controladoria", error);
  if (!atualizada) throw new VistagemError("A publicação foi alterada por outra pessoa. Recarregue a página.", 409);
  return { central: abertura ? await enviarParaCentral(id) : null };
}

// ---------------------------------------------------------------------------
// Conferência da controladoria
// ---------------------------------------------------------------------------

async function nomesDosUsuarios(ids: (string | null)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter(Boolean) as string[])];
  if (!unicos.length) return new Map();
  const { data, error } = await admin().from("users").select("auth_id, name").in("auth_id", unicos);
  if (error) falhou("carregar os nomes de quem vistou", error);
  return new Map((data ?? []).map((row: { auth_id: string; name: string | null }) => [row.auth_id, row.name ?? ""]));
}

async function itensDeConferencia(
  status: string[],
  limite: number,
  ordemAscendente: boolean,
  ordem: "vistado_em" | "conferido_em" | "checado_em" = ordemAscendente ? "vistado_em" : "conferido_em",
  filtro: {
    escritorios?: string[] | null;
    vistadoDesde?: string;
    limiteTeor?: number;
    comAuxiliar?: boolean;
    semRisco?: boolean;
    /** Põe no item a sugestão da IA da vistagem (a fatal pelos dias só sai depois, com o calendário). */
    comSugestaoIa?: boolean;
  } = {}
): Promise<ConferenciaItem[]> {
  let consulta = admin()
    .from("vistagem_publicacoes")
    .select(`${COLUNAS_PUBLICACAO}, area_processo, checado_por, sugestao_ia, sugestao_ia_resultado`)
    .in("status", status)
    .order(ordem, { ascending: ordemAscendente, nullsFirst: false })
    .limit(limite);
  if (filtro.escritorios) consulta = consulta.in("escritorio_responsavel", filtro.escritorios);
  if (filtro.vistadoDesde) consulta = consulta.gte("vistado_em", filtro.vistadoDesde);
  if (filtro.semRisco) consulta = consulta.not("demanda_risco", "is", true);
  const { data, error } = await consulta;
  if (error) falhou("carregar a conferência", error);
  const linhas = (data ?? []) as (PublicacaoRow & {
    area_processo: string | null;
    checado_por: string | null;
    sugestao_ia: SugestaoIa | null;
    sugestao_ia_resultado: ResultadoSugestao | null;
  })[];
  const [agendamentos, nomes, inconsistencias, auxiliares] = await Promise.all([
    agendamentosPorPublicacao(linhas.map((row) => row.id)),
    nomesDosUsuarios(linhas.flatMap((row) => [row.vistado_por, row.devolvido_por, row.revistado_por, row.conferido_por, row.checado_por])),
    inconsistenciasPorPublicacao(linhas.map((row) => row.id)),
    filtro.comAuxiliar ? auxiliaresDasPastas(linhas) : Promise.resolve(new Map<string, string>()),
  ]);
  return linhas.map((row) => ({
    publicacao: publicacaoResumo(row, filtro.limiteTeor ?? 1500),
    areaProcesso: row.area_processo,
    agendamentos: agendamentos.get(row.id) ?? [],
    inconsistencias: inconsistencias.get(row.id) ?? [],
    vistadoPor: row.vistado_por ? nomes.get(row.vistado_por) ?? null : null,
    devolvidoPor: row.devolvido_por ? nomes.get(row.devolvido_por) ?? null : null,
    revistadoPor: row.revistado_por ? nomes.get(row.revistado_por) ?? null : null,
    conferidoPor: row.conferido_por ? nomes.get(row.conferido_por) ?? null : null,
    ...(row.checado_por ? { checadoPor: nomes.get(row.checado_por) ?? null } : {}),
    ...(filtro.comAuxiliar ? { auxiliar: auxiliares.get(row.id) ?? null } : {}),
    ...(filtro.comSugestaoIa ? { sugestaoIa: sugestaoNaVistagem(row.sugestao_ia, row.sugestao_ia_resultado) } : {}),
  }));
}

/** A sugestão como o jurídico viu na vistagem; sem calendário, a fatal só sai quando a IA fixou a data. */
function sugestaoNaVistagem(
  sugestao: SugestaoIa | null,
  resultado: ResultadoSugestao | null,
  dataPublicacao: string | null = null,
  ehDiaDePrazo: ((iso: string) => boolean) | null = null
): SugestaoNaVistagem | null {
  if (!sugestao) return null;
  const fatais = sugestao.tarefas.map((tarefa) =>
    ehDiaDePrazo ? fatalSugerida(tarefa, dataPublicacao, ehDiaDePrazo) : tarefa.classe === "PRAZO" && !tarefa.dias ? tarefa.data : null
  );
  return { sugestao, resultado, fatais };
}

/**
 * Auxiliar da pasta no VIOS de cada publicação (a sigla da pasta vira o usuário da área, como na ficha da vistagem).
 * É enfeite da ficha: se a pasta ou o catálogo não responderem, a ficha mostra o auxiliar vazio.
 */
async function auxiliaresDasPastas(linhas: (PublicacaoRow & { area_processo: string | null })[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const comPasta = linhas.filter((row) => row.pasta_ci);
  if (!comPasta.length) return mapa;
  try {
    const [pastas, areas] = await Promise.all([buscarPastasVios(comPasta.map((row) => row.pasta_ci as string)), carregarCatalogoProcessos()]);
    for (const row of comPasta) {
      const sigla = pastas.get(row.pasta_ci as string)?.auxiliarSigla ?? null;
      const usuarios = sigla ? catalogoParaPublicacao(areas, row)?.usuarios : null;
      const nome = usuarios ? usuarioPorSigla(sigla, usuarios)?.nome : null;
      if (nome) mapa.set(row.id, nome);
    }
  } catch (erro) {
    console.error("[vistagem] auxiliares da conferência", erro instanceof Error ? erro.message : erro);
  }
  return mapa;
}

/**
 * "Atualizar Síntese": põe na fila do robô o parágrafo que a pessoa escreveu, para ele acrescentar no fim da
 * síntese da pasta no VIOS como "dd/mm/aaaa (Nome): texto". Devolve a lista atualizada do que foi pedido.
 */
export async function pedirAtualizacaoSintese(
  id: string,
  texto: string,
  materiasEscolhidas: unknown,
  authUserId: string,
  areas: AreasVistagem,
  veRisco = true
): Promise<SintesePedida[]> {
  const publicacao = await carregarPublicacao(id);
  garantirArea(publicacao, areas, veRisco);
  if (!publicacao.pasta_ci) throw new VistagemError("Esta publicação está sem pasta no VIOS.");
  const trecho = texto.trim();
  if (trecho.length < 3) throw new VistagemError("Escreva o que acrescentar à síntese.");
  if (trecho.length > LIMITE_TRECHO_SINTESE) throw new VistagemError(`O trecho passa de ${LIMITE_TRECHO_SINTESE} caracteres.`);
  const autor = (await nomesDosUsuarios([authUserId])).get(authUserId)?.trim();
  if (!autor) throw new VistagemError("Seu nome não está no cadastro de usuários do Orquestra.", 403);
  const pedidas = await sintesesDaPasta(publicacao.pasta_ci);
  // Repetido é o trecho que está na fila ou já foi gravado; o que deu erro ou só foi simulado pode ir de novo.
  const repetido = (pedida: SintesePedida) => pedida.status !== "erro" && !(pedida.simulado && pedida.status === "concluido");
  if (pedidas.some((pedida) => pedida.texto.trim() === trecho && repetido(pedida))) {
    throw new VistagemError("Este trecho já foi pedido para esta pasta.", 409);
  }
  // Sem a base ou sem a lista, não trava o pedido: quem recusa é o VIOS, como antes.
  const [materiaVazia, listaDeMaterias] = await Promise.all([
    pastaSemMateria(publicacao.pasta_ci).catch(() => false),
    carregarMateriasVios().catch(() => [] as MateriaVios[]),
  ]);
  const { materias, fora } = materiasDaLista(materiasEscolhidas, listaDeMaterias);
  if (fora.length) throw new VistagemError("A Matéria escolhida não está na lista do VIOS. Recarregue a página e escolha de novo.", 422);
  if (listaDeMaterias.length && !materias.length && precisaDeMateria(materiaVazia, pedidas)) {
    throw new VistagemError("Este processo está sem Matéria no VIOS. Escolha a Matéria para o robô conseguir gravar a síntese.", 422);
  }
  const [ano, mes, dia] = hojeEmSaoPaulo().split("-");
  await enfileirarSintese({
    ci: publicacao.pasta_ci,
    cnj: publicacao.numero_processo,
    texto: trecho,
    autor,
    data: `${dia}/${mes}/${ano}`,
    simular: sinteseSimulada(),
    materias,
  });
  return sintesesDaPasta(publicacao.pasta_ci);
}

/**
 * Manda a publicação para a fila de outra área (ex.: Cível ↔ Cível | Insolvência), com o motivo.
 * Só muda o escritório no Orquestra; a pasta no VIOS fica como está.
 */
export async function transferirPublicacao(
  id: string,
  entrada: { destino: string; motivo: string },
  authUserId: string,
  areas: AreasVistagem = null,
  veRisco = true
): Promise<void> {
  const publicacao = await carregarPublicacao(id);
  garantirArea(publicacao, areas, veRisco);
  if (publicacao.status !== "juridico_vistar") throw new VistagemError("Só dá para transferir publicação aguardando vistagem.", 409);
  const destino = ESCRITORIOS.find((escritorio) => escritorio === entrada.destino);
  if (!destino) throw new VistagemError("Escolha a área de destino.");
  if (destino === publicacao.escritorio_responsavel) throw new VistagemError("A publicação já está nessa área.");
  const motivo = entrada.motivo.trim();
  if (!motivo) throw new VistagemError("Explique por que a publicação é de outra área.");
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .update({
      escritorio_responsavel: destino,
      transferido_de: publicacao.escritorio_responsavel,
      transferido_por: authUserId,
      transferido_em: new Date().toISOString(),
      transferencia_motivo: motivo.slice(0, 2000),
    })
    .eq("id", id)
    .eq("status", "juridico_vistar")
    .select("id");
  if (error) falhou("transferir a publicação", error);
  if (!data?.length) throw new VistagemError("A publicação mudou de situação. Atualize a lista.", 409);
}

/** Dias que a visão "Agendadas" do jurídico mostra. */
export const DIAS_AGENDADAS = 30;

/**
 * O que o jurídico já vistou nos últimos dias, das suas áreas: na conferência, com o robô, agendado,
 * checado ou em revisão, com as tarefas e a situação de cada uma no VIOS, e as fotos de quem aparece.
 */
export async function listarAgendadasJuridico(escritorio: string | null, areas: AreasVistagem = null, veRisco = true): Promise<AgendadasJuridicoResposta> {
  const resposta = (itens: ConferenciaItem[], fotos: Record<string, string>) => ({ itens, fotos, hoje: hojeEmSaoPaulo(), dias: DIAS_AGENDADAS });
  if (areas && (!areas.length || (escritorio && !areas.includes(escritorio)))) return resposta([], {});
  const vistadoDesde = new Date(Date.now() - DIAS_AGENDADAS * 86_400_000).toISOString();
  const itens = await itensDeConferencia(["controladoria_vistar", "pronto_para_agendar", "agendado", "checado", "revisar", "abertura_pasta"], 300, false, "vistado_em", {
    escritorios: escritorio ? [escritorio] : areas,
    vistadoDesde,
    semRisco: !veRisco,
  });
  return resposta(itens, await fotosDosItens(itens, "visão Agendadas"));
}

/** Texto da publicação na Conferência: 9 em cada 10 cabem inteiras; as maiores têm o "Ver texto completo". */
const LIMITE_TEOR_CONFERENCIA = 12_000;

export async function listarConferencia(): Promise<ConferenciaResposta> {
  const ficha = { limiteTeor: LIMITE_TEOR_CONFERENCIA, comAuxiliar: true, comSugestaoIa: true };
  const [aConferirSemFluxo, enviadasSemFluxo, aberturas, fluxo] = await Promise.all([
    itensDeConferencia(["controladoria_vistar"], 300, true, "vistado_em", ficha),
    itensDeConferencia(["pronto_para_agendar", "agendado"], 100, false, "conferido_em", ficha),
    itensDeConferencia(["abertura_pasta"], 100, false, "vistado_em", { limiteTeor: 300 }),
    // Sem a árvore do VIOS, a conferência mostra só as tarefas pedidas.
    Promise.all([carregarArvoreVios(), carregarFeriados(), carregarCatalogoProcessos()]).catch((erro: unknown) => {
      console.error("[vistagem] fluxo previsto da conferência", erro instanceof Error ? erro.message : erro);
      return null;
    }),
  ]);
  // O que o fluxo do VIOS cria com cada tarefa, para a controladoria validar tudo (não só o Enviar).
  const comFluxo = (itens: ConferenciaItem[]): ConferenciaItem[] => {
    if (!fluxo) return itens;
    const [arvoreInteira, feriados, catalogos] = fluxo;
    const ehDiaUtil = criarCalendario(feriados);
    const ehDiaDePrazo = criarCalendarioDePrazo(feriados);
    const hoje = hojeEmSaoPaulo();
    return itens.map((item) => {
      const arvore = arvoreDaPublicacao(arvoreInteira, catalogos, {
        area_processo: item.areaProcesso,
        escritorio_responsavel: item.publicacao.escritorioResponsavel,
      });
      return {
        ...item,
        // Com o calendário, a fatal da sugestão sai como o jurídico viu na tela.
        sugestaoIa: item.sugestaoIa
          ? sugestaoNaVistagem(item.sugestaoIa.sugestao, item.sugestaoIa.resultado, item.publicacao.dataPublicacao, ehDiaDePrazo)
          : item.sugestaoIa,
        agendamentos: marcarCienciaRepetida(item.agendamentos, arvore).map(({ cienciaFica, ...agendamento }) => {
          const fluxoDaTarefa = agendamento.tarefaId ? montarFluxo(agendamento.tarefaId, arvore) : null;
          // Prazo curto (ou validado noutro dia): o Enviar vai hoje e o Revisar e o Protocolar ficam antes da fatal.
          const apertada = prazoApertado(agendamento, fluxoDaTarefa, ehDiaUtil, hoje);
          return {
            ...agendamento,
            fluxoPrevisto: fluxoPrevisto(apertada ? { ...agendamento, data: apertada.enviar } : agendamento, fluxoDaTarefa, ehDiaUtil, {
              hoje,
              datas: agendamento.fluxoDatas,
              apertada,
            }).map((tarefa) =>
              tarefa.quando === "criacao" && ehCienciaDosAgendamentos(tarefa.nome) && !cienciaFica(tarefa.caminho)
                ? { ...tarefa, repetida: true }
                : tarefa
            ),
          };
        }),
      };
    });
  };
  const aConferir = comFluxo(aConferirSemFluxo);
  const enviadas = comFluxo(enviadasSemFluxo);
  const fotos = await fotosDosItens([...aConferir, ...enviadas, ...aberturas], "conferência");
  return { aConferir, enviadas, aberturas, envioSimulado: envioSimulado(), fotos, hoje: hojeEmSaoPaulo() };
}

/**
 * Fotos de quem aparece na conferência e no check: advogado e auxiliar da pasta, quem vistou, conferiu e checou, e as
 * pessoas das tarefas (pedidas, previstas no fluxo e gravadas no VIOS). Foto é enfeite: se a consulta falhar, as
 * telas mostram as iniciais.
 */
async function fotosDosItens(itens: ConferenciaItem[], tela: string): Promise<Record<string, string>> {
  const nomes = itens.flatMap((item) => [
    item.publicacao.advogadoResponsavel,
    item.auxiliar,
    item.vistadoPor,
    item.devolvidoPor,
    item.revistadoPor,
    item.conferidoPor,
    item.checadoPor,
    ...item.agendamentos.flatMap((agendamento) => [
      ...nomesDasPessoas(agendamento.responsavel),
      agendamento.revisor,
      ...(agendamento.fluxoPrevisto ?? []).flatMap((tarefa) => nomesDasPessoas(tarefa.responsaveis)),
      ...(agendamento.viosTarefas ?? []).flatMap((tarefa) => nomesDasPessoas(tarefa.responsaveis)),
    ]),
  ]);
  const pessoas = await pessoasPorNome(nomes).catch(
    (erro: unknown): PessoasPorNome => {
      console.error(`[vistagem] fotos da ${tela}`, erro instanceof Error ? erro.message : erro);
      return { fotos: {}, areas: {}, rotulos: {} };
    }
  );
  return pessoas.fotos;
}

/** Validação da controladoria: as tarefas vão para a fila do robô do SAMA (na intimação, todas juntas). */
export async function validarVistagem(id: string, authUserId: string): Promise<{ enviadas: number; simulado: boolean; central?: ResultadoCentral }> {
  const publicacao = await carregarPublicacao(id);
  if (publicacao.status !== "controladoria_vistar") throw new VistagemError("Esta publicação não está aguardando conferência.", 409);
  if (!publicacao.numero_processo) throw new VistagemError("Publicação sem número de processo: não dá para agendar no VIOS.", 422);

  const db = admin();
  const { data, error } = await db
    .from("vistagem_agendamentos")
    .select(COLUNAS_AGENDAMENTO)
    .eq("publicacao_id", id)
    .eq("envio_status", "nao_enviado")
    .order("ordem", { ascending: true });
  if (error) falhou("carregar as tarefas para envio", error);
  const agendamentos = (data ?? []) as AgendamentoRow[];
  if (!agendamentos.length) throw new VistagemError("Nenhuma tarefa para enviar.", 422);

  // Sem pasta (vistada antes de existir a Central no fluxo): o robô não tem onde agendar, vai como abertura de pasta.
  if (vaiParaCentral({ pastaCi: publicacao.pasta_ci, pendencia: publicacao.pendencia })) {
    const { data: marcadaCentral, error: erroCentral } = await db
      .from("vistagem_publicacoes")
      .update({ status: "abertura_pasta", conferido_por: authUserId, conferido_em: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "controladoria_vistar")
      .select("id")
      .maybeSingle();
    if (erroCentral) falhou("enviar para a abertura de pasta", erroCentral);
    if (!marcadaCentral) throw new VistagemError("A publicação foi alterada por outra pessoa. Recarregue a página.", 409);
    return { enviadas: agendamentos.length, simulado: false, central: await enviarParaCentral(id) };
  }

  // Marca a publicação antes de enfileirar: duas validações simultâneas não duplicam a tarefa no VIOS.
  const { data: marcada, error: erroMarcar } = await db
    .from("vistagem_publicacoes")
    .update({ status: "pronto_para_agendar", conferido_por: authUserId, conferido_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "controladoria_vistar")
    .select("id")
    .maybeSingle();
  if (erroMarcar) falhou("validar a vistagem", erroMarcar);
  if (!marcada) throw new VistagemError("A publicação foi alterada por outra pessoa. Recarregue a página.", 409);

  const simular = envioSimulado();
  try {
    const filaPorAgendamento = await enfileirarPublicacao(publicacao, agendamentos, simular);
    const agora = new Date().toISOString();
    await Promise.all(
      agendamentos.map((item) =>
        db
          .from("vistagem_agendamentos")
          .update({
            envio_status: "pendente",
            envio_simulado: simular,
            sama_agendamento_id: filaPorAgendamento.get(item.id),
            enviado_em: agora,
            envio_atualizado_em: agora,
          })
          .eq("id", item.id)
      )
    );
    return { enviadas: agendamentos.length, simulado: simular };
  } catch (erro) {
    // Volta para a conferência se a fila do robô falhou.
    await db.from("vistagem_publicacoes").update({ status: "controladoria_vistar", conferido_por: null, conferido_em: null }).eq("id", id);
    throw erro;
  }
}

/** Pedido de ajuste de uma tarefa na Conferência. */
export interface EdicaoNaConferencia extends CamposDaTarefa {
  agendamentoId: string;
}

/**
 * A controladoria ajusta data, horário e pessoas de uma tarefa (e das do fluxo dela), sem devolver ao jurídico. Grava
 * na própria tarefa, que é o que o robô lê ao validar (ou ao rodar de novo, depois de um erro), e registra quem mudou
 * o quê. As regras são as da vistagem (`validarAgendamentos`); o tipo de tarefa e a observação não mudam aqui.
 */
export async function editarTarefaNaConferencia(id: string, edicao: EdicaoNaConferencia, authUserId: string): Promise<{ mudancas: number }> {
  const publicacao = await carregarPublicacao(id);
  const db = admin();
  const { data, error } = await db
    .from("vistagem_agendamentos")
    .select(COLUNAS_AGENDAMENTO)
    .eq("id", edicao.agendamentoId)
    .eq("publicacao_id", id)
    .maybeSingle();
  if (error) falhou("carregar a tarefa", error);
  if (!data) throw new VistagemError("Tarefa não encontrada nesta publicação.", 404);
  const row = data as AgendamentoRow;
  if (!podeEditarNaConferencia(publicacao.status, row.envio_status)) {
    throw new VistagemError("Esta tarefa não está mais na conferência: a alteração não chegaria ao VIOS. Recarregue a página.", 409);
  }

  const [catalogos, feriados, arvoreInteira] = await Promise.all([carregarCatalogoProcessos(), carregarFeriados(), carregarArvoreVios()]);
  const catalogo = catalogoParaPublicacao(catalogos, publicacao);
  if (!catalogo) throw new VistagemError("Não há lista de usuários do VIOS para a área desta pasta.", 422);
  const arvore = arvoreDaPublicacao(arvoreInteira, catalogos, publicacao);
  const hoje = hojeEmSaoPaulo();
  const validacao = validarAgendamentos(
    [
      {
        etiqueta: row.etiqueta,
        tarefa: row.tarefa,
        tarefaId: row.tarefa_id,
        data: edicao.data,
        dataFatal: edicao.dataFatal,
        hora: edicao.hora,
        horaFim: edicao.horaFim,
        responsavel: edicao.responsavel,
        revisor: edicao.revisor,
        observacao: row.observacao,
        fluxoDatas: edicao.fluxoDatas,
      },
    ],
    {
      // O tipo não muda aqui: vale o que o jurídico escolheu, mesmo que a lista do VIOS tenha mudado depois.
      tarefas: { ...catalogo.tarefas, [row.etiqueta]: [{ id: row.tarefa_id ?? "", nome: row.tarefa }] },
      usuarios: catalogo.usuarios,
      ehDiaUtil: criarCalendario(feriados),
      cadeiaDaTarefa: (tarefaId) => cadeiaDoFluxo(montarFluxo(tarefaId, arvore)),
      caminhosDaTarefa: (tarefaId) => caminhosDoFluxo(montarFluxo(tarefaId, arvore)),
      semPrazoProprio: (tarefaId) => semPrazoProprio(montarFluxo(tarefaId, arvore)),
      hoje,
    }
  );
  if (!validacao.ok) throw new VistagemError(validacao.erros.map((erro) => erro.replace(/^Tarefa 1: /, "")).join(" "));
  const item = validacao.itens[0];
  // Com fatal, `validarAgendamentos` devolve o Enviar da conta; a pessoa pode ter escolhido outro.
  const enviar = item.dataFatal ? enviarDoPrazo(edicao.data, { calculado: item.data, anterior: row.data, fatal: item.dataFatal, hoje }) : { ok: true as const, data: item.data };
  if (!enviar.ok) throw new VistagemError(enviar.erro);

  const mudancas = mudancasNaTarefa(
    {
      data: row.data,
      dataFatal: row.data_fatal,
      hora: row.hora,
      horaFim: row.hora_fim,
      responsavel: row.responsavel,
      revisor: row.revisor,
      fluxoDatas: row.fluxo_datas ?? [],
    },
    {
      data: enviar.data,
      dataFatal: item.dataFatal,
      hora: item.hora,
      horaFim: item.horaFim,
      responsavel: item.responsavel,
      revisor: item.revisor,
      fluxoDatas: item.fluxoDatas,
    }
  );
  if (!mudancas.length) return { mudancas: 0 };

  const nomes = await nomesDosUsuarios([authUserId]);
  // Outra fatal: "5 dias úteis após a publicação" não vale mais (como a fatal digitada na vistagem).
  const mesmaFatal = item.dataFatal === row.data_fatal;
  const { data: atualizada, error: erroGravar } = await db
    .from("vistagem_agendamentos")
    .update({
      data: enviar.data,
      data_fatal: item.dataFatal,
      dias_prazo: mesmaFatal ? row.dias_prazo : null,
      contagem_prazo: mesmaFatal ? row.contagem_prazo : null,
      hora: item.hora,
      hora_fim: item.horaFim,
      responsavel: item.responsavel,
      responsavel_id: item.responsavelId,
      revisor: item.revisor,
      revisor_id: item.revisorId,
      fluxo_datas: item.fluxoDatas.length ? item.fluxoDatas : null,
      ajustes: [...(row.ajustes ?? []), { por: nomes.get(authUserId) || null, em: new Date().toISOString(), mudancas } satisfies AjusteNaTarefa],
    })
    .eq("id", row.id)
    // A mesma situação de quando leu: se outra pessoa validou nesse meio-tempo, não muda o que já foi para o robô.
    .eq("envio_status", row.envio_status)
    .select("id")
    .maybeSingle();
  if (erroGravar) falhou("gravar o ajuste da tarefa", erroGravar);
  if (!atualizada) throw new VistagemError("A tarefa foi alterada por outra pessoa. Recarregue a página.", 409);
  return { mudancas: mudancas.length };
}

/** IDs de comunicação das outras publicações do mesmo grupo de duplicidade (principal e duplicadas). */
async function comunicacoesEquivalentes(publicacao: PublicacaoComArea): Promise<string[]> {
  const principal = publicacao.duplicidade_de ?? publicacao.id;
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .select("id, djen_id_comunicacao")
    .or(`id.eq.${principal},duplicidade_de.eq.${principal}`);
  if (error) falhou("carregar as duplicadas da publicação", error);
  return (data ?? [])
    .filter((row) => row.id !== publicacao.id && row.djen_id_comunicacao)
    .map((row) => String(row.djen_id_comunicacao));
}

/**
 * Uma Ciência dos Agendamentos só por vistagem (`cienciaQueFica`): diz, para cada tarefa, se a Ciência num caminho
 * do fluxo dela é a que fica; as outras o robô cancela no VIOS.
 */
function marcarCienciaRepetida<T extends { id: string; ordem: number; tarefa: string; tarefaId: string | null }>(
  agendamentos: T[],
  arvore: Map<number, TipoNaArvore>
): (T & { cienciaFica: (caminho: string[]) => boolean })[] {
  const ordenados = [...agendamentos].sort((a, b) => a.ordem - b.ordem);
  const fica = cienciaQueFica(
    ordenados.map((agendamento) => ({
      chave: agendamento.id,
      nome: agendamento.tarefa,
      fluxo: agendamento.tarefaId ? montarFluxo(agendamento.tarefaId, arvore) : null,
    }))
  );
  return agendamentos.map((agendamento) => ({
    ...agendamento,
    cienciaFica: (caminho: string[]) =>
      !fica || (fica.chave === agendamento.id && fica.caminho !== null && chaveDoCaminho(fica.caminho) === chaveDoCaminho(caminho)),
  }));
}

/**
 * Datas do fluxo que o robô grava no VIOS depois de lançar: as que o jurídico mudou, as das filhas delas (que o
 * VIOS cria pela data dele) e, no prazo curto a partir de hoje, o Revisar e o Protocolar apertados antes da fatal
 * (`enviar`: o Enviar vai hoje, não no passado). Vão junto os responsáveis que o jurídico escolheu. Sem a árvore
 * do VIOS, vai só o que o jurídico mudou.
 */
async function datasDoFluxoParaOVios(publicacao: PublicacaoComArea, itens: AgendamentoRow[]): Promise<Map<string, { datas: DataDoFluxo[]; enviar: string | null }>> {
  const mapa = new Map(itens.map((item) => [item.id, { datas: item.fluxo_datas ?? [], enviar: null as string | null }]));
  const aConferir = itens.filter((item) => item.fluxo_datas?.length || (item.etiqueta === "PRAZO" && item.data_fatal));
  if (!aConferir.length) return mapa;
  try {
    const [arvoreInteira, feriados, catalogos] = await Promise.all([carregarArvoreVios(), carregarFeriados(), carregarCatalogoProcessos()]);
    const arvore = arvoreDaPublicacao(arvoreInteira, catalogos, publicacao);
    const ehDiaUtil = criarCalendario(feriados);
    const hoje = hojeEmSaoPaulo();
    for (const item of aConferir) {
      const fluxoDaTarefa = item.tarefa_id ? montarFluxo(item.tarefa_id, arvore) : null;
      const apertada = prazoApertado({ etiqueta: item.etiqueta, dataFatal: item.data_fatal, data: item.data }, fluxoDaTarefa, ehDiaUtil, hoje);
      if (!apertada && !item.fluxo_datas?.length) continue;
      const previstas = fluxoPrevisto(apertada ? { ...item, data: apertada.enviar } : item, fluxoDaTarefa, ehDiaUtil, {
        hoje,
        datas: item.fluxo_datas,
        apertada,
      });
      mapa.set(item.id, { datas: fluxoParaOVios(previstas), enviar: apertada?.enviar ?? null });
    }
  } catch (erro) {
    console.error("[vistagem] datas do fluxo para o robô", erro instanceof Error ? erro.message : erro);
  }
  return mapa;
}

/** Põe as tarefas da publicação na fila do robô; devolve o id da linha da fila de cada agendamento. */
async function enfileirarPublicacao(publicacao: PublicacaoComArea, itens: AgendamentoRow[], simular: boolean): Promise<Map<string, string>> {
  const modo = modoDaPublicacao(publicacao.arquivo, modoAgendamento());
  const [equivalentes, datasDoFluxo] = await Promise.all([
    modo === "intimacao" ? comunicacoesEquivalentes(publicacao) : Promise.resolve([] as string[]),
    datasDoFluxoParaOVios(publicacao, itens),
  ]);
  // A Ciência dos Agendamentos é para o dia do lançamento: validada noutro dia, não vai com data passada.
  const hoje = hojeEmSaoPaulo();
  const grupos = linhasParaFila(
    { ...publicacao, comunicacoes_equivalentes: equivalentes },
    itens.map((item) => ({
      ...item,
      // Prazo curto (ou validado noutro dia): o Enviar vai hoje, nunca no passado.
      data: ehCienciaDosAgendamentos(item.tarefa) && item.data < hoje ? hoje : (datasDoFluxo.get(item.id)?.enviar ?? item.data),
      fluxoDatas: datasDoFluxo.get(item.id)?.datas ?? [],
    })),
    { simular, modo }
  );
  const ids = await enfileirarNoSama(grupos.map((grupo) => grupo.linha));
  return new Map(grupos.flatMap((grupo, indice) => grupo.agendamentos.map((agendamento) => [agendamento, ids[indice]] as const)));
}

/**
 * Com o modo real ligado, reenvia ao robô as tarefas que só passaram em
 * simulação (conferidas no VIOS, sem gravar), agora para gravar.
 */
export async function reenviarGravando(id: string): Promise<{ enviadas: number }> {
  if (envioSimulado()) throw new VistagemError("O envio ainda está em modo simulação. Ligue VISTAGEM_RPA_MODO=real na Vercel.", 409);
  const publicacao = await carregarPublicacao(id);
  if (publicacao.status !== "pronto_para_agendar") throw new VistagemError("Esta publicação não está aguardando agendamento.", 409);
  const db = admin();
  const { data, error } = await db
    .from("vistagem_agendamentos")
    .select(COLUNAS_AGENDAMENTO)
    .eq("publicacao_id", id)
    .eq("envio_simulado", true)
    .in("envio_status", ["concluido", "erro"])
    .order("ordem", { ascending: true });
  if (error) falhou("carregar as tarefas simuladas", error);
  const simuladas = (data ?? []) as AgendamentoRow[];
  if (!simuladas.length) throw new VistagemError("Não há tarefas simuladas para reenviar.", 422);

  const filaPorAgendamento = await enfileirarPublicacao(publicacao, simuladas, false);
  const agora = new Date().toISOString();
  await Promise.all(
    simuladas.map((item) =>
      db
        .from("vistagem_agendamentos")
        .update({
          envio_status: "pendente",
          envio_simulado: false,
          sama_agendamento_id: filaPorAgendamento.get(item.id),
          vios_tarefa_id: null,
          envio_erro: null,
          enviado_em: agora,
          envio_atualizado_em: agora,
        })
        .eq("id", item.id)
    )
  );
  return { enviadas: simuladas.length };
}

/** Erro depois que o robô clicou em Gravar/lançou: rodar de novo pode duplicar a tarefa no VIOS. */
const ERRO_DEPOIS_DE_GRAVAR = /^\s*ATENÇÃO/i;

/**
 * Roda de novo no robô as tarefas da publicação que deram erro (aba Enviadas ao robô).
 * Se o erro diz que o robô pode ter gravado no VIOS antes de falhar, só roda com confirmação.
 */
export async function rodarNovamente(
  id: string,
  forcar: boolean
): Promise<{ enviadas: number; simulado: boolean } | { precisaConfirmar: string }> {
  const publicacao = await carregarPublicacao(id);
  if (publicacao.status !== "pronto_para_agendar") throw new VistagemError("Esta publicação não está aguardando agendamento.", 409);
  if (!publicacao.numero_processo) throw new VistagemError("Publicação sem número de processo: não dá para agendar no VIOS.", 422);
  const db = admin();
  const { data, error } = await db
    .from("vistagem_agendamentos")
    .select(COLUNAS_AGENDAMENTO)
    .eq("publicacao_id", id)
    .eq("envio_status", "erro")
    .order("ordem", { ascending: true });
  if (error) falhou("carregar as tarefas com erro", error);
  const comErro = (data ?? []) as AgendamentoRow[];
  if (!comErro.length) throw new VistagemError("Não há tarefas com erro para rodar de novo.", 422);
  if (!forcar && comErro.some((item) => ERRO_DEPOIS_DE_GRAVAR.test(item.envio_erro ?? ""))) {
    return {
      precisaConfirmar:
        "O robô pode ter gravado no VIOS antes do erro. Confira no VIOS se a tarefa já existe: rodar de novo pode duplicá-la. Rodar mesmo assim?",
    };
  }

  const simular = envioSimulado();
  const filaPorAgendamento = await enfileirarPublicacao(publicacao, comErro, simular);
  const agora = new Date().toISOString();
  await Promise.all(
    comErro.map((item) =>
      db
        .from("vistagem_agendamentos")
        .update({
          envio_status: "pendente",
          envio_simulado: simular,
          sama_agendamento_id: filaPorAgendamento.get(item.id),
          vios_tarefa_id: null,
          envio_erro: null,
          enviado_em: agora,
          envio_atualizado_em: agora,
        })
        .eq("id", item.id)
    )
  );
  return { enviadas: comErro.length, simulado: simular };
}

/** Não validado: volta para o jurídico com o motivo, mantendo as tarefas para ajuste. */
export async function devolverVistagem(id: string, entrada: InconsistenciaEntrada, authUserId: string): Promise<void> {
  const validacao = validarInconsistencia("juridico", entrada);
  if (!validacao.ok) throw new VistagemError(validacao.erro);
  const publicacao = await carregarPublicacao(id);
  if (publicacao.status !== "controladoria_vistar") throw new VistagemError("Esta publicação não está aguardando conferência.", 409);
  const db = admin();
  const { error: erroInconsistencia } = await db.from("vistagem_inconsistencias").insert({
    publicacao_id: id,
    origem: "juridico",
    tipo: validacao.valor.tipo,
    descricao: validacao.valor.descricao,
    criado_por: authUserId,
  });
  if (erroInconsistencia) falhou("registrar a inconsistência", erroInconsistencia);
  const { data: atualizada, error } = await db
    .from("vistagem_publicacoes")
    .update({
      status: "juridico_vistar",
      devolucao_motivo: `${validacao.valor.tipo}: ${validacao.valor.descricao}`.slice(0, 2000),
      devolvido_por: authUserId,
      devolvido_em: new Date().toISOString(),
      devolucoes: (publicacao.devolucoes ?? 0) + 1,
    })
    .eq("id", id)
    .eq("status", "controladoria_vistar")
    .select("id")
    .maybeSingle();
  if (error) falhou("devolver a vistagem", error);
  if (!atualizada) throw new VistagemError("A publicação foi alterada por outra pessoa. Recarregue a página.", 409);
}

/** Lê na fila do SAMA o andamento das tarefas enviadas; publicação com todas concluídas vira "agendado". */
export async function atualizarEnvios(): Promise<{ consultadas: number; concluidas: number; erros: number }> {
  const db = admin();
  const { data, error } = await db
    .from("vistagem_agendamentos")
    .select("id, publicacao_id, sama_agendamento_id, envio_status")
    .in("envio_status", ["pendente", "enviado", "processando"])
    .not("sama_agendamento_id", "is", null)
    .limit(1000);
  if (error) falhou("carregar os envios em andamento", error);
  const pendentes = (data ?? []) as { id: string; publicacao_id: string; sama_agendamento_id: string; envio_status: EnvioStatus }[];
  const resumo = { consultadas: pendentes.length, concluidas: 0, erros: 0 };
  if (!pendentes.length) return resumo;

  const fila = await consultarFilaSama(pendentes.map((item) => item.sama_agendamento_id));
  const agora = new Date().toISOString();
  const publicacoesTocadas = new Set<string>();
  for (const item of pendentes) {
    const atual = fila.get(item.sama_agendamento_id);
    if (!atual || atual.status === item.envio_status) continue;
    if (atual.status === "concluido") resumo.concluidas += 1;
    if (atual.status === "erro") resumo.erros += 1;
    publicacoesTocadas.add(item.publicacao_id);
    // Lançamento pela intimação: uma linha da fila para várias tarefas, cada uma com o seu CI.
    const viosTarefaId = atual.cisPorAgendamento.size ? atual.cisPorAgendamento.get(item.id) ?? null : atual.viosTarefaId;
    await db
      .from("vistagem_agendamentos")
      .update({
        envio_status: atual.status,
        vios_tarefa_id: viosTarefaId,
        // Datas como ficaram no VIOS (Check); só vêm no lançamento pela intimação.
        vios_tarefas: atual.tarefasViosPorAgendamento.get(item.id) ?? null,
        envio_erro: atual.erro,
        envio_atualizado_em: agora,
      })
      .eq("id", item.id);
  }

  for (const publicacaoId of publicacoesTocadas) {
    const { data: todas } = await db.from("vistagem_agendamentos").select("envio_status, envio_simulado").eq("publicacao_id", publicacaoId);
    // Simulação não grava nada no VIOS: a publicação só vira "agendado" com todas as tarefas gravadas.
    if ((todas ?? []).length && (todas ?? []).every((row) => row.envio_status === "concluido" && !row.envio_simulado)) {
      await db.from("vistagem_publicacoes").update({ status: "agendado" }).eq("id", publicacaoId).eq("status", "pronto_para_agendar");
    }
  }
  return resumo;
}

// ---------------------------------------------------------------------------
// Inconsistências: contestação do jurídico e exclusão pela controladoria
// ---------------------------------------------------------------------------

const COLUNAS_INCONSISTENCIA =
  "id, publicacao_id, origem, tipo, subtipo, descricao, criado_por, criado_em, contestacao, contestado_por, contestado_em, excluida_em, excluida_por, motivo_exclusao";

type InconsistenciaRow = {
  id: string; publicacao_id: string; origem: "juridico" | "agendamento"; tipo: string; subtipo: string | null; descricao: string;
  criado_por: string | null; criado_em: string; contestacao: string | null; contestado_por: string | null; contestado_em: string | null;
  excluida_em: string | null; excluida_por: string | null; motivo_exclusao: string | null;
};

function inconsistenciaResumo(row: InconsistenciaRow, nomes: Map<string, string>): InconsistenciaResumo {
  const nome = (id: string | null) => (id ? nomes.get(id) ?? null : null);
  return {
    id: row.id,
    origem: row.origem,
    tipo: row.tipo,
    subtipo: row.subtipo,
    descricao: row.descricao,
    criadoPor: nome(row.criado_por),
    criadoEm: row.criado_em,
    contestacao: row.contestacao,
    contestadoPor: nome(row.contestado_por),
    contestadoEm: row.contestado_em,
    excluidaEm: row.excluida_em,
    excluidaPor: nome(row.excluida_por),
    motivoExclusao: row.motivo_exclusao,
  };
}

async function resumirInconsistencias(linhas: InconsistenciaRow[]): Promise<InconsistenciaResumo[]> {
  const nomes = await nomesDosUsuarios(linhas.flatMap((row) => [row.criado_por, row.contestado_por, row.excluida_por]));
  return linhas.map((row) => inconsistenciaResumo(row, nomes));
}

async function inconsistenciasPorPublicacao(ids: string[]): Promise<Map<string, InconsistenciaResumo[]>> {
  const mapa = new Map<string, InconsistenciaResumo[]>();
  if (!ids.length) return mapa;
  const { data, error } = await admin()
    .from("vistagem_inconsistencias")
    .select(COLUNAS_INCONSISTENCIA)
    .in("publicacao_id", ids)
    .order("criado_em", { ascending: false });
  if (error) falhou("carregar as inconsistências", error);
  const linhas = (data ?? []) as InconsistenciaRow[];
  const resumos = await resumirInconsistencias(linhas);
  linhas.forEach((row, indice) => {
    const lista = mapa.get(row.publicacao_id) ?? [];
    lista.push(resumos[indice]);
    mapa.set(row.publicacao_id, lista);
  });
  return mapa;
}

async function carregarInconsistencia(id: string): Promise<InconsistenciaRow> {
  const { data, error } = await admin().from("vistagem_inconsistencias").select(COLUNAS_INCONSISTENCIA).eq("id", id).maybeSingle();
  if (error) falhou("carregar a inconsistência", error);
  if (!data) throw new VistagemError("Inconsistência não encontrada.", 404);
  return data as InconsistenciaRow;
}

/** O jurídico contesta a devolução (ex.: a controladoria devolveu errado). */
export async function contestarInconsistencia(
  id: string,
  texto: string,
  authUserId: string,
  areas: AreasVistagem = null,
  veRisco = true
): Promise<void> {
  const contestacao = texto.trim();
  if (!contestacao) throw new VistagemError("Explique por que a devolução não procede.");
  const atual = await carregarInconsistencia(id);
  if (areas) garantirArea(await carregarPublicacao(atual.publicacao_id), areas, veRisco);
  if (atual.excluida_em) throw new VistagemError("Esta inconsistência já foi excluída.", 409);
  const { error } = await admin()
    .from("vistagem_inconsistencias")
    .update({ contestacao: contestacao.slice(0, 2000), contestado_por: authUserId, contestado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) falhou("registrar a contestação", error);
}

/** A controladoria exclui a inconsistência (não conta nos indicadores), com o motivo. */
export async function excluirInconsistencia(id: string, motivo: string, authUserId: string): Promise<void> {
  const texto = motivo.trim();
  if (!texto) throw new VistagemError("Informe o motivo da exclusão.");
  const atual = await carregarInconsistencia(id);
  if (atual.excluida_em) throw new VistagemError("Esta inconsistência já foi excluída.", 409);
  const { error } = await admin()
    .from("vistagem_inconsistencias")
    .update({ excluida_em: new Date().toISOString(), excluida_por: authUserId, motivo_exclusao: texto.slice(0, 2000) })
    .eq("id", id);
  if (error) falhou("excluir a inconsistência", error);
}

export async function listarInconsistencias(situacao: "contestadas" | "abertas" | "excluidas"): Promise<InconsistenciaItem[]> {
  let consulta = admin().from("vistagem_inconsistencias").select(COLUNAS_INCONSISTENCIA).order("criado_em", { ascending: false }).limit(300);
  if (situacao === "excluidas") consulta = consulta.not("excluida_em", "is", null);
  else if (situacao === "contestadas") consulta = consulta.is("excluida_em", null).not("contestado_em", "is", null);
  else consulta = consulta.is("excluida_em", null);
  const { data, error } = await consulta;
  if (error) falhou("carregar as inconsistências", error);
  const linhas = (data ?? []) as InconsistenciaRow[];
  if (!linhas.length) return [];
  const ids = [...new Set(linhas.map((row) => row.publicacao_id))];
  const { data: pubs, error: erroPubs } = await admin().from("vistagem_publicacoes").select(COLUNAS_PUBLICACAO).in("id", ids);
  if (erroPubs) falhou("carregar as publicações das inconsistências", erroPubs);
  const porId = new Map(((pubs ?? []) as PublicacaoRow[]).map((row) => [row.id, publicacaoResumo(row, 600)]));
  const resumos = await resumirInconsistencias(linhas);
  return linhas
    .map((row, indice) => ({ inconsistencia: resumos[indice], publicacao: porId.get(row.publicacao_id) }))
    .filter((item): item is InconsistenciaItem => Boolean(item.publicacao));
}

// ---------------------------------------------------------------------------
// Check dos agendamentos
// ---------------------------------------------------------------------------

/** Publicações com as tarefas gravadas no VIOS aguardando o check, as em revisão e as últimas checadas. */
export async function listarCheck(): Promise<CheckResposta> {
  // Mesma ficha da conferência (texto maior e auxiliar da pasta): o check mostra a publicação como na vistagem.
  const ficha = { limiteTeor: LIMITE_TEOR_CONFERENCIA, comAuxiliar: true };
  const [aChecar, revisar, checadas] = await Promise.all([
    itensDeConferencia(["agendado"], 300, true, "conferido_em", ficha),
    itensDeConferencia(["revisar"], 300, true, "conferido_em", ficha),
    itensDeConferencia(["checado"], 100, false, "checado_em", ficha),
  ]);
  const fotos = await fotosDosItens([...aChecar, ...revisar, ...checadas], "tela de check");
  return { aChecar, revisar, checadas, fotos, hoje: hojeEmSaoPaulo() };
}

/** Check OK: a esteira e o agendamento no VIOS estão corretos. */
export async function checarPublicacao(id: string, nota: string | null, authUserId: string): Promise<void> {
  const publicacao = await carregarPublicacao(id);
  if (!["agendado", "revisar"].includes(publicacao.status)) throw new VistagemError("Esta publicação não está aguardando check.", 409);
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .update({ status: "checado", check_nota: nota?.trim().slice(0, 2000) || null, checado_por: authUserId, checado_em: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["agendado", "revisar"])
    .select("id")
    .maybeSingle();
  if (error) falhou("registrar o check", error);
  if (!data) throw new VistagemError("A publicação foi alterada por outra pessoa. Recarregue a página.", 409);
  // Fim da esteira: vai para o BKP do SIOE (desligado até a troca do SharePoint; VISTAGEM_BKP_SIOE=on liga).
  await registrarNoBkpSemFalhar([id]);
}

/** Erro encontrado no check: registra a inconsistência de agendamento e deixa a publicação em revisão. */
export async function apontarErroAgendamento(id: string, entrada: InconsistenciaEntrada, authUserId: string): Promise<void> {
  const validacao = validarInconsistencia("agendamento", entrada);
  if (!validacao.ok) throw new VistagemError(validacao.erro);
  const publicacao = await carregarPublicacao(id);
  if (!["agendado", "revisar"].includes(publicacao.status)) throw new VistagemError("Esta publicação não está aguardando check.", 409);
  const db = admin();
  const { error } = await db.from("vistagem_inconsistencias").insert({
    publicacao_id: id,
    origem: "agendamento",
    tipo: validacao.valor.tipo,
    subtipo: validacao.valor.subtipo,
    descricao: validacao.valor.descricao,
    criado_por: authUserId,
  });
  if (error) falhou("registrar a inconsistência", error);
  const { error: erroStatus } = await db.from("vistagem_publicacoes").update({ status: "revisar" }).eq("id", id).in("status", ["agendado", "revisar"]);
  if (erroStatus) falhou("colocar a publicação em revisão", erroStatus);
}
