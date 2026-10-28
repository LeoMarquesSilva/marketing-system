import "server-only";

import {
  ETIQUETAS_AGENDAMENTO,
  areaDoCatalogo,
  responsavelSugerido,
  tarefasPermitidas,
  usuarioPorSigla,
  validarAgendamentos,
  type AgendamentoEntrada,
  type EtiquetaAgendamento,
} from "./agendamento";
import { openAIKey } from "@/lib/openai-keys";
import { criarCalendario, criarCalendarioDePrazo, type ContagemPrazo } from "./dias-uteis";
import { RESPONSAVEL_ESOCIAL, pedeEsocial, tarefaEsocialDaLista, validarEsocial } from "./esocial";
import { areaComSugestaoIa, resultadoDaSugestao, type SugestaoIa } from "./sugestao-ia";
import { carregarFeriados } from "./feriados";
import { cadeiaDoFluxo, montarFluxo, type FluxoDaTarefa, type TipoNaArvore } from "./fluxo-vios";
import { buscarPastasVios } from "./pastas-vios";
import { VistagemError } from "./errors";
import { validarInconsistencia, type InconsistenciaEntrada } from "./inconsistencias";
import { linhasParaFila, type TarefaNoVios } from "./fila-vios";
import { ESCRITORIOS } from "./triagem";
import {
  carregarArvoreVios,
  carregarCatalogoProcessos,
  catalogoDaArea,
  consultarFilaSama,
  enfileirarNoSama,
  envioSimulado,
  modoAgendamento,
  type CatalogoArea,
} from "./sama";
import { COLUNAS_PUBLICACAO, admin, falhou, hojeEmSaoPaulo, publicacaoResumo, type PublicacaoRow } from "./server";
import type {
  AgendamentoResumo,
  CatalogoVistagem,
  ConferenciaItem,
  ConferenciaResposta,
  CheckResposta,
  EnvioStatus,
  InconsistenciaItem,
  InconsistenciaResumo,
  PublicacaoResumo,
  VistagemDetalhe,
} from "./types";

const COLUNAS_AGENDAMENTO =
  "id, publicacao_id, ordem, etiqueta, tarefa, tarefa_id, data, data_fatal, dias_prazo, contagem_prazo, hora, responsavel, revisor, observacao, envio_status, envio_simulado, sama_agendamento_id, vios_tarefa_id, vios_tarefas, envio_erro, enviado_em";

type AgendamentoRow = {
  id: string; publicacao_id: string; ordem: number; etiqueta: EtiquetaAgendamento; tarefa: string; tarefa_id: string | null;
  data: string; data_fatal: string | null; dias_prazo: number | null; contagem_prazo: ContagemPrazo | null; hora: string | null;
  responsavel: string; revisor: string | null;
  observacao: string | null; envio_status: EnvioStatus;
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
    responsavel: row.responsavel,
    revisor: row.revisor,
    observacao: row.observacao,
    viosTarefas: row.vios_tarefas,
    envioStatus: row.envio_status,
    envioSimulado: row.envio_simulado,
    viosTarefaId: row.vios_tarefa_id,
    envioErro: row.envio_erro,
    enviadoEm: row.enviado_em,
  };
}

export type PublicacaoComArea = PublicacaoRow & { area_processo: string | null; devolucoes: number; sugestao_ia: SugestaoIa | null };

export const COLUNAS_PUBLICACAO_COM_AREA = `${COLUNAS_PUBLICACAO}, area_processo, devolucoes, sugestao_ia`;

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

export function catalogoParaPublicacao(
  areas: CatalogoArea[],
  publicacao: Pick<PublicacaoComArea, "area_processo" | "escritorio_responsavel">
): CatalogoVistagem | null {
  const area = areaDoCatalogo(publicacao.area_processo, publicacao.escritorio_responsavel, areas.map((item) => item.area));
  const catalogo = catalogoDaArea(areas, area);
  if (!catalogo) return null;
  return {
    area: catalogo.area,
    atualizadoEm: catalogo.atualizadoEm,
    tarefas: {
      PRAZO: tarefasPermitidas(catalogo.etapas, "PRAZO"),
      PROVIDENCIA: tarefasPermitidas(catalogo.etapas, "PROVIDENCIA"),
      COMPROMISSO: tarefasPermitidas(catalogo.etapas, "COMPROMISSO"),
    },
    usuarios: catalogo.usuarios,
  };
}

// ---------------------------------------------------------------------------
// Jurídico
// ---------------------------------------------------------------------------

/** Áreas (escritórios) do usuário do jurídico; null é a controladoria, que vê todas. */
export type AreasVistagem = string[] | null;

/** O jurídico só abre e grava publicações das suas áreas. */
export function garantirArea(publicacao: { escritorio_responsavel: string | null }, areas: AreasVistagem): void {
  if (areas && !areas.includes(publicacao.escritorio_responsavel ?? "")) {
    throw new VistagemError("Esta publicação não é de uma área sua.", 403);
  }
}

/** Publicações a vistar, por escritório (ou todas as do usuário), com a contagem de cada escritório. */
export async function listarFilaJuridico(
  escritorio: string | null,
  areas: AreasVistagem = null
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
  const [{ data, error }, contagem] = await Promise.all([consulta, contagemConsulta]);
  if (error) falhou("carregar a fila do jurídico", error);
  if (contagem.error) falhou("contar a fila do jurídico", contagem.error);
  const porEscritorio: Record<string, number> = {};
  for (const row of contagem.data ?? []) {
    const chave = (row.escritorio_responsavel as string | null) ?? "Sem escritório";
    porEscritorio[chave] = (porEscritorio[chave] ?? 0) + 1;
  }
  return { publicacoes: ((data ?? []) as PublicacaoRow[]).map((row) => publicacaoResumo(row, 600)), porEscritorio };
}

/** Publicação com o teor completo, as tarefas já vinculadas e a lista travada da área. */
export async function obterVistagem(id: string, areasDoUsuario: AreasVistagem = null): Promise<VistagemDetalhe> {
  const [publicacao, agendamentos] = await Promise.all([carregarPublicacao(id), agendamentosPorPublicacao([id])]);
  garantirArea(publicacao, areasDoUsuario);
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
  const [inconsistencias, feriados, pastaVios, arvore] = await Promise.all([
    inconsistenciasPorPublicacao([id]),
    carregarFeriados().catch(() => [] as string[]),
    publicacao.pasta_ci ? buscarPastasVios([publicacao.pasta_ci]) : Promise.resolve(new Map<string, { vinculo: string | null; auxiliarSigla: string | null }>()),
    carregarArvoreVios().catch((erro: unknown) => {
      fluxosErro = erro instanceof Error ? erro.message : String(erro);
      return null;
    }),
  ]);
  const auxiliar = publicacao.pasta_ci ? pastaVios.get(publicacao.pasta_ci)?.auxiliarSigla ?? null : null;
  return {
    publicacao: publicacaoResumo(publicacao, null),
    agendamentos: agendamentos.get(id) ?? [],
    inconsistencias: inconsistencias.get(id) ?? [],
    catalogo,
    catalogoErro,
    responsavelSugerido: catalogo ? responsavelSugerido(publicacao.advogado_responsavel, catalogo.usuarios)?.nome ?? null : null,
    revisorSugerido: catalogo ? usuarioPorSigla(auxiliar, catalogo.usuarios)?.nome ?? null : null,
    feriados,
    fluxos: catalogo && arvore ? fluxosDoCatalogo(catalogo, arvore) : {},
    fluxosErro,
    esocial:
      catalogo && pedeEsocial(catalogo.area)
        ? {
            tarefa: tarefaEsocialDaLista(catalogo.tarefas.PROVIDENCIA),
            responsavelSugerido: responsavelSugerido(RESPONSAVEL_ESOCIAL, catalogo.usuarios)?.nome ?? null,
          }
        : null,
    sugestaoIa: publicacao.sugestao_ia,
    sugestaoIaDisponivel: Boolean(catalogo && areaComSugestaoIa(catalogo.area) && openAIKey("analisePublicacao")),
    hoje: hojeEmSaoPaulo(),
  };
}

/** O jurídico grava as tarefas da publicação e manda para a conferência da controladoria. */
export async function salvarVistagem(
  id: string,
  entrada: { agendamentos: AgendamentoEntrada[]; observacao: string | null; publicacaoEsocial?: string | null; sugestaoUsada?: boolean },
  authUserId: string,
  areas: AreasVistagem = null
): Promise<void> {
  const publicacao = await carregarPublicacao(id);
  garantirArea(publicacao, areas);
  if (publicacao.status !== "juridico_vistar") throw new VistagemError("Esta publicação não está aguardando vistagem.", 409);
  const catalogo = catalogoParaPublicacao(await carregarCatalogoProcessos(), publicacao);
  if (!catalogo) throw new VistagemError("Não há lista de tarefas do VIOS para a área desta pasta. Avise a controladoria.", 422);

  // A data do Prazo depende do fluxo do VIOS (dias do 3. PROTOCOLAR): sem ele, não grava.
  const [feriados, arvore] = await Promise.all([carregarFeriados(), carregarArvoreVios()]);
  const validacao = validarAgendamentos(entrada.agendamentos, {
    tarefas: catalogo.tarefas,
    usuarios: catalogo.usuarios,
    ehDiaUtil: criarCalendario(feriados),
    cadeiaDaTarefa: (tarefaId) => cadeiaDoFluxo(montarFluxo(tarefaId, arvore)),
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
  // Mede o acerto da IA: o jurídico usou a sugestão como veio, alterou ou não usou.
  const resultadoIa = publicacao.sugestao_ia
    ? resultadoDaSugestao({
        usou: entrada.sugestaoUsada === true,
        sugestao: publicacao.sugestao_ia,
        itens: validacao.itens,
        esocial: esocial.valor,
        tarefaEsocialId: tarefaEsocialDaLista(catalogo.tarefas.PROVIDENCIA)?.id ?? null,
        dataPublicacao: publicacao.data_publicacao,
        ehDiaDePrazo: criarCalendarioDePrazo(feriados),
      })
    : null;

  const db = admin();
  const { error: erroApagar } = await db.from("vistagem_agendamentos").delete().eq("publicacao_id", id).eq("envio_status", "nao_enviado");
  if (erroApagar) falhou("substituir as tarefas da publicação", erroApagar);
  const { error: erroInserir } = await db.from("vistagem_agendamentos").insert(
    validacao.itens.map((item, indice) => ({
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
      responsavel: item.responsavel,
      responsavel_id: item.responsavelId,
      revisor: item.revisor,
      revisor_id: item.revisorId,
      observacao: item.observacao,
      criado_por: authUserId,
    }))
  );
  if (erroInserir) falhou("gravar as tarefas da publicação", erroInserir);

  const { data: atualizada, error } = await db
    .from("vistagem_publicacoes")
    .update({
      status: "controladoria_vistar",
      observacao_vistagem: entrada.observacao?.trim() || null,
      publicacao_esocial: esocial.valor,
      sugestao_ia_resultado: resultadoIa,
      vistado_por: authUserId,
      vistado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "juridico_vistar")
    .select("id")
    .maybeSingle();
  if (error) falhou("enviar a vistagem para a controladoria", error);
  if (!atualizada) throw new VistagemError("A publicação foi alterada por outra pessoa. Recarregue a página.", 409);
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
  ordem: "vistado_em" | "conferido_em" | "checado_em" = ordemAscendente ? "vistado_em" : "conferido_em"
): Promise<ConferenciaItem[]> {
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .select(COLUNAS_PUBLICACAO)
    .in("status", status)
    .order(ordem, { ascending: ordemAscendente, nullsFirst: false })
    .limit(limite);
  if (error) falhou("carregar a conferência", error);
  const linhas = (data ?? []) as PublicacaoRow[];
  const [agendamentos, nomes, inconsistencias] = await Promise.all([
    agendamentosPorPublicacao(linhas.map((row) => row.id)),
    nomesDosUsuarios(linhas.flatMap((row) => [row.vistado_por, row.conferido_por])),
    inconsistenciasPorPublicacao(linhas.map((row) => row.id)),
  ]);
  return linhas.map((row) => ({
    publicacao: publicacaoResumo(row, 1500),
    agendamentos: agendamentos.get(row.id) ?? [],
    inconsistencias: inconsistencias.get(row.id) ?? [],
    vistadoPor: row.vistado_por ? nomes.get(row.vistado_por) ?? null : null,
    conferidoPor: row.conferido_por ? nomes.get(row.conferido_por) ?? null : null,
  }));
}

/**
 * Manda a publicação para a fila de outra área (ex.: Cível ↔ Reestruturação), com o motivo.
 * Só muda o escritório no Orquestra; a pasta no VIOS fica como está.
 */
export async function transferirPublicacao(
  id: string,
  entrada: { destino: string; motivo: string },
  authUserId: string,
  areas: AreasVistagem = null
): Promise<void> {
  const publicacao = await carregarPublicacao(id);
  garantirArea(publicacao, areas);
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

export async function listarConferencia(): Promise<ConferenciaResposta> {
  const [aConferir, enviadas] = await Promise.all([
    itensDeConferencia(["controladoria_vistar"], 300, true),
    itensDeConferencia(["pronto_para_agendar", "agendado"], 100, false),
  ]);
  return { aConferir, enviadas, envioSimulado: envioSimulado() };
}

/** Validação da controladoria: as tarefas vão para a fila do robô do SAMA (na intimação, todas juntas). */
export async function validarVistagem(id: string, authUserId: string): Promise<{ enviadas: number; simulado: boolean }> {
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

/** Põe as tarefas da publicação na fila do robô; devolve o id da linha da fila de cada agendamento. */
async function enfileirarPublicacao(publicacao: PublicacaoComArea, itens: AgendamentoRow[], simular: boolean): Promise<Map<string, string>> {
  const modo = modoAgendamento();
  const equivalentes = modo === "intimacao" ? await comunicacoesEquivalentes(publicacao) : [];
  const grupos = linhasParaFila({ ...publicacao, comunicacoes_equivalentes: equivalentes }, itens, { simular, modo });
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
export async function contestarInconsistencia(id: string, texto: string, authUserId: string, areas: AreasVistagem = null): Promise<void> {
  const contestacao = texto.trim();
  if (!contestacao) throw new VistagemError("Explique por que a devolução não procede.");
  const atual = await carregarInconsistencia(id);
  if (areas) garantirArea(await carregarPublicacao(atual.publicacao_id), areas);
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
  const [aChecar, revisar, checadas] = await Promise.all([
    itensDeConferencia(["agendado"], 300, true, "conferido_em"),
    itensDeConferencia(["revisar"], 300, true, "conferido_em"),
    itensDeConferencia(["checado"], 100, false, "checado_em"),
  ]);
  return { aChecar, revisar, checadas };
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
