import "server-only";

import { registrarNoBkpSemFalhar } from "./bkp-sioe-server";
import { camposDaCentral, type PublicacaoParaCentral, type TarefaParaCentral } from "./central";
import { VistagemError } from "./errors";
import { carregarBaseDoFluxo, comFluxoPrevisto } from "./fluxo-previsto-server";
import { admin, falhou, hojeEmSaoPaulo } from "./server";
import { criarItemNaCentral } from "./sharepoint";
import type { ResultadoCentral } from "./types";

const COLUNAS =
  "numero_processo, processo_sufixo, numero_processo_original, grupo_cliente, cliente, escritorio_responsavel, area_processo, demanda_risco, teor, observacao_vistagem, publicacao_esocial, sugestao_triagem, vistado_por, revistado_por, data_publicacao";

const COLUNAS_TAREFA =
  "id, ordem, tarefa_id, etiqueta, tarefa, data, data_fatal, dias_prazo, contagem_prazo, hora, hora_fim, responsavel, revisor, observacao, fluxo_datas";

/** Duas chamadas ao mesmo tempo (a tela e o cron) não criam dois itens: a segunda espera este intervalo. */
const INTERVALO_ENTRE_TENTATIVAS_MS = 2 * 60_000;

type LinhaDaPublicacao = PublicacaoParaCentral & {
  area_processo: string | null;
  vistado_por: string | null;
  revistado_por: string | null;
  /** Conta o prazo marcado no calendário (regra da insolvência). */
  data_publicacao: string | null;
};

type LinhaDaTarefa = TarefaParaCentral & { id: string; ordem: number; tarefa_id: string | null };

/**
 * As tarefas com a árvore do fluxo do VIOS (datas e quem fica em cada uma), como a Conferência mostra: quem abre a
 * pasta agenda o Enviar, o Revisar, o Protocolar e as outras sem ter de refazer a conta. Sem a árvore, vão como estão.
 */
async function tarefasComFluxo(publicacao: LinhaDaPublicacao, tarefas: LinhaDaTarefa[], hoje: string): Promise<TarefaParaCentral[]> {
  const base = await carregarBaseDoFluxo("da Central do SharePoint");
  if (!base) return tarefas;
  const previstas = comFluxoPrevisto(
    tarefas.map((tarefa) => ({
      id: tarefa.id,
      ordem: tarefa.ordem,
      tarefa: tarefa.tarefa,
      tarefaId: tarefa.tarefa_id,
      etiqueta: tarefa.etiqueta,
      data: tarefa.data,
      dataFatal: tarefa.data_fatal,
      diasPrazo: tarefa.dias_prazo,
      responsavel: tarefa.responsavel,
      revisor: tarefa.revisor,
      fluxoDatas: tarefa.fluxo_datas ?? [],
    })),
    publicacao,
    base,
    hoje
  );
  return tarefas.map((tarefa, indice) => ({ ...tarefa, fluxo_previsto: previstas[indice].fluxoPrevisto, enviar_hoje: previstas[indice].enviarHoje }));
}

/**
 * Cria na Central do SharePoint o pedido de abertura de pasta de uma publicação com status "abertura_pasta". O trabalho
 * do jurídico já está gravado: se o SharePoint falhar, o erro fica na publicação (a Conferência mostra, com "Tentar de
 * novo") e o cron da Kurier tenta outra vez. Item já criado não é criado de novo.
 */
export async function enviarParaCentral(id: string): Promise<ResultadoCentral> {
  const db = admin();
  const agora = new Date().toISOString();
  const limite = new Date(Date.now() - INTERVALO_ENTRE_TENTATIVAS_MS).toISOString();
  const { data, error } = await db
    .from("vistagem_publicacoes")
    .update({ central_tentativa_em: agora })
    .eq("id", id)
    .eq("status", "abertura_pasta")
    .is("central_item_id", null)
    .or(`central_tentativa_em.is.null,central_tentativa_em.lt."${limite}"`)
    .select(COLUNAS)
    .maybeSingle();
  if (error) falhou("marcar o envio à Central do SharePoint", error);
  if (!data) {
    const { data: atual, error: erroAtual } = await db.from("vistagem_publicacoes").select("status, central_item_id, central_erro").eq("id", id).maybeSingle();
    if (erroAtual) falhou("consultar o envio à Central do SharePoint", erroAtual);
    if (atual?.central_item_id) return { itemId: atual.central_item_id, erro: null };
    if (atual?.status !== "abertura_pasta") return { itemId: null, erro: "Esta publicação não está aguardando a abertura de pasta." };
    return { itemId: null, erro: atual.central_erro ?? "O envio à Central já está em andamento. Tente de novo em instantes." };
  }

  try {
    const publicacao = data as unknown as LinhaDaPublicacao;
    const { data: tarefas, error: erroTarefas } = await db.from("vistagem_agendamentos").select(COLUNAS_TAREFA).eq("publicacao_id", id).order("ordem", { ascending: true });
    if (erroTarefas) throw new VistagemError(`Não foi possível ler as tarefas: ${erroTarefas.message}`, 500);
    const autor = publicacao.revistado_por ?? publicacao.vistado_por;
    const hoje = hojeEmSaoPaulo();
    const [{ data: pessoa }, comFluxo] = await Promise.all([
      autor ? db.from("users").select("name").eq("auth_id", autor).maybeSingle() : Promise.resolve({ data: null }),
      tarefasComFluxo(publicacao, (tarefas ?? []) as unknown as LinhaDaTarefa[], hoje),
    ]);
    const itemId = await criarItemNaCentral(camposDaCentral(publicacao, comFluxo, { vistadoPor: pessoa?.name ?? null, hoje, agora }));
    const { error: erroGravar } = await db
      .from("vistagem_publicacoes")
      .update({ central_item_id: itemId, central_enviada_em: new Date().toISOString(), central_erro: null })
      .eq("id", id);
    if (erroGravar) console.error("[vistagem] item criado na Central, mas sem gravar o id na publicação", id, itemId, erroGravar.message);
    await registrarNoBkpSemFalhar([id]);
    return { itemId, erro: null };
  } catch (erro) {
    const mensagem = (erro instanceof Error ? erro.message : String(erro)).slice(0, 1000);
    console.error("[vistagem] Central do SharePoint", id, mensagem);
    const { error: erroGravar } = await db.from("vistagem_publicacoes").update({ central_erro: mensagem }).eq("id", id);
    if (erroGravar) console.error("[vistagem] gravar o erro da Central", id, erroGravar.message);
    return { itemId: null, erro: mensagem };
  }
}

/** "Tentar de novo" da Conferência: aqui o erro volta para quem clicou. */
export async function reenviarParaCentral(id: string): Promise<ResultadoCentral> {
  const resultado = await enviarParaCentral(id);
  if (resultado.erro) throw new VistagemError(resultado.erro, 502);
  return resultado;
}

/** Rede de segurança do cron: tenta de novo o que não chegou à Central. */
export async function repassarPendentesACentral(): Promise<{ pendentes: number; enviadas: number; erros: number }> {
  const { data, error } = await admin().from("vistagem_publicacoes").select("id").eq("status", "abertura_pasta").is("central_item_id", null).limit(50);
  if (error) falhou("listar o que falta enviar à Central do SharePoint", error);
  const ids = (data ?? []).map((row: { id: string }) => row.id);
  let enviadas = 0;
  for (const id of ids) {
    if ((await enviarParaCentral(id)).itemId) enviadas += 1;
  }
  return { pendentes: ids.length, enviadas, erros: ids.length - enviadas };
}
