import "server-only";

import { VistagemError } from "./errors";
import { falhaDoPedido, rotinaDaResposta, type RespostaDoPgNet, type RotinaNoRobo, type SituacaoDoFluxoVios } from "./rotina-vios";
import { sama } from "./sama";

/**
 * "Fluxo de tarefas do VIOS" das Configurações: quando o robô leu o fluxo pela última vez e o botão que roda agora
 * a rotina de domingo. O Orquestra não tem o segredo do robô; pede pelo SAMA, que chama a Edge Function vios-catalogo
 * com os segredos do vault (funções vios_catalogo_*, sama-rpa 20261111000017). O pg_net responde em segundo plano,
 * então cada pedido devolve um id e a resposta é lida logo depois.
 */

const ESPERA_MS = 12_000;
const PASSO_MS = 600;

const SQL_QUE_FALTA = "Falta rodar no SAMA a SQL do botão (20261111000017_vios_catalogo_pelo_orquestra.sql).";

function erroDoSama(error: { code?: string; message: string }): VistagemError {
  // PGRST202: a função não existe no SAMA (a SQL ainda não foi rodada).
  if (error.code === "PGRST202") return new VistagemError(SQL_QUE_FALTA, 503);
  return new VistagemError(`SAMA: ${error.message}`, 502);
}

async function pedir(funcao: "vios_catalogo_disparar" | "vios_catalogo_consultar", parametros?: Record<string, unknown>): Promise<number> {
  const { data, error } = await sama().rpc(funcao, parametros);
  if (error) throw erroDoSama(error);
  const id = Number(data);
  if (!Number.isFinite(id)) throw new VistagemError("O SAMA não devolveu o número do pedido ao robô.", 502);
  return id;
}

/** Espera a resposta do pedido chegar no pg_net (null se não chegar em ESPERA_MS). */
async function respostaDoPedido(id: number): Promise<RespostaDoPgNet | null> {
  const limite = Date.now() + ESPERA_MS;
  while (Date.now() < limite) {
    await new Promise((resolver) => setTimeout(resolver, PASSO_MS));
    const { data, error } = await sama().rpc("vios_catalogo_resposta", { p_id: id });
    if (error) throw erroDoSama(error);
    if (data) return data as RespostaDoPgNet;
  }
  return null;
}

async function ultimaLeitura(): Promise<{ lidoEm: string | null; tipos: number }> {
  const { data, count, error } = await sama()
    .from("vios_fluxos_tarefas")
    .select("atualizado_em", { count: "exact" })
    .order("atualizado_em", { ascending: false })
    .limit(1);
  if (error) throw new VistagemError(`Falha ao ler o fluxo de tarefas do VIOS no SAMA: ${error.message}`, 502);
  return { lidoEm: (data?.[0]?.atualizado_em as string | undefined) ?? null, tipos: count ?? 0 };
}

async function perguntarAoRobo(): Promise<{ robo: RotinaNoRobo | null; semRobo: string | null }> {
  try {
    const resposta = await respostaDoPedido(await pedir("vios_catalogo_consultar"));
    if (!resposta) return { robo: null, semRobo: "O robô não respondeu a tempo." };
    const falha = falhaDoPedido(resposta);
    if (falha) return { robo: null, semRobo: falha };
    const robo = rotinaDaResposta(resposta.conteudo);
    return robo ? { robo, semRobo: null } : { robo: null, semRobo: "A resposta do robô veio sem o estado da rotina." };
  } catch (erro) {
    return { robo: null, semRobo: erro instanceof Error ? erro.message : String(erro) };
  }
}

/** Última leitura do fluxo no SAMA e o que o robô está fazendo agora. */
export async function situacaoDoFluxoVios(): Promise<SituacaoDoFluxoVios> {
  const [leitura, robo] = await Promise.all([ultimaLeitura(), perguntarAoRobo()]);
  return { ...leitura, ...robo };
}

/**
 * Roda agora a rotina de domingo (a mesma do cron, com o catálogo inteiro relido). Se ela já estiver rodando, o robô
 * não começa outra e avisa (jaRodando).
 */
export async function atualizarFluxoVios(): Promise<SituacaoDoFluxoVios & { jaRodando: boolean }> {
  const resposta = await respostaDoPedido(await pedir("vios_catalogo_disparar", { p_refrescar: true }));
  if (!resposta) {
    throw new VistagemError("O pedido saiu, mas o robô não confirmou a tempo. Em alguns minutos, veja se a última leitura mudou.", 504);
  }
  const falha = falhaDoPedido(resposta);
  if (falha) throw new VistagemError(falha, 502);
  const jaRodando = (resposta.conteudo as { jaRodando?: unknown } | null)?.jaRodando === true;
  // Quando inicia, o robô só responde { iniciado: true }: a rodada começa agora.
  const robo: RotinaNoRobo = rotinaDaResposta(resposta.conteudo) ?? {
    rodando: true,
    inicio: new Date().toISOString(),
    fim: null,
    fluxos: null,
    erroFluxos: null,
    erro: null,
  };
  return { ...(await ultimaLeitura()), robo, semRobo: null, jaRodando };
}
