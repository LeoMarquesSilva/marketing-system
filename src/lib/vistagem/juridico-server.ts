import "server-only";

import {
  areaDoCatalogo,
  montarObservacaoVios,
  paraDataVios,
  responsavelSugerido,
  tarefasPermitidas,
  validarAgendamentos,
  type AgendamentoEntrada,
} from "./agendamento";
import { VistagemError } from "./errors";
import { carregarCatalogoProcessos, catalogoDaArea, consultarFilaSama, enfileirarNoSama, envioSimulado, type CatalogoArea } from "./sama";
import { COLUNAS_PUBLICACAO, admin, falhou, hojeEmSaoPaulo, publicacaoResumo, type PublicacaoRow } from "./server";
import type {
  AgendamentoResumo,
  CatalogoVistagem,
  ConferenciaItem,
  ConferenciaResposta,
  EnvioStatus,
  PublicacaoResumo,
  VistagemDetalhe,
} from "./types";

const COLUNAS_AGENDAMENTO =
  "id, publicacao_id, ordem, etiqueta, tarefa, tarefa_id, data, responsavel, revisor, observacao, envio_status, envio_simulado, sama_agendamento_id, vios_tarefa_id, envio_erro, enviado_em";

type AgendamentoRow = {
  id: string; publicacao_id: string; ordem: number; etiqueta: "PRAZO" | "PROVIDENCIA"; tarefa: string; tarefa_id: string | null;
  data: string; responsavel: string; revisor: string | null; observacao: string | null; envio_status: EnvioStatus;
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
  return {
    publicacao: publicacaoResumo(publicacao, null),
    agendamentos: agendamentos.get(id) ?? [],
    catalogo,
    catalogoErro,
    responsavelSugerido: catalogo ? responsavelSugerido(publicacao.advogado_responsavel, catalogo.usuarios)?.nome ?? null : null,
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

  const validacao = validarAgendamentos(entrada.agendamentos, { tarefas: catalogo.tarefas, usuarios: catalogo.usuarios });
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

async function itensDeConferencia(status: string[], limite: number, ordemAscendente: boolean): Promise<ConferenciaItem[]> {
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .select(COLUNAS_PUBLICACAO)
    .in("status", status)
    .order(ordemAscendente ? "vistado_em" : "conferido_em", { ascending: ordemAscendente })
    .limit(limite);
  if (error) falhou("carregar a conferência", error);
  const linhas = (data ?? []) as PublicacaoRow[];
  const [agendamentos, nomes] = await Promise.all([
    agendamentosPorPublicacao(linhas.map((row) => row.id)),
    nomesDosUsuarios(linhas.flatMap((row) => [row.vistado_por, row.conferido_por])),
  ]);
  return linhas.map((row) => ({
    publicacao: publicacaoResumo(row, 1500),
    agendamentos: agendamentos.get(row.id) ?? [],
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
  const referencia = {
    dataPublicacao: publicacao.data_publicacao,
    tribunal: publicacao.tribunal,
    numeroProcesso: publicacao.numero_processo,
    djenIdComunicacao: publicacao.djen_id_comunicacao,
  };
  try {
    const idsFila = await enfileirarNoSama(
      agendamentos.map((item) => {
        const observacao = montarObservacaoVios(referencia, item.observacao);
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
      })
    );
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

/** Não validado: volta para o jurídico com o motivo, mantendo as tarefas para ajuste. */
export async function devolverVistagem(id: string, motivo: string, authUserId: string): Promise<void> {
  const texto = motivo.trim();
  if (!texto) throw new VistagemError("Informe o motivo da devolução.");
  const publicacao = await carregarPublicacao(id);
  if (publicacao.status !== "controladoria_vistar") throw new VistagemError("Esta publicação não está aguardando conferência.", 409);
  const { data: atualizada, error } = await admin()
    .from("vistagem_publicacoes")
    .update({
      status: "juridico_vistar",
      devolucao_motivo: texto.slice(0, 2000),
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
    const { data: todas } = await db.from("vistagem_agendamentos").select("envio_status").eq("publicacao_id", publicacaoId);
    if ((todas ?? []).length && (todas ?? []).every((row) => row.envio_status === "concluido")) {
      await db.from("vistagem_publicacoes").update({ status: "agendado" }).eq("id", publicacaoId).eq("status", "pronto_para_agendar");
    }
  }
  return resumo;
}
