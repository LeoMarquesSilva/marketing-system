import "server-only";

import {
  areaDoCatalogo,
  montarObservacaoVios,
  paraDataVios,
  responsavelSugerido,
  tarefasPermitidas,
  usuarioPorSigla,
  validarAgendamentos,
  type AgendamentoEntrada,
} from "./agendamento";
import { criarCalendario } from "./dias-uteis";
import { carregarFeriados } from "./feriados";
import { buscarPastasVios } from "./pastas-vios";
import { VistagemError } from "./errors";
import { validarInconsistencia, type InconsistenciaEntrada } from "./inconsistencias";
import { carregarCatalogoProcessos, catalogoDaArea, consultarFilaSama, enfileirarNoSama, envioSimulado, type CatalogoArea } from "./sama";
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
  "id, publicacao_id, ordem, etiqueta, tarefa, tarefa_id, data, data_fatal, dias_prazo, responsavel, revisor, observacao, envio_status, envio_simulado, sama_agendamento_id, vios_tarefa_id, envio_erro, enviado_em";

type AgendamentoRow = {
  id: string; publicacao_id: string; ordem: number; etiqueta: "PRAZO" | "PROVIDENCIA"; tarefa: string; tarefa_id: string | null;
  data: string; data_fatal: string | null; dias_prazo: number | null; responsavel: string; revisor: string | null;
  observacao: string | null; envio_status: EnvioStatus;
  envio_simulado: boolean | null; sama_agendamento_id: string | null; vios_tarefa_id: string | null; envio_erro: string | null;
  enviado_em: string | null;
};

function agendamentoResumo(row: AgendamentoRow): AgendamentoResumo {
  return {
    id: row.id,
    ordem: row.ordem,
    etiqueta: row.etiqueta,
    tarefa: row.tarefa,
    data: row.data,
    dataFatal: row.data_fatal,
    diasPrazo: row.dias_prazo,
    responsavel: row.responsavel,
    revisor: row.revisor,
    observacao: row.observacao,
    envioStatus: row.envio_status,
    envioSimulado: row.envio_simulado,
    viosTarefaId: row.vios_tarefa_id,
    envioErro: row.envio_erro,
    enviadoEm: row.enviado_em,
  };
}

type PublicacaoComArea = PublicacaoRow & { area_processo: string | null; devolucoes: number };

async function carregarPublicacao(id: string): Promise<PublicacaoComArea> {
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .select(`${COLUNAS_PUBLICACAO}, area_processo, devolucoes`)
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

function catalogoParaPublicacao(areas: CatalogoArea[], publicacao: PublicacaoComArea): CatalogoVistagem | null {
  const area = areaDoCatalogo(publicacao.area_processo, publicacao.escritorio_responsavel, areas.map((item) => item.area));
  const catalogo = catalogoDaArea(areas, area);
  if (!catalogo) return null;
  return {
    area: catalogo.area,
    atualizadoEm: catalogo.atualizadoEm,
    tarefas: { PRAZO: tarefasPermitidas(catalogo.etapas, "PRAZO"), PROVIDENCIA: tarefasPermitidas(catalogo.etapas, "PROVIDENCIA") },
    usuarios: catalogo.usuarios,
  };
}

// ---------------------------------------------------------------------------
// Jurídico
// ---------------------------------------------------------------------------

/** Publicações a vistar, por escritório (ou todas), com a contagem de cada escritório. */
export async function listarFilaJuridico(escritorio: string | null): Promise<{ publicacoes: PublicacaoResumo[]; porEscritorio: Record<string, number> }> {
  const db = admin();
  let consulta = db
    .from("vistagem_publicacoes")
    .select(COLUNAS_PUBLICACAO)
    .eq("status", "juridico_vistar")
    .order("data_publicacao", { ascending: true })
    .order("linha_arquivo", { ascending: true })
    .limit(500);
  if (escritorio) consulta = consulta.eq("escritorio_responsavel", escritorio);
  const [{ data, error }, contagem] = await Promise.all([
    consulta,
    db.from("vistagem_publicacoes").select("escritorio_responsavel").eq("status", "juridico_vistar").limit(5000),
  ]);
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
export async function obterVistagem(id: string): Promise<VistagemDetalhe> {
  const [publicacao, agendamentos] = await Promise.all([carregarPublicacao(id), agendamentosPorPublicacao([id])]);
  let catalogoErro: string | null = null;
  const areas = await carregarCatalogoProcessos().catch((erro: unknown) => {
    catalogoErro = erro instanceof Error ? erro.message : String(erro);
    return [] as CatalogoArea[];
  });
  const catalogo = areas.length ? catalogoParaPublicacao(areas, publicacao) : null;
  if (!catalogo && !catalogoErro) {
    catalogoErro = `Não há lista de tarefas do VIOS para a área "${publicacao.area_processo ?? publicacao.escritorio_responsavel ?? "sem área"}" desta pasta.`;
  }
  const [inconsistencias, feriados, pastaVios] = await Promise.all([
    inconsistenciasPorPublicacao([id]),
    carregarFeriados().catch(() => [] as string[]),
    publicacao.pasta_ci ? buscarPastasVios([publicacao.pasta_ci]) : Promise.resolve(new Map<string, { vinculo: string | null; auxiliarSigla: string | null }>()),
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
    hoje: hojeEmSaoPaulo(),
  };
}

/** O jurídico grava as tarefas da publicação e manda para a conferência da controladoria. */
export async function salvarVistagem(
  id: string,
  entrada: { agendamentos: AgendamentoEntrada[]; observacao: string | null },
  authUserId: string
): Promise<void> {
  const publicacao = await carregarPublicacao(id);
  if (publicacao.status !== "juridico_vistar") throw new VistagemError("Esta publicação não está aguardando vistagem.", 409);
  const catalogo = catalogoParaPublicacao(await carregarCatalogoProcessos(), publicacao);
  if (!catalogo) throw new VistagemError("Não há lista de tarefas do VIOS para a área desta pasta. Avise a controladoria.", 422);

  const feriados = await carregarFeriados();
  const validacao = validarAgendamentos(entrada.agendamentos, {
    tarefas: catalogo.tarefas,
    usuarios: catalogo.usuarios,
    ehDiaUtil: criarCalendario(feriados),
  });
  if (!validacao.ok) throw new VistagemError(validacao.erros.join(" "));

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

export async function listarConferencia(): Promise<ConferenciaResposta> {
  const [aConferir, enviadas] = await Promise.all([
    itensDeConferencia(["controladoria_vistar"], 300, true),
    itensDeConferencia(["pronto_para_agendar", "agendado"], 100, false),
  ]);
  return { aConferir, enviadas, envioSimulado: envioSimulado() };
}

/** Validação da controladoria: cada tarefa vai para a fila do robô do SAMA. */
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
    const idsFila = await enfileirarNoSama(agendamentos.map((item) => linhaParaFila(publicacao, item, simular)));
    const agora = new Date().toISOString();
    await Promise.all(
      agendamentos.map((item, indice) =>
        db
          .from("vistagem_agendamentos")
          .update({ envio_status: "pendente", envio_simulado: simular, sama_agendamento_id: idsFila[indice], enviado_em: agora, envio_atualizado_em: agora })
          .eq("id", item.id)
      )
    );
    return { enviadas: idsFila.length, simulado: simular };
  } catch (erro) {
    // Volta para a conferência se a fila do robô falhou.
    await db.from("vistagem_publicacoes").update({ status: "controladoria_vistar", conferido_por: null, conferido_em: null }).eq("id", id);
    throw erro;
  }
}

function linhaParaFila(publicacao: PublicacaoComArea, item: AgendamentoRow, simular: boolean) {
  const observacao = montarObservacaoVios(
    {
      dataPublicacao: publicacao.data_publicacao,
      tribunal: publicacao.tribunal,
      numeroProcesso: publicacao.numero_processo,
      djenIdComunicacao: publicacao.djen_id_comunicacao,
    },
    item.observacao
  );
  return {
    tipo: item.etiqueta === "PRAZO" ? "Prazo" : "Providências",
    tarefa: item.tarefa,
    tarefa_id: item.tarefa_id,
    etiqueta_id: item.etiqueta === "PRAZO" ? "1" : "204",
    observacao,
    passo_texto: observacao,
    data: paraDataVios(item.data),
    pasta: publicacao.numero_processo as string,
    pasta_tipo: "Processo" as const,
    ci_pasta: publicacao.pasta_ci,
    responsavel: item.responsavel,
    revisor: item.revisor,
    simular,
  };
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

  const idsFila = await enfileirarNoSama(simuladas.map((item) => linhaParaFila(publicacao, item, false)));
  const agora = new Date().toISOString();
  await Promise.all(
    simuladas.map((item, indice) =>
      db
        .from("vistagem_agendamentos")
        .update({
          envio_status: "pendente",
          envio_simulado: false,
          sama_agendamento_id: idsFila[indice],
          vios_tarefa_id: null,
          envio_erro: null,
          enviado_em: agora,
          envio_atualizado_em: agora,
        })
        .eq("id", item.id)
    )
  );
  return { enviadas: idsFila.length };
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
    await db
      .from("vistagem_agendamentos")
      .update({ envio_status: atual.status, vios_tarefa_id: atual.viosTarefaId, envio_erro: atual.erro, envio_atualizado_em: agora })
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
export async function contestarInconsistencia(id: string, texto: string, authUserId: string): Promise<void> {
  const contestacao = texto.trim();
  if (!contestacao) throw new VistagemError("Explique por que a devolução não procede.");
  const atual = await carregarInconsistencia(id);
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
